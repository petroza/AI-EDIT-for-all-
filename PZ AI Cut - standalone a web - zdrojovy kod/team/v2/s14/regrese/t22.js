const P = TN.app.project, api = TN.app.api;
const { clipEnd } = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/model');
const chk = (s) => {
  const v = s.tracks.video[0].clips, a = s.tracks.audio[0].clips;
  const fps = s.fps; const offGrid = v.filter(c => Math.abs(c.start * fps - Math.round(c.start * fps)) > 1e-3).length;
  const unlinked = v.filter(c => !c.linkId || !a.some(x => x.linkId === c.linkId)).length;
  const orphanA = a.filter(x => !x.linkId || !v.some(c => c.linkId === x.linkId)).length;
  const mism = v.filter(c => { const x = a.find(y => y.linkId === c.linkId); return x && (Math.abs(x.start - c.start) > 0.2 || Math.abs(clipEnd(x) - clipEnd(c)) > 0.2); }).length;
  return { n: v.length, nA: a.length, offGrid, unlinked, orphanA, mism, clips: v.map(c => `${c.start.toFixed(2)}-${clipEnd(c).toFixed(2)} x=${(c.posX||0).toFixed(3)}${c.hold ? ' hold' : ''}`) };
};
const r = {};
for (const n of ['S14 vyrez 60s', 'S14 k219', 'S14 s1-145']) {
  const s = P.sequences.find(x => x.name === n);
  const t0 = Date.now();
  try { const res = await api.reframeSequence({ sequence: s.id, format: '9:16' }); const s2 = P.sequences.find(x => x.id === res.sequenceID); r[n] = Object.assign(chk(s2), { s: (Date.now() - t0) / 1000, id: s2.id, name: s2.name }); }
  catch (e) { r[n] = 'ERR ' + e.message; }
}
return r;
