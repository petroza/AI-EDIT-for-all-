// S3 vystup: otevri sekvenci a dialog Titulky z prepisu (Sekvence > Titulky > Vytvorit titulky z prepisu), pockej na tlacitko
const name = window.__S3SEQ;
const s = TN.app.project.sequences.find((x) => x.name === name);
TN.app.openSequence(s.id);
await new Promise((r) => setTimeout(r, 300));
TN.app.cmd('captionsFromTranscript');
const t0 = Date.now();
let ok;
while (Date.now() - t0 < 60000) { ok = document.querySelector('#cfOk'); if (ok && !ok.disabled) break; await new Promise((r) => setTimeout(r, 250)); }
return JSON.stringify({ seq: name, msg: document.querySelector('#cfMsg').innerText, btn: ok.textContent, wait: Date.now() - t0 });
