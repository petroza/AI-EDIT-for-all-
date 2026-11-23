const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter');
const P = TN.app.project, api = TN.app.api;
const out = (n) => APP + '/web/test-out/regrese-s14-' + n;
const V = P.media.find(m => m.name === 'vyrez-5min.mp4').path;
const sv = P.sequences.find(s => s.name === 'S14 vyrez 16s');
const r = {};
r.off = await X.exportSequence(P, sv, { output: out('16s-off.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(x=>'ok', e=>e.message);
const b = await api.buildSequence({ name: 'S14 vyrez 60s', segments: [{ source: V, in: 20, out: 80 }] });
const s60 = P.sequences.find(s => s.id === b.sequenceID);
r.tv60 = await X.exportSequence(P, s60, { output: out('60s-tv.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'tv' }).then(x=>'ok', e=>e.message);
r.soc60 = await X.exportSequence(P, s60, { output: out('60s-social.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'social' }).then(x=>'ok', e=>e.message);
// XDCAM: sekvence 1920x1080 25p
const b2 = await api.buildSequence({ name: 'S14 vyrez 1080', segments: [{ source: V, in: 100, out: 108 }, { source: V, in: 150, out: 158 }] });
const s1080 = P.sequences.find(s => s.id === b2.sequenceID); s1080.width = 1920; s1080.height = 1080;
r.xdcamOk1080 = X.xdcamOk(s1080);
r.xd = await X.exportSequence(P, s1080, { output: out('xdcam-1080.mxf'), range: 'all', format: 'xdcam', encoder: 'libx264', loudness: 'tv' }).then(x=>'ok', e=>e.message);
return r;
