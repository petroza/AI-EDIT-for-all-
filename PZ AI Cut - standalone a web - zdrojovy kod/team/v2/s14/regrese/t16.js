const P = TN.app.project, app = TN.app;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const s = P.sequences.find(x => x.name === 'S14 vyrez 1080');
const i = document.querySelector('#gAdj'); i.value = '2'; i.dispatchEvent(new Event('input'));
const ok = [...document.querySelectorAll('.modal button')].find(b => /OK/.test(b.textContent)); ok.click(); await sleep(300);
const r = { afterAdj: P.sequences.find(x => x.id === s.id).tracks.audio[0].clips[0].gainDb };
// timecode v monitoru Program: klik -> editace, napsat 1015
const tc = document.querySelector('#pgTc, .program .tc, [data-tc="program"]') ;
r.tcCandidates = [...document.querySelectorAll('[id*="Tc"], [class*="tc"]')].slice(0, 12).map(e => e.id + '|' + e.className + '|' + e.tagName + '|' + (e.textContent || '').slice(0, 20));
return r;
