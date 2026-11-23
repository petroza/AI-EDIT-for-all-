'use strict';
// Střihové operace nad sekvencí (čisté funkce nad daty modelu, bez UI). Chovají se jako v Premiere:
// overwrite přepíše, co je pod klipem; insert odsune vše za bodem vložení na všech odemčených stopách;
// extract/ripple delete zavírá mezeru na všech stopách (synchronizace obrazu a zvuku zůstane).
const { uid, EPS } = require('./util');
const { clipEnd, sortTrack, newClip } = require('./model');

const fd = (seq) => 1 / (seq.fps || 25);
const snapT = (seq, t) => Math.round(t * (seq.fps || 25)) / (seq.fps || 25);
const half = (seq) => fd(seq) / 2;

function tracksOf(seq, kind) { return seq.tracks[kind]; }

function eachTrack(seq, fn) {
  for (const kind of ['video', 'audio']) seq.tracks[kind].forEach((t, ti) => fn(t, kind, ti));
}

function findClip(seq, id) {
  for (const kind of ['video', 'audio']) {
    const ts = seq.tracks[kind];
    for (let ti = 0; ti < ts.length; ti++) {
      const c = ts[ti].clips.find((x) => x.id === id);
      if (c) return { clip: c, kind, track: ti, trackObj: ts[ti] };
    }
  }
  return null;
}

function linked(seq, clip) {
  if (!clip.linkId) return [clip];
  const out = [];
  eachTrack(seq, (t) => t.clips.forEach((c) => { if (c.linkId === clip.linkId) out.push(c); }));
  return out;
}

/** Obraz rozříznutý výřezem / úklidem krajů se odpojil (linkId null), zvuk si nechal propojení na obraz, který už neexistuje
 *  („osiřelý“) – žiletka, Shift+Delete i ořez pak působily jen na obraz (redaktorka S9: černá díra se zvukem). Jako v Premiere:
 *  osiřelý zvuk téhož zdroje se stejným časováním (start − in) se rozřízne na začátcích kusů obrazu uvnitř něj a každý kus
 *  obrazu se propojí se svým zvukem (všechny zvukové stopy). Zvuk, který rozpojil uživatel (linkId null), zůstane netknutý.
 *  Kraje posunuté úklidem (o pár snímků) zůstanou propojené s posunem. Export čte navazující kusy zvuku vcelku. */
function relinkAV(seq) {
  const fd = 1 / (seq.fps || 25);
  const off = (c) => c.start - c.in;
  const vids = [];
  seq.tracks.video.forEach((tr) => tr.clips.forEach((v) => { if (!v.linkId) vids.push(v); }));
  if (!vids.length) return 0;
  const vLinks = () => new Set(seq.tracks.video.flatMap((tr) => tr.clips.map((c) => c.linkId).filter(Boolean)));
  let have = vLinks();
  const orphan = (a) => a.linkId && !have.has(a.linkId);
  const same = (a, v) => a.mediaId === v.mediaId && Math.abs(off(a) - off(v)) < fd / 2;
  for (const atr of seq.tracks.audio) {
    if (atr.locked) continue;
    for (const v of vids) {
      // jen kde na sebe navazují dva kusy obrazu téhož záběru (rozříznutí na střihu kamery) – ne na začátku obrazu
      // posunutém úklidem krajů (J-střih: vznikl osiřelý kousek zvuku se začátkem slova, kontrolor S10 #3)
      const cont = vids.some((u) => u !== v && same(u, v) && Math.abs(clipEnd(u) - v.start) < fd / 2);
      if (!cont) continue;
      const a = atr.clips.find((x) => orphan(x) && same(x, v) && v.start > x.start + fd / 2 && v.start < clipEnd(x) - fd / 2);
      if (a) splitClip(seq, atr, a, v.start);
    }
  }
  have = vLinks();
  let n = 0;
  for (const v of vids) {
    const ve = clipEnd(v), group = [];
    for (const atr of seq.tracks.audio) {
      let best = null, bestOv = 0;
      for (const a of atr.clips) {
        if (!orphan(a) || !same(a, v)) continue;
        const ov = Math.min(ve, clipEnd(a)) - Math.max(v.start, a.start);
        if (ov > bestOv) { best = a; bestOv = ov; }
      }
      if (best && bestOv > 0.5 * Math.min(ve - v.start, clipEnd(best) - best.start)) group.push(best);
    }
    if (group.length) { const l = uid('l'); v.linkId = l; for (const a of group) a.linkId = l; have.add(l); n++; }
  }
  return n;
}

/** Navazující kusy zvuku téhož zdroje (žiletka, zvuk rozříznutý spolu s obrazem po výřezu / úklidu krajů) jako jeden úsek:
 *  [{mediaId, start, in, out, clips}] – pro titulky (slova a „střih“ jen tam, kde se zvuk opravdu mění; kontrolor S10:
 *  titulky se lámaly na rozříznutém zvuku – zdvojené slovo, řeč bez titulku). */
