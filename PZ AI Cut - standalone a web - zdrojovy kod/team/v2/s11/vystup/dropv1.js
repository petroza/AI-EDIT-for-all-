// S10: b-roll (vyrez-5min 120,00-123,00; 120,00-120,28 jiny zaber) pretazeny na V1 na konec: 9:16 (s11-drop916b) a 16:9 (s11-sim); cekani 15 s, zaznam, Zpet
const app = TN.app, P = app.project, V = P.media.find((m) => m.name === 'vyrez-5min.mp4');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const toast = () => { const t = document.getElementById('toast'); return t && /show/.test(t.className) ? t.textContent : ''; };
const out = {};
for (const [name, at] of [['s11-drop916b', 12.76], ['s11-sim', 45.92]]) {
  const sid = P.sequences.find((x) => x.name === name).id; app.openSequence(sid); await wait(500);
  const S = () => P.sequences.find((x) => x.id === sid); const h0 = P.history.length;
  app.sel = new Set(); app.dropMedia(V, 120, 123, at, false, {});
  const seen = []; for (let i = 0; i < 60; i++) { await wait(250); const t = toast(); if (t && !seen.includes(t)) seen.push(t); }
  out[name] = { toasts: seen, hist: P.history.slice(h0).map((h) => h.label),
    V: S().tracks.video[0].clips.filter((c) => c.start >= at - 0.5).map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), +(c.posX || 0).toFixed(3), c.linkId ? 'L' : '-']),
    A: S().tracks.audio[0].clips.filter((c) => c.start >= at - 0.5).map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), c.linkId ? 'L' : '-']) };
  while (P.history.length > h0) { app.cmd('undo'); await wait(200); }
}
return JSON.stringify(out);
