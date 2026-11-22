'use strict';
/* Výřez pro sítě (9:16, 4:5, 1:1) podle obličeje – webová obdoba Auto Reframe z desktopu (pmcp-api.reframeSequence).
 * Vše běží v prohlížeči: snímky dekóduje WebCodecs (engine/decode), obličeje hledá MediaPipe Face Detector
 * (model ~230 kB z CDN, jen poprvé). Nic se neodesílá.
 *   1) střih kamery uvnitř klipu (porovnání zmenšených snímků) → klip se rozřízne (jen obraz)
 *   2) v každém záběru obličeje (celý snímek + menší díly, aby se našly i malé tváře v širokém záběru)
 *   3) jeden obličej → na něj; víc → ten, komu se víc hýbou ústa (mluví); nerozhodné → větší (blíž ke kameře)
 *   4) clip.posX tak, aby obličej byl uprostřed výřezu */
const { VideoSource } = require('../engine/decode');
const E = require('../../src/core/edit');
const { clipEnd } = require('../../src/core/model');

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const AW = 1280; // šířka, na kterou se snímky zmenší pro analýzu

/** ES modul z CDN. V desktopu (Electron, require) by import() šel přes Node, který https neumí → přes <script type=module>. */
function importModule(url) {
  const electron = typeof process !== 'undefined' && process.versions && process.versions.electron;
  if (!electron) return import(/* webpackIgnore: true */ url);
  return new Promise((resolve, reject) => {
    const key = '__pzImport' + Math.random().toString(36).slice(2);
    window[key] = { resolve, reject };
    const s = document.createElement('script');
    s.type = 'module';
    // statický import zpracuje přímo prohlížeč (dynamický import() Electron s nodeIntegration posílá do Node)
    s.textContent = `import * as M from ${JSON.stringify(url)}; window[${JSON.stringify(key)}].resolve(M); delete window[${JSON.stringify(key)}];`;
    s.onerror = () => reject(new Error('Cannot load ' + url));
    window.addEventListener('error', function onErr(e) { if (e && e.filename && e.filename.startsWith(url.split('/').slice(0, 3).join('/'))) { window.removeEventListener('error', onErr); reject(new Error(e.message)); } });
    setTimeout(() => { if (window[key]) reject(new Error('Loading ' + url + ' timed out')); }, 60000);
    document.head.appendChild(s);
  });
}

