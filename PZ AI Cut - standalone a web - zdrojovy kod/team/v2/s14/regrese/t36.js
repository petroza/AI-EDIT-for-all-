const fs = require('fs'); const P = TN.app.project, app = TN.app; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const F = 'C:/Users/Petr/AppData/Local/Temp/claude/e8748af4ca7f4462/9b93f9a2-8c9d-4cd4-96a5-b0bc52e46c70/scratchpad/s14/proj/s14.pzcut';
P.path = F; app.cmd('save'); await sleep(800);
const st0 = fs.statSync(F).mtimeMs;
const s = P.sequences.find(x => x.name === 'S14 vyrez 1080'); app.openSequence(s.id); await sleep(300);
app.setPlayhead(4); app.cmd('marker'); await sleep(200);
return { saved: fs.existsSync(F), dirty: P.dirty, mtime0: st0, title: document.title, markers: s.markers.length, t: Date.now() };
