'use strict';
/* Přesné snímky v programovém monitoru tam, kde Chrome přehrávač (<video>) ukazuje zastaralý obraz.
 * Některé MP4 (TN) mají při střihu kamery ne-IDR I-snímek, který tabulka stss vydává za klíčový; přehrávač (i ffmpeg)
 * po skoku do takového GOP ukazuje až do dalšího IDR starý záběr. WebCodecs dekódované od IDR jsou správně, a tak se
 * v těchto úsecích (zastavený obraz i přehrávání) přes video položí plátno se snímkem z dekodéru
 * (src/ui/player.js updateStill). Jinde se nic nemění. Web: File z vfs, desktop: FsFile (web/ai/reframe.js). */
const { VideoSource } = require('../engine/decode');
const { openMp4 } = require('../engine/mp4');

/** Úseky [a, b) zdroje, kde přehrávač po skoku ukazuje špatně: od ne-IDR „klíčového“ snímku po další IDR. */
async function problemRanges(f) {
  const mp = await openMp4(f);
  const tr = mp.video, S = tr && tr.samples;
  if (!S || tr.codecName !== 'h264' || !tr.description) return [];
  const L = (tr.description[4] & 3) + 1;
  const out = [];
  let open = null;
  for (let i = 0; i < S.n; i++) {
    if (!S.sync[i]) continue;
    const d = new Uint8Array(await f.slice(S.offset[i], S.offset[i] + Math.min(S.size[i], 96)).arrayBuffer());
    let idr = false;
    for (let p = 0; p + L < d.length;) {
      let n = 0; for (let k = 0; k < L; k++) n = n * 256 + d[p + k];
      const ty = d[p + L] & 31;
      if (ty === 5) { idr = true; break; }
      if (ty === 1) break;
      p += L + n;
    }
    if (idr) { if (open !== null) { out.push([open, S.pts[i]]); open = null; } } else if (open === null && S.pts[i] > 0) open = S.pts[i];
  }
  if (open !== null) out.push([open, Infinity]);
  return out;
}

/**
 * @param player  SeqPlayer programového monitoru
 * @param app     okno aplikace (project.mediaById)
 * @param fileOf  (media) => File | FsFile | null – soubor, který přehrává <video> (desktop: případně proxy)
 */
function install(player, app, fileOf) {
  const ranges = new Map();  // klíč souboru -> Promise<[[a, b], …]>
  const sources = new Map(); // klíč souboru -> VideoSource
  const keyOf = (f) => (f.path || f.name) + '|' + f.size;
  // dekodér není reentrantní: požadavky jeden po druhém, zastaralé (mezitím přišel novější) se přeskočí
  let chain = Promise.resolve(), token = 0;
  async function work(clip, t) {
    const m = app.project.mediaById(clip.mediaId);
    if (!m || !m.hasVideo) return null;
    const f = fileOf(m);
    if (!f) return null;
    const k = keyOf(f);
    if (!ranges.has(k)) ranges.set(k, problemRanges(f).catch(() => []));
    const rs = await ranges.get(k);
    if (!rs.some(([a, b]) => t >= a - 0.001 && t < b)) return null;
    let src = sources.get(k);
    if (!src) {
      src = await VideoSource.open(f);
      sources.set(k, src);
      if (sources.size > 3) { const [k0, s0] = sources.entries().next().value; s0.close(); sources.delete(k0); }
    }
    return src.frameAt(t);
  }
  // opt.keep: předem dekódovaný snímek (začátek dalšího klipu) – neruší běžné požadavky a sám se nepřeskočí
  player.stillProvider = (clip, t, opt) => {
    const my = opt && opt.keep ? null : ++token;
    const run = () => (my === null || my === token ? work(clip, t) : null);
    chain = chain.then(run, run);
    return chain;
  };
  /** Rychlý dotaz bez dekódování: leží čas t klipu v problémovém úseku? (null = ještě se nezjistilo) */
  player.stillNeeded = (clip, t) => {
    const m = app.project.mediaById(clip.mediaId);
    const f = m && m.hasVideo && fileOf(m);
    if (!f) return false;
    const k = keyOf(f);
    if (!ranges.has(k)) { ranges.set(k, problemRanges(f).catch(() => [])); return null; }
    const p = ranges.get(k);
    if (!p._done) { p.then((r) => { p._done = r; }); return null; }
    return p._done.some(([a, b]) => t >= a - 0.001 && t < b);
  };
}

module.exports = { install, problemRanges };
