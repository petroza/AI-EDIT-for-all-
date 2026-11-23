// S9 (z S8): exporty pomuckou exporter.exportSequence (misto dialogu). window.__S10JOBS = [[sekvence, format, loudness, soubor, burn, soloA, extra]]
// soloA (0/1/2) = kopie sekvence se ztlumenymi ostatnimi zvukovymi stopami; extra = dalsi volby exportu (range:'inout', srtSidecar:true)
const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const OUT = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/';
const P = TN.app.project, log = [];
for (const [seq, format, loud, file, burn, solo, extra] of window.__S10JOBS) {
  let s = P.sequences.find((x) => x.name === seq); const t0 = Date.now();
  if (solo !== undefined && solo !== null) { s = JSON.parse(JSON.stringify(s)); s.tracks.audio.forEach((t, i) => { t.muted = i !== solo; }); }
  try { const r = await X.exportSequence(P, s, Object.assign({ output: OUT + file, range: 'all', burnCaptions: burn !== false, srtSidecar: false, encoder: 'libx264', format, loudness: loud }, extra || {})); log.push([seq, format, loud, file, r.sizeMB, r.duration, ((Date.now() - t0) / 1000).toFixed(1) + ' s', extra || null]); }
  catch (e) { log.push([seq, format, loud, file, 'CHYBA', e.message, ((Date.now() - t0) / 1000).toFixed(1) + ' s']); }
}
return JSON.stringify(log);
