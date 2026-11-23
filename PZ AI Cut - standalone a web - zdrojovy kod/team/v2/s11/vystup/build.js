// S8 vystup: jednostope sceny S2/S4 pres TN.app.api.buildSequence (audioFades 2) + Auto Reframe 9:16 / 1:1 (api.reframeSequence)
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, out = {};
const b = async (name, src, rs) => { const r = await api.buildSequence({ name, audioFades: 2, segments: rs.map(([i, o]) => ({ source: src, in: i, out: o })) }); out[name] = { dur: r.duration, edge: r.edgeShotsFixed || null }; return r; };
const rf = async (sequence, name, num, den, height) => { const t0 = Date.now(); const r = await api.reframeSequence(Object.assign({ sequence, name, num, den }, height ? { height } : {})); out[name] = { dur: r.duration, shots: r.shots, merged: r.merged, name: r.name, ms: Date.now() - t0 }; };
await b('s11-a', V, [[104.6, 107.36], [114.88, 119.36], [145.68, 151.16], [187.96, 191.24]]);
await rf('s11-a', 's11-a916', 9, 16);
await rf('s11-a', 's11-a11', 1, 1, 1080);
await b('s11-sim', L, [[1544.4, 1574.2], [1596.0, 1612.1]]);
await rf('s11-sim', 's11-sim916', 9, 16);
await rf('s11-sim', 's11-sim11', 1, 1, 1080);
await b('s11-k219', L, [[1263.6, 1265.12]]);
await rf('s11-k219', 's11-k219916', 9, 16);
await rf('s11-k219', 's11-k21911', 1, 1, 1080);
out.asr = TN.app.project.media.map((m) => [m.name.slice(0, 12), window.__pzASR ? JSON.stringify(window.__pzASR.status(m)).slice(0, 80) : '-']);
return JSON.stringify(out);
