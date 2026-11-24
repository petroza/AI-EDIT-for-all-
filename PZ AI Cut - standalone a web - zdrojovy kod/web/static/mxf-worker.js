/* MXF ve webové verzi přes ffmpeg.wasm (prohlížeč MPEG-2 ani DNxHD neumí dekódovat ani kódovat):
 *  - import: MXF (XDCAM HD422 / MPEG-2, DNxHD/DNxHR, AVC-Intra, IMX…) → H.264 + AAC MP4, s ním pak web pracuje
 *    (přehrávání, přepis, výřez, export – jako desktop s proxy),
 *  - export: vyrenderovaný obraz (MP4) + zvuk (WAV 24 bit) → MXF OP1a XDCAM HD422 50 Mb/s nebo DNxHR HQ, 2× mono PCM.
 * Výstup ffmpeg jde rovnou do úložiště prohlížeče (OPFS, synchronní zápis) – ne do paměti: MXF 50 Mb/s má 3,7 GB za
 * 10 minut. Zdroj čte ffmpeg přímo ze souboru (WORKERFS). NIC se neposílá na server, z CDN se stahuje jen program ffmpeg
 * (~32 MB, jednou – pak z mezipaměti prohlížeče).
 * Zprávy: {op:'import', file, name} | {op:'encode', video, audio, fmt, dur, name} → {type:'stage'|'progress'|'log'|'done'|'error'} */
'use strict';
const VER = '0.12.10';
const BASE = self.crossOriginIsolated
  ? `https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@${VER}/dist/umd/`   // více vláken (SharedArrayBuffer)
  : `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VER}/dist/umd/`;     // jedno vlákno (stránka bez COOP/COEP)
const SR = 48000;

let core = null;
let logs = [];
let onLog = null;

async function blobURL(url, type, onBytes) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ffmpeg download failed (${r.status})`);
  const reader = r.body.getReader();
  const parts = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    if (onBytes) onBytes(got);
  }
  return URL.createObjectURL(new Blob(parts, { type }));
}

async function load() {
  if (core) return core;
  postMessage({ type: 'stage', stage: 'download', p: 0 });
  const coreURL = await blobURL(BASE + 'ffmpeg-core.js', 'text/javascript');
  // velikost z hlavičky je komprimovaná (CDN posílá brotli) – průběh podle známé velikosti jádra
  const wasmURL = await blobURL(BASE + 'ffmpeg-core.wasm', 'application/wasm', (g) => postMessage({ type: 'stage', stage: 'download', p: Math.min(1, g / 32718323), mb: Math.round(g / 1048576) }));
  const opts = { wasmURL };
  if (self.crossOriginIsolated) opts.workerURL = await blobURL(BASE + 'ffmpeg-core.worker.js', 'text/javascript');
  importScripts(coreURL);
  // stejný trik jako @ffmpeg/ffmpeg: adresy wasm a vláken v hash adresy hlavního skriptu (locateFile)
  core = await self.createFFmpegCore({ mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify(opts))}` });
  core.setLogger(({ message }) => { logs.push(message); if (logs.length > 4000) logs = logs.slice(-2000); if (onLog) onLog(message); postMessage({ type: 'log', message }); });
  return core;
}

function run(args) {
  core.setTimeout(-1);
  core.exec(...args);
  const ret = core.ret;
  core.reset();
  return ret;
}

const hms = (s) => { const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s || ''); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0; };
const XT = () => (self.crossOriginIsolated ? Math.max(1, Math.min(4, ((self.navigator && navigator.hardwareConcurrency) || 4) - 1)) : 1);
// vlákna: ffmpeg.wasm má pevný počet předpřipravených vláken – dekodér, filtry i kodér s „auto“ je vyčerpají a převod
// se zasekne hned po startu (ladění 2026-11-24) → dekodér a filtry 1 vlákno, kodér nejvýš 4
const IN_THREADS = ['-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1'];

