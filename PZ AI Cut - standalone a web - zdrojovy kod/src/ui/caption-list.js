'use strict';
/* Záložka Titulky vedle Přepisu (team/design/design-2.md §1): seznam titulků aktivní sekvence, oprava přímo v řádku
 * (Enter uloží a otevře další, Esc zruší, ↑/↓ předchozí/další), oprava se zapíše i do přepisu zdroje (app.saveCaption –
 * jeden krok Zpět). Bez AI i na desktopu (tam jen titulky, přepis v aplikaci není). */
const CL = require('../core/captionlayout');

function createCaptionList(app) {
  const $ = (id) => document.getElementById(id);
  const pane = $('capPane');
  const cs = () => !!(window.TN && window.TN.lang === 'cs');
  const L = (en, c) => (cs() ? c : en);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mmss = (x) => { x = Math.max(0, x); const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = Math.floor(x % 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
  const plural = (n, a, b, c) => (n === 1 ? a : n >= 2 && n <= 4 ? b : c);

  let visible = false;
  let editing = null;   // { i, ta }
  let focusI = -1;      // řádek s fokusem (bez psaní)
  let fixedBase = 0;    // počet „Edit Caption“ v historii při otevření sekvence
  const fixedCount = () => Math.max(0, app.project.history.filter((h) => h.label === 'Edit Caption').length - fixedBase);
  let note = '';        // poznámka do patičky (rozdělení, nepropsáno, konec)
  let seqId = null;
  let stopAt = null;
  let delHist = -1; // délka historie po smazání – jiná (Ctrl+Z, další úprava) = patička „Smazán… Vrátit“ už neplatí (report-5 C9)
  let undoBtn = false; // [Vrátit] v patičce po smazání // přehrát titulek: zastavit na jeho konci
  let key = '';

  const seq = () => app.seq();
  function render(force) {
    if (!visible) return;
    const s = seq();
    if (!s || s.id !== seqId) { seqId = s && s.id; fixedBase = app.project.history.filter((h) => h.label === 'Edit Caption').length; note = ''; focusI = -1; }
    const caps = (s && s.captions) || [];
    // i počet zvukových klipů: po vložení (Ctrl+V) do prázdné sekvence se jinak držel text „nemá klipy se zvukem“ (redaktorka S7)
    const nAudio = s ? s.tracks.audio.reduce((n, t) => n + t.clips.length, 0) : 0;
    const k = [cs(), s && s.id, caps.length, nAudio, caps.map((c) => c.text + c.start.toFixed(2)).join('|'), editing && editing.i].join('#');
    if (undoBtn && app.project.history.length !== delHist) { undoBtn = false; note = ''; key = ''; }
    if (k === key && !force) { paintPlay(); return; }
    key = k;
    if (editing) return; // během psaní nepřekreslovat (ztratil by se text)
    let html = '';
    if (!s) {
      html = empty(L('Captions belong to a sequence', 'Titulky patří k sekvenci'), L('First put a part into a sequence – e.g. by clicking a sentence on the Transcript tab.', 'Nejdřív vlož úsek do sekvence – třeba kliknutím na větu v záložce Přepis.'), window.__pzASR ? [L('Open Transcript', 'Otevřít Přepis'), () => app.transcript.show('tr')] : null);
    } else if (!caps.length) {
      const hasAudio = s.tracks.audio.some((t) => t.clips.length);
      html = !hasAudio
        ? empty(L('The sequence has no clips with sound', 'Sekvence nemá klipy se zvukem'), L('There is nothing to make captions from.', 'Titulky není z čeho vytvořit.'))
        : window.__pzASR
          ? empty(L('The sequence has no captions yet', 'Sekvence zatím nemá titulky'), L('They are made from the transcript – only words heard in the sequence. No AI.', 'Vzniknou z přepisu – jen ze slov, která v sekvenci zazní. Bez AI.'), [L('Create captions from transcript', 'Vytvořit titulky z přepisu'), () => app.cmd('captionsFromTranscript')])
          : empty(L('The sequence has no captions yet', 'Sekvence zatím nemá titulky'), L('Captions are made by the AI panel (quick action Captions).', 'Titulky vytvoří AI panel (rychlá akce Titulky).'));
    } else {
      const dur = CL.contentEnd(s) || 0;
      html = `<div class="tr-clip"><span class="nm" title="${esc(s.name)}">${esc(s.name)}</span><span class="dim">${caps.length} ${L(caps.length === 1 ? 'caption' : 'captions', plural(caps.length, 'titulek', 'titulky', 'titulků'))} · ${mmss(dur)}</span></div>
        <div class="cap-list" id="capList" tabindex="0">${caps.map((c, i) => `<div class="cap-row" data-i="${i}"><span class="tt">${mmss(c.start)}</span><span class="tx" title="${esc(L('Click and fix the caption text', 'Klikni a oprav text titulku'))}">${esc(c.text)}</span><button class="cap-play" tabindex="-1" title="${esc(L('Play caption (Ctrl+Space)', 'Přehrát titulek (Ctrl+mezerník)'))}">▶</button></div>`).join('')}</div>
        <div class="tr-foot" id="capFoot"></div>`;
    }
    const list0 = $('capList'); const st = list0 ? list0.scrollTop : 0;
    pane.innerHTML = html;
    const list = $('capList');
    if (list) { list.scrollTop = st; bind(list); }
    const eb = pane.querySelector('.tr-empty .tr-primary');
    if (eb && eb._fn) eb.onclick = eb._fn;
    pane.querySelectorAll('[data-act]').forEach((b) => { const f = acts[b.dataset.act]; if (f) b.onclick = f; });
    paintFoot(); paintPlay(); paintFocus();
  }
  const acts = {};
  function empty(title, text, btn) {
    if (btn) acts.emptyBtn = btn[1];
    return `<div class="tr-empty"><div class="tr-et">${esc(title)}</div><div class="tr-ed">${esc(text)}</div>${btn ? `<button class="tr-primary" data-act="emptyBtn">${esc(btn[0])}</button>` : ''}</div>`;
  }
  function paintFoot() {
    const f = $('capFoot');
    if (!f) return;
    const fixedN = fixedCount();
    const msg = note || (fixedN ? L(`Fixed: ${fixedN} · fixes also apply to the clip transcript`, `Opraveno: ${fixedN} ${plural(fixedN, 'titulek', 'titulky', 'titulků')} · opravy platí i v přepisu klipu`) : L('Click a caption and fix it. Enter saves and goes on, Esc cancels, Delete deletes the caption.', 'Klikni do titulku a oprav ho. Enter uloží a další, Esc zruší, Delete smaže titulek.'));
    f.innerHTML = `<span class="tip${note && /⚠|nevešel|jen v titulku|only in/.test(note) ? ' warn' : ''}">${esc(msg)}</span><span class="spacer"></span>${undoBtn ? `<button id="capUndo" title="${esc(L('Undo the deletion (Ctrl+Z)', 'Vrátit smazání (Ctrl+Z)'))}">${esc(L('Undo', 'Vrátit'))}</button>` : ''}<button id="capLook">${esc(L('Look…', 'Vzhled…'))}</button>`;
    $('capLook').onclick = () => app.cmd('captionStyle');
    if ($('capUndo')) $('capUndo').onclick = () => { undoBtn = false; note = ''; app.cmd('undo'); };
  }
  // titulek pod přehrávací hlavou (hraje)
  function paintPlay() {
    const list = $('capList'), s = seq();
    if (!list || !s) return;
    const t = s.playhead || 0;
    let cur = null;
    list.querySelectorAll('.cap-row').forEach((r) => {
      const c = s.captions[+r.dataset.i];
      const on = !!c && t >= c.start && t < c.end;
      r.classList.toggle('play', on);
      if (on) cur = r;
    });
    if (cur && app.program.playing && !editing) scrollInto(cur);
  }
  function paintFocus() {
    const list = $('capList');
    if (!list) return;
    list.querySelectorAll('.cap-row').forEach((r) => r.classList.toggle('kf', +r.dataset.i === focusI && !editing));
  }
  function scrollInto(r) {
    const list = $('capList');
    const top = r.offsetTop - list.offsetTop, h = r.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + h > list.scrollTop + list.clientHeight) list.scrollTop = top + h - list.clientHeight;
  }
  function row(i) { const list = $('capList'); return list && list.querySelector(`.cap-row[data-i="${i}"]`); }
  function seekTo(i) {
    const s = seq(), c = s && s.captions[i];
    if (!c) return;
    if (app.program.playing) app.program.pause();
    app.setPlayhead(c.start + Math.min(0.05, (c.end - c.start) / 2));
  }
  function focus(i) {
    const s = seq();
    if (!s || !s.captions.length) return;
    focusI = Math.max(0, Math.min(s.captions.length - 1, i));
    seekTo(focusI);
    paintFocus();
    const r = row(focusI); if (r) scrollInto(r);
    const list = $('capList'); if (list && document.activeElement !== list && !editing) list.focus({ preventScroll: true });
  }
  function playCap(i) {
    const s = seq(), c = s && s.captions[i];
    if (!c) return;
    app.setPlayhead(c.start);
    stopAt = c.end;
    app.program.play(1);
  }

  /* ---------- psaní v řádku ---------- */
  function startEdit(i, caretAt) {
    if (undoBtn) { undoBtn = false; note = ''; }
    const s = seq(), c = s && s.captions[i];
    if (!c) return;
    if (editing) finish(true, 0);
    focusI = i;
    seekTo(i);
    const r = row(i);
    if (!r) return;
    const tx = r.querySelector('.tx');
    const ta = document.createElement('textarea');
    ta.className = 'cap-edit';
    ta.spellcheck = false;
    ta.value = c.text.replace(/\n/g, ' ');
    tx.replaceWith(ta);
    const hint = document.createElement('div');
    hint.className = 'cap-hint';
    r.appendChild(hint);
    r.classList.add('editing');
    editing = { i, ta, hint, orig: ta.value };
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    const upd = () => {
      grow();
      let n = 1;
      try { n = CL.retext(s, c, ta.value).length; } catch (e) { /* bez rozvržení */ }
      const lines = CL.styleOf(s).lines;
      if (!ta.value.trim()) { hint.className = 'cap-hint warn'; hint.textContent = L('Empty caption – Enter deletes it, Esc restores the text', 'Prázdný titulek – Enter ho smaže, Esc vrátí text'); return; }
      hint.className = 'cap-hint' + (n > 1 ? ' warn' : '');
      hint.textContent = n > 1 ? L(`Does not fit in ${lines} line${lines === 1 ? '' : 's'} – it will be split into ${n} captions`, `Nevejde se do ${lines} ${plural(lines, 'řádku', 'řádků', 'řádků')} – rozdělí se na ${n} titulky`) : L('Enter saves and goes to the next · Esc cancels · Ctrl+A, Delete deletes the caption', 'Enter uloží a další · Esc zruší · Ctrl+A, Delete smaže titulek');
    };
    ta.addEventListener('input', upd);
    ta.addEventListener('keydown', (ev) => {
      ev.stopPropagation(); // zkratky střižny (L, A, mezerník, šipky) se při psaní nespouštějí
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finish(true, 1, true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(false, 0); }
      else if (ev.key === 'ArrowUp' && !ev.shiftKey && ta.selectionStart === 0) { ev.preventDefault(); finish(true, -1); }
      else if (ev.key === 'ArrowDown' && !ev.shiftKey && ta.selectionEnd === ta.value.length) { ev.preventDefault(); finish(true, 1); }
      else if (ev.key === ' ' && ev.ctrlKey) { ev.preventDefault(); playCap(i); }
      // Delete s označeným celým textem (Ctrl+A) nebo v prázdném poli smaže titulek (redaktor-4: Delete v otevřeném titulku nedělal nic)
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && (!ta.value.trim() || (ta.selectionStart === 0 && ta.selectionEnd === ta.value.length && ta.value.length > 0 && ev.key === 'Delete'))) {
        ev.preventDefault(); const k = i; editing = null; delAt(k);
      }
    });
    ta.addEventListener('blur', () => { setTimeout(() => { if (editing && editing.ta === ta && document.activeElement !== ta) finish(true, 0); }, 0); });
    upd();
    ta.focus();
    const pos = caretAt == null ? ta.value.length : Math.max(0, Math.min(ta.value.length, caretAt));
    ta.setSelectionRange(pos, pos);
  }
  /** Ukončí psaní: save = uložit; move = 0 zůstat, ±1 psát v předchozím / dalším titulku. */
  function finish(save, move, byEnter) {
    const e = editing;
    if (!e) return;
    if (!e.ta.value.trim() && !byEnter) save = false; // prázdné pole smaže titulek jen Enterem
    editing = null;
    const keepTop = $('capList') ? $('capList').scrollTop : 0; // Esc / Enter nesmí seznamem hnout (redaktor-3)
    const s = seq();
    let next = e.i + (move || 0);
    note = '';
    if (save && e.ta.value.replace(/\s+/g, ' ').trim() !== e.orig.replace(/\s+/g, ' ').trim()) {
      const r = app.saveCaption(e.i, e.ta.value);
      if (r && r.deleted) { if (move > 0) next = e.i; note = delNote(e.orig); }
      else if (r) {
        if (r.parts > 1) {
          note = L(`The text did not fit – it is now in ${r.parts} captions. Undo with Ctrl+Z.`, `Text se nevešel do ${CL.styleOf(s).lines} ${plural(CL.styleOf(s).lines, 'řádku', 'řádků', 'řádků')} – je teď ve ${r.parts} titulcích. Zpět vrátíš Ctrl+Z.`);
          if (move > 0) next = e.i + r.parts; // další titulek je až za oběma polovinami
        }
        if (!r.propagated && window.__pzASR) note = (note ? note + ' ' : '') + L('Saved only in the caption – the words were not found in the clip transcript.', 'Uloženo jen v titulku – v přepisu klipu se tahle slova nenašla.');
      } else if (save) {
        app.toast(L('The caption fix was not saved. Try again.', 'Oprava titulku se neuložila. Zkus to znovu.'), true);
      }
    }
    key = '';
    render(true);
    const n = (s && s.captions.length) || 0;
    if (move > 0 && next >= n) {
      note = L(`End of captions · fixed: ${fixedCount()}. Done? Export (Ctrl+M).`, `Konec titulků · opraveno: ${fixedCount()}. Hotovo? Exportuj (Ctrl+M).`);
      paintFoot();
      focus(n - 1);
      return;
    }
    const l0 = $('capList'); if (l0) l0.scrollTop = keepTop;
    if (move) startEdit(Math.max(0, Math.min(n - 1, next)));
    else { focusI = Math.min(e.i, n - 1); paintFocus(); const l = $('capList'); if (l) { l.focus({ preventScroll: true }); l.scrollTop = keepTop; } }
  }

  const delNote = (txt) => { const t = String(txt).replace(/\s+/g, ' ').trim(); return L(`Caption deleted “${t.length > 30 ? t.slice(0, 30) + '…' : t}”`, `Smazán titulek „${t.length > 30 ? t.slice(0, 30) + '…' : t}“`); };
  /** Smazat titulek i ze seznamu: poznámka v patičce s [Vrátit], fokus na řádek, který zaujal místo. */
  function delAt(i) {
    const s = seq(), c = s && s.captions[i];
    if (!c) return;
    const top = $('capList') ? $('capList').scrollTop : 0;
    if (!app.deleteCaption(i, true)) return;
    note = delNote(c.text); undoBtn = true; delHist = app.project.history.length;
    key = ''; render(true);
    const l = $('capList'); if (l) l.scrollTop = top;
    if (s.captions.length) focus(Math.min(i, s.captions.length - 1));
  }
  function bind(list) {
    list.addEventListener('mousedown', (ev) => {
      const r = ev.target.closest('.cap-row');
      if (!r || ev.target.closest('textarea')) return;
      const i = +r.dataset.i;
      if (ev.target.closest('.cap-play')) { ev.preventDefault(); playCap(i); return; }
      if (ev.target.closest('.tx')) {
        ev.preventDefault();
        // kurzor v místě kliknutí
        let caret = null;
        try { const rg = document.caretRangeFromPoint(ev.clientX, ev.clientY); if (rg && rg.startContainer && rg.startContainer.nodeType === 3) { const all = ev.target.closest('.tx').textContent; const before = rg.startContainer.textContent.slice(0, rg.startOffset); caret = all.indexOf(rg.startContainer.textContent) + before.length; } } catch (e) { /* bez caret */ }
        startEdit(i, caret);
        return;
      }
      focus(i);
    });
    list.addEventListener('contextmenu', (ev) => {
      const r = ev.target.closest('.cap-row');
      if (!r) return;
      ev.preventDefault();
      const i = +r.dataset.i;
      if (editing) finish(true, 0);
      focus(i);
      app.popupMenu(ev.clientX, ev.clientY, [[L('Fix caption', 'Opravit titulek'), () => startEdit(i)], [L('Delete caption (Del)', 'Smazat titulek (Del)'), () => delAt(i)]]);
    });
    list.addEventListener('keydown', (ev) => {
      if (editing) return;
      const s = seq(); if (!s) return;
      const n = s.captions.length;
      const k = ev.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') { ev.preventDefault(); ev.stopPropagation(); focus((focusI < 0 ? 0 : focusI) + (k === 'ArrowDown' ? 1 : -1)); }
      else if (k === 'Home' || k === 'End') { ev.preventDefault(); ev.stopPropagation(); focus(k === 'Home' ? 0 : n - 1); }
      else if (k === 'Enter' || k === 'F2') { ev.preventDefault(); ev.stopPropagation(); startEdit(focusI < 0 ? 0 : focusI); }
      else if (k === ' ') { ev.preventDefault(); ev.stopPropagation(); playCap(focusI < 0 ? 0 : focusI); }
      else if ((k === 'Delete' || k === 'Backspace') && focusI >= 0) { ev.preventDefault(); ev.stopPropagation(); if (!ev.repeat) delAt(focusI); }
    });
  }

  // aktivní sekvence / změny titulků / Zpět → překreslit; přehrávání → zvýraznit hrající titulek
  app.project.on(() => { if (visible) render(); });
  setInterval(() => {
    if (stopAt != null) { const s = seq(); if (!app.program.playing) stopAt = null; else if (s && s.playhead >= stopAt - 0.02) { stopAt = null; app.program.pause(); } }
    if (visible && !editing) paintPlay();
  }, 50);

  return {
    setVisible(v) { visible = v; if (v) { key = ''; render(true); } else if (editing) finish(true, 0); },
    render: () => render(true),
    get visible() { return visible; },
    /** psaní v titulku pod hlavou (F2, menu) */
    editAtPlayhead() {
      const s = seq(); if (!s) return false;
      const i = (s.captions || []).findIndex((c) => c.start <= s.playhead + 0.001 && c.end > s.playhead);
      if (i < 0) return false;
      setTimeout(() => startEdit(i), 0);
      return true;
    },
    // bez skoku hlavy na titulek (kolo 5, B1: hlava uvnitř klipu → další „Vložit“ klip rozřízlo)
    focusFirst(i = 0) { setTimeout(() => { const s = seq(); if (s && s.captions.length) { focusI = Math.max(0, Math.min(s.captions.length - 1, i)); paintFocus(); const r = row(focusI); if (r) scrollInto(r); const list = $('capList'); if (list && !editing) list.focus({ preventScroll: true }); } }, 0); },
  };
}

module.exports = { createCaptionList };
