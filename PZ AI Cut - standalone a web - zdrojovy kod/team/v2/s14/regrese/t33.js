const P = TN.app.project; const M = 'C:/Users/Petr/AppData/Local/Temp/claude/e8748af4ca7f4462/9b93f9a2-8c9d-4cd4-96a5-b0bc52e46c70/scratchpad/s14/media/';
await TN.app.importPaths([M + 'vfr.mp4']); const m = P.media.find(x => x.name === 'vfr.mp4');
const b = await TN.app.api.buildSequence({ name: 'S14 vfr', segments: [{ source: m.path, in: 0, out: 5 }] });
const s = P.sequences.find(x => x.id === b.sequenceID);
return { mediaFps: m.fps, seqFps: s.fps };
