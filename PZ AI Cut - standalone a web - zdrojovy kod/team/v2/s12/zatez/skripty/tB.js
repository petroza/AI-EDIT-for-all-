(async()=>{
const app=TN.app, P=app.project;
const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const hod=P.media.find(m=>m.name==='hodina.mp4');
let a=performance.now();
const r = await app.api.importFiles({paths:[hod.path], openSequence:true});
await raf(); const tNew=performance.now()-a;
const seq=app.seq(); P.edit('rename', ()=>{ seq.name='Z1H'; });
a=performance.now();
const times=[]; for(let t=10.52;t<3600;t+=10) times.push(Math.round(t*100)/100);
const rr = app.api.razor({sequence: seq.id, times}); await raf(); const tRaz=performance.now()-a;
const R=[]; for(let i=0;i<5;i++){ const b=performance.now(); app.timeline.render(); R.push(Math.round(performance.now()-b)); }
a=performance.now(); app.timeline.zoomFit(); await raf(); const tFit=performance.now()-a;
const Z=[]; for(let i=0;i<10;i++){ const b=performance.now(); app.timeline.zoomIn(); await raf(); Z.push(Math.round(performance.now()-b)); }
const area=document.querySelector('.timeline .area, #tlArea') || [...document.querySelectorAll('div')].find(d=>d.scrollWidth>d.clientWidth*5 && d.clientHeight>100);
const S=[]; for(let i=0;i<10;i++){ const b=performance.now(); area.scrollLeft += area.clientWidth*3; area.dispatchEvent(new Event('scroll')); await raf(); S.push(Math.round(performance.now()-b)); }
// skok hlavy na konec + Program náhled
a=performance.now(); app.setPlayhead(3599); await raf(); const tSeek=performance.now()-a;
return { newSeqMs:Math.round(tNew), razorMs:Math.round(tRaz), cuts: times.length, clipsV1: seq.tracks.video[0].clips.length, renderMs:R, zoomFitMs:Math.round(tFit), zoomInMs:Z, scrollMs:S, scrollW: area && area.scrollWidth, seekMs: Math.round(tSeek), pps: app.timeline.pps, rss: Math.round(process.memoryUsage().rss/1e6), dom: document.querySelectorAll('.clip').length };
})()