function audioRuns(clips) {
  const out = [];
  for (const c of [...clips].filter((x) => !x.disabled).sort((a, b) => a.start - b.start)) {
    const r = out[out.length - 1];
    if (r && r.mediaId === c.mediaId && Math.abs(r.start + (r.out - r.in) - c.start) < 1e-3 && Math.abs(r.out - c.in) < 1e-3) {
      r.out = c.out; r.clips.push(c);
    } else out.push({ mediaId: c.mediaId, start: c.start, in: c.in, out: c.out, clips: [c] });
  }
  return out;
}

/** Rozdělí klip v čase t; vrátí pravou část (nebo null, když t neleží uvnitř). */
function splitClip(seq, track, clip, t, linkMap) {
  const h = half(seq);
  if (t <= clip.start + h || t >= clipEnd(clip) - h) return null;
  const right = Object.assign({}, clip, { id: uid('c') });
  const cut = clip.in + (t - clip.start);
  clip.out = cut;
  right.start = t;
  right.in = cut;
  right.fadeIn = 0;
  clip.fadeOut = 0;
  right.vIn = null;   // přechod obrazu zůstává na vnějších krajích, ne na novém řezu
  clip.vOut = null;
  if (clip.linkId) {
    if (linkMap) {
      if (!linkMap.has(clip.linkId)) linkMap.set(clip.linkId, uid('l'));
      right.linkId = linkMap.get(clip.linkId);
    } else right.linkId = uid('l');
  }
  track.clips.push(right);
  sortTrack(track);
  return right;
}

/** Řez ve všech (nebo vybraných) stopách v čase t. tracks: [{kind, track}] nebo undefined = všechny odemčené. */
function razor(seq, t, tracks) {
  t = snapT(seq, t);
  const linkMap = new Map();
  let n = 0;
  eachTrack(seq, (tr, kind, ti) => {
    if (tr.locked) return;
    if (tracks && !tracks.some((x) => x.kind === kind && x.track === ti)) return;
    for (const c of tr.clips.slice()) if (splitClip(seq, tr, c, t, linkMap)) n++;
  });
  return n;
}

/** Vyprázdní úsek [s, e) na jedné stopě (klipy zkrátí, rozdělí nebo odstraní). */
function clearRange(seq, kind, ti, s, e) {
  const tr = seq.tracks[kind][ti];
  const h = half(seq);
  for (const c of tr.clips.slice()) {
    const cs = c.start, ce = clipEnd(c);
    if (ce <= s + h || cs >= e - h) continue;
    if (cs >= s - h && ce <= e + h) { tr.clips.splice(tr.clips.indexOf(c), 1); continue; }
    if (cs < s - h && ce > e + h) {
      const right = splitClip(seq, tr, c, e);
      c.out = c.in + (s - cs);
      if (right) right.fadeIn = 0;
      continue;
    }
    if (cs < s - h) { c.out = c.in + (s - cs); c.fadeOut = 0; c.vOut = null; continue; }
    // začátek klipu leží v úseku
    const cut = e - cs;
    c.in += cut;
    c.start = e;
    c.fadeIn = 0;
    c.vIn = null;
  }
  sortTrack(tr);
}

function placeClip(seq, kind, ti, clip) {
  const tr = seq.tracks[kind][ti];
  if (!tr) throw new Error(`${kind === 'video' ? 'V' : 'A'}${ti + 1} does not exist in the sequence`);
  clearRange(seq, kind, ti, clip.start, clipEnd(clip));
  tr.clips.push(clip);
  sortTrack(tr);
  return clip;
}

/** Posune všechny klipy (a titulky, značky) začínající v čase ≥ t o delta. */
function shiftAfter(seq, t, delta, opts = {}) {
  const h = half(seq);
  eachTrack(seq, (tr) => {
    if (tr.locked && !opts.includeLocked) return;
    for (const c of tr.clips) if (c.start >= t - h && !(opts.except && opts.except.has(c.id))) c.start = Math.max(0, c.start + delta);
    sortTrack(tr);
  });
  if (opts.noCaps) return;
  for (const c of seq.captions || []) if (c.start >= t - h) { c.start += delta; c.end += delta; }
  for (const m of seq.markers || []) if (m.time >= t - h) m.time = Math.max(0, m.time + delta);
}

