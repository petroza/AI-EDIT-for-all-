const o = {};
for (const s of TN.app.project.sequences) {
  const cl = (t) => t.clips.map((c) => ({ start: +c.start.toFixed(3), in: +c.in.toFixed(3), out: +c.out.toFixed(3), fit: c.fit, posX: c.posX, fadeIn: c.fadeIn, fadeOut: c.fadeOut, disabled: c.disabled, media: (TN.app.project.mediaById(c.mediaId) || {}).name }));
  o[s.name] = { w: s.width, h: s.height, fps: s.fps, captionStyle: s.captionStyle, video: s.tracks.video.map(cl), audio: s.tracks.audio.map(cl), captions: (s.captions || []).map((c) => ({ start: +c.start.toFixed(3), end: +c.end.toFixed(3), text: c.text })) };
}
return JSON.stringify(o);
