'use strict';
// Média přes ffmpeg/ffprobe: parametry souboru, proxy (H.264 pro přehrávání), náhledy, vlnový průběh zvuku.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { baseName } = require('./util');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const CACHE = path.join(process.env.LOCALAPPDATA || path.join(APP_ROOT, 'cache'), 'TN_strihatoko', 'cache');
for (const d of ['proxy', 'thumbs', 'wave', 'export', 'tmp']) fs.mkdirSync(path.join(CACHE, d), { recursive: true });

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'config.json'), 'utf8')); } catch (e) { /* výchozí */ }

function findTool(name) {
  const own = path.join(APP_ROOT, 'tools', 'ffmpeg', name + '.exe');
  if (cfg[name] && fs.existsSync(cfg[name])) return cfg[name];
  if (fs.existsSync(own)) return own;
  // přibalený ffmpeg v MY Premiere MCP
  if (cfg.aiRoot) {
    const ai = path.join(cfg.aiRoot, 'tools', 'ffmpeg', name + '.exe');
    if (fs.existsSync(ai)) return ai;
  }
  return name; // z PATH
}
const FFMPEG = findTool('ffmpeg');
const FFPROBE = findTool('ffprobe');

function hashOf(p) {
  let st = { size: 0, mtimeMs: 0 };
  try { st = fs.statSync(p); } catch (e) {}
  return crypto.createHash('sha1').update(path.resolve(p).toLowerCase() + '|' + st.size + '|' + Math.round(st.mtimeMs)).digest('hex').slice(0, 16);
}

function run(exe, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = cp.spawn(exe, args, { windowsHide: true, cwd: opts.cwd });
    let out = Buffer.alloc(0), err = '';
    p.stdout.on('data', (d) => { if (opts.onStdout) opts.onStdout(d); else out = Buffer.concat([out, d]); });
    p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); if (opts.onStderr) opts.onStderr(String(d)); });
    p.on('error', (e) => reject(new Error(`${baseName(exe)}: ${e.message} – is ffmpeg installed? (config.json → ffmpeg)`)));
    p.on('close', (code) => {
      if (code === 0 || opts.allowFail) resolve({ out, err, code });
      else reject(new Error(`${baseName(exe)} exited with code ${code}: ${err.split('\n').filter(Boolean).slice(-3).join(' | ')}`));
    });
    if (opts.proc) opts.proc(p);
  });
}

function fpsOf(s) {
  const r = s && (s.avg_frame_rate !== '0/0' ? s.avg_frame_rate : s.r_frame_rate);
  if (!r) return 25;
  const [a, b] = r.split('/').map(Number);
  const f = b ? a / b : a;
  if (!isFinite(f) || f <= 0 || f > 240) return 25;
  // běžné hodnoty zaokrouhlit (29.97 apod. nechat)
  for (const k of [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60]) if (Math.abs(f - k) < 0.02) return k;
  return Math.round(f * 1000) / 1000;
}

async function probe(p) {
  if (!fs.existsSync(p)) throw new Error('File not found: ' + p);
  const { out } = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', p]);
  const j = JSON.parse(String(out));
  const v = (j.streams || []).find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  const dur = Number(j.format && j.format.duration) || Number(v && v.duration) || Number(a && a.duration) || 0;
  let width = v ? v.width : 0, height = v ? v.height : 0;
  const rot = v && ((v.tags && Number(v.tags.rotate)) || ((v.side_data_list || []).find((x) => x.rotation !== undefined) || {}).rotation || 0);
  if (Math.abs(rot) === 90 || Math.abs(rot) === 270) [width, height] = [height, width];
  const info = {
    path: p,
    name: baseName(p),
    duration: dur,
    hasVideo: !!v,
    hasAudio: !!a,
    width, height,
    fps: v ? fpsOf(v) : 25,
    vcodec: v ? v.codec_name : null,
    pixFmt: v ? v.pix_fmt : null,
    acodec: a ? a.codec_name : null,
    audioChannels: a ? a.channels : 0,
    sampleRate: a ? Number(a.sample_rate) : 0,
    size: Number(j.format && j.format.size) || 0,
  };
  info.playable = isPlayable(info);
  return info;
}

