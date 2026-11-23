// S5: titulky dialogem Sekvence > Titulky > Vytvorit titulky z prepisu (klik na tlacitko) pro sekvence window.__S6SEQS
const out = [];
for (const name of window.__S6SEQS) {
  const s = TN.app.project.sequences.find((x) => x.name === name);
  TN.app.openSequence(s.id);
  await new Promise((r) => setTimeout(r, 400));
  TN.app.cmd('captionsFromTranscript');
  const t0 = Date.now(); let ok;
  while (Date.now() - t0 < 120000) { ok = document.querySelector('#cfOk'); if (ok && !ok.disabled) break; await new Promise((r) => setTimeout(r, 250)); }
  const msg = document.querySelector('#cfMsg').innerText.replace(/\n+/g, ' | ');
  ok.click();
  const t1 = Date.now();
  while (Date.now() - t1 < 240000) { await new Promise((r) => setTimeout(r, 500)); if ((s.captions || []).length && !document.querySelector('#cfOk')) { await new Promise((r) => setTimeout(r, 1000)); break; } }
  out.push({ seq: name, n: (s.captions || []).length, msg: msg.slice(0, 300), wait: t1 - t0, caps: (s.captions || []).map((c) => [+c.start.toFixed(2), +c.end.toFixed(2), c.text.replace(/\n/g, ' / ')]) });
}
return JSON.stringify(out, null, 1);
