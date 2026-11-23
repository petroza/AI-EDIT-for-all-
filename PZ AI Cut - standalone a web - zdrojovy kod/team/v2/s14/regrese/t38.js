const fs = require('fs'); const P = TN.app.project, app = TN.app; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const F = P.path;
const toasts = []; const t0 = app.toast; app.toast = (m, e) => { toasts.push(m); return t0.call(app, m, e); };
const m0 = fs.statSync(F).mtimeMs;
app.cmd('save'); await sleep(1000);
app.toast = t0;
const vis = [...document.querySelectorAll('.toast, #toast, .toasts *')].filter(e => e.offsetParent).map(e => e.textContent).slice(0, 3);
return { toasts, visible: vis, tmp: fs.existsSync(F + '.tmp'), unchanged: fs.statSync(F).mtimeMs === m0, dirty: P.dirty };
