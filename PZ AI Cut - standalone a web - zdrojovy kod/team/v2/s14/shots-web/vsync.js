// node vsync.js a.gray b.gray w h -> lag (frames) b vs a podle řady pohybu
const fs = require('fs'); const [fa, fb, W, H] = process.argv.slice(2); const N = W * H;
const series = (f) => { const b = fs.readFileSync(f); const n = Math.floor(b.length / N); const o = []; for (let k = 1; k < n; k++) { let d = 0; for (let i = 0; i < N; i++) d += Math.abs(b[k * N + i] - b[(k - 1) * N + i]); o.push(d / N); } return o; };
const a = series(fa), b = series(fb); let best = -2, bl = 0;
const z = (x) => { const m = x.reduce((p, q) => p + q, 0) / x.length; return x.map((v) => v - m); };
const A = z(a), B = z(b);
for (let l = -10; l <= 10; l++) { let c = 0, n1 = 0, n2 = 0; for (let i = 15; i < Math.min(A.length, B.length) - 15; i++) { const x = A[i], y = B[i + l]; c += x * y; n1 += x * x; n2 += y * y; } const r = c / Math.sqrt(n1 * n2); if (r > best) { best = r; bl = l; } }
console.log('lag frames', bl, 'r', best.toFixed(3), 'len', a.length, b.length);
