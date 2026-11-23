(async()=>{
const app=TN.app, P=app.project, E=app.editCore;
const Mo=require(process.cwd()+'/src/core/model.js'); const ex=require(process.cwd()+'/src/core/exporter.js');
const OUT=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-';
const med=(n)=>P.media.find(m=>m.name===n);
const sync=med('sync60.mp4'), one=med('jedensnimek.mp4'), tone=med('tone30.wav'), bez=med('bezzvuku20.mp4');
const mk=(name, fn, o={})=>P.edit('New '+name, ()=>{ const s=Mo.newSequence(Object.assign({name, width:1920, height:1080, fps:25}, o)); fn(s); return P.addSequence(s); });
const exp=async(s, name, opts={})=>{ const t0=performance.now(); try { const r=await ex.exportSequence(P, s, Object.assign({output: OUT+name+'.mp4', range:'all', burnCaptions:true, srtSidecar:false, encoder:'libx264', format:'h264', loudness:'off'}, opts)); return {ok:true, ms:Math.round(performance.now()-t0), dur:r.duration, mb:r.sizeMB}; } catch(e){ return {ok:false, err:e.message}; } };
const R={};
// C1 celý klip od 0 a klip od 5 s
let s=mk('E-cele', (s)=>E.editFromSource(s,sync,0,60,0,'overwrite',{video:0,audio:0})); R.cele=await exp(s,'e-cele');
s=mk('E-od5', (s)=>E.editFromSource(s,sync,5,15,0,'overwrite',{video:0,audio:0})); R.od5=await exp(s,'e-od5');
s=mk('E-od0-2x', (s)=>{E.editFromSource(s,sync,0,10,0,'overwrite',{video:0,audio:0}); E.editFromSource(s,sync,0,10,10,'overwrite',{video:0,audio:0});}); R.od0x2=await exp(s,'e-od0-2x');
// C2 médium 1 snímek
s=mk('E-1snimek', (s)=>E.editFromSource(s,one,0,one.duration,0,'overwrite',{video:0,audio:0})); R.jedenSnimek={clips:s.tracks.video[0].clips.map(c=>[c.in,c.out]), exp: await exp(s,'e-1snimek')};
// C3 úsek kratší než snímek
try { mk('E-kratky', (s)=>E.editFromSource(s,sync,1,1.02,0,'overwrite',{video:0,audio:0})); R.kratky='bez chyby'; } catch(e){ R.kratky='chyba: '+e.message; }
// C4 poslední snímek média + C5 ořez za konec média
s=mk('E-konec', (s)=>E.editFromSource(s,sync,59.96,60,0,'overwrite',{video:0,audio:0})); R.posledniSnimek=await exp(s,'e-konec');
s=mk('E-orez', (s)=>E.editFromSource(s,sync,50,55,0,'overwrite',{video:0,audio:0}));
const vc=s.tracks.video[0].clips[0];
P.edit('trim', ()=>E.trimEdge(s, vc.id, 'out', 100, {mediaDuration:(id)=>P.mediaById(id).duration}));
R.orezZaKonec={out:s.tracks.video[0].clips[0].out, aOut:s.tracks.audio[0].clips[0].out};
P.edit('trim2', ()=>E.trimEdge(s, vc.id, 'in', -50, {mediaDuration:(id)=>P.mediaById(id).duration}));
R.orezPredZacatek={in:s.tracks.video[0].clips[0].in, start:s.tracks.video[0].clips[0].start};
// C6 jen zvuk, C7 jen obraz
s=mk('E-jenzvuk', (s)=>E.editFromSource(s,tone,0,30,0,'overwrite',{video:0,audio:0})); R.jenZvuk={clips:s.tracks.audio[0].clips.length+s.tracks.video[0].clips.length, exp:await exp(s,'e-jenzvuk')};
s=mk('E-jenobraz', (s)=>E.editFromSource(s,bez,0,20,0,'overwrite',{video:0,audio:0})); R.jenObraz=await exp(s,'e-jenobraz');
// C8 prázdná, C9 jen mezera + klip na 10 s, jen titulky
s=mk('E-prazdna', ()=>{}); R.prazdna=await exp(s,'e-prazdna');
s=mk('E-mezera', (s)=>E.editFromSource(s,sync,0,2,10,'overwrite',{video:0,audio:0})); R.mezera=await exp(s,'e-mezera');
s=mk('E-jentitulky', (s)=>{ s.captions=[{start:0,end:3,text:'Jen titulek'}]; }); R.jenTitulky={seqDur: app.seqDuration(s), exp: await exp(s,'e-jentitulky')};
// C10 In/Out mimo obsah, částečně mimo, jen In
s=mk('E-inout', (s)=>E.editFromSource(s,sync,0,10,0,'overwrite',{video:0,audio:0}));
s.inPoint=20; s.outPoint=30; R.inoutMimo=await exp(s,'e-inout-mimo',{range:'inout'});
s.inPoint=5; s.outPoint=30; R.inoutCast=await exp(s,'e-inout-cast',{range:'inout'});
s.inPoint=5; s.outPoint=null; R.jenIn=await exp(s,'e-jen-in',{range:'inout'});
return R;
})()
