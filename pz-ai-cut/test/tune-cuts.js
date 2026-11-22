'use strict';
/* Pravidla pro místo střihu na webu (časy vět z Whisperu v prohlížeči jsou jen přibližné) proti pravdě z desktopu
 * (faster-whisper s časy slov). Měří to, na čem záleží: jak často střih useknul VLASTNÍ slovo vybrané věty
 * (první/poslední) a jak často naopak „přibral“ kousek slova sousední věty.
 *   node test/tune-cuts.js <web-vety.json> <desktop-prepis.json> <video> */
const fs = require('fs');
const { execFileSync } = require('child_process');
const [webPath, trPath, video] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(webPath, 'utf8'));
const tr = JSON.parse(fs.readFileSync(trPath, 'utf8'));
const W = tr.segments.flatMap((s) => s.words || []).map((w) => ({ w: w.w, s: +w.s, e: +w.e })).sort((a, b) => a.s - b.s);
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 2 ** 31 - 1 });
const X = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
const SR = 16000;

// energie po 10 ms (dB)
const FR = 160, NF = Math.floor(X.length / FR), DB = new Float32Array(NF);
for (let f = 0; f < NF; f++) { let e = 0; for (let k = f * FR; k < (f + 1) * FR; k++) e += X[k] * X[k]; DB[f] = 10 * Math.log10(e / FR + 1e-10); }
const fAt = (t) => Math.max(0, Math.min(NF - 1, Math.round(t * 100)));

function quietest(a, b) {
  let best = (a + b) / 2, be = Infinity;
  for (let t = a; t + 0.02 <= b; t += 0.005) { const i0 = Math.round(t * SR); let e = 0; for (let k = i0; k < i0 + 320; k++) e += X[k] * X[k]; if (e < be) { be = e; best = t + 0.01; } }
  return best;
}
/** Skutečné pauzy v [a, b]: úseky pod prahem (podle hlasitosti řeči v okolí) aspoň minMs dlouhé. */
function pauses(a, b, relDb, minMs) {
  const f0 = fAt(a - 1.5), f1 = fAt(b + 1.5);
  const loud = []; for (let f = f0; f <= f1; f++) loud.push(DB[f]);
  loud.sort((x, y) => y - x);
  const speech = loud[Math.floor(loud.length * 0.2)]; // hlasitost řeči v okolí
  const thr = speech - relDb;
  const out = [];
  let st = -1;
  for (let f = fAt(a); f <= fAt(b) + 1; f++) {
    const q = f <= fAt(b) && DB[f] < thr;
    if (q && st < 0) st = f;
    if (!q && st >= 0) { if ((f - st) * 10 >= minMs) out.push({ s: st / 100, e: f / 100 }); st = -1; }
  }
  return out;
}
function pauseRule(relDb, minMs, win, side) {
  return (est, isIn) => {
    const ps = pauses(est - win, est + win, relDb, minMs);
    if (!ps.length) return null;
    let best = null;
    for (const p of ps) {
      const c = (p.s + p.e) / 2;
      // u začátku věty raději pauza před odhadem, u konce po něm (raději kus pauzy navíc než useknuté slovo)
      const bias = side ? (isIn ? Math.max(0, c - est) : Math.max(0, est - c)) * side : 0;
      const sc = Math.abs(c - est) + bias - Math.min(0.15, p.e - p.s) * 0.5;
      if (!best || sc < best.sc) best = { sc, c, p };
    }
    // střih uvnitř pauzy: u začátku věty blíž jejímu konci (těsně před slovem), u konce blíž začátku
    return isIn ? Math.max(best.p.s + 0.02, best.p.e - 0.06) : Math.min(best.p.e - 0.02, best.p.s + 0.06);
  };
}

// ke každé webové větě skutečné první a poslední slovo
const items = [];
for (const s of S) {
  let fw = null, lw = null;
  for (const w of W) { if (Math.abs(w.s - s.s) < 0.6 && (!fw || Math.abs(w.s - s.s) < Math.abs(fw.s - s.s))) fw = w; if (Math.abs(w.e - s.e) < 0.6 && (!lw || Math.abs(w.e - s.e) < Math.abs(lw.e - s.e))) lw = w; }
  if (!fw || !lw) continue;
  const iF = W.indexOf(fw), iL = W.indexOf(lw);
  items.push({ s, fw, lw, prev: W[iF - 1], next: W[iL + 1] });
}
console.log(`sentences ${items.length}/${S.length} matched to true words`);

function evaluate(name, fIn, fOut) {
  let ownI = 0, ownO = 0, bleedI = 0, bleedO = 0, fb = 0;
  for (const it of items) {
    let ti = fIn(it.s.s, true), to = fOut(it.s.e, false);
    if (ti === null) { fb++; ti = quietest(it.s.s - 0.25, it.s.s + 0.1); }
    if (to === null) { fb++; to = quietest(it.s.e - 0.1, it.s.e + 0.25); }
    if (ti > it.fw.s + 0.02) ownI++; else if (it.prev && ti < it.prev.e - 0.02) bleedI++;
    if (to < it.lw.e - 0.02) ownO++; else if (it.next && to > it.next.s + 0.02) bleedO++;
  }
  const p = (x) => (x / items.length * 100).toFixed(0).padStart(3) + ' %';
  console.log(`${name.padEnd(40)} own-clip in ${p(ownI)} out ${p(ownO)} | bleed in ${p(bleedI)} out ${p(bleedO)}${fb ? ` | fallback ${fb}` : ''}`);
}
evaluate('quietest ±0.2 (old)', (t) => quietest(t - 0.2, t + 0.2), (t) => quietest(t - 0.2, t + 0.2));
evaluate('quietest [-0.25,+0.1] (current)', (t) => quietest(t - 0.25, t + 0.1), (t) => quietest(t - 0.1, t + 0.25));
for (const rel of [20, 25, 30]) for (const ms of [40, 60, 90]) for (const win of [0.35, 0.5]) for (const side of [0, 1]) {
  const r = pauseRule(rel, ms, win, side);
  evaluate(`pause rel${rel} ${ms}ms ±${win}${side ? ' biased' : ''}`, r, r);
}
