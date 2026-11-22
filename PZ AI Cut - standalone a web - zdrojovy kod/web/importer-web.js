'use strict';
/* Webová náhrada src/core/importer.js: import z virtuálních cest, bez proxy (H.264 se přehrává přímo).
 * Po otevření projektu obnoví přístup k médiím z uložených handle (IndexedDB) – když prohlížeč chce
 * potvrzení, ukáže lištu „Povolit přístup k médiím“ (oprávnění smí vyžádat jen kliknutí uživatele). */
const vfs = require('./shims/vfs');
const media = require('./media-web');

async function importPath(project, p) {
  const ex = project.mediaByPath(p);
  if (ex && ex.duration && !ex.missing) return ex;
  const info = await media.probe(p);
  if (ex) { Object.assign(ex, info, { missing: false }); return ex; }
  return project.addMedia(info);
}
function ensureProxy(project, m) { return Promise.resolve(m.path); }
function playPath(m) { return m && !m.missing && vfs.getFile(m.path) ? m.path : null; }

async function importFiles(project, paths) {
  const res = [];
  for (const p of paths) {
    try { res.push(await importPath(project, p)); } catch (e) { res.push({ path: p, error: e.message }); }
  }
  return res;
}

let pending = null; // projekt čekající na oprávnění
function relink(project) {
  for (const m of project.media) m.missing = !vfs.getFile(m.path);
  const miss = project.media.filter((m) => m.missing);
  if (!miss.length) { hideBar(); return; }
  pending = project;
  restore(project, false);
}
async function restore(project, ask) {
  const miss = project.media.filter((m) => m.missing);
  const r = await vfs.restore(miss.map((m) => m.path), ask);
  for (const m of project.media) m.missing = !vfs.getFile(m.path);
  if (r.restored.length) { project.emit('media'); window.dispatchEvent(new CustomEvent('pz-media-restored')); }
  if (r.needPermission.length) showBar(r.needPermission.length, r.lost.length);
  else if (r.lost.length) showBar(0, r.lost.length);
  else hideBar();
}

function showBar(nPerm, nLost) {
  let bar = document.getElementById('relinkBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'relinkBar';
    bar.className = 'relink-bar';
    document.body.appendChild(bar);
  }
  bar.innerHTML = '';
  const msg = document.createElement('span');
  msg.textContent = nPerm
    ? `The project uses ${nPerm} media file(s) from your computer. Chrome needs your permission to read them again.`
    : `${nLost} media file(s) were not found – import them again (File → Import).`;
  bar.appendChild(msg);
  if (nPerm) {
    const b = document.createElement('button');
    b.className = 'primary';
    b.textContent = 'Allow access to media';
    b.onclick = () => { if (pending) restore(pending, true); };
    bar.appendChild(b);
  }
  const x = document.createElement('button');
  x.textContent = '×';
  x.onclick = hideBar;
  bar.appendChild(x);
}
function hideBar() { const bar = document.getElementById('relinkBar'); if (bar) bar.remove(); }

module.exports = { importPath, importFiles, ensureProxy, playPath, relink };
