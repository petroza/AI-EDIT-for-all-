// S6: MXF jako vychozi dialog (bez vypalenych titulku, .srt zvlast) pomuckou exporteru
const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const P = TN.app.project, s = P.sequences.find((x) => x.name === 's6-multi1080');
const out = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/vystup-s6-multi1080-xdcam-srt.mxf';
const r = await X.exportSequence(P, s, { output: out, range: 'all', burnCaptions: false, srtSidecar: true, encoder: 'libx264', format: 'xdcam', loudness: 'tv' });
const fs = require('fs');
const srt = fs.readdirSync('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/').filter((f) => f.startsWith('vystup-s6-multi1080-xdcam-srt'));
return JSON.stringify({ r: { dur: r.duration, mb: r.sizeMB }, files: srt });
