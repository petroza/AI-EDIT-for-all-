const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const api = TN.app.api, P = TN.app.project, out = {};
for (const [name, from, rs] of [['s4-a1080', 's4-a', [[104.6, 107.36], [114.88, 119.36], [145.68, 151.16], [187.96, 191.24]]], ['s4-e1080', 's4-e', [[16.36, 18.4], [119.48, 123.72], [181.64, 185.16]]]]) {
  const r = await api.buildSequence({ name, audioFades: 2, segments: rs.map(([i, o]) => ({ source: V, in: i, out: o })) });
  const s = P.sequences.find((x) => x.id === r.sequenceID), f = P.sequences.find((x) => x.name === from);
  P.edit('S4 1080', () => { s.width = 1920; s.height = 1080; s.captions = JSON.parse(JSON.stringify(f.captions)); if (f.captionStyle) s.captionStyle = JSON.parse(JSON.stringify(f.captionStyle)); });
  out[name] = { dur: r.duration, edge: r.edgeShotsFixed || null, caps: s.captions.length };
}
return JSON.stringify(out);
