const name = window.__S3SEQ;
const s = TN.app.project.sequences.find((x) => x.name === name);
document.querySelector('#cfOk').click();
const t0 = Date.now();
while (Date.now() - t0 < 240000) { await new Promise((r) => setTimeout(r, 500)); if ((s.captions || []).length && !document.querySelector('#cfOk')) { await new Promise((r) => setTimeout(r, 1500)); break; } }
return JSON.stringify({ seq: name, n: (s.captions || []).length, t: Date.now() - t0, status: (document.querySelector('.statusbar,#status')||{}).innerText });
