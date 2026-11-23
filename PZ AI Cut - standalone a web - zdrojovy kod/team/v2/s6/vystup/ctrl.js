// S6: kontrolni jednostopa sekvence se stejnymi useky V1/A1 (bez V2/A2/A3 a prechodu) + ctrl-23 (useky 2 a 3, z S5 nulovy titulek 16,12-16,12)
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, out = {};
const segs = [{ source: L, in: 1544.4, out: 1574.2 }, { source: L, in: 1596.0, out: 1612.1 }, { source: L, in: 749.52, out: 753.32 }];
let r = await api.buildSequence({ name: 's6-ctrl', audioFades: 2, segments: segs });
out.ctrl = { dur: r.duration, edge: r.edgeShotsFixed || null };
r = await api.buildSequence({ name: 's6-ctrl-23', audioFades: 2, segments: [segs[1], segs[2]] });
out.ctrl23 = { dur: r.duration, edge: r.edgeShotsFixed || null };
return JSON.stringify(out);
