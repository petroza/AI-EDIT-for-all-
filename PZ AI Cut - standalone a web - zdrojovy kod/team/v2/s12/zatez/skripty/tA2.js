(async()=>{
const app=TN.app, P=app.project, E=app.editCore;
const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const tU=performance.now(); for(let i=0;i<32;i++) app.cmd('undo'); await raf(); const undoMs=performance.now()-tU;
let seq=app.seq();
const nV0=seq.tracks.video[0].clips.length, nT=seq.tracks.video.length;
const vclips = seq.tracks.video[0].clips.slice();
const times=[]; let peak=0;
for(let k=vclips.length-2; k>0; k-=10){ seq=app.seq(); const c=E.findClip(seq, vclips[k].id).clip; const ids=[c.id]; const pa=seq.tracks.audio[0].clips.find(x=>x.linkId&&x.linkId===c.linkId); if(pa) ids.push(pa.id); app.sel=new Set(ids); const a=performance.now(); app.cmd('rippleDelete'); times.push(performance.now()-a); peak=Math.max(peak,process.memoryUsage().rss); }
await raf();
seq=app.seq();
const newClip=require(process.cwd()+'/src/core/model.js').newClip;
const tone=P.media.find(m=>m.name==='tone30.wav'), bez=P.media.find(m=>m.name==='bezzvuku20.mp4');
app.edit('Add Tracks', ()=>{ while(seq.tracks.video.length<10) seq.tracks.video.push({clips:[],muted:false,locked:false,target:false}); while(seq.tracks.audio.length<10) seq.tracks.audio.push({clips:[],muted:false,locked:false,target:false}); });
app.edit('Fill Tracks', ()=>{
  for(let ti=1;ti<10;ti++){ for(let t=0;t<240;t+=30){ E.placeClip(seq,'audio',ti,newClip(tone,'audio',t,0,29,{gainDb:-40})); } }
  for(let ti=1;ti<10;ti++){ for(let t=0;t<240;t+=20){ E.placeClip(seq,'video',ti,newClip(bez,'video',t+ti,0,5,{disabled:true})); } }
});
await raf();
const v=seq.tracks.video[0].clips, a=seq.tracks.audio[0].clips; const end=(c)=>c.start+c.out-c.in;
let gaps=0; for(let i=1;i<v.length;i++) if(Math.abs(v[i].start-end(v[i-1]))>1e-3) gaps++;
return { undoMs:Math.round(undoMs), nV0, tracksAfterUndo:nT, ripple:times.length, medMs: Math.round(times.sort((x,y)=>x-y)[times.length>>1]), maxMs:Math.round(times[times.length-1]),
 nV:v.length, nA:a.length, endV:end(v[v.length-1]), endA:end(a[a.length-1]), gaps, dur: app.seqDuration(seq), peakRssMB: Math.round(peak/1e6), rss: Math.round(process.memoryUsage().rss/1e6),
 total: seq.tracks.video.concat(seq.tracks.audio).reduce((n,t)=>n+t.clips.length,0) };
})()
