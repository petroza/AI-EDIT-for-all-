// S11 (4): nadpis nahore pres okno Text v obraze (cmd captionStyle): napsat text, export zapnuty; prepinac Zobrazit vypnout, export vypnuty; Zpet/Znovu
const app = TN.app, P = app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
const X = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/exporter');
const OUT = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/vystup-s11-';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const copy = (from, name) => { let id; P.edit('S11 copy', () => { const s = JSON.parse(JSON.stringify(P.sequences.find((x) => x.name === from))); s.id = U.uuid(); s.name = name; const lm = {}; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) { c.id = U.uid('c'); if (c.linkId) c.linkId = lm[c.linkId] = lm[c.linkId] || U.uid('l'); } s.inPoint = null; s.outPoint = null; P.addSequence(s); id = s.id; }); return id; };
const out = {};
for (const [from, name, fmt, loud, ext, extra] of [['s11-sim', 's11-t', 'h264', 'social', 'mp4', {}], ['s11-sim1080', 's11-t1080', 'xdcam', 'tv', 'mxf', { srtSidecar: true }]]) {
  const sid = copy(from, name); app.openSequence(sid); await wait(400);
  const S = () => P.sequences.find((x) => x.id === sid);
  app.cmd('captionStyle'); await wait(500);
  const ti = document.querySelector('.cs-title'), tg = document.querySelector('.cs-title-on');
  const r = { tgBefore: tg ? [tg.checked, tg.disabled] : 'chybi' };
  ti.focus(); ti.value = 'Nadpis S11: Most bude hotový v létě'; ti.dispatchEvent(new Event('input')); ti.dispatchEvent(new Event('change')); ti.blur(); await wait(300);
  r.poNapsani = [JSON.stringify(S().title), tg.checked, tg.disabled];
  const ex = async (f) => { const t0 = Date.now(); const q = await X.exportSequence(P, S(), Object.assign({ output: OUT + f, range: 'all', burnCaptions: false, srtSidecar: false, encoder: 'libx264', format: fmt, loudness: loud }, extra)); return [f, q.sizeMB, ((Date.now() - t0) / 1000).toFixed(1)]; };
  r.expOn = await ex(name.slice(4) + '-on.' + ext);
  tg.checked = false; tg.dispatchEvent(new Event('change')); await wait(300);
  r.poVypnuti = [JSON.stringify(S().title), tg.checked, ti.className, P.history.slice(-1)[0].label];
  r.expOff = await ex(name.slice(4) + '-off.' + ext);
  app.cmd('undo'); await wait(400); r.poZpet = [JSON.stringify(S().title), document.querySelector('.cs-title-on').checked];
  app.cmd('redo'); await wait(400); r.poZnovu = [JSON.stringify(S().title), document.querySelector('.cs-title-on').checked];
  out[name] = r;
  const x = document.querySelector('.cs-x'); if (x) x.click(); await wait(300);
}
return JSON.stringify(out, null, 1);
