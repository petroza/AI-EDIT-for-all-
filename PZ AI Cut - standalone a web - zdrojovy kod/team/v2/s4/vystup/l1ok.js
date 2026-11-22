const s = TN.app.seq();
document.querySelector('#cfOk').click();
const t1 = Date.now();
while (Date.now() - t1 < 240000) { await new Promise((r) => setTimeout(r, 500)); if ((s.captions || []).length && !document.querySelector('#cfOk')) { await new Promise((r) => setTimeout(r, 1000)); break; } }
return JSON.stringify({ seq: s.name, n: s.captions.length, maxLines: Math.max(...s.captions.map((c) => c.text.split('\n').length)), style: s.captionStyle, caps: s.captions.map((c) => [c.start, c.end, c.text]) });
