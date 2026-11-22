// Střihy kamery uvnitř klipů sekvence (ffmpeg detekce scény jen na použitých úsecích – pár sekund).
// Auto Reframe sleduje obličej v rámci klipu: když se uprostřed klipu přepne kamera (celek -> detail),
// ořez obličej dohání ~6–8 snímků (při „slower“ ho nenajde vůbec). Rozřezání videa v těchto místech
// před reframem = každý záběr se analyzuje zvlášť. Sdílí panel (require) i MCP server (createRequire).
'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function ffmpegExe(root) {
  const local = root && path.join(root, 'tools', 'ffmpeg', 'bin', 'ffmpeg.exe');
  return local && fs.existsSync(local) ? local : 'ffmpeg';
}

function sceneTimes(exe, media, from, dur, threshold) {
  return new Promise((resolve) => {
    execFile(exe, ['-hide_banner', '-nostats', '-ss', from.toFixed(3), '-t', dur.toFixed(3), '-i', media,
      '-an', '-vf', `scale=320:-2,select='gt(scene\\,${threshold})',showinfo`, '-f', 'null', '-'],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stderr) return resolve([]);
      const t = [];
      String(stderr).replace(/pts_time:([\d.]+)/g, (_, x) => { t.push(Number(x)); return ''; });
      resolve(t);
    });
  });
}

/**
 * @param clips video klipy z getSequence ({kind, start, end, inPoint, outPoint, mediaPath, speed, disabled})
 * @returns časy v sekvenci (s), kde se uvnitř klipu mění záběr; ne blíž než 0,3 s od kraje klipu
 */
async function cameraCuts(clips, opts) {
  const o = opts || {};
  const exe = ffmpegExe(o.root);
  const out = [];
  for (const c of clips) {
    if (c.kind !== 'video' || c.disabled || !c.mediaPath || !fs.existsSync(c.mediaPath)) continue;
    if (c.speed && Math.abs(c.speed - 1) > 0.001) continue; // zrychlený klip – časy by neseděly
    const dur = c.end - c.start;
    if (dur < 0.8) continue;
    // dekódování po skoku začne až na klíčovém snímku (u stažených MP4 i 1–2 s za cílem) -> začít o 5 s dřív
    // a časy brát relativně k místu skoku (pts_time je relativní k -ss, i když první snímky chybí)
    const pre = Math.min(5, c.inPoint);
    const ts = await sceneTimes(exe, c.mediaPath, c.inPoint - pre, dur + pre, o.threshold || 0.3);
    for (const t0 of ts) {
      const t = t0 - pre;
      if (t < 0.12 || t > dur - 0.12) continue; // těsně u kraje klipu už nový záběr začíná sám
      const x = Math.round((c.start + t) * 1000) / 1000;
      if (!out.some((y) => Math.abs(y - x) < 0.2)) out.push(x);
    }
  }
  return out.sort((a, b) => a - b);
}

module.exports = { cameraCuts, ffmpegExe };
