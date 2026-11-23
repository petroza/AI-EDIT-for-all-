(async()=>{
// dva exporty stejné sekvence do STEJNÉHO souboru (druhý dialog z menu nabídne stejnou výchozí cestu), druhý o 1,5 s později
const P=TN.app.project; const ex=require(process.cwd()+'/src/core/exporter.js');
const s=P.sequences.find(x=>x.name==='Z300');
const out=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-k14-stejny-soubor.mp4';
try { require('fs').unlinkSync(out); } catch(e){}
const o={output:out, range:'all', burnCaptions:false, srtSidecar:false, encoder:'libx264', format:'h264', loudness:'off'};
const t0=Date.now();
const a=ex.exportSequence(P, s, o).then(r=>({ok:true, at:Date.now()-t0, mb:r.sizeMB}), e=>({ok:false, at:Date.now()-t0, err:e.message.slice(0,300)}));
await new Promise(r=>setTimeout(r,1500));
const b=ex.exportSequence(P, s, o).then(r=>({ok:true, at:Date.now()-t0, mb:r.sizeMB}), e=>({ok:false, at:Date.now()-t0, err:e.message.slice(0,300)}));
return { first: await a, second: await b };
})()