/** Trimuje se klip na řečové stopě (první nemutovaná zvuková stopa s klipy)? Jen pak se titulky ořezávají s ním. */
function onSpeech(seq, group) {
  const ti = seq.tracks.audio.findIndex((t) => !t.muted && t.clips.some((c) => !c.disabled));
  return ti >= 0 && group.some((c) => seq.tracks.audio[ti].clips.includes(c));
}
/** Slova titulků v úseku [s, e) pryč bez posunu (smazaný výrok, mezera zůstává). */
function liftCaptions(seq, s, e) {
  const caps = [];
  for (const c of seq.captions || []) {
    if (c.end <= s + EPS || c.start >= e - EPS) { caps.push(c); continue; }
    const words = String(c.text).split(/\s+/).filter(Boolean);
    const ws = Array.isArray(c.ws) && c.ws.length === words.length ? c.ws : null;
    if (!ws) { if (c.start < s - 0.3) caps.push(Object.assign({}, c, { end: s })); if (c.end > e + 0.3) caps.push(Object.assign({}, c, { start: e })); continue; }
    const a = [], b = [];
    words.forEach((w, i) => { if (ws[i] < s - EPS) a.push(i); else if (ws[i] >= e - EPS) b.push(i); });
    if (a.length) caps.push({ ...c, end: Math.min(c.end, s), text: a.map((i) => words[i]).join(' '), ws: a.map((i) => ws[i]) });
    if (b.length) caps.push({ ...c, start: Math.max(c.start, e), text: b.map((i) => words[i]).join(' '), ws: b.map((i) => ws[i]) });
  }
  seq.captions = caps.filter((c) => c.end - c.start > 0.04);
}
/** Úsek [s, e) časové osy zmizí: titulky v něm pryč, přes hranu rozdělené podle slov (žádný smazaný text v obraze),
 *  titulky a značky za ním o (e − s) dřív, značky uvnitř pryč (redaktorka S5/S6). */
function rippleCaptions(seq, s, e) {
  const caps = [];
  for (const c of seq.captions || []) {
    if (c.start >= s - EPS && c.end <= e + EPS) continue;
    if (c.end <= s + EPS) { caps.push(c); continue; }
    if (c.start >= e - EPS) { caps.push(Object.assign({}, c, { start: c.start - (e - s), end: c.end - (e - s), ws: Array.isArray(c.ws) ? c.ws.map((x) => x - (e - s)) : c.ws })); continue; }
    const words = String(c.text).split(/\s+/).filter(Boolean);
    const ws = Array.isArray(c.ws) && c.ws.length === words.length ? c.ws : null;
    if (!ws) { caps.push(c.start < s ? Object.assign({}, c, { end: s }) : Object.assign({}, c, { start: s, end: c.end - (e - s) })); continue; }
    const a = [], b = [];
    words.forEach((w, i) => { if (ws[i] < s - EPS) a.push(i); else if (ws[i] >= e - EPS) b.push(i); });
    if (a.length) caps.push({ ...c, end: Math.min(c.end, s), text: a.map((i) => words[i]).join(' '), ws: a.map((i) => ws[i]) });
    if (b.length) caps.push({ ...c, start: Math.max(c.start, e) - (e - s), end: c.end - (e - s), text: b.map((i) => words[i]).join(' '), ws: b.map((i) => ws[i] - (e - s)) });
  }
  seq.captions = caps.filter((c) => c.end - c.start > 0.04).sort((x, y) => x.start - y.start);
  seq.markers = (seq.markers || []).filter((m) => !(m.time >= s + EPS && m.time < e - EPS))
    .map((m) => (m.time >= e - EPS ? Object.assign({}, m, { time: Math.max(0, m.time - (e - s)) }) : m)).sort((x, y) => (x.time || 0) - (y.time || 0));
}

/** Vloží prázdné místo délky dur v čase t (rozřízne klipy, které t přecházejí). */
function insertSpace(seq, t, dur) {
  t = snapT(seq, t);
  razor(seq, t);
  shiftAfter(seq, t, dur);
}

/** Vyjmutí úseku ze všech odemčených stop s posunem (extract / removeRanges ripple). */
function extractRange(seq, s, e) {
  s = snapT(seq, s); e = snapT(seq, e);
  if (e - s < fd(seq) - EPS) return 0;
  let removed = 0;
  eachTrack(seq, (tr, kind, ti) => {
    if (tr.locked) return;
    const before = tr.clips.length;
    clearRange(seq, kind, ti, s, e);
    removed += Math.max(0, before - tr.clips.length);
  });
  rippleCaptions(seq, s, e); // titulky a značky (redaktorka S5: smazaný text v titulku)
  shiftAfter(seq, e, -(e - s), { noCaps: true });
  return removed;
}

/** Zvednutí úseku z vybraných stop bez posunu (lift). */
function liftRange(seq, s, e, tracks) {
  s = snapT(seq, s); e = snapT(seq, e);
  eachTrack(seq, (tr, kind, ti) => {
    if (tr.locked) return;
    if (tracks && !tracks.some((x) => x.kind === kind && x.track === ti)) return;
    clearRange(seq, kind, ti, s, e);
  });
}

