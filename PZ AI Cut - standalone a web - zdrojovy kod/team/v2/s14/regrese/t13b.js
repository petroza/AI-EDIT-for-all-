const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter'); const P = TN.app.project;
const s = P.sequences.find(x => x.id === window.__s14.id); const c = s.tracks.video[1].clips[0];
const e = await X.exportSequence(P, s, { output: APP + '/web/test-out/regrese-s14-v2-prolnuti.mp4', range: 'all', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(() => 'ok', e => e.message);
return { vIn: c.vIn, vOut: c.vOut, exp: e };