/** Výstupní soubor ffmpeg zapisovaný rovnou do OPFS (synchronní přístup) – žádná kopie v paměti. */
async function opfsSink(dirName, fileName) {
  const root = await navigator.storage.getDirectory();
  const d = await root.getDirectoryHandle(dirName, { create: true });
  const fh = await d.getFileHandle(fileName, { create: true });
  const sah = await fh.createSyncAccessHandle();
  sah.truncate(0);
  const p = '/out-' + fileName;
  core.FS.writeFile(p, new Uint8Array(0));
  const node = core.FS.lookupPath(p).node;
  node.stream_ops = Object.assign({}, node.stream_ops, {
    // kopie (slice): paměť wasm je u více vláken SharedArrayBuffer
    write(stream, buffer, offset, length, position) { sah.write(buffer.slice(offset, offset + length), { at: position != null ? position : stream.position }); return length; },
    read(stream, buffer, offset, length, position) {
      const tmp = new Uint8Array(length);
      const n = sah.read(tmp, { at: position != null ? position : stream.position });
      buffer.set(tmp.subarray(0, n), offset);
      return n;
    },
    llseek(stream, offset, whence) {
      let pos = offset;
      if (whence === 1) pos += stream.position; else if (whence === 2) pos += sah.getSize();
      if (pos < 0) throw new core.FS.ErrnoError(28);
      return pos;
    },
  });
  return {
    path: p,
    close(keep) {
      let size = 0;
      try { size = sah.getSize(); sah.flush(); sah.close(); } catch (e) { /* */ }
      try { core.FS.unlink(p); } catch (e) { /* */ }
      if (!keep) d.removeEntry(fileName).catch(() => {});
      return size;
    },
  };
}

function mountInputs(files) {
  const dir = '/in';
  try { core.FS.mkdir(dir); } catch (e) { /* už je */ }
  core.FS.mount(core.FS.filesystems.WORKERFS, { files }, dir);
  return { dir, unmount: () => { try { core.FS.unmount(dir); } catch (e) { /* */ } } };
}
function progressBy(dur) {
  let last = 0;
  onLog = (m) => {
    const t = /time=(\d+:\d+:\d+(?:\.\d+)?)/.exec(m);
    if (t && dur) { const p = Math.min(1, hms(t[1]) / dur); if (p - last >= 0.01) { last = p; postMessage({ type: 'progress', p }); } }
  };
}
function failText(ret) {
  return logs.filter((l) => /error|invalid|not supported|unknown|no space|quota/i.test(l)).slice(-3).join(' | ') || `ffmpeg ended with code ${ret}`;
}

