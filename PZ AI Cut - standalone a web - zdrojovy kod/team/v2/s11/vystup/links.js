// S10: propojeni obraz/zvuk ve vsech sekvencich (linkId, rep) - kontrola 4
const P = TN.app.project, o = {};
const r3 = (x) => +x.toFixed(3);
for (const s of P.sequences) {
  const cl = (t) => t.clips.map((c) => [r3(c.start), r3(c.start + c.out - c.in), r3(c.in), c.linkId || null, c.rep ? 'rep' : '', (P.mediaById(c.mediaId) || {}).name.slice(0, 5)]);
  o[s.name] = { V: s.tracks.video.map(cl), A: s.tracks.audio.map(cl) };
}
return JSON.stringify(o);
