'use strict';
// Datový model projektu: média, sekvence (stopy V/A s klipy), značky, titulky, historie Zpět/Znovu.
const { uid, uuid, r3, EPS } = require('./util');

const DEFAULT_V = 3;
const DEFAULT_A = 3;

function newTrack() { return { clips: [], muted: false, locked: false, target: false }; }

function newSequence(opts = {}) {
  const s = {
    id: uuid(),
    name: opts.name || 'Sequence',
    width: opts.width || 1920,
    height: opts.height || 1080,
    fps: opts.fps || 25,
    tracks: { video: [], audio: [] },
    markers: [],
    captions: [],
    inPoint: null,
    outPoint: null,
    playhead: 0,
    zoom: null,
    scroll: 0,
  };
  for (let i = 0; i < (opts.videoTracks || DEFAULT_V); i++) s.tracks.video.push(newTrack());
  for (let i = 0; i < (opts.audioTracks || DEFAULT_A); i++) s.tracks.audio.push(newTrack());
  s.tracks.video[0].target = true;
  s.tracks.audio[0].target = true;
  return s;
}

function clipEnd(c) { return c.start + (c.out - c.in); }
/** „Zopakovaný konec“ klipu (úklid krajů: zbytek cizího záběru na konci sekvence pod řečí): posledních d s obrazu ukáže znovu
 *  předchozích d s zdroje. Vlastnost klipu, ne samostatný klip (redaktorka S10: kopie zůstávala na ose po smazání / zkrácení
 *  klipu). Platí, jen dokud se konec klipu nezměnil (hold.out) – žiletka, ořez, Q/W i posun zdroje ji tím samy zruší. */
function holdOf(c) { return c && c.hold && Math.abs(c.hold.out - c.out) < 1e-6 ? c.hold.d : 0; }
/** Totéž pro začátek (holdIn): prvních d s obrazu ukáže další snímky téhož záběru – zbytek cizího záběru na úplném začátku
 *  sekvence pod řečí (AI tok S11: upoutávka začínala 3 snímky celku). Platí, jen dokud se začátek klipu nezměnil. */
function holdInOf(c) { return c && c.holdIn && Math.abs(c.holdIn.in - c.in) < 1e-6 ? c.holdIn.d : 0; }
/** Čas ve zdroji pro OBRAZ klipu v čase sekvence t (zvuk vždy c.in + (t − c.start)). */
function vSrc(c, t) {
  const h = holdOf(c), hi = holdInOf(c);
  return c.in + (t - c.start) - (h && t >= clipEnd(c) - h - 1e-6 ? h : 0) + (hi && t < c.start + hi - 1e-6 ? hi : 0);
}
function clipDur(c) { return c.out - c.in; }

function seqDuration(seq) {
  let end = 0;
  for (const kind of ['video', 'audio']) {
    for (const t of seq.tracks[kind]) for (const c of t.clips) end = Math.max(end, clipEnd(c));
  }
  for (const c of seq.captions || []) end = Math.max(end, c.end);
  return end;
}

function allClips(seq) {
  const out = [];
  for (const kind of ['video', 'audio']) {
    seq.tracks[kind].forEach((t, ti) => t.clips.forEach((c) => out.push({ clip: c, kind, track: ti })));
  }
  return out;
}

function sortTrack(track) { track.clips.sort((a, b) => a.start - b.start); }

function newClip(media, kind, start, inP, outP, extra = {}) {
  return Object.assign({
    id: uid('c'),
    mediaId: media.id,
    name: media.name,
    kind,
    start, in: inP, out: outP,
    linkId: null,
    gainDb: 0,
    fadeIn: 0,
    fadeOut: 0,
    fit: 'contain',
    scale: 1,
    posX: 0,
    posY: 0,
    disabled: false,
  }, extra);
}

class Project {
  constructor() {
    this.name = 'Untitled';
    this.path = null;
    this.media = [];
    this.sequences = [];
    this.activeSequenceId = null;
    this.openSequenceIds = [];
    // opravy přepisu z titulků: { [mediaId]: [{ s, e, text }] } – úsek zdroje → správný text (součást kroku Zpět)
    this.asrFixes = {};
    this.dirty = false;
    this.history = [];
    this.future = [];
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what, detail) { for (const fn of this.listeners) { try { fn(what, detail); } catch (e) { console.error(e); } } }

