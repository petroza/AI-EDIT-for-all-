// S9: stejny useek b-rollu (vyrez-5min 120,00-123,00; 120,00-120,28 je jiny zaber) pretazeny na V1 na konec s11-drop916b (9:16) a pro srovnani
// do 16:9 sekvence s11-a na V2 (prazdne misto 2-5 s). Zaznam klipu po 5 s, pak Zpet.
const app = TN.app, P = app.project, V = P.media.find((m) => m.name === 'vyrez-5min.mp4');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const toast = () => { const t = document.getElementById('toast'); return t && /show/.test(t.className) ? t.textContent : ''; };
const out = {};
for (const [name, at, tg] of [['s11-drop916b', 12.76, {}], ['s11-a', 2.0, { video: 1, audio: 1 }]]) {
  const sid = P.sequences.find((x) => x.name === name).id; app.openSequence(sid); await wait(500);
  const S = () => P.sequences.find((x) => x.id === sid); const h0 = P.history.length;
  app.sel = new Set(); app.dropMedia(V, 120, 123, at, false, tg);
  const seen = []; for (let i = 0; i < 24; i++) { await wait(250); const t = toast(); if (t && !seen.includes(t)) seen.push(t); }
  const k = tg.video || 0;
  out[name] = { toasts: seen, hist: P.history.slice(h0).map((h) => h.label),
    V: S().tracks.video[k].clips.filter((c) => c.start >= at - 0.01).map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), +(c.posX || 0).toFixed(3), c.linkId ? 'L' : '-']),
    A: S().tracks.audio[k].clips.filter((c) => c.start >= at - 0.01).map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), c.linkId ? 'L' : '-']) };
  while (P.history.length > h0) { app.cmd('undo'); await wait(200); }
}
return JSON.stringify(out);
