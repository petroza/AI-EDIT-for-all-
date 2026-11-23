const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter'); const P = TN.app.project; const r = {};
for (const [n, f] of [['S14 vyrez 60s 9x16', '916-60s.mp4'], ['S14 s1-145 9x16', '916-s1-145.mp4']]) {
  const s = P.sequences.find(x => x.name === n);
  r[f] = await X.exportSequence(P, s, { output: APP + '/web/test-out/regrese-s14-' + f, range: 'all', format: 'h264', encoder: 'libx264', loudness: 'social' }).then(() => 'ok', e => e.message);
}
return r;
