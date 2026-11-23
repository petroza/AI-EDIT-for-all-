// S5: co udela api.buildSequence s videoTrack / audioTrack / audioOnly / extra (vstup MCP build_sequence)
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const M = 'O:/STRIH TEST/data/mus_stem.wav';
const r = await TN.app.api.buildSequence({ name: 's5-api-vt', audioFades: 2, segments: [
  { source: L, in: 1544.4, out: 1550.0, extra: [{ source: M, offset: -1544.4, audioTrack: 2 }] },
  { source: V, in: 200.0, out: 203.0, videoTrack: 1, audioTrack: 1 },
  { source: M, in: 10.0, out: 12.0, audioOnly: true, audioTrack: 2 },
] });
const s = TN.app.project.sequences.find((x) => x.id === r.sequenceID);
const d = (t) => t.clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), (TN.app.project.mediaById(c.mediaId) || {}).name.slice(0, 10)]);
return JSON.stringify({ placed: r.placed, warnings: r.warnings, duration: r.duration, video: s.tracks.video.map(d), audio: s.tracks.audio.map(d) }, null, 0);
