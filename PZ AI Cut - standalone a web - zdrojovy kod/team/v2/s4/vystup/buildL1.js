const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, out = {};
const segs = [[1544.4, 1574.2], [1596.0, 1612.1]].map(([i, o]) => ({ source: L, in: i, out: o }));
for (const n of ['s4-L1dlg169', 's4-L1api169']) { const r = await api.buildSequence({ name: n, audioFades: 2, segments: segs }); out[n] = r.duration; }
for (const [from, n] of [['s4-L1dlg169', 's4-L1dlg916'], ['s4-L1api169', 's4-L1api916'], ['s4-sim', 's4-L1post916'], ['s4-sim', 's4-L1post169tmp']]) {
  const r = await api.reframeSequence({ sequence: from, name: n, num: 9, den: 16 }); out[n] = r.name;
}
const P = TN.app.project;
return JSON.stringify(Object.assign(out, { caps: P.sequences.filter((s) => /L1/.test(s.name)).map((s) => [s.name, (s.captions || []).length]) }));