let detP = null;
function detector() {
  if (!detP) {
    detP = (async () => {
      const { FilesetResolver, FaceDetector } = await importModule(MP + '/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks(MP + '/wasm');
      const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 });
      try { return await FaceDetector.createFromOptions(fs, opts('GPU')); } catch (e) { return FaceDetector.createFromOptions(fs, opts('CPU')); }
    })();
    detP.catch(() => { detP = null; });
  }
  return detP;
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/** Snímek zdroje v čase t zmenšený na šířku AW. */
async function grab(src, t, cv) {
  const f = await src.frameAt(t);
  try { cv.getContext('2d').drawImage(f, 0, 0, cv.width, cv.height); } finally { f.close(); }
  return cv;
}
function grayOf(cv, w, h) {
  const tmp = canvas(w, h), x = tmp.getContext('2d', { willReadFrequently: true });
  x.drawImage(cv, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return g;
}
const meanDiff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

/* ---------- obličeje ---------- */
function tiles(W, H) {
  const g = [];
  for (const [s, st] of [[Math.min(H, W), Math.round(Math.min(H, W) * 0.39)], [480, 200], [320, 140], [240, 110]]) {
    if (s > H) continue;
    for (let y = 0; y < H - s + st; y += st) for (let x = 0; x < W - s + st; x += st) g.push([Math.min(x, W - s), Math.min(y, H - s), s]);
  }
  return g;
}
/** Obličeje ve snímku: [{x, y, w, score, n}] v pixelech analyzovaného snímku (shluky detekcí z dílů). */
async function facesIn(cv) {
  const det = await detector();
  const W = cv.width, H = cv.height, raw = [];
  const tile = canvas(1, 1), tx = tile.getContext('2d');
  const run = (x0, y0, s, w = s, h = s) => {
    tile.width = w; tile.height = h; tx.drawImage(cv, x0, y0, w, h, 0, 0, w, h);
    for (const d of det.detect(tile).detections) {
      const b = d.boundingBox, sc = d.categories[0].score;
      if (sc < (s <= 320 ? 0.6 : 0.5)) continue;
      raw.push({ x: x0 + b.originX + b.width / 2, y: y0 + b.originY + b.height / 2, w: b.width, score: sc });
    }
  };
  run(0, 0, W, W, H);
  const big = raw.some((f) => f.w > W * 0.09 && f.score > 0.85);
  for (const [x, y, s] of tiles(W, H)) { if (big && s < 480) continue; run(x, y, s); }
  // shluky: detekce stejné tváře z různých dílů
  const cl = [];
  for (const f of raw.sort((a, b) => b.score - a.score)) {
    const c = cl.find((k) => Math.abs(k.x - f.x) < Math.max(k.w, f.w) * 0.6 && Math.abs(k.y - f.y) < Math.max(k.w, f.w) * 0.6);
    if (c) { c.n++; c.sx += f.x * f.score; c.sy += f.y * f.score; c.ss += f.score; c.ws.push(f.w); } else cl.push({ x: f.x, y: f.y, w: f.w, score: f.score, n: 1, sx: f.x * f.score, sy: f.y * f.score, ss: f.score, ws: [f.w] });
  }
  return cl.map((c) => ({ x: c.sx / c.ss, y: c.sy / c.ss, w: c.ws.sort((a, b) => a - b)[c.ws.length >> 1], score: c.score, n: c.n }))
    .filter((c) => c.score >= 0.8 || (c.n >= 2 && c.score >= 0.7));
}

/** Pohyb úst vůči pohybu hlavy (čelo) mezi dvěma snímky – kdo mluví, má vyšší poměr. */
function mouthMotion(ga, gb, W, f) {
  const reg = (x0, y0, w, h) => {
    let s = 0, n = 0;
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(ga.length / W, y0 + h); y++) for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, x0 + w); x++) { s += Math.abs(ga[y * W + x] - gb[y * W + x]); n++; }
    return n ? s / n : 0;
  };
  const m = reg(f.x - f.w * 0.3, f.y + f.w * 0.15, f.w * 0.6, f.w * 0.35);
  const h = reg(f.x - f.w * 0.3, f.y - f.w * 0.45, f.w * 0.6, f.w * 0.3);
  return m / (h + 1);
}

/** Střed záběru [t0, t1) zdroje: { x: 0..1 vodorovně, how } nebo null (bez obličeje). */
async function shotTarget(src, t0, t1, ah) {
  const cv = canvas(AW, ah);
  const d = t1 - t0, n = d > 3 ? 3 : d > 1 ? 2 : 1;
  const all = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + d * (i + 1) / (n + 1);
    for (const f of await facesIn(await grab(src, t, cv))) all.push({ ...f, t });
  }
  if (!all.length) return null;
  // stejná tvář na víc snímcích → jedna osoba (podle vodorovné polohy)
  const ppl = [];
  for (const f of all.sort((a, b) => b.w - a.w)) {
    const p = ppl.find((q) => Math.abs(q.x - f.x) < Math.max(q.w, f.w) * 0.8);
    if (p) { p.xs.push(f.x); p.hits++; } else ppl.push({ x: f.x, y: f.y, w: f.w, xs: [f.x], hits: 1, t: f.t });
  }
  for (const p of ppl) p.x = p.xs.sort((a, b) => a - b)[p.xs.length >> 1];
  ppl.sort((a, b) => b.w - a.w);
  if (ppl.length === 1 || ppl[0].w >= ppl[1].w * 1.6) return { x: ppl[0].x / AW, how: 'face' };
  // víc podobně velkých tváří (široký záběr): kdo mluví – pohyb úst na 3 dvojicích snímků 0,12 s od sebe
  const cand = ppl.slice(0, 3), score = cand.map(() => 0);
  const gw = AW, gh = ah;
  for (let i = 0; i < 3; i++) {
    const t = t0 + d * (i + 1) / 4;
    if (t + 0.12 >= t1) continue;
    const ga = grayOf(await grab(src, t, cv), gw, gh), gb = grayOf(await grab(src, t + 0.12, cv), gw, gh);
    cand.forEach((p, k) => { score[k] += mouthMotion(ga, gb, gw, p); });
  }
  const order = cand.map((p, k) => k).sort((a, b) => score[b] - score[a]);
  if (score[order[0]] > score[order[1]] * 1.15) return { x: cand[order[0]].x / AW, how: 'speaker' };
  return { x: cand[0].x / AW, how: 'largest' };
}

