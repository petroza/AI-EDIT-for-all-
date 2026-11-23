// S11: dialog Export jen otevrit a prohlednout (s11-t1080 s nadpisem), prepnout format na XDCAM -> hlasitost; Zavrit (nic se neexportuje)
const app = TN.app, P = app.project, wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.openSequence(P.sequences.find((x) => x.name === 's11-t1080').id); await wait(400);
app.cmd('export'); await wait(500);
const f = document.querySelector('#exFmt'), l = document.querySelector('#exLoud');
const r = { fmt0: f.value, loud0: l.value, info: document.querySelector('#exInfo').textContent };
f.value = 'xdcam'; f.dispatchEvent(new Event('change')); await wait(200); r.loudXdcam = l.value; r.out = document.querySelector('#exOut').value.replace(/^.*[\/]/, '');
return JSON.stringify(r);
