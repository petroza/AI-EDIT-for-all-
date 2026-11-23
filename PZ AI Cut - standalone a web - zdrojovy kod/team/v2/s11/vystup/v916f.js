// S8: kontrolni kopie s11-v916 se stredovym vyrezem (posX 0 na V1 = stav pred opravou S7) jen pro kalibraci detektoru obliceju; exporty
const app = TN.app, P = app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const src = P.sequences.find((x) => x.name === 's11-v916');
P.edit('S8 ctrl', () => { const s = JSON.parse(JSON.stringify(src)); s.id = U.uuid(); s.name = 's11-v916-stred'; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) { c.id = U.uid('c'); if (k === 'video') c.posX = 0; } P.addSequence(s); });
const O = 'vystup-s11-';
window.__S11JOBS = [['s11-v916', 'h264', 'social', O + 'v916.mp4'], ['s11-v916', 'h264', 'social', O + 'v916-bez.mp4', false]];
return 'ok';
