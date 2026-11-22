// dialog Titulky z prepisu na aktivni sekvenci, snimek se dela zvlast; vrati text vzhledu
TN.app.cmd('captionsFromTranscript');
const t0 = Date.now(); let ok;
while (Date.now() - t0 < 120000) { ok = document.querySelector('#cfOk'); if (ok && !ok.disabled) break; await new Promise((r) => setTimeout(r, 250)); }
return (document.body.innerText.match(/Vzhled podle formátu[^\n]*/) || ['?'])[0];
