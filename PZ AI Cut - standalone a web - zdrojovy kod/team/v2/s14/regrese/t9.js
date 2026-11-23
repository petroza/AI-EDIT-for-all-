const P = TN.app.project, api = TN.app.api, E = TN.app.editCore, app = TN.app;
const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const { newClip, clipEnd } = require(APP + '/src/core/model');
const Vm = P.media.find(m => m.name === 'vyrez-5min.mp4');
const toasts = []; const t0 = app.toast; app.toast = (m, e) => { toasts.push(m); return t0.call(app, m, e); };
const dump = (s) => s.tracks.video.slice(0,2).map((t, i) => 'V' + (i+1) + ': ' + t.clips.map(c => `${c.start.toFixed(2)}-${clipEnd(c).toFixed(2)}`).join(' ')).concat(s.tracks.audio.slice(0,1).map(t => 'A1: ' + t.clips.map(c => `${c.start.toFixed(2)}-${clipEnd(c).toFixed(2)}`).join(' ')));
async function mk(name) {
  // 3 vyroky bez strihu kamery v okoli hran: overeno dumpem
  const b = await api.buildSequence({ name, segments: [{ source: Vm.path, in: 20, out: 28 }, { source: Vm.path, in: 40, out: 48 }, { source: Vm.path, in: 60, out: 68 }] });
  await new Promise(res => setTimeout(res, 3500));
  const s = P.sequences.find(x => x.id === b.sequenceID); app.openSequence(s.id); await new Promise(res => setTimeout(res, 200));
  return s;
}
const clipsAt = (s, kind, ti, i) => s.tracks[kind][ti].clips[i];
const r = {};
// E1: Shift+Delete vyroku B, nad nim cely b-roll na V2
let s = await mk('S14 sd-broll');
const B = clipsAt(s, 'video', 0, 1);
app.edit('S14 b-roll', () => E.placeClip(s, 'video', 1, newClip(Vm, 'video', B.start + 1, 250, 253)));
r.e1_before = dump(s);
toasts.length = 0; app.sel = new Set(E.linked(s, B).map(c => c.id)); app.cmd('rippleDelete');
r.e1_after = dump(s); r.e1_toast = toasts.slice();
// E2: Shift+Delete dvou nesousednich (A a C), b-roll jen nad B
s = await mk('S14 sd-nesousedni');
const B2 = clipsAt(s, 'video', 0, 1);
app.edit('S14 b-roll', () => E.placeClip(s, 'video', 1, newClip(Vm, 'video', B2.start + 1, 250, 253)));
const A2 = clipsAt(s, 'video', 0, 0), C2 = clipsAt(s, 'video', 0, 2);
r.e2_before = dump(s);
app.sel = new Set([...E.linked(s, A2), ...E.linked(s, C2)].map(c => c.id)); toasts.length = 0; app.cmd('rippleDelete');
r.e2_after = dump(s); r.e2_toast = toasts.slice();
// E3: titulky se slovy, Shift+Delete vyroku B -> slova z B pryc, nic se neprekryva
s = await mk('S14 sd-titulky');
const [a, b, c] = s.tracks.audio[0].clips;
s.captions = [
  { start: clipEnd(a) - 2, end: b.start + 2, text: 'konec A zacatek B', ws: [clipEnd(a) - 2, clipEnd(a) - 1, b.start + 0.2, b.start + 1] },
  { start: b.start + 2.2, end: clipEnd(b) - 0.5, text: 'jen v B', ws: [b.start + 2.3, b.start + 3, b.start + 4] },
  { start: c.start + 0.2, end: c.start + 3, text: 've C', ws: [c.start + 0.2, c.start + 1] },
];
s.markers = [{ id: 'k1', time: b.start + 3, duration: 0, name: '', comment: '', color: 0 }, { id: 'k2', time: c.start + 1, duration: 0, name: '', comment: '', color: 0 }];
const bStart = b.start, bLen = clipEnd(b) - b.start, cStart0 = c.start;
app.sel = new Set(E.linked(s, s.tracks.video[0].clips[1]).map(x => x.id)); app.cmd('rippleDelete');
r.e3 = { captions: s.captions.map(x => `${x.start.toFixed(2)}-${x.end.toFixed(2)} "${x.text}"`), markers: s.markers.map(m => m.time.toFixed(2)), expectC: (cStart0 - bLen).toFixed(2), dump: dump(s) };
// E4: Ctrl+Z vraci presny stav (JSON shoda)
const before = JSON.stringify({ t: s.tracks, c: s.captions, m: s.markers });
app.cmd('undo'); const mid = JSON.stringify({ t: s.tracks, c: s.captions, m: s.markers }); app.cmd('redo'); const after = JSON.stringify({ t: s.tracks, c: s.captions, m: s.markers });
r.e4_undoChanged = before !== mid; r.e4_redoSame = before === after;
// E5: ripple trim (Q) pres titulek: Q na A1 po 2 s od zacatku C -> slova v useku pryc
s = await mk('S14 q-titulky');
const cc = s.tracks.audio[0].clips[2];
s.captions = [{ start: cc.start + 0.2, end: cc.start + 4, text: 'raz dva tri ctyri', ws: [cc.start + 0.2, cc.start + 1.0, cc.start + 2.2, cc.start + 3.2] }];
s.playhead = cc.start + 2; app.cmd('rippleTrimPrev');
r.e5 = { captions: s.captions.map(x => `${x.start.toFixed(2)}-${x.end.toFixed(2)} "${x.text}"`), cStart: cc.start.toFixed(2), dump: dump(s) };
return r;
