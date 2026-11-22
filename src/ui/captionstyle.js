'use strict';
/* Okno Text v obraze (Sekvence → Titulky → Styl titulků…, nebo „Aa“ u stopy titulků): nadpis nahoře (sítě) a styl titulků.
 * Plovoucí panel u programového monitoru – každá změna se hned ukáže v obraze, puštění posuvníku / dopsání = jeden krok Zpět.
 * Řádky, délka řádku a velikost písma titulky rovnou přeskládají (text i ruční opravy zůstanou). */
const CL = require('../core/captionlayout');

let box = null;

function openCaptionStyle(app, focusTitle) {
  let s = app.seq();
  if (!s) return;
  if (box) box.remove();
  const cs = !!(window.TN && window.TN.lang === 'cs');
  const L = (en, czech) => (cs ? czech : en);
  const snap = () => ({ style: JSON.stringify(s.captionStyle || null), caps: JSON.stringify(s.captions || []), title: JSON.stringify(s.title || null) });
  let base = snap();
  let st = CL.styleOf(s);
  let ti = Object.assign({ text: '', size: 1 }, s.title || {});

  box = document.createElement('div');
  box.className = 'capstyle';
  box.setAttribute('data-keep', '1');
  box.innerHTML = `
    <div class="cs-head"><b>${L('Text on video', 'Text v obraze')}</b><span class="cs-seq"></span><button class="cs-x" title="${L('Close', 'Zavřít')}">×</button></div>
    <div class="cs-sec">${L('Headline at the top', 'Nadpis nahoře')}</div>
    <input type="text" class="cs-title" maxlength="90" autocomplete="off" placeholder="${L('E.g. Mayor: The bridge will be ready in summer', 'Např. Starostka: Most bude hotový v létě')}">
    <div class="cs-row"><span>${L('Headline size', 'Velikost nadpisu')}</span><input type="range" data-t="size" min="0.6" max="1.6" step="0.05"><em data-o="tsize"></em></div>
    <div class="cs-sec cs-sec-cap">${L('Captions', 'Titulky')}${window.__pzASR ? `<button class="cs-mk-small" style="display:none">${L('Create again from transcript…', 'Vytvořit znovu z přepisu…')}</button>` : ''}</div>
    ${window.__pzASR ? `<div class="cs-mk-big" style="display:none"><button class="cs-mk tr-primary">${L('Create captions from transcript', 'Vytvořit titulky z přepisu')}</button><div class="cs-mk-note">${L('Only the words heard in the sequence.', 'Jen slova, která v sekvenci zazní.')}</div></div>` : ''}
    <div class="cs-row"><span>${L('Lines', 'Řádky')}</span><div class="cs-seg" data-k="lines"><button data-v="1">1</button><button data-v="2">2</button><button data-v="3">3</button></div></div>
    <div class="cs-row"><span>${L('Line length', 'Délka řádku')}</span><input type="range" data-k="maxChars" min="12" max="50" step="1"><em data-o="maxChars"></em></div>
    <div class="cs-row"><span>${L('Text size', 'Velikost písma')}</span><input type="range" data-k="size" min="0.6" max="1.8" step="0.05"><em data-o="size"></em></div>
    <div class="cs-row"><span>${L('Height', 'Výška')}</span><input type="range" data-k="pos" min="2" max="60" step="1"><em data-o="pos"></em></div>
    <div class="cs-warn"></div>
    <div class="cs-row"><span>${L('Colour', 'Barva')}</span><div class="cs-seg cs-col" data-k="color">
      <button data-v="#ffffff" style="--c:#ffffff" title="${L('White', 'Bílá')}"></button><button data-v="#ffd60a" style="--c:#ffd60a" title="${L('Yellow', 'Žlutá')}"></button><button data-v="#7dd3fc" style="--c:#7dd3fc" title="${L('Light blue', 'Světle modrá')}"></button></div>
      <label class="cs-box"><input type="checkbox" data-k="box"> ${L('Background', 'Podklad')}</label></div>
    <label class="cs-hl"><input type="checkbox" data-k="highlight"> ${L('Highlight the spoken word', 'Zvýraznit vyslovované slovo')}</label>
    <div class="cs-foot"><button class="cs-reset">${L('Default', 'Výchozí')}</button><span>${L('Fix caption text on the Captions tab (next to Transcript) or by clicking a caption in the picture.', 'Text titulků opravíš v záložce Titulky (vedle Přepisu) nebo kliknutím na titulek v obraze.')}</span></div>`;
  // ukotveno jako záložka v rámu Zdroje (design-2 §2.2): monitory ani dialog exportu nikdy nepřekryje
  const srcPanel = document.getElementById('sourcePanel');
  box.classList.add('docked');
  srcPanel.appendChild(box);
  showTab(true);
  box.querySelector('.cs-seq').textContent = s.name;
  const titleIn = box.querySelector('.cs-title');

  // titulky z přepisu (bez AI): velké tlačítko, když sekvence titulky nemá; malé „znovu“, když je má
  box.querySelectorAll('.cs-mk, .cs-mk-small').forEach((b) => { b.onclick = () => app.cmd('captionsFromTranscript'); });
  const LAYOUT = new Set(['lines', 'maxChars', 'size', 'box']);
  function show() {
    const hasCaps = !!(s.captions || []).length;
    const big = box.querySelector('.cs-mk-big'), small = box.querySelector('.cs-mk-small');
    if (big) big.style.display = hasCaps ? 'none' : 'block';
    if (small) small.style.display = hasCaps ? '' : 'none';
    box.querySelectorAll('.cs-seg').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(st[g.dataset.k]) === b.dataset.v)));
    box.querySelectorAll('input[type=range][data-k]').forEach((i) => { i.value = st[i.dataset.k]; });
    box.querySelector('input[data-t=size]').value = ti.size || 1;
    if (document.activeElement !== titleIn) titleIn.value = ti.text || '';
    box.querySelector('input[data-k=box]').checked = !!st.box;
    box.querySelector('input[data-k=highlight]').checked = !!st.highlight;
    box.querySelector('[data-o=maxChars]').textContent = st.maxChars + L(' ch', ' zn.');
    box.querySelector('[data-o=size]').textContent = Math.round(st.size * 100) + ' %';
    box.querySelector('[data-o=tsize]').textContent = Math.round((ti.size || 1) * 100) + ' %';
    box.querySelector('[data-o=pos]').textContent = st.pos + ' %';
    // 9:16: dolních ~22 % zakrývá na Reels / TikToku jméno a popisek
    const tall = CL.shapeOf(s.width, s.height) === 'tall';
    const warn = tall && st.pos < 23;
    box.querySelector('.cs-warn').textContent = warn ? L('On Reels / TikTok the app covers this area – move captions higher (about 25–35 %).', 'Na Reels / TikToku tuhle část zakryje popisek aplikace – posuň titulky výš (asi 25–35 %).') : '';
    box.querySelector('.cs-warn').style.display = warn ? 'block' : 'none';
  }
  // živý náhled bez kroku Zpět; commit() pak uloží jeden krok
  function live(k) {
    if (k === 'title') {
      if (String(ti.text || '').trim()) s.title = { text: ti.text, size: ti.size || 1 }; else delete s.title;
    } else {
      s.captionStyle = Object.assign({}, st);
      if (LAYOUT.has(k) && (s.captions || []).length) {
        const from = Object.assign({}, s, { captions: JSON.parse(base.caps) });
        s.captions = CL.reflow(from, st);
      }
    }
    app.program.refresh();
    app.timeline.render();
  }
  function commit() {
    const fin = snap();
    gesture = false;
    if (fin.style === base.style && fin.caps === base.caps && fin.title === base.title) return;
    const restore = (x) => {
      const so = JSON.parse(x.style), to = JSON.parse(x.title);
      if (so === null) delete s.captionStyle; else s.captionStyle = so;
      if (to === null) delete s.title; else s.title = to;
      s.captions = JSON.parse(x.caps);
    };
    restore(base);
    const label = fin.title !== base.title && fin.style === base.style ? 'Headline' : 'Caption Style';
    app.edit(label, () => restore(fin));
    base = fin;
    if (label !== 'Headline') CL.rememberStyle(s, st);
  }
  let gesture = false;
  const begin = () => {
    // začátek úpravy: výchozí stav = to, co je teď v sekvenci (mezitím mohl proběhnout Zpět)
    // (Zpět vrací kopii projektu → vzít aktuální objekt sekvence; okno sleduje aktivní sekvenci)
    if (gesture) return true;
    const now = app.seq();
    if (!now) return false;
    s = now;
    st = CL.styleOf(s);
    ti = Object.assign({ text: '', size: 1 }, s.title || {});
    box.querySelector('.cs-seq').textContent = s.name;
    base = snap();
    gesture = true;
    return true;
  };
  const set = (k, v) => { if (!begin()) return; st[k] = v; show(); live(k); };
  const setTitle = (k, v) => { if (!begin()) return; ti[k] = v; show(); live('title'); };
  box.querySelectorAll('.cs-seg button').forEach((b) => {
    b.onclick = () => { const k = b.parentElement.dataset.k; set(k, k === 'lines' ? Number(b.dataset.v) : b.dataset.v); commit(); };
  });
  box.querySelectorAll('input[type=range][data-k]').forEach((i) => {
    i.oninput = () => set(i.dataset.k, Number(i.value));
    i.onchange = commit;
  });
  const tsz = box.querySelector('input[data-t=size]');
  tsz.oninput = () => setTitle('size', Number(tsz.value));
  tsz.onchange = commit;
  titleIn.oninput = () => setTitle('text', titleIn.value);
  titleIn.onchange = commit;
  titleIn.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); titleIn.blur(); } };
  box.querySelector('input[data-k=box]').onchange = (e) => { set('box', e.target.checked); commit(); };
  // zvýraznění: žlutá k bílému písmu, jinak bílá
  box.querySelector('input[data-k=highlight]').onchange = (e) => { set('highlight', e.target.checked ? (String(st.color || '#ffffff').toLowerCase() === '#ffd60a' ? '#ffffff' : '#ffd60a') : ''); commit(); };
  box.querySelector('.cs-reset').onclick = () => {
    set('lines', 2);
    st = CL.factoryStyle(s);
    show(); live('lines'); commit();
    // výchozí = i pro další titulky tohoto tvaru obrazu (commit si styl zapamatoval – tady ho zase zapomenout)
    try { localStorage.removeItem('pzCapStyle.' + CL.shapeOf(s.width, s.height)); } catch (e) { /* bez úložiště */ }
  };
  box._commit = () => { if (gesture) commit(); };
  box.querySelector('.cs-x').onclick = close;
  // přesun za hlavičku
  const head = box.querySelector('.cs-head');
  head.onmousedown = (ev) => {
    if (ev.target.closest('button')) return;
    const ox = ev.clientX - box.offsetLeft, oy = ev.clientY - box.offsetTop;
    const mv = (e) => { box.style.left = (e.clientX - ox) + 'px'; box.style.top = Math.max(0, e.clientY - oy) + 'px'; };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  // Esc vrátí fokus na Program (záložku nezavírá)
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); app.focusPanel('program'); } });
  boxApp = app;
  show();
  if (focusTitle) setTimeout(() => titleIn.focus(), 30);
}
let boxApp = null, tabApp = null;
/** Záložka Text v obraze podle stavu (volá renderer při změně sekvence). */
function syncTab(app) { tabApp = app; showTab(!!box && document.getElementById('sourcePanel') && document.getElementById('sourcePanel').classList.contains('show-txt')); }
/** Záložky v rámu Zdroje: Zdroj | Text v obraze ×. active = true → ukázat Text v obraze. */
function showTab(active) {
  const sp = document.getElementById('sourcePanel'), tab = document.getElementById('tabTxt'), src = document.getElementById('tabSrc');
  if (!sp || !tab) return;
  // záložka je vidět vždy, když je otevřená sekvence (redaktor-4: skrytou ji při 1366×768 nenašel)
  tab.classList.toggle('hidden', !box && !(tabApp && tabApp.seq && tabApp.seq()));
  sp.classList.toggle('show-txt', !!box && active);
  tab.classList.toggle('open', !!box);
  tab.classList.toggle('on', !!box && active);
  src.classList.toggle('on', !(box && active));
  if (!active && boxApp) setTimeout(() => boxApp.source.layout(), 0);
}
(function bindTabs() {
  const tab = document.getElementById('tabTxt'), src = document.getElementById('tabSrc'), x = document.getElementById('tabTxtX');
  if (!tab) { setTimeout(bindTabs, 200); return; }
  src.addEventListener('click', () => { if (box) { try { box._commit(); } catch (e) { /* bez sekvence */ } } showTab(false); });
  tab.addEventListener('click', (e) => { if (e.target.closest('#tabTxtX')) return; if (!box && tabApp) { openCaptionStyle(tabApp); return; } showTab(true); });
  x.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tab.click(); } });
})();
// zavření uprostřed úpravy (tažení posuvníku, psaní) úpravu uloží jako krok Zpět
function close() { if (box) { try { box._commit(); } catch (e) { /* sekvence mezitím zmizela */ } box.remove(); box = null; } showTab(false); }

/** Zavřít bez uložení (Nový projekt / jiný projekt – rozepsaný nadpis nesmí přejít do nového projektu). */
function discard() { if (box) { box.remove(); box = null; } showTab(false); }
/** Zdroj dostal klip (dvojklik, věta v Přepisu): přepnout na záložku Zdroj, Text v obraze zůstane v hlavičce. */
function toSource() { if (box) { try { box._commit(); } catch (e) { /* bez sekvence */ } } showTab(false); }
module.exports = { syncTab, openCaptionStyle, closeCaptionStyle: close, discardCaptionStyle: discard, captionStyleToSource: toSource, commitCaptionStyle: () => { if (box) { try { box._commit(); } catch (e) { /* bez sekvence */ } } } };
