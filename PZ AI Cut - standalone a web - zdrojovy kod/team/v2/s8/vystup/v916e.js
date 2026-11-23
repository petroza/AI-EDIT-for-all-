// S8 NOVE (cast 4): Zpet (cmd undo) krok po kroku az na prazdnou sekvenci 9:16, pak Znovu (cmd redo) - porovnani obsahu sekvence se stavy po operacich
const app = TN.app, P = app.project;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (q) => JSON.stringify({ tracks: q.tracks, captions: q.captions, markers: q.markers });
const sid = P.sequences.find((x) => x.name === 's8-v916').id;
const cur = () => P.sequences.find((x) => x.id === sid);
const match = () => { const k = key(cur()); const i = window.__K.findIndex((x) => x.key === k); return i >= 0 ? window.__K[i].op : 'zadny ze stavu'; };
const V2 = () => JSON.stringify(cur().tracks.video[1].clips.map((c) => [c.start, c.in, c.out]));
const log = [];
const top = window.__K[window.__K.length - 1].h, bottom = window.__K[0].h;
for (let h = top; h > bottom; h--) { const lab = P.history[P.history.length - 1].label; app.cmd('undo'); await wait(150); log.push(['Zpet ' + lab, P.history.length, match(), V2(), cur().tracks.video[0].clips.length]); }
for (let h = bottom; h < top; h++) { app.cmd('redo'); await wait(150); log.push(['Znovu', P.history.length, match(), V2(), cur().tracks.video[0].clips.length]); }
log.push(['konec = stav po b-rollu', key(cur()) === window.__K[window.__K.length - 1].key]);
return JSON.stringify(log);
