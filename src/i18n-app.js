'use strict';
/* Čeština v okně aplikace: texty v kódu jsou anglicky, v režimu „cs“ je tahle vrstva překládá přímo v DOM
 * (text, title, placeholder) – i to, co se vykreslí později (MutationObserver). Původní anglický text si pamatuje,
 * takže přepnutí zpět na angličtinu funguje bez restartu. Nativní dialogy (Uložit/Otevřít…) překládá
 * obalením ipcRenderer.invoke('dialog'). Obsah chatu AI panelu (#out) a texty, které zadává uživatel, se nepřekládají. */
const { ipcRenderer } = require('electron');
const { tr } = require('./core/lang');

let LANG = 'en';
const ORIG = new WeakMap(); // uzel -> původní anglický text; prvek -> {atribut: původní}
const ATTRS = ['title', 'placeholder'];
const SKIP_SEL = '#out, textarea, .cl, .tname, .nm, .seq-tab span, .pz-seqname, kbd';
const docs = new Set();
let busy = false;

function skip(el) {
  if (!el || !el.closest) return false;
  if (el.nodeName === 'STYLE' || el.nodeName === 'SCRIPT' || el.nodeName === 'TEXTAREA') return true;
  return !!el.closest(SKIP_SEL);
}

function fixText(n) {
  const p = n.parentNode;
  if (skip(p)) return;
  const cur = n.nodeValue;
  if (LANG === 'cs') {
    if (!/[A-Za-z]/.test(cur)) return;
    const t = tr(cur);
    if (t !== cur) { ORIG.set(n, cur); n.nodeValue = t; }
  } else if (ORIG.has(n)) { n.nodeValue = ORIG.get(n); ORIG.delete(n); }
}

function fixAttrs(el) {
  if (!el.getAttribute || skip(el)) return;
  let o = ORIG.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (LANG === 'cs') {
      if (!v || (o && o[a + '_cs'] === v)) continue;
      const t = tr(v);
      if (t !== v) { o = o || {}; o[a] = v; o[a + '_cs'] = t; ORIG.set(el, o); el.setAttribute(a, t); }
    } else if (o && o[a] != null && o[a + '_cs'] === v) { el.setAttribute(a, o[a]); delete o[a]; delete o[a + '_cs']; }
  }
}

function walk(n) {
  if (n.nodeType === 3) return fixText(n);
  if (n.nodeType !== 1 || n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE' || n.id === 'out') return;
  fixAttrs(n);
  if (n.nodeName === 'IFRAME') return;
  for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
}

const observers = new Map();
/** Pozor na AI panel (iframe): smí se sledovat jen v češtině, kdy jeho vlastní překlad do angličtiny (ai/i18n.js)
 *  neběží – jinak by se oba překlady donekonečna přepisovaly a okno zamrzne. Proto detach() při změně jazyka. */
function detach(doc) {
  const o = observers.get(doc);
  if (o) { o.disconnect(); observers.delete(doc); }
  docs.delete(doc);
}
function observe(doc) {
  if (!doc || !doc.body || docs.has(doc)) return;
  docs.add(doc);
  walk(doc.body);
  const mo = new MutationObserver((muts) => {
    if (busy) return;
    busy = true;
    try {
      for (const m of muts) {
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    } finally { busy = false; }
  });
  mo.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  observers.set(doc, mo);
}

// nativní dialogy a titulek okna
const invoke0 = ipcRenderer.invoke.bind(ipcRenderer);
ipcRenderer.invoke = (ch, ...args) => {
  if (ch === 'dialog' && LANG === 'cs' && args[1] && typeof args[1] === 'object') {
    const o = { ...args[1] };
    for (const k of ['title', 'message', 'detail', 'buttonLabel']) if (o[k]) o[k] = tr(o[k]);
    if (o.buttons) o.buttons = o.buttons.map(tr);
    if (o.filters) o.filters = o.filters.map((f) => ({ ...f, name: tr(f.name) }));
    args = [args[0], o, ...args.slice(2)];
  }
  return invoke0(ch, ...args);
};
let lastTitle = '';
const send0 = ipcRenderer.send.bind(ipcRenderer);
ipcRenderer.send = (ch, ...args) => {
  if (ch === 'setTitle') { lastTitle = args[0]; if (LANG === 'cs') args = [String(args[0]).replace(/ – Untitled(\s*\*?)$/, ' – Bez názvu$1')]; }
  return send0(ch, ...args);
};

function setLang(l) {
  LANG = l === 'cs' ? 'cs' : 'en';
  document.documentElement.lang = LANG;
  for (const d of [...docs]) {
    if (d !== document) { detach(d); continue; } // AI panel se po změně jazyka načte znovu a připojí se sám
    try { if (d.body) walk(d.body); } catch (e) { docs.delete(d); }
  }
  if (lastTitle) ipcRenderer.send('setTitle', lastTitle);
  send0('setLang', LANG);
}

module.exports = { setLang, observe, detach, lang: () => LANG, tr: (s) => (LANG === 'cs' ? tr(s) : s) };
