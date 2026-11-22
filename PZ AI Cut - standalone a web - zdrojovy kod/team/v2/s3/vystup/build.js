// S3 vystup: sekvence pres TN.app.api.buildSequence (useky z S2) + Auto Reframe 9:16 / 1:1
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, out = {};
const b = async (name, src, rs) => { const r = await api.buildSequence({ name, audioFades: 2, segments: rs.map(([i, o]) => ({ source: src, in: i, out: o })) }); out[name] = { dur: r.duration, edge: r.edgeShotsFixed || null }; return r; };
await b('s3-a', V, [[104.6, 107.36], [114.88, 119.36], [145.68, 151.16], [187.96, 191.24]]);
let r = await api.reframeSequence({ sequence: 's3-a', name: 's3-b', num: 9, den: 16 }); out['s3-b'] = r;
await b('s3-d16', V, [[127.36, 135.96], [145.68, 163.12], [183.56, 185.16]]);
r = await api.reframeSequence({ sequence: 's3-d16', name: 's3-d', num: 1, den: 1, height: 1080 }); out['s3-d'] = r;
await b('s3-e', V, [[16.36, 18.4], [119.48, 123.72], [181.64, 185.16]]);
await b('s3-sim', L, [[1544.4, 1574.2], [1596.0, 1612.1]]);
r = await api.reframeSequence({ sequence: 's3-sim', name: 's3-sim916', num: 9, den: 16 }); out['s3-sim916'] = r;
return JSON.stringify(out);