function trackEmptyIn(tr, s, e, h) {
  return !tr.clips.some((c) => clipEnd(c) > s + h && c.start < e - h);
}

/** Smazání klipů; ripple = zavřít mezeru (jen když je v úseku prázdno na všech stopách, jinak jen na jejich stopách). */
function removeClips(seq, ids, ripple) {
  const set = new Set(ids);
  const removedSpan = new Map();
  const removedAudio = new Map(); // id -> index zvukové stopy
  removeClips.blocked = 0;
  // řečová stopa = první nemutovaná zvuková stopa s klipy (z ní se dělají titulky) – zjistit PŘED mazáním
  const speechTi = seq.tracks.audio.findIndex((t) => !t.muted && t.clips.some((c) => !c.disabled));
  let s = Infinity, e = -Infinity, n = 0;
  const touched = new Set();
  eachTrack(seq, (tr, kind, ti) => {
    for (const c of tr.clips.slice()) {
      if (!set.has(c.id)) continue;
      s = Math.min(s, c.start);
      e = Math.max(e, clipEnd(c));
      removedSpan.set(c.id, [c.start, clipEnd(c)]);
      if (kind === 'audio') removedAudio.set(c.id, ti);
      tr.clips.splice(tr.clips.indexOf(c), 1);
      touched.add(kind + ti);
      n++;
    }
  });
  // titulky smazaných výroků: kde po smazání nezní žádný zvukový klip, slova titulků pryč (redaktorka S6: zůstaly nad černou)
  for (const [id, [a, b]] of removedSpan) {
    if (!removedAudio.has(id) || removedAudio.get(id) !== speechTi) continue; // b-roll / hudba na jiné stopě titulky nemaže (revize #1)
    const tr = seq.tracks.audio[removedAudio.get(id)]; // jen stopa, odkud zvuk zmizel – hudba na jiné stopě titulky nedrží
    const covered = tr && tr.clips.some((c) => !c.disabled && c.start < b - 0.01 && clipEnd(c) > a + 0.01);
    if (!covered) liftCaptions(seq, a, b);
  }
  if (ripple && n && e > s) {
    // Zavřít jde jen mezera, která je po smazání prázdná na VŠECH odemčených stopách – posune se všechno včetně titulků
    // a značek (nic se nerozjede). Leží-li přes ni jiný klip (b-roll na V2, hudba), nic dalšího se nemaže a mezera zůstane:
    // redaktorka S6 – vyjmutí ze všech stop potichu ničilo nevybraný b-roll a hudbu, nepropojený posun (S5) zase rozjel stopy.
    // Úseky smazaných klipů se zavírají každý zvlášť, od konce (nesousední výběr).
    const h = half(seq);
    const spans = [];
    for (const id of set) { const x = removedSpan.get(id); if (x) spans.push(x); }
    spans.sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const [a, b] of spans) { const l = merged[merged.length - 1]; if (l && a <= l[1] + h) l[1] = Math.max(l[1], b); else merged.push([a, b]); }
    for (const [a, b] of merged.reverse()) {
      let empty = true;
      eachTrack(seq, (tr) => { if (!tr.locked && !trackEmptyIn(tr, a, b, h)) empty = false; });
      if (empty) { rippleCaptions(seq, a, b); shiftAfter(seq, b, -(b - a), { noCaps: true }); } else removeClips.blocked++;
    }
  }
  return n;
}

/** Smaže mezeru na stopě v čase t (ripple delete mezery) – jen když je úsek prázdný na všech stopách. */
function rippleDeleteGap(seq, kind, ti, t) {
  const tr = seq.tracks[kind][ti];
  const h = half(seq);
  let s = 0, e = Infinity;
  for (const c of tr.clips) {
    if (clipEnd(c) <= t + h) s = Math.max(s, clipEnd(c));
    if (c.start >= t - h) e = Math.min(e, c.start);
    if (c.start < t && clipEnd(c) > t) return false; // klik do klipu, ne do mezery
  }
  if (!isFinite(e) || e - s < fd(seq) - EPS) return false;
  let ok = true;
  eachTrack(seq, (x) => { if (!x.locked && !trackEmptyIn(x, s, e, h)) ok = false; });
  if (!ok) return false;
  rippleCaptions(seq, s, e);
  shiftAfter(seq, e, -(e - s), { noCaps: true });
  return { start: s, end: e };
}