/* ---------- střihy kamery ---------- */
/** Časy střihů kamery ve zdroji v [a, b) – porovnání snímků po 0,5 s, upřesnění půlením na snímek. */
async function cameraCuts(src, a, b, fps, ah, stepS = 0.5) {
  const cv = canvas(AW, ah), SW = 64, SH = Math.round(64 * ah / AW);
  const thumb = async (t) => grayOf(await grab(src, t, cv), SW, SH);
  const step = stepS, cuts = [];
  let pt = a + 0.04, pg = await thumb(pt);
  for (let t = a + step; t < b - 0.04; t += step) {
    const g = await thumb(t);
    if (meanDiff(pg, g) > 16) {
      // půlení mezi pt a t na přesnost jednoho snímku
      let lo = pt, hi = t, glo = pg;
      while (hi - lo > 0.9 / fps) { // < 1 snímek: mezi lo a hi je jediná hranice snímků
        const mid = (lo + hi) / 2, gm = await thumb(mid);
        if (meanDiff(glo, gm) > 16) hi = mid; else { lo = mid; glo = gm; }
      }
      // začátek snímku, který v čase hi je vidět (hi leží uvnitř prvního snímku nového záběru): bez zaokrouhlení dolů se řez
      // posunul na další hranici snímku a první snímek nového záběru dostal výřez starého (kolo 7: 6 z 9 střihů o snímek pozdě)
      let f0 = hi;
      try { const f = await src.frameAt(hi); f0 = f.timestamp / 1e6; f.close(); } catch (e) { f0 = Math.floor((hi + 1e-4) * fps) / fps; }
      cuts.push(f0 > lo + 1e-4 && f0 <= hi + 1e-4 ? f0 : hi);
    }
    pt = t; pg = g;
  }
  return cuts;
}

/**
 * Přerámuje video klipy sekvence (už s cílovým rozměrem a fit 'cover') podle obličejů.
 * @param app       window.TN.app (project.edit, mediaById)
 * @param seq       sekvence
 * @param fileOf    (media) => File
 * @param progress  (text, p) => void
 */
