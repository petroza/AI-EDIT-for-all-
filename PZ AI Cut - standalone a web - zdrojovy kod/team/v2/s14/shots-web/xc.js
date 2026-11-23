// node xc.js src.raw exp.raw  (s16le mono 8k) -> nejlepší posun exportu proti zdroji (ms) v úsecích
const fs = require('fs');
const rd = (f) => { const b = fs.readFileSync(f); const a = new Float32Array(b.length / 2); for (let i = 0; i < a.length; i++) a[i] = b.readInt16LE(i * 2) / 32768; return a; };
const s = rd(process.argv[2]), e = rd(process.argv[3]); const SR = 8000, W = SR * 2, MAX = 0.25 * SR;
const out = [];
for (let st = SR; st + W + MAX < Math.min(s.length, e.length); st += SR * 4) {
  let best = -1, bl = 0;
  for (let l = -MAX; l <= MAX; l += 4) { let c = 0, n1 = 0, n2 = 0; for (let i = 0; i < W; i += 2) { const x = e[st + i], y = s[st + i + l]; if (y === undefined) continue; c += x * y; n1 += x * x; n2 += y * y; } const r = c / Math.sqrt(n1 * n2 + 1e-12); if (r > best) { best = r; bl = l; } }
  out.push(`${(st / SR).toFixed(0)}s: lag ${(bl / SR * 1000).toFixed(1)} ms r=${best.toFixed(2)}`);
}
console.log(out.join('\n'));
