(async()=>{
// po smazání / přejmenování / zamčení souborů: co ukáže aplikace a export (přes dialog)
const app=TN.app, P=app.project; const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const s=P.sequences.find(x=>x.name==='F-soubory'); app.openSequence(s.id);
const toasts=[]; const ot=app.toast; app.toast=(m,e)=>{toasts.push(m); return ot.call(app,m,e)};
const R={};
for(const t of [1,6,11]){ app.setPlayhead(t); await sleep(1200); R['monitor@'+t]=[...document.querySelectorAll('video')].filter(v=>/smazat|prejmenovat|zamceny/.test(decodeURIComponent(v.src))).map(v=>decodeURIComponent(v.src).split('/').pop()+':rs'+v.readyState+(v.error?':ERR'+v.error.code:'')).join(' ; '); }
R.offlineFlags = P.media.filter(m=>/smazat|prejmenovat|zamceny/.test(m.name)).map(m=>m.name+':missing='+!!m.missing);
R.timelineOffline = document.querySelectorAll('.clip.offline').length;
// export přes dialog
app.cmd('export'); await sleep(500);
document.getElementById('exOut').value=process.cwd()+'/web/test-out/zatez-s12-f-soubory-'+Date.now()+'.mp4';
document.getElementById('exGo').click();
for(let i=0;i<60;i++){ await sleep(500); const m=document.getElementById('exMsg').textContent; if(/✔|✖/.test(m)) break; }
R.exportMsg=document.getElementById('exMsg').textContent;
app.toast=ot; R.toasts=toasts;
return R;
})()
