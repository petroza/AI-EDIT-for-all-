// S5: kopie s5-multi v 1920x1080 (pro XDCAM; jako Nastaveni sekvence) a Auto Reframe 9:16 / 1:1 cestou menu (window.__pzReframe)
const app = TN.app, P = app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const src = P.sequences.find((x) => x.name === 's6-multi');
const out = {};
P.edit('S5 1080', () => {
  const s = JSON.parse(JSON.stringify(src));
  s.id = U.uuid(); s.name = 's6-multi1080'; s.width = 1920; s.height = 1080;
  for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) c.id = U.uid('c');
  P.addSequence(s);
});
for (const [num, den, w, h, nm] of [[9, 16, 1080, 1920, 's6-multi916'], [1, 1, 1080, 1080, 's6-multi11']]) {
  const t0 = Date.now();
  const r = await window.__pzReframe(src, num, den, w, h);
  const s = P.sequences.find((x) => x.name === r.name);
  P.edit('rename', () => { s.name = nm; });
  out[nm] = Object.assign({ ms: Date.now() - t0 }, r, {
    video: s.tracks.video.map((t) => t.clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), c.fit, +(c.posX || 0).toFixed(3), c.vIn ? c.vIn.type + c.vIn.dur : '', c.vOut ? c.vOut.type + c.vOut.dur : ''])),
    caps: (s.captions || []).length, capLast: (s.captions || []).slice(-1) });
}
return JSON.stringify(out, null, 1);
