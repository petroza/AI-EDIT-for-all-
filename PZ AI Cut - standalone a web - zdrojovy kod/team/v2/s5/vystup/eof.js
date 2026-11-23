// S5: sekvence koncici presne na konci zdroje a zacinajici na 0,0 s (cas kazdeho kroku)
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const app = TN.app, P = app.project, api = app.api;
const mV = P.media.find((m) => m.name === 'vyrez-5min.mp4'), mM = P.media.find((m) => m.name === 'mus_stem.wav');
const LD = P.media.find((m) => m.path.replace(/\\/g, '/') === L).duration;
const out = { LD, VD: mV.duration };
const tm = async (k, f) => { const t0 = Date.now(); try { const r = await f(); out[k] = Object.assign({ ms: Date.now() - t0 }, r); } catch (e) { out[k] = { ms: Date.now() - t0, err: e.message }; } };
const desc = (name) => { const s = P.sequences.find((x) => x.name === name); return { dur: +app.seqDuration(s).toFixed(3), v: s.tracks.video.map((t) => t.clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), +c.out.toFixed(3)])).filter((x) => x.length), a: s.tracks.audio.map((t) => t.clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), +c.out.toFixed(3)])).filter((x) => x.length) }; };
const b = async (name, segs) => { const r = await api.buildSequence({ name, audioFades: 2, segments: segs }); return Object.assign({ edge: r.edgeShotsFixed || null, reported: r.duration, warnings: r.warnings }, desc(name)); };
await tm('eofL', () => b('s5-eofL', [{ source: L, in: 1680.0, out: LD }]));
await tm('eofV', () => b('s5-eofV', [{ source: V, in: 296.0, out: 300.0 }]));
await tm('eofOver', () => b('s5-eofOver', [{ source: L, in: 1684.0, out: 1690.0 }]));
await tm('eofMulti', async () => {
  const r = await b('s5-eofMulti', [{ source: L, in: 1544.4, out: 1550.0 }, { source: L, in: 1682.0, out: LD }]);
  const s = P.sequences.find((x) => x.name === 's5-eofMulti'); app.openSequence(s.id);
  const end = app.seqDuration(s);
  app.dropMedia(mV, 300 - 3.0, 300, end - 3.0, false, { video: 1, audio: 1 }); // b-roll konci na konci sekvence i na konci souboru V
  app.dropMedia(mM, 0, end, 0, false, { audio: 2 });
  app.edit('Audio Gain', () => { for (const c of s.tracks.audio[1].clips) c.gainDb = -12; for (const c of s.tracks.audio[2].clips) c.gainDb = -18; });
  app.sel = new Set(); app.setPlayhead(end); app.cmd('applyDipBlack');
  return desc('s5-eofMulti');
});
await tm('eofMulti916', async () => { const s = P.sequences.find((x) => x.name === 's5-eofMulti'); const r = await window.__pzReframe(s, 9, 16, 1080, 1920); const n = P.sequences.find((x) => x.name === r.name); P.edit('rename', () => { n.name = 's5-eofMulti916'; }); return Object.assign({ shots: r.shots, faces: r.facesFound, splits: r.splits }, desc('s5-eofMulti916')); });
await tm('eofL916', async () => { const s = P.sequences.find((x) => x.name === 's5-eofL'); const r = await api.reframeSequence({ sequence: s.id, num: 9, den: 16, width: 1080, height: 1920, name: 's5-eofL916' }); return Object.assign({ shots: r.shots, splits: r.cameraSplits, edge: r.edgeShotsFixed || null }, desc('s5-eofL916')); });
await tm('start0', async () => {
  const r = await b('s5-start0', [{ source: L, in: 0.0, out: 4.0 }, { source: V, in: 0.0, out: 3.0 }]);
  const s = P.sequences.find((x) => x.name === 's5-start0'); app.openSequence(s.id);
  app.dropMedia(mV, 0.0, 1.6, 0.0, false, { video: 1, audio: 1 }); // V2 od 0,0 na timeline i ve zdroji
  app.edit('Audio Gain', () => { for (const c of s.tracks.audio[1].clips) c.gainDb = -12; });
  app.sel = new Set(); app.setPlayhead(0); app.cmd('applyCross'); // prolinacka na zacatku = roztmivani
  return desc('s5-start0');
});
await tm('start0_916', async () => { const s = P.sequences.find((x) => x.name === 's5-start0'); const r = await window.__pzReframe(s, 9, 16, 1080, 1920); const n = P.sequences.find((x) => x.name === r.name); P.edit('rename', () => { n.name = 's5-start0916'; }); return desc('s5-start0916'); });
return JSON.stringify(out, null, 1);
