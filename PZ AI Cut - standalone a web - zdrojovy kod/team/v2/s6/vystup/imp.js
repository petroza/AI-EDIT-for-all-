// S6 vystup (kopie S5): import 28min rozhovoru, 5min vyrezu (b-roll) a hudby (A3)
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const M = 'O:/STRIH TEST/data/mus_stem.wav';
await TN.app.importPaths([L, V, M]);
await new Promise((r) => setTimeout(r, 3000));
return JSON.stringify({ media: TN.app.project.media.map((m) => [m.name, m.duration, m.width, m.height, m.fps, m.hasVideo, m.hasAudio]), keys: Object.keys(TN.app).join(',') });
