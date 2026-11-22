'use strict';
/* Webová náhrada src/core/exporter.js: export sekvence do MP4 (H.264 + AAC) v prohlížeči přes WebCodecs.
 * Obraz se skládá stejně jako náhled v Programu (player.js): nejvyšší stopa, rozložení fit/scale/pos,
 * Cross Dissolve, Dip to Black/White, vypálené titulky. Zvuk: všechny stopy, hlasitost, prolnutí,
 * volitelně normalizace hlasitosti (EBU R128 / ITU BS.1770). Soubor se zapisuje průběžně na disk uživatele. */
const CL = require('../src/core/captionlayout');
const vfs = require('./shims/vfs');
const { clipEnd } = require('../src/core/model');
const { dbToGain, audioBlocks } = require('../src/core/util');
const { VideoSource, decodeAudioRange } = require('./engine/decode');
const { Mp4Writer } = require('./engine/mp4-writer');

const FORMATS = { h264: { label: 'H.264 (MP4)', ext: 'mp4', audio: 'aac' } };
const LOUDNESS = { off: null, social: -14, tv: -23 };
const SR = 48000;

/* ---------- obraz ---------- */
function topVideo(seq, t) {
  const v = seq.tracks.video;
  for (let ti = v.length - 1; ti >= 0; ti--) {
    if (v[ti].muted) continue;
    const c = v[ti].clips.find((x) => !x.disabled && x.start <= t + 1e-6 && clipEnd(x) > t + 1e-6);
    if (c) return c;
  }
  return null;
}
function crossAt(seq, t) {
  const v = seq.tracks.video;
  for (let ti = v.length - 1; ti >= 0; ti--) {
    if (v[ti].muted) continue;
    for (const R of v[ti].clips) {
      if (!R.vIn || R.vIn.type !== 'cross' || R.disabled) continue;
      const d = R.vIn.dur, a = R.start - d / 2;
      if (t < a || t >= a + d) continue;
      const L = v[ti].clips.find((c) => Math.abs(clipEnd(c) - R.start) < 0.5 / (seq.fps || 25));
      if (L) return { L, R, a, d };
    }
    if (v[ti].clips.some((x) => !x.disabled && x.start <= t && clipEnd(x) > t)) return null;
  }
  return null;
}
function drawClip(ctx, frame, clip, m, W, H, alpha) {
  const iw = (m && m.width) || W, ih = (m && m.height) || H;
  const base = clip.fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  const k = base * (clip.scale || 1);
  const sw = iw * k, sh = ih * k;
  const left = sw >= W ? (W - sw) / 2 * (1 + (clip.posX || 0)) : (W - sw) / 2;
  const top = sh >= H ? (H - sh) / 2 * (1 + (clip.posY || 0)) : (H - sh) / 2;
  ctx.globalAlpha = alpha;
  const rot = (m && m.rotation) || 0;
  if (!rot) ctx.drawImage(frame, left, top, sw, sh);
  else {
    ctx.save();
    ctx.translate(left + sw / 2, top + sh / 2);
    ctx.rotate(rot * Math.PI / 180);
    const r90 = rot === 90 || rot === 270;
    const dw = r90 ? sh : sw, dh = r90 ? sw : sh;
    ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
/** Vypálený titulek – stejný styl jako náhled v monitoru (src/core/captionlayout.js, src/ui/player.js). */
function drawCaption(ctx, text, W, H, st, active) {
  const fs = Math.round(H * CL.fontFrac(W, H, st));
  ctx.font = `700 ${fs}px ${CL.FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  const maxW = W * CL.WIDTH, lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
  }
  const lh = fs * 1.25;
  let y = H * (1 - (st.pos != null ? st.pos : (H > W ? 14 : 5)) / 100);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (st.box) {
      const w = ctx.measureText(lines[i]).width + fs * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(W / 2 - w / 2, y - lh + fs * 0.05, w, lh);
    } else {
      // obrys + měkký stín: čitelné i na světlém pozadí (bílé tričko, studio)
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = fs * 0.25; ctx.shadowOffsetY = fs * 0.04;
      ctx.lineWidth = Math.max(2, fs * 0.15); ctx.strokeStyle = 'rgba(0,0,0,0.92)';
      ctx.strokeText(lines[i], W / 2, y); ctx.restore();
    }
    ctx.fillStyle = st.color || '#fff';
    if (st.highlight && active >= 0) {
      // slovo po slovu (stejné zalomení), vyslovované slovo barvou zvýraznění
      const words = lines[i].split(' ');
      const sp = ctx.measureText(' ').width;
      const widths = words.map((w) => ctx.measureText(w).width);
      let x0 = W / 2 - (widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1)) / 2;
      const first = lines.slice(0, i).reduce((a, l) => a + l.split(' ').length, 0);
      ctx.textAlign = 'left';
      words.forEach((w, k) => {
        ctx.fillStyle = first + k === active ? st.highlight : (st.color || '#fff');
        ctx.fillText(w, x0, y - (st.box ? fs * 0.08 : 0));
        x0 += widths[k] + sp;
      });
      ctx.textAlign = 'center';
    } else ctx.fillText(lines[i], W / 2, y - (st.box ? fs * 0.08 : 0));
    y -= lh;
  }
}

/** Nadpis nahoře (seq.title) – bílé tučné písmo na tmavém podkladu, stejně jako náhled. */
function drawTitle(ctx, tl, W, H) {
  ctx.font = tl.font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = tl.fs * 1.28, padX = tl.fs * 0.4;
  let y = H * tl.top / 100;
  for (const line of tl.lines) {
    const w = ctx.measureText(line).width + padX * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(W / 2 - w / 2, y, w, lh);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, W / 2, y + lh / 2 + tl.fs * 0.04);
    y += lh;
  }
}

/* ---------- zvuk ---------- */
async function mixBlock(project, seq, t0, n) {
  const L = new Float32Array(n), R = new Float32Array(n);
  const t1 = t0 + n / SR;
  const solo = seq.tracks.audio.some((t) => t.solo);
  for (const tr of seq.tracks.audio) {
    if (tr.muted || (solo && !tr.solo)) continue;
    for (const c of tr.clips) {
      if (c.disabled) continue;
      const cs = Math.max(c.start, t0), ce = Math.min(clipEnd(c), t1);
      if (ce <= cs) continue;
      const m = project.mediaById(c.mediaId);
      const file = m && vfs.getFile(m.path);
      if (!file || !m.hasAudio) continue;
      const s0 = c.in + (cs - c.start), s1 = c.in + (ce - c.start);
      const pcm = await decodeAudioRange(file, s0, s1);
      const ratio = pcm.sampleRate / SR;
      const ch0 = pcm.channels[0], ch1 = pcm.channels[1] || ch0;
      const o0 = Math.round((cs - t0) * SR), cnt = Math.min(n - o0, Math.round((ce - cs) * SR));
      const g0 = dbToGain(c.gainDb || 0);
      for (let k = 0; k < cnt; k++) {
        const t = cs + k / SR;
        let g = g0;
        const into = t - c.start, left = clipEnd(c) - t;
        if (c.fadeIn > 0 && into < c.fadeIn) g *= Math.max(0, into / c.fadeIn);
        if (c.fadeOut > 0 && left < c.fadeOut) g *= Math.max(0, left / c.fadeOut);
        const x = k * ratio, i = Math.floor(x), f = x - i;
        const a0 = ch0[i] || 0, a1 = ch0[i + 1] !== undefined ? ch0[i + 1] : a0;
        const b0 = ch1[i] || 0, b1 = ch1[i + 1] !== undefined ? ch1[i + 1] : b0;
        L[o0 + k] += (a0 + (a1 - a0) * f) * g;
        R[o0 + k] += (b0 + (b1 - b0) * f) * g;
      }
    }
  }
  return [L, R];
}
/** Integrovaná hlasitost (LUFS) podle ITU BS.1770 s hradlováním. */
class Loudness {
  constructor() {
    this.f = [0, 1].map(() => ({ s1: [0, 0, 0, 0], s2: [0, 0, 0, 0] }));
    this.sub = []; this.acc = 0; this.cnt = 0;
  }
  push(chs) {
    const B1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], A1 = [-1.69065929318241, 0.73248077421585];
    const B2 = [1, -2, 1], A2 = [-1.99004745483398, 0.99007225036621];
    const n = chs[0].length;
    for (let k = 0; k < n; k++) {
      let e = 0;
      for (let c = 0; c < 2; c++) {
        const st = this.f[c];
        const x = chs[c][k];
        const y1 = B1[0] * x + B1[1] * st.s1[0] + B1[2] * st.s1[1] - A1[0] * st.s1[2] - A1[1] * st.s1[3];
        st.s1 = [x, st.s1[0], y1, st.s1[2]];
        const y2 = B2[0] * y1 + B2[1] * st.s2[0] + B2[2] * st.s2[1] - A2[0] * st.s2[2] - A2[1] * st.s2[3];
        st.s2 = [y1, st.s2[0], y2, st.s2[2]];
        e += y2 * y2;
      }
      this.acc += e; this.cnt++;
      if (this.cnt === SR / 10) { this.sub.push(this.acc / this.cnt); this.acc = 0; this.cnt = 0; }
    }
  }
  value() {
    const blocks = [];
    for (let i = 0; i + 4 <= this.sub.length; i++) blocks.push((this.sub[i] + this.sub[i + 1] + this.sub[i + 2] + this.sub[i + 3]) / 4);
    const lk = (z) => -0.691 + 10 * Math.log10(Math.max(1e-12, z));
    const abs = blocks.filter((z) => lk(z) > -70);
    if (!abs.length) return -70;
    const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const g = abs.filter((z) => lk(z) > rel);
    return lk(g.reduce((a, b) => a + b, 0) / Math.max(1, g.length));
  }
}
// měkký limiter: lineárně do 0,77 (−2,3 dBFS), pak plynule ke stropu 0,86 (−1,3 dBFS) – rezerva 0,3 dB na překmit kodéru, true peak ≤ −1 dBTP (změřeno: strop −1,0 dBFS dal po Opusu −0,8 dBTP)
const softClip = (x) => { const a = Math.abs(x); return a <= 0.77 ? x : Math.sign(x) * (0.77 + 0.09 * Math.tanh((a - 0.77) / 0.09)); };

/* ---------- export ---------- */
function captionsSrt(seq, rs, re) {
  const tc = (t) => { const ms = Math.round(Math.max(0, t) * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  return (seq.captions || []).filter((c) => c.end > rs && c.start < re)
    .map((c, i) => `${i + 1}\n${tc(c.start - rs)} --> ${tc(Math.min(c.end, re) - rs)}\n${c.text}\n`).join('\n');
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function pickOutput(output) {
  if (vfs.getHandle(output)) return output;
  const name = String(output).replace(/\\/g, '/').split('/').pop().replace(/\.[^.]+$/, '') + '.mp4';
  const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }], startIn: 'videos' });
  return vfs.registerSaveHandle(h, h.name);
}

async function exportSequence(project, seq, opts) {
  if (!window.VideoEncoder || !window.AudioEncoder) throw new Error('This browser cannot export video – use Google Chrome.');
  const fps = seq.fps || 25, W = seq.width, H = seq.height;
  const capStyle = CL.styleOf(seq);
  const titleL = CL.titleLines(seq); // nadpis nahoře – je součástí obrazu (vypaluje se vždy)
  const end = Math.max(...['video', 'audio'].flatMap((k) => seq.tracks[k].flatMap((t) => t.clips.map(clipEnd))), 0);
  let rs = 0, re = end;
  if (opts.range === 'inout' && seq.inPoint !== null && seq.outPoint !== null && seq.outPoint > seq.inPoint) { rs = seq.inPoint; re = Math.min(end, seq.outPoint); }
  if (re - rs < 1 / fps) throw new Error('The sequence is empty – nothing to export.');
  for (const m of project.media) if (!m.missing && !vfs.getFile(m.path)) m.missing = true;
  const used = new Set(['video', 'audio'].flatMap((k) => seq.tracks[k].flatMap((t) => t.clips.filter((c) => clipEnd(c) > rs && c.start < re).map((c) => c.mediaId))));
  const miss = [...used].map((id) => project.mediaById(id)).filter((m) => m && (m.missing || !vfs.getFile(m.path)));
  if (miss.length) throw new Error('Media not available: ' + miss.map((m) => m.name).join(', ') + ' – allow access or import them again.');

  const output = await pickOutput(opts.output);
  const check = () => { if (opts.signal && opts.signal.cancelled) throw new Error('Export cancelled.'); };
  const progress = (p, msg) => { if (opts.onProgress) opts.onProgress(Math.min(0.99, p), msg); };

  // kodéry
  const level = W * H > 1920 * 1088 ? '640033' : '640028';
  const vcfg = { codec: 'avc1.' + level, width: W, height: H, bitrate: Math.round(Math.min(40e6, Math.max(4e6, W * H * fps * 0.2))), framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
  if (!(await VideoEncoder.isConfigSupported(vcfg)).supported) { vcfg.codec = 'avc1.42002a'; }
  const hasAudio = seq.tracks.audio.some((t) => !t.muted && t.clips.some((c) => clipEnd(c) > rs && c.start < re));
  // zvuk AAC (Chrome na Windows / Macu); když ho prohlížeč neumí, Opus v MP4 (přehraje Chrome, VLC, Windows)
  let acfg = { codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192000 };
  let aCodec = 'aac';
  if (hasAudio && !(await AudioEncoder.isConfigSupported(acfg)).supported) {
    acfg = { codec: 'opus', sampleRate: SR, numberOfChannels: 2, bitrate: 160000 };
    aCodec = 'opus';
    if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('This browser cannot encode audio – use Google Chrome.');
  }

  const handle = vfs.getHandle(output);
  const writable = await handle.createWritable();
  const mux = new Mp4Writer(writable, { video: { width: W, height: H, fps }, audio: hasAudio ? { sampleRate: SR, channels: 2, bitrate: acfg.bitrate, codec: aCodec } : null });
  await mux.start();
  let encErr = null;
  const venc = new VideoEncoder({ output: (c, m) => mux.addVideo(c, m), error: (e) => { encErr = e; } });
  venc.configure(vcfg);
  const aenc = hasAudio ? new AudioEncoder({ output: (c, m) => mux.addAudio(c, m), error: (e) => { encErr = e; } }) : null;
  if (aenc) aenc.configure(acfg);

  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { alpha: false });
  const sources = new Map(); // clip.id -> VideoSource
  const srcFor = async (clip) => {
    if (!sources.has(clip.id)) {
      const m = project.mediaById(clip.mediaId);
      sources.set(clip.id, VideoSource.open(vfs.getFile(m.path)));
    }
    return sources.get(clip.id);
  };
  const frameOf = async (clip, tSeq) => (await srcFor(clip)).frameAt(clip.in + (tSeq - clip.start));

  // hlasitost: první průchod (měření)
  let gain = 1;
  const target = LOUDNESS[opts.loudness || 'off'];
  const nFrames = Math.round((re - rs) * fps);
  // zvuk po sekundových blocích podle počtu vzorků: délka 16,000 01 s (snímky) dávala poslední blok s 0 vzorky → AudioData spadlo (kolo 4)
  const aSizes = audioBlocks(re - rs, SR), aBlocks = aSizes.length;
  if (hasAudio && target != null) {
    const meter = new Loudness();
    for (let b = 0; b < aBlocks; b++) {
      check();
      const t0 = rs + b, n = aSizes[b];
      meter.push(await mixBlock(project, seq, t0, n));
      progress(0.15 * (b + 1) / aBlocks, 'measuring loudness');
    }
    const lufs = meter.value();
    if (lufs > -69) gain = Math.pow(10, (target - lufs) / 20);
  }
  const base = hasAudio && target != null ? 0.15 : 0;

  try {
    let aNext = 0; // další zvukový blok (s)
    for (let i = 0; i < nFrames; i++) {
      check();
      if (encErr) throw encErr;
      const t = rs + i / fps + 1e-6;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const cr = crossAt(seq, t);
      const used = new Set();
      if (cr) {
        const p = Math.max(0, Math.min(1, (t - cr.a) / cr.d));
        for (const [c, alpha] of [[cr.L, 1], [cr.R, p]]) {
          const f = await frameOf(c, t);
          drawClip(ctx, f, c, project.mediaById(c.mediaId), W, H, alpha); f.close();
          used.add(c.id);
        }
      } else {
        const vc = topVideo(seq, t);
        if (vc) {
          const f = await frameOf(vc, t);
          drawClip(ctx, f, vc, project.mediaById(vc.mediaId), W, H, 1); f.close();
          used.add(vc.id);
          // Dip to Black / White
          let dipA = 0, col = '#000';
          if (vc.vIn && vc.vIn.type !== 'cross' && t - vc.start < vc.vIn.dur) { dipA = 1 - (t - vc.start) / vc.vIn.dur; col = vc.vIn.type === 'dipWhite' ? '#fff' : '#000'; }
          if (vc.vOut && clipEnd(vc) - t < vc.vOut.dur) { const a2 = 1 - (clipEnd(vc) - t) / vc.vOut.dur; if (a2 > dipA) { dipA = a2; col = vc.vOut.type === 'dipWhite' ? '#fff' : '#000'; } }
          if (dipA > 0) { ctx.globalAlpha = Math.min(1, dipA); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
        }
      }
      if (titleL) drawTitle(ctx, titleL, W, H);
      if (opts.burnCaptions) {
        const cap = (seq.captions || []).find((c) => c.start <= t && c.end > t);
        if (cap) drawCaption(ctx, cap.text, W, H, capStyle, capStyle.highlight ? CL.activeWord(cap, t) : -1);
      }
      // zavřít dekodéry klipů, které už skončily
      for (const [id, sp] of sources) {
        if (used.has(id)) continue;
        const c = seq.tracks.video.flatMap((tr) => tr.clips).find((x) => x.id === id);
        if (!c || clipEnd(c) < t - 0.5) { sources.delete(id); sp.then((s) => s.close()).catch(() => {}); }
      }
      const vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: i % Math.round(fps * 2) === 0 });
      vf.close();
      while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
      // zvuk po sekundách, souběžně s obrazem (proložený zápis)
      while (aenc && aNext < aBlocks && aNext <= (i + 1) / fps) {
        const t0 = rs + aNext, n = aSizes[aNext];
        const [L, R] = await mixBlock(project, seq, t0, n);
        for (let k = 0; k < n; k++) { L[k] = softClip(L[k] * gain); R[k] = softClip(R[k] * gain); }
        const data = new Float32Array(n * 2); data.set(L, 0); data.set(R, n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(aNext * 1e6), data });
        aenc.encode(ad); ad.close();
        aNext++;
      }
      if (i % 5 === 0) progress(base + (1 - base) * (i + 1) / nFrames, `frame ${i + 1} / ${nFrames}`);
    }
    await venc.flush();
    if (aenc) await aenc.flush();
    if (encErr) throw encErr;
    const size = await mux.finish();
    if (opts.srtSidecar && (seq.captions || []).length) download(String(output).split('/').pop().replace(/\.mp4$/i, '') + '.srt', captionsSrt(seq, rs, re));
    if (opts.onProgress) opts.onProgress(1, 'done');
    return { output, sizeMB: Math.round(size / 1048576 * 10) / 10, audioCodec: hasAudio ? aCodec : null };
  } catch (e) {
    try { await writable.abort(); } catch (e2) { /* už zavřeno */ }
    throw e;
  } finally {
    try { venc.close(); } catch (e) {}
    try { if (aenc) aenc.close(); } catch (e) {}
    for (const sp of sources.values()) sp.then((s) => s.close()).catch(() => {});
  }
}

// který zvukový kodek tenhle prohlížeč umí (zobrazí se v okně Export)
const exportsObj = module.exports;
exportsObj.audioLabel = 'AAC 192 kb/s';
if (self.AudioEncoder) {
  AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192000 })
    .then((r) => { if (!r.supported) exportsObj.audioLabel = 'Opus 160 kb/s – no AAC encoder on this computer (Windows N: install the Media Feature Pack)'; })
    .catch(() => {});
}
Object.assign(exportsObj, { exportSequence, captionsSrt, FORMATS, LOUDNESS, videoSegments: () => [], videoFilter: () => '' });
