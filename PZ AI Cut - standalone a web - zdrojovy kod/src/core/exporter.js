'use strict';
// Export sekvence přes ffmpeg: H.264 / H.265 (MP4), QuickTime MOV (ProRes 422 HQ / 422 / H.264), MXF OP1a
// (XDCAM HD422 50 Mb/s pro TV, DNxHR HQ). Obraz: timeline se rozloží na úseky (nejvyšší viditelný klip,
// prolínačka = dva klipy smíchané, mezery černě), každý úsek se zakóduje zvlášť cílovým kodekem s přesným
// počtem snímků a úseky se spojí bez překódování. Zvuk: stopy z kousků PCM (hlasitost, prolnutí, ticho v
// mezerách), smíchání, volitelně srovnání hlasitosti (EBU R128 loudnorm).
const fs = require('fs');
const path = require('path');
const { run, FFMPEG, CACHE, cfg } = require('./media');
const { clipEnd, holdOf, holdInOf, vSrc } = require('./model');
const { dbToGain, uid } = require('./util');
const E = require('./edit');
/** XDCAM HD422 jen ve standardních variantách (kontrolor S1: 1280×720 25p prošlo, vysílání ho nezná). */
const xdcamOk = (seq) => (seq.width === 1920 && seq.height === 1080 && [25, 50].includes(seq.fps))
  || (seq.width === 1280 && seq.height === 720 && seq.fps === 50); // 29,97 / 59,94 ztrácelo snímky a mělo vadný index MXF (formáty S12)
/** fps jako výraz ffmpeg (29,97 = 30000/1001 – desetinné číslo by se po snímcích rozjíždělo). */
const fpsExpr = (f) => (Math.abs(f - Math.round(f)) > 0.001 ? `${Math.round(f) * 1000}/1001` : String(Math.round(f)));

const ESC = (s) => String(s).replace(/\\/g, '/');

/** Formáty exportu (pro dialog i pro AI most). */
const FORMATS = {
  h264: { label: 'H.264 (MP4)', ext: 'mp4', audio: 'aac' },
  h265: { label: 'H.265 / HEVC (MP4)', ext: 'mp4', audio: 'aac' },
  prores_hq: { label: 'QuickTime MOV – Apple ProRes 422 HQ', ext: 'mov', audio: 'pcm' },
  prores: { label: 'QuickTime MOV – Apple ProRes 422', ext: 'mov', audio: 'pcm' },
  mov_h264: { label: 'QuickTime MOV – H.264', ext: 'mov', audio: 'aac' },
  xdcam: { label: 'MXF OP1a – XDCAM HD422 50 Mb/s (TV)', ext: 'mxf', audio: 'pcm_mono' },
  dnxhr: { label: 'MXF OP1a – Avid DNxHR HQ', ext: 'mxf', audio: 'pcm_mono' },
};
const LOUDNESS = { off: null, social: -14, tv: -23 };

/** Parametry kodéru obrazu + formát pixelů + kontejner úseků. */
function videoCodec(fmt, seq, encoder) {
  const fps = seq.fps, gop = String(Math.round(fps * 2));
  const nv = encoder === 'h264_nvenc';
  switch (fmt) {
    case 'h265': return {
      pix: 'yuv420p', seg: 'ts',
      args: nv ? ['-c:v', 'hevc_nvenc', '-preset', 'p5', '-cq', String(cfg.crf || 21), '-b:v', '0', '-g', gop]
        : ['-c:v', 'libx265', '-preset', 'fast', '-crf', String((cfg.crf || 18) + 3), '-x265-params', 'log-level=error', '-g', gop],
      final: ['-tag:v', 'hvc1'],
    };
    case 'prores_hq': case 'prores': return {
      pix: 'yuv422p10le', seg: 'mov',
      args: ['-c:v', 'prores_ks', '-profile:v', fmt === 'prores_hq' ? '3' : '2', '-vendor', 'apl0'], final: [],
    };
    case 'xdcam': {
      if (!xdcamOk(seq)) {
        throw new Error(`XDCAM HD422 needs 1920×1080 at 25/50 fps or 1280×720 at 50 fps (sequence is ${seq.width}×${seq.height} ${seq.fps} fps) – use MXF DNxHR HQ or H.264 instead, or change the sequence to 1920×1080 25 fps (Sequence → Sequence Settings).`);
      }
      return {
        pix: 'yuv422p', seg: 'ts',
        args: ['-c:v', 'mpeg2video', '-b:v', '50M', '-minrate', '50M', '-maxrate', '50M', '-bufsize', '17825792', '-rc_init_occupancy', '17825792',
          '-g', '12', '-bf', '2', '-flags', '+cgop', '-sc_threshold', '1000000000', '-dc', '10', '-intra_vlc', '1', '-non_linear_quant', '1', '-qmin', '1', '-qmax', '12'],
        final: [],
      };
    }
    case 'dnxhr': return { pix: 'yuv422p', seg: 'mov', args: ['-c:v', 'dnxhd', '-profile:v', 'dnxhr_hq'], final: [] };
    default: return { // h264, mov_h264
      pix: 'yuv420p', seg: 'ts',
      args: nv ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', String(cfg.crf || 19), '-b:v', '0', '-g', gop]
        : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(cfg.crf || 18), '-g', gop],
      final: [],
    };
  }
}

