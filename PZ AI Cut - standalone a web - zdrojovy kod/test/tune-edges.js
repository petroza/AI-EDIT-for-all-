'use strict';
/* Pozná se useknuté slovo na hranici střihu podle zvuku? Pro každou větu: místo střihu podle současného pravidla
 * (nejtišší místo v [-0.25,+0.1] / [-0.1,+0.25]), pravda z desktopu (useklo vlastní slovo / ne) a míra „řeči na hranici“
 * = hlasitost 80 ms kolem střihu proti hlasitosti řeči v okolí (dB). Vypíše, jak dobře práh odděluje špatné střihy.
 * VÝSLEDEK (2026-11-21): neodděluje – přesnost ~22 % = jako náhoda (v plynulé řeči je hlasitě všude), varování se nezavádí.
 *   node test/tune-edges.js <web-vety.json> <desktop-prepis.json> <video> */
const fs = require('fs');
const { execFileSync } = require('child_process');
const [webPath, trPath, video] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(webPath, 'utf8'));
const tr = JSON.parse(fs.readFileSync(trPath, 'utf8'));
const W = tr.segments.flatMap((s) => s.words || []).map((w) => ({ s: +w.s, e: +w.e })).sort((a, b) => a.s - b.s);
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 2 ** 31 - 1 });
const X = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
const rms = (a, b) => { const i0 = Math.max(0, Math.round(a * 16000)), i1 = Math.min(X.length, Math.round(b * 16000)); let e = 0; for (let i = i0; i < i1; i++) e += X[i] * X[i]; return Math.sqrt(e / Math.max(1, i1 - i0)); };
function quietest(a, b) { let best = (a + b) / 2, be = Infinity; for (let t = a; t + 0.02 <= b; t += 0.005) { const e = rms(t, t + 0.02); if (e < be) { be = e; best = t + 0.01; } } return best; }
function edgeDb(t) {
  const lv = []; for (let x = t - 1.5; x < t + 1.5; x += 0.02) lv.push(rms(x, x + 0.02));
  lv.sort((a, b) => b - a);
  const speech = lv[Math.floor(lv.length * 0.2)] || 1e-6;
  return 20 * Math.log10((rms(t - 0.04, t + 0.04) + 1e-7) / (speech + 1e-7));
}
const rows = [];
for (const s of S) {
  let fw = null, lw = null;
  for (const w of W) { if (Math.abs(w.s - s.s) < 0.6 && (!fw || Math.abs(w.s - s.s) < Math.abs(fw.s - s.s))) fw = w; if (Math.abs(w.e - s.e) < 0.6 && (!lw || Math.abs(w.e - s.e) < Math.abs(lw.e - s.e))) lw = w; }
  if (!fw || !lw) continue;
  const ti = quietest(s.s - 0.25, s.s + 0.1), to = quietest(s.e - 0.1, s.e + 0.25);
  rows.push({ bad: ti > fw.s + 0.03, db: edgeDb(ti) });
  rows.push({ bad: to < lw.e - 0.03, db: edgeDb(to) });
}
const bad = rows.filter((r) => r.bad).length;
console.log(`cuts ${rows.length}, clipping own word ${bad} (${(bad / rows.length * 100).toFixed(0)} %)`);
for (const thr of [-30, -25, -20, -16, -12, -8]) {
  const flagged = rows.filter((r) => r.db > thr);
  const tp = flagged.filter((r) => r.bad).length;
  console.log(`threshold ${thr} dB: flagged ${(flagged.length / rows.length * 100).toFixed(0)} % of cuts, catches ${(tp / bad * 100).toFixed(0)} % of bad, precision ${(tp / Math.max(1, flagged.length) * 100).toFixed(0)} %`);
}
