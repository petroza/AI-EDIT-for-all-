// S6: uklid kraju (window.__pzEdgeShots) na kopii s6-multi -> s6-multiES (rucne vlozeny b-roll se sam neuklidi)
const app = TN.app, P = app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const src = P.sequences.find((x) => x.name === 's6-multi');
let s;
P.edit('S6 ES copy', () => {
  s = JSON.parse(JSON.stringify(src)); s.id = U.uuid(); s.name = 's6-multiES';
  for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) c.id = U.uid('c');
  P.addSequence(s);
});
s = P.sequences.find((x) => x.name === 's6-multiES');
app.openSequence(s.id);
const dumpV = () => s.tracks.video.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), +c.out.toFixed(3), c.vIn ? c.vIn.type + c.vIn.dur + (c.vIn.under ? 'U' : '') : '', c.vOut ? c.vOut.type + c.vOut.dur + (c.vOut.under ? 'U' : '') : '']));
const dumpA = () => s.tracks.audio.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3)]));
const before = dumpV(), beforeA = dumpA();
const t0 = Date.now();
const r = await window.__pzEdgeShots(s);
return JSON.stringify({ ms: Date.now() - t0, r, before, after: dumpV(), beforeA, afterA: dumpA() });
