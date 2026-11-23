const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
await TN.app.importPaths([V, L, 'O:/STRIH TEST/data/mus_stem.wav']);
await new Promise((r) => setTimeout(r, 4000));
return JSON.stringify(TN.app.project.media.map((m) => [m.name, m.duration, m.width, m.height, m.fps]));
