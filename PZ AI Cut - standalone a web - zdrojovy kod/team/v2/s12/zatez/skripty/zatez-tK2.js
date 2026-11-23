(async()=>{
// export Z300 přes dialog; za 4 s provede window.__KJS (kód jako text); vrátí hned (průběh se čte zvlášť)
const app=TN.app, P=app.project; const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const s=P.sequences.find(x=>x.name===window.__KSEQ); app.openSequence(s.id); await sleep(300);
app.cmd('export'); await sleep(500);
const b=document.getElementById('modalBox');
b.querySelector('#exOut').value=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-'+window.__KNAME+'.mp4';
b.querySelector('#exFmt').value='h264'; b.querySelector('#exFmt').onchange(); b.querySelector('#exLoud').value='off';
b.querySelector('#exGo').click();
setTimeout(()=>{ try { window.__KRES = String(window.__KFN()); } catch(e){ window.__KRES='ERR '+e.message; } }, 4000);
return 'spuštěno';
})()
