// S8 NOVE (cast 2): do s8-v916 vlozit 3 useky ze siroko zaberu pres Prepis: m.srcIn/srcOut, TN.app.openSource(m), TN.app.insertFromTranscript('end')
// po kazdem vlozeni cekat, az dobehne vyrez podle obliceje (stav "Vyrez podle obliceje" zmizi), zaznamenat posX, kroky Zpet, hlasky
const app = TN.app, P = app.project;
const L = P.media.find((m) => m.name.startsWith('tncz')), V = P.media.find((m) => m.name === 'vyrez-5min.mp4');
const s = P.sequences.find((x) => x.name === 's8-v916'); app.openSequence(s.id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (q) => JSON.stringify({ tracks: q.tracks, captions: q.captions, markers: q.markers });
const stat = () => ((document.querySelector('.statusbar,#status') || {}).innerText || '').trim();
const toast = () => { const t = document.getElementById('toast'); return t && /show/.test(t.className) ? t.textContent : ''; };
window.__K = [{ op: 'prazdna', h: P.history.length, key: key(s) }];
const out = [];
for (const [m, a, b] of [[L, 1596.0, 1612.1], [L, 1544.4, 1574.2], [V, 114.88, 119.36]]) {
  m.srcIn = a; m.srcOut = b; app.openSource(m); await wait(400);
  const srcOk = [m.srcIn, m.srcOut];
  const h0 = P.history.length, t0 = Date.now();
  const r = app.insertFromTranscript('end');
  const seen = []; let doneAt = null, quietSince = null;
  while (Date.now() - t0 < 45000) {
    await wait(250); const st = stat(), tt = toast();
    if (st && !seen.includes(st)) seen.push(st); if (tt && !seen.includes('TOAST: ' + tt)) seen.push('TOAST: ' + tt);
    if (!/obli[cč]ej|face|hled/i.test(st)) { quietSince = quietSince || Date.now(); if (Date.now() - quietSince > 2500) { doneAt = Date.now() - t0; break; } } else quietSince = null;
  }
  const q = P.sequences.find((x) => x.id === s.id);
  out.push({ ins: [m.name.slice(0, 12), a, b], srcOk, ret: r, doneMs: doneAt, seen, histAdded: P.history.slice(h0).map((h) => h.label),
    V1: q.tracks.video[0].clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), c.fit, +(c.posX || 0).toFixed(3)]),
    A1: q.tracks.audio[0].clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2)]) });
  window.__K.push({ op: 'vlozeni ' + a, h: P.history.length, key: key(q) });
}
return JSON.stringify(out, null, 1);
