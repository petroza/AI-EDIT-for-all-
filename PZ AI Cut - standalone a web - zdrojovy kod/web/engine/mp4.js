'use strict';
/* Čtení MP4/MOV v prohlížeči bez knihoven: najde box moov, přečte z něj stopy (H.264 video, AAC zvuk)
 * a tabulky vzorků. Data vzorků se pak čtou přímo ze souboru po kouscích (file.slice) – 2GB soubor se
 * nikdy nenačítá celý do paměti. Časy vzorků jsou v sekundách prezentace (včetně edit listu jako <video>). */

const td = new TextDecoder('latin1');

async function readBytes(file, a, b) { return new Uint8Array(await file.slice(a, b).arrayBuffer()); }

/** Projde boxy nejvyšší úrovně a vrátí { moov: Uint8Array, moovOffset } (soubor se čte jen po hlavičkách). */
async function findMoov(file) {
  let pos = 0;
  while (pos + 8 <= file.size) {
    const h = await readBytes(file, pos, pos + 16);
    const dv = new DataView(h.buffer);
    let size = dv.getUint32(0);
    const type = td.decode(h.subarray(4, 8));
    let hdr = 8;
    if (size === 1) { size = Number(dv.getBigUint64(8)); hdr = 16; } else if (size === 0) size = file.size - pos;
    if (size < hdr) throw new Error('Damaged MP4 file.');
    if (type === 'moov') return { moov: await readBytes(file, pos, pos + size), moovOffset: pos };
    pos += size;
  }
  throw new Error('Not an MP4/MOV file (no moov box).');
}

/* ---------- boxy ---------- */
function* boxes(u8, start, end) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = start;
  while (p + 8 <= end) {
    let size = dv.getUint32(p);
    const type = td.decode(u8.subarray(p + 4, p + 8));
    let hdr = 8;
    if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hdr = 16; } else if (size === 0) size = end - p;
    if (size < hdr || p + size > end) break;
    yield { type, start: p + hdr, end: p + size, boxStart: p };
    p += size;
  }
}
function child(u8, box, type) { for (const b of boxes(u8, box.start, box.end)) if (b.type === type) return b; return null; }
function path(u8, box, types) { let b = box; for (const t of types) { b = b && child(u8, b, t); if (!b) return null; } return b; }

function parseMoov(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const root = { start: 8, end: u8.length };
  const mvhd = child(u8, root, 'mvhd');
  let movieScale = 1000, movieDur = 0;
  if (mvhd) {
    const v = u8[mvhd.start];
    if (v === 1) { movieScale = dv.getUint32(mvhd.start + 20); movieDur = Number(dv.getBigUint64(mvhd.start + 24)); } else { movieScale = dv.getUint32(mvhd.start + 12); movieDur = dv.getUint32(mvhd.start + 16); }
  }
  const tracks = [];
  for (const trak of boxes(u8, root.start, root.end)) {
    if (trak.type !== 'trak') continue;
    try { const t = parseTrak(u8, dv, trak, movieScale); if (t) tracks.push(t); } catch (e) { console.warn('trak', e); }
  }
  return { movieScale, duration: movieDur / movieScale, tracks };
}