/** Vložení úseku zdroje (insert / overwrite) na cílové stopy, obraz a zvuk propojené. */
function editFromSource(seq, media, srcIn, srcOut, at, mode, targets = {}) {
  at = snapT(seq, Math.max(0, at));
  const dur = snapT(seq, srcOut - srcIn);
  if (dur < fd(seq) - EPS) throw new Error('The source range is shorter than one frame.');
  const vti = targets.video !== undefined ? targets.video : seq.tracks.video.findIndex((t) => t.target);
  const ati = targets.audio !== undefined ? targets.audio : seq.tracks.audio.findIndex((t) => t.target);
  const useV = media.hasVideo && vti >= 0 && !targets.audioOnly;
  const useA = media.hasAudio && ati >= 0 && !targets.videoOnly;
  if (!useV && !useA) throw new Error('No target track (turn on V/A source patching in the track header).');
  if (mode === 'insert') insertSpace(seq, at, dur);
  const link = useV && useA ? uid('l') : null;
  const placed = [];
  if (useV) placed.push(placeClip(seq, 'video', vti, newClip(media, 'video', at, srcIn, srcIn + dur, { linkId: link })));
  if (useA) placed.push(placeClip(seq, 'audio', ati, newClip(media, 'audio', at, srcIn, srcIn + dur, { linkId: link })));
  // záběr na šířku v sekvenci na výšku (sítě): vyplnit obraz, ne malý pruh uprostřed (výřez podle obličeje = Auto Reframe)
  if (media.hasVideo && seq.height > seq.width && media.width > media.height) for (const c of placed) if (c && c.fit === 'contain') c.fit = 'cover';
  return placed;
}

/** Přesun klipů o dt (a o dTrack stop u klipů typu `kind`); cíl se přepíše jako v Premiere. */
function moveClips(seq, ids, dt, dTrack = 0, kindOfTrackMove = null) {
  const items = [];
  for (const id of ids) {
    const f = findClip(seq, id);
    if (f) items.push(f);
  }
  if (!items.length) return 0;
  // nejmenší start nesmí jít pod 0
  const minStart = Math.min(...items.map((x) => x.clip.start));
  if (minStart + dt < 0) dt = -minStart;
  dt = snapT(seq, dt);
  for (const it of items) it.trackObj.clips.splice(it.trackObj.clips.indexOf(it.clip), 1);
  for (const it of items) {
    let ti = it.track;
    if (dTrack && it.kind === kindOfTrackMove) ti = Math.max(0, Math.min(seq.tracks[it.kind].length - 1, ti + dTrack));
    it.clip.start = snapT(seq, it.clip.start + dt);
    placeClip(seq, it.kind, ti, it.clip);
  }
  return items.length;
}

/**
 * Trim okraje klipu: edge 'in' (začátek) nebo 'out' (konec) na čas `t` timeline.
 * ripple: délka se mění a vše za klipem se posune (na všech stopách), jinak se nesmí přesáhnout soused.
 * Propojené klipy (obraz+zvuk) se trimují stejně, pokud nejsou odpojené (opts.unlinked).
 */
function trimEdge(seq, id, edge, t, opts = {}) {
  const f = findClip(seq, id);
  if (!f) throw new Error('Clip not found');
  const group = opts.unlinked ? [f.clip] : linked(seq, f.clip);
  const media = opts.mediaDuration || (() => Infinity);
  const h = half(seq);
  t = snapT(seq, t);
  // povolený rozsah podle všech klipů skupiny
  let delta;
  if (edge === 'in') {
    delta = t - f.clip.start; // + zkracuje, - prodlužuje
    for (const c of group) {
      const tr = findClip(seq, c.id).trackObj;
      const maxD = (c.out - c.in) - fd(seq);
      const minD = -c.in; // nelze před začátek média
      let prevEnd = 0;
      for (const o of tr.clips) if (o !== c && clipEnd(o) <= c.start + h) prevEnd = Math.max(prevEnd, clipEnd(o));
      const minD2 = opts.ripple ? minD : Math.max(minD, prevEnd - c.start);
      delta = Math.max(Math.min(delta, maxD), minD2);
    }
    delta = snapT(seq, delta);
    if (Math.abs(delta) < EPS) return 0;
    if (opts.ripple) {
      const oldEnd = Math.max(...group.map(clipEnd)), st0 = Math.min(...group.map((c) => c.start));
      for (const c of group) { c.in += delta; c.fadeIn = 0; }
      // začátek zůstává, zbytek se posune o -delta; titulky klipu jdou s ním (zkrácení = odstřižená slova pryč)
      if (!onSpeech(seq, group)) shiftAfter(seq, oldEnd, -delta, { except: new Set(group.map((c) => c.id)) }); // b-roll / hudba: titulky jen za koncem (revize #7)
      else {
        if (delta > 0) rippleCaptions(seq, st0, st0 + delta);
        else {
          for (const cp of seq.captions || []) if (cp.start >= st0 - EPS) { cp.start -= delta; cp.end -= delta; if (Array.isArray(cp.ws)) cp.ws = cp.ws.map((x) => x - delta); }
          for (const m of seq.markers || []) if (m.time >= st0 - EPS) m.time -= delta; // revize #8
        }
        shiftAfter(seq, oldEnd, -delta, { except: new Set(group.map((c) => c.id)), noCaps: true });
      }
    } else {
      for (const c of group) { c.in += delta; c.start += delta; c.fadeIn = 0; }
    }
  } else {
    delta = t - clipEnd(f.clip);
    for (const c of group) {
      const tr = findClip(seq, c.id).trackObj;
      const minD = -((c.out - c.in) - fd(seq));
      const maxD = media(c.mediaId) - c.out;
      let nextStart = Infinity;
      for (const o of tr.clips) if (o !== c && o.start >= clipEnd(c) - h) nextStart = Math.min(nextStart, o.start);
      const maxD2 = opts.ripple ? maxD : Math.min(maxD, nextStart - clipEnd(c));
      delta = Math.min(Math.max(delta, minD), maxD2);
    }
    delta = snapT(seq, delta);
    if (Math.abs(delta) < EPS) return 0;
    const oldEnd = Math.max(...group.map(clipEnd));
    for (const c of group) { c.out += delta; c.fadeOut = 0; }
    if (opts.ripple && delta < 0 && onSpeech(seq, group)) { rippleCaptions(seq, oldEnd + delta, oldEnd); shiftAfter(seq, oldEnd, delta, { except: new Set(group.map((c) => c.id)), noCaps: true }); }
    else if (opts.ripple) shiftAfter(seq, oldEnd, delta, { except: new Set(group.map((c) => c.id)) });
  }
  for (const c of group) sortTrack(findClip(seq, c.id).trackObj);
  return delta;
}

