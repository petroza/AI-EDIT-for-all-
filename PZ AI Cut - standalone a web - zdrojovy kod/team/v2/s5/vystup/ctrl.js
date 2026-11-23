// S5: kontrolni jednostopa sekvence se stejnymi useky V1/A1 (bez V2/A2/A3 a prechodu) + varianty pro hledani pricin titulku
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const api = TN.app.api, out = {};
const segs = [{ source: L, in: 1544.4, out: 1574.2 }, { source: L, in: 1596.0, out: 1612.1 }, { source: L, in: 749.52, out: 753.32 }];
let r = await api.buildSequence({ name: 's5-ctrl', audioFades: 2, segments: segs });
out.ctrl = { dur: r.duration, edge: r.edgeShotsFixed || null };
r = await api.buildSequence({ name: 's5-ctrl3', audioFades: 2, segments: [segs[2]] });
out.ctrl3 = { dur: r.duration, edge: r.edgeShotsFixed || null };
return JSON.stringify(out);
