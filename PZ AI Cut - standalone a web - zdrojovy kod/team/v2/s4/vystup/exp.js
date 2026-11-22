const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const OUT = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/';
const P = TN.app.project, log = [];
for (const [seq, format, loud, file] of window.__S4JOBS) {
  const s = P.sequences.find((x) => x.name === seq); const t0 = Date.now();
  try { const r = await X.exportSequence(P, s, { output: OUT + file, range: 'all', burnCaptions: true, srtSidecar: false, encoder: 'libx264', format, loudness: loud }); log.push([seq, format, loud, file, r.sizeMB, r.duration, ((Date.now() - t0) / 1000).toFixed(1) + ' s']); }
  catch (e) { log.push([seq, format, loud, file, 'CHYBA', e.message]); }
}
return JSON.stringify(log);