/** Rolling Edit (N): posune střih mezi levým a pravým klipem o d (levý se prodlouží, pravý zkrátí, délka sekvence stejná). */
function rollEdit(seq, leftId, rightId, d, opts = {}) {
  const L = findClip(seq, leftId), R = findClip(seq, rightId);
  if (!L || !R) throw new Error('Clip not found');
  const media = opts.mediaDuration || (() => Infinity);
  const f = fd(seq);
  const pairs = [[L.clip, R.clip]];
  // propojené partnery (zvuk pod obrazem) posunout stejně, když tvoří stejný střih
  if (!opts.unlinked) {
    const lp = linked(seq, L.clip).filter((c) => c !== L.clip), rp = linked(seq, R.clip).filter((c) => c !== R.clip);
    for (const a of lp) {
      const b = rp.find((x) => Math.abs(x.start - clipEnd(a)) < f / 2 && findClip(seq, x.id).track === findClip(seq, a.id).track && findClip(seq, x.id).kind === findClip(seq, a.id).kind);
      if (b) pairs.push([a, b]);
    }
  }
  for (const [a, b] of pairs) {
    d = Math.max(d, -((a.out - a.in) - f), -b.in);
    d = Math.min(d, (b.out - b.in) - f, media(a.mediaId) - a.out);
  }
  d = snapT(seq, d);
  if (Math.abs(d) < EPS) return 0;
  for (const [a, b] of pairs) { a.out += d; b.in += d; b.start += d; a.fadeOut = 0; b.fadeIn = 0; }
  return d;
}

/** Slip (Y): obsah klipu se posune o d (in i out), poloha a délka na timeline zůstanou. */
function slipClip(seq, id, d, opts = {}) {
  const f0 = findClip(seq, id);
  if (!f0) throw new Error('Clip not found');
  const group = opts.unlinked ? [f0.clip] : linked(seq, f0.clip);
  const media = opts.mediaDuration || (() => Infinity);
  for (const c of group) d = Math.min(Math.max(d, -c.in), media(c.mediaId) - c.out);
  d = snapT(seq, d);
  if (Math.abs(d) < EPS) return 0;
  for (const c of group) { c.in += d; c.out += d; }
  return d;
}

/**
 * Přechody obrazu jako v Premiere. Uložené na klipu: c.vIn / c.vOut = {type:'cross'|'dipBlack'|'dipWhite', dur}.
 * Cross Dissolve na střihu je na pravém klipu (vIn, vystředěný na střih, potřebuje „handles“ – materiál za
 * koncem levého a před začátkem pravého klipu). Dip na střihu = levý klip zatmí (vOut), pravý roztmí (vIn).
 * Bez souseda (začátek/konec, mezera) = roztmívání/zatmívání z/do černé (nebo bílé).
 * @param at  čas střihu (playhead)   @param tracks [{track}] video stopy (undefined = cílové)
 */
