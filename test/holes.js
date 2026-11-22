'use strict';
/* Díry v přepisu (kolo 3, úkol 4): úseky, kde podle zvuku zní řeč a přepis v nich > 3 s nemá žádné slovo.
 *   node test/holes.js <přepis.json> <video.mp4>
 * přepis.json = uložený přepis z prohlížeče ({ words: [{w, s, e}] } – např. přes /devsave), zvuk se dekóduje ffmpegem (16 kHz mono).
 * Práh řeči se počítá po 4min oknech (jako při přepisu). Vypíše seznam děr a počet; návratový kód 1, když nějaká je. */
const fs = require('fs');
const { execFileSync } = require('child_process');
const { findHoles, levelOf, sentences } = require('../web/ai/transcripts');

const [tjson, media] = process.argv.slice(2);
if (!tjson || !media) { console.log('použití: node test/holes.js <přepis.json> <video.mp4>'); process.exit(2); }
const t = JSON.parse(fs.readFileSync(tjson, 'utf8'));
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', media, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
const all = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const dur = all.length / 16000;
const holes = [];
for (let t0 = 0; t0 < dur; t0 += 240) {
  const t1 = Math.min(dur, t0 + 240);
  const x = all.subarray(Math.round(t0 * 16000), Math.round(t1 * 16000));
  const thr = levelOf(x) * Math.pow(10, -15 / 20);
  for (const h of findHoles(t.words.filter((w) => w.e > t0 && w.s < t1), x, t0, thr, t0, t1)) holes.push(h);
}
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
console.log(`díry (řeč bez slov > 3 s): ${holes.length}`);
for (const h of holes) console.log(`  ${fmt(h.s)} – ${fmt(h.e)} (${(h.e - h.s).toFixed(1)} s)`);
const S = sentences(t.words);
const long = S.filter((s) => s.e - s.s > 8);
console.log(`věty delší než 8 s: ${long.length}` + (long.length ? ' – ' + long.map((s) => `${fmt(s.s)} (${(s.e - s.s).toFixed(1)} s)`).join(', ') : ''));
process.exit(holes.length ? 1 : 0);