async function reframeSequence(app, seq, fileOf, progress = () => {}, only = null) {
  const p = app.project;
  const W = seq.width, H = seq.height;
  const plan = []; // { track, clip, cuts:[src times], shots:[{in,out,x}] }
  const vclips = [];
  // only = Set id klipů (úsek přidaný do hotové sekvence 9:16/4:5) – ostatní klipy a jejich výřez zůstanou
  seq.tracks.video.forEach((track) => track.clips.forEach((clip) => { if (!only || only.has(clip.id)) vclips.push({ track, clip }); }));
  let done = 0, faced = 0, splits = 0;
  const srcs = new Map();
  try {
    for (const { track, clip } of vclips) {
      progress(`Reframing: finding faces (${done + 1}/${vclips.length})`, done / vclips.length);
      const m = p.mediaById(clip.mediaId);
      if (!m || !m.hasVideo || !m.width) { done++; continue; }
      const k = Math.max(W / m.width, H / m.height) * (clip.scale || 1);
      if (m.width * k <= W + 1) { done++; continue; } // nic k posouvání (zdroj není širší než výřez)
      let src = srcs.get(m.id);
      if (!src) { src = await VideoSource.open(fileOf(m)); srcs.set(m.id, src); }
      const ah = Math.round(AW * m.height / m.width / 2) * 2;
      const cuts = clip.out - clip.in > 1.2 ? await cameraCuts(src, clip.in, clip.out, m.fps || 25, ah) : [];
      const bounds = [clip.in, ...cuts, clip.out];
      const shots = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        const tg = await shotTarget(src, bounds[i], bounds[i + 1], ah);
        shots.push({ in: bounds[i], out: bounds[i + 1], x: tg ? tg.x : null });
      }
      plan.push({ track, clip, k, iw: m.width, shots, src, ah, m, file: fileOf(m) });
      done++;
    }
    await edgeFragments(plan, seq);
  } finally { for (const s of srcs.values()) s.close(); }
  progress('', 1);
  const posFor = (x, iw, k) => {
    const sw = iw * k;
    const px = x * sw - W / 2;
    return Math.max(-1, Math.min(1, px / ((sw - W) / 2) - 1));
  };
  let merged = 0;
  p.edit('AI: Reframe for ' + W + '×' + H, () => {
    // zbytky záběru na kraji klipu (pár snímků před/za střihem kamery) převezme sousední klip – jinak ve výsledku bliknou
    for (const e of plan) {
      if (e.head) {
        const { d } = e.head;
        trimSeqHead(seq, d);
        e.shots.shift(); e.shots[0].in = e.clip.in;
        merged++;
      }
      if (e.foot) {
        trimSeqFoot(seq, e.clip, e.foot.d);
        e.shots.pop(); e.shots[e.shots.length - 1].out = e.clip.out;
        merged++;
      }
      if (e.lead) {
        const { prev, d } = e.lead;
        prev.clip.out += d; prev.shots[prev.shots.length - 1].out += d; prev.clip.linkId = null;
        e.clip.in += d; e.clip.start += d; e.clip.linkId = null;
        e.shots.shift(); e.shots[0].in = e.clip.in;
        merged++;
      }
      if (e.tail) {
        const { next, d } = e.tail;
        next.clip.in -= d; next.clip.start -= d; next.shots[0].in -= d; next.clip.linkId = null;
        e.clip.out -= d; e.clip.linkId = null;
        e.shots.pop(); e.shots[e.shots.length - 1].out = e.clip.out;
        merged++;
      }
    }
    for (const { track, clip, k, iw, shots } of plan) {
      let cur = clip;
      shots.forEach((s, i) => {
        if (i > 0) {
          const at = Math.round((clip.start + (s.in - clip.in)) * (seq.fps || 25)) / (seq.fps || 25);
          const right = E.splitClip(seq, track, cur, at);
          if (!right) return;
          right.linkId = null; // rozříznutý jen obraz – zvuk zůstává v celku
          // ani levý kus nesmí zůstat propojený se zvukem celého klipu: Delete na něm smazal zvuk celé sekvence (kolo 7)
          cur.linkId = null;
          splits++;
          cur = right;
        }
        if (s.x !== null) { cur.posX = posFor(s.x, iw, k); faced++; }
      });
    }
  });
  syncRepeats(seq);
  return { clips: vclips.length, splits, faced, merged, shots: plan.reduce((a, x) => a + x.shots.length, 0) };
}

const MIN_SHOT = 0.5;
/** Je ve zvuku [a, a + d + 0,03 s] ticho (pod prahem 15 dB pod řečí následujících 8 s)? */
async function quietHead(file, a, d) {
  try {
    const T = require('./transcripts');
    const thr = (await T.speechLevel(file, a, a + 8)) * Math.pow(10, -15 / 20);
    const x = await T.audio16k(file, a, a + d + 0.06);
    for (let u = a + 0.015; u <= a + d + 0.03; u += 0.01) { const v = T.rmsWin(x, a, u, 0.03); if (v !== null && v > thr) return false; }
    return true;
  } catch (e) { return false; }
}
/** Zkrátit konec sekvence o d s (klip na konci obrazu a zvuk, který s ním končí). */
function trimSeqFoot(seq, clip, d) {
  const end = clipEnd(clip);
  for (const kind of ['video', 'audio']) for (const tr of seq.tracks[kind]) for (const c of tr.clips) {
    if (Math.abs(clipEnd(c) - end) < 0.02) c.out -= d;
  }
  seq.captions = (seq.captions || []).map((c) => c.end > end - d ? Object.assign({}, c, { end: Math.max(c.start + 0.05, end - d) }) : c);
}
/** Prodloužit konec sekvence o d s (klip na konci obrazu a zvuk, který s ním končí) – do pauzy za posledním slovem. */
function extendSeqFoot(seq, clip, d) {
  const end = clipEnd(clip);
  for (const kind of ['video', 'audio']) for (const tr of seq.tracks[kind]) for (const c of tr.clips) {
    if (Math.abs(clipEnd(c) - end) < 0.02) c.out += d;
  }
}
/** Odstřihnout prvních d s celé sekvence (všechny stopy, titulky, značky) – zbytek jiného záběru na úplném začátku. */
function trimSeqHead(seq, d) {
  for (const kind of ['video', 'audio']) for (const tr of seq.tracks[kind]) {
    for (const c of tr.clips) {
      if (c.start < d - 1e-6) { const cut = d - c.start; c.in += cut; c.start = 0; } else c.start -= d;
    }
    tr.clips = tr.clips.filter((c) => c.out - c.in > 1e-3);
  }
  seq.captions = (seq.captions || []).map((c) => Object.assign({}, c, { start: Math.max(0, c.start - d), end: c.end - d })).filter((c) => c.end > 0.05);
  seq.markers = (seq.markers || []).map((mk) => Object.assign({}, mk, { time: Math.max(0, (mk.time || 0) - d) }));
} // kratší záběr na kraji klipu = probliknutí (kolo 7: zbytky 0,36–0,40 s divák vidí jako blik)