function parseTrak(u8, dv, trak, movieScale) {
  const tkhd = child(u8, trak, 'tkhd');
  const mdia = child(u8, trak, 'mdia');
  if (!tkhd || !mdia) return null;
  // tkhd: id a matice (otočení videa z mobilu)
  const tv = u8[tkhd.start];
  const idOff = tkhd.start + (tv === 1 ? 20 : 12);
  const id = dv.getUint32(idOff);
  const mOff = tkhd.start + (tv === 1 ? 52 : 40);
  const a = dv.getInt32(mOff) / 65536, b = dv.getInt32(mOff + 4) / 65536;
  let rotation = Math.round(Math.atan2(b, a) * 180 / Math.PI);
  rotation = ((rotation % 360) + 360) % 360;
  const mdhd = child(u8, mdia, 'mdhd');
  const mv = u8[mdhd.start];
  const timescale = dv.getUint32(mdhd.start + (mv === 1 ? 20 : 12));
  const mediaDur = mv === 1 ? Number(dv.getBigUint64(mdhd.start + 24)) : dv.getUint32(mdhd.start + 16);
  const hdlr = child(u8, mdia, 'hdlr');
  const handler = td.decode(u8.subarray(hdlr.start + 8, hdlr.start + 12));
  if (handler !== 'vide' && handler !== 'soun') return null;
  // edit list: posun začátku (B-snímky, AAC priming) a případná prázdná úvodní pauza
  let mediaTime = 0, delay = 0;
  const elst = path(u8, trak, ['edts', 'elst']);
  if (elst) {
    const ev = u8[elst.start];
    const n = dv.getUint32(elst.start + 4);
    let p = elst.start + 8;
    for (let i = 0; i < n; i++) {
      const segDur = ev === 1 ? Number(dv.getBigUint64(p)) : dv.getUint32(p);
      const mt = ev === 1 ? Number(dv.getBigInt64(p + 8)) : dv.getInt32(p + 4);
      p += ev === 1 ? 20 : 12;
      if (mt === -1) { delay += segDur / movieScale; continue; }
      mediaTime = mt; break;
    }
  }
  const stbl = path(u8, mdia, ['minf', 'stbl']);
  const stsd = child(u8, stbl, 'stsd');
  const entry = [...boxes(u8, stsd.start + 8, stsd.end)][0];
  if (!entry) return null;
  const t = { id, kind: handler === 'vide' ? 'video' : 'audio', format: entry.type, timescale, mediaDuration: mediaDur / timescale, mediaTime, delay, rotation };
  if (t.kind === 'video') {
    t.width = dv.getUint16(entry.start + 24);
    t.height = dv.getUint16(entry.start + 26);
    const cfgBox = child(u8, { start: entry.start + 78, end: entry.end }, 'avcC') || child(u8, { start: entry.start + 78, end: entry.end }, 'hvcC');
    if (cfgBox) {
      t.description = u8.slice(cfgBox.start, cfgBox.end);
      if (cfgBox.type === 'avcC') {
        const hex = (x) => x.toString(16).padStart(2, '0');
        t.codec = `${entry.type === 'avc3' ? 'avc3' : 'avc1'}.${hex(t.description[1])}${hex(t.description[2])}${hex(t.description[3])}`;
        t.codecName = 'h264';
      } else { t.codecName = 'hevc'; t.codec = 'hvc1'; }
    } else t.codecName = entry.type;
  } else {
    const ver = dv.getUint16(entry.start + 8);
    t.channels = dv.getUint16(entry.start + 16);
    t.sampleRate = dv.getUint32(entry.start + 24) >>> 16;
    let childStart = entry.start + 28 + (ver === 1 ? 16 : ver === 2 ? 36 : 0);
    if (ver === 2) { t.sampleRate = Math.round(dv.getFloat64(entry.start + 32)); t.channels = dv.getUint32(entry.start + 40); }
    const esds = findDeep(u8, { start: childStart, end: entry.end }, 'esds');
    if (entry.type === 'mp4a' && esds) {
      const asc = parseEsds(u8, esds);
      if (asc) {
        t.description = asc;
        const aot = asc[0] >> 3;
        t.codec = 'mp4a.40.' + (aot || 2);
        t.codecName = 'aac';
        // vzorkovací frekvence a kanály z AudioSpecificConfig (spolehlivější než hlavička vzorku)
        const fi = ((asc[0] & 7) << 1) | (asc[1] >> 7);
        const RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
        if (RATES[fi]) t.sampleRate = RATES[fi];
        const ch = (asc[1] >> 3) & 15;
        if (ch > 0 && ch < 8) t.channels = ch;
      }
    } else t.codecName = entry.type;
  }
  buildSamples(u8, dv, stbl, t);
  return t;
}
function findDeep(u8, box, type) {
  for (const b of boxes(u8, box.start, box.end)) {
    if (b.type === type) return b;
    if (b.type === 'wave') { const r = findDeep(u8, b, type); if (r) return r; }
  }
  return null;
}
function parseEsds(u8, box) {
  let p = box.start + 4;
  const len = () => { let n = 0; for (let i = 0; i < 4; i++) { const c = u8[p++]; n = (n << 7) | (c & 0x7f); if (!(c & 0x80)) break; } return n; };
  while (p < box.end) {
    const tag = u8[p++];
    const l = len();
    if (tag === 0x03) { p += 2; const fl = u8[p++]; if (fl & 0x80) p += 2; if (fl & 0x40) p += 1 + u8[p]; if (fl & 0x20) p += 2; continue; }
    if (tag === 0x04) { p += 13; continue; }
    if (tag === 0x05) return u8.slice(p, p + l);
    p += l;
  }
  return null;
}

