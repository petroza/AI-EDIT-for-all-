// S5: exporty pomuckou exporter.exportSequence (misto dialogu). window.__S8JOBS = [[sekvence, format, loudness, soubor, burn, soloA]]
// soloA (0/1/2) = kopie sekvence, kde jsou ostatni zvukove stopy ztlumene (M v hlavicce stopy) - mereni mixu po stopach
const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const OUT = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/';
const P = TN.app.project, log = [];
for (const [seq, format, loud, file, burn, solo] of window.__S8JOBS) {
  let s = P.sequences.find((x) => x.name === seq); const t0 = Date.now();
  if (solo !== undefined && solo !== null) { s = JSON.parse(JSON.stringify(s)); s.tracks.audio.forEach((t, i) => { t.muted = i !== solo; }); }
  try { const r = await X.exportSequence(P, s, { output: OUT + file, range: 'all', burnCaptions: burn !== false, srtSidecar: false, encoder: 'libx264', format, loudness: loud }); log.push([seq, format, loud, file, r.sizeMB, r.duration, ((Date.now() - t0) / 1000).toFixed(1) + ' s']); }
  catch (e) { log.push([seq, format, loud, file, 'CHYBA', e.message, ((Date.now() - t0) / 1000).toFixed(1) + ' s']); }
}
return JSON.stringify(log);
