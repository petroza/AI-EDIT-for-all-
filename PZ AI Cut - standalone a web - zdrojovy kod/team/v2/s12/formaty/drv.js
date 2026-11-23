// Kolo S12 – Formáty a fps: pomůcky vyhodnocované v okně aplikace (require z eval přes cdp.js).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const OUT = APP + '/web/test-out/';

async function settle() {
  // výřez / úklid krajů běží asynchronně – počkat, až stavový řádek nic nedělá
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const st = (document.getElementById('status') || {}).textContent || '';
    if (!/Výřez|Crop|Úklid|Clean|Hledám|Import/i.test(st)) { if (i > 4) break; }
  }
}

function seqInfo(s) {
  if (!s) return null;
  const tr = (k) => s.tracks[k].map((t, ti) => t.clips.map((c) => ({ t: ti, st: +c.start.toFixed(4), in: +c.in.toFixed(4), out: +c.out.toFixed(4), fit: c.fit, scale: c.scale, hold: c.hold, holdIn: c.holdIn }))).flat();
  return { id: s.id, name: s.name, width: s.width, height: s.height, fps: s.fps, v: tr('video'), a: tr('audio') };
}

async function variant(file, pieces) {
  const app = TN.app, project = app.project;
  const t0 = Date.now();
  const r = await app.importPaths([file]);
  await sleep(300);
  const toastEl = document.getElementById('toast');
  const toast = toastEl && /show/.test(toastEl.className) ? toastEl.textContent : null;
  const m = r[0];
  if (!m || m.error) return { importError: m && m.error, toast, ms: Date.now() - t0 };
  const media = {};
  for (const k of ['name', 'duration', 'hasVideo', 'hasAudio', 'width', 'height', 'fps', 'vcodec', 'pixFmt', 'acodec', 'audioChannels', 'sampleRate', 'playable']) media[k] = m[k];
  project.activeSequenceId = null;
  let err = null;
  try {
    for (const [st, i, o] of pieces) app.dropMedia(m, i, o, st, false);
  } catch (e) { err = e.message; }
  await settle();
  return { media, toast, dropError: err, seq: seqInfo(app.seq()), ms: Date.now() - t0 };
}

async function exp(name, format, loudness, range) {
  const ex = require(APP + '/src/core/exporter');
  const t0 = Date.now();
  try {
    const r = await ex.exportSequence(TN.app.project, TN.app.seq(), { output: OUT + 'formaty-s12-' + name, range: range || 'all', burnCaptions: true, srtSidecar: false, encoder: 'libx264', format, loudness });
    return Object.assign(r, { ms: Date.now() - t0 });
  } catch (e) { return { error: e.message, ms: Date.now() - t0 }; }
}

async function proxyState(name) {
  const m = TN.app.project.media.find((x) => x.name === name);
  if (!m) return null;
  for (let i = 0; i < 120 && !m.playable && !m.proxy && !m.proxyError; i++) await sleep(500);
  return { playable: m.playable, proxy: m.proxy || null, proxyError: m.proxyError || null };
}

module.exports = { variant, exp, seqInfo, settle, proxyState, sleep };

// smíšená sekvence 25p: [soubor, in, out, start]
async function mixed(items) {
  const app = TN.app, project = app.project;
  const ms = [];
  for (const [f] of items) { const r = await app.importPaths([f]); ms.push(r[0]); }
  project.activeSequenceId = null;
  const errs = [];
  items.forEach(([f, i, o, st], k) => { try { app.dropMedia(ms[k], i, o, st, false); } catch (e) { errs.push(e.message); } });
  await settle();
  const s = app.seq();
  if (!s) return { errs, active: project.activeSequenceId, n: project.sequences.length, ms: ms.map((m) => m && (m.name || m.error)) };
  s.name = 'MIX25';
  return { errs, seq: seqInfo(s), media: ms.map((m) => ({ name: m.name, fps: m.fps, w: m.width, h: m.height })) };
}
async function expRange(name, format, loudness, a, b) {
  const s = TN.app.seq(); s.inPoint = a; s.outPoint = b;
  const r = await exp(name, format, loudness, 'inout');
  s.inPoint = null; s.outPoint = null;
  return r;
}
module.exports.mixed = mixed; module.exports.expRange = expRange;
