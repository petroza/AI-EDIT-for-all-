// S6 (kod 6bce4ac): Extract (I 9,64 / O 10,68, prikaz ' = TN.app.cmd('extract')) na kopii s6-multi -> s6-rx1; pak exporty
const app = TN.app, P = app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const src = P.sequences.find((x) => x.name === 's6-multi');
let s; P.edit('S6 copy', () => { s = JSON.parse(JSON.stringify(src)); s.id = U.uuid(); s.name = 's6-rx1'; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) c.id = U.uid('c'); P.addSequence(s); });
s = P.sequences.find((x) => x.name === 's6-rx1'); app.openSequence(s.id);
app.edit('In/Out', () => { s.inPoint = 9.64; s.outPoint = 10.68; });
app.cmd('extract');
const dump = { dur: +app.seqDuration(s).toFixed(3),
  video: s.tracks.video.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.vIn ? c.vIn.type + c.vIn.dur + (c.vIn.under ? 'U' : '') : '', c.vOut ? c.vOut.type + c.vOut.dur + (c.vOut.under ? 'U' : '') : ''])),
  audio: s.tracks.audio.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.gainDb])),
  caps: (s.captions || []).map((c) => [+c.start.toFixed(3), +c.end.toFixed(3), c.text.replace(/\n/g, ' / ')]) };
const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const OUT = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/';
const jobs = [['s6-multi', 'h264', 'vystup-s6b-multi-bez.mp4'], ['s6-multi', 'prores', 'vystup-s6b-pcm-mix.mov'], ['s6-multi', 'prores', 'vystup-s6b-pcm-a1.mov', 0], ['s6-multi', 'prores', 'vystup-s6b-pcm-a2.mov', 1], ['s6-multi', 'prores', 'vystup-s6b-pcm-a3.mov', 2],
  ['s6-rx1', 'h264', 'vystup-s6b-rx1-bez.mp4'], ['s6-rx1', 'prores', 'vystup-s6b-rx1-pcm-mix.mov'], ['s6-rx1', 'prores', 'vystup-s6b-rx1-pcm-a1.mov', 0], ['s6-rx1', 'prores', 'vystup-s6b-rx1-pcm-a2.mov', 1], ['s6-rx1', 'prores', 'vystup-s6b-rx1-pcm-a3.mov', 2]];
const log = [];
for (const [n, f, file, solo] of jobs) {
  let q = P.sequences.find((x) => x.name === n);
  if (solo !== undefined) { q = JSON.parse(JSON.stringify(q)); q.tracks.audio.forEach((t, i) => { t.muted = i !== solo; }); }
  const r = await X.exportSequence(P, q, { output: OUT + file, range: 'all', burnCaptions: false, srtSidecar: false, encoder: 'libx264', format: f, loudness: 'off' });
  log.push([file, r.duration]);
}
return JSON.stringify({ dump, log }, null, 1);
