const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const OUT = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/';
const P = TN.app.project, log = [];
for (const seq of ['s4-L1dlg916', 's4-L1api916', 's4-L1api916b', 's4-L1dlg169', 's4-L1api169', 's4-L1post916']) {
  const s = P.sequences.find((x) => x.name === seq);
  const r = await X.exportSequence(P, s, { output: OUT + 'vystup-s4-' + seq.slice(3) + '-bez.mp4', range: 'all', burnCaptions: false, srtSidecar: false, encoder: 'libx264', format: 'h264', loudness: 'off' });
  log.push([seq, r.duration]);
}
return JSON.stringify(log);
