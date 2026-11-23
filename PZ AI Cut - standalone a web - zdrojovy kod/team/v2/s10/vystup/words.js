// S10: slova prepisu (Worker) v useku zdroje -> casy na timeline s10-v916 a s10-a (klip A1 se stejnym zdrojem)
const P = TN.app.project, A = window.__pzASR, out = {};
for (const [mn, a, b, seq, off] of [['tncz', 1598.5, 1600.8, 's10-v916', -1596], ['vyrez', 114.88, 117.5, 's10-v916', 45.88 - 114.88], ['vyrez', 145.68, 146.9, 's10-a', 7.24 - 145.68]]) {
  const m = P.media.find((x) => x.name.startsWith(mn)); const t = A.get(m);
  out[seq + ' ' + a] = t.words.filter((w) => w.e > a && w.s < b).map((w) => [w.w, +(w.s + off).toFixed(2), +(w.e + off).toFixed(2)]);
}
return JSON.stringify(out);
