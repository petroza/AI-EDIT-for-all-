(async()=>{
// import přejmenovaného souboru za běhu – připojí se klipy (jak slibuje hláška exportu)?
const P=TN.app.project; const toasts=[]; const ot=TN.app.toast; TN.app.toast=(m,e)=>{toasts.push(m); return ot.call(TN.app,m,e)};
await TN.app.importPaths([process.env.TEMP.replace(/\\/g,'/')+'/pz-s12-media/prejmenovano.mp4']);
await new Promise(r=>setTimeout(r,500));
TN.app.toast=ot; const s=P.sequences.find(x=>x.name==='F-soubory');
const fs=require('fs');
return { toasts, clips: s.tracks.video[0].clips.map(c=>{ const m=P.mediaById(c.mediaId); return m.name+(fs.existsSync(m.path)?'':' (soubor chybí)'); }), media: P.media.filter(m=>/prejmen|smazat/.test(m.name)).map(m=>m.name+':missing='+!!m.missing) };
})()
