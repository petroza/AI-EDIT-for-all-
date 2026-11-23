// S8: kopie s9-a a s9-sim v 1920x1080 (stejne useky pres buildSequence + titulky zkopirovane) pro XDCAM
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, P = TN.app.project, out = {};
for (const [name, from, src, rs] of [['s9-a1080', 's9-a', V, [[104.6, 107.36], [114.88, 119.36], [145.68, 151.16], [187.96, 191.24]]], ['s9-sim1080', 's9-sim', L, [[1544.4, 1574.2], [1596.0, 1612.1]]]]) {
  const r = await api.buildSequence({ name, audioFades: 2, segments: rs.map(([i, o]) => ({ source: src, in: i, out: o })) });
  const s = P.sequences.find((x) => x.id === r.sequenceID), f = P.sequences.find((x) => x.name === from);
  P.edit('S9 1080', () => { s.width = 1920; s.height = 1080; s.captions = JSON.parse(JSON.stringify(f.captions)); if (f.captionStyle) s.captionStyle = JSON.parse(JSON.stringify(f.captionStyle)); });
  out[name] = { dur: r.duration, edge: r.edgeShotsFixed || null, caps: s.captions.length };
}
const O = 'vystup-s9-';
window.__S9JOBS = [
  ['s9-a', 'h264', 'social', O + 'a.mp4'], ['s9-a916', 'h264', 'social', O + 'a916.mp4'], ['s9-a11', 'h264', 'social', O + 'a11.mp4'],
  ['s9-sim', 'h264', 'social', O + 'sim.mp4'], ['s9-sim916', 'h264', 'social', O + 'sim916.mp4'], ['s9-sim11', 'h264', 'social', O + 'sim11.mp4'],
  ['s9-k219', 'h264', 'social', O + 'k219.mp4'], ['s9-k219916', 'h264', 'social', O + 'k219916.mp4'], ['s9-k21911', 'h264', 'social', O + 'k21911.mp4'],
  ['s9-a1080', 'xdcam', 'tv', O + 'a1080-xdcam.mxf', false, null, { srtSidecar: true }], ['s9-sim1080', 'xdcam', 'tv', O + 'sim1080-xdcam.mxf', false, null, { srtSidecar: true }], ['s9-sim', 'prores_hq', 'tv', O + 'sim-proreshq.mov', false], ['s9-sim', 'h264', 'social', O + 'sim-inout.mp4', true, null, { range: 'inout' }], ['s9-sim', 'dnxhr', 'tv', O + 'sim-dnxhr.mxf'],
  ['s9-sim', 'h264', 'social', O + 'sim-bez.mp4', false], ['s9-sim916', 'h264', 'social', O + 'sim916-bez.mp4', false]];
P.edit('S9 In/Out', () => { const q = P.sequences.find((x) => x.name === 's9-sim'); q.inPoint = 10.0; q.outPoint = 33.0; });
return JSON.stringify(out);
