'use strict';
/* Malé náhrady modulů Node pro webovou verzi: path, url, http, net, child_process, crypto. */
const vfs = require('./vfs');

const norm = (p) => String(p || '').replace(/\\/g, '/');
const path = {
  sep: '/',
  join: (...a) => norm(a.filter((x) => x !== '' && x != null).join('/')).replace(/\/{2,}/g, '/'),
  resolve: (...a) => path.join(...a),
  dirname: (p) => { p = norm(p); const i = p.lastIndexOf('/'); return i > 0 ? p.slice(0, i) : (i === 0 ? '/' : '.'); },
  basename: (p, ext) => { p = norm(p); let b = p.slice(p.lastIndexOf('/') + 1); if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length); return b; },
  extname: (p) => { const b = path.basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; },
  isAbsolute: (p) => norm(p).startsWith('/'),
  relative: (a, b) => b,
  parse: (p) => ({ dir: path.dirname(p), base: path.basename(p), ext: path.extname(p), name: path.basename(p, path.extname(p)) }),
};
path.win32 = path; path.posix = path;

const url = { pathToFileURL: (p) => ({ href: vfs.urlFor(norm(p)) }), fileURLToPath: (u) => String(u) };

const notWeb = (what) => { throw new Error(`${what} is not available in the web version.`); };
function fakeReq() {
  const h = {};
  const req = { on: (ev, fn) => { h[ev] = fn; return req; }, destroy: () => {}, end: () => {} };
  setTimeout(() => h.error && h.error(new Error('offline')), 0);
  return req;
}
const http = { get: fakeReq, request: fakeReq, createServer: () => notWeb('HTTP server') };
const net = { createServer: () => ({ once: () => {}, listen: (p, h, cb) => { if (cb) setTimeout(cb, 0); }, close: (cb) => cb && cb() }) };
const childProcess = { spawn: () => notWeb('This tool'), execFile: () => notWeb('This tool'), exec: () => notWeb('This tool') };
const crypto = {
  randomUUID: () => (self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : String(Math.random()).slice(2)),
  createHash: () => { let s = ''; const o = { update: (d) => { s += String(d); return o; }, digest: () => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); } }; return o; },
};
module.exports = { path, url, http, net, childProcess, crypto };
