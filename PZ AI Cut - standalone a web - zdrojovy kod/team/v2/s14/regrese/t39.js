const P = TN.app.project; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); await sleep(1500);
const s = P.sequences.find(x => x.name === 'S14 vyrez 1080');
const toastEls = [...document.querySelectorAll('div, span')].filter(e => e.offsetParent && e.children.length === 0 && /Obnoven|neuložen|nenašel/.test(e.textContent)).map(e => e.textContent.slice(0, 220));
return { path: P.path, dirty: P.dirty, nSeq: P.sequences.length, markers: s ? s.markers.length : 'bez sekvence', toastEls, title: document.title, head: (document.querySelector('.title, #title, header') || {}).textContent };
