(async()=>{
// window.__K = { seq:'Z300', name:'k1', during:[{at:ms, cmd, arg}], selectAt: t }
const K=window.__K; const app=TN.app, P=app.project, E=app.editCore;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const ipc=require('electron').ipcRenderer;
const s=P.sequences.find(x=>x.name===K.seq); app.openSequence(s.id); await sleep(300);
if(K.selectAt!=null){ const ids=[]; for(const k of ['video','audio']) for(const c of s.tracks[k][0].clips) if(c.start<=K.selectAt && c.start+c.out-c.in>K.selectAt) ids.push(c.id); app.sel=new Set(ids); }
const durBefore=app.seqDuration(app.seq());
app.cmd('export'); await sleep(500);
const b=document.getElementById('modalBox');
const out=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-'+K.name+'.mp4';
b.querySelector('#exOut').value=out; b.querySelector('#exFmt').value='h264'; b.querySelector('#exFmt').onchange();
b.querySelector('#exLoud').value='off'; if(b.querySelector('#exRange')) b.querySelector('#exRange').value='all';
const t0=Date.now(); b.querySelector('#exGo').click();
const log=[];
for(const d of K.during||[]){ while(Date.now()-t0<d.at) await sleep(50); const before=app.seq()&&app.seqDuration(app.seq()); ipc.emit('cmd', {}, d.cmd, d.arg); await sleep(100); log.push({at:Date.now()-t0, cmd:d.cmd, msg:(b.querySelector('#exMsg')||{}).textContent, durBefore:before, durAfter: app.seq()&&app.seqDuration(app.seq()), active: app.seq()&&app.seq().name, modalH2:(document.querySelector('#modalBox h2')||{}).textContent}); }
let msg='';
for(let i=0;i<1200;i++){ const m=document.getElementById('exMsg') || b.querySelector('#exMsg'); msg=m?m.textContent:''; if(/✔|✖/.test(msg)) break; await sleep(500); }
return { out, durBefore, durNow: app.seqDuration(s), exportSeqObjStillInProject: P.sequences.includes(s), log, msg, ms: Date.now()-t0, exNo: (b.querySelector('#exNo')||{}).textContent, modalShown: document.getElementById('modal').classList.contains('show'), lang: TN.lang };
})()
