'use strict';
/* MXF ve webové verzi: jednorázový převod na H.264 + AAC MP4 (static/mxf-worker.js, ffmpeg.wasm) uložený v úložišti
 * prohlížeče (OPFS, složka pz-mxf). Pod cestou MXF se pak všude podává převedené MP4 – přehrávání, průběh zvuku,
 * přepis, výřez i export fungují beze změny. Převody jdou po jednom (jeden worker, program ffmpeg se načte jednou).
 * Průběh: událost okna 'pz-mxf-progress' {name, stage, p}. */

const isMxf = (f) => !!f && /\.mxf$/i.test(f.name || '');

/** Jméno převodu podle zdroje (název, velikost, změna) – jiný soubor stejného jména se převede znovu. */
async function keyName(file) {
  const s = `${file.name}|${file.size}|${file.lastModified}|v1`;
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('') + '.mp4';
}
async function dir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('pz-mxf', { create: true });
}
/** Převedené MP4 z dřívějška, nebo null. */
async function cached(file) {
  try {
    const fh = await (await dir()).getFileHandle(await keyName(file));
    const f = await fh.getFile();
    return f.size > 0 ? f : null;
  } catch (e) { return null; }
}

let worker = null;
let chain = Promise.resolve();
function emit(name, stage, p, extra) {
  try { window.dispatchEvent(new CustomEvent('pz-mxf-progress', { detail: Object.assign({ name, stage, p }, extra || {}) })); } catch (e) { /* mimo okno */ }
}
function convertNow(file) {
  return new Promise(async (resolve, reject) => {
    const name = await keyName(file);
    if (!worker) worker = new Worker('mxf-worker.js');
    worker.onmessage = async ({ data: m }) => {
      if (m.type === 'stage') emit(file.name, m.stage, m.p || 0, { mb: m.mb });
      else if (m.type === 'progress') emit(file.name, 'convert', m.p);
      else if (m.type === 'log') { const L = (window.__pzMxfLog = window.__pzMxfLog || []); L.push(m.message); if (L.length > 80) L.splice(0, L.length - 80); }
      else if (m.type === 'error') { emit(file.name, 'error', 0); reject(new Error(`${file.name}: MXF conversion failed – ${m.message}`)); }
      else if (m.type === 'done') {
        emit(file.name, 'done', 1);
        try { resolve(await (await (await dir()).getFileHandle(m.name)).getFile()); } catch (e) { reject(e); }
      }
    };
    worker.onerror = (e) => { worker = null; reject(new Error(`${file.name}: MXF conversion failed – ${e.message || 'worker error'}`)); };
    worker.postMessage({ file, name });
  });
}
/** MP4 pro daný MXF: z úložiště, jinak převod (po jednom). */
async function toWeb(file) {
  const c = await cached(file);
  if (c) return c;
  if (!navigator.storage || !navigator.storage.getDirectory) throw new Error(`${file.name}: this browser cannot convert MXF – use Chrome or Edge.`);
  try { if (navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* jen žádost */ }
  const job = chain.then(() => cached(file)).then((c2) => c2 || convertNow(file));
  chain = job.catch(() => {});
  return job;
}

module.exports = { isMxf, toWeb, cached };
