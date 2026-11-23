const P = TN.app.project, api = TN.app.api, E = TN.app.editCore, app = TN.app;
const Vm = P.media.find(m => m.name === 'vyrez-5min.mp4');
const { clipEnd } = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/model');
const b = await api.buildSequence({ name: 'S14 v2-broll', segments: [{ source: Vm.path, in: 20, out: 32 }] });
await new Promise(res => setTimeout(res, 3000));
const s = P.sequences.find(x => x.id === b.sequenceID); app.openSequence(s.id); await new Promise(r => setTimeout(r, 300));
const toasts = []; const t0 = app.toast; app.toast = (m, e) => { toasts.push(m); return t0.call(app, m, e); };
// b-roll na V2 (video only): In 145.68 (strih kamery 145.96) -> 7 snimku ciziho zaberu na zacatku
app.dropMedia(Vm, 145.68, 149.68, 3, false, { video: 1, audio: 2 });
await new Promise(r => setTimeout(r, 6000));
app.toast = t0;
window.__s14 = { id: s.id };
const v2 = s.tracks.video[1].clips.map(c => `${c.start.toFixed(2)}-${clipEnd(c).toFixed(2)} [${c.in.toFixed(2)}] L=${c.linkId ? 1 : 0}`);
const a3 = s.tracks.audio[2].clips.map(c => `${c.start.toFixed(2)}-${clipEnd(c).toFixed(2)} [${c.in.toFixed(2)}] L=${c.linkId ? 1 : 0}`);
return { v2, a3, toasts };
