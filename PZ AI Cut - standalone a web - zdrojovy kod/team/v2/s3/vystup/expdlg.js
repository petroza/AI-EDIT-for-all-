const s = TN.app.project.sequences.find((x) => x.name === window.__S3SEQ);
TN.app.openSequence(s.id); await new Promise((r) => setTimeout(r, 300));
TN.app.cmd('export'); await new Promise((r) => setTimeout(r, 1200));
const m = document.querySelector('.modal, #modal, dialog');
return (m ? m.innerText : document.body.innerText.slice(0, 500)).replace(/\n+/g, ' | ').slice(0, 900);
