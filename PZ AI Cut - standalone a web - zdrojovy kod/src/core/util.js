'use strict';
// Pomocné funkce pro časy a timecode. Všechny časy v aplikaci jsou v sekundách (float), na snímky se
// zaokrouhlují až při editaci podle fps sekvence.

const EPS = 1e-6;

function r3(x) { return Math.round(x * 1000) / 1000; }

function snapFrame(t, fps) {
  if (!fps) return t;
  return Math.round(t * fps) / fps;
}

function pad(n, w = 2) { return String(Math.floor(n)).padStart(w, '0'); }

/** 00:01:23:12 (hodiny:minuty:sekundy:snímky) */
function timecode(t, fps = 25) {
  if (!isFinite(t)) t = 0;
  const neg = t < 0;
  t = Math.abs(t);
  const f = Math.round(t * fps);
  const fr = f % Math.round(fps);
  const s = Math.floor(f / Math.round(fps));
  return (neg ? '-' : '') + `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}:${pad(fr)}`;
}

/** 00:01:23.456 – formát jako v MY Premiere MCP (tc v server/index.js) */
function tcMs(t) {
  const ms = Math.round(t * 1000);
  const s = Math.floor(ms / 1000);
  return `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}.${String(ms % 1000).padStart(3, '0')}`;
}

/** Parsuje "HH:MM:SS:FF", "MM:SS", "SS.s" nebo čísla. */
function parseTimecode(str, fps = 25) {
  const s = String(str).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(/[:;]/).map(Number);
  if (parts.some((x) => isNaN(x))) return NaN;
  if (parts.length === 4) return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / fps;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return NaN;
}

let idCounter = 0;
function uid(prefix = '') {
  idCounter = (idCounter + 1) % 1e6;
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + idCounter.toString(36);
}

/** UUID podobný Premiere sequenceID (agenti ho jen přeposílají zpět). */
function uuid() {
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${h().slice(1)}-${h()}${h()}${h()}`;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function dbToGain(db) { return Math.pow(10, (db || 0) / 20); }

function baseName(p) { return String(p).replace(/^.*[\\/]/, ''); }

function stripExt(n) {
  return String(n).replace(/\.(mp4|mov|mkv|mxf|avi|m4v|webm|mts|m2ts|wav|mp3|m4a|aac|flac|ogg)$/i, '');
}

/** Velikosti sekundových bloků zvuku (počty vzorků) pro délku dur s při vzorkování sr – součet = round(dur·sr), žádný blok prázdný. */
function audioBlocks(dur, sr) {
  const total = Math.max(0, Math.round(dur * sr)), out = [];
  for (let at = 0; at < total; at += sr) out.push(Math.min(sr, total - at));
  return out;
}
/** Odhad času pro lidi (design-4 §2.2): „asi N s“ (po 10 s) do 45 s, „asi minutu“ do 75 s, „asi 1 min N0 s“ do 2 min, pak celé minuty. */
function aboutT(sec, cs) {
  sec = Math.max(5, sec);
  if (sec < 45) { const n = Math.max(10, Math.round(sec / 10) * 10); return cs ? `asi ${n} s` : `about ${n} s`; }
  if (sec < 75) return cs ? 'asi minutu' : 'about a minute';
  if (sec < 120) { const r = Math.round((sec - 60) / 10) * 10; return r >= 60 ? (cs ? 'asi 2 min' : 'about 2 min') : cs ? `asi 1 min ${r} s` : `about 1 min ${r} s`; }
  const m = Math.round(sec / 60); return cs ? `asi ${m} min` : `about ${m} min`;
}
module.exports = { aboutT, audioBlocks, EPS, r3, snapFrame, timecode, tcMs, parseTimecode, uid, uuid, clamp, dbToGain, baseName, stripExt };
