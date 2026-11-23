const P = TN.app.project, app = TN.app; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const { clipEnd } = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/model');
const S = () => P.sequences.find(x => x.name === 'S14 vyrez 60s 9x16');
const d = () => S().tracks.video[1].clips.map(c => `${c.start.toFixed(2)}-${clipEnd(c).toFixed(2)} [${c.in.toFixed(2)}]`).join(' ') + ' / V1 n=' + S().tracks.video[0].clips.length;
const r = { afterUndo1: d() };
app.cmd('undo'); await sleep(300); r.afterUndo2 = d(); r.labelsHint = document.querySelector('#status, .status') ? document.querySelector('#status, .status').textContent : '';
return r;