/** Vstup obrazu: obrázek ve smyčce (formáty S12: PNG = 1 snímek, JPG pád), jinak hledání s předstihem. */
function vIn(m, p) { return m.still ? ['-loop', '1', '-framerate', '25', '-i', m.path] : ['-ss', p.pre, '-i', m.path]; }
/** Zvuk zdroje jako filtr: 2× mono (kamera, MXF) spojit do sterea (formáty S12: 2. stopa zmizela). */
function aSrc(m, i) { return m.audioStreams >= 2 && m.audioChannels === 1 ? `[${i}:a:0][${i}:a:1]amerge=inputs=2,` : `[${i}:a]`; }
/** Přesné hledání ve zvuku: rychle na 3 s před, pak dekódováním na vzorek (formáty S12: MP3 15–20 ms ticha na začátku
 *  kusu, AAC posun 21 ms – kodér má předstih, který hledání na vstupu nezapočítá). */
function aSeek(src, p) { const pre = Math.max(0, src - 3); return { args: ['-ss', pre.toFixed(4), '-i', p], trim: `atrim=start=${(src - pre).toFixed(6)},asetpts=PTS-STARTPTS,` }; }
function videoFilter(seq, media, clip, pix = 'yuv420p') {
  const W = seq.width, H = seq.height;
  const iw = media.width || W, ih = media.height || H;
  const base = clip.fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  const k = base * (clip.scale || 1);
  const sw = Math.max(2, Math.round(iw * k / 2) * 2), sh = Math.max(2, Math.round(ih * k / 2) * 2);
  const cw = Math.min(W, sw), ch = Math.min(H, sh);
  const x = Math.round(Math.max(0, (sw - cw) / 2 * (1 + (clip.posX || 0))));
  const y = Math.round(Math.max(0, (sh - ch) / 2 * (1 + (clip.posY || 0))));
  // prokládaný zdroj (1080i): odstranit prokládání (formáty S12: hřebeny v exportu)
  return `${media.interlaced ? 'bwdif=0:-1:0,' : ''}fps=${seq.fps},scale=${sw}:${sh}:flags=bicubic,crop=${cw}:${ch}:${x}:${y},pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=${pix}`;
}

/** Oblasti Cross Dissolve na stopě: [{a, b, L, R, d}]. */
function crossRegions(seq, track) {
  const out = [];
  const h = 0.5 / (seq.fps || 25);
  for (const R of track.clips) {
    if (!R.vIn || R.vIn.type !== 'cross' || R.disabled) continue;
    const L = track.clips.find((c) => !c.disabled && Math.abs(clipEnd(c) - R.start) < h);
    if (!L) continue;
    const d = R.vIn.dur;
    out.push({ a: R.start - d / 2, b: R.start + d / 2, L, R, d });
  }
  return out;
}

/** Úseky obrazu: [{a, b, clip|null, cross|null}] v čase sekvence, omezené na rozsah [rs, re). */
function videoSegments(seq, rs, re) {
  const tracks = seq.tracks.video;
  const regions = tracks.map((t, ti) => (t.muted ? [] : require('./edit').crossRegionsOf(seq, ti)));
  const pts = new Set([rs, re]);
  tracks.forEach((t, ti) => {
    if (t.muted) return;
    t.clips.forEach((c) => {
      if (c.disabled) return;
      pts.add(c.start); pts.add(clipEnd(c));
      if (holdOf(c)) pts.add(clipEnd(c) - holdOf(c));
      if (holdInOf(c)) pts.add(c.start + holdInOf(c));
      if (c.vIn && c.vIn.type !== 'cross') pts.add(c.start + c.vIn.dur);
      if (c.vOut) pts.add(clipEnd(c) - c.vOut.dur);
    });
    for (const r of regions[ti]) { pts.add(r.a); pts.add(r.b); }
  });
  const arr = [...pts].filter((x) => x >= rs && x <= re).sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i + 1 < arr.length; i++) {
    const a = arr[i], b = arr[i + 1];
    if (b - a < 1e-4) continue;
    const mid = (a + b) / 2;
    let top = null, cross = null;
    for (let ti = tracks.length - 1; ti >= 0 && !top && !cross; ti--) {
      if (tracks[ti].muted) continue;
      cross = regions[ti].find((r) => r.a <= mid && r.b > mid) || null;
      if (!cross) top = tracks[ti].clips.find((c) => !c.disabled && c.start <= mid && clipEnd(c) > mid) || null;
    }
    const last = segs[segs.length - 1];
    // stejný klip navazuje – jeden úsek; ne přes začátek zopakovaného konce (hold: zdroj tam skočí zpět)
    const holdAt = top && holdOf(top) ? clipEnd(top) - holdOf(top) : null;
    const holdInAt = top && holdInOf(top) ? top.start + holdInOf(top) : null;
    const jump = (x) => x !== null && Math.abs(a - x) < 1e-4;
    if (last && ((top && last.clip === top && !jump(holdAt) && !jump(holdInAt)) || (cross && last.cross === cross))) last.b = b;
    else segs.push({ a, b, clip: top, cross });
  }
  return segs;
}

