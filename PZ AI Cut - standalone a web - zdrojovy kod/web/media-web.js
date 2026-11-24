'use strict';
/* Webová náhrada src/core/media.js: místo ffmpeg/ffprobe čte soubory přímo v prohlížeči (engine/mp4.js,
 * WebCodecs). Podporuje H.264 + AAC v MP4/MOV/M4V (a M4A jen zvuk) – víc webová verze nepotřebuje. */
const vfs = require('./shims/vfs');
const { openMp4 } = require('./engine/mp4');
const { audioPeaks } = require('./engine/decode');

const WEB = true;
const cfg = { aiRoot: '', bridgePort: 0, exportDir: '', videoEncoder: 'webcodecs', crf: 18 };
const APP_ROOT = '/app';
const FFMPEG = '';
const FFPROBE = '';
const baseName = (p) => String(p).replace(/\\/g, '/').split('/').pop();

function fileOf(p) {
  const f = vfs.getFile(p);
  if (!f) { const e = new Error('Media file is not available – allow access to it (Relink).'); e.code = 'ENOENT'; throw e; }
  return f;
}

async function probe(p) {
  let file = fileOf(p);
  const mxf = require('./engine/mxf');
  // MXF (XDCAM, DNxHR, AVC-Intra) – jednou převést na H.264 MP4 a dál podávat převod (engine/mxf.js)
  if (mxf.isMxf(file)) { const conv = await mxf.toWeb(file); vfs.setFile(p, conv, file); file = conv; }
  else if (mxf.isMxf(vfs.getOrig(p))) { /* už převedené */ }
  else if (!/\.(mp4|m4v|mov|m4a)$/i.test(file.name)) throw new Error(`${file.name}: the web version supports MP4 / MOV with H.264 video and MXF.`);
  const mp = await openMp4(file);
  const v = mp.video, a = mp.audio;
  if (v && v.codecName !== 'h264') throw new Error(`${file.name}: video codec ${v.codecName.toUpperCase()} is not supported – only H.264.`);
  let width = v ? v.width : 0, height = v ? v.height : 0;
  if (v && (v.rotation === 90 || v.rotation === 270)) [width, height] = [height, width];
  const src = vfs.getOrig(p) || file; // u MXF jméno a velikost originálu, ne převodu
  const info = {
    path: p,
    name: src.name,
    duration: mp.duration,
    hasVideo: !!v,
    hasAudio: !!(a && a.codecName === 'aac'),
    width, height,
    fps: v ? v.fps : 25,
    vcodec: v ? 'h264' : null,
    pixFmt: null,
    acodec: a ? a.codecName : null,
    audioChannels: a ? a.channels : 0,
    sampleRate: a ? a.sampleRate : 0,
    size: src.size,
    rotation: v ? v.rotation : 0,
  };
  if (mxf.isMxf(src)) info.convertedFrom = 'mxf';
  info.playable = true;
  return info;
}
function isPlayable() { return true; }

const waveJobs = new Map();
function waveform(p) {
  if (!waveJobs.has(p)) {
    const job = Promise.resolve().then(() => audioPeaks(fileOf(p))).catch((e) => { waveJobs.delete(p); throw e; });
    waveJobs.set(p, job);
  }
  return waveJobs.get(p);
}

/** Snímek ze souboru v čase t do canvasu (přes <video>, prohlížeč sám použije otočení z mobilu). */
function grabFrame(p, t, maxW) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    v.src = vfs.urlFor(p);
    const fail = () => { cleanup(); reject(new Error('Cannot read a frame from ' + baseName(p))); };
    const cleanup = () => { v.removeAttribute('src'); v.load(); };
    v.onerror = fail;
    v.onloadedmetadata = () => { v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05)); };
    v.onseeked = () => {
      const k = maxW ? Math.min(1, maxW / v.videoWidth) : 1;
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      cleanup();
      resolve(c);
    };
    setTimeout(() => { if (!v.videoWidth) fail(); }, 20000);
  });
}
async function thumbnail(p, t) {
  const c = await grabFrame(p, t, 320);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  return vfs.putBlob(baseName(p) + '.jpg', blob);
}
/** Export Frame: plné rozlišení do PNG na disk uživatele. */
async function exportFramePng(p, t, outPath) {
  const c = await grabFrame(p, t, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  await vfs.writeOut(outPath, blob);
}

function makeProxy() { return Promise.reject(new Error('Proxies are not needed in the web version.')); }
function run() { return Promise.reject(new Error('ffmpeg is not available in the web version.')); }
function findTool() { return ''; }

module.exports = { WEB, cfg, APP_ROOT, FFMPEG, FFPROBE, probe, isPlayable, waveform, thumbnail, exportFramePng, makeProxy, run, findTool, CACHE: '/mem/cache' };