function applyTransitionAt(seq, at, type, dur, tracks, mediaDuration = () => Infinity) {
  const h = half(seq), f = fd(seq);
  const out = { applied: 0, shortened: 0 };
  seq.tracks.video.forEach((tr, ti) => {
    if (tr.locked) return;
    if (tracks ? !tracks.some((x) => x.track === ti) : tr.trackTarget === false) return;
    const R = tr.clips.find((c) => Math.abs(c.start - at) < h);
    const L = tr.clips.find((c) => Math.abs(clipEnd(c) - at) < h);
    if (!R && !L) return;
    if (type === 'cross' && L && R) {
      // jen tolik, kolik dovolí materiál navíc na obou stranách (a půlka délky klipů)
      const hL = mediaDuration(L.mediaId) - L.out, hR = R.in;
      let d = Math.min(dur, 2 * hL, 2 * hR, (L.out - L.in), (R.out - R.in));
      d = Math.floor(d * seq.fps) / seq.fps;
      if (d < 2 * f) { out.noHandles = true; return; }
      if (d < dur - 1e-6) out.shortened++;
      R.vIn = { type: 'cross', dur: d };
      L.vOut = null;
      out.applied++;
      return;
    }
    // prolínačka bez souseda na vyšší stopě (b-roll na V2) = prolnutí do toho, co je ve stopě pod ní – jako Premiere
    // (redaktorka S5: hlásilo „Prolínačka použita“, ale klip se zatmíval do černé)
    if (type === 'cross' && ti > 0) {
      if (R && !L && topBelow(seq, ti, R.start + h)) { R.vIn = { type: 'cross', dur: Math.min(dur, R.out - R.in), under: true }; out.applied++; return; }
      if (L && !R && topBelow(seq, ti, clipEnd(L) - h)) { L.vOut = { type: 'cross', dur: Math.min(dur, L.out - L.in), under: true }; out.applied++; return; }
    }
    const t = type === 'cross' ? 'dipBlack' : type; // prolínačka bez souseda = roztmívání z černé
    if (L && R) {
      const d = Math.min(dur, (L.out - L.in), (R.out - R.in));
      L.vOut = { type: t, dur: d / 2 };
      R.vIn = { type: t, dur: d / 2 };
    } else if (R) R.vIn = { type: t, dur: Math.min(dur, R.out - R.in) };
    else L.vOut = { type: t, dur: Math.min(dur, L.out - L.in) };
    out.applied++;
  });
  return out;
}

/** Nejvyšší viditelný klip na video stopách POD stopou ti v čase t (nebo null). */
function topBelow(seq, ti, t) {
  for (let k = ti - 1; k >= 0; k--) {
    const tr = seq.tracks.video[k];
    if (tr.muted) continue;
    const c = tr.clips.find((x) => !x.disabled && x.start <= t && clipEnd(x) > t);
    if (c) return c;
  }
  return null;
}
/** Oblasti Cross Dissolve na video stopě ti: [{a, b, L, R, d}] – L se prolíná do R. Na střihu (vIn 'cross' se sousedem na stopě,
 *  vystředěné), nebo do/ze stopy pod ní (under: vIn = klip se objeví přes spodní stopu, vOut = klip zmizí do spodní stopy). */
function crossRegionsOf(seq, ti) {
  const track = seq.tracks.video[ti], out = [], h = 0.5 / (seq.fps || 25);
  for (const c of track.clips) {
    if (c.disabled) continue;
    if (c.vIn && c.vIn.type === 'cross') {
      const L = track.clips.find((x) => !x.disabled && Math.abs(clipEnd(x) - c.start) < h);
      const d = c.vIn.dur;
      if (L) out.push({ a: c.start - d / 2, b: c.start + d / 2, L, R: c, d });
      else if (c.vIn.under) { const below = topBelow(seq, ti, c.start + h); if (below) out.push({ a: c.start, b: c.start + d, L: below, R: c, d }); }
    }
    if (c.vOut && c.vOut.type === 'cross' && c.vOut.under) {
      const d = c.vOut.dur, below = topBelow(seq, ti, clipEnd(c) - h);
      if (below) out.push({ a: clipEnd(c) - d, b: clipEnd(c), L: c, R: below, d });
    }
  }
  return out;
}