function buildSamples(u8, dv, stbl, t) {
  const get = (ty) => child(u8, stbl, ty);
  const stsz = get('stsz');
  const n = dv.getUint32(stsz.start + 8);
  const fixed = dv.getUint32(stsz.start + 4);
  const size = new Uint32Array(n);
  for (let i = 0; i < n; i++) size[i] = fixed || dv.getUint32(stsz.start + 12 + i * 4);
  // dts ze stts
  const dts = new Float64Array(n);
  const stts = get('stts');
  { let i = 0, d = 0; const c = dv.getUint32(stts.start + 4);
    for (let e = 0; e < c && i < n; e++) { const cnt = dv.getUint32(stts.start + 8 + e * 8), del = dv.getUint32(stts.start + 12 + e * 8); for (let k = 0; k < cnt && i < n; k++) { dts[i++] = d; d += del; } } }
  // cts = dts + ctts
  const cts = new Float64Array(dts);
  const ctts = get('ctts');
  if (ctts) {
    const v = u8[ctts.start]; const c = dv.getUint32(ctts.start + 4); let i = 0;
    for (let e = 0; e < c && i < n; e++) { const cnt = dv.getUint32(ctts.start + 8 + e * 8); const off = v === 1 ? dv.getInt32(ctts.start + 12 + e * 8) : dv.getUint32(ctts.start + 12 + e * 8); for (let k = 0; k < cnt && i < n; k++) cts[i] = dts[i++] + off; }
  }
  // klíčové snímky
  const sync = new Uint8Array(n);
  const stss = get('stss');
  if (stss) { const c = dv.getUint32(stss.start + 4); for (let e = 0; e < c; e++) { const k = dv.getUint32(stss.start + 8 + e * 4) - 1; if (k < n) sync[k] = 1; } } else sync.fill(1);
  // offsety: stsc + stco/co64
  const stco = get('stco'), co64 = get('co64');
  const chunkCount = dv.getUint32((stco || co64).start + 4);
  const chunkOff = (k) => (stco ? dv.getUint32(stco.start + 8 + k * 4) : Number(dv.getBigUint64(co64.start + 8 + k * 8)));
  const stsc = get('stsc');
  const sc = dv.getUint32(stsc.start + 4);
  const offset = new Float64Array(n);
  let s = 0;
  for (let e = 0; e < sc; e++) {
    const first = dv.getUint32(stsc.start + 8 + e * 12) - 1;
    const per = dv.getUint32(stsc.start + 12 + e * 12);
    const nextFirst = e + 1 < sc ? dv.getUint32(stsc.start + 20 + e * 12) - 1 : chunkCount;
    for (let ch = first; ch < nextFirst && s < n; ch++) {
      let o = chunkOff(ch);
      for (let k = 0; k < per && s < n; k++) { offset[s] = o; o += size[s]; s++; }
    }
  }
  // čas prezentace v sekundách
  const pts = new Float64Array(n);
  for (let i = 0; i < n; i++) pts[i] = (cts[i] - t.mediaTime) / t.timescale + t.delay;
  const dur = new Float64Array(n);
  for (let i = 0; i < n; i++) dur[i] = ((i + 1 < n ? dts[i + 1] : dts[i] + (n > 1 ? dts[1] - dts[0] : 0)) - dts[i]) / t.timescale;
  t.samples = { n, size, offset, pts, dur, sync };
  // pořadí podle času prezentace (B-snímky) pro hledání snímku v čase
  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => pts[x] - pts[y]);
  t.presOrder = Uint32Array.from(order);
  if (t.kind === 'video') {
    const d = [];
    for (let i = 1; i < Math.min(n, 200); i++) d.push(dts[i] - dts[i - 1]);
    d.sort((x, y) => x - y);
    const mid = d.length ? d[d.length >> 1] : 0;
    t.fps = mid ? Math.round(t.timescale / mid * 1000) / 1000 : 25;
  }
}

/** Čtení dat vzorků s vyrovnávací pamětí (sousední vzorky z jednoho kusu souboru). */
class SampleReader {
  constructor(file, win = 8 << 20) { this.file = file; this.win = win; this.a = 0; this.b = 0; this.buf = null; }
  async read(off, size) {
    if (!this.buf || off < this.a || off + size > this.b) {
      this.a = off; this.b = Math.min(this.file.size, off + Math.max(size, this.win));
      this.buf = new Uint8Array(await this.file.slice(this.a, this.b).arrayBuffer());
    }
    return this.buf.subarray(off - this.a, off - this.a + size);
  }
}

const cache = new WeakMap();
/** Otevře soubor: { duration, video, audio } (stopy s tabulkami vzorků). */
async function openMp4(file) {
  if (cache.has(file)) return cache.get(file);
  const job = (async () => {
    const { moov } = await findMoov(file);
    const info = parseMoov(moov);
    const video = info.tracks.find((t) => t.kind === 'video') || null;
    const audio = info.tracks.find((t) => t.kind === 'audio') || null;
    let duration = info.duration;
    if (!duration) duration = Math.max(video ? video.mediaDuration : 0, audio ? audio.mediaDuration : 0);
    return { duration, video, audio };
  })();
  cache.set(file, job);
  job.catch(() => cache.delete(file));
  return job;
}

/** Index vzorku, který se zobrazuje v čase t (podle prezentace). */
function sampleAt(track, t) {
  const { pts } = track.samples, ord = track.presOrder;
  let lo = 0, hi = ord.length - 1, ans = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (pts[ord[m]] <= t + 1e-6) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ord[ans];
}

module.exports = { openMp4, SampleReader, sampleAt };
