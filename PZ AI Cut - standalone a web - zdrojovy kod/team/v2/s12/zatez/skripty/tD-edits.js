(async()=>{
// sekvence U200: sync60 celý; 200 různých úprav přes příkazy (jako menu/klávesy); stav S0 a S1 do window
const app=TN.app, P=app.project, E=app.editCore;
const Mo=require(process.cwd()+'/src/core/model.js');
const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const sync=P.media.find(m=>m.name==='sync60.mp4');
const s0=P.edit('New U200', ()=>{ const s=Mo.newSequence({name:'U200',width:1920,height:1080,fps:25}); E.editFromSource(s,sync,0,60,0,'overwrite',{video:0,audio:0}); s.captions=[{start:1,end:3,text:'První titulek'},{start:5,end:7,text:'Druhý'}]; return P.addSequence(s); });
app.openSequence(s0.id); await raf();
// historie začíná tady: vyprázdnit, ať 200 kroků Zpět vede přesně sem
P.history=[]; P.future=[];
window.__S0 = P.snapshot();
const labels=[]; let n=0, i=0;
const seq=()=>app.seq();
const under=(t)=>{ const s=seq(); const ids=[]; for(const k of ['video','audio']) for(const tr of s.tracks[k].slice(0,1)) for(const c of tr.clips) if(c.start<=t+1e-6 && c.start+c.out-c.in>t+1e-6) ids.push(c.id); return ids; };
app.openSource(sync); await raf();
while(n<200 && i<1000){
  const h0=P.history.length; const k=i%6; const t=2+((i*7.37)%50);
  app.setPlayhead(Math.round(t*25)/25);
  if(k===0) app.cmd('addEditAll');
  else if(k===1){ sync.srcIn=10+(i%20); sync.srcOut=sync.srcIn+0.48; app.focusPanel('timeline'); app.cmd('insert'); }
  else if(k===2){ const ids=under(seq().playhead); if(ids.length){ app.sel=new Set(ids); app.edit('Gain', ()=>{ for(const id of ids){ const f=E.findClip(seq(),id); if(f&&f.kind==='audio') f.clip.gainDb=(f.clip.gainDb||0)-1; } }); } }
  else if(k===3) app.cmd('marker');
  else if(k===4){ const ids=under(seq().playhead); if(ids.length){ app.sel=new Set(ids); app.cmd('rippleDelete'); } }
  else if(k===5){ const ids=under(seq().playhead); if(ids.length){ app.sel=new Set(ids); app.edit('Move', ()=>E.moveClips(seq(), ids, 0.2, 0)); } }
  if(P.history.length>h0 || (h0===200 && P.history.length===200)) { n++; labels.push(P.history[P.history.length-1].label); }
  i++;
}
app.sel=new Set(); await raf();
window.__S1 = P.snapshot();
const s=seq();
const cnt=(s)=>({v:s.tracks.video[0].clips.length,a:s.tracks.audio[0].clips.length,markers:s.markers.length,caps:s.captions.length,dur:app.seqDuration(s)});
const lc={}; for(const l of labels) lc[l]=(lc[l]||0)+1;
return { edits:n, tries:i, history:P.history.length, labels:lc, S0:cnt(JSON.parse(window.__S0).sequences.find(x=>x.name==='U200')), S1:cnt(s) };
})()
