(async()=>{
const app=TN.app, P=app.project, E=app.editCore; const fs=require('fs');
const Mo=require(process.cwd()+'/src/core/model.js'); const ex=require(process.cwd()+'/src/core/exporter.js');
const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const hod=P.media.find(m=>m.name==='hodina.mp4');
const s=P.edit('New T-titulky', ()=>{ const s=Mo.newSequence({name:'T-titulky',width:1920,height:1080,fps:25}); E.editFromSource(s,hod,0,610,0,'overwrite',{video:0,audio:0}); return P.addSequence(s); });
const caps=[];
for(let i=0;i<500;i++) caps.push({start:i*1.2, end:i*1.2+1.1, text:'Titulek číslo '+(i+1)});
// zvláštní titulky (indexy 10–14 → časy 12,0 / 13,2 / 14,4 / 15,6 / 16,8 s)
caps[10].text = 'Dlouhý '+('velmi dlouhý titulek s mnoha slovy ').repeat(40);
caps[11].text = '';
caps[12].text = 'řádek 1\nřádek 2\n\nřádek 4 po prázdném';
caps[13].text = "{\\b1}tučně{\\b0} <i>kurzíva</i> & ' \" % # ; : [] \\N 🎬 → ěščř";
caps[14].text = 'šipka --> uprostřed 00:00:01,000 --> 00:00:02,000';
let t=performance.now();
app.edit('Captions 500', ()=>{ s.captions=caps; });
app.openSequence(s.id); await raf(); const tOpen=performance.now()-t;
const R={ capsN: s.captions.length };
const rt=[]; for(let i=0;i<5;i++){ const a=performance.now(); app.timeline.render(); rt.push(Math.round(performance.now()-a)); } R.timelineRenderMs=rt; R.openMs=Math.round(tOpen);
t=performance.now(); try { app.transcript.show('cap'); } catch(e){ R.capPanelErr=e.message; } await raf(); R.captionPanelMs=Math.round(performance.now()-t);
R.capRows = document.querySelectorAll('[data-ci], .cap-row, .caption-row').length;
// náhled v Programu na zvláštních titulcích
for(const [k,tt] of [['dlouhy',12.5],['prazdny',13.7],['radky',14.9],['spec',16.1],['sipka',17.3]]){ app.setPlayhead(tt); await raf(); await new Promise(r=>setTimeout(r,300)); const el=[...document.querySelectorAll('.cap-overlay, .caption-overlay, [class*=caption]')].find(e=>e.offsetParent && e.textContent && e.closest('#program, .program, [id*=program]')); R['nahled_'+k]= el ? el.textContent.slice(0,80)+' h='+el.offsetHeight : '(nenalezen)'; }
const out=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-titulky500';
for(const [k,o] of [['burn',{burnCaptions:true, srtSidecar:true}]]){
  t=performance.now();
  try { const r=await ex.exportSequence(P, s, Object.assign({output:out+'.mp4', range:'all', encoder:'libx264', format:'h264', loudness:'off'}, o)); R[k]={ok:true, ms:Math.round(performance.now()-t), dur:r.duration, srt: fs.existsSync(out+'.srt')}; }
  catch(e){ R[k]={ok:false, err:e.message.slice(0,400)}; }
}
return R;
})()
