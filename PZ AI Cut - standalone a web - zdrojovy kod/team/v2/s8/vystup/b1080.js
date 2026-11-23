// S8: kopie s8-a a s8-sim v 1920x1080 (stejne useky pres buildSequence + titulky zkopirovane) pro XDCAM
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, P = TN.app.project, out = {};
for (const [name, from, src, rs] of [['s8-a1080', 's8-a', V, [[104.6, 107.36], [114.88, 119.36], [145.68, 151.16], [187.96, 191.24]]], ['s8-sim1080', 's8-sim', L, [[1544.4, 1574.2], [1596.0, 1612.1]]]]) {
  const r = await api.buildSequence({ name, audioFades: 2, segments: rs.map(([i, o]) => ({ source: src, in: i, out: o })) });
  const s = P.sequences.find((x) => x.id === r.sequenceID), f = P.sequences.find((x) => x.name === from);
  P.edit('S8 1080', () => { s.width = 1920; s.height = 1080; s.captions = JSON.parse(JSON.stringify(f.captions)); if (f.captionStyle) s.captionStyle = JSON.parse(JSON.stringify(f.captionStyle)); });
  out[name] = { dur: r.duration, edge: r.edgeShotsFixed || null, caps: s.captions.length };
}
const O = 'vystup-s8-';
window.__S8JOBS = [
  ['s8-a', 'h264', 'social', O + 'a.mp4'], ['s8-a916', 'h264', 'social', O + 'a916.mp4'], ['s8-a11', 'h264', 'social', O + 'a11.mp4'],
  ['s8-sim', 'h264', 'social', O + 'sim.mp4'], ['s8-sim916', 'h264', 'social', O + 'sim916.mp4'], ['s8-sim11', 'h264', 'social', O + 'sim11.mp4'],
  ['s8-k219', 'h264', 'social', O + 'k219.mp4'], ['s8-k219916', 'h264', 'social', O + 'k219916.mp4'], ['s8-k21911', 'h264', 'social', O + 'k21911.mp4'],
  ['s8-a1080', 'xdcam', 'tv', O + 'a1080-xdcam.mxf'], ['s8-sim1080', 'xdcam', 'tv', O + 'sim1080-xdcam.mxf'], ['s8-sim', 'dnxhr', 'tv', O + 'sim-dnxhr.mxf'],
  ['s8-sim', 'h264', 'social', O + 'sim-bez.mp4', false], ['s8-sim916', 'h264', 'social', O + 'sim916-bez.mp4', false]];
return JSON.stringify(out);
