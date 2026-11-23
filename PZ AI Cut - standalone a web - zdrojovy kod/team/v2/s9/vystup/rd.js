// S8: Shift+Delete (cmd rippleDelete) a Extract (cmd extract) na kopiich s9-multi + Zpet/Znovu (cmd undo/redo) presne vrati stav.
// RD1: V1+A1 rozriznout (cmd addEdit, vybrany V1+A1) na 9,64 a 10,68 (pod b-rollem 1 na V2 8-12), vybrat stredni kus, Shift+Delete
// RD2: cely V1 klip 2 (29,80-45,92; pod b-rollem 2 a 3) + A1, Shift+Delete. RX1: I 9,64 / O 10,68, Extract (')
const app = TN.app, P = app.project, E = app.editCore, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const src = P.sequences.find((x) => x.name === 's9-multi');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const copy = (nm) => { let s; P.edit('S8 copy', () => { s = JSON.parse(JSON.stringify(src)); s.id = U.uuid(); s.name = nm; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) c.id = U.uid('c'); P.addSequence(s); }); s = P.sequences.find((x) => x.name === nm); app.openSequence(s.id); return s; };
const withLinked = (s, c) => { const ids = [c.id]; E.eachTrack(s, (t) => t.clips.forEach((x) => { if (x !== c && c.linkId && x.linkId === c.linkId) ids.push(x.id); })); return ids; };
const seqOf = (id) => P.sequences.find((x) => x.id === id);
const key = (s) => JSON.stringify({ tracks: s.tracks, captions: s.captions, markers: s.markers }); // obsah sekvence (bez hlavy/zoomu)
const dump = (s) => ({ dur: +app.seqDuration(s).toFixed(3),
  video: s.tracks.video.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.vIn ? c.vIn.type + c.vIn.dur + (c.vIn.under ? 'U' : '') : '', c.vOut ? c.vOut.type + c.vOut.dur + (c.vOut.under ? 'U' : '') : ''])),
  audio: s.tracks.audio.map((t) => t.clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.gainDb])),
  caps: (s.captions || []).length });
const undoRedo = async (s, h0, before, after) => { const n = P.history.length - h0; const labels = P.history.slice(h0).map((h) => h.label);
  for (let i = 0; i < n; i++) { app.cmd('undo'); await wait(50); } const s1 = seqOf(s.id); const undoOk = key(s1) === before;
  for (let i = 0; i < n; i++) { app.cmd('redo'); await wait(50); } const s2 = seqOf(s.id); const redoOk = key(s2) === after;
  return { steps: n, labels, undoOk, redoOk, snapAfterRedoSame: P.snapshot() === window.__snapAfter }; };
const toast = () => { const t = document.getElementById('toast'); return t ? { text: t.textContent, cls: t.className } : null; };
const out = {};
// RD1
let s = copy('s9-rd1'); let h0 = P.history.length; const b1 = key(s);
for (const t of [9.64, 10.68]) { const c = s.tracks.video[0].clips.find((x) => x.start < t && x.start + x.out - x.in > t); app.sel = new Set(withLinked(s, c)); app.setPlayhead(t); app.cmd('addEdit'); }
const mid = s.tracks.video[0].clips.find((x) => Math.abs(x.start - 9.64) < 0.02);
app.sel = new Set(withLinked(s, mid)); app.cmd('rippleDelete'); await wait(300); out.rd1_toast = toast(); app.sel = new Set();
out.rd1 = dump(s); window.__snapAfter = P.snapshot(); out.rd1_undo = await undoRedo(s, h0, b1, key(s));
// RD2
s = copy('s9-rd2'); h0 = P.history.length; const b2 = key(s);
const c2 = s.tracks.video[0].clips.find((x) => Math.abs(x.start - 29.8) < 0.02);
app.sel = new Set(withLinked(s, c2)); app.cmd('rippleDelete'); await wait(300); out.rd2_toast = toast(); app.sel = new Set();
out.rd2 = dump(s); window.__snapAfter = P.snapshot(); out.rd2_undo = await undoRedo(s, h0, b2, key(s));
// RX1 Extract
s = copy('s9-rx1'); h0 = P.history.length; const b3 = key(s);
app.edit('In/Out', () => { s.inPoint = 9.64; s.outPoint = 10.68; }); app.cmd('extract'); await wait(300);
out.rx1 = dump(s); window.__snapAfter = P.snapshot(); out.rx1_undo = await undoRedo(s, h0, b3, key(s));
return JSON.stringify(out, null, 1);
