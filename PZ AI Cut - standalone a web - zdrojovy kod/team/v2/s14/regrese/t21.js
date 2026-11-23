const P = TN.app.project; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const S = () => P.sequences.find(x => x.name === 'S14 vyrez 1080');
const vis = [...document.querySelectorAll('input')].filter(e => e.offsetParent);
const chk = vis.find(e => e.type === 'checkbox' && /Zobrazit/.test((e.closest('label') || e.parentElement).innerText));
const txt = vis.find(e => e.type === 'text' && e.id !== 'projSearch');
const r = {};
chk.click(); await sleep(300); r.off = JSON.stringify(S().title);
txt.value = 'Druhý vložený'; txt.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300); r.paste = JSON.stringify(S().title); r.chk = chk.checked;
return r;
