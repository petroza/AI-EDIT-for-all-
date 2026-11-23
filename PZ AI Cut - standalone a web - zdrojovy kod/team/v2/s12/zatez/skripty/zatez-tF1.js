(async()=>{
const app=TN.app, P=app.project, E=app.editCore; const fs=require('fs'), path=require('path');
const Mo=require(process.cwd()+'/src/core/model.js'); const ex=require(process.cwd()+'/src/core/exporter.js');
const names=['diakritika ěščřžýáíéůúň ĚŠČŘ.mp4','mezery   a emoji 🎬😀.mp4',"hash#procento%20amp&apo's.mp4",'zavorky [x] (y) {z} ;,=+!.mp4','soubor s dlouhou cestou ěš.mp4'];
const ms=names.map(n=>P.media.find(m=>m.name===n));
const s=P.edit('New F-nazvy', ()=>{ const s=Mo.newSequence({name:'F-nazvy ěš 🎬 #%&\'',width:1920,height:1080,fps:25}); ms.forEach((m,i)=>E.editFromSource(s,m,i*2,i*2+2,i*2,'overwrite',{video:0,audio:0})); return P.addSequence(s); });
app.openSequence(s.id);
await new Promise(r=>setTimeout(r,3000));
const R={ thumbs: ms.map(m=>!!(m.thumb && fs.existsSync(m.thumb))), waves: ms.map(m=>!!(app.waves && (app.waves.get ? app.waves.get(m.id) : app.waves[m.id]))) };
const T=process.cwd().replace(/\\/g,'/')+'/web/test-out/';
const outs = { divny: T+"zatez-s12-výstup #1 %20 & 'x' 🎬 [a].mp4" };
const longDir = T+'zatez-s12-dlouha-cesta-'+'x'.repeat(90)+'/'+'y'.repeat(90);
outs.dlouhy = longDir+'/vystup s dlouhou cestou ěš.mp4';
R.longOutLen = outs.dlouhy.length;
for(const [k,o] of Object.entries(outs)){
  try { const r=await ex.exportSequence(P, s, {output:o, range:'all', burnCaptions:true, srtSidecar:false, encoder:'libx264', format:'h264', loudness:'social'}); R[k]={ok:true, out:r.output, dur:r.duration, exists:fs.existsSync(r.output)}; }
  catch(e){ R[k]={ok:false, err:e.message.slice(0,300)}; }
}
// náhled v Programu na každém klipu (chyba videa?)
const errs=[]; for(let i=0;i<5;i++){ app.setPlayhead(i*2+1); await new Promise(r=>setTimeout(r,700)); const v=[...document.querySelectorAll('video')].map(v=>({err: v.error && v.error.code, rs: v.readyState, src: decodeURIComponent((v.src||'').split('/').pop())})); errs.push(v.filter(x=>x.src && !x.src.startsWith('blob'))); }
R.preview = errs.map(a=>a.map(x=>x.src.slice(0,40)+':rs'+x.rs+(x.err?':ERR'+x.err:'')).join(' ; '));
return R;
})()
