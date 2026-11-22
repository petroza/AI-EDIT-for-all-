'use strict';
/* Jak přesně sedí začátky/konce vět z webového přepisu (Whisper small v prohlížeči, časy frází) na skutečné
 * mezery mezi slovy (desktopový přepis s časy slov) – a jaké pravidlo střihu nejméně useká slova.
 *   node test/tune-bounds.js <web-vety.json> <desktop-prepis.json> [video] */
const fs = require('fs');
const { execFileSync } = require('child_process');
const [webPath, trPath, video] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(webPath, 'utf8'));
const tr = JSON.parse(fs.readFileSync(trPath, 'utf8'));
const W = (tr.words || (tr.segments || tr.sentences || []).flatMap((s) => s.words || []))
  .map((w) => ({ w: (w.word || w.w || w.text || '').trim(), s: +(w.start ?? w.s), e: +(w.end ?? w.e) })).sort((a, b) => a.s - b.s);

// mezery mezi slovy v pravdě
const TOL = Number(process.env.TOL || 0.015);
const gaps = []; for (let i = 0; i < W.length - 1; i++) gaps.push({ lo: W[i].e, hi: W[i + 1].s });
function gapAt(t) { // mezera, ve které t leží (s tolerancí 15 ms), jinak null
  let lo = 0, hi = gaps.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (gaps[m].hi < t - TOL) lo = m + 1; else if (gaps[m].lo > t + TOL) hi = m - 1; else return gaps[m]; }
  return null;
}
// nejbližší mezera k času (pro posun odhadu)
function nearestGap(t) { let b = null; for (const g of gaps) { const c = (g.lo + g.hi) / 2; const d = Math.abs(c - t); if (!b || d < b.d) b = { g, c, d }; } return b; }

let X = null;
if (video) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 2 ** 31 - 1 });
  X = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
}
const toDb = (r) => 20 * Math.log10(r + 1e-9);
function quietest(a, b) { // nejtišší 20ms okno v [a, b)
  let best = (a + b) / 2, be = Infinity;
  for (let t = a; t + 0.02 <= b; t += 0.005) { const i0 = Math.round(t * 16000); let e = 0; for (let k = i0; k < i0 + 320; k++) e += X[k] * X[k]; if (e < be) { be = e; best = t + 0.01; } }
  return best;
}

const starts = S.map((s) => s.s), ends = S.map((s) => s.e);
const offs = [];
for (const t of starts) { const n = nearestGap(t); if (n.d < 0.6) offs.push(t - n.c); }
offs.sort((a, b) => a - b);
const q = (p) => offs[Math.floor(offs.length * p)].toFixed(3);
console.log(`web sentences ${S.length}; start-estimate minus true gap centre: p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)}`);

function evalRule(name, fIn, fOut) {
  let okI = 0, okO = 0;
  for (const s of S) { if (gapAt(fIn(s))) okI++; if (gapAt(fOut(s))) okO++; }
  console.log(`${name.padEnd(34)} in ${(okI / S.length * 100).toFixed(0)} %  out ${(okO / S.length * 100).toFixed(0)} %`);
}
evalRule('raw estimate', (s) => s.s, (s) => s.e);
for (const d of [0.04, 0.08, 0.12]) evalRule(`in -${d}, out +${d}`, (s) => s.s - d, (s) => s.e + d);
for (const d of [0.04, 0.08]) evalRule(`in +${d}, out -${d}`, (s) => s.s + d, (s) => s.e - d);
if (X) {
  for (const w of [0.1, 0.15, 0.2, 0.3]) evalRule(`quietest 20ms in ±${w}`, (s) => quietest(s.s - w, s.s + w), (s) => quietest(s.e - w, s.e + w));
  for (const w of [0.15, 0.25]) evalRule(`quietest in [-${w},+0.05]/[-0.05,+${w}]`, (s) => quietest(s.s - w, s.s + 0.05), (s) => quietest(s.e - 0.05, s.e + w));
  for (const [a, b] of [[0.25, 0.1], [0.25, 0.15], [0.3, 0.1], [0.2, 0.1]]) evalRule(`quietest in [-${a},+${b}]/[-${b},+${a}]`, (s) => quietest(s.s - a, s.s + b), (s) => quietest(s.e - b, s.e + a));
  // kam padají chyby: střih uvnitř slova, které patří do vybrané věty (useknutý začátek/konec věty) vs. do sousední
  const own = (name, fIn, fOut) => { let ci = 0, co = 0; for (const s of S) { const ti = fIn(s), to = fOut(s); if (!gapAt(ti) && W.some((w) => w.s < ti && ti < w.e && w.e > s.s && w.s > s.s - 0.35)) ci++; if (!gapAt(to) && W.some((w) => w.s < to && to < w.e && w.s < s.e && w.e < s.e + 0.35)) co++; } console.log(`${name.padEnd(34)} clips own first word ${(ci / S.length * 100).toFixed(0)} %  own last word ${(co / S.length * 100).toFixed(0)} %`); };
  own('±0.2 (current)', (s) => quietest(s.s - 0.2, s.s + 0.2), (s) => quietest(s.e - 0.2, s.e + 0.2));
  own('[-0.25,+0.1]', (s) => quietest(s.s - 0.25, s.s + 0.1), (s) => quietest(s.e - 0.1, s.e + 0.25));
  own('[-0.3,+0.05]', (s) => quietest(s.s - 0.3, s.s + 0.05), (s) => quietest(s.e - 0.05, s.e + 0.3));
}
