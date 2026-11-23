// S10: jedno Zpet po b-rollu v s11-v916 (kroky Overwrite + Clean up) - co vrati; pak Znovu
const app = TN.app, P = app.project; const sid = P.sequences.find((x) => x.name === 's11-v916').id; const S = () => P.sequences.find((x) => x.id === sid);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const v2 = () => S().tracks.video[1].clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +(c.posX || 0).toFixed(3), c.linkId ? 'L' : '-']);
const a2 = () => S().tracks.audio[1].clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), c.linkId ? 'L' : '-']);
const out = [['start', P.history.slice(-2).map((h) => h.label), v2(), a2()]];
app.cmd('undo'); await wait(300); out.push(['undo1', v2(), a2()]);
app.cmd('undo'); await wait(300); out.push(['undo2', v2(), a2()]);
app.cmd('redo'); await wait(300); app.cmd('redo'); await wait(300); out.push(['redo2', v2(), a2()]);
return JSON.stringify(out);
