(async()=>{
const app=TN.app, P=app.project, E=app.editCore;
const Mo=require(process.cwd()+'/src/core/model.js'); const ex=require(process.cwd()+'/src/core/exporter.js');
const OUT=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-';
const hod=P.media.find(m=>m.name==='hodina.mp4');
const mk=(name, fn)=>P.edit('New '+name, ()=>{ const s=Mo.newSequence({name, width:640, height:360, fps:25}); fn(s); return P.addSequence(s); });
const exp=async(s, name)=>{ try { const r=await ex.exportSequence(P, s, {output: OUT+name+'.mp4', range:'all', burnCaptions:true, srtSidecar:false, encoder:'libx264', format:'h264', loudness:'off'}); return r.duration; } catch(e){ return e.message; } };
const R={};
R.h0=await exp(mk('H0',(s)=>E.editFromSource(s,hod,0,20,0,'overwrite',{video:0,audio:0})),'h-od0');
R.h5=await exp(mk('H5',(s)=>E.editFromSource(s,hod,5,25,0,'overwrite',{video:0,audio:0})),'h-od5');
R.h1000=await exp(mk('H1000',(s)=>E.editFromSource(s,hod,1000,1020,0,'overwrite',{video:0,audio:0})),'h-od1000');
R.h12=await exp(mk('H12',(s)=>E.editFromSource(s,hod,12,32,0,'overwrite',{video:0,audio:0})),'h-od12');
return R;
})()
