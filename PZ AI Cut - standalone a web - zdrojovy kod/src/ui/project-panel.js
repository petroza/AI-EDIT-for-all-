'use strict';
// Panel Projekt: média a sekvence, náhledy, dvojklik = Zdroj / otevřít sekvenci, přetažení na timeline.
const { timecode } = require('../core/util');

function createProjectPanel(app) {
  const $ = (id) => document.getElementById(id);
  const list = $('projList'), search = $('projSearch'), count = $('projCount');
  let selected = null; // {type:'media'|'seq', id}

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const ICONS = require('./icons');
  // Icon View jako v Premiere: dlaždice s náhledem, odznakem typu, délkou a názvem pod ním
  function renderIcons(q, p) {
    let h = '';
    const tile = (type, id, name, thumbUrl, badge, dur, extra) => {
      const sel = selected && selected.id === id ? ' sel' : '';
      return `<div class="pi tile${sel}${extra || ''}" data-type="${type}" data-id="${id}" draggable="true" title="${esc(name)}">
        <div class="tthumb" style="${thumbUrl ? `background-image:url('${thumbUrl}')` : ''}"><span class="tbadge">${badge}</span><span class="tdur">${dur}</span>${extra && /missing/.test(extra) ? '<span class="toffline">Media Offline</span>' : ''}${type === 'media' ? `<span class="asr-tag" data-mid="${id}"></span><span class="asr-prog" data-mid="${id}"><i></i></span>` : ''}</div>
        <div class="tname"><i class="lbl ${type}"></i>${esc(name)}</div></div>`;
    };
    for (const m of p.media) {
      if (q && !m.name.toLowerCase().includes(q)) continue;
      h += tile('media', m.id, m.name, m.hasVideo ? m.thumbUrl : '', m.hasVideo ? ICONS.vidBadge : ICONS.audBadge,
        m.duration ? timecode(m.duration, m.fps || 25).replace(/^00:/, '') : '…', m.missing ? ' missing' : '');
    }
    for (const s of p.sequences) {
      if (q && !s.name.toLowerCase().includes(q)) continue;
      let thumb = '';
      for (const t of s.tracks.video) { const c = t.clips[0]; if (c) { const m = p.mediaById(c.mediaId); if (m && m.thumbUrl) { thumb = m.thumbUrl; break; } } }
      h += tile('seq', s.id, s.name, thumb, ICONS.seqBadge, timecode(app.seqDuration(s), s.fps).replace(/^00:/, ''), s.id === p.activeSequenceId ? ' active' : '');
    }
    return h;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const p = app.project;
    let h = '';
    if (list.classList.contains('icons')) {
      h = renderIcons(q, p);
      list.innerHTML = h || emptyHtml();
      ariaSync();
      count.textContent = `${p.media.length + p.sequences.length} items`;
      paintAsr();
      return;
    }
    for (const s of p.sequences) {
      if (q && !s.name.toLowerCase().includes(q)) continue;
      const sel = selected && selected.id === s.id ? ' sel' : '';
      h += `<div class="pi${sel}" data-type="seq" data-id="${s.id}" draggable="true">
        <div class="thumb seq">▤</div>
        <div class="meta"><div class="nm" title="${esc(s.name)}">${esc(s.name)}${s.id === p.activeSequenceId ? ' <span class="dim">●</span>' : ''}</div>
        <div class="info">${timecode(app.seqDuration(s), s.fps)} · ${s.width}×${s.height} · ${s.fps} fps</div></div></div>`;
    }
    for (const m of p.media) {
      if (q && !m.name.toLowerCase().includes(q)) continue;
      const sel = selected && selected.id === m.id ? ' sel' : '';
      const th = m.hasVideo ? `<div class="thumb" style="${m.thumbUrl ? `background-image:url('${m.thumbUrl}')` : ''}"></div>` : '<div class="thumb aud">♪</div>';
      let info = m.duration ? timecode(m.duration, m.fps || 25) : '…';
      if (m.hasVideo) info += ` · ${m.width}×${m.height} · ${m.fps} fps`;
      else if (m.hasAudio) info += ' · audio';
      let prog = '';
      if (!m.playable && !m.proxy && !m.proxyError && !m.missing) prog = `<div class="prog" title="Creating a playback proxy"><i style="width:${Math.round((m.proxyProgress || 0) * 100)}%"></i></div>`;
      if (m.proxyError) info += ' · ✖ proxy';
      if (m.missing) info += window.TN && window.TN.lang === 'cs' ? ' · médium offline' : ' · media offline';
      h += `<div class="pi${sel}${m.missing ? ' missing' : ''}" data-type="media" data-id="${m.id}" draggable="true" title="${esc(m.path)}">
        ${th}<div class="meta"><div class="nm">${esc(m.name)}</div><div class="info">${info}<span class="asr-info" data-mid="${m.id}"></span></div>${prog}<span class="asr-prog row" data-mid="${m.id}"><i></i></span></div></div>`;
    }
    list.innerHTML = h || emptyHtml();
      ariaSync();
    count.textContent = `${p.media.length + p.sequences.length} items`;
    paintAsr();
  }
  function emptyHtml() {
    const cs = window.TN && window.TN.lang === 'cs';
    return cs ? '<div class="dim proj-empty" style="padding:14px;line-height:1.6">Projekt je prázdný.<br>Přetáhni sem video z Průzkumníka nebo klikni na <b>Importovat</b>.</div>'
      : '<div class="dim proj-empty" style="padding:14px;line-height:1.6">The project is empty.<br>Drag video files here from Explorer or click <b>Import</b>.</div>';
  }
  // přístupnost (S14): seznam pro čtečku + ovládání klávesnicí jako panel Projekt v Premiere
  function ariaSync() {
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', window.TN && window.TN.lang === 'cs' ? 'Projekt' : 'Project');
    let act = '';
    list.querySelectorAll('.pi').forEach((x) => {
      x.setAttribute('role', 'option');
      x.id = 'pi-' + x.dataset.type + '-' + x.dataset.id;
      const on = x.classList.contains('sel');
      x.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) act = x.id;
    });
    if (act) list.setAttribute('aria-activedescendant', act); else list.removeAttribute('aria-activedescendant');
  }
  function selectEl(el) {
    if (!el) return;
    selected = { type: el.dataset.type, id: el.dataset.id };
    list.querySelectorAll('.pi').forEach((x) => x.classList.toggle('sel', x === el));
    ariaSync();
    el.scrollIntoView({ block: 'nearest' });
    if (app.transcript && !app.source.media) app.transcript.render();
  }
  function openEl(el) {
    if (el.dataset.type === 'seq') app.openSequence(el.dataset.id);
    else { const m = app.project.mediaById(el.dataset.id); if (m) app.openSource(m); }
  }
  list.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.altKey) return;
    const items = [...list.querySelectorAll('.pi')];
    if (!items.length) return;
    const cur = items.findIndex((x) => x.classList.contains('sel'));
    let el = null;
    const tile = list.querySelector('.pi.tile');
    const perRow = tile ? Math.max(1, Math.round(list.clientWidth / Math.max(1, tile.offsetWidth))) : 1;
    if (ev.key === 'ArrowDown') el = items[Math.min(items.length - 1, cur < 0 ? 0 : cur + perRow)];
    else if (ev.key === 'ArrowUp') el = items[Math.max(0, cur < 0 ? 0 : cur - perRow)];
    else if (ev.key === 'ArrowRight') el = items[Math.min(items.length - 1, cur + 1)];
    else if (ev.key === 'ArrowLeft') el = items[Math.max(0, cur - 1)];
    else if (ev.key === 'Home') el = items[0];
    else if (ev.key === 'End') el = items[items.length - 1];
    else if (ev.key === 'Enter' && cur >= 0) { ev.preventDefault(); ev.stopPropagation(); openEl(items[cur]); return; }
    else if ((ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10')) && cur >= 0) {
      ev.preventDefault(); ev.stopPropagation();
      const r = items[cur].getBoundingClientRect();
      app.contextMenu(r.left + 20, r.top + r.height / 2, items[cur].dataset.type === 'seq' ? 'projSeq' : 'projMedia');
      return;
    } else return;
    ev.preventDefault(); ev.stopPropagation();
    selectEl(el);
  });

  /** Stav přepisu u klipů (štítek na dlaždici, text v seznamu, průběh) – jen přepsat texty, bez nového vykreslení. */
  function paintAsr() {
    const a = window.__pzASR;
    if (!a) return;
    const cs = window.TN && window.TN.lang === 'cs';
    const L = (en, c) => (cs ? c : en);
    for (const m of app.project.media) {
      const st = m.missing ? { state: 'none' } : a.status(m);
      const pct = Math.floor((st.p || 0) * 100);
      const prep = st.state === 'running' && (!(st.p > 0.0005) || /model/.test(st.msg || ''));
      let tag = '', short = '', info = '', cls = '', title = '';
      if (st.state === 'queued') { tag = L('Waiting to transcribe', 'Čeká na přepis'); short = '⋯'; info = L('transcript waiting', 'přepis čeká'); }
      // stejný stav jako Přepis (report-5: Projekt 30 s „Příprava…“ bez MB, zatímco Přepis „Stahuji… 74 z 240 MB“)
      else if (prep && /download.*?(\d+) \/ (\d+) MB/.test(st.msg || '')) { const d = /(\d+) \/ (\d+) MB/.exec(st.msg); tag = L(`Downloading ${d[1]} / ${d[2]} MB`, `Stahuji ${d[1]} / ${d[2]} MB`); short = d[1] + ' MB'; info = tag; title = L('Downloading speech recognition – only once', 'Stahuji rozpoznávání řeči – jen jednou'); }
      else if (prep) { tag = L('Preparing…', 'Příprava…'); short = '…'; info = L('transcript preparing', 'přepis se připravuje'); }
      else if (st.state === 'running') { tag = L(`Transcript ${pct} %`, `Přepis ${pct} %`); short = pct + ' %'; info = L(`transcript ${pct} %`, `přepis ${pct} %`); title = L(`Transcribing speech… ${pct} %`, `Přepisuji řeč… ${pct} %`); }
      else if (st.state === 'stopped') { tag = L('Transcript stopped', 'Přepis zastaven'); short = '‖'; info = L('transcript stopped', 'přepis zastaven'); cls = 'stop'; }
      else if (st.state === 'error') { tag = L('Transcript failed', 'Přepis selhal'); short = '!'; info = L('transcript failed', 'přepis selhal'); cls = 'err'; }
      else if (st.state === 'done') { tag = '✓ ' + L('Transcript', 'Přepis'); short = '✓'; info = L('transcript ✓', 'přepis ✓'); cls = 'done'; title = L('The clip has a transcript – open it and search', 'Klip má přepis – otevři ho a hledej'); }
      list.querySelectorAll(`.asr-tag[data-mid="${m.id}"]`).forEach((el) => {
        const w = el.parentElement ? el.parentElement.clientWidth : 0;
        const narrow = w > 0 && w < 100; // 0 = záložka Projekt je skrytá
        el.textContent = narrow ? short : tag;
        el.className = 'asr-tag ' + cls + (tag ? ' on' : '');
        el.title = (title || tag) + (tag ? (st.state === 'done' ? (cs ? ' – klikni a otevře se Přepis' : ' – click to open the transcript') : (cs ? ' – klikni a uvidíš průběh v Přepisu' : ' – click to see the progress in the Transcript')) : '');
      });
      list.querySelectorAll(`.asr-info[data-mid="${m.id}"]`).forEach((el) => { el.textContent = info ? ' · ' + info : ''; el.className = 'asr-info ' + cls; });
      list.querySelectorAll(`.asr-prog[data-mid="${m.id}"]`).forEach((el) => {
        const on = st.state === 'running' && !prep;
        el.classList.toggle('on', on);
        el.firstChild.style.width = (on ? Math.max(1, pct) : 0) + '%';
      });
    }
  }

  list.addEventListener('click', (ev) => {
    const tag = ev.target.closest('.asr-tag.on, .asr-info');
    if (!tag || !tag.textContent.trim()) return;
    const m = app.project.mediaById(tag.dataset.mid);
    if (!m || !app.transcript) return;
    ev.stopPropagation();
    app.openSource(m);
    app.transcript.show('tr');
  });
  list.addEventListener('mousedown', (ev) => {
    app.focusPanel('project');
    const el = ev.target.closest('.pi');
    selected = el ? { type: el.dataset.type, id: el.dataset.id } : null;
    list.querySelectorAll('.pi').forEach((x) => x.classList.toggle('sel', x === el));
    ariaSync();
    if (app.transcript && !app.source.media) app.transcript.render();
  });
  list.addEventListener('dblclick', (ev) => {
    const el = ev.target.closest('.pi');
    if (!el) { app.cmd('import'); return; }
    openEl(el);
  });
  list.addEventListener('dragstart', (ev) => {
    const el = ev.target.closest('.pi');
    if (!el) { ev.preventDefault(); return; }
    ev.dataTransfer.setData(el.dataset.type === 'seq' ? 'text/tn-seq' : 'text/tn-media', el.dataset.id);
    ev.dataTransfer.effectAllowed = 'copy';
    app.dragging = { type: el.dataset.type === 'seq' ? 'seq' : 'media', id: el.dataset.id }; // pro obrys na timeline
  });
  list.addEventListener('dragend', () => { app.dragging = null; });
  list.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const el = ev.target.closest('.pi');
    if (!el) return;
    selected = { type: el.dataset.type, id: el.dataset.id };
    render();
    app.contextMenu(ev.clientX, ev.clientY, el.dataset.type === 'seq' ? 'projSeq' : 'projMedia');
  });
  // soubory z Průzkumníka
  list.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('Files')) { ev.preventDefault(); list.classList.add('drop'); } });
  list.addEventListener('dragleave', () => list.classList.remove('drop'));
  list.addEventListener('drop', (ev) => {
    ev.preventDefault();
    list.classList.remove('drop');
    const paths = require('../core/dropfiles').droppedPaths(ev.dataTransfer);
    if (paths.length) app.importPaths(paths);
  });
  search.addEventListener('input', render);

  return {
    render, paintAsr,
    get selected() { return selected; },
    selectedMedia() { return selected && selected.type === 'media' ? app.project.mediaById(selected.id) : null; },
    clearSelection() { selected = null; render(); },
  };
}

module.exports = { createProjectPanel };
