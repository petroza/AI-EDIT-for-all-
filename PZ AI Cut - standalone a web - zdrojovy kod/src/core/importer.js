'use strict';
// Import médií do projektu: ffprobe, u nepřehratelných formátů proxy na pozadí.
const fs = require('fs');
const media = require('./media');

const proxyJobs = new Map(); // mediaId -> Promise

async function importPath(project, p) {
  const ex = project.mediaByPath(p);
  if (ex && ex.duration) return ex;
  const info = await media.probe(p);
  const m = project.addMedia(info);
  ensureProxy(project, m);
  return m;
}

function ensureProxy(project, m) {
  if (m.playable || proxyJobs.has(m.id)) return proxyJobs.get(m.id) || Promise.resolve(m.path);
  if (m.proxy && fs.existsSync(m.proxy)) return Promise.resolve(m.proxy);
  m.proxyProgress = 0;
  const job = media.makeProxy(m, (p) => { m.proxyProgress = p; project.emit('proxy', m); })
    .then((file) => { m.proxy = file; m.proxyProgress = 1; project.emit('proxy', m); project.emit('media'); return file; })
    .catch((e) => { m.proxyError = e.message; project.emit('proxy', m); project.emit('media'); throw e; })
    .finally(() => proxyJobs.delete(m.id));
  proxyJobs.set(m.id, job);
  job.catch(() => {});
  return job;
}

/** Soubor, ze kterého se přehrává (originál, nebo proxy). */
function playPath(m) {
  if (m.playable) return m.path;
  if (m.proxy && fs.existsSync(m.proxy)) return m.proxy;
  return null;
}

async function importFiles(project, paths) {
  const res = [];
  for (const p of paths) {
    try { res.push(await importPath(project, p)); } catch (e) { res.push({ path: p, error: e.message }); }
  }
  return res;
}

/** Při otevření projektu ověří média (přesunutý soubor, chybějící proxy). */
function relink(project) {
  for (const m of project.media) {
    if (m.uncBlocked) { m.missing = true; continue; } // síťový server, kterému uživatel zatím nedůvěřoval – nesahat (bezpečnost S13)
    m.missing = !fs.existsSync(m.path);
    if (!m.missing) ensureProxy(project, m);
  }
}

module.exports = { importPath, importFiles, ensureProxy, playPath, relink };
