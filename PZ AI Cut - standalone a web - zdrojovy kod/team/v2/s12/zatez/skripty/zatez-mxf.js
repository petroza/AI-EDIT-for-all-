(async()=>{
const P=TN.app.project; const ex=require(process.cwd()+'/src/core/exporter.js');
const s=P.sequences.find(x=>x.name==='E-jenobraz');
const out=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-e-jenobraz-xdcam.mxf';
try { const r=await ex.exportSequence(P, s, {output:out, range:'all', burnCaptions:false, srtSidecar:false, encoder:'libx264', format:'xdcam', loudness:'tv'}); return r; } catch(e){ return 'CHYBA '+e.message; }
})()