/** Co je v souboru – z výpisu ffmpeg -i (ffprobe v jádře nemusí být). */
function inspect(lines) {
  const txt = lines.join('\n');
  const dur = hms((/Duration: (\d+:\d+:\d+(?:\.\d+)?)/.exec(txt) || [])[1]);
  const v = /Stream #0:\d+[^:]*: Video: ([^\n]+)/.exec(txt);
  const audio = [];
  for (const m of txt.matchAll(/Stream #0:\d+[^:]*: Audio: ([^\n]+)/g)) {
    const ch = /\b(mono)\b/.test(m[1]) ? 1 : /\bstereo\b/.test(m[1]) ? 2 : +((/(\d+) channels/.exec(m[1]) || [])[1] || 2);
    audio.push(ch);
  }
  return { dur, video: v ? v[1] : null, interlaced: !!(v && /top first|bottom first|\btff\b|\bbff\b|interlaced/i.test(v[1])), audio };
}

async function importMxf({ file, name }) {
  const inp = mountInputs([file]);
  const src = `${inp.dir}/${file.name}`;
  let sink = null;
  try {
    logs = [];
    postMessage({ type: 'stage', stage: 'probe' });
    run(['-hide_banner', '-i', src]);
    const info = inspect(logs);
    if (!info.video && !info.audio.length) throw new Error('No video or audio found in the MXF file.');
    const args = ['-hide_banner', '-nostdin', '-y', ...IN_THREADS, '-i', src];
    // obraz: prokládaný (XDCAM 1080i50) bez hřebenu jako desktop (bwdif), šířka nejvýš 1920, čtvercové pixely
    if (info.video) {
      const vf = [info.interlaced ? 'bwdif=mode=0' : null, "scale='if(gt(iw*sar,1920),1920,trunc(iw*sar/2)*2)':-2", 'setsar=1', 'format=yuv420p'].filter(Boolean).join(',');
      args.push('-map', '0:v:0', '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-profile:v', 'high', '-g', '50', '-bf', '0',
        '-x264-params', `threads=${XT()}:lookahead-threads=1`);
    } else args.push('-vn');
    // zvuk: XDCAM má 4–8 mono stop – první dvě jako stereo (jako desktop), jinak první stopa na 2 kanály
    if (info.audio.length >= 2 && info.audio[0] === 1 && info.audio[1] === 1) args.push('-filter_complex', '[0:a:0][0:a:1]amerge=inputs=2[a]', '-map', '[a]');
    else if (info.audio.length) args.push('-map', '0:a:0');
    if (info.audio.length) args.push('-ac', '2', '-ar', String(SR), '-c:a', 'aac', '-b:a', '192k');
    else args.push('-an');
    sink = await opfsSink('pz-mxf', name);
    args.push('-dn', '-sn', '-f', 'mp4', sink.path);
    postMessage({ type: 'stage', stage: 'convert', p: 0, dur: info.dur });
    progressBy(info.dur);
    logs = [];
    const ret = run(args);
    onLog = null;
    if (ret !== 0) throw new Error(failText(ret));
    const size = sink.close(true); sink = null;
    postMessage({ type: 'done', name, size, info });
  } finally {
    onLog = null;
    if (sink) sink.close(false);
    inp.unmount();
  }
}

/** Export: obraz (MP4 z WebCodecs) + zvuk (WAV) → MXF OP1a pro TV, parametry stejné jako desktop (src/core/exporter.js). */
async function encodeMxf({ video, audio, fmt, dur, name }) {
  const inp = mountInputs(audio ? [video, audio] : [video]);
  let sink = null;
  try {
    const args = ['-hide_banner', '-nostdin', '-y', ...IN_THREADS, '-i', `${inp.dir}/${video.name}`];
    if (audio) args.push('-i', `${inp.dir}/${audio.name}`);
    else args.push('-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`); // MXF pro TV vždy se zvukem (2 tiché mono stopy)
    // MXF OP1a pro TV: každý kanál jako samostatná mono stopa, 24 bit
    args.push('-filter_complex', '[1:a]channelsplit=channel_layout=stereo[l][r]', '-map', '0:v:0', '-map', '[l]', '-map', '[r]');
    if (fmt === 'dnxhr') args.push('-c:v', 'dnxhd', '-profile:v', 'dnxhr_hq', '-pix_fmt', 'yuv422p');
    else {
      args.push('-c:v', 'mpeg2video', '-pix_fmt', 'yuv422p', '-b:v', '50M', '-minrate', '50M', '-maxrate', '50M', '-bufsize', '17825792', '-rc_init_occupancy', '17825792',
        '-g', '12', '-bf', '2', '-flags', '+cgop', '-sc_threshold', '1000000000', '-dc', '10', '-intra_vlc', '1', '-non_linear_quant', '1', '-qmin', '1', '-qmax', '12');
    }
    args.push('-threads', String(XT()), '-c:a', 'pcm_s24le', '-ar', String(SR), '-t', Number(dur).toFixed(4));
    sink = await opfsSink('pz-tmp', name);
    args.push('-f', 'mxf', sink.path);
    postMessage({ type: 'stage', stage: 'encode', p: 0 });
    progressBy(dur);
    logs = [];
    const ret = run(args);
    onLog = null;
    if (ret !== 0) throw new Error(failText(ret));
    const size = sink.close(true); sink = null;
    postMessage({ type: 'done', name, size });
  } finally {
    onLog = null;
    if (sink) sink.close(false);
    inp.unmount();
  }
}

self.onmessage = async ({ data }) => {
  try {
    await load();
    if (data.op === 'encode') await encodeMxf(data);
    else await importMxf(data);
  } catch (e) {
    onLog = null;
    postMessage({ type: 'error', message: String(e && e.message || e) });
  }
};
