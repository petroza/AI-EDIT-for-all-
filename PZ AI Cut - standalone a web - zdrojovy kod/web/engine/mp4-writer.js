'use strict';
/* Zápis MP4 (H.264 + AAC) přímo na disk uživatele přes FileSystemWritableFileStream:
 * ftyp, mdat (vzorky průběžně, 64bit velikost), na konci moov. Bez knihoven. */

const enc = new TextEncoder();
function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0); return b; }
function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n & 0xffff); return b; }
function u64(n) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(Math.max(0, Math.round(n)))); return b; }
function cat(parts) {
  let len = 0; for (const p of parts) len += p.length;
  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function box(type, ...parts) { const body = cat(parts); return cat([u32(body.length + 8), enc.encode(type), body]); }
function full(type, ver, flags, ...parts) { return box(type, new Uint8Array([ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts); }
const zeros = (n) => new Uint8Array(n);
const MATRIX = cat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

class Mp4Writer {
  /** @param writable FileSystemWritableFileStream */
  constructor(writable, { video, audio }) {
    this.w = writable; this.pos = 0;
    this.video = video ? { ...video, sizes: [], offsets: [], keys: [], durs: [], timescale: 90000 } : null;
    this.audio = audio ? { ...audio, sizes: [], offsets: [], durs: [], timescale: audio.sampleRate } : null;
    this.queue = Promise.resolve();
  }
  write(data) {
    const pos = this.pos; this.pos += data.length;
    this.queue = this.queue.then(() => this.w.write({ type: 'write', position: pos, data }));
    return pos;
  }
  async start() {
    this.write(box('ftyp', enc.encode('isom'), u32(512), enc.encode('isom'), enc.encode('iso2'), enc.encode('avc1'), enc.encode('mp41')));
    this.mdatPos = this.pos;
    this.write(cat([u32(1), enc.encode('mdat'), u64(0)]));
  }
  addVideo(chunk, meta) {
    const v = this.video;
    if (meta && meta.decoderConfig && meta.decoderConfig.description && !v.avcC) v.avcC = new Uint8Array(meta.decoderConfig.description);
    const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
    v.offsets.push(this.write(data)); v.sizes.push(data.length); v.keys.push(chunk.type === 'key');
  }
  addAudio(chunk, meta) {
    const a = this.audio;
    if (meta && meta.decoderConfig && meta.decoderConfig.description && !a.asc) {
      a.asc = new Uint8Array(meta.decoderConfig.description);
      // Opus: description = OpusHead (little-endian) -> pre-skip
      if (a.codec === 'opus' && a.asc.length >= 12 && String.fromCharCode(...a.asc.subarray(0, 8)) === 'OpusHead') a.preSkip = a.asc[10] | (a.asc[11] << 8);
    }
    const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
    a.offsets.push(this.write(data)); a.sizes.push(data.length);
    a.durs.push(Math.max(1, Math.round((chunk.duration || (a.codec === 'opus' ? 960 : 1024) / a.sampleRate * 1e6) / 1e6 * a.sampleRate)));
  }
  async finish() {
    const mdatSize = this.pos - this.mdatPos;
    const traks = [];
    let id = 1, movieDur = 0;
    if (this.video && this.video.sizes.length) {
      const v = this.video;
      const delta = Math.round(v.timescale / v.fps);
      const dur = delta * v.sizes.length;
      movieDur = Math.max(movieDur, dur / v.timescale);
      traks.push(this.trak(id++, 'vide', v, [[v.sizes.length, delta]], dur));
    }
    if (this.audio && this.audio.sizes.length) {
      const a = this.audio;
      const stts = [];
      for (const d of a.durs) { const last = stts[stts.length - 1]; if (last && last[1] === d) last[0]++; else stts.push([1, d]); }
      const dur = a.durs.reduce((x, y) => x + y, 0);
      movieDur = Math.max(movieDur, dur / a.timescale);
      traks.push(this.trak(id++, 'soun', a, stts, dur));
    }
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(Math.round(movieDur * 1000)), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(id));
    const moov = box('moov', mvhd, ...traks);
    this.write(moov);
    // velikost mdat (64 bit) až teď
    await this.queue;
    await this.w.write({ type: 'write', position: this.mdatPos + 8, data: u64(mdatSize) });
    await this.w.close();
    return this.pos;
  }
  trak(id, kind, t, stts, dur) {
    const isV = kind === 'vide';
    const mvDur = Math.round(dur / t.timescale * 1000);
    const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(mvDur), zeros(8), u16(0), u16(0), u16(isV ? 0 : 0x0100), u16(0), MATRIX,
      u32(isV ? t.width << 16 : 0), u32(isV ? t.height << 16 : 0));
    const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(t.timescale), u32(dur), u16(0x55c4), u16(0));
    const hdlr = full('hdlr', 0, 0, u32(0), enc.encode(kind), zeros(12), enc.encode(isV ? 'VideoHandler\0' : 'SoundHandler\0'));
    const xmhd = isV ? full('vmhd', 0, 1, zeros(8)) : full('smhd', 0, 0, zeros(4));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    let entry;
    if (isV) {
      entry = box('avc1', zeros(6), u16(1), zeros(16), u16(t.width), u16(t.height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xffff),
        box('avcC', t.avcC || new Uint8Array(0)));
    } else if (t.codec === 'opus') {
      // Opus v MP4 (záloha, když prohlížeč neumí AAC): dOps je big-endian, pre-skip z OpusHead kodéru
      const pre = t.preSkip != null ? t.preSkip : 312;
      const dops = box('dOps', new Uint8Array([0, t.channels]), u16(pre), u32(t.sampleRate), u16(0), new Uint8Array([0]));
      entry = box('Opus', zeros(6), u16(1), zeros(8), u16(t.channels), u16(16), u16(0), u16(0), u32(t.sampleRate << 16), dops);
    } else {
      const asc = t.asc || new Uint8Array([0x11, 0x90]);
      const desc = (tag, body) => cat([new Uint8Array([tag, 0x80, 0x80, 0x80, body.length]), body]);
      const dsi = desc(0x05, asc);
      const dcd = desc(0x04, cat([new Uint8Array([0x40, 0x15, 0, 0, 0]), u32(t.bitrate || 192000), u32(t.bitrate || 192000), dsi]));
      const es = desc(0x03, cat([u16(0), new Uint8Array([0]), dcd, desc(0x06, new Uint8Array([2]))]));
      entry = box('mp4a', zeros(6), u16(1), zeros(8), u16(t.channels), u16(16), u16(0), u16(0), u32(t.sampleRate << 16), full('esds', 0, 0, es));
    }
    const stsd = full('stsd', 0, 0, u32(1), entry);
    // tabulky jako jeden blok bajtů – dřív každý vzorek samostatný argument (…map(u32)) a nad ~62 000 vzorky
    // „Maximum call stack size exceeded“ (S14 Web: export 28 min spadl po 278 s a nechal 0B soubor)
    const u32s = (arr) => { const b = new Uint8Array(arr.length * 4); const dv = new DataView(b.buffer); arr.forEach((n, i) => dv.setUint32(i * 4, n >>> 0)); return b; };
    const u64s = (arr) => { const b = new Uint8Array(arr.length * 8); const dv = new DataView(b.buffer); arr.forEach((n, i) => dv.setBigUint64(i * 8, BigInt(Math.max(0, Math.round(n))))); return b; };
    const sttsB = full('stts', 0, 0, u32(stts.length), u32s(stts.flat()));
    const stsc = full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));
    const stsz = full('stsz', 0, 0, u32(0), u32(t.sizes.length), u32s(t.sizes));
    const co64 = full('co64', 0, 0, u32(t.offsets.length), u64s(t.offsets));
    const parts = [stsd, sttsB];
    if (isV) {
      const keys = []; t.keys.forEach((k, i) => { if (k) keys.push(i + 1); });
      parts.push(full('stss', 0, 0, u32(keys.length), u32s(keys)));
    }
    parts.push(stsc, stsz, co64);
    const stbl = box('stbl', ...parts);
    return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', xmhd, dinf, stbl)));
  }
}

module.exports = { Mp4Writer };
