// S8 (kopie S4): titulky dialogem Sekvence > Titulky > Vytvorit titulky z prepisu (klik na tlacitko) pro kazdou sekvenci z window.__S9SEQS
const out = [];
for (const name of window.__S9SEQS) {
  const s = TN.app.project.sequences.find((x) => x.name === name);
  TN.app.openSequence(s.id);
  await new Promise((r) => setTimeout(r, 400));
  TN.app.cmd('captionsFromTranscript');
  const t0 = Date.now(); let ok;
  while (Date.now() - t0 < 120000) { ok = document.querySelector('#cfOk'); if (ok && !ok.disabled) break; await new Promise((r) => setTimeout(r, 250)); }
  const msg = document.querySelector('#cfMsg').innerText.replace(/\n+/g, ' | ');
  const look = (document.querySelector('#cfOk').closest('.modal, dialog, div').parentElement.innerText.match(/Vzhled podle formátu[^\n]*/) || [''])[0];
  ok.click();
  const t1 = Date.now();
  while (Date.now() - t1 < 240000) { await new Promise((r) => setTimeout(r, 500)); if ((s.captions || []).length && !document.querySelector('#cfOk')) { await new Promise((r) => setTimeout(r, 1000)); break; } }
  out.push({ seq: name, n: (s.captions || []).length, msg: msg.slice(0, 200), look, maxLines: Math.max(0, ...(s.captions || []).map((c) => c.text.split('\n').length)) });
}
return JSON.stringify(out, null, 1);
