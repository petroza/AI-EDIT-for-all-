// S6: Shift+Delete (TN.app.cmd('rippleDelete')) na kopiich s6-multi s titulky.
// RD1: V1+A1 rozriznout (Ctrl+K = cmd addEdit s vybranym V1+A1) na 9,64 a 10,68 (pod b-rollem 1 na V2 8-12), vybrat stredni kus V1+A1 (jako klik s propojenim), Shift+Delete
// RD2: vybrat cely V1 klip 2 (29,80-45,92; pod nim b-roll 2 27-33 a b-roll 3 40-43) + A1, Shift+Delete
const app = TN.app, P = app.project, E = app.editCore, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const src = P.sequences.find((x) => x.name === 's6-multi');
const copy = (nm) => { let s; P.edit('S6 copy', () => { s = JSON.parse(JSON.stringify(src)); s.id = U.uuid(); s.name = nm; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) c.id = U.uid('c'); P.addSequence(s); }); s = P.sequences.find((x) => x.name === nm); app.openSequence(s.id); return s; };
const withLinked = (s, c) => { const ids = [c.id]; E.eachTrack(s, (t) => t.clips.forEach((x) => { if (x !== c && c.linkId && x.linkId === c.linkId) ids.push(x.id); })); return ids; };
const dump = (s) => ({ dur: +app.seqDuration(s).toFixed(3),
  video: s.tracks.video.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.vIn ? c.vIn.type + c.vIn.dur + (c.vIn.under ? 'U' : '') : '', c.vOut ? c.vOut.type + c.vOut.dur + (c.vOut.under ? 'U' : '') : ''])),
  audio: s.tracks.audio.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.gainDb, c.fadeIn, c.fadeOut])),
  caps: (s.captions || []).map((c) => [+c.start.toFixed(3), +c.end.toFixed(3), c.text.replace(/\n/g, ' / ')]) });
const out = {};
// RD1
let s = copy('s6-rd1');
out.rd1_before = dump(s);
for (const t of [9.64, 10.68]) {
  const c = s.tracks.video[0].clips.find((x) => x.start < t && x.start + x.out - x.in > t);
  app.sel = new Set(withLinked(s, c)); app.setPlayhead(t); app.cmd('addEdit');
}
const mid = s.tracks.video[0].clips.find((x) => Math.abs(x.start - 9.64) < 0.02);
app.sel = new Set(withLinked(s, mid)); out.rd1_sel = [...app.sel].length;
app.cmd('rippleDelete'); app.sel = new Set();
out.rd1 = dump(s);
// RD2
s = copy('s6-rd2');
const c2 = s.tracks.video[0].clips.find((x) => Math.abs(x.start - 29.8) < 0.02);
app.sel = new Set(withLinked(s, c2)); out.rd2_sel = [...app.sel].length;
app.cmd('rippleDelete'); app.sel = new Set();
out.rd2 = dump(s);
out.status = (document.querySelector('.statusbar,#status') || {}).innerText;
return JSON.stringify(out, null, 1);
