'use strict';
/* Dekódování přes WebCodecs (hardware v Chrome):
 *   VideoSource.frameAt(t)   – snímek zdroje v čase t (pro export; postupné čtení dopředu je rychlé)
 *   decodeAudioRange(...)    – PCM úseku zvuku (export, přepis)
 *   audioPeaks(...)          – průběh zvuku pro časovou osu (100 hodnot / s, logaritmicky jako desktop) */
const { openMp4, SampleReader, sampleAt } = require('./mp4');

class VideoSource {
  constructor(file, track) {
    this.file = file; this.t = track; this.reader = new SampleReader(file, 16 << 20);
    this.queue = []; this.feed = 0; this.dec = null; this.waiters = []; this.err = null; this.lastTs = -1;
  }
  static async open(file) {
    const mp = await openMp4(file);
    if (!mp.video) throw new Error('The file has no video track.');
    if (mp.video.codecName !== 'h264') throw new Error('Only H.264 video is supported in the web version.');
    return new VideoSource(file, mp.video);
  }
  reset(fromIndex) {
    if (this.dec) { try { this.dec.close(); } catch (e) {} }
    for (const f of this.queue) f.close();
    this.queue = [];
    this.err = null;
    this.dec = new VideoDecoder({
      output: (f) => { this.queue.push(f); this.queue.sort((a, b) => a.timestamp - b.timestamp); this.wake(); },
      error: (e) => { this.err = e; this.wake(); },
    });
    this.dec.configure({ codec: this.t.codec, codedWidth: this.t.width, codedHeight: this.t.height, description: this.t.description, hardwareAcceleration: 'no-preference' });
    this.feed = fromIndex;
    this.flushed = false;
  }
  wake() { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
  waitOutput(ms = 300) { return new Promise((r) => { this.waiters.push(r); setTimeout(r, ms); }); }
  async push(i) {
    const S = this.t.samples;
    const data = await this.reader.read(S.offset[i], S.size[i]);
    // „klíčový“ podle MP4 (stss) nemusí být IDR (open GOP, recovery point) – Chrome pak dekódování odmítne;
    // jako klíčový tedy posílat jen skutečný IDR snímek
    const key = !!S.sync[i] && this.isIdrData(data);
    this.dec.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: Math.round(S.pts[i] * 1e6), duration: Math.round(S.dur[i] * 1e6), data }));
  }
  /** Obsahuje vzorek H.264 (AVCC, délky NAL 1–4 B) řez IDR (nal_unit_type 5)? Jiné kodeky: věřit stss. */
  isIdrData(data) {
    const d = this.t.description;
    if (!d || this.t.codecName !== 'h264' || d.length < 5) return true;
    const L = (d[4] & 3) + 1;
    for (let p = 0; p + L < data.length;) {
      let n = 0; for (let k = 0; k < L; k++) n = n * 256 + data[p + k];
      const type = data[p + L] & 0x1f;
      if (type === 5) return true;
      if (type === 1) return false; // obyčejný řez – nejde o IDR
      p += L + n;
    }
    return false;
  }
  /** Je vzorek i skutečný klíčový (IDR) snímek? Výsledek se pamatuje. */
  async isIdr(i) {
    if (!this.t.samples.sync[i]) return false;
    if (!this.idr) this.idr = new Map();
    if (!this.idr.has(i)) this.idr.set(i, this.isIdrData(await this.reader.read(this.t.samples.offset[i], this.t.samples.size[i])));
    return this.idr.get(i);
  }
  /** Snímek v čase t (sekundy zdroje). Vrací klon VideoFrame – volající ho musí zavřít. */
  async frameAt(t) {
    const S = this.t.samples;
    const target = sampleAt(this.t, Math.max(0, t));
    const tts = Math.round(S.pts[target] * 1e6);
    // dozadu nebo daleko dopředu = začít od klíčového snímku
    const needReset = !this.dec || tts < this.lastTs || this.err || (target > this.feed + 2 * (this.t.fps || 25) * 4);
    if (needReset) {
      let k = target; while (k > 0 && !(await this.isIdr(k))) k--;
      if (!this.dec || needReset) this.reset(k);
    }
    this.lastTs = tts;
    // časový limit (AI tok S4: u snímku na konci souboru se dekodér zasekl a s ním most aplikace na 10 min)
    // limit 8 s BEZ POSTUPU (nový vzorek / snímek) – pomalý, ale běžící seek (4K, dlouhé GOP) nespadne (revize #17)
    let deadline = Date.now() + 8000, lastQ = -1, lastF = -1;
    for (let guard = 0; guard < 100000; guard++) {
      if (this.err) throw this.err;
      if (this.queue.length !== lastQ || this.feed !== lastF) { lastQ = this.queue.length; lastF = this.feed; deadline = Date.now() + 8000; }
      if (Date.now() > deadline) { this.err = new Error('Decoding timeout at ' + t.toFixed(3) + ' s'); throw this.err; }
      // zahodit staré snímky, ponechat poslední <= cíl
      while (this.queue.length > 1 && this.queue[1].timestamp <= tts) this.queue.shift().close();
      // fronta je seřazená a starší snímky jsou pryč: [0] = nejnovější <= cíl (nebo první po něm)
      if (this.queue.length && this.queue[this.queue.length - 1].timestamp >= tts) return this.queue[0].clone();
      if (this.feed < S.n) {
        if (this.dec.decodeQueueSize > 6) { await this.waitOutput(50); continue; }
        await this.push(this.feed++);
        if (this.queue.length === 0 && this.dec.decodeQueueSize > 3) await this.waitOutput(20);
      } else if (!this.flushed) {
        this.flushed = true;
        await Promise.race([this.dec.flush(), new Promise((r) => setTimeout(r, 3000))]);
      } else {
        if (this.queue.length) return this.queue[this.queue.length - 1].clone();
        throw new Error('Frame not found at ' + t.toFixed(3) + ' s');
      }
    }
    throw new Error('Decoding stalled');
  }
  close() { if (this.dec) { try { this.dec.close(); } catch (e) {} } for (const f of this.queue) f.close(); this.queue = []; }
}

