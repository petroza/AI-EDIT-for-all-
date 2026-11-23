const s = TN.app.project.sequences.find((x) => x.name === window.__S6MON[0]);
if (TN.app.seq() !== s) { TN.app.openSequence(s.id); await new Promise((r) => setTimeout(r, 800)); }
TN.app.setPlayhead(window.__S6MON[1]);
await new Promise((r) => setTimeout(r, 1800));
const vids = [...document.querySelectorAll('video.monitor-video')].filter((x) => x.getBoundingClientRect().x > 600 && getComputedStyle(x).display !== 'none' && x.style.visibility !== 'hidden').map((x) => [getComputedStyle(x).opacity, (x.src || '').split(/[\/]/).pop().slice(0, 12), +x.currentTime.toFixed(2)]);
const dip = TN.app.program.player.dip; 
return JSON.stringify({ t: s.playhead, vids, dip: dip ? [dip.style.opacity, dip.style.background] : null });
