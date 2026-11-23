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
cfg.aiRoot = require('./airoot').resolveAiRoot(cfg.aiRoot, APP_ROOT);

function findTool(name) {
  const own = path.join(APP_ROOT, 'tools', 'ffmpeg', name + '.exe');
  if (cfg[name] && fs.existsSync(cfg[name])) return cfg[name];
  if (fs.existsSync(own)) return own;
  // přibalený ffmpeg v MY Premiere MCP
  if (cfg.aiRoot) {
    const ai = path.join(cfg.aiRoot, 'tools', 'ffmpeg', name + '.exe');
    if (fs.existsSync(ai)) return ai;
  }
  // PATH (Windows) a winget (Gyan.FFmpeg) – i po instalaci za běhu aplikace, kdy PATH procesu ještě nové složky nemá
  // (S14 Nováček: čerstvé PC bez ffmpeg → import končil anglickým „spawn ffprobe ENOENT“)
  const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
  for (const d of String(process.env.PATH || '').split(path.delimiter)) {
    if (d && isFile(path.join(d.replace(/^"|"$/g, ''), name + '.exe'))) return name; // z PATH
  }
  const la = process.env.LOCALAPPDATA;
  if (!la) return null;
  const extra = [path.join(la, 'Microsoft', 'WinGet', 'Links')];
  try {
    const pk = path.join(la, 'Microsoft', 'WinGet', 'Packages');
    for (const d of fs.readdirSync(pk)) {
      if (!/^Gyan\.FFmpeg/i.test(d)) continue;
      for (const v of fs.readdirSync(path.join(pk, d))) extra.push(path.join(pk, d, v, 'bin'));
    }
  } catch (e) { /* winget není */ }
  for (const d of extra) { const f = path.join(d, name + '.exe'); if (isFile(f)) return f; }
  return null;
}
const FFMPEG = findTool('ffmpeg') || 'ffmpeg';
const FFPROBE = findTool('ffprobe') || 'ffprobe';
// ffmpeg nenalezen při startu (null = není v PATH ani ve winget) – dotaz po instalaci viz run()
function ffmpegMissing() { return !findTool('ffmpeg') || !findTool('ffprobe'); }

function hashOf(p) {
  let st = { size: 0, mtimeMs: 0 };
  try { st = fs.statSync(p); } catch (e) {}
  return crypto.createHash('sha1').update(path.resolve(p).toLowerCase() + '|' + st.size + '|' + Math.round(st.mtimeMs)).digest('hex').slice(0, 16);
}

