// S11 (3): zopakovany konec = vlastnost klipu hold. Sekvence s11-h (buildSequence: 1544,40-1549,00 + 1263,60-1265,12 = konec s cizim zaberem pod reci)
// kopie a v kazde jedna operace prikazy menu (TN.app.cmd): Ctrl+K pred hold / uvnitr hold, Delete (lift) posledniho klipu, Shift+Delete, W (ripple trim konce), Ctrl+Z
const app = TN.app, P = app.project, api = app.api, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const toast = () => { const t = document.getElementById('toast'); return t && /show/.test(t.className) ? t.textContent : ''; };
const r = await api.buildSequence({ name: 's11-h', audioFades: 2, segments: [{ source: L, in: 1544.4, out: 1549.0 }, { source: L, in: 1263.6, out: 1265.12 }] });
const copy = (from, name) => { let id; P.edit('S11 copy', () => { const s = JSON.parse(JSON.stringify(P.sequences.find((x) => x.name === from))); s.id = U.uuid(); s.name = name; const lm = {}; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) { c.id = U.uid('c'); if (c.linkId) c.linkId = lm[c.linkId] = lm[c.linkId] || U.uid('l'); } P.addSequence(s); id = s.id; }); return id; };
const r3 = (x) => +x.toFixed(3);
const st = (s) => ({ V1: s.tracks.video[0].clips.map((c) => [r3(c.start), r3(c.start + c.out - c.in), r3(c.in), r3(c.out), c.hold ? [c.hold.d, r3(c.hold.out)] : null, c.linkId ? 'L' : '-', c.rep ? 'REP' : '']),
  A1: s.tracks.audio[0].clips.map((c) => [r3(c.start), r3(c.start + c.out - c.in), r3(c.in), c.linkId ? 'L' : '-']), V2: s.tracks.video.slice(1).map((t) => t.clips.length) });
const out = { build: { dur: r.duration, edge: r.edgeShotsFixed || null }, h: st(P.sequences.find((x) => x.id === r.sequenceID)) };
const end = r.duration, last = (s) => s.tracks.video[0].clips[s.tracks.video[0].clips.length - 1];
const ops = [
  ['s11-h-k-pred', async (s) => { app.sel = new Set(); app.setPlayhead(end - 0.72); await wait(100); app.cmd('addEdit'); }],
  ['s11-h-k-hold', async (s) => { app.sel = new Set(); app.setPlayhead(end - 0.08); await wait(100); app.cmd('addEdit'); }],
  ['s11-h-del', async (s) => { const v = last(s); app.sel = new Set([v.id, ...s.tracks.audio.flatMap((t) => t.clips).filter((a) => a.linkId && a.linkId === v.linkId).map((a) => a.id)]); app.cmd('delete'); }],
  ['s11-h-ripdel', async (s) => { const v = last(s); app.sel = new Set([v.id, ...s.tracks.audio.flatMap((t) => t.clips).filter((a) => a.linkId && a.linkId === v.linkId).map((a) => a.id)]); app.cmd('rippleDelete'); }],
  ['s11-h-w', async (s) => { app.sel = new Set(); app.setPlayhead(end - 0.08); await wait(100); app.cmd('rippleTrimNext'); }],
  ['s11-h-w-zpet', async (s) => { app.sel = new Set(); app.setPlayhead(end - 0.08); await wait(100); app.cmd('rippleTrimNext'); await wait(200); app.cmd('undo'); }],
];
for (const [name, fn] of ops) {
  const sid = copy('s11-h', name); app.openSequence(sid); await wait(400); const h0 = P.history.length;
  await fn(P.sequences.find((x) => x.id === sid)); await wait(500);
  const s = P.sequences.find((x) => x.id === sid);
  out[name] = Object.assign({ hist: P.history.slice(h0).map((h) => h.label), toast: toast(), dur: r3(Math.max(0, ...s.tracks.video[0].clips.map((c) => c.start + c.out - c.in))) }, st(s));
}
const O = 'vystup-s11-';
window.__S11JOBS = [['s11-h', 'h264', 'social', O + 'h.mp4', false], ...ops.map(([n]) => [n, 'h264', 'social', O + n.slice(4) + '.mp4', false])];
return JSON.stringify(out, null, 0);
