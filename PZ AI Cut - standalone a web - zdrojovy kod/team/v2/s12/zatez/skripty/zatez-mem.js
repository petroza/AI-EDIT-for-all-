(async()=>{
// paměť renderu při sérii Ctrl+K (hlava + žiletka) na sekvenci Z1H (720 klipů) – špička RSS
const app=TN.app, P=app.project; const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const s=P.sequences.find(x=>x.name==='Z1H'); app.openSequence(s.id); await raf();
const rss=()=>Math.round(process.memoryUsage().rss/1e6);
const r0=rss(); let peak=r0; const iv=setInterval(()=>{peak=Math.max(peak,rss())},100);
const t0=performance.now(); const times=[];
for(let i=0;i<150;i++){ const a=performance.now(); app.setPlayhead(2000+i*3.3); app.cmd('addEditAll'); times.push(performance.now()-a); if(i%10===0) await raf(); }
await raf(); const ms=performance.now()-t0;
await new Promise(r=>setTimeout(r,5000)); clearInterval(iv);
times.sort((a,b)=>a-b);
return { rss0:r0, peakRss:peak, rssAfter5s:rss(), heapMB:Math.round(performance.memory.usedJSHeapSize/1e6), ops:150, totalMs:Math.round(ms), medMs:Math.round(times[75]), maxMs:Math.round(times[149]), history:P.history.length, histMB: Math.round(P.history.reduce((n,h)=>n+h.state.length,0)/1e5)/10, snapshotKB: Math.round(P.snapshot().length/1024) };
})()
