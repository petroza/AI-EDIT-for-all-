'use strict';
// Timeline ve stylu Premiere: stopy V (nahoře, V1 nejníž) a A, klipy, vlnový průběh, playhead, výběr,
// přesun s přichytáváním, trim okrajů (Ctrl = ripple), žiletka, výběr tažením, přetažení z Projektu.
const { clipEnd } = require('../core/model');
const E = require('../core/edit');
const { timecode, clamp } = require('../core/util');
const { WAVE_RATE } = require('../core/media');
const ICONS = require('./icons');

const LANE_H = 44, SEP_H = 7, CAP_H = 26, RULER_H = 64, EDGE = 7;
const LANE_MIN = 26, LANE_MAX = 150;

function createTimeline(app) {
  const $ = (id) => document.getElementById(id);
  const area = $('tlArea'), lanesEl = $('tlLanes'), heads = $('tlHeads'), ruler = $('tlRuler');
  const phEl = $('tlPlayhead'), snapEl = $('tlSnapLine'), marq = $('tlMarquee'), empty = $('tlEmpty');
  const zbTrack = $('zbTrack'), zbThumb = $('zbThumb');
  let pps = 20;             // pixely na sekundu
  let lanes = [];           // [{type, ti, y, h}]
  let drag = null;
  let rafPending = false;

  const seq = () => app.seq();
  // výška stop jako v Premiere (Ctrl+= / Ctrl+- video, Alt+= / Alt+- audio)
  const laneH = (kind) => { const v = app.view || {}; return kind === 'audio' ? (v.aH || LANE_H) : (v.vH || LANE_H); };
  const tAt = (clientX) => (clientX - area.getBoundingClientRect().left + area.scrollLeft) / pps;
  const xOf = (t) => t * pps;

  /* ---------- zoom ---------- */
  const MINP = 0.5, MAXP = 600;
  function setPps(p, anchorT) {
    const s = seq();
    const ax = anchorT !== undefined ? xOf(anchorT) - area.scrollLeft : null;
    pps = clamp(p, MINP, MAXP);
    if (s) s.zoom = pps;
    render();
    if (anchorT !== undefined) area.scrollLeft = Math.max(0, xOf(anchorT) - ax);
    updateZoomBar();
  }
  function zoomFit() {
    const s = seq();
    if (!s) return;
    // osa se právě ukazuje (první sekvence): šířku známe až po vykreslení
    if (area.clientWidth < 60) { requestAnimationFrame(() => requestAnimationFrame(() => { if (area.clientWidth >= 60) zoomFit(); })); return; }
    const d = Math.max(5, app.seqDuration(s));
    setPps((area.clientWidth - 30) / d);
    area.scrollLeft = 0;
    updateZoomBar();
  }

  /* ---------- zoom/scroll lišta dole (jako Premiere): tažení = posun, táhla na koncích = zoom ---------- */
  // celková délka obsahu v sekundách (nezávisí na zoomu)
  function contentSec() {
    const s = seq();
    if (!s) return 1;
    const dur = app.seqDuration(s);
    return Math.max(dur + Math.max(30, dur * 0.3), area.clientWidth / pps);
  }
  function updateZoomBar() {
    const T = contentSec();
    const a = area.scrollLeft / pps, w = area.clientWidth / pps;
    zbThumb.style.left = (clamp(a / T, 0, 1) * 100) + '%';
    zbThumb.style.width = (clamp(w / T, 0, 1) * 100) + '%';
  }
  let zb = null;
  zbTrack.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || !seq()) return;
    ev.preventDefault();
    const T = contentSec();
    const a = area.scrollLeft / pps, b = a + area.clientWidth / pps;
    const mode = ev.target.id === 'zbL' ? 'l' : ev.target.id === 'zbR' ? 'r' : ev.target.closest('#zbThumb') ? 'move' : 'page';
    if (mode === 'page') {
      // klik vedle lišty: posun na to místo (střed)
      const r = zbTrack.getBoundingClientRect();
      const t = (ev.clientX - r.left) / r.width * T;
      area.scrollLeft = Math.max(0, (t - (b - a) / 2) * pps);
      return;
    }
    zb = { mode, x0: ev.clientX, a, b, T, w: zbTrack.getBoundingClientRect().width };
    zbThumb.classList.add('drag');
  });
  window.addEventListener('mousemove', (ev) => {
    if (!zb) return;
    const dt = (ev.clientX - zb.x0) / zb.w * zb.T;
    const minSpan = area.clientWidth / MAXP;
    if (zb.mode === 'move') { area.scrollLeft = Math.max(0, (zb.a + dt) * pps); return; }
    let a = zb.a, b = zb.b;
    if (zb.mode === 'l') a = clamp(zb.a + dt, 0, zb.b - minSpan);
    else b = Math.max(zb.a + minSpan, zb.b + dt);
    pps = clamp(area.clientWidth / (b - a), MINP, MAXP);
    const s = seq(); if (s) s.zoom = pps;
    render();
    area.scrollLeft = Math.max(0, a * pps);
    updateZoomBar();
  });
  window.addEventListener('mouseup', () => { if (zb) { zb = null; zbThumb.classList.remove('drag'); } });
  zbTrack.addEventListener('dblclick', () => zoomFit());

  /* ---------- geometrie stop ---------- */
  function buildLanes(s) {
    lanes = [];
    let y = RULER_H;
    // jako v Premiere: videostopy zarovnané ke středové dělicí čáře (volné místo nad nimi)
    const nV = s.tracks.video.length, capH = s.captions && s.captions.length ? CAP_H : 0;
    const avail = Math.max(0, area.clientHeight - RULER_H - SEP_H);
    const space = Math.max(0, Math.floor(avail * 0.5) - nV * laneH('video') - capH);
    if (space > 0) { lanes.push({ type: 'vspace', ti: -1, y, h: space }); y += space; }
    if (capH) { lanes.push({ type: 'captions', ti: 0, y, h: CAP_H }); y += CAP_H; }
    for (let ti = nV - 1; ti >= 0; ti--) { const hh = laneH('video'); lanes.push({ type: 'video', ti, y, h: hh }); y += hh; }
    lanes.push({ type: 'sep', ti: -1, y, h: SEP_H }); y += SEP_H;
    for (let ti = 0; ti < s.tracks.audio.length; ti++) { const hh = laneH('audio'); lanes.push({ type: 'audio', ti, y, h: hh }); y += hh; }
    return y;
  }
  function laneAtY(clientY) {
    const y = clientY - area.getBoundingClientRect().top + area.scrollTop;
    return lanes.find((l) => y >= l.y && y < l.y + l.h) || null;
  }

  /* ---------- vykreslení ---------- */
  function render() {
    const s = seq();
    empty.classList.toggle('show', !s);
    if (!s) { lanesEl.innerHTML = ''; heads.innerHTML = ''; phEl.style.display = 'none'; drawRuler(); return; }
    if (s.zoom && Math.abs(s.zoom - pps) > 1e-6) pps = s.zoom;
    const total = buildLanes(s);
    const dur = app.seqDuration(s);
    const width = Math.max(area.clientWidth, xOf(dur + Math.max(30, dur * 0.3)));
    lanesEl.style.width = width + 'px';
    lanesEl.style.height = (total - RULER_H) + 'px';
    renderHeads(s);
    renderLanes(s, width);
    phEl.style.display = 'block';
    phEl.style.height = total + 'px';
    updatePlayhead();
    drawRuler();
    updateZoomBar();
  }

  function renderHeads(s) {
    const I = ICONS;
    let h = `<div class="ruler-spacer">
      <div class="tl-tc" id="tlTc">${timecode(s.playhead || 0, s.fps)}</div>
      <div class="tl-hicons">
        <button class="hi" data-act="nest" title="Insert or overwrite sequences as nests or individual clips (not available)">${I.nest}</button>
        <button class="hi ${app.snap ? 'on' : ''}" data-act="snap" title="Snap in Timeline (S)">${I.snap}</button>
        <button class="hi ${app.linkedSel ? 'on' : ''}" data-act="linked" title="Linked Selection">${I.linked}</button>
        <button class="hi" data-act="marker" title="Add Marker (M)">${I.marker}</button>
        <button class="hi" data-act="wrench" title="Timeline Display Settings">${I.wrench}</button>
      </div></div>`;
    for (const l of lanes) {
      if (l.type === 'vspace') { h += `<div class="th vspace" style="height:${l.h}px"></div>`; continue; }
      if (l.type === 'sep') { h += '<div class="th sep"></div>'; continue; }
      if (l.type === 'captions') { h += `<div class="th captions" style="height:${CAP_H}px"><span class="dim">C1 · Captions</span><button class="cap-style" title="Caption style">Aa</button></div>`; continue; }
      const t = s.tracks[l.type][l.ti];
      const nm = (l.type === 'video' ? 'V' : 'A') + (l.ti + 1);
      const tt = t.trackTarget !== false;
      h += `<div class="th ${l.type}" data-kind="${l.type}" data-ti="${l.ti}" style="height:${l.h}px">
        <span class="patch ${t.target ? 'on' : ''}" data-act="target" title="Source patching: where Insert / Overwrite place the ${l.type} (click)">${t.target ? nm : ''}</span>
        <button class="ti ${t.locked ? 'on lock' : ''}" data-act="lock" title="Toggle Track Lock">${t.locked ? I.lock : I.unlock}</button>
        <span class="tt ${tt ? 'on' : ''}" data-act="trackTarget" title="Toggle Track Targeting (Add Edit, Lift, edit points)">${nm}</span>
        <button class="ti ${t.syncOff ? '' : 'on'}" data-act="sync" title="Toggle Sync Lock">${I.sync}</button>
        ${l.type === 'video'
          ? `<button class="ti ${t.muted ? 'off' : 'on'}" data-act="mute" title="Toggle Track Output">${t.muted ? I.eyeOff : I.eye}</button>`
          : `<button class="tl ${t.muted ? 'mute' : ''}" data-act="mute" title="Mute Track">M</button>
             <button class="tl ${t.solo ? 'solo' : ''}" data-act="solo" title="Solo Track">S</button>
             <button class="ti dis" title="Voice-over Record (not available)">${I.mic}</button>`}
      </div>`;
    }
    h += `<div class="th addtracks"><button class="tl" data-act="addV" title="Add Video Track">+V</button><button class="tl" data-act="addA" title="Add Audio Track">+A</button></div>`;
    heads.innerHTML = h;
  }

  heads.addEventListener('click', (ev) => {
    if (ev.target.closest('.cap-style')) { app.cmd('captionStyle'); return; }
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const s = seq();
    if (!s) return;
    const act = b.dataset.act;
    if (act === 'snap') { app.cmd('snap'); return; }
    if (act === 'linked') { app.linkedSel = !app.linkedSel; render(); app.status(app.linkedSel ? 'Linked Selection on' : 'Linked Selection off'); return; }
    if (act === 'marker') { app.cmd('marker'); return; }
    if (act === 'nest') return;
    if (act === 'wrench') {
      const r = b.getBoundingClientRect();
      app.view = app.view || {};
      app.contextMenu(r.left, r.bottom + 2, 'timelineView');
      return;
    }
    if (act === 'addV' || act === 'addA') {
      app.edit('Add Track', () => s.tracks[act === 'addV' ? 'video' : 'audio'].push({ clips: [], muted: false, locked: false, target: false }));
      return;
    }
    const th = b.closest('.th');
    const kind = th.dataset.kind, ti = Number(th.dataset.ti);
    const t = s.tracks[kind][ti];
    if (act === 'target') {
      // jako source patching v Premiere: jedna cílová stopa od každého druhu (klik na cílovou ji vypne)
      const was = t.target;
      s.tracks[kind].forEach((x) => { x.target = false; });
      t.target = !was;
    } else if (act === 'trackTarget') t.trackTarget = t.trackTarget === false;
    else if (act === 'sync') t.syncOff = !t.syncOff;
    else if (act === 'lock') t.locked = !t.locked;
    else if (act === 'mute') t.muted = !t.muted;
    else if (act === 'solo') { t.solo = !t.solo; s._solo = s.tracks.audio.some((x) => x.solo); }
    app.project.dirty = true;
    render();
    app.program.refresh();
  });

  function clipHtml(s, c, l, viewL, viewR) {
    const left = xOf(c.start), w = Math.max(2, xOf(c.out - c.in));
    const sel = app.sel.has(c.id) ? ' sel' : '';
    const m = app.project.mediaById(c.mediaId);
    const name = (c.name || (m && m.name) || '?').replace(/</g, '&lt;');
    let inner = `<span class="cl">${c.linkId ? '' : '<b title="unlinked">⛓</b> '}${name}${c.gainDb ? ` <i>${c.gainDb > 0 ? '+' : ''}${c.gainDb} dB</i>` : ''}</span>`;
    // „fx“ odznak jako v Premiere – zbarvený, když má klip úpravu (vyplnění snímku, hlasitost, prolnutí)
    const fxOn = (c.kind === 'video' && (c.fit === 'cover' || (c.scale && c.scale !== 1))) || (c.kind === 'audio' && (c.gainDb || c.fadeIn || c.fadeOut));
    if (w > 34) inner += `<span class="fx${fxOn ? ' on' : ''}" title="${fxOn ? 'Effects applied' : 'Effects'}">fx</span>`;
    if (c.kind === 'audio') {
      if (c.fadeIn) inner += `<div class="fade in" style="width:${Math.max(3, xOf(c.fadeIn))}px"></div>`;
      if (c.fadeOut) inner += `<div class="fade out" style="width:${Math.max(3, xOf(c.fadeOut))}px"></div>`;
    } else if (m && m.thumb && w > 40 && (app.view || {}).thumbs !== false) {
      inner += `<div class="thumbs" style="width:${Math.min(w - 2, 72)}px;background-image:url('${m.thumbUrl}')"></div>`;
    }
    const vis = c.kind === 'audio' && (app.view || {}).waves !== false && left + w > viewL && left < viewR;
    return { html: `<div class="clip ${c.kind}${sel}${c.disabled ? ' disabled' : ''}" data-id="${c.id}" style="left:${left}px;width:${w}px">${inner}${vis ? '<canvas></canvas>' : ''}</div>`, vis };
  }

  function renderLanes(s, width) {
    const viewL = area.scrollLeft - 200, viewR = area.scrollLeft + area.clientWidth + 200;
    let h = '';
    const waves = [];
    for (const l of lanes) {
      if (l.type === 'vspace') { h += `<div class="lane vspace" style="height:${l.h}px"></div>`; continue; }
      if (l.type === 'sep') { h += '<div class="lane sep"></div>'; continue; }
      if (l.type === 'captions') {
        h += `<div class="lane captions" style="height:${CAP_H}px">`;
        for (const c of s.captions) {
          const x = xOf(c.start), w = xOf(c.end - c.start);
          if (x + w < viewL || x > viewR) continue;
          h += `<div class="cap" data-ci="${s.captions.indexOf(c)}" style="left:${x}px;width:${Math.max(2, w)}px" title="${c.text.replace(/"/g, '&quot;')}">${c.text.replace(/</g, '&lt;')}</div>`;
        }
        h += '</div>';
        continue;
      }
      const t = s.tracks[l.type][l.ti];
      h += `<div class="lane ${l.type}" data-kind="${l.type}" data-ti="${l.ti}" style="height:${l.h}px">`;
      for (const c of t.clips) {
        const x = xOf(c.start), w = xOf(c.out - c.in);
        if (x + w < viewL - 2000 || x > viewR + 2000) continue; // mimo pohled (rezerva pro tažení)
        const r = clipHtml(s, c, l, viewL, viewR);
        h += r.html;
        if (r.vis) waves.push(c);
      }
      if (l.type === 'video') {
        for (const m of s.markers || []) h += `<div class="marker" style="left:${xOf(m.time)}px"></div>`;
        // přechody (Cross Dissolve přes střih, Dip na kraji klipu) – klik vybere, Delete odebere
        const nm = { cross: 'Cross Dissolve', dipBlack: 'Dip to Black', dipWhite: 'Dip to White' };
        for (const c of t.clips) {
          for (const side of ['vIn', 'vOut']) {
            const tr = c[side];
            if (!tr) continue;
            const x = tr.type === 'cross' ? xOf(c.start - tr.dur / 2) : side === 'vIn' ? xOf(c.start) : xOf(clipEnd(c) - tr.dur);
            const w = Math.max(6, xOf(tr.dur));
            const sel = app.transSel && app.transSel.clipId === c.id && app.transSel.side === side ? ' style-sel' : '';
            h += `<div class="trans ${tr.type}${sel}" data-clip="${c.id}" data-side="${side}" style="left:${x}px;width:${w}px${sel ? ';outline:2px solid #f0b532' : ''}" title="${nm[tr.type]} · ${tr.dur.toFixed(2)} s">${w > 60 ? nm[tr.type] : ''}</div>`;
          }
        }
      }
      if (app.gapSel && app.gapSel.kind === l.type && app.gapSel.ti === l.ti) {
        h += `<div class="gap-sel" style="left:${xOf(app.gapSel.start)}px;width:${xOf(app.gapSel.end - app.gapSel.start)}px"></div>`;
      }
      h += '</div>';
    }
    lanesEl.innerHTML = h;
    lanesEl.className = 'tl-lanes tool-' + app.tool + (app.tool === 'razor' ? ' razor' : '');
    for (const c of waves) drawWave(c);
  }

  function drawWave(c) {
    const el = lanesEl.querySelector(`.clip[data-id="${c.id}"]`);
    const cv = el && el.querySelector('canvas');
    if (!cv) return;
    const peaks = app.waves.get(c.mediaId);
    if (!peaks) { app.loadWave(c.mediaId); return; }
    const left = xOf(c.start), w = xOf(c.out - c.in);
    const viewL = area.scrollLeft, viewR = viewL + area.clientWidth;
    const a = Math.max(0, viewL - left), b = Math.min(w, viewR - left);
    if (b <= a) return;
    const H = laneH('audio') - 4;
    cv.width = Math.ceil(b - a);
    cv.height = H;
    cv.style.left = a + 'px';
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(140,210,240,.9)';
    const gain = Math.pow(10, (c.gainDb || 0) / 20);
    const mid = H / 2 + 6;
    for (let x = 0; x < cv.width; x++) {
      const t0 = c.in + (a + x) / pps, t1 = c.in + (a + x + 1) / pps;
      const i0 = Math.floor(t0 * WAVE_RATE), i1 = Math.max(i0 + 1, Math.floor(t1 * WAVE_RATE));
      let v = 0;
      for (let i = i0; i < i1 && i < peaks.length; i++) if (peaks[i] > v) v = peaks[i];
      const hh = Math.min(1, v / 255 * Math.min(1.4, gain)) * (H - 12) / 2;
      g.fillRect(x, mid - hh, 1, Math.max(1, hh * 2));
    }
  }

  function drawRuler() {
    const W = area.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    ruler.width = W * dpr; ruler.height = RULER_H * dpr;
    ruler.style.width = W + 'px';
    ruler.style.left = '0px';
    const g = ruler.getContext('2d');
    g.scale(dpr, dpr);
    // rozložení jako v Premiere: nahoře volno (vlevo velký timecode), popisky času, dílky, žlutý pruh obsahu
    const BASE = RULER_H - 8;          // spodní hrana dílků
    g.fillStyle = '#1d1d1d'; g.fillRect(0, 0, W, RULER_H);
    const s = seq();
    if (!s) return;
    const sl = area.scrollLeft;
    // in/out (světlejší pole jako v Premiere)
    if (s.inPoint !== null || s.outPoint !== null) {
      const a = s.inPoint !== null ? s.inPoint : 0, b = s.outPoint !== null ? s.outPoint : app.seqDuration(s);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(xOf(a) - sl, 26, xOf(b - a), BASE - 26);
    }
    // dílky a popisky
    const steps = [1 / s.fps, 5 / s.fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
    const major = steps.find((x) => x * pps >= 110) || 3600;
    const minor = steps.slice().reverse().find((x) => x * pps <= major * pps / 4 && x * pps >= 6) || major / 5;
    g.strokeStyle = '#5a5a5a'; g.fillStyle = '#b4b4b4'; g.font = '11px "Segoe UI", sans-serif';
    const t0 = Math.floor(sl / pps / minor) * minor;
    g.beginPath();
    for (let t = t0; xOf(t) - sl < W; t += minor) {
      const x = Math.round(xOf(t) - sl) + 0.5;
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      g.moveTo(x, isMajor ? BASE - 12 : BASE - 6); g.lineTo(x, BASE);
      if (isMajor) { const lbl = timecode(t, s.fps); g.fillText(lbl, x - g.measureText(lbl).width / 2, BASE - 16); }
    }
    g.stroke();
    // žlutý pruh pod pravítkem přes obsah sekvence (jako render bar v Premiere)
    const dur = app.seqDuration(s);
    if (dur > 0) { g.fillStyle = '#e8d21d'; g.fillRect(xOf(0) - sl, BASE + 2, xOf(dur), 3); }
    // značky
    for (const m of s.markers || []) {
      const x = xOf(m.time) - sl;
      g.fillStyle = '#4cd678';
      g.beginPath(); g.moveTo(x - 5, BASE - 14); g.lineTo(x + 5, BASE - 14); g.lineTo(x + 5, BASE - 8); g.lineTo(x, BASE - 3); g.lineTo(x - 5, BASE - 8); g.fill();
    }
    // playhead: modrá hlavička s hrotem dolů
    const px = Math.round(xOf(s.playhead || 0) - sl) + 0.5;
    g.fillStyle = '#2d8ceb';
    const top = BASE - 14;
    g.beginPath();
    g.moveTo(px - 6, top + 2); g.quadraticCurveTo(px - 6, top, px - 4, top); g.lineTo(px + 4, top); g.quadraticCurveTo(px + 6, top, px + 6, top + 2);
    g.lineTo(px + 6, top + 9); g.lineTo(px, top + 15); g.lineTo(px - 6, top + 9); g.closePath(); g.fill();
    g.fillRect(px - 0.5, top + 14, 1, RULER_H - top - 14);
  }

  function updatePlayhead() {
    const s = seq();
    if (!s) return;
    phEl.style.left = xOf(s.playhead || 0) + 'px';
    const tc = document.getElementById('tlTc');
    if (tc) tc.textContent = timecode(s.playhead || 0, s.fps);
  }

  function setPlayheadView(t, follow) {
    updatePlayhead();
    if (follow) {
      const x = xOf(t);
      if (x > area.scrollLeft + area.clientWidth - 40) area.scrollLeft = x - 60;
      else if (x < area.scrollLeft) area.scrollLeft = Math.max(0, x - 60);
    }
    drawRuler();
  }

  area.addEventListener('scroll', () => {
    heads.scrollTop = area.scrollTop;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; const s = seq(); if (s) s.scroll = area.scrollLeft; renderLanesOnly(); drawRuler(); updateZoomBar(); });
  });
  function renderLanesOnly() { const s = seq(); if (s && !drag) renderLanes(s); }
  new ResizeObserver(() => { render(); }).observe(area);

  /* ---------- přichytávání ---------- */
  function snapPoints(s, exclude) {
    const pts = [s.playhead || 0, 0];
    if (s.inPoint !== null) pts.push(s.inPoint);
    if (s.outPoint !== null) pts.push(s.outPoint);
    for (const m of s.markers || []) pts.push(m.time);
    for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) {
      if (exclude && exclude.has(c.id)) continue;
      pts.push(c.start, clipEnd(c));
    }
    return pts;
  }
  function snapTime(s, t, exclude) {
    if (!app.snap) return { t, snapped: false };
    let best = null, bd = 9 / pps;
    for (const p of snapPoints(s, exclude)) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
    return best === null ? { t, snapped: false } : { t: best, snapped: true };
  }
  function showSnap(t) {
    if (t === null) { snapEl.style.display = 'none'; return; }
    snapEl.style.display = 'block';
    snapEl.style.left = xOf(t) + 'px';
    snapEl.style.height = lanesEl.offsetHeight + 'px';
  }

  /* ---------- myš na stopách ---------- */
  function selectWithLinked(s, clip, add) {
    const grp = (app.linkedSel && !add.alt) ? E.linked(s, clip) : [clip];
    if (!add.toggle) app.sel.clear();
    const allSel = grp.every((c) => app.sel.has(c.id));
    for (const c of grp) { if (add.toggle && allSel) app.sel.delete(c.id); else app.sel.add(c.id); }
  }

  lanesEl.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    app.focusPanel('timeline');
    const s = seq();
    if (!s) return;
    // klik na titulek = rovnou psát do něj (v programovém monitoru)
    const capEl = ev.target.closest('.cap');
    if (capEl && app.editCaption) { ev.preventDefault(); app.editCaption(Number(capEl.dataset.ci)); return; }
    const clipEl = ev.target.closest('.clip');
    const lane = ev.target.closest('.lane');
    const t = tAt(ev.clientX);
    app.gapSel = null;
    app.transSel = null;
    const trEl = ev.target.closest('.trans');
    if (trEl && app.tool === 'select') {
      app.transSel = { clipId: trEl.dataset.clip, side: trEl.dataset.side };
      app.sel.clear();
      render();
      return;
    }
    // nástroje, které nepracují s jedním klipem
    if (app.tool === 'hand') { drag = { type: 'hand', x0: ev.clientX, y0: ev.clientY, sl: area.scrollLeft, st: area.scrollTop, s, moved: false }; lanesEl.classList.add('grabbing'); return; }
    if (app.tool === 'zoom') { setPps(pps * (ev.altKey ? 0.5 : 2), t); return; }
    if (app.tool === 'trackfwd' || app.tool === 'trackback') {
      // Track Select Forward (A) / Backward (Shift+A): vše od místa kliku dál / před ním (Shift = jen tato stopa)
      const only = ev.shiftKey && lane && lane.dataset.kind ? { kind: lane.dataset.kind, track: Number(lane.dataset.ti) } : null;
      const ids = (app.tool === 'trackback' ? E.clipsTo : E.clipsFrom)(s, t, only).filter((id) => { const f = E.findClip(s, id); return f && !s.tracks[f.kind][f.track].locked; });
      app.sel = new Set(ids);
      app.selectionChanged();
      if (ids.length) {
        const f0 = E.findClip(s, ids[0]);
        drag = { type: 'move', x0: ev.clientX, y0: ev.clientY, t0: t, s, ids, kind: f0.kind, laneTi: f0.track, moved: false, dt: 0, dTrack: 0, noTrack: true };
      }
      render();
      return;
    }
    if (clipEl) {
      const f = E.findClip(s, clipEl.dataset.id);
      if (!f) return;
      const clip = f.clip;
      if (s.tracks[f.kind][f.track].locked) { app.status('The track is locked'); return; }
      const rr = clipEl.getBoundingClientRect();
      const ew = Math.min(EDGE, rr.width / 4);
      const zone0 = ev.clientX - rr.left < ew ? 'in' : (rr.right - ev.clientX < ew ? 'out' : 'body');
      const mediaDuration = (id) => (app.project.mediaById(id) || {}).duration || Infinity;
      if (app.tool === 'slip' && zone0 === 'body') {
        selectWithLinked(s, clip, { alt: ev.altKey });
        drag = { type: 'slip', x0: ev.clientX, s, clip, alt: ev.altKey, moved: false, d: 0, mediaDuration };
        render();
        return;
      }
      if (app.tool === 'rolling' && zone0 !== 'body') {
        // Rolling Edit (N): sousední klip na stejné stopě, který se dotýká střihu
        const tr = s.tracks[f.kind][f.track], h = 0.5 / s.fps;
        const other = zone0 === 'out'
          ? tr.clips.find((c) => c !== clip && Math.abs(c.start - clipEnd(clip)) < h)
          : tr.clips.find((c) => c !== clip && Math.abs(clipEnd(c) - clip.start) < h);
        if (other) {
          const left = zone0 === 'out' ? clip : other, right = zone0 === 'out' ? other : clip;
          drag = { type: 'roll', x0: ev.clientX, s, left, right, at: right.start, alt: ev.altKey, moved: false, d: 0, mediaDuration };
          return;
        }
      }
      if (app.tool === 'razor') {
        const tc = razorTime(s, ev.clientX);
        clearRazorMarks();
        app.edit('Razor', () => {
          if (ev.shiftKey) { E.razor(s, tc); return; }
          const grp = ev.altKey ? [clip] : E.linked(s, clip);
          const linkMap = new Map();
          for (const c of grp) { const ff = E.findClip(s, c.id); E.splitClip(s, ff.trackObj, c, tc, linkMap); }
        });
        return;
      }
      const r = clipEl.getBoundingClientRect();
      const edgeW = Math.min(EDGE, r.width / 4);
      const zone = ev.clientX - r.left < edgeW ? 'in' : (r.right - ev.clientX < edgeW ? 'out' : 'body');
      if (!app.sel.has(clip.id) || ev.shiftKey || ev.ctrlKey) {
        if (zone === 'body' || !app.sel.has(clip.id)) selectWithLinked(s, clip, { toggle: ev.shiftKey || (ev.ctrlKey && zone === 'body'), alt: ev.altKey });
      } else if (ev.altKey && zone === 'body') { app.sel.clear(); app.sel.add(clip.id); }
      app.selectionChanged();
      if (zone === 'body') {
        const ids = [...app.sel];
        drag = { type: 'move', x0: ev.clientX, y0: ev.clientY, t0: t, s, ids, kind: f.kind, laneTi: f.track, moved: false, dt: 0, dTrack: 0 };
      } else {
        drag = { type: 'trim', edge: zone, x0: ev.clientX, s, clip, kind: f.kind, ripple: ev.ctrlKey || app.tool === 'ripple', alt: ev.altKey, moved: false, t: zone === 'in' ? clip.start : clipEnd(clip) };
      }
      render();
      return;
    }
    // prázdné místo: výběr tažením nebo výběr mezery
    if (!ev.shiftKey) app.sel.clear();
    drag = { type: 'marquee', x0: ev.clientX, y0: ev.clientY, s, lane, t, moved: false, base: new Set(app.sel) };
    app.selectionChanged();
  });

  /* ---------- žiletka: čára řezu pod kurzorem (přichytí se k playheadu a střihům, Shift = všechny stopy) ---------- */
  const razorMarks = $('tlRazorMarks');
  function razorTime(s, clientX) {
    let t = E.snapT(s, tAt(clientX));
    if (app.snap) {
      let best = null, bd = 8 / pps;
      for (const p of [s.playhead || 0, ...E.editPoints(s)]) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
      if (best !== null) t = best;
    }
    return t;
  }
  function clearRazorMarks() { razorMarks.innerHTML = ''; }
  function showRazorMarks(ev) {
    const s = seq();
    const el = ev.target.closest('.clip');
    if (!s || app.tool !== 'razor' || drag) { clearRazorMarks(); return; }
    const t = razorTime(s, ev.clientX);
    const x = xOf(t);
    const marks = [];
    if (ev.shiftKey) {
      marks.push({ y: RULER_H, h: lanesEl.offsetHeight });
    } else if (el) {
      const f = E.findClip(s, el.dataset.id);
      if (f) {
        for (const c of (ev.altKey ? [f.clip] : E.linked(s, f.clip))) {
          if (t <= c.start || t >= clipEnd(c)) continue;
          const ff = E.findClip(s, c.id);
          const l = lanes.find((q) => q.type === ff.kind && q.ti === ff.track);
          if (l) marks.push({ y: l.y + 2, h: l.h - 4 });
        }
      }
    }
    razorMarks.innerHTML = marks.map((m) => `<div class="razor-mark" style="left:${x}px;top:${m.y}px;height:${m.h}px"></div>`).join('');
  }
  lanesEl.addEventListener('mousemove', showRazorMarks);
  lanesEl.addEventListener('mouseleave', clearRazorMarks);
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Shift' && app.tool === 'razor') clearRazorMarks(); });

  lanesEl.addEventListener('mousemove', (ev) => {
    if (drag || !['select', 'ripple', 'rolling'].includes(app.tool)) return;
    const el = ev.target.closest('.clip');
    lanesEl.querySelectorAll('.clip.edge-l,.clip.edge-r').forEach((x) => x.classList.remove('edge-l', 'edge-r'));
    if (!el) return;
    const r = el.getBoundingClientRect();
    const edgeW = Math.min(EDGE, r.width / 4);
    if (ev.clientX - r.left < edgeW) el.classList.add('edge-l');
    else if (r.right - ev.clientX < edgeW) el.classList.add('edge-r');
  });

  window.addEventListener('mousemove', (ev) => {
    if (!drag) return;
    const s = drag.s;
    if (drag.type === 'ruler') { app.setPlayhead(Math.max(0, tAt(ev.clientX)), { scrub: true }); return; }
    if (!drag.moved && Math.abs(ev.clientX - drag.x0) < 3 && Math.abs((ev.clientY || 0) - (drag.y0 || ev.clientY)) < 3) return;
    drag.moved = true;
    if (drag.type === 'hand') {
      area.scrollLeft = Math.max(0, drag.sl - (ev.clientX - drag.x0));
      area.scrollTop = Math.max(0, drag.st - (ev.clientY - drag.y0));
      return;
    }
    if (drag.type === 'slip') {
      const c = drag.clip;
      let d = -(ev.clientX - drag.x0) / pps;
      const md = drag.mediaDuration(c.mediaId);
      d = clamp(d, -c.in, md - c.out);
      drag.d = d;
      app.status(`Slip ${d >= 0 ? '+' : '−'}${timecode(Math.abs(d), s.fps)} · In ${timecode(c.in + d, s.fps)} · Out ${timecode(c.out + d, s.fps)}`);
      return;
    }
    if (drag.type === 'roll') {
      const L = drag.left, R = drag.right;
      let at = tAt(ev.clientX);
      const sn = snapTime(s, at, new Set([L.id, R.id]));
      at = sn.t; showSnap(sn.snapped ? at : null);
      const f = 1 / s.fps;
      let d = at - drag.at;
      d = clamp(d, Math.max(-((L.out - L.in) - f), -R.in), Math.min((R.out - R.in) - f, drag.mediaDuration(L.mediaId) - L.out));
      drag.d = d;
      const le = lanesEl.querySelector(`.clip[data-id="${L.id}"]`), re = lanesEl.querySelector(`.clip[data-id="${R.id}"]`);
      if (le) { le.style.width = xOf(L.out - L.in + d) + 'px'; le.classList.add('ghost'); }
      if (re) { re.style.left = xOf(R.start + d) + 'px'; re.style.width = xOf(R.out - R.in - d) + 'px'; re.classList.add('ghost'); }
      app.status(`Rolling Edit ${d >= 0 ? '+' : '−'}${timecode(Math.abs(d), s.fps)}`);
      return;
    }
    if (drag.type === 'move') {
      let dt = (ev.clientX - drag.x0) / pps;
      const set = new Set(drag.ids);
      const moving = drag.ids.map((id) => E.findClip(s, id)).filter(Boolean).map((x) => x.clip);
      const minStart = Math.min(...moving.map((c) => c.start));
      if (minStart + dt < 0) dt = -minStart;
      let snapAt = null;
      if (app.snap) {
        let best = null, bd = 9 / pps;
        const pts = snapPoints(s, set);
        for (const c of moving) for (const edge of [c.start, clipEnd(c)]) for (const p of pts) {
          const d = Math.abs(p - (edge + dt));
          if (d < bd) { bd = d; best = p - edge; snapAt = p; }
        }
        if (best !== null) dt = best;
      }
      showSnap(snapAt);
      // změna stopy (jen klipy stejného druhu jako uchopený)
      const l = laneAtY(ev.clientY);
      let dTrack = 0;
      if (l && l.type === drag.kind && !drag.noTrack) dTrack = l.ti - drag.laneTi;
      drag.dt = dt; drag.dTrack = dTrack;
      for (const c of moving) {
        const el = lanesEl.querySelector(`.clip[data-id="${c.id}"]`);
        if (!el) continue;
        el.style.left = xOf(c.start + dt) + 'px';
        const dy = c.kind === drag.kind ? (drag.kind === 'video' ? -dTrack : dTrack) * laneH(drag.kind) : 0;
        el.style.transform = `translateY(${dy}px)`;
        el.classList.add('ghost');
      }
      app.status(`Move ${dt >= 0 ? '+' : '−'}${timecode(Math.abs(dt), s.fps)}${dTrack ? `, track ${dTrack > 0 ? '+' : ''}${dTrack}` : ''}`);
    } else if (drag.type === 'trim') {
      const c = drag.clip;
      let t = tAt(ev.clientX);
      const sn = snapTime(s, t, new Set([c.id]));
      t = sn.t;
      showSnap(sn.snapped ? t : null);
      const m = app.project.mediaById(c.mediaId);
      if (drag.edge === 'in') t = clamp(t, c.start - c.in, clipEnd(c) - 1 / s.fps);
      else t = clamp(t, c.start + 1 / s.fps, c.start + ((m && m.duration) || Infinity) - c.in);
      drag.t = t;
      const el = lanesEl.querySelector(`.clip[data-id="${c.id}"]`);
      if (el) {
        if (drag.edge === 'in') { el.style.left = xOf(t) + 'px'; el.style.width = xOf(clipEnd(c) - t) + 'px'; }
        else el.style.width = xOf(t - c.start) + 'px';
        el.classList.add('ghost');
      }
      const d = drag.edge === 'in' ? t - c.start : t - clipEnd(c);
      app.status(`${drag.ripple ? 'Ripple Edit' : 'Trim'} ${d >= 0 ? '+' : '−'}${timecode(Math.abs(d), s.fps)} · source ${timecode(c.in + (t - c.start), s.fps)}`);
    } else if (drag.type === 'marquee') {
      const r = area.getBoundingClientRect();
      const x1 = Math.min(drag.x0, ev.clientX) - r.left + area.scrollLeft, x2 = Math.max(drag.x0, ev.clientX) - r.left + area.scrollLeft;
      const y1 = Math.min(drag.y0, ev.clientY) - r.top + area.scrollTop, y2 = Math.max(drag.y0, ev.clientY) - r.top + area.scrollTop;
      Object.assign(marq.style, { display: 'block', left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
      app.sel = new Set(drag.base);
      for (const l of lanes) {
        if (l.type !== 'video' && l.type !== 'audio') continue;
        if (l.y + l.h < y1 || l.y > y2) continue;
        for (const c of s.tracks[l.type][l.ti].clips) {
          if (xOf(clipEnd(c)) < x1 || xOf(c.start) > x2) continue;
          app.sel.add(c.id);
        }
      }
      lanesEl.querySelectorAll('.clip').forEach((el) => el.classList.toggle('sel', app.sel.has(el.dataset.id)));
    }
  });

  window.addEventListener('mouseup', (ev) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    showSnap(null);
    marq.style.display = 'none';
    const s = d.s;
    if (d.type === 'ruler') { app.scrubEnd(); return; }
    if (d.type === 'hand') { lanesEl.classList.remove('grabbing'); return; }
    if (d.type === 'slip') {
      if (d.moved && Math.abs(d.d) > 1e-6) app.edit('Slip', () => E.slipClip(s, d.clip.id, d.d, { unlinked: d.alt || !app.linkedSel, mediaDuration: d.mediaDuration }));
      app.status('');
      return;
    }
    if (d.type === 'roll') {
      if (d.moved && Math.abs(d.d) > 1e-6) app.edit('Rolling Edit', () => E.rollEdit(s, d.left.id, d.right.id, d.d, { unlinked: d.alt || !app.linkedSel, mediaDuration: d.mediaDuration }));
      else render();
      app.status('');
      return;
    }
    if (d.type === 'move' && d.moved && (Math.abs(d.dt) > 1e-6 || d.dTrack)) {
      app.edit('Move Clips', () => E.moveClips(s, d.ids, d.dt, d.kind === 'video' ? d.dTrack : d.dTrack, d.kind));
    } else if (d.type === 'trim' && d.moved) {
      app.edit(d.ripple ? 'Ripple Edit' : 'Trim', () => E.trimEdge(s, d.clip.id, d.edge, d.t, {
        ripple: d.ripple, unlinked: d.alt || !app.linkedSel, mediaDuration: (id) => (app.project.mediaById(id) || {}).duration || Infinity,
      }));
    } else if (d.type === 'marquee') {
      if (!d.moved) {
        // klik do prázdna: playhead tam neskáče (jako v Premiere), jen výběr mezery
        if (d.lane && d.lane.dataset.kind) {
          const kind = d.lane.dataset.kind, ti = Number(d.lane.dataset.ti);
          const tr = s.tracks[kind][ti];
          let a = 0, b = Infinity;
          for (const c of tr.clips) { if (clipEnd(c) <= d.t) a = Math.max(a, clipEnd(c)); if (c.start >= d.t) b = Math.min(b, c.start); }
          if (isFinite(b) && b > a) app.gapSel = { kind, ti, start: a, end: b, t: d.t };
        }
      }
      app.selectionChanged();
      render();
    } else render();
    app.status('');
  });

  lanesEl.addEventListener('dblclick', (ev) => {
    const el = ev.target.closest('.clip');
    const s = seq();
    if (!el || !s) return;
    const f = E.findClip(s, el.dataset.id);
    if (!f) return;
    const m = app.project.mediaById(f.clip.mediaId);
    if (m) app.openSource(m, { inPoint: f.clip.in, outPoint: f.clip.out, at: f.clip.in + Math.max(0, s.playhead - f.clip.start) });
  });

  lanesEl.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const s = seq();
    if (!s) return;
    const capEl = ev.target.closest('.cap');
    if (capEl && app.deleteCaption) {
      const i = +capEl.dataset.ci, cs = window.TN && window.TN.lang === 'cs';
      app.popupMenu(ev.clientX, ev.clientY, [[cs ? 'Opravit titulek' : 'Fix caption', () => app.editCaption(i)], [cs ? 'Smazat titulek' : 'Delete caption', () => app.deleteCaption(i)]]);
      return;
    }
    const el = ev.target.closest('.clip');
    if (el) {
      const f = E.findClip(s, el.dataset.id);
      if (f && !app.sel.has(f.clip.id)) { selectWithLinked(s, f.clip, {}); app.selectionChanged(); render(); }
      app.contextMenu(ev.clientX, ev.clientY, 'clip');
    } else {
      const lane = ev.target.closest('.lane');
      if (lane && lane.dataset.kind) {
        const kind = lane.dataset.kind, ti = Number(lane.dataset.ti), t = tAt(ev.clientX);
        const tr = s.tracks[kind][ti];
        let a = 0, b = Infinity;
        for (const c of tr.clips) { if (clipEnd(c) <= t) a = Math.max(a, clipEnd(c)); if (c.start >= t) b = Math.min(b, c.start); }
        if (isFinite(b) && b > a) { app.gapSel = { kind, ti, start: a, end: b, t }; render(); app.contextMenu(ev.clientX, ev.clientY, 'gap'); }
      }
    }
  });

  /* ---------- pravítko: playhead ---------- */
  ruler.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || !seq()) return;
    app.focusPanel('timeline');
    app.program.pause();
    drag = { type: 'ruler', s: seq() };
    app.setPlayhead(Math.max(0, tAt(ev.clientX)), { scrub: true });
  });

  /* ---------- kolečko ---------- */
  area.addEventListener('wheel', (ev) => {
    if (ev.altKey || ev.ctrlKey) {
      ev.preventDefault();
      const t = tAt(ev.clientX);
      setPps(pps * (ev.deltaY < 0 ? 1.25 : 0.8), t);
    } else if (!ev.shiftKey && Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
      ev.preventDefault();
      area.scrollLeft += ev.deltaY;
    }
  }, { passive: false });

  /* ---------- přetažení z Projektu / Zdroje / Průzkumníka ---------- */
  function dropTarget(ev) {
    const l = laneAtY(ev.clientY);
    lanesEl.querySelectorAll('.lane.drop').forEach((x) => x.classList.remove('drop'));
    if (l && (l.type === 'video' || l.type === 'audio')) {
      const el = lanesEl.querySelector(`.lane[data-kind="${l.type}"][data-ti="${l.ti}"]`);
      if (el) el.classList.add('drop');
    }
    return l;
  }
  // obrys přetahovaného klipu jako v Premiere: začátek tam, kde je kurzor (přichycený), obraz i zvuk
  function dragInfo(ev) {
    const d = app.dragging;
    if (d) {
      if (d.type === 'media') { const m = app.project.mediaById(d.id); return m ? { dur: m.duration, name: m.name, video: m.hasVideo, audio: m.hasAudio } : null; }
      if (d.type === 'seq') { const q = app.project.sequences.find((x) => x.id === d.id); return q ? { dur: app.seqDuration(q), name: q.name, video: true, audio: true } : null; }
      if (d.type === 'source') return { dur: d.dur, name: d.name, video: d.video, audio: d.audio };
    }
    if (ev.dataTransfer.types.includes('Files')) {
      const n = ev.dataTransfer.items ? ev.dataTransfer.items.length : 1;
      return { dur: 10, name: n > 1 ? `${n} files` : 'Video', video: true, audio: true, unknown: true };
    }
    return null;
  }
  function dropAt(ev) { const s = seq(); const t = Math.max(0, tAt(ev.clientX)); return s ? E.snapT(s, snapTime(s, t).t) : t; }
  function clearGhost() { lanesEl.querySelectorAll('.drop-ghost').forEach((x) => x.remove()); }
  function showGhost(ev, l) {
    clearGhost();
    const s = seq(), info = dragInfo(ev);
    if (!s || !info) return;
    const at = dropAt(ev);
    let vti = 0, ati = 0;
    if (l && (l.type === 'video' || l.type === 'audio')) { vti = l.ti; ati = l.ti; }
    vti = Math.min(vti, s.tracks.video.length - 1); ati = Math.min(ati, s.tracks.audio.length - 1);
    const mk = (kind, ti) => {
      const lane = lanes.find((q) => q.type === kind && q.ti === ti);
      if (!lane) return;
      const g = document.createElement('div');
      g.className = 'drop-ghost' + (info.unknown ? ' unknown' : '');
      g.style.cssText = `left:${xOf(at)}px;top:${lane.y - RULER_H + 1}px;height:${lane.h - 2}px;width:${Math.max(6, xOf(info.dur))}px`;
      g.textContent = (ev.ctrlKey ? '⇥ Insert · ' : '') + info.name;
      lanesEl.appendChild(g);
    };
    if (info.video) mk('video', vti);
    if (info.audio) mk('audio', ati);
    showSnap(at);
  }
  area.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    const l = dropTarget(ev);
    showGhost(ev, l);
  });
  area.addEventListener('dragleave', (ev) => {
    if (ev.relatedTarget && area.contains(ev.relatedTarget)) return;
    lanesEl.querySelectorAll('.lane.drop').forEach((x) => x.classList.remove('drop')); showSnap(null); clearGhost();
  });
  area.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    showSnap(null);
    clearGhost();
    const l = dropTarget(ev);
    lanesEl.querySelectorAll('.lane.drop').forEach((x) => x.classList.remove('drop'));
    app.dragging = null;
    const insert = ev.ctrlKey;
    let at = dropAt(ev);
    const targets = {};
    if (l && (l.type === 'video' || l.type === 'audio')) { targets.video = l.ti; targets.audio = l.ti; }
    const srcData = ev.dataTransfer.getData('text/tn-source');
    const mediaId = ev.dataTransfer.getData('text/tn-media');
    const seqId = ev.dataTransfer.getData('text/tn-seq');
    try {
      if (seqId) {
        app.dropSequence(seqId, app.snapToFrame(Math.max(0, at)), insert);
      } else if (srcData) {
        const d = JSON.parse(srcData);
        app.dropMedia(app.project.mediaById(d.mediaId), d.inPoint, d.outPoint, at, insert, targets);
      } else if (mediaId) {
        const m = app.project.mediaById(mediaId);
        app.dropMedia(m, 0, m.duration, at, insert, targets);
      } else if (ev.dataTransfer.files && ev.dataTransfer.files.length) {
        const paths = require('../core/dropfiles').droppedPaths(ev.dataTransfer);
        const ms = await app.importPaths(paths);
        for (const m of ms) {
          if (!m || m.error) continue;
          const s = seq();
          if (s) at = app.snapToFrame(at);
          app.dropMedia(m, 0, m.duration, at, insert, targets);
          at += m.duration;
        }
      }
    } catch (e) { app.toast(e.message, true); }
  });

  function trackHeight(kind, delta) {
    app.view = app.view || {};
    const k = kind === 'audio' ? 'aH' : 'vH';
    app.view[k] = clamp((app.view[k] || LANE_H) + delta, LANE_MIN, LANE_MAX);
    render();
  }
  return {
    trackHeight,
    expandAll() { app.view = app.view || {}; app.view.vH = 90; app.view.aH = 90; render(); },
    minimizeAll() { app.view = app.view || {}; app.view.vH = LANE_MIN; app.view.aH = LANE_MIN; render(); },
    pageScroll(dir) { area.scrollLeft = Math.max(0, area.scrollLeft + dir * area.clientWidth * 0.9); },
    render, drawRuler, setPlayheadView, zoomFit, setPps, get pps() { return pps; },
    zoomIn() { const s = seq(); setPps(pps * 1.5, s ? s.playhead : 0); },
    zoomOut() { const s = seq(); setPps(pps / 1.5, s ? s.playhead : 0); },
    restoreView() {
      const s = seq();
      if (!s) { render(); return; }
      if (s.zoom) { pps = s.zoom; render(); area.scrollLeft = s.scroll || 0; updateZoomBar(); } else { render(); zoomFit(); }
    },
  };
}

module.exports = { createTimeline };
