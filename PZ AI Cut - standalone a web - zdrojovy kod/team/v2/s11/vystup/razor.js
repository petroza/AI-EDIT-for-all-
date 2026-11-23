// S10 (2): zileka (cmd addEdit = Ctrl+K, nic nevybrano, cilove stopy) uprostred reci v kopiich sekvenci; hlasky, klipy, propojeni.
// s11-razor (z s11-sim, 16:9), s11-razor916 (z s11-sim916, 9:16 po vyrezu), s11-razormulti (z s11-multi; Ctrl+K vsechny cilove stopy V1-V2/A1-A3),
// s11-razor-g (z s11-sim, rezy jako s11-razor + druhy kus kazdeho rezu zesileni -0,01 dB = bez cteni vcelku - kontrola, co by bylo bez opravy)
const app = TN.app, P = app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const toast = () => { const t = document.getElementById('toast'); return t && /show/.test(t.className) ? t.textContent : ''; };
const copy = (from, name) => { let id; P.edit('S10 copy', () => { const s = JSON.parse(JSON.stringify(P.sequences.find((x) => x.name === from))); s.id = U.uuid(); s.name = name; const lm = {}; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) { c.id = U.uid('c'); if (c.linkId) c.linkId = lm[c.linkId] = lm[c.linkId] || U.uid('l'); } s.inPoint = null; s.outPoint = null; P.addSequence(s); id = s.id; }); return id; };
const r3 = (x) => +x.toFixed(3);
const cl = (t) => t.clips.map((c) => [r3(c.start), r3(c.start + c.out - c.in), r3(c.in), c.linkId ? c.linkId.slice(-4) : null, c.gainDb || 0]);
const out = {};
for (const [from, name, cuts, gain] of [['s11-sim', 's11-razor', [5.0, 12.36, 20.52, 38.04], false], ['s11-sim916', 's11-razor916', [5.0, 12.36, 20.52, 38.04], false],
  ['s11-multi', 's11-razormulti', [10.0, 28.4, 41.0], false], ['s11-sim', 's11-razor-g', [5.0, 12.36, 20.52, 38.04], true]]) {
  const sid = copy(from, name); app.openSequence(sid); await wait(500);
  const S = () => P.sequences.find((x) => x.id === sid); const r = [];
  for (const t of cuts) { app.sel = new Set(); app.setPlayhead(t); await wait(100); app.cmd('addEdit'); await wait(400); r.push([t, toast()]); }
  if (gain) P.edit('S10 gain', () => { for (const t of cuts) { const c = S().tracks.audio[0].clips.find((x) => Math.abs(x.start - t) < 0.03); if (c) c.gainDb = -0.01; } });
  out[name] = { cuts: r, hist: P.history.slice(-cuts.length).map((h) => h.label), V: S().tracks.video.map(cl), A: S().tracks.audio.map(cl) };
}
const O = 'vystup-s11-';
window.__S11JOBS = [['s11-razor', 'h264', 'social', O + 'razor.mp4'], ['s11-razor916', 'h264', 'social', O + 'razor916.mp4'], ['s11-razormulti', 'h264', 'social', O + 'razormulti.mp4'],
  ['s11-razormulti', 'prores', 'off', O + 'razormulti-pcm.mov', false], ['s11-razor-g', 'h264', 'social', O + 'razor-g.mp4']];
return JSON.stringify(out);