/**
 * Najde zbytky záběru kratší než MIN_SHOT na začátku (lead) / konci (tail) klipu a ověří, že je převezme sousední
 * klip na stejné stopě: jeho obraz se o tolik prodlouží (zvuk zůstává – vznikne J/L-střih o pár snímků) a v prodloužení
 * není další střih kamery. Výsledek zapíše do položek plánu (e.lead / e.tail = { prev|next, d }).
 */
async function edgeFragments(plan, seq) {
  const fps = seq.fps || 25, tol = 0.5 / fps;
  const cv = new Map();
  const thumb = async (e, t) => {
    if (!cv.has(e.ah)) cv.set(e.ah, canvas(AW, e.ah));
    const SW = 64, SH = Math.round(64 * e.ah / AW);
    return grayOf(await grab(e.src, t, cv.get(e.ah)), SW, SH);
  };
  const same = async (e, a, b) => meanDiff(await thumb(e, a), await thumb(e, b)) <= 16;
  for (const e of plan) {
    const sh = e.shots;
    if (sh.length < 2) continue;
    const d0 = Math.round((sh[0].out - sh[0].in) * fps) / fps;
    if (d0 > 0 && d0 < MIN_SHOT) {
      const prev = plan.find((q) => q !== e && q.track === e.track && Math.abs(clipEnd(q.clip) - e.clip.start) < tol);
      // obraz předchozího záběru by běžel pod začátkem nové repliky – jen když tam není řeč, nebo jde o ≤ 3 snímky
      // (kolo 8, kontrolor: 0,27 s řeči „Takže“ pod cizími rty)
      const lipsOk = (d) => d <= 5.5 / fps || !e.file ? true : quietHead(e.file, e.clip.in, d); // ≤ 5 snímků: bleskající záběr je horší než obraz o zlomek s napřed (AI tok S2: 4 snímky celku)
      if (prev && !prev.tail && prev.clip.out + d0 <= (prev.m.duration || 0) - 0.05 &&
          await same(prev, prev.clip.out - 0.04, prev.clip.out + d0 - 0.02) && await lipsOk(d0)) e.lead = { prev, d: d0 };
      // úplný začátek sekvence (není soused, který by zbytek převzal): zbytek se odstřihne i se zvukem a sekvence se posune,
      // jen když v něm není řeč (kolo 8, redaktorka: video 4:5 začínalo 2 snímky moderátorky)
      else if (!prev && e.clip.start < tol && e.file && await quietHead(e.file, e.clip.in, d0)) e.head = { d: d0 };
    }
    const L = sh[sh.length - 1];
    const d1 = Math.round((L.out - L.in) * fps) / fps;
    if (d1 > 0 && d1 < MIN_SHOT && !((e.lead || e.head) && sh.length < 3)) {
      const end = clipEnd(e.clip);
      const next = plan.find((q) => q !== e && q.track === e.track && Math.abs(q.clip.start - end) < tol);
      const lipsT = d1 <= 5.5 / fps || !e.file ? true : await quietHead(e.file, e.clip.out - d1 - 0.03, d1);
      if (next && !next.lead && next.clip.in - d1 >= 0 &&
          await same(next, next.clip.in - d1 + 0.02, next.clip.in + 0.04) && lipsT) e.tail = { next, d: d1 };
      // úplný konec sekvence (nic za klipem): zbytek odstřihnout i se zvukem, když v něm není řeč (kolo 8: d 10 snímků celku na konci)
      else if (!next && e.file && !plan.some((q) => q !== e && q.track === e.track && q.clip.start > e.clip.start)) {
        if (await quietHead(e.file, e.clip.out - d1 - 0.03, d1)) e.foot = { d: d1 };
        else {
          // pod zbytkem ještě doznívá poslední slovo (AI tok S3: 4 snímky celku pod „pryč.“) – odstřihnout nejde, tak konec
          // prodloužit do pauzy za slovem: ze zbytku je normální záběr ≥ 0,6 s bez řeči, ne probliknutí
          const ext = Math.ceil((MIN_SHOT + 0.1 - d1) * fps) / fps;
          if (e.clip.out + ext <= ((e.m && e.m.duration) || 0) - 0.05 && e.src && await quietHead(e.file, e.clip.out + 0.02, ext - 0.02)
              && !(await cameraCuts(e.src, e.clip.out, e.clip.out + ext + 0.04, fps, e.ah, 0.1)).length) e.footExt = { ext };
          // řeč pokračuje i za slovem (prodloužit nejde): posledních pár snímků obrazu = zopakované poslední snímky záběru
          // před střihem kamery (jako krátké zastavení obrazu); zvuk beze změny. Jen ≤ 5 snímků – delší by bylo vidět.
          else if (d1 <= 5.5 / fps) e.footRepeat = { d: d1 };
        }
      }
    }
  }
}

