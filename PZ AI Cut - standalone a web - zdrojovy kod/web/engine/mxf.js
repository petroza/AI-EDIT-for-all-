'use strict';
/* MXF ve webové verzi (static/mxf-worker.js, ffmpeg.wasm):
 *  - import: jednorázový převod na H.264 + AAC MP4 uložený v úložišti prohlížeče (OPFS, složka pz-mxf). Pod cestou MXF
 *    se pak všude podává převedené MP4 – přehrávání, průběh zvuku, přepis, výřez i export fungují beze změny,
 *  - export: obraz + zvuk vyrenderované webem → MXF OP1a XDCAM HD422 / DNxHR HQ (dočasně v OPFS pz-tmp).
 * Úlohy jdou po jedné (jeden worker, program ffmpeg se načte jednou). Průběh: událost okna 'pz-mxf-progress'. */

const isMxf = (f) => !!f && /\.mxf$/i.test(f.name || '');

/** Jméno převodu podle zdroje (název, velikost, změna) – jiný soubor stejného jména se převede znovu. */
async function keyName(file) {
  const s = `${file.name}|${file.size}|${file.lastModified}|v1`;
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('') + '.mp4';
}
async function dir(name) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(name || 'pz-mxf', { create: true });
}
/** Převedené MP4 z dřívějška, nebo null. */
async function cached(file) {
  try {
    const f = await (await (await dir()).getFileHandle(await keyName(file))).getFile();
    return f.size > 0 ? f : null;
  } catch (e) { return null; }
}
function supported() { return !!(navigator.storage && navigator.storage.getDirectory); }

let worker = null;
let chain = Promise.resolve();
let current = null; // reject běžící úlohy (zrušení exportu)
/** Zrušit běžící převod / export: worker se ukončí (příště se ffmpeg načte znovu – z mezipaměti prohlížeče). */
function abort() {
  if (worker) { try { worker.terminate(); } catch (e) { /* */ } worker = null; }
  if (current) { const r = current; current = null; r(new Error('Export cancelled.')); }
}
function emit(name, stage, p, extra) {
  try { window.dispatchEvent(new CustomEvent('pz-mxf-progress', { detail: Object.assign({ name, stage, p }, extra || {}) })); } catch (e) { /* mimo okno */ }
}
/** Jedna úloha workeru (po jedné). onProgress(stage, p). Vrátí zprávu 'done'. */
function job(msg, label, onProgress) {
  const run = () => new Promise((resolve, reject) => {
    current = reject;
    if (!worker) worker = new Worker('mxf-worker.js');
    worker.onmessage = ({ data: m }) => {
      if (m.type === 'stage') { emit(label, m.stage, m.p || 0, { mb: m.mb }); if (onProgress) onProgress(m.stage, m.p || 0, m.mb); }
      else if (m.type === 'progress') { emit(label, msg.op === 'encode' ? 'encode' : 'convert', m.p); if (onProgress) onProgress(msg.op === 'encode' ? 'encode' : 'convert', m.p); }
      else if (m.type === 'log') { const L = (window.__pzMxfLog = window.__pzMxfLog || []); L.push(m.message); if (L.length > 80) L.splice(0, L.length - 80); }
      else if (m.type === 'error') { emit(label, 'error', 0); reject(new Error(m.message)); }
      else if (m.type === 'done') { emit(label, 'done', 1); resolve(m); }
    };
    worker.onerror = (e) => { worker = null; reject(new Error(e.message || 'worker error')); };
    worker.postMessage(msg);
  });
  const j = chain.then(run);
  chain = j.catch(() => {});
  return j;
}

/** MP4 pro daný MXF: z úložiště, jinak převod. */
async function toWeb(file) {
  const c = await cached(file);
  if (c) return c;
  if (!supported()) throw new Error(`${file.name}: this browser cannot convert MXF – use Chrome or Edge.`);
  try { if (navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* jen žádost */ }
  const name = await keyName(file);
  try {
    await job({ op: 'import', file, name }, file.name);
  } catch (e) { throw new Error(`${file.name}: MXF conversion failed – ${e.message}`); }
  return (await (await dir()).getFileHandle(name)).getFile();
}

/* ---------- export ---------- */
/** Dočasný soubor v OPFS pro mezivýsledek exportu: { name, writable(), file(), remove() }. */
async function tempFile(ext) {
  const d = await dir('pz-tmp');
  const name = 'x-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + ext;
  const fh = await d.getFileHandle(name, { create: true });
  return {
    name,
    writable: () => fh.createWritable(),
    file: () => fh.getFile(),
    remove: () => d.removeEntry(name).catch(() => {}),
  };
}
/** Staré mezivýsledky (zrušený / spadlý export) – smazat při startu. */
async function cleanTemp() {
  try {
    const d = await dir('pz-tmp');
    for await (const [n] of d.entries()) await d.removeEntry(n).catch(() => {});
  } catch (e) { /* bez OPFS */ }
}
/** Obraz (MP4) + zvuk (WAV nebo null) → MXF v OPFS. Vrátí { file, remove }. */
async function encodeMxf({ video, audio, fmt, dur, onProgress }) {
  if (!supported()) throw new Error('This browser cannot create MXF – use Chrome or Edge.');
  const out = await tempFile('mxf');
  try {
    await job({ op: 'encode', video, audio, fmt, dur, name: out.name }, 'MXF', onProgress);
  } catch (e) { out.remove(); throw new Error('MXF export failed – ' + e.message); }
  return { file: await out.file(), remove: out.remove };
}

module.exports = { isMxf, toWeb, cached, tempFile, cleanTemp, encodeMxf, abort };
