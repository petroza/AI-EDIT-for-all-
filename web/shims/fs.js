'use strict';
/* Náhrada modulu fs pro webovou verzi (synchronní API jako v Node, aby šel sdílený kód beze změn):
 *   /appdata/...  -> localStorage (nastavení, automatická záloha projektu)
 *   /disk/...     -> soubory uživatele (vfs; zápis se asynchronně propíše na disk přes File System Access API)
 *   ostatní       -> paměť (dočasné soubory) */
const vfs = require('./vfs');

const mem = new Map();
const LS = 'pzfs:';
const isApp = (p) => /^\/appdata\//.test(norm(p));
const isDisk = (p) => /^\/(disk|mem)\//.test(norm(p));
function norm(p) { return String(p || '').replace(/\\/g, '/'); }
function enoent(p) { const e = new Error(`ENOENT: no such file or directory, '${p}'`); e.code = 'ENOENT'; return e; }

function readFileSync(p, enc) {
  p = norm(p);
  let v;
  if (isApp(p)) { try { v = localStorage.getItem(LS + p); } catch (e) { v = null; } if (v == null) throw enoent(p); }
  else if (isDisk(p)) { v = vfs.getText(p); if (v === undefined) throw enoent(p); }
  else { if (!mem.has(p)) throw enoent(p); v = mem.get(p); }
  return enc ? String(v) : v;
}
function toText(data) {
  if (typeof data === 'string') return data;
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);
  return String(data);
}
function writeFileSync(p, data) {
  p = norm(p);
  if (isApp(p)) {
    try { localStorage.setItem(LS + p, toText(data)); } catch (e) { console.warn('localStorage', e.message); }
  } else if (isDisk(p)) {
    if (typeof data === 'string') vfs.setText(p, data);
    vfs.writeOut(p, data).catch((e) => window.dispatchEvent(new CustomEvent('pz-write-error', { detail: e.message })));
  } else mem.set(p, data);
}
function existsSync(p) {
  p = norm(p);
  if (isApp(p)) { try { return localStorage.getItem(LS + p) != null; } catch (e) { return false; } }
  if (isDisk(p)) return vfs.has(p);
  return mem.has(p);
}
function unlinkSync(p) {
  p = norm(p);
  if (isApp(p)) { try { localStorage.removeItem(LS + p); } catch (e) {} } else if (isDisk(p)) vfs.remove(p); else mem.delete(p);
}
function renameSync(a, b) {
  const v = readFileSync(a, 'utf8');
  writeFileSync(b, v);
  if (norm(a) !== norm(b)) unlinkSync(a);
}
function statSync(p) {
  p = norm(p);
  const f = vfs.getFile(p);
  if (f) return { size: f.size, mtimeMs: f.lastModified, isFile: () => true, isDirectory: () => false };
  if (!existsSync(p)) throw enoent(p);
  return { size: String(readFileSync(p, 'utf8')).length, mtimeMs: Date.now(), isFile: () => true, isDirectory: () => false };
}
const noop = () => {};
module.exports = {
  readFileSync, writeFileSync, existsSync, unlinkSync, renameSync, statSync,
  mkdirSync: noop, readdirSync: () => [], copyFileSync: (a, b) => writeFileSync(b, readFileSync(a, 'utf8')),
  promises: { readFile: async (p, e) => readFileSync(p, e), writeFile: async (p, d) => writeFileSync(p, d) },
};
