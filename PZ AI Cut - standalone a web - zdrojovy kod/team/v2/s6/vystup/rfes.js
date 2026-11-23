// S6: Auto Reframe 9:16 z uklizene s6-multiES (cesta nabidky Format pro site = window.__pzReframe)
const app = TN.app, P = app.project;
const src = P.sequences.find((x) => x.name === 's6-multiES');
const t0 = Date.now();
const r = await window.__pzReframe(src, 9, 16, 1080, 1920);
const s = P.sequences.find((x) => x.name === r.name);
P.edit('rename', () => { s.name = 's6-multiES916'; });
const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const e = await X.exportSequence(P, s, { output: 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/vystup-s6-multiES916-bez.mp4', range: 'all', burnCaptions: false, srtSidecar: false, encoder: 'libx264', format: 'h264', loudness: 'off' });
return JSON.stringify({ ms: Date.now() - t0, r, v2: s.tracks.video[1].clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), +(c.posX || 0).toFixed(3)]), exp: e.duration });
