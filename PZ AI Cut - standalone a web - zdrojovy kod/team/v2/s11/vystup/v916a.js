// S8 NOVE (cast 1): sekvence 9:16 dialogem Nova sekvence (cmd newSequence, predvolba 1080x1920, OK) - bez klipu
const app = TN.app, P = app.project;
app.projectPanel && app.projectPanel.selectedMedia && (window.__selM = (app.projectPanel.selectedMedia() || {}).name || null);
app.cmd('newSequence'); await new Promise((r) => setTimeout(r, 500));
const sel = document.querySelector('#sqPreset');
const opts = [...sel.options].map((o) => [o.value, o.textContent]);
const o = [...sel.options].find((x) => /1080\s*[×x]\s*1920/.test(x.textContent));
sel.value = o.value; sel.dispatchEvent(new Event('change'));
document.querySelector('#sqName').value = 's11-v916';
const put = document.querySelector('#sqPut');
const st = { opts, chosen: o.textContent, w: document.querySelector('#sqW').value, h: document.querySelector('#sqH').value, put: put ? put.checked : 'nen', selM: window.__selM };
return JSON.stringify(st);
