// S10 (4): Shift+Delete (cmd rippleDelete) kusu obrazu V1 33,56-45,92 (klik na klip = vyber s propojenymi) v s10-sim916 (api.reframeSequence) a s10-multi916 (menu Auto Reframe), pak Zpet
const app = TN.app, P = app.project, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
for (const [name, t] of [['s10-sim916', 33.56], ['s10-multi916', 33.56]]) {
  const sid = P.sequences.find((x) => x.name === name).id; app.openSequence(sid); await wait(400);
  const S = () => P.sequences.find((x) => x.id === sid);
  const v = S().tracks.video[0].clips.find((c) => Math.abs(c.start - t) < 0.02);
  const linked = v.linkId ? S().tracks.audio.flatMap((tr) => tr.clips).filter((a) => a.linkId === v.linkId).map((a) => a.id) : [];
  app.sel = new Set([v.id, ...linked]); const h0 = P.history.length;
  const dur0 = Math.max(...S().tracks.audio[0].clips.map((c) => c.start + c.out - c.in));
  app.cmd('rippleDelete'); await wait(400);
  const r3 = (x) => +x.toFixed(2);
  out[name] = { selected: app.sel.size, linkedAudio: linked.length, hist: P.history.slice(h0).map((h) => h.label),
    V1: S().tracks.video[0].clips.map((c) => [r3(c.start), r3(c.start + c.out - c.in)]), A1: S().tracks.audio[0].clips.map((c) => [r3(c.start), r3(c.start + c.out - c.in), r3(c.in)]), a1EndBefore: r3(dur0) };
  while (P.history.length > h0) { app.cmd('undo'); await wait(200); }
}
return JSON.stringify(out);