/** Nejbližší střih (začátek/konec klipu na video stopách) k času t. */
function nearestEdit(seq, t) {
  let best = null, bd = Infinity;
  for (const tr of seq.tracks.video) for (const c of tr.clips) for (const p of [c.start, clipEnd(c)]) {
    const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function removeTransitions(seq, ids) {
  let n = 0;
  for (const id of ids) {
    const f = findClip(seq, id);
    if (!f || f.kind !== 'video') continue;
    if (f.clip.vIn || f.clip.vOut) n++;
    f.clip.vIn = null; f.clip.vOut = null;
    // cross dissolve sedí na pravém klipu – odebrat i u souseda vpravo
    const next = f.trackObj.clips.find((c) => Math.abs(c.start - clipEnd(f.clip)) < half(seq));
    if (next && next.vIn && next.vIn.type === 'cross') { next.vIn = null; n++; }
  }
  return n;
}

/** Track Select Forward (A): všechny klipy začínající v čase ≥ t (jen na jedné stopě, když je zadaná). */
function clipsFrom(seq, t, only) {
  const ids = [];
  eachTrack(seq, (tr, kind, ti) => {
    if (only && !(only.kind === kind && only.track === ti)) return;
    for (const c of tr.clips) if (clipEnd(c) > t + half(seq)) ids.push(c.id);
  });
  return ids;
}

/** Track Select Backward (Shift+A): všechny klipy začínající před časem t. */
function clipsTo(seq, t, only) {
  const ids = [];
  eachTrack(seq, (tr, kind, ti) => {
    if (only && !(only.kind === kind && only.track === ti)) return;
    for (const c of tr.clips) if (c.start < t - half(seq)) ids.push(c.id);
  });
  return ids;
}

function editPoints(seq) {
  const pts = new Set([0]);
  eachTrack(seq, (tr) => tr.clips.forEach((c) => { pts.add(Math.round(c.start * 1000) / 1000); pts.add(Math.round(clipEnd(c) * 1000) / 1000); }));
  return [...pts].sort((a, b) => a - b);
}

function prevEdit(seq, t) {
  const h = half(seq);
  const p = editPoints(seq).filter((x) => x < t - h);
  return p.length ? p[p.length - 1] : 0;
}
function nextEdit(seq, t) {
  const h = half(seq);
  const p = editPoints(seq).filter((x) => x > t + h);
  return p.length ? p[0] : null;
}

/** Q / W v Premiere: ripple trim předchozího / dalšího střihu k playheadu. */
function rippleTrimToPlayhead(seq, t, side) {
  if (side === 'prev') {
    const p = prevEdit(seq, t);
    return extractRange(seq, p, t) >= 0 ? { start: p, end: t } : null;
  }
  const n = nextEdit(seq, t);
  if (n === null) return null;
  extractRange(seq, t, n);
  return { start: t, end: n };
}

/** Odpojí / propojí obraz a zvuk. */
function setLinked(seq, ids, link) {
  const items = ids.map((id) => findClip(seq, id)).filter(Boolean).map((x) => x.clip);
  if (link) { const l = uid('l'); items.forEach((c) => { c.linkId = l; }); } else items.forEach((c) => { c.linkId = null; });
}

/** Krátké prolnutí zvuku na střizích (jako Constant Power na každém střihu). */
function addAudioFades(seq, frames, ids) {
  const d = frames / (seq.fps || 25);
  let n = 0;
  seq.tracks.audio.forEach((tr) => tr.clips.forEach((c) => {
    if (ids && !ids.has(c.id)) return;
    const len = c.out - c.in;
    if (len < 2 * d) return;
    c.fadeIn = d; c.fadeOut = d; n += 2;
  }));
  return n;
}

/** Kam vložit úsek z Přepisu (kolo 5, B1): nikdy doprostřed klipu. Hlava do ±tol od hranice klipů (začátek/konec klipu,
 *  začátek sekvence) → na tu hranici, jinak na konec sekvence. Vrací { at, where: 'playhead' | 'end' }. */
function transcriptInsertPoint(seq, playhead, tol = 0.5) {
  let end = 0;
  const pts = [0];
  eachTrack(seq, (tr) => { for (const c of tr.clips) { pts.push(c.start, clipEnd(c)); end = Math.max(end, clipEnd(c)); } });
  if (end <= 0) return { at: 0, where: 'end' };
  let best = null;
  for (const t of pts) if (Math.abs(t - playhead) <= tol && (best === null || Math.abs(t - playhead) < Math.abs(best - playhead))) best = t;
  if (best !== null && best < end - 1e-6) return { at: best, where: 'playhead' };
  return { at: end, where: 'end' };
}
/** Klipy první slyšitelné zvukové stopy, které ještě nemají titulky (žádný titulek se s nimi nepřekrývá víc než 0,1 s) → [{start, end}]. */
function uncaptionedRanges(seq) {
  const tr = seq.tracks.audio.filter((x) => !x.muted).find((x) => x.clips.length);
  if (!tr) return [];
  const caps = seq.captions || [];
  return tr.clips.filter((c) => !c.disabled).map((c) => ({ start: c.start, end: clipEnd(c) }))
    .filter((r) => !caps.some((k) => Math.min(k.end, r.end) - Math.max(k.start, r.start) > 0.1));
}

module.exports = { relinkAV, audioRuns, rippleCaptions, topBelow, crossRegionsOf,
  fd, snapT, findClip, linked, splitClip, razor, clearRange, placeClip, shiftAfter, insertSpace, extractRange,
  liftRange, removeClips, rippleDeleteGap, editFromSource, moveClips, trimEdge, editPoints, prevEdit, nextEdit,
  rippleTrimToPlayhead, setLinked, addAudioFades, eachTrack, rollEdit, slipClip, clipsFrom,
  applyTransitionAt, nearestEdit, removeTransitions, clipsTo, transcriptInsertPoint, uncaptionedRanges,
};