/**
 * Auto Reframe jako NOVÁ sekvence (Sekvence → Auto Reframe, nástroj AI reframe_sequence): kopie zdrojové sekvence
 * v rozměru W×H, výřez podle obličeje / mluvčího, titulky přeskládané na nový tvar, nadpis zůstává.
 * fileOf(media) vrací File (web) nebo objekt se stejným rozhraním size + slice(a, b).arrayBuffer() (desktop).
 */
async function reframeCopy(app, src, num, den, W, H, fileOf, status = () => {}) {
  const { uid, uuid } = require('../../src/core/util');
  const CL = require('../../src/core/captionlayout');
  // z jakékoli širší sekvence (4:5 → 9:16 taky – klipy odkazují na původní 16:9 záběry, výřez se počítá znovu z nich; kolo 8)
  if (src.width / src.height < num / den + 0.02) {
    const cz = typeof window !== 'undefined' && window.TN && window.TN.lang === 'cs';
    throw new Error(cz ? `„${src.name}“ má ${src.width}×${src.height} – na ${num}:${den} jde převést jen ze širší sekvence (např. 16:9 nebo 4:5).`
      : `“${src.name}” is ${src.width}×${src.height} – ${num}:${den} can only be made from a wider sequence (e.g. 16:9 or 4:5).`);
  }
  const seq = JSON.parse(JSON.stringify(src));
  for (const kind of ['video', 'audio']) for (const tr of seq.tracks[kind]) for (const c of tr.clips) c.id = uid('c');
  seq.id = uuid();
  seq.name = app.project.uniqueSeqName(`${src.name} ${num}x${den}`);
  seq.width = W; seq.height = H;
  for (const tr of seq.tracks.video) for (const c of tr.clips) { c.fit = 'cover'; c.scale = 1; c.posX = 0; c.posY = 0; }
  // výška a velikost titulků podle nového tvaru; zvýraznění slova, barva a podklad zůstanou jako ve zdroji
  if ((seq.captions || []).length) { const keepSt = {}; for (const k of ['highlight', 'color', 'box']) if (src.captionStyle && src.captionStyle[k] !== undefined) keepSt[k] = src.captionStyle[k]; delete seq.captionStyle; if (Object.keys(keepSt).length) seq.captionStyle = Object.assign(CL.styleOf(seq), keepSt); seq.captions = CL.reflow(seq); }
  app.edit('Auto Reframe Sequence', () => { app.project.addSequence(seq); });
  const added = app.project.sequences.find((x) => x.id === seq.id);
  app.openSequence(added.id);
  const r = await reframeSequence(app, added, fileOf, status);
  app.program.refresh();
  return { name: added.name, shots: r.shots, facesFound: r.faced, splits: r.splits, merged: r.merged };
}

/** Desktop: soubor z disku se stejným rozhraním jako File (size, slice().arrayBuffer()) – čte se po kouscích. */
class FsFile {
  constructor(p) {
    const fs = require('fs');
    this.fs = fs; this.path = p; this.name = require('path').basename(p); this.size = fs.statSync(p).size; this.fd = null;
  }
  slice(a, b) {
    const self = this;
    return {
      async arrayBuffer() {
        if (self.fd === null) self.fd = self.fs.openSync(self.path, 'r');
        const n = Math.max(0, Math.min(b, self.size) - a);
        const buf = Buffer.alloc(n);
        self.fs.readSync(self.fd, buf, 0, n, a);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + n);
      },
    };
  }
}