function dipFilters(c, a, b) {
  const f = [];
  const color = (t) => (t === 'dipWhite' ? 'white' : 'black');
  if (c.vIn && c.vIn.type !== 'cross' && a < c.start + c.vIn.dur) {
    f.push(`fade=t=in:st=${Math.max(0, c.start - a).toFixed(4)}:d=${c.vIn.dur.toFixed(4)}:color=${color(c.vIn.type)}`);
  }
  if (c.vOut && c.vOut.type !== 'cross' && b > clipEnd(c) - c.vOut.dur) {
    f.push(`fade=t=out:st=${Math.max(0, clipEnd(c) - c.vOut.dur - a).toFixed(4)}:d=${c.vOut.dur.toFixed(4)}:color=${color(c.vOut.type)}`);
  }
  return f;
}

function srtTime(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/**
 * Přesný začátek úseku zdroje: rychlý skok ffmpeg (-ss před -i) se v některých MP4 (TN: ne-IDR I-snímky při střihu
 * kamery, které stss vydává za klíčové) trefí doprostřed GOP a vrátí zastaralý obraz až do dalšího IDR (~10 s).
 * Proto skok o PREROLL s dřív a k přesnému času se dojde dekódováním (trim) – ověřeno proti plynulému dekódování.
 */
const PREROLL = 11;
function preroll(src) {
  const pre = Math.max(0, src - PREROLL);
  const post = src - pre;
  return { pre: pre.toFixed(4), trim: post > 0.0005 ? `trim=start=${post.toFixed(4)},setpts=PTS-STARTPTS,` : '' };
}

function captionsSrt(seq, rs, re) {
  let n = 0;
  return (seq.captions || []).filter((c) => c.end > rs && c.start < re).map((c) =>
    `${++n}\n${srtTime(Math.max(0, c.start - rs))} --> ${srtTime(Math.min(re, c.end) - rs)}\n${String(c.text).replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim()}\n`).join('\n');
}

async function pool(items, limit, fn) {
  let i = 0, failed = null;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length && !failed) { const k = i++; try { await fn(items[k], k); } catch (e) { failed = failed || e; } }
  });
  await Promise.all(workers);
  if (failed) throw failed; // první chyba (ne průběh dalšího úseku, který ji přepsal)
}

/**
 * @param opts {output, format, encoder, range:'all'|'inout', burnCaptions, srtSidecar, loudness:'off'|'social'|'tv',
 *              onProgress(p, msg), signal{cancelled}}
 */
const ACTIVE = new Set(); // výstupy právě běžících exportů
/** Export pracuje se zmrazeným snímkem sekvence (zátěž S12: úprava z nabídky během exportu dala soubor ze dvou stavů –
 *  obraz 3590 s, zvuk 3600 s) a do jednoho souboru smí běžet jen jeden export (dva naráz = poškozené MP4 s „✔“). */
/** Cílová cesta s příponou formátu – exportSnapshot by jinak příponu změnil až po kontrole zdroje (revize S14:
 *  export do „…\rozhovor“ bez přípony přepsal rozhovor.mp4). */
