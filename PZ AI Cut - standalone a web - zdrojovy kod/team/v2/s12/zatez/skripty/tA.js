(async()=>{
// Z300: 5 min z hodina.mp4, žiletka každou 1 s (v x.52), pak ripple delete každého 10. klipu, 20 stop
const app=TN.app, P=app.project, E=app.editCore;
const M = process.env.TEMP.replace(/\\/g,'/') + '/pz-s12-media/';
const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const hod = P.media.find(m=>m.name==='hodina.mp4'), tone=P.media.find(m=>m.name==='tone30.wav'), bez=P.media.find(m=>m.name==='bezzvuku20.mp4');
const mem0 = process.memoryUsage().rss/1e6;
// nová sekvence 1920x1080 25p, 5 min zdroje
const seq = P.edit('New Sequence', ()=>{ const s=require(process.cwd()+'/src/core/model.js').newSequence({name:'Z300',width:1920,height:1080,fps:25}); E.editFromSource(s,hod,0,300,0,'overwrite',{video:0,audio:0}); return P.addSequence(s); });
app.openSequence(seq.id); await raf();
const times=[];
const t0=performance.now();
for(let i=0;i<300;i++){ const a=performance.now(); app.setPlayhead(i+0.52); app.cmd('addEditAll'); times.push(performance.now()-a); }
await raf();
const tRazor=performance.now()-t0;
const nAfterRazor = seq.tracks.video[0].clips.length;
// ripple delete každého 10. klipu (obraz+zvuk propojené)
const t1=performance.now(); const dels=[];
const vclips = seq.tracks.video[0].clips.slice();
for(let k=vclips.length-2; k>0; k-=10){ const c=vclips[k]; dels.push(c.start); app.sel=new Set([c.id]); const a=performance.now(); app.cmd('rippleDelete'); times.push(performance.now()-a); }
await raf();
const tRipple=performance.now()-t1;
// 20 stop: V10 + A10
P.edit('Add Tracks', ()=>{ while(seq.tracks.video.length<10) seq.tracks.video.push({clips:[],muted:false,locked:false,target:false}); while(seq.tracks.audio.length<10) seq.tracks.audio.push({clips:[],muted:false,locked:false,target:false}); });
const newClip=require(process.cwd()+'/src/core/model.js').newClip;
P.edit('Fill Tracks', ()=>{
  for(let ti=1;ti<10;ti++){ for(let t=0;t<270;t+=30){ E.placeClip(seq,'audio',ti,newClip(tone,'audio',t,0,29,{gainDb:-40})); } }
  for(let ti=1;ti<10;ti++){ for(let t=0;t<260;t+=20){ E.placeClip(seq,'video',ti,newClip(bez,'video',t+ti,0,5,{disabled:true})); } }
});
await raf();
const total = seq.tracks.video.concat(seq.tracks.audio).reduce((n,t)=>n+t.clips.length,0);
// rychlost UI
const R=[]; for(let i=0;i<10;i++){ const a=performance.now(); app.timeline.render(); R.push(performance.now()-a); }
const Z=[]; for(let i=0;i<6;i++){ let a=performance.now(); app.timeline.zoomIn(); await raf(); Z.push(performance.now()-a); }
for(let i=0;i<6;i++){ let a=performance.now(); app.timeline.zoomOut(); await raf(); Z.push(performance.now()-a); }
let a=performance.now(); app.timeline.zoomFit(); await raf(); const tFit=performance.now()-a;
const area=document.querySelector('#tlArea, .tl-area, .timeline-area') ;
const snapLen = P.snapshot().length;
const histLen = P.history.length, histBytes = P.history.reduce((n,h)=>n+h.state.length,0);
times.sort((x,y)=>x-y);
const med=(arr)=>{const s=arr.slice().sort((x,y)=>x-y);return Math.round(s[Math.floor(s.length/2)]*10)/10};
return { clipsV1AfterRazor:nAfterRazor, rippleDeletes:dels.length, clipsTotal:total, tracks: seq.tracks.video.length+'V/'+seq.tracks.audio.length+'A',
  duration: app.seqDuration(seq), tRazorTotalMs:Math.round(tRazor), tRippleTotalMs:Math.round(tRipple), opMedianMs: med(times), opMaxMs: Math.round(times[times.length-1]),
  renderMs: R.map(x=>Math.round(x)), zoomMs: Z.map(x=>Math.round(x)), zoomFitMs: Math.round(tFit), snapshotKB: Math.round(snapLen/1024), history: histLen, historyMB: Math.round(histBytes/1e5)/10,
  rssMB0: Math.round(mem0), rssMB: Math.round(process.memoryUsage().rss/1e6), heapMB: Math.round(performance.memory.usedJSHeapSize/1e6), domClips: document.querySelectorAll('.clip').length };
})()
