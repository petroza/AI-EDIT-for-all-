// S8 NOVE (cast 3): b-roll na V2/A2 pres TN.app.dropMedia(m, 120, 123, 20, false, {video:1, audio:1}) (= pretazeni z Projektu); zdroj 120,00-120,28 je jiny zaber
const app = TN.app, P = app.project, V = P.media.find((m) => m.name === 'vyrez-5min.mp4');
const s = P.sequences.find((x) => x.name === 's11-v916'); app.openSequence(s.id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (q) => JSON.stringify({ tracks: q.tracks, captions: q.captions, markers: q.markers });
const v1 = (q) => JSON.stringify([q.tracks.video[0], q.tracks.audio[0]]);
const before = v1(s), h0 = P.history.length;
app.sel = new Set(); app.dropMedia(V, 120, 123, 20, false, { video: 1, audio: 1 });
const right = JSON.stringify(s.tracks.video[1].clips.map((c) => [c.start, c.in, c.out]));
const seen = [];
for (let i = 0; i < 24; i++) { await wait(250); const t = document.getElementById('toast'); if (t && /show/.test(t.className) && !seen.includes(t.textContent)) seen.push(t.textContent); }
const q = P.sequences.find((x) => x.id === s.id);
window.__K.push({ op: 'b-roll V2', h: P.history.length, key: key(q) });
return JSON.stringify({ hned: right, toasts: seen, histAdded: P.history.slice(h0).map((h) => h.label), v1a1Same: v1(q) === before,
  V2: q.tracks.video[1].clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.fit, c.posX, c.linkId]),
  A2: q.tracks.audio[1].clips.map((c) => [+c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), c.linkId]),
  V1: q.tracks.video[0].clips.length, A1: q.tracks.audio[0].clips.length, K: window.__K.map((k) => [k.op, k.h]) }, null, 1);