function outputPathFor(opts) {
  const o = String(opts.output || '');
  const fmt = FORMATS[opts.format] ? opts.format : (/\.mov$/i.test(o) ? 'prores_hq' : /\.mxf$/i.test(o) ? 'xdcam' : 'h264');
  const ext = FORMATS[fmt].ext;
  if (new RegExp('\\.' + ext + '$', 'i').test(o)) return o;
  const b = path.basename(o);
  return (/\.[^.]+$/.test(b) ? o.slice(0, o.length - path.extname(b).length) : o) + '.' + ext;
}
/** Tentýž soubor i přes krátké jméno 8.3, jiný zápis cesty nebo pevný odkaz (revize S14: ROZHOV~1.MP4 přepsal zdroj). */
function sameFile(a, b) {
  if (!a || !b) return false;
  if (path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()) return true;
  try {
    const x = fs.statSync(a, { bigint: true }), y = fs.statSync(b, { bigint: true });
    return x.ino !== 0n && x.ino === y.ino && x.dev === y.dev;
  } catch (e) { return false; }
}
async function exportSequence(project, seq0, opts) {
  const final = outputPathFor(opts);
  const key = path.resolve(final).toLowerCase();
  if (ACTIVE.has(key)) throw new Error('This file is already being exported – wait until it finishes or choose another name.');
  // výstup nesmí přepsat zdrojové médium (bezpečnost S12)
  const src = project.media.find((m) => m && [m.path, m.proxy, m.playPath].some((q) => sameFile(q, final)));
  if (src) throw new Error(`The output would overwrite the source media ${src.name} – choose another file name.`);
  ACTIVE.add(key);
  // export do dočasného souboru, cíl až po dokončení; při chybě / zrušení / pádu nezůstane pod cílovým jménem nepřehratelný
  // soubor a pracovní složka se smaže (pád a obnova S12: rozbité MP4 + 210 MB v cache na každý pokus)
  const ext = path.extname(final);
  const part = final.slice(0, final.length - ext.length) + '.pzpart' + ext;
  const works = [];
  let kept = false;
  try {
    const r = await exportSnapshot(project, JSON.parse(JSON.stringify(seq0)), Object.assign({}, opts, { output: part, _onWork: (w) => works.push(w) }));
    // rename na Windows starý soubor nahradí; dřív se starý export mazal předem a zamčený cíl smazal i hotový render (revize S14)
    let out = final;
    try { fs.renameSync(part, final); } catch (e) {
      if (!/EPERM|EBUSY|EACCES/.test(e.code || e.message)) throw e;
      // cíl je otevřený v jiném programu – hotový export uložit vedle, ne zahodit
      const base = final.slice(0, final.length - ext.length);
      let i = 1; while (fs.existsSync(`${base} (${i})${ext}`)) i++;
      out = `${base} (${i})${ext}`;
      fs.renameSync(part, out);
      kept = true;
    }
    const srtP = part.replace(/\.[^.]+$/, '.srt'), srtF = out.replace(/\.[^.]+$/, '.srt');
    if (fs.existsSync(srtP)) { try { fs.renameSync(srtP, srtF); } catch (e) { /* titulky zůstanou jako .pzpart.srt */ } }
    return Object.assign(r, { output: out }, kept ? { note: `The file ${path.basename(final)} is open in another program – the export was saved as ${path.basename(out)}.` } : {});
  } catch (e) {
    for (const f of [part, part.replace(/\.[^.]+$/, '.srt')]) { try { fs.rmSync(f, { force: true }); } catch (x) { /* */ } }
    // zrušení: ffmpeg ukončený zvenku hlásí „exited with code null“ – srozumitelně
    if (opts.signal && opts.signal.cancelled) throw new Error('Export cancelled.');
    throw e;
  } finally {
    ACTIVE.delete(key);
    for (const w of works) { try { fs.rmSync(w, { recursive: true, force: true }); } catch (e) { /* */ } }
  }
}
/** Pozůstatky exportů z dřívějška (pád aplikace během exportu) – pracovní složky starší než 6 h. */
function cleanStaleExports() {
  try {
    const dir = path.join(CACHE, 'export');
    for (const d of fs.readdirSync(dir)) {
      const p = path.join(dir, d);
      try { if (Date.now() - fs.statSync(p).mtimeMs > 6 * 3600e3) fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* */ }
    }
  } catch (e) { /* bez složky */ }
}
exportSequence.active = () => ACTIVE.size;
async function exportSnapshot(project, seq, opts) {
  const fps = seq.fps || 25;
  const fmt = FORMATS[opts.format] ? opts.format : (/\.mov$/i.test(opts.output || '') ? 'prores_hq' : /\.mxf$/i.test(opts.output || '') ? 'xdcam' : 'h264');
  const F = FORMATS[fmt];
  const V = videoCodec(fmt, seq, opts.encoder || cfg.videoEncoder);
  // konec = poslední klip i titulek (sekvence jen s titulky / nadpisem jde exportovat – černá s titulky, jako Premiere)
  const end = Math.max(...['video', 'audio'].flatMap((k) => seq.tracks[k].flatMap((t) => t.clips.filter((c) => !c.disabled).map(clipEnd))),
    ...(seq.captions || []).map((c) => c.end || 0), 0);
  let rs = 0, re = end;
  const hasIn = seq.inPoint !== null && seq.inPoint !== undefined, hasOut = seq.outPoint !== null && seq.outPoint !== undefined;
  // In/Out: jen In = od In do konce, jen Out = od začátku do Out (zátěž S12: jen In exportovalo celou sekvenci)
  if (opts.range === 'inout' && (hasIn || hasOut)) {
    rs = hasIn ? seq.inPoint : 0; re = Math.min(end, hasOut ? seq.outPoint : end);
    if (re - rs < 1 / fps) throw new Error('There is nothing to export between In and Out.');
  }
  if (re - rs < 1 / fps) throw new Error('The sequence is empty – nothing to export.');
  let output = opts.output;
  if (!new RegExp('\\.' + F.ext + '$', 'i').test(output)) output = output.replace(/\.[^.\\/]+$/, '') + '.' + F.ext;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const work = path.join(CACHE, 'export', uid('x'));
  fs.mkdirSync(work, { recursive: true });
  if (opts._onWork) opts._onWork(work);
  const procs = new Set();
  const track = (p) => { procs.add(p); p.on('close', () => procs.delete(p)); };
  if (opts.signal) opts.signal.kill = () => { for (const p of procs) try { p.kill(); } catch (e) {} };
  const check = () => { if (opts.signal && opts.signal.cancelled) throw new Error('Export cancelled.'); };
  const mediaOf = (c) => project.mediaById(c.mediaId);
  const ff = (args) => run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { proc: track }).catch((e) => {
    // zamčený soubor (otevřený v jiném programu) – srozumitelně (zátěž S12: surové „Permission denied“ z ffmpeg)
    if (/Permission denied|being used by another process/i.test(String(e && e.message))) throw new Error('A file is open in another program or not accessible – close it and export again.');
    throw e;
  });

  // chybějící média předem (jinak export spadl uprostřed na chybě ffmpeg bez vysvětlení)
  const offline = new Set();
  for (const k of ['video', 'audio']) for (const t of seq.tracks[k]) for (const c of t.clips) {
    if (c.disabled || clipEnd(c) <= rs || c.start >= re || t.muted) continue;
    const m = mediaOf(c);
    if (!m || m.missing || !fs.existsSync(m.path)) { offline.add(m ? m.name : '?'); if (m && !m.missing) m.missing = true; } // přejmenované za běhu (zátěž S12)
  }
  if (offline.size) throw new Error(`Media offline: ${[...offline].join(', ')} – the file was moved or renamed. Import it from its new place (File → Import) and the clips reconnect.`);
  // zápis do cílové složky ověřit hned (vzhled S3: „Permission denied“ až po 60 % renderu)
  try { const probe = path.join(path.dirname(output), '.pz-write-test-' + process.pid); fs.writeFileSync(probe, ''); fs.unlinkSync(probe); }
  catch (e) { throw new Error(`Cannot write to the folder ${path.dirname(output)} – choose another place to save.`); }
  const vsegs = videoSegments(seq, rs, re);
  // Solo jako v náhledu: když je některá stopa sólo, exportují se jen sólové (střihač z Premiere S11: export solo ignoroval)
  const solo = seq.tracks.audio.some((t) => t.solo);
  const audioTracks = seq.tracks.audio.filter((t) => !t.muted && (!solo || t.solo) && t.clips.some((c) => clipEnd(c) > rs && c.start < re));
  const totalUnits = vsegs.length + audioTracks.reduce((a, t) => a + t.clips.length + 1, 0) + 2;
  let done = 0;
  const tick = (msg) => { done++; if (opts.onProgress) opts.onProgress(Math.min(0.99, done / totalUnits), msg); };
  const segOut = [...V.args, '-pix_fmt', V.pix, '-r', String(fps), '-an', ...(V.seg === 'ts' ? ['-f', 'mpegts'] : [])];

  // ---- obraz po úsecích
  const segFiles = [];
  await pool(vsegs, 3, async (s, i) => {
    check();
    const frames = Math.round((s.b - rs) * fps) - Math.round((s.a - rs) * fps);
    const file = path.join(work, `v${String(i).padStart(5, '0')}.${V.seg}`);
    segFiles[i] = frames > 0 ? file : null;
    if (frames <= 0) return tick();
    if (s.cross) {
      const { L, R, d } = s.cross;
      const mL = mediaOf(L), mR = mediaOf(R);
      const srcL = vSrc(L, s.a), srcR = Math.max(0, vSrc(R, s.a));
      const off = (s.a - s.cross.a).toFixed(4), D = d.toFixed(4);
      const p = `clip((T+${off})/${D},0,1)`;
      const pL = mL.still ? { pre: '0', trim: '' } : preroll(srcL), pR = mR.still ? { pre: '0', trim: '' } : preroll(srcR);
      await ff([...vIn(mL, pL), ...vIn(mR, pR),
        '-filter_complex', `[0:v]${pL.trim}${videoFilter(seq, mL, L, V.pix)},setpts=PTS-STARTPTS[a];[1:v]${pR.trim}${videoFilter(seq, mR, R, V.pix)},setpts=PTS-STARTPTS[b];` +
          `[a][b]blend=all_expr='A*(1-${p})+B*${p}'[v]`,
        '-map', '[v]', '-frames:v', String(frames), ...segOut, file]);
    } else if (!s.clip) {
      await ff(['-f', 'lavfi', '-i', `color=c=black:s=${seq.width}x${seq.height}:r=${fps}`, '-vf', `format=${V.pix}`, '-frames:v', String(frames), ...segOut, file]);
    } else {
      const m = mediaOf(s.clip);
      const src = vSrc(s.clip, s.a);
      const p = m.still ? { pre: '0', trim: '' } : preroll(src);
      const vf = p.trim + [videoFilter(seq, m, s.clip, V.pix), ...dipFilters(s.clip, s.a, s.b)].join(',');
      await ff([...vIn(m, p), '-frames:v', String(frames), '-vf', vf, ...segOut, file]);
    }
    tick('video');
  });
  const vlist = path.join(work, 'video.txt');
  fs.writeFileSync(vlist, segFiles.filter(Boolean).map((f) => `file '${ESC(f)}'`).join('\n'));

  // ---- zvuk po stopách
  const SR = 48000;
  const trackFiles = [];
  for (let ti = 0; ti < audioTracks.length; ti++) {
    check();
    const t = audioTracks[ti];
    const clips = t.clips.filter((c) => clipEnd(c) > rs && c.start < re).sort((a, b) => a.start - b.start);
    const pieces = [];
    let cursor = rs;
    for (const c of clips) {
      const a = Math.max(rs, c.start), b = Math.min(re, clipEnd(c));
      if (a - cursor > 1e-4) pieces.push({ silence: a - cursor });
      // navazující kus téhož zdroje (žiletka, řez zvuku spolu s obrazem po úklidu krajů / výřezu) číst vcelku – jinak
      // zaokrouhlení začátku kusu (-ss) může na řezu uprostřed řeči lupnout
      const lp = pieces[pieces.length - 1], lc = lp && (lp.endClip || lp.clip);
      if (lc && Math.abs(lp.b - a) < 1e-4 && lc.mediaId === c.mediaId && (lc.gainDb || 0) === (c.gainDb || 0)
        && !(lc.fadeOut > 0) && !(c.fadeIn > 0) && !E.xfIn(t, c) && Math.abs((lc.in + (lp.b - lc.start)) - (c.in + (a - c.start))) < 1e-3) {
        lp.b = b; lp.endClip = c;
      } else pieces.push({ clip: c, a, b });
      cursor = b;
    }
    if (re - cursor > 1e-4) pieces.push({ silence: re - cursor });
    // prolnutí zvuku (Ctrl+Shift+D): na střihu A|B s B.xIn = d vznikne kus [T − d/2, T + d/2), kde znějí oba (A do rezervy za
    // svým koncem, B z rezervy před začátkem) s průběhem konstantního výkonu; d se zkrátí podle rezervy zdroje a délek klipů
    for (let i = 1; i < pieces.length; i++) {
      const P = pieces[i - 1], Q = pieces[i];
      if (P.silence !== undefined || Q.silence !== undefined || !Q.clip || Math.abs(P.b - Q.a) > 1e-4) continue;
      const A = P.endClip || P.clip, B = Q.clip, T = Q.a;
      let d = E.xfIn(t, B);
      if (!d || Math.abs(clipEnd(A) - T) > 1e-3 || Math.abs(B.start - T) > 1e-3) continue;
      const mA = mediaOf(A);
      d = Math.min(d, 2 * Math.max(0, ((mA && mA.duration) || Infinity) - A.out), 2 * B.in, P.b - P.a, Q.b - Q.a);
      if (d < 2 / fps) continue;
      const h = d / 2;
      P.b = T - h; Q.a = T + h;
      pieces.splice(i, 0, { xf: { A, B, d }, a: T - h, b: T + h });
      i++;
    }
    const files = [];
    await pool(pieces, 3, async (p, i) => {
      check();
      const file = path.join(work, `a${ti}_${String(i).padStart(5, '0')}.wav`);
      files[i] = file;
      const dur = p.silence !== undefined ? p.silence : p.b - p.a;
      const samples = Math.max(1, Math.round(dur * SR));
      const silence = () => ff(['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`, '-af', `atrim=end_sample=${samples}`, '-c:a', 'pcm_s24le', file]);
      if (p.silence !== undefined) { await silence(); tick('audio'); return; }
      if (p.xf) {
        const { A, B, d } = p.xf, mA = mediaOf(A), mB = mediaOf(B);
        const sA = A.in + (p.a - A.start), sB = Math.max(0, B.in + (p.a - B.start));
        const pre = (g) => `aresample=${SR},aformat=channel_layouts=stereo,volume=${dbToGain(g).toFixed(4)},apad,atrim=end_sample=${samples}`;
        const kA = mA.hasAudio ? aSeek(sA, mA.path) : { args: ['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`], trim: '' };
        const kB = mB.hasAudio ? aSeek(sB, mB.path) : { args: ['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`], trim: '' };
        const inA = kA.args, inB = kB.args;
        await ff([...inA, ...inB, '-filter_complex',
          `${mA.hasAudio ? aSrc(mA, 0) : '[0:a]'}${kA.trim}${pre(A.gainDb)},afade=t=out:d=${d.toFixed(4)}:curve=qsin[a];${mB.hasAudio ? aSrc(mB, 1) : '[1:a]'}${kB.trim}${pre(B.gainDb)},afade=t=in:d=${d.toFixed(4)}:curve=qsin[b];` +
          `[a][b]amix=inputs=2:normalize=0,atrim=end_sample=${samples}[o]`, '-map', '[o]', '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s24le', file]);
        tick('audio'); return;
      }
      const c = p.clip, m = mediaOf(c);
      if (!m.hasAudio) { await silence(); tick('audio'); return; }
      const src = c.in + (p.a - c.start);
      const f = [`aresample=${SR}`, 'aformat=channel_layouts=stereo', `volume=${dbToGain(c.gainDb).toFixed(4)}`];
      if (c.fadeIn > 0 && Math.abs(p.a - c.start) < 1e-3) f.push(`afade=t=in:d=${c.fadeIn.toFixed(4)}`);
      const ce = p.endClip || c;
      if (ce.fadeOut > 0 && Math.abs(p.b - clipEnd(ce)) < 1e-3) f.push(`afade=t=out:st=${Math.max(0, dur - ce.fadeOut).toFixed(4)}:d=${ce.fadeOut.toFixed(4)}`);
      f.push('apad', `atrim=end_sample=${samples}`);
      const sk = aSeek(src, m.path); // dosedání na vzorek uvnitř filtru (-ss za vstupem by se uplatnilo až za atrim délky)
      await ff([...sk.args, '-vn', '-filter_complex', `${aSrc(m, 0)}${sk.trim}${f.join(',')}[o]`, '-map', '[o]', '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s24le', file]);
      tick('audio');
    });
    const list = path.join(work, `a${ti}.txt`);
    fs.writeFileSync(list, files.map((f) => `file '${ESC(f)}'`).join('\n'));
    const tf = path.join(work, `track${ti}.wav`);
    await ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', tf]);
    trackFiles.push(tf);
    tick('mix');
  }

  // ---- složení
  check();
  const args = ['-f', 'concat', '-safe', '0', '-i', vlist];
  for (const f of trackFiles) args.push('-i', f);
  const srt = captionsSrt(seq, rs, re);
  const burn = opts.burnCaptions && srt.trim();
  // nadpis nahoře (seq.title) je součást obrazu → vypálí se vždy, jako samostatné ASS titulky přes celé video
  const titleL = (() => { try { return require('./captionlayout').titleLines(seq); } catch (e) { return null; } })();
  if (burn || titleL) {
    const vf = [];
    if (titleL) {
      const ass = ['[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${seq.width}`, `PlayResY: ${seq.height}`, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        `Style: T,Arial,${Math.round(titleL.fs * 1.05)},&H00FFFFFF,&H00FFFFFF,&H2E000000,&H2E000000,1,0,0,0,100,100,0,0,3,${Math.round(titleL.fs * 0.3)},0,8,40,40,${Math.round(seq.height * titleL.top / 100)},1`, '',
        '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        `Dialogue: 0,0:00:00.00,9:59:59.00,T,,0,0,0,,${titleL.lines.map((l) => l.replace(/[{}]/g, '')).join('\\N')}`];
      fs.writeFileSync(path.join(work, 'title.ass'), ass.join('\n'), 'utf8');
      vf.push('subtitles=title.ass');
    }
  if (burn) {
    fs.writeFileSync(path.join(work, 'subs.srt'), srt, 'utf8');
    // libass měří u SRT v souřadnicích 384×288 – FontSize 12 ≈ 4,2 % výšky obrazu jako náhled v monitoru
    // styl titulků sekvence (src/core/captionlayout.js): velikost, výška, barva, podklad
    const st = require('./captionlayout').styleOf(seq);
    // libass: FontSize v souřadnicích výšky 288 → stejná velikost jako náhled a webový export
    const fsz = Math.round(require('./captionlayout').fontFrac(seq.width, seq.height, st) * 288 * 10) / 10;
    const mv = Math.round(288 * (st.pos != null ? st.pos : (seq.height > seq.width ? 14 : 5)) / 100);
    const hex = String(st.color || '#ffffff').replace('#', '');
    const col = `&H00${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`.toUpperCase();
    const box = st.box ? ',BorderStyle=3,OutlineColour=&H48000000,Outline=2' : ',Outline=1.2';
    if (st.highlight) {
      // zvýraznění vyslovovaného slova: ASS v souřadnicích 384×288 (jako SRT výše), pro každé slovo jedna událost
      const CLh = require('./captionlayout');
      const hex2 = String(st.highlight).replace('#', '');
      const hcol = `&H00${hex2.slice(4, 6)}${hex2.slice(2, 4)}${hex2.slice(0, 2)}`.toUpperCase();
      const at = (x) => { const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = x % 60; return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
      const ev = [];
      for (const c of (seq.captions || [])) {
        if (c.end <= rs || c.start >= re) continue;
        const starts = CLh.wordStarts(c), words = String(c.text).split(/\s+/).filter(Boolean);
        for (let i = 0; i < words.length; i++) {
          const a = Math.max(c.start, i ? starts[i] : c.start), b = i + 1 < words.length ? starts[i + 1] : c.end;
          if (b <= rs || a >= re || b - a < 0.01) continue;
          let k = 0;
          const txt = String(c.text).replace(/\{[^}]*\}/g, '').replace(/[{}]/g, '').split('\n').map((line) => line.split(' ').filter(Boolean).map((w) => (k++ === i ? `{\\c${hcol}}${w}{\\c${col}}` : w)).join(' ')).join('\\N');
          ev.push(`Dialogue: 0,${at(Math.max(0, a - rs))},${at(Math.min(re, b) - rs)},C,,0,0,0,,${txt}`);
        }
      }
      const ass = ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 384', 'PlayResY: 288', 'WrapStyle: 1', 'ScaledBorderAndShadow: yes', '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        `Style: C,Arial,${fsz},${col},${col},&H00000000,&H48000000,1,0,0,0,100,100,0,0,${st.box ? 3 : 1},${st.box ? 2 : 1.2},0,2,23,23,${mv},1`, '',
        '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text', ...ev];
      fs.writeFileSync(path.join(work, 'subs.ass'), ass.join('\n'), 'utf8');
      vf.push('subtitles=subs.ass');
    } else vf.push(`subtitles=subs.srt:force_style='FontName=Arial,Bold=1,FontSize=${fsz},PrimaryColour=${col}${box},Shadow=0,MarginV=${mv},MarginL=23,MarginR=23'`);
  }
    // časy snímků podle pořadí (spojené úseky TS s B-snímky mají na švech nemonotónní časy → překódování 1 snímek zahodilo,
    // kontrolor S1: XDCAM 399/400, obraz o snímek napřed) + přesný počet snímků
    vf.unshift(`setpts=N/(${fpsExpr(fps)})/TB`);
    args.push('-vf', `${vf.join(',')},format=${V.pix}`);
    args.push(...V.args, '-pix_fmt', V.pix, '-r', fpsExpr(fps), '-frames:v', String(Math.round((re - rs) * fps)));
  } else args.push('-c:v', 'copy');
  args.push(...V.final);
  // zvuk: smíchat stopy, volitelně srovnat hlasitost (EBU R128)
  const lufs = LOUDNESS[opts.loudness || 'off'];
  const chain = [];
  let aIn = null;
  if (trackFiles.length > 1) { chain.push(trackFiles.map((_, i) => `[${i + 1}:a]`).join('') + `amix=inputs=${trackFiles.length}:normalize=0:dropout_transition=0[mx]`); aIn = '[mx]'; }
  else if (trackFiles.length === 1) aIn = '[1:a]';
  if (aIn && lufs !== null && lufs !== undefined) {
    // dvouprůchodově (kontrolor S1: jednoprůchodový loudnorm dal TV −21,7 až −22,3 místo −23, sítě −13,4 místo −14):
    // 1) smíchat a změřit, 2) lineární zesílení podle měření (bez dynamické komprese, přesně na cíl)
    const norm = `I=${lufs}:TP=${lufs <= -20 ? -2 : -1.5}:LRA=${lufs <= -20 ? 15 : 11}`;
    let measured = '';
    try {
      const mixF = path.join(work, 'mix.wav');
      if (trackFiles.length > 1) await ff([...trackFiles.flatMap((f) => ['-i', f]), '-filter_complex', trackFiles.map((_, i) => `[${i}:a]`).join('') + `amix=inputs=${trackFiles.length}:normalize=0:dropout_transition=0`, '-c:a', 'pcm_s24le', mixF]);
      else fs.copyFileSync(trackFiles[0], mixF);
      const r = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', mixF, '-af', `loudnorm=${norm}:print_format=json`, '-f', 'null', '-'], { proc: track });
      const j = JSON.parse(r.err.slice(r.err.lastIndexOf('{'), r.err.lastIndexOf('}') + 1));
      if (isFinite(+j.input_i) && +j.input_i > -70) measured = `:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    } catch (e) { /* měření selhalo → jednoprůchodově */ }
    chain.push(`${aIn}loudnorm=${norm}${measured},aresample=${SR},apad[ln]`); aIn = '[ln]';
  }
  args.push('-map', '0:v');
  // MXF pro TV vždy se zvukem – sekvence bez zvuku = 2 tiché mono stopy (zátěž S12: MXF bez zvukové stopy, Premiere dá ticho)
  if (!aIn && F.audio === 'pcm_mono') { chain.push(`anullsrc=r=${SR}:cl=stereo[sil]`); aIn = '[sil]'; }
  if (aIn) {
    if (F.audio === 'pcm_mono') {
      // MXF OP1a pro TV: každý kanál jako samostatná mono stopa, 24 bit
      chain.push(`${aIn}channelsplit=channel_layout=stereo[l][r]`);
      args.push('-filter_complex', chain.join(';'), '-map', '[l]', '-map', '[r]', '-c:a', 'pcm_s24le', '-ar', String(SR));
    } else {
      if (chain.length) args.push('-filter_complex', chain.join(';'), '-map', aIn); else args.push('-map', aIn.replace(/^\[|\]$/g, ''));
      if (F.audio === 'pcm') args.push('-c:a', 'pcm_s24le', '-ar', String(SR));
      else args.push('-c:a', 'aac', '-b:a', '256k', '-ar', String(SR));
    }
  }
  args.push('-t', (re - rs).toFixed(4));
  if (F.ext === 'mp4' || F.ext === 'mov') args.push('-movflags', '+faststart');
  if (F.ext === 'mxf') args.push('-f', 'mxf');
  args.push(output);
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { proc: track, cwd: work });
  if (opts.srtSidecar && srt.trim()) fs.writeFileSync(output.replace(/\.[^.]+$/, '.srt'), srt, 'utf8');
  if (opts.onProgress) opts.onProgress(1, 'done');
  try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) {}
  const st = fs.statSync(output);
  return { output, format: fmt, sizeMB: Math.round(st.size / 1048576 * 1000) / 1000, duration: Math.round((re - rs) * 1000) / 1000 };
}

module.exports = { xdcamOk, exportSequence, cleanStaleExports, videoSegments, videoFilter, captionsSrt, FORMATS, LOUDNESS };
