const s = TN.app.project.sequences.find((x) => x.name === window.__S6MON[0]);
if (TN.app.seq() !== s) { TN.app.openSequence(s.id); await new Promise((r) => setTimeout(r, 800)); }
TN.app.setPlayhead(window.__S6MON[1]);
await new Promise((r) => setTimeout(r, 1500));
const el = TN.app.program.player && (TN.app.program.player.box || TN.app.program.player.el) || document.querySelector('#programMon, .program video');
const v = [...document.querySelectorAll('video,canvas')].filter((x) => x.offsetWidth > 200).map((x) => { const r = x.getBoundingClientRect(); return [x.tagName, x.id || x.className, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), getComputedStyle(x).opacity, x.style.display]; });
return JSON.stringify({ t: s.playhead, v, dpr: devicePixelRatio });
