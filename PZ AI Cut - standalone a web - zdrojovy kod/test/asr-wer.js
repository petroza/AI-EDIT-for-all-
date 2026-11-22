'use strict';
/* Chybovost přepisu (WER) na pevných vzorcích v test/asr-ref/ (zadání kola 2 týmu):
 *   <vzorek>.ref.txt            referenční text (slova s „[?]“ = nejisté, ověří tester poslechem)
 *   <vzorek>.<model>.txt        přepis modelem (standard / accurate), uložený z prohlížeče
 * WER = (záměny + vypuštění + vložení) / počet slov reference; malá písmena, bez interpunkce.
 *   node test/asr-wer.js            tabulka pro všechny vzorky a modely
 */
const fs = require('fs');
const path = require('path');

/** Slova pro porovnání: malá písmena, bez interpunkce a značek [?], pomlčky mezi slovy pryč. */
// číslice jako slova (titulky smí psát „3 týdny“ i „tři týdny“ – to není chyba rozpoznání)
const NUM = { 0: 'nula', 1: 'jedna', 2: 'dva', 3: 'tři', 4: 'čtyři', 5: 'pět', 6: 'šest', 7: 'sedm', 8: 'osm', 9: 'devět', 10: 'deset' };
function words(text) {
  return String(text).toLowerCase().replace(/\[\?\]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).map((w) => NUM[w] || w);
}
/** Levenshtein na slovech: { wer, sub, del, ins, n } */
function wer(ref, hyp) {
  const r = words(ref), h = words(hyp);
  const n = r.length, m = h.length;
  // d[i][j] = min. počet úprav; b = odkud (pro rozpad na záměny / vypuštění / vložení)
  const d = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  }
  let i = n, j = m, sub = 0, del = 0, ins = 0;
  const errs = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)) {
      if (r[i - 1] !== h[j - 1]) { sub++; errs.push(`${r[i - 1]} → ${h[j - 1]}`); }
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { del++; errs.push(`${r[i - 1]} → ∅`); i--; }
    else { ins++; errs.push(`∅ → ${h[j - 1]}`); j--; }
  }
  return { wer: n ? (sub + del + ins) / n : 0, sub, del, ins, n, errors: errs.reverse() };
}
/** Výřez textu reference/přepisu mezi dvěma frázemi (pro výrok uvnitř vzorku). */
function between(text, from, to) {
  const w = String(text);
  const a = w.toLowerCase().indexOf(from.toLowerCase());
  const b = to ? w.toLowerCase().indexOf(to.toLowerCase(), a + 1) : -1;
  if (a < 0) return '';
  return w.slice(a, b < 0 ? undefined : b + to.length);
}

module.exports = { words, wer, between };

if (require.main === module) {
  const dir = path.join(__dirname, 'asr-ref');
  const refs = fs.readdirSync(dir).filter((f) => f.endsWith('.ref.txt'));
  const rows = [];
  for (const rf of refs) {
    const base = rf.replace('.ref.txt', '');
    const ref = fs.readFileSync(path.join(dir, rf), 'utf8');
    for (const hf of fs.readdirSync(dir).filter((f) => f.startsWith(base + '.') && f.endsWith('.txt') && f !== rf)) {
      const model = hf.slice(base.length + 1, -4);
      const r = wer(ref, fs.readFileSync(path.join(dir, hf), 'utf8'));
      rows.push({ vzorek: base, model, slov: r.n, WER: (r.wer * 100).toFixed(1) + ' %', záměny: r.sub, vypuštění: r.del, vložení: r.ins });
      if (process.argv.includes('-v')) console.log(`\n${base} / ${model}: ${r.errors.join(' | ')}`);
    }
  }
  console.table(rows);
}
