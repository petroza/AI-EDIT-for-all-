(()=>{
// porovná aktuální stav projektu se S0/S1 (celý JSON snímek i jen sekvence U200)
const P=TN.app.project; const now=P.snapshot();
const pick=(snap)=>JSON.stringify(JSON.parse(snap).sequences.find(x=>x.name==='U200'));
const diff=(a,b)=>{ if(a===b) return null; let i=0; while(i<a.length && a[i]===b[i]) i++; return {at:i, a:a.slice(Math.max(0,i-80),i+120), b:b.slice(Math.max(0,i-80),i+120)}; };
const s=TN.app.seq();
return { eqS0: now===window.__S0, eqS1: now===window.__S1, seqEqS0: pick(now)===pick(window.__S0), seqEqS1: pick(now)===pick(window.__S1),
  diffS0: diff(pick(now),pick(window.__S0)), history:P.history.length, future:P.future.length, active: s&&s.name,
  ui: { v1Dom: document.querySelectorAll('.lane.video .clip').length, clipsV1: s&&s.tracks.video[0].clips.length } };
})()
