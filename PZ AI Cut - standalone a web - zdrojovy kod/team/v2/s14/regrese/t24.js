const P = TN.app.project, app = TN.app; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await sleep(200);
const s = P.sequences.find(x => x.name === 'S14 vyrez 60s 9x16'); app.openSequence(s.id); await sleep(300);
app.cmd('export'); await sleep(500);
const q = (i) => document.querySelector(i); const xo = [...q('#exFmt').options].find(o => o.value === 'xdcam');
const r = { fmt: q('#exFmt').value, loud: q('#exLoud').value, xdcamDisabled: xo.disabled, xdcamLabel: xo.textContent, info: q('#exInfo').textContent };
q('#exNo').click(); await sleep(200);
return r;
