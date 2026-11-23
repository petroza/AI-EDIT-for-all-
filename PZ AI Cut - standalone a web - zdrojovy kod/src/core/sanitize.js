'use strict';
/* Kontrola projektu z disku (.pzcut, záloha, obnova po pádu) – projekt může přijít z cizí ruky. Bezpečnost S12: hodnoty
 * z projektu šly neescapované do HTML (název sekvence v záložce, gainDb, id klipu, typ přechodu, thumbUrl…) a okno má
 * přístup k Node, takže podvržený .pzcut spustil kód. Tady: pryč klíče pro prototype pollution, čísla jsou čísla, id jen
 * bezpečné znaky, výčtové hodnoty ze seznamu, barvy #hex, náhledy a dočasná pole z disku se nepřebírají (vytvoří se znovu).
 * Escapování při stavbě HTML zůstává druhá vrstva. */

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const NUM = new Set(['start', 'in', 'out', 'gainDb', 'fadeIn', 'fadeOut', 'scale', 'posX', 'posY', 'xIn', 'width', 'height',
  'fps', 'duration', 'dur', 'd', 't', 'time', 'end', 'size', 'top', 'pos', 'lines', 'maxChars', 'playhead', 'zoom', 'srcIn',
  'srcOut', 'srcPos', 'sampleRate', 'channels', 'rotation', 'scroll', 'pps', 'version', 'audioTracks', 'videoTracks',
  'proxyProgress', 'p', 's', 'e']);
const ID = new Set(['id', 'mediaId', 'linkId', 'activeSequenceId', 'sequenceId', 'clipId']);
const ENUM = { kind: ['video', 'audio'], fit: ['contain', 'cover'] };
const TRANS = ['cross', 'dipBlack', 'dipWhite'];
const COLOR = new Set(['color', 'highlight', 'bg', 'boxColor']);
const DROP = new Set(['thumbUrl', 'thumb', 'proxyJob', 'waveUrl']);
const SAFE_ID = /^[\w.:-]{1,100}$/;
const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i;
// řídicí znaky (kromě tabulátoru a nového řádku) ze všech textů
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function clean(v, key, depth) {
  if (depth > 40) return undefined;
  if (Array.isArray(v)) return v.slice(0, 100000).map((x) => clean(x, key, depth + 1)).filter((x) => x !== undefined);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) {
      if (BAD_KEYS.has(k) || DROP.has(k)) continue;
      const c = clean(v[k], k, depth + 1);
      if (c !== undefined) o[k] = c;
    }
    return o;
  }
  if (key && NUM.has(key)) {
    if (typeof v === 'boolean' || v === null) return v === null ? null : v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (key && ID.has(key)) return v === null ? null : (typeof v === 'string' && SAFE_ID.test(v) ? v : undefined);
  if (key && ENUM[key] && typeof v === 'string') return ENUM[key].includes(v) ? v : ENUM[key][0];
  if (key && COLOR.has(key) && typeof v === 'string') return SAFE_COLOR.test(v) || v === '' ? v : undefined;
  if (typeof v === 'string') return v.slice(0, 20000).replace(CTRL, '');
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean' || v === null) return v;
  return undefined; // funkce, symboly…
}

/** Vyčištěná kopie dat projektu (nic nemění na vstupu). */
function sanitizeProject(data) {
  const d = clean(data && typeof data === 'object' ? data : {}, '', 0) || {};
  d.media = Array.isArray(d.media) ? d.media.filter((m) => m && SAFE_ID.test(m.id || '')) : [];
  d.sequences = Array.isArray(d.sequences) ? d.sequences.filter((s) => s && SAFE_ID.test(s.id || '')) : [];
  for (const s of d.sequences) {
    s.tracks = s.tracks && typeof s.tracks === 'object' ? s.tracks : {};
    for (const k of ['video', 'audio']) {
      s.tracks[k] = Array.isArray(s.tracks[k]) ? s.tracks[k].filter((t) => t && typeof t === 'object') : [];
      for (const t of s.tracks[k]) t.clips = Array.isArray(t.clips) ? t.clips.filter((c) => c && SAFE_ID.test(c.id || '') && typeof c.mediaId === 'string') : [];
      // přechod jen známého typu (typ jde do HTML časové osy)
      for (const t of s.tracks[k]) for (const c of t.clips) for (const tk of ['vIn', 'vOut']) if (c[tk] && !TRANS.includes(c[tk].type)) c[tk] = null;
    }
    if (!s.tracks.video.length) s.tracks.video.push({ clips: [] });
    if (!s.tracks.audio.length) s.tracks.audio.push({ clips: [] });
    if (!(s.width > 0)) s.width = 1920;
    if (!(s.height > 0)) s.height = 1080;
    if (!(s.fps > 0)) s.fps = 25;
    if (typeof s.name !== 'string') s.name = 'Sequence';
  }
  if (!Array.isArray(d.openSequenceIds)) d.openSequenceIds = [];
  d.openSequenceIds = d.openSequenceIds.filter((x) => typeof x === 'string' && SAFE_ID.test(x));
  if (d.asrFixes && typeof d.asrFixes !== 'object') d.asrFixes = {};
  return d;
}

/** Escapování pro HTML (text i hodnoty atributů v uvozovkách). */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

module.exports = { sanitizeProject, esc };
