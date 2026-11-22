// S4 vystup: sekvence pres TN.app.api.buildSequence (useky z S2/S3) + Auto Reframe 9:16 / 1:1 + nove konce sekvence
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, out = {};
const b = async (name, src, rs) => { const r = await api.buildSequence({ name, audioFades: 2, segments: rs.map(([i, o]) => ({ source: src, in: i, out: o })) }); out[name] = { dur: r.duration, edge: r.edgeShotsFixed || null }; return r; };
const rf = async (sequence, name, num, den, height) => { const r = await api.reframeSequence(Object.assign({ sequence, name, num, den }, height ? { height } : {})); out[name] = { dur: r.duration, shots: r.shots, merged: r.merged, name: r.name }; };
await b('s4-a', V, [[104.6, 107.36], [114.88, 119.36], [145.68, 151.16], [187.96, 191.24]]);
await rf('s4-a', 's4-b', 9, 16);
await rf('s4-a', 's4-c', 1, 1, 1080);
await b('s4-d16', V, [[127.36, 135.96], [145.68, 163.12], [183.56, 185.16]]);
await rf('s4-d16', 's4-d', 1, 1, 1080);
await b('s4-e', V, [[16.36, 18.4], [119.48, 123.72], [181.64, 185.16]]);
await b('s4-sim', L, [[1544.4, 1574.2], [1596.0, 1612.1]]);
await rf('s4-sim', 's4-sim916', 9, 16);
await rf('s4-sim', 's4-sim11', 1, 1, 1080);
// NOVE: konec sekvence
await b('s4-k219a', L, [[1263.6, 1265.12]]);
await b('s4-k219b', L, [[1261.84, 1263.42], [1263.6, 1265.12]]);
await rf('s4-k219b', 's4-k219b916', 9, 16);
await rf('s4-k219b', 's4-k219b11', 1, 1, 1080);
await b('s4-k138', L, [[749.52, 753.32]]);
await rf('s4-k138', 's4-k138916', 9, 16);
await b('s4-k30', L, [[199.12, 200.78]]);
return JSON.stringify(out);
