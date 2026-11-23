// Kolo S12 – orchestrace: node run.js <varianta…>  (instance 9379). Výsledky do results.json (sloučí se s předchozími).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const DIR = path.join(APP, 'team/v2/s12/formaty');
const SHOTS = path.join(APP, 'team/v2/s12/shots-formaty');
fs.mkdirSync(SHOTS, { recursive: true });
const M = path.join(process.env.TEMP, 'pz-s12-formaty-media').replace(/\\/g, '/');
const env = Object.assign({}, process.env, { CDP_PORT: '9379' });
const ev = (js) => {
  const o = execFileSync('node', [path.join(APP, 'test/cdp.js'), 'eval', js], { env, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 1800000 });
  try { return JSON.parse(o); } catch (e) { return o.trim(); }
};
const D = `(delete require.cache[require.resolve('${DIR.replace(/\\/g, '/')}/drv.js')], require('${DIR.replace(/\\/g, '/')}/drv.js'))`;
const STD = [[0, 1, 4], [3, 6, 9]];
const V = {
  v25p: ['v25p.mp4', STD], v2997p: ['v2997p.mp4', STD], v23976p: ['v23976p.mp4', STD], v50p: ['v50p.mp4', STD],
  v5994p: ['v5994p.mp4', STD], v30p: ['v30p.mp4', STD], i25: ['i25.mp4', STD], vfr: ['vfr.mp4', STD],
  hevc4k10: ['hevc4k10.mp4', [[0, 0.5, 2.5], [2, 3.5, 5.5]]], rot90: ['rot90.mp4', STD], v916: ['v916.mp4', STD], v11: ['v11.mp4', STD],
  anam: ['anam.mp4', STD], a_mono: ['a_mono.mp4', STD], a_51: ['a_51.mp4', STD], a_2mono: ['a_2mono.mp4', STD], a_441: ['a_441.mp4', STD],
  a_96: ['a_96.mov', STD], a_none: ['a_none.mp4', STD], au_wav: ['au_wav.wav', STD], au_mp3: ['au_mp3.mp3', STD], au_aac: ['au_aac.aac', STD],
  au_m4a: ['au_m4a.m4a', STD], img_png: ['img_png.png', [[0, 0, 3]]], img_jpg: ['img_jpg.jpg', [[0, 0, 3]]],
  mxf_xdcam: ['mxf_xdcam.mxf', STD], prores_mov: ['prores_mov.mov', STD], corrupt: ['corrupt.mp4', STD],
};
const resF = path.join(DIR, 'results.json');
const res = fs.existsSync(resF) ? JSON.parse(fs.readFileSync(resF, 'utf8')) : {};
const second = (s) => {
  if (!s) return null;
  const ok = (s.width === 1920 && s.height === 1080 && [25, 29.97, 50].includes(s.fps)) || (s.width === 1280 && s.height === 720 && [50, 59.94].includes(s.fps));
  return ok ? 'xdcam' : 'prores_hq';
};
for (const name of process.argv.slice(2)) {
  const [file, pieces] = V[name];
  const r = { file, pieces };
  r.app = ev(`${D}.variant('${M}/${file}', ${JSON.stringify(pieces)})`);
  if (r.app && r.app.seq) {
    ev(`(TN.app.setPlayhead ? TN.app.setPlayhead(1.52) : null, TN.app.program && TN.app.program.refresh && TN.app.program.refresh(), new Promise(r => setTimeout(r, 2500)))`);
    execFileSync('node', [path.join(APP, 'test/cdp.js'), 'shot', path.join(SHOTS, name + '.png')], { env });
    const fmts = ['h264', second(r.app.seq)];
    r.exports = {};
    for (const f of fmts) {
      const out = `${name}-${f}`;
      r.exports[f] = ev(`${D}.exp('${out}', '${f}', '${f === 'h264' ? 'social' : 'tv'}')`);
      // XDCAM odmítnuto → zkusit ještě ProRes HQ
      if (f === 'xdcam' && r.exports[f].error) r.exports.prores_hq = ev(`${D}.exp('${name}-prores_hq', 'prores_hq', 'tv')`);
    }
    if (fmts[1] === 'prores_hq') r.exports.xdcam = ev(`${D}.exp('${name}-xdcam', 'xdcam', 'tv')`); // čitelnost odmítnutí
  }
  res[name] = r;
  fs.writeFileSync(resF, JSON.stringify(res, null, 1));
  console.log(name, JSON.stringify(r).slice(0, 900));
}
