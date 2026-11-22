'use strict';
/* Ladění detektoru pauz pro střih (web/ai/transcripts.js) na skutečném rozhovoru s přesnými časy slov
 * z desktopového přepisu MY Premiere MCP. Pro každou hranici věty (konec slova s . ? !) dostane detektor
 * odhad s chybou jako Whisper (±0,2 s) a musí trefit mezeru mezi slovy.
 *   node test/tune-pauses.js <video> <přepis.json> [sekund] */
const { execFileSync } = require('child_process');
const fs = require('fs');

const [video, trPath, secArg] = process.argv.slice(2);
const SEC = Number(secArg) || 900;
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-t', String(SEC), '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
const X = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
const tr = JSON.parse(fs.readFileSync(trPath, 'utf8'));
const words = (tr.words || (tr.segments || tr.sentences || []).flatMap((s) => s.words || []))
  .map((w) => ({ w: (w.word || w.w || w.text || '').trim(), s: +(w.start ?? w.s), e: +(w.end ?? w.e) }))
  .filter((w) => w.e <= SEC - 1).sort((a, b) => a.s - b.s);

const toDb = (r) => 20 * Math.log10(r + 1e-9);
function frames(t0, t1) {
  const fr = 160, i0 = Math.max(0, Math.round(t0 * 16000)), n = Math.floor((Math.round(t1 * 16000) - i0) / fr);
  const db = new Float32Array(Math.max(0, n));
  for (let i = 0; i < n; i++) { let e = 0; for (let k = i0 + i * fr; k < i0 + (i + 1) * fr; k++) e += X[k] * X[k]; db[i] = toDb(Math.sqrt(e / fr)); }
  return { db, t0: i0 / 16000 };
}
/** detektor: pauza = běh ≥ minMs pod (úroveň řeči − drop dB); nejbližší k odhadu v ±span */
function detect(est, p) {
  const { db, t0 } = frames(est - p.win, est + p.win);
  const sorted = Array.from(db).sort((a, b) => a - b);
  const speech = sorted[Math.floor(sorted.length * 0.8)];
  const floor = sorted[Math.floor(sorted.length * 0.05)];
  const thr = Math.min(speech - p.drop, floor + p.above);
  let best = null;
  for (let i = 0; i < db.length;) {
    if (db[i] >= thr) { i++; continue; }
    let j = i; while (j < db.length && db[j] < thr) j++;
    if ((j - i) * 10 >= p.minMs) {
      // střed nejtišší části běhu
      let mi = i; for (let k = i; k < j; k++) if (db[k] < db[mi]) mi = k;
      const c = t0 + (p.center ? (i + j) / 2 : mi + 0.5) * 0.01;
      const d = Math.abs(c - est);
      if (d <= p.span && (!best || d < best.d)) best = { t: c, d };
    }
    i = j;
  }
  return best;
}

// hranice vět
const bounds = [];
for (let i = 0; i < words.length - 1; i++) {
  if (!/[.?!…]$/.test(words[i].w)) continue;
  bounds.push({ prevE: words[i].e, nextS: words[i + 1].s, gap: words[i + 1].s - words[i].e });
}
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const noise = bounds.map(() => (rnd() * 2 - 1) * 0.2);

function score(p) {
  let ok = 0, clip = 0, none = 0, noneGood = 0;
  bounds.forEach((b, i) => {
    const est = (b.prevE + b.nextS) / 2 + noise[i];
    const r = detect(est, p);
    if (!r) { none++; if (b.gap < 0.06) noneGood++; return; }
    if (r.t >= b.prevE - 0.015 && r.t <= b.nextS + 0.015) ok++; else clip++;
  });
  return { ok, clip, none, noneGood, n: bounds.length };
}
console.log(`words ${words.length}, sentence boundaries ${bounds.length}, gaps<60ms ${bounds.filter((b) => b.gap < 0.06).length}`);
const res = [];
for (const drop of [12, 18, 24, 30]) for (const above of [6, 9, 12]) for (const minMs of [40, 60, 80]) for (const span of [0.3, 0.45]) for (const center of [true, false]) {
  const p = { win: 0.8, drop, above, minMs, span, center };
  res.push({ p, s: score(p) });
}
res.sort((a, b) => (a.s.clip - b.s.clip) || (b.s.ok - a.s.ok));
for (const r of res.slice(0, 12)) console.log(JSON.stringify(r.p), JSON.stringify(r.s));
// současné nastavení webu
console.log('current', JSON.stringify(score({ win: 0.8, drop: 0, above: 9, minMs: 50, span: 0.45, center: true })));