/**
 * Zbytky jiného záběru na krajích klipů i bez převodu formátu (16:9 sestřih): pár snímků před/za střihem kamery
 * na začátku/konci klipu převezme sousední klip na stopě (stejně jako reframeSequence). Hledá jen v okně MIN_SHOT u krajů,
 * In/Out zvuku se nemění. Kolo 7 (kontrolor výstupu): 16:9 export ukázal 2 snímky moderátorky na začátku klipu.
 */
/** Zopakované snímky na konci sekvence (footRepeat, `rep`) mají výřez jako záběr, který opakují – jinak výřez 9:16
 *  poskočí (kontrolor S4: o 23 px), protože se obličej hledá v každém klipu zvlášť. */
function syncRepeats(seq) {
  for (const tr of seq.tracks.video) for (const c of tr.clips) {
    if (!c.rep) continue;
    const q = tr.clips.find((x) => x !== c && x.mediaId === c.mediaId && Math.abs(clipEnd(x) - c.start) < 0.02);
    if (q) for (const k of ['posX', 'posY', 'scale', 'fit']) c[k] = q[k];
  }
}
async function fixEdgeShots(app, seq, fileOf, progress = () => {}) {
  const p = app.project;
  syncRepeats(seq); // Auto Reframe ve standalone (ffmpeg + OpenCV) hledá obličej i v zopakovaném kousku

  const plan = [];
  const srcs = new Map();
  try {
    for (const track of seq.tracks.video) {
      for (const clip of track.clips) {
        const m = p.mediaById(clip.mediaId);
        if (!m || !m.hasVideo || !m.width || clip.out - clip.in < 2 * MIN_SHOT + 0.2) continue;
        let src = srcs.get(m.id);
        if (!src) { src = await VideoSource.open(fileOf(m)); srcs.set(m.id, src); }
        const ah = Math.round(AW * m.height / m.width / 2) * 2, fps = m.fps || 25;
        const head = await cameraCuts(src, clip.in, clip.in + MIN_SHOT + 0.1, fps, ah, 0.1);
        const tail = await cameraCuts(src, clip.out - MIN_SHOT - 0.1, clip.out, fps, ah, 0.1);
        const bounds = [clip.in, ...head.slice(-1), ...tail.slice(0, 1), clip.out];
        const shots = [];
        for (let i = 0; i < bounds.length - 1; i++) shots.push({ in: bounds[i], out: bounds[i + 1], x: null });
        plan.push({ track, clip, shots, src, ah, m, file: fileOf(m) });
      }
    }
    progress('', 0.5);
    await edgeFragments(plan, seq);
  } finally { for (const s of srcs.values()) s.close(); }
  progress('', 1);
  const todo = plan.filter((e) => e.lead || e.tail || e.head || e.foot || e.footExt || e.footRepeat);
  if (!todo.length) return { merged: 0 };
  p.edit('Clean up camera-cut leftovers', () => {
    for (const e of todo) {
      if (e.head) trimSeqHead(seq, e.head.d);
      if (e.foot) trimSeqFoot(seq, e.clip, e.foot.d);
      if (e.footExt) extendSeqFoot(seq, e.clip, e.footExt.ext);
      if (e.footRepeat) {
        const { d } = e.footRepeat, c = e.clip;
        for (const tr of seq.tracks.audio) for (const a of tr.clips) if (c.linkId && a.linkId === c.linkId) a.linkId = null;
        c.out -= d; c.linkId = null;
        const { uid } = require('../../src/core/util');
        e.track.clips.push(Object.assign({}, c, { id: uid('c'), in: c.out - d, out: c.out, start: clipEnd(c), rep: true }));
        e.track.clips.sort((x, y) => x.start - y.start);
      }
      if (e.lead) { const { prev, d } = e.lead; prev.clip.out += d; prev.clip.linkId = null; e.clip.in += d; e.clip.start += d; e.clip.linkId = null; }
      if (e.tail) { const { next, d } = e.tail; next.clip.in -= d; next.clip.start -= d; next.clip.linkId = null; e.clip.out -= d; e.clip.linkId = null; }
    }
  });
  return { merged: todo.length };
}

module.exports = { reframeSequence, reframeCopy, fixEdgeShots, FsFile, facesIn, detector, shotTarget };
