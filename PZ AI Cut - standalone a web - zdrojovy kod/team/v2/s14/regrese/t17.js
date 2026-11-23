const P = TN.app.project, app = TN.app; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
if (app.transcript && app.transcript.show) app.transcript.show('project'); await sleep(400);
const Vm = P.media.find(m => m.name === 'vyrez-5min.mp4');
const el = document.querySelector(`[data-id="${Vm.id}"]`); el.scrollIntoView(); await sleep(200);
const rc = el.getBoundingClientRect();
return Math.round(rc.left + rc.width / 2) + ',' + Math.round(rc.top + Math.min(rc.height / 2, 20));