// ffmpeg nainstalovaný až za běhu (winget) se najde bez restartu aplikace
const lateTool = {};
function run(exe, args, opts = {}) {
  if ((exe === 'ffmpeg' || exe === 'ffprobe') && lateTool[exe]) exe = lateTool[exe];
  return new Promise((resolve, reject) => {
    const p = cp.spawn(exe, args, { windowsHide: true, cwd: opts.cwd });
    let out = Buffer.alloc(0), err = '';
    p.stdout.on('data', (d) => { if (opts.onStdout) opts.onStdout(d); else out = Buffer.concat([out, d]); });
    p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); if (opts.onStderr) opts.onStderr(String(d)); });
    let spawnFailed = false; // po ENOENT přijde i 'close' s kódem -4058 – nesmí předběhnout opakování s nalezeným ffmpeg
    p.on('error', (e) => {
      spawnFailed = true;
      const name = baseName(exe).replace(/\.exe$/i, '');
      if (e.code === 'ENOENT' && (name === 'ffmpeg' || name === 'ffprobe')) {
        const f = findTool(name);
        if (f && f !== name && f !== exe && !opts._retried) { lateTool[name] = f; run(f, args, { ...opts, _retried: true }).then(resolve, reject); return; }
        reject(new Error('ffmpeg is missing – without it videos cannot be opened or exported. Install it (Help → Install ffmpeg, or the command: winget install Gyan.FFmpeg) and try again.'));
        return;
      }
      reject(new Error(`${baseName(exe)}: ${e.message}`));
    });
    p.on('close', (code) => {
      if (spawnFailed) return;
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
  const STD = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];
  for (const k of STD) if (Math.abs(f - k) < 0.02) return k;
  // proměnná snímková frekvence (mobil: průměr 29,605) → nejbližší standardní do 4 % (formáty S12)
  const near = STD.reduce((b, k) => (Math.abs(f - k) < Math.abs(f - b) ? k : b), STD[0]);
  if (Math.abs(f - near) / near < 0.04) return near;
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
  // neštvercové pixely (HDV 1440×1080 SAR 4:3, anamorf): rozměr pro střih = zobrazovaný (formáty S12: obraz zmáčknutý)
  const sarM = v && /^(\d+):(\d+)$/.exec(v.sample_aspect_ratio || '');
  const sar = sarM && +sarM[1] > 0 && +sarM[2] > 0 ? +sarM[1] / +sarM[2] : 1;
  if (Math.abs(sar - 1) > 0.01 && sar > 0.2 && sar < 5) width = Math.round(width * sar / 2) * 2;
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
    // víc zvukových stop (kamera / MXF: 2× mono) – export i náhled je spojí do sterea (formáty S12: 2. stopa zmizela)
    audioStreams: (j.streams || []).filter((s) => s.codec_type === 'audio').length,
    // prokládaný obraz (1080i) – export i náhled odstraní prokládání (formáty S12: hřebeny)
    interlaced: !!(v && /^(tt|bb|tb|bt)$/.test(v.field_order || '')),
    // statický obrázek (PNG, JPG…): klip 5 s jako v Premiere, export a náhled ve smyčce (formáty S12: 1 snímek / pád)
    still: !!(v && /^(png|mjpeg|bmp|gif|webp|tiff|jpegls|ljpeg)$/.test(v.codec_name || '') && !(Number(v.nb_frames) > 1) && dur < 0.5),
  };
  if (info.still) { info.duration = 5; info.fps = 25; info.hasAudio = false; }
  info.playable = isPlayable(info);
  return info;
}

const PLAY_EXT = /\.(mp4|m4v|mov|webm|mp3|wav|m4a|aac|ogg|oga|flac)$/i;
function isPlayable(info) {
  if (!PLAY_EXT.test(info.path)) return false;
  if (info.path.length >= 250) return false; // dlouhá cesta: přehrávač ji nenačte, náhled přes proxy (zátěž S12)
  if (info.still || info.interlaced || (info.audioStreams >= 2 && info.audioChannels === 1)) return false; // náhled přes proxy
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
  const args = info.still ? ['-y', '-hide_banner', '-loop', '1', '-framerate', '25', '-t', String(info.duration || 5), '-i', info.path] : ['-y', '-hide_banner', '-i', info.path];
  // proxy v zobrazovaném rozměru (neštvercové pixely), bez prokládání, 2× mono jako stereo (formáty S12)
  const vf = `${info.interlaced ? 'bwdif=0:-1:0,' : ''}scale=${info.width && info.height ? `${info.width}:${info.height},scale=` : ''}-2:min(720\\,ih),setsar=1`;
  if (info.hasVideo) args.push('-map', '0:v:0', '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-g', '25');
  if (info.hasAudio && info.audioStreams >= 2 && info.audioChannels === 1) args.push('-filter_complex', '[0:a:0][0:a:1]amerge=inputs=2[pa]', '-map', '[pa]', '-c:a', 'aac', '-b:a', '160k', '-ac', '2');
  else if (info.hasAudio) args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', '160k', '-ac', '2');
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

module.exports = { CACHE, FFMPEG, FFPROBE, APP_ROOT, cfg, run, probe, makeProxy, thumbnail, waveform, WAVE_RATE, hashOf, isPlayable, ffmpegMissing, findTool };
