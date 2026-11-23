const P = TN.app.project, app = TN.app; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const s = P.sequences.find(x => x.name === 'S14 vyrez 1080'); app.openSequence(s.id); await sleep(300);
app.cmd('headline'); await sleep(600);
const ins = [...document.querySelectorAll('input, textarea')].filter(e => e.offsetParent).map(e => ({ id: e.id, type: e.type, val: (e.value || '').slice(0, 30), checked: e.checked, label: (e.closest('label') || e.parentElement).innerText.slice(0, 40) }));
return { ins, headlineKeys: Object.keys(s).filter(k => /head|title/i.test(k)), h: s.headline };
