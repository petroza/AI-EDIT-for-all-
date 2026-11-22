// otevri sekvenci window.__S4SEQ, okno Text v obraze, klik Radky = 1
const s = TN.app.project.sequences.find((x) => x.name === window.__S4SEQ);
TN.app.openSequence(s.id); await new Promise((r) => setTimeout(r, 400));
if (!document.querySelector('.cs-seg[data-k=lines]') || !document.querySelector('.cs-seg[data-k=lines]').offsetParent) TN.app.cmd('captionStyle');
await new Promise((r) => setTimeout(r, 600));
const box = document.querySelector('.cs-seg[data-k=lines]').closest('[class*=cs]').parentElement;
document.querySelector('.cs-seg[data-k=lines] button[data-v="1"]').click();
await new Promise((r) => setTimeout(r, 1200));
return JSON.stringify({ seq: s.name, win: document.querySelector('.cs-seq').textContent, style: s.captionStyle, n: (s.captions || []).length, maxLines: Math.max(0, ...(s.captions || []).map((c) => c.text.split('\n').length)) });