  /* ---------- média ---------- */
  mediaById(id) { return this.media.find((m) => m.id === id) || null; }
  mediaByPath(p) {
    const n = String(p || '').replace(/\//g, '\\').toLowerCase();
    return this.media.find((m) => m.path.replace(/\//g, '\\').toLowerCase() === n) || null;
  }
  addMedia(info) {
    const ex = this.mediaByPath(info.path);
    if (ex) { Object.assign(ex, info, { id: ex.id }); this.emit('media'); return ex; }
    const m = Object.assign({ id: uid('m') }, info);
    this.media.push(m);
    this.dirty = true;
    this.emit('media');
    return m;
  }
  removeMedia(id) {
    const used = this.sequences.some((s) => allClips(s).some((x) => x.clip.mediaId === id));
    if (used) throw new Error('The media is used in a sequence – remove its clips first.');
    this.media = this.media.filter((m) => m.id !== id);
    this.dirty = true;
    this.emit('media');
  }

  /* ---------- sekvence ---------- */
  seqById(id) {
    if (id === undefined || id === null || id === '') return this.activeSequence();
    return this.sequences.find((s) => s.id === id || s.name === id) || null;
  }
  activeSequence() { return this.sequences.find((s) => s.id === this.activeSequenceId) || null; }
  addSequence(seq, activate = true) {
    this.sequences.push(seq);
    if (activate) this.openSequence(seq.id);
    this.dirty = true;
    this.emit('sequences');
    return seq;
  }
  openSequence(id) {
    const s = this.seqById(id);
    if (!s) throw new Error('Sequence not found: ' + id);
    this.activeSequenceId = s.id;
    if (!this.openSequenceIds.includes(s.id)) this.openSequenceIds.push(s.id);
    this.emit('active', s);
    return s;
  }
  closeSequence(id) {
    this.openSequenceIds = this.openSequenceIds.filter((x) => x !== id);
    if (this.activeSequenceId === id) this.activeSequenceId = this.openSequenceIds[this.openSequenceIds.length - 1] || null;
    this.emit('active', this.activeSequence());
  }
  deleteSequence(id) {
    const s = this.seqById(id);
    if (!s) return false;
    this.sequences = this.sequences.filter((x) => x !== s);
    this.openSequenceIds = this.openSequenceIds.filter((x) => x !== s.id);
    if (this.activeSequenceId === s.id) this.activeSequenceId = this.openSequenceIds[this.openSequenceIds.length - 1] || null;
    this.dirty = true;
    this.emit('sequences');
    this.emit('active', this.activeSequence());
    return true;
  }
  uniqueSeqName(base) {
    let n = base, i = 2;
    while (this.sequences.some((s) => s.name === n)) n = `${base} ${i++}`;
    return n;
  }

  /* ---------- Zpět / Znovu (snímek stavu sekvencí) ---------- */
  snapshot() {
    return JSON.stringify({ sequences: this.sequences, activeSequenceId: this.activeSequenceId, openSequenceIds: this.openSequenceIds, asrFixes: this.asrFixes });
  }
  checkpoint(label) {
    this.history.push({ label, state: this.snapshot() });
    if (this.history.length > 200) this.history.shift();
    this.future = [];
    this.dirty = true;
  }
  /** Jedna úprava = jeden krok Zpět. fn mění projekt; při výjimce se stav vrátí. */
  edit(label, fn) {
    const before = this.snapshot();
    try {
      const r = fn();
      if (this.snapshot() !== before) {
        this.history.push({ label, state: before });
        if (this.history.length > 200) this.history.shift();
        this.future = [];
        this.dirty = true;
        this.emit('edit', label);
      }
      return r;
    } catch (e) {
      this.restore(before);
      throw e;
    }
  }
  restore(state) {
    const s = JSON.parse(state);
    this.sequences = s.sequences;
    this.activeSequenceId = s.activeSequenceId;
    this.openSequenceIds = s.openSequenceIds || (s.activeSequenceId ? [s.activeSequenceId] : []);
    this.asrFixes = s.asrFixes || {};
  }
  undo() {
    const h = this.history.pop();
    if (!h) return null;
    this.future.push({ label: h.label, state: this.snapshot() });
    this.restore(h.state);
    this.dirty = true;
    this.emit('sequences');
    this.emit('edit', 'undo');
    return h.label;
  }
  redo() {
    const f = this.future.pop();
    if (!f) return null;
    this.history.push({ label: f.label, state: this.snapshot() });
    this.restore(f.state);
    this.dirty = true;
    this.emit('sequences');
    this.emit('edit', 'redo');
    return f.label;
  }

  /* ---------- uložení ---------- */
  toJSON() {
    return {
      app: 'PZ AI Cut Standalone', version: 1, name: this.name,
      media: this.media.map((m) => ({ ...m, proxyJob: undefined })),
      sequences: this.sequences, activeSequenceId: this.activeSequenceId, openSequenceIds: this.openSequenceIds,
      asrFixes: this.asrFixes,
    };
  }
  load(data, filePath) {
    // projekt z disku může přijít z cizí ruky – vyčistit (bezpečnost S12: podvržený .pzcut spustil kód přes HTML)
    data = require('./sanitize').sanitizeProject(data);
    this.name = (data.name && data.name !== 'Bez názvu') ? data.name : 'Untitled';
    this.path = filePath || null;
    this.media = data.media || [];
    this.sequences = data.sequences || [];
    for (const s of this.sequences) {
      s.markers = s.markers || [];
      s.captions = s.captions || [];
    }
    this.activeSequenceId = data.activeSequenceId || (this.sequences[0] && this.sequences[0].id) || null;
    this.openSequenceIds = data.openSequenceIds || (this.activeSequenceId ? [this.activeSequenceId] : []);
    this.asrFixes = data.asrFixes || {};
    this.history = [];
    this.future = [];
    this.dirty = false;
    this.emit('media');
    this.emit('sequences');
    this.emit('active', this.activeSequence());
  }
}

module.exports = { Project, newSequence, newTrack, newClip, clipEnd, holdOf, holdInOf, vSrc, clipDur, seqDuration, allClips, sortTrack, r3, EPS };
