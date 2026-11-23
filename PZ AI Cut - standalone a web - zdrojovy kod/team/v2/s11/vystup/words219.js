const P = TN.app.project, m = P.media.find((x) => x.name.startsWith('tncz')), t = window.__pzASR.get(m);
const o = { words: t.words.filter((w) => w.e > 1263.5 && w.s < 1265.4).map((w) => [w.w, w.s, w.e]) };
for (const n of ['s11-k219', 's11-k219916']) { const s = P.sequences.find((x) => x.name === n); const r = await window.__pzASR.seqWords(s); o[n] = r.words.map((w) => [w.w, +w.s.toFixed(3), +w.e.toFixed(3)]); }
return JSON.stringify(o);
