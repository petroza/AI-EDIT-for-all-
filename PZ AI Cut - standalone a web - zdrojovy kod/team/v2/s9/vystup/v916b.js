document.querySelector('#sqOk').click(); await new Promise((r) => setTimeout(r, 800));
const s = TN.app.seq();
return JSON.stringify({ name: s.name, w: s.width, h: s.height, fps: s.fps, clips: s.tracks.video.map((t) => t.clips.length), hist: TN.app.project.history.slice(-2).map((h) => h.label) });
