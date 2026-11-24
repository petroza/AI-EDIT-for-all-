/* Převod MXF (XDCAM HD422 / MPEG-2, DNxHD/DNxHR, AVC-Intra, IMX…) na H.264 + AAC MP4 přímo v prohlížeči – ffmpeg.wasm.
 * Prohlížeč MPEG-2 ani DNxHD neumí dekódovat (WebCodecs jen H.264/VP9/AV1), takže webová verze MXF jednou převede
 * a dál pracuje s MP4 (přehrávání, přepis, výřez, export – stejně jako desktop s proxy). Výsledek jde rovnou do
 * úložiště prohlížeče (OPFS), příště se nepřevádí. NIC se neposílá na server: zdroj čte ffmpeg přímo ze souboru
 * (WORKERFS), z CDN se stahuje jen program ffmpeg (~32 MB, jednou – pak z mezipaměti prohlížeče).
 * Zprávy: {file, name} → {type:'stage'|'progress'|'log'|'done'|'error', …} */
'use strict';
const VER = '0.12.10';
const BASE = self.crossOriginIsolated
  ? `https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@${VER}/dist/umd/`   // více vláken (SharedArrayBuffer)
  : `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VER}/dist/umd/`;     // jedno vlákno (stránka bez COOP/COEP)

let core = null;
let logs = [];
let onLog = null;

async function blobURL(url, type, onBytes) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ffmpeg download failed (${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  const reader = r.body.getReader();
  const parts = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    if (onBytes) onBytes(got, total);
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
  return {
    dur,
    video: v ? v[1] : null,
    interlaced: !!(v && /top first|bottom first|\btff\b|\bbff\b|interlaced/i.test(v[1])),
    audio,
  };
}

self.onmessage = async ({ data }) => {
  const { file, name } = data;
  try {
    await load();
    const dir = '/in';
    try { core.FS.mkdir(dir); } catch (e) { /* už je */ }
    core.FS.mount(core.FS.filesystems.WORKERFS, { files: [file] }, dir);
    const src = `${dir}/${file.name}`;
    logs = [];
    postMessage({ type: 'stage', stage: 'probe' });
    run(['-hide_banner', '-i', src]);
    const info = inspect(logs);
    if (!info.video && !info.audio.length) throw new Error('No video or audio found in the MXF file.');
    // vlákna: ffmpeg.wasm má pevný počet předpřipravených vláken – dekodér, filtry i x264 s „auto“ je vyčerpají a převod
    // se zasekne hned po startu (ladění 2026-11-24) → dekodér a filtry 1 vlákno, x264 nejvýš 4
    const args = ['-hide_banner', '-nostdin', '-y', '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1', '-i', src];
    // obraz: prokládaný (XDCAM 1080i50) bez hřebenu jako desktop (bwdif), šířka nejvýš 1920, čtvercové pixely
    if (info.video) {
      const vf = [info.interlaced ? 'bwdif=mode=0' : null, "scale='if(gt(iw*sar,1920),1920,trunc(iw*sar/2)*2)':-2", 'setsar=1', 'format=yuv420p'].filter(Boolean).join(',');
      args.push('-map', '0:v:0', '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-profile:v', 'high', '-g', '50', '-bf', '0');
    } else args.push('-vn');
    // zvuk: XDCAM má 4–8 mono stop – první dvě jako stereo (jako desktop), jinak první stopa na 2 kanály
    if (info.audio.length >= 2 && info.audio[0] === 1 && info.audio[1] === 1) {
      args.push('-filter_complex', '[0:a:0][0:a:1]amerge=inputs=2[a]', '-map', '[a]');
    } else if (info.audio.length) args.push('-map', '0:a:0');
    if (info.audio.length) args.push('-ac', '2', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k');
    else args.push('-an');
    const xt = self.crossOriginIsolated ? Math.max(1, Math.min(4, ((self.navigator && navigator.hardwareConcurrency) || 4) - 1)) : 1;
    if (info.video) args.push('-x264-params', `threads=${xt}:lookahead-threads=1`);
    args.push('-dn', '-sn', '/out.mp4');
    postMessage({ type: 'stage', stage: 'convert', p: 0, dur: info.dur });
    let last = 0;
    onLog = (m) => {
      const t = /time=(\d+:\d+:\d+(?:\.\d+)?)/.exec(m);
      if (t && info.dur) { const p = Math.min(1, hms(t[1]) / info.dur); if (p - last >= 0.01) { last = p; postMessage({ type: 'progress', p }); } }
    };
    logs = [];
    const ret = run(args);
    onLog = null;
    try { core.FS.unmount(dir); } catch (e) { /* */ }
    if (ret !== 0) {
      const err = logs.filter((l) => /error|invalid|not supported|unknown/i.test(l)).slice(-3).join(' | ') || `ffmpeg ended with code ${ret}`;
      try { core.FS.unlink('/out.mp4'); } catch (e) { /* */ }
      throw new Error(err);
    }
    // do úložiště prohlížeče (OPFS) – příště bez převodu
    postMessage({ type: 'stage', stage: 'save' });
    const out = core.FS.readFile('/out.mp4');
    core.FS.unlink('/out.mp4');
    const root = await navigator.storage.getDirectory();
    const d = await root.getDirectoryHandle('pz-mxf', { create: true });
    const fh = await d.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(out);
    await w.close();
    postMessage({ type: 'done', name, size: out.length, info });
  } catch (e) {
    onLog = null;
    postMessage({ type: 'error', message: String(e && e.message || e) });
  }
};
