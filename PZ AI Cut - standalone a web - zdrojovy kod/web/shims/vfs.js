'use strict';
/* Virtuální souborový systém webové verze. Prohlížeč nemá cesty k souborům – soubor, který uživatel vybere
 * (dialog, přetažení), dostane virtuální cestu /disk/<id>/<název>. Kód střihu (sdílený s desktopem) pak pracuje
 * s cestami jako dřív. Handle souborů (File System Access API, Chrome) se ukládá do IndexedDB, takže po
 * znovuotevření projektu stačí jedno kliknutí „Povolit přístup“ a média se načtou z disku uživatele.
 * NIC se neposílá na server – vše zůstává v prohlížeči a na disku uživatele. */

const files = new Map(); // cesta -> { file, handle, text, url }
const byKey = new Map(); // název|velikost|změna -> cesta (stejný soubor = stejná cesta)
let seq = 0;

function uid() { return Date.now().toString(36) + (seq++).toString(36); }
function keyOf(f) { return `${f.name}|${f.size}|${f.lastModified}`; }

function registerFile(file, handle) {
  const k = keyOf(file);
  if (byKey.has(k)) {
    const p = byKey.get(k), e = files.get(p);
    if (handle && !e.handle) { e.handle = handle; saveHandle(p, handle); }
    return p;
  }
  const p = `/disk/${uid()}/${file.name}`;
  files.set(p, { file, handle: handle || null });
  byKey.set(k, p);
  if (handle) saveHandle(p, handle);
  return p;
}
/** Soubor z dialogu (handle) – cestu lze uložit do projektu a příště obnovit. */
async function registerHandle(handle, wantText) {
  const file = await handle.getFile();
  const p = registerFile(file, handle);
  if (wantText) files.get(p).text = await file.text();
  return p;
}
/** Nový soubor pro zápis (Uložit jako / Export) – zatím prázdný. */
function registerSaveHandle(handle, name) {
  const p = `/disk/${uid()}/${name || handle.name}`;
  files.set(p, { file: null, handle });
  saveHandle(p, handle);
  return p;
}
function attachHandle(p, handle) { const e = files.get(p); if (e && handle) { e.handle = handle; saveHandle(p, handle); } }

function has(p) { const e = files.get(p); return !!(e && (e.file || e.text != null || e.handle)); }
function getFile(p) { const e = files.get(p); return e ? e.file : null; }
function getHandle(p) { const e = files.get(p); return e ? e.handle : null; }
function getText(p) { const e = files.get(p); return e ? e.text : undefined; }
function urlFor(p) {
  const e = files.get(p);
  if (!e) return p;
  if (!e.url) {
    if (e.file) e.url = URL.createObjectURL(e.file);
    else if (e.blob) e.url = URL.createObjectURL(e.blob);
    else return p;
  }
  return e.url;
}
/** Soubor v paměti (náhled, dočasný) – vrátí virtuální cestu. */
function putBlob(name, blob) {
  const p = `/mem/${uid()}/${name}`;
  files.set(p, { file: null, blob, handle: null });
  return p;
}
/** Pod cestou p podávat jiný soubor (MXF → převedené MP4); originál zůstane v e.orig, handle beze změny. */
function setFile(p, file, orig) {
  const e = files.get(p) || { handle: null };
  if (e.url) { try { URL.revokeObjectURL(e.url); } catch (x) { /* */ } e.url = null; }
  e.file = file;
  if (orig) e.orig = orig;
  files.set(p, e);
}
function getOrig(p) { const e = files.get(p); return e ? (e.orig || e.file) : null; }
function setText(p, text) {
  const e = files.get(p) || { file: null, handle: null };
  e.text = text;
  files.set(p, e);
}
function remove(p) { files.delete(p); }

/** Zápis na disk uživatele (přes handle). Zápisy do stejného souboru jdou za sebou. */
const writing = new Map();
function writeOut(p, data) {
  const e = files.get(p);
  if (!e || !e.handle) return Promise.resolve(false);
  const prev = writing.get(p) || Promise.resolve();
  const job = prev.then(async () => {
    if (e.handle.requestPermission) {
      const st = await e.handle.queryPermission({ mode: 'readwrite' });
      if (st !== 'granted' && (await e.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('No permission to write the file.');
    }
    const w = await e.handle.createWritable();
    await w.write(data);
    await w.close();
    return true;
  });
  writing.set(p, job.catch(() => {}));
  return job;
}

/* ---------- IndexedDB: handle souborů pro příští otevření projektu ---------- */
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('pz-ai-cut', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('handles');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function saveHandle(p, h) {
  try { const d = await db(); d.transaction('handles', 'readwrite').objectStore('handles').put(h, p); } catch (e) { /* bez IndexedDB */ }
}
async function loadHandle(p) {
  try {
    const d = await db();
    return await new Promise((res) => { const r = d.transaction('handles').objectStore('handles').get(p); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  } catch (e) { return null; }
}
/**
 * Obnoví přístup k souborům projektu. Vrátí { restored: [...cesty], needPermission: [...cesty], lost: [...cesty] }.
 * askUser = true jen z kliknutí uživatele (prohlížeč jinak oprávnění nedovolí).
 */
async function restore(paths, askUser) {
  const out = { restored: [], needPermission: [], lost: [] };
  for (const p of paths) {
    if (getFile(p)) { out.restored.push(p); continue; }
    const h = getHandle(p) || await loadHandle(p);
    if (!h) { out.lost.push(p); continue; }
    try {
      let st = await h.queryPermission({ mode: 'read' });
      if (st !== 'granted' && askUser) st = await h.requestPermission({ mode: 'read' });
      if (st !== 'granted') { files.set(p, { ...(files.get(p) || {}), file: null, handle: h }); out.needPermission.push(p); continue; }
      let file = await h.getFile();
      byKey.set(keyOf(file), p);
      // MXF: převedené MP4 z úložiště prohlížeče (jinak převést znovu – trvá, ale projekt se otevře celý)
      const mxf = require('../engine/mxf');
      if (mxf.isMxf(file)) { const orig = file; file = await mxf.toWeb(orig); files.set(p, { ...(files.get(p) || {}), file, orig, handle: h, url: null }); }
      else files.set(p, { ...(files.get(p) || {}), file, handle: h });
      out.restored.push(p);
    } catch (e) { out.lost.push(p); }
  }
  return out;
}

module.exports = {
  registerFile, registerHandle, registerSaveHandle, attachHandle, has, getFile, getHandle, getText, setText, setFile, getOrig,
  urlFor, putBlob, remove, writeOut, restore, loadHandle,
};
