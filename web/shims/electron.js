'use strict';
/* Náhrada modulu electron pro webovou verzi: ipcRenderer (dialogy přes File System Access API Chrome,
 * titulek okna, příkazy z menu) a webUtils.getPathForFile (virtuální cesta souboru). */
const vfs = require('./vfs');
const { path } = require('./node-basics');

const listeners = {};
const PROJECT_EXTS = ['pzcut', 'tnproj'];

function pickerTypes(filters) {
  const types = [];
  for (const f of filters || []) {
    const ext = (f.extensions || []).filter((e) => e !== '*').map((e) => '.' + e);
    // application/octet-stream by Chrome rozšířil o .com/.exe/.bin – projekt má vlastní typ, média video/audio
    const mime = ext.every((e) => PROJECT_EXTS.includes(e.slice(1))) ? 'application/x-pz-ai-cut' : 'application/octet-stream';
    if (ext.length) types.push({ description: f.name, accept: { [mime]: ext } });
  }
  return types;
}
function startIn(p) {
  const s = String(p || '').toLowerCase();
  if (/pictures/.test(s)) return 'pictures';
  if (/videos/.test(s)) return 'videos';
  if (/documents/.test(s)) return 'documents';
  return undefined;
}

/** Jednoduchá otázka s tlačítky (místo nativního okna). Vrátí index tlačítka. */
function askButtons(opts) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'web-ask';
    const buttons = opts.buttons && opts.buttons.length ? opts.buttons : ['OK'];
    ov.innerHTML = `<div class="web-ask-box"><div class="web-ask-msg"></div><div class="web-ask-det"></div><div class="web-ask-btns"></div></div>`;
    ov.querySelector('.web-ask-msg').textContent = opts.message || '';
    ov.querySelector('.web-ask-det').textContent = opts.detail || '';
    const bar = ov.querySelector('.web-ask-btns');
    buttons.forEach((b, i) => {
      const el = document.createElement('button');
      el.textContent = b;
      if (i === (opts.defaultId || 0)) el.className = 'primary';
      el.onclick = () => { ov.remove(); resolve(i); };
      bar.appendChild(el);
    });
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { ov.remove(); resolve(opts.cancelId != null ? opts.cancelId : buttons.length - 1); }
    });
    document.body.appendChild(ov);
    const def = bar.children[opts.defaultId || 0];
    if (def) def.focus();
  });
}

async function dialog(kind, opts = {}) {
  try {
    if (kind === 'open') {
      if (!window.showOpenFilePicker) throw new Error('This browser cannot open files – use Google Chrome.');
      const multiple = (opts.properties || []).includes('multiSelections');
      const exts = (opts.filters || []).flatMap((f) => f.extensions || []);
      const wantText = exts.some((e) => PROJECT_EXTS.includes(e));
      const hs = await window.showOpenFilePicker({ multiple, types: pickerTypes(opts.filters), excludeAcceptAllOption: false, startIn: startIn(opts.defaultPath) });
      const filePaths = [];
      for (const h of hs) filePaths.push(await vfs.registerHandle(h, wantText));
      return { canceled: false, filePaths };
    }
    if (kind === 'save') {
      if (!window.showSaveFilePicker) throw new Error('This browser cannot save files – use Google Chrome.');
      const name = path.basename(opts.defaultPath || 'Untitled');
      const h = await window.showSaveFilePicker({ suggestedName: name, types: pickerTypes(opts.filters), startIn: startIn(opts.defaultPath) });
      return { canceled: false, filePath: vfs.registerSaveHandle(h, h.name) };
    }
    if (kind === 'message') return { response: await askButtons(opts) };
  } catch (e) {
    if (e && e.name === 'AbortError') return { canceled: true, filePaths: [], filePath: '' };
    throw e;
  }
  return null;
}

const ipcRenderer = {
  on(ch, fn) { (listeners[ch] = listeners[ch] || []).push(fn); },
  emit(ch, ...a) { (listeners[ch] || []).forEach((f) => f({}, ...a)); },
  send(ch, ...a) {
    if (ch === 'setTitle') document.title = String(a[0] || '').replace(/^PZ AI Cut Standalone/, 'PZ AI Cut Web');
    else if (ch === 'closeNow') window.__pzForceClose = true;
    else if (ch === 'setLang' && window.__pzMenu) window.__pzMenu.render();
  },
  async invoke(ch, ...a) {
    if (ch === 'dialog') return dialog(a[0], a[1]);
    if (ch === 'reveal' || ch === 'openPath') {
      window.dispatchEvent(new CustomEvent('pz-reveal', { detail: a[0] }));
      return null;
    }
    return null;
  },
};
const webUtils = { getPathForFile: (f) => vfs.registerFile(f) };
module.exports = { ipcRenderer, webUtils };
