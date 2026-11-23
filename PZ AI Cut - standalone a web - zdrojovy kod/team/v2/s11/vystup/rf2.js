// S11: Auto Reframe 9:16 cestou menu (window.__pzReframe) i pro s11-a (uklid lead, L-strih) a s11-k219 (hold na konci) - srovnani s api.reframeSequence
const app = TN.app, P = app.project, out = {};
for (const [from, nm] of [['s11-a', 's11-a916m'], ['s11-k219', 's11-k219916m'], ['s11-sim', 's11-sim916m']]) {
  const src = P.sequences.find((x) => x.name === from); const t0 = Date.now();
  const r = await window.__pzReframe(src, 9, 16, 1080, 1920);
  const s = P.sequences.find((x) => x.name === r.name); P.edit('rename', () => { s.name = nm; });
  const cl = (t) => t.clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), +(c.posX || 0).toFixed(3), c.linkId ? c.linkId.slice(-3) : null, c.hold || null]);
  out[nm] = { ms: Date.now() - t0, r, V1: cl(s.tracks.video[0]), A1: cl(s.tracks.audio[0]), caps: (s.captions || []).map((c) => [c.start, c.end, c.text.replace(/\n/g, ' / ')]) };
}
window.__S11SEQS = ['s11-a916m', 's11-k219916m', 's11-sim916m'];
return JSON.stringify(out, null, 0);
