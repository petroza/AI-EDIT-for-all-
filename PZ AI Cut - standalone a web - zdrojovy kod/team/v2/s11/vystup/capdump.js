const P = TN.app.project, o = {};
for (const n of window.__S11SEQS) { const s = P.sequences.find((x) => x.name === n); o[n] = s.captions.map((c) => [+c.start.toFixed(2), +c.end.toFixed(2), c.text.replace(/\n/g, ' / ')]); }
return JSON.stringify(o);
