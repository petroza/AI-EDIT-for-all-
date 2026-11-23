(async()=>{
const app=TN.app, P=app.project, E=app.editCore; const fs=require('fs');
const Mo=require(process.cwd()+'/src/core/model.js');
const ms=['smazat.mp4','prejmenovat.mp4','zamceny.mp4'].map(n=>P.media.find(m=>m.name===n));
const s=P.edit('New F-soubory', ()=>{ const s=Mo.newSequence({name:'F-soubory',width:1920,height:1080,fps:25}); ms.forEach((m,i)=>E.editFromSource(s,m,0,5,i*5,'overwrite',{video:0,audio:0})); return P.addSequence(s); });
app.openSequence(s.id); app.setPlayhead(1);
await new Promise(r=>setTimeout(r,1500));
return {seq:s.id, clips:s.tracks.video[0].clips.length};
})()
