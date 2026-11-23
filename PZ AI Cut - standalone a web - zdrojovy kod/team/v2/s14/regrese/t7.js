const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter'); const P = TN.app.project;
const out = (n) => APP + '/web/test-out/regrese-s14-' + n;
const r = {};
for (const [n, f] of [['S14 k219', 'k219.mp4'], ['S14 s1-145', 's1-145.mp4'], ['S14 konec-185', 'konec-185.mp4']]) {
  const s = P.sequences.find(x => x.name === n);
  r[f] = await X.exportSequence(P, s, { output: out(f), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(() => 'ok', e => e.message);
}
return r;