function audioConfig(tr) {
  return { codec: tr.codec, sampleRate: tr.sampleRate, numberOfChannels: tr.channels, description: tr.description };
}
/** Projde zvukové pakety [i0, i1) a pro každý dekódovaný blok zavolá onData(planes Float32Array[], tStart). */
async function decodePackets(file, tr, i0, i1, onData) {
  const S = tr.samples;
  const reader = new SampleReader(file, 8 << 20);
  let err = null;
  const dec = new AudioDecoder({
    output: (ad) => {
      try {
        const planes = [];
        for (let c = 0; c < ad.numberOfChannels; c++) {
          const p = new Float32Array(ad.numberOfFrames);
          ad.copyTo(p, { planeIndex: c, format: 'f32-planar' });
          planes.push(p);
        }
        onData(planes, ad.timestamp / 1e6, ad.sampleRate);
      } finally { ad.close(); }
    },
    error: (e) => { err = e; },
  });
  dec.configure(audioConfig(tr));
  for (let i = i0; i < i1; i++) {
    if (err) throw err;
    const data = await reader.read(S.offset[i], S.size[i]);
    dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(S.pts[i] * 1e6), duration: Math.round(S.dur[i] * 1e6), data }));
    if (dec.decodeQueueSize > 64) await new Promise((r) => setTimeout(r, 0));
  }
  await dec.flush();
  dec.close();
  if (err) throw err;
}

/** PCM úseku [t0, t1) zdroje: { sampleRate, channels: Float32Array[] } (mimo zvuk = ticho). */
async function decodeAudioRange(file, t0, t1) {
  const mp = await openMp4(file);
  const tr = mp.audio;
  if (!tr || tr.codecName !== 'aac') throw new Error('Only AAC audio is supported in the web version.');
  const sr = tr.sampleRate, ch = Math.max(1, Math.min(2, tr.channels || 2));
  const n = Math.max(0, Math.round((t1 - t0) * sr));
  const out = Array.from({ length: ch }, () => new Float32Array(n));
  const S = tr.samples;
  let i0 = sampleAt(tr, t0); i0 = Math.max(0, i0 - 2); // AAC potřebuje pár paketů předem
  let i1 = sampleAt(tr, t1) + 2; i1 = Math.min(S.n, i1);
  await decodePackets(file, tr, i0, i1, (planes, ts) => {
    const off = Math.round((ts - t0) * sr);
    for (let c = 0; c < ch; c++) {
      const src = planes[Math.min(c, planes.length - 1)], dst = out[c];
      for (let k = 0; k < src.length; k++) { const j = off + k; if (j >= 0 && j < n) dst[j] = src[k]; }
    }
  });
  return { sampleRate: sr, channels: out };
}

/** Průběh zvuku celého souboru: Uint8Array, 100 hodnot / s (0–255, −60 dB … 0 dB). */
async function audioPeaks(file, onProgress) {
  const mp = await openMp4(file);
  const tr = mp.audio;
  if (!tr || tr.codecName !== 'aac') return new Uint8Array(0);
  const RATE = 100;
  const len = Math.ceil(mp.duration * RATE) + 1;
  const peak = new Float32Array(len);
  const S = tr.samples;
  const step = 4000;
  for (let a = 0; a < S.n; a += step) {
    await decodePackets(file, tr, Math.max(0, a - (a ? 2 : 0)), Math.min(S.n, a + step), (planes, ts, sr) => {
      const p0 = planes[0], p1 = planes[1] || planes[0];
      for (let k = 0; k < p0.length; k++) {
        const j = Math.floor((ts + k / sr) * RATE);
        if (j < 0 || j >= len) continue;
        const v = Math.max(Math.abs(p0[k]), Math.abs(p1[k]));
        if (v > peak[j]) peak[j] = v;
      }
    });
    if (onProgress) onProgress(Math.min(1, (a + step) / S.n));
  }
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const db = 20 * Math.log10(Math.max(1 / 32768, peak[i]));
    arr[i] = Math.max(0, Math.min(255, Math.round((db + 60) / 60 * 255)));
  }
  return arr;
}

module.exports = { VideoSource, decodeAudioRange, audioPeaks };