const PLAY_EXT = /\.(mp4|m4v|mov|webm|mp3|wav|m4a|aac|ogg|oga|flac)$/i;
function isPlayable(info) {
  if (!PLAY_EXT.test(info.path)) return false;
  if (info.hasVideo) {
    if (!['h264', 'vp8', 'vp9', 'av1'].includes(info.vcodec)) return false;
    if (info.pixFmt && /10|12|422|444/.test(info.pixFmt) && info.vcodec === 'h264') return false;
  }
  if (info.hasAudio && !['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le'].includes(info.acodec)) return false;
  return true;
}

/** Proxy H.264 720p pro přehrávání (export vždy z originálu). */
async function makeProxy(info, onProgress) {
  const out = path.join(CACHE, 'proxy', hashOf(info.path) + '.mp4');
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) return out;
  const tmp = out + '.part.mp4';
  const args = ['-y', '-hide_banner', '-i', info.path];
  if (info.hasVideo) args.push('-map', '0:v:0', '-vf', 'scale=-2:min(720\\,ih)', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-g', '25');
  if (info.hasAudio) args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', '160k', '-ac', '2');
  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', tmp);
  await run(FFMPEG, args, {
    onStdout: (d) => {
      const m = String(d).match(/out_time_ms=(\d+)/);
      if (m && onProgress && info.duration) onProgress(Math.min(1, Number(m[1]) / 1e6 / info.duration));
    },
  });
  fs.renameSync(tmp, out);
  return out;
}

async function thumbnail(p, t, w = 192) {
  const out = path.join(CACHE, 'thumbs', `${hashOf(p)}_${Math.round(t * 10)}_${w}.jpg`);
  if (fs.existsSync(out)) return out;
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, t)), '-i', p, '-frames:v', '1',
    '-vf', `scale=${w}:-2`, '-q:v', '4', out]);
  return out;
}

const WAVE_RATE = 100; // vrcholů za sekundu
/** Vlnový průběh: Uint8Array vrcholů (0–255), WAVE_RATE na sekundu. */
async function waveform(p) {
  const out = path.join(CACHE, 'wave', hashOf(p) + '.bin');
  if (fs.existsSync(out)) return new Uint8Array(fs.readFileSync(out));
  const SR = 8000, per = SR / WAVE_RATE;
  const peaks = [];
  let cur = 0, n = 0, carry = null;
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', p, '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', 'pipe:1'], {
    onStdout: (d) => {
      let buf = carry ? Buffer.concat([carry, d]) : d;
      const even = buf.length - (buf.length % 2);
      carry = even < buf.length ? buf.slice(even) : null;
      for (let i = 0; i < even; i += 2) {
        const v = Math.abs(buf.readInt16LE(i));
        if (v > cur) cur = v;
        if (++n >= per) { peaks.push(cur); cur = 0; n = 0; }
      }
    },
  });
  if (n) peaks.push(cur);
  // logaritmické měřítko jako v Premiere (tiché pasáže viditelné)
  const arr = new Uint8Array(peaks.length);
  for (let i = 0; i < peaks.length; i++) {
    const db = 20 * Math.log10(Math.max(1, peaks[i]) / 32768);
    arr[i] = Math.max(0, Math.min(255, Math.round((db + 60) / 60 * 255)));
  }
  fs.writeFileSync(out, Buffer.from(arr));
  return arr;
}

module.exports = { CACHE, FFMPEG, FFPROBE, APP_ROOT, cfg, run, probe, makeProxy, thumbnail, waveform, WAVE_RATE, hashOf, isPlayable };
