'use strict';
// TN Střihátko – hlavní okno: spojuje model, monitory, timeline, projekt, klávesové zkratky (jako Premiere),
// ukládání, export a most pro AI panel (MCP server MY Premiere MCP).
const CL = require('./core/captionlayout');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const { Project, newSequence, clipEnd, seqDuration } = require('./core/model');
const E = require('./core/edit');
const U = require('./core/util');
const media = require('./core/media');
const importer = require('./core/importer');
const exporter = require('./core/exporter');
const { createApi } = require('./core/pmcp-api');
const { createTimeline } = require('./ui/timeline');
const { createProgram, createSource } = require('./ui/monitors');
const { createProjectPanel } = require('./ui/project-panel');
const BRAND = require('./core/brand');
const i18n = require('./i18n-app');

const $ = (id) => document.getElementById(id);
const cfg = media.cfg;
// AI část (MY Premiere MCP: přepis, Hermes, Claude) – přenosný zip z Releases ji nemá (S14 Nováček: aplikace slibovala
// AI panel, Přepis i titulky z přepisu, které bez ní nejdou)
const AI_OK = media.WEB || !!(cfg.aiRoot && fs.existsSync(path.join(cfg.aiRoot, 'server', 'index.js')));
window.__pzAiOk = AI_OK;
const AI_HELP_URL = 'https://github.com/petroza/AI-EDIT-for-all-#readme';
const SETTINGS_DIR = path.join(process.env.APPDATA || media.APP_ROOT, 'TN_strihatoko');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');
const AUTOSAVE = path.join(SETTINGS_DIR, 'autosave.tnproj');
fs.mkdirSync(SETTINGS_DIR, { recursive: true });
let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { settings = {}; }
const saveSettings = () => { try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 1)); } catch (e) {} };

const project = new Project();

/* ======================================================================= app */
const app = {
  project,
  sel: new Set(),
  gapSel: null,
  tool: 'select',
  snap: true,
  linkedSel: true,
  focus: 'timeline',
  waves: new Map(),
  clipboard: null,
  seq: () => project.activeSequence(),
  seqDuration,
  snapToFrame(t) { const s = app.seq(); return s ? E.snapT(s, t) : t; },

  status(msg, err) { const el = $('status'); el.textContent = msg || 'Ready'; el.classList.toggle('err', !!err); },
  toast(msg, err) {
    // důležitá hláška (obnovené změny) drží 9 s – další počká, až dočte (vzhled S7: přepsala ji hláška o offline médiu)
    if (app._toastHold > Date.now()) { const w = app._toastHold - Date.now() + 100; setTimeout(() => app.toast(msg, err), w); return; }
    if (/^Recovered|^Obnoven/.test(String(msg))) app._toastHold = Date.now() + 9000;
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(app._toastT);
    app._toastT = setTimeout(() => { el.className = 'toast'; }, err ? 6000 : /Recovered|Obnoven/.test(msg) ? 9000 : 2600);
  },

  /** Úprava s krokem Zpět; chyby jako hláška. */
  edit(label, fn) {
    try {
      const r = project.edit(label, fn);
      app.afterEdit();
      return r;
    } catch (e) { app.toast(e.message, true); app.afterEdit(); return null; }
  },
  afterEdit() {
    // vybrané klipy, které už neexistují, z výběru pryč
    const s = app.seq();
    if (s) { const ids = new Set(); E.eachTrack(s, (t) => t.clips.forEach((c) => ids.add(c.id))); for (const id of [...app.sel]) if (!ids.has(id)) app.sel.delete(id); }
    app.timeline.render();
    app.program.refresh();
    app.projectPanel.render();
    updateTitle();
  },
  selectionChanged() {},

  focusPanel(name) {
    app.focus = name;
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('focus', p.dataset.panel === name));
  },

  setPlayhead(t, opts = {}) {
    const s = app.seq();
    if (!s) return;
    s.playhead = Math.max(0, E.snapT(s, t));
    if (opts.scrub && app.program.playing) app.program.pause();
    app.program.player.seek(s.playhead, true);
    if (!opts.noFollow) app.timeline.setPlayheadView(s.playhead, true);
  },
  scrubEnd() {},

  openSequence(id) {
    project.openSequence(id);
  },
  openSource(m, opts) { require('./ui/captionstyle').captionStyleToSource(); app.source.open(m, opts || {}); if (app.transcript) app.transcript.onSourceOpen(m); },
  newSequenceDialog(m, put) { seqDialog(null, { media: m, put }); },

  updatePlayButtons() {
    const I = require('./ui/icons');
    document.querySelectorAll('#sourcePanel .play').forEach((b) => { b.innerHTML = app.source.playing ? I.stop : I.play; });
    document.querySelectorAll('#programPanel .play').forEach((b) => { b.innerHTML = app.program.playing ? I.stop : I.play; });
  },

  loadWave(mediaId) {
    if (app.waves.has(mediaId) || app._waveLoading.has(mediaId)) return;
    const m = project.mediaById(mediaId);
    if (!m || !m.hasAudio || m.missing) return;
    app._waveLoading.add(mediaId);
    media.waveform(m.path).then((w) => { app.waves.set(mediaId, w); app.timeline.render(); })
      .catch((e) => console.warn('waveform', e.message)).finally(() => app._waveLoading.delete(mediaId));
  },
  _waveLoading: new Set(),

  async importPaths(paths) {
    // média přesunutá / přejmenovaná za běhu označit jako offline – import z nového místa je pak znovu připojí (pád a obnova S12)
    if (!media.WEB) for (const m of project.media) if (!m.missing && m.path && !fs.existsSync(m.path)) m.missing = true;
    const out = [], bad = [];
    for (const p of paths) {
      app.status('Importing: ' + U.baseName(p));
      try {
        const m = await importer.importPath(project, p);
        out.push(m);
        loadThumb(m);
        app.loadWave(m.id);
      } catch (e) {
        // srozumitelně místo surové chyby ffprobe („moov atom not found“) a všechny vadné soubory v jedné zprávě (vzhled S3)
        const raw = String(e && e.message || e);
        const why = /^File not found/i.test(raw) ? 'file not found' : /exited with code|moov atom|Invalid data|could not find codec|no such file/i.test(raw) ? 'damaged or unsupported file' : raw;
        bad.push(`${U.baseName(p)} (${why})`); out.push({ error: raw });
      }
    }
    if (bad.length) app.toast(`Cannot import: ${bad.join(', ')}`, true);
    // nově importovaný soubor se stejnou délkou a rozměry jako chybějící médium = ten samý záznam na novém místě:
    // klipy sekvencí (a opravy přepisu) se převedou na něj, chybějící položka zmizí
    const relinked = [];
    for (const nm of out) {
      if (!nm || nm.error || nm.missing) continue;
      // zvuk bez obrazu (rozměry 0×0) jen se stejným názvem; víc kandidátů = nehádat (revize #19)
      const cands = project.media.filter((x) => x !== nm && x.missing && Math.abs((x.duration || 0) - (nm.duration || 0)) < 0.06
        && (x.width || 0) === (nm.width || 0) && (x.height || 0) === (nm.height || 0) && !!x.hasAudio === !!nm.hasAudio
        && (nm.hasVideo || U.baseName(x.path).toLowerCase() === U.baseName(nm.path).toLowerCase()));
      if (cands.length !== 1) continue;
      const old = cands[0];
      // jako Link Media v Premiere: chybějící položka se přesměruje na nový soubor (id, klipy i opravy přepisu zůstanou),
      // duplicitní nová položka zmizí – Zpět pak nemá co rozbít (revize #2: klipy ukazovaly na smazané médium)
      const keep = { id: old.id };
      Object.assign(old, nm, keep, { missing: false });
      project.media = project.media.filter((x) => x !== nm);
      loadThumb(old); app.loadWave(old.id);
      relinked.push(old.name);
    }
    if (relinked.length) project.emit('media');
    if (relinked.length) {
      app.toast(`Media relinked: ${relinked.join(', ')}`); app.timeline.render(); app.program.refresh(); app.projectPanel.render();
      if (app.source.media) app.source.open(app.source.media); // monitor Zdroj načte nový soubor (vzhled S7: dál „Médium offline“)
    }
    app.status(`Imported: ${out.filter((x) => !x.error).length}`);
    app.projectPanel.render();
    return out;
  },

  /** Klip z Projektu / Zdroje na timeline (bez sekvence ji vytvoří podle klipu). */
  dropMedia(m, inP, outP, at, insert, targets) {
    if (!m) return;
    let s = app.seq();
    const wasEmpty = !s || seqDuration(s) < 0.01;
    app.edit(insert ? 'Insert' : 'Overwrite', () => {
      if (!s) {
        s = newSequence({ name: project.uniqueSeqName(U.stripExt(m.name)), width: m.hasVideo ? m.width : 1920, height: m.hasVideo ? m.height : 1080, fps: m.hasVideo ? m.fps : 25 });
        project.addSequence(s);
        at = 0;
      }
      const placed = E.editFromSource(s, m, inP, outP, Math.max(0, at), insert ? 'insert' : 'overwrite', targets || {});
      app.sel = new Set(placed.map((c) => c.id));
    });
    if (s && (!s.zoom || wasEmpty)) app.timeline.zoomFit();
    if (s && wasEmpty) { if (!app._transcriptInsert) autoFace(s, m); }
    // b-roll vložený do V2+ přes jiný obraz: zbytek cizího záběru na jeho kraji odstřihnout hned (kontrolor S6), Ctrl+Z vrátí
    else if (s && m.hasVideo && !app._transcriptInsert && s.height > s.width && m.width / m.height > s.width / s.height + 0.02 && window.__pzReframeHere) {
      // širší záběr vložený do sekvence na výšku (b-roll přetažením): výřez podle obličeje jen pro vložené klipy (kontrolor S8)
      const fs = [...app.sel].map((id) => E.findClip(s, id)).filter((f) => f && f.kind === 'video');
      const ids = new Set(fs.map((f) => f.clip.id));
      if (ids.size) {
        // úsek vložení (výřez klip rozdělí na střihu kamery – nové klipy se pak najdou podle času, ne podle id)
        const span = fs.map((f) => ({ track: f.track, a: f.clip.start, b: f.clip.start + (f.clip.out - f.clip.in) }));
        const merge = reframeMerger(); // jedno Ctrl+Z vrátí vložení i výřez
        window.__pzReframeHere(s, ids).then(() => { merge(); app.program.refresh(); edgeCleanup(s, span, true); }).catch(() => merge());
      }
    } else if (s && m.hasVideo && window.__pzEdgeShots) {
      const fs = [...app.sel].map((id) => E.findClip(s, id)).filter((f) => f && f.kind === 'video' && f.track > 0);
      edgeCleanup(s, fs.map((f) => ({ track: f.track, a: f.clip.start, b: f.clip.start + (f.clip.out - f.clip.in) })));
    }
  },

  /** Vložení vybraného úseku z Přepisu (kolo 5, B1): jen na hranici klipů – hlava u hranice (±0,5 s) → tam, jinak na konec
   *  sekvence. Titulky za místem vložení se posunou s klipy (shiftAfter), rozříznutí klipu nenastane. newSeq = vždy nová sekvence. */
  editCore: E,
  insertFromTranscript(mode) {
    const m = app.source.media;
    if (!m) return null;
    const s = app.seq();
    if (!s || mode === 'new' || mode === true) { app.newSequenceDialog(m, true); return null; }
    const a = m.srcIn ?? 0, b = m.srcOut ?? m.duration;
    let p = E.transcriptInsertPoint(s, s.playhead);
    // výslovná volba z menu ▾ (design-4 §1.2): na konec / na začátek; na hlavu jen když stojí na hranici
    if (mode === 'start') p = { at: 0, where: 'start' };
    if (mode === 'end') { let end = 0; for (const k of ['video', 'audio']) for (const tr of s.tracks[k]) for (const c of tr.clips) end = Math.max(end, c.start + (c.out - c.in)); p = { at: end, where: 'end' }; }
    const before = new Set(s.tracks.video.flatMap((tr) => tr.clips.map((c) => c.id)));
    app._transcriptInsert = true; // výřez podle obličeje si řeší vkládání z Přepisu samo (níž), dropMedia ho nespouští
    try { app.dropMedia(m, a, b, p.at, true, {}); } finally { app._transcriptInsert = false; }
    app.setPlayhead(p.at + (b - a));
    // sekvence na výšku (9:16, 4:5, 1:1) ze širšího záběru: přidaný úsek dostane výřez podle obličeje jako zbytek (kolo 8 –
    // „Přidat na konec“ ve 4:5 nechal středový výřez s prázdným celkem); jinak jen úklid zbytků záběru na krajích
    const added = new Set(s.tracks.video.flatMap((tr) => tr.clips.map((c) => c.id)).filter((id) => !before.has(id)));
    if (added.size && m.hasVideo && m.width / m.height > s.width / s.height + 0.02 && window.__pzReframeHere) {
      app.status(LL('Crop follows the face…', 'Výřez podle obličeje…'));
      // výřez je součást vložení: jeho kroky Zpět sloučit s vložením (jedno Ctrl+Z vrátí obojí – B1 undoInsert)
      const merge = reframeMerger();
      const span = [...added].map((id) => E.findClip(s, id)).filter(Boolean).map((f) => ({ track: f.track, a: f.clip.start, b: f.clip.start + (f.clip.out - f.clip.in) }));
      window.__pzReframeHere(s, added).then(() => { merge(); app.status(''); app.program.refresh(); edgeCleanup(s, span, true); }).catch(() => { merge(); app.status(''); });
    }
    app.status(p.where === 'end' ? LL('Added at the end of the sequence', 'Přidáno na konec sekvence') : LL('Inserted at the playhead', 'Vloženo na místo hlavy'));
    return Object.assign(p, { dur: b - a, seqId: s.id });
  },
  /** Sekvence přetažená z Projektu na timeline: její klipy se vloží (přepíšou / s Ctrl odsunou) od místa puštění. */
  dropSequence(srcId, at, insert) {
    const src = project.sequences.find((q) => q.id === srcId);
    const s = app.seq();
    if (!src) return;
    if (!s) { app.openSequence(src.id); return; }
    if (src === s) { app.toast('A sequence cannot be placed into itself.', true); return; }
    const dur = seqDuration(src);
    if (dur <= 0) return;
    app.edit(insert ? 'Insert Sequence' : 'Overwrite Sequence', () => {
      if (insert) E.insertSpace(s, at, dur);
      const lm = new Map(), ids = [];
      for (const kind of ['video', 'audio']) {
        src.tracks[kind].forEach((tr, ti) => {
          for (const c0 of tr.clips) {
            const c = JSON.parse(JSON.stringify(c0));
            c.id = U.uid('c'); c.start = E.snapT(s, at + c0.start);
            if (c.linkId) { if (!lm.has(c.linkId)) lm.set(c.linkId, U.uid('l')); c.linkId = lm.get(c.linkId); }
            while (s.tracks[kind].length <= ti) s.tracks[kind].push({ clips: [], muted: false, locked: false, target: false });
            E.placeClip(s, kind, ti, c);
            ids.push(c.id);
          }
        });
      }
      app.sel = new Set(ids);
    });
    app.status(`Placed “${src.name}” (${U.timecode(dur, s.fps)})`);
  },

  contextMenu(x, y, kind) { showContextMenu(x, y, kind); },
  /** Jednoduché menu na pozici: items = [[text, fn|null], '-', …] (null = nadpis bez akce). */
  popupMenu(x, y, items) {
    const ctx = $('ctxMenu');
    ctx.innerHTML = '';
    for (const it of items) {
      if (it === '-') { ctx.appendChild(document.createElement('hr')); continue; }
      const d = document.createElement('div');
      d.innerHTML = '<span></span><span class="k"></span>';
      d.firstChild.textContent = it[0];
      if (!it[1]) d.classList.add('dis'); else d.onclick = () => { hideContextMenu(); try { it[1](); } catch (e) { app.toast(e.message, true); } };
      ctx.appendChild(d);
    }
    ctx.style.display = 'block';
    menuA11y(ctx);
    const r = ctx.getBoundingClientRect();
    ctx.style.left = Math.min(x, window.innerWidth - r.width - 4) + 'px';
    ctx.style.top = Math.min(y, window.innerHeight - r.height - 4) + 'px';
  },
  cmd(name, arg) { runCmd(name, arg); },
};

app.timeline = createTimeline(app);
app.program = createProgram(app);
// titulek upravený přímo v obraze: zalomí se podle stylu a šířky obrazu, jeden krok Zpět
app.program.player.onTitleClick = () => require('./ui/captionstyle').openCaptionStyle(app, true);
app.program.player.onCaptionEdit = (i, text) => { app.saveCaption(i, text); };
/** Smazat titulek i (jen titulek – obraz ani zvuk ne), jeden krok Zpět. */
app.deleteCaption = (i, quiet) => {
  const s = app.seq();
  if (!s || !s.captions[i]) return false;
  app.edit('Delete Caption', () => { s.captions.splice(i, 1); });
  app.program.refresh(); app.timeline.render();
  if (!quiet) app.toast(TN.lang === 'cs' ? 'Titulek smazán · Vrátíš Ctrl+Z' : 'Caption deleted · Undo with Ctrl+Z');
  return true;
};
/**
 * Uloží text titulku i (z náhledu i ze seznamu Titulky): delší text se rozdělí na víc titulků (CL.retext) a oprava se
 * zapíše i do přepisu zdroje (project.asrFixes) – vše jeden krok Zpět. Vrací { parts, propagated } nebo null (beze změny).
 */
app.saveCaption = (i, text) => {
  const s = app.seq();
  const c = s && s.captions[i];
  if (!c) return null;
  const norm = (x) => String(x).replace(/\s+/g, ' ').trim();
  if (!norm(text)) { app.deleteCaption(i); return { deleted: true }; } // prázdný text = smazat titulek (redaktor-3: „stalo.“)
  text = CL.czQuotes(text);
  if (norm(text) === norm(c.text)) return null;
  // úsek zdroje pod titulkem (jen když titulek leží celý v jednom klipu se zvukem)
  let fix = null;
  if (window.__pzASR) {
    const tr = s.tracks.audio.filter((x) => !x.muted).find((x) => x.clips.length);
    const cl = tr && tr.clips.find((k) => !k.disabled && k.start <= c.start + 0.02 && k.start + (k.out - k.in) >= c.end - 0.02);
    if (cl) {
      // úsek podle textu původního titulku v přepisu (časy titulků jsou srovnané podle zvuku, přepis ne)
      const sp = window.__pzASR.fixSpan(project.mediaById(cl.mediaId), cl.in + (c.start - cl.start), cl.in + (c.end - cl.start), c.text);
      if (sp) fix = { mediaId: cl.mediaId, s: sp.s, e: sp.e, text: norm(text) };
      // titulky z přesného přepisu úseků (notebook): text ve standardním přepisu nemusí sedět → oprava podle času titulku,
      // ať platí při dalším vytvoření titulků i v Přepisu (design-4 §2.4 – patička nesmí lhát)
      else if (s.captionsPrecise) fix = { mediaId: cl.mediaId, s: cl.in + (c.start - cl.start), e: cl.in + (c.end - cl.start), text: norm(text) };
    }
  }
  let parts = 1;
  app.edit('Edit Caption', () => {
    const nc = CL.retext(s, c, text);
    parts = nc.length;
    s.captions.splice(i, 1, ...nc);
    if (fix) {
      const all = Object.assign({}, project.asrFixes || {});
      const list = (all[fix.mediaId] || []).filter((f) => Math.min(f.e, fix.e) - Math.max(f.s, fix.s) <= 0.5 * Math.min(f.e - f.s, fix.e - fix.s));
      list.push({ s: fix.s, e: fix.e, text: fix.text });
      all[fix.mediaId] = list.sort((a, b) => a.s - b.s);
      project.asrFixes = all;
    }
  });
  app.program.refresh();
  return { parts, propagated: !!fix };
};
/** Psaní do titulku i: přehrávací hlava na titulek a kurzor do textu v programovém monitoru. */
app.editCaption = (i) => {
  const s = app.seq();
  const c = s && s.captions[i];
  if (!c) return;
  app.setPlayhead(c.start + Math.min(0.05, (c.end - c.start) / 2));
  // hned (ne až za chvíli): rychle napsaná písmena by jinak šla jako zkratky (L = přehrát, A = nástroj…) a oprava by se ztratila
  app.program.player.editCaption(i);
};
app.source = createSource(app);
app.projectPanel = createProjectPanel(app);
app.captionList = require('./ui/caption-list').createCaptionList(app);
app.transcript = require('./ui/transcript-panel').createTranscriptPanel(app);

/* ======================================================= náhledy, proxy, události */
/** Náhled klipu na časové ose ze začátku klipu, ne první snímek souboru (redaktorka S7: u 28min rozhovoru všude znělka TALK). */
const clipThumbs = new Map(); // médium@čas -> url | 'pending'
app.clipThumb = (c, m) => {
  if (media.WEB || !m || m.missing || !m.hasVideo) return m && m.thumbUrl;
  const t = Math.round((c.in + Math.min(1, (c.out - c.in) / 3)) * 2) / 2;
  const k = m.id + '@' + t, v = clipThumbs.get(k);
  if (v && v !== 'pending') return v;
  if (!v) {
    clipThumbs.set(k, 'pending');
    media.thumbnail(m.path, t, 144).then((f) => { clipThumbs.set(k, pathToFileURL(f).href); clearTimeout(app._thumbT); app._thumbT = setTimeout(() => app.timeline.render(), 150); })
      .catch(() => clipThumbs.set(k, m.thumbUrl || ''));
  }
  return m.thumbUrl;
};
function loadThumb(m) {
  if (!m.hasVideo || m.missing) return;
  if (m.thumb && fs.existsSync(m.thumb)) { m.thumbUrl = pathToFileURL(m.thumb).href; return; }
  media.thumbnail(m.path, Math.min(2, (m.duration || 1) * 0.1)).then((f) => {
    m.thumb = f; m.thumbUrl = pathToFileURL(f).href; app.projectPanel.render(); app.timeline.render();
  }).catch(() => {});
}

let refreshT = null;
project.on((what, detail) => {
  if (what === 'proxy') {
    clearTimeout(refreshT);
    refreshT = setTimeout(() => { app.projectPanel.render(); if (detail && app.source.media === detail) app.source.refreshMedia(); if (detail && detail.proxy) app.program.refresh(); }, 300);
    return;
  }
  if (what === 'active') {
    // otevřený panel Text v obraze patří k nové sekvenci (kolo 8: ukazoval název a hodnoty předchozí, dokud se nepsalo)
    try { require('./ui/captionstyle').relangCaptionStyle(app); } catch (e) { /* bez panelu */ }
    app.sel.clear();
    app.gapSel = null;
    app.program.reset();
    app.timeline.restoreView();
    renderTabs();
    app.projectPanel.render();
    updateTitle();
    return;
  }
  if (what === 'playhead') { const s = app.seq(); if (s && detail === s) app.setPlayhead(s.playhead); return; }
  if (what === 'media') {
    // média znovu dostupná (relink, webová verze po povolení přístupu): doplnit náhledy a průběh zvuku
    for (const m of project.media) if (!m.missing) { if (!m.thumbUrl) loadThumb(m); app.loadWave(m.id); }
  }
  if (what === 'sequences' || what === 'media' || what === 'edit') {
    clearTimeout(app._evT);
    app._evT = setTimeout(() => { renderTabs(); app.afterEdit(); }, 30);
  }
});

const escH = require('./core/sanitize').esc; // escapování do HTML (bezpečnost S12)
function renderTabs() {
  try { require('./ui/captionstyle').syncTab(app); } catch (e) { /* bez rámu Zdroje */ }
  const el = $('seqTabs');
  el.innerHTML = project.openSequenceIds.map((id) => project.sequences.find((s) => s.id === id)).filter(Boolean).map((s) =>
    `<div class="seq-tab${s.id === project.activeSequenceId ? ' on' : ''}" data-id="${escH(s.id)}" title="${escH(s.name)}"><span>${escH(s.name)}</span><b class="x" data-close="${escH(s.id)}">×</b></div>`).join('');
}
$('seqTabs').addEventListener('mousedown', (ev) => {
  const x = ev.target.closest('[data-close]');
  if (x) { project.closeSequence(x.dataset.close); renderTabs(); return; }
  const t = ev.target.closest('.seq-tab');
  if (t) project.openSequence(t.dataset.id);
});

function updateTitle() {
  const n = (project.path ? U.baseName(project.path) : project.name) + (project.dirty ? ' *' : '');
  $('projName').textContent = n;
  if ($('projName2')) $('projName2').textContent = project.path ? U.baseName(project.path) : project.name;
  if ($('projPath')) $('projPath').textContent = project.path ? U.baseName(project.path) : projBaseName() + '.' + BRAND.PROJECT_EXT;
  ipcRenderer.send('setTitle', `${BRAND.APP_NAME} – ${n}`);
}

/* ======================================================= transport tlačítka */
document.querySelectorAll('.transport button').forEach((b) => {
  b.addEventListener('click', () => {
    const panel = b.closest('.panel').dataset.panel;
    app.focusPanel(panel);
    runCmd(b.dataset.act);
  });
});
document.querySelectorAll('.panel').forEach((p) => p.addEventListener('mousedown', () => app.focusPanel(p.dataset.panel), true));

/* ======================================================= příkazy */
function mon() { return app.focus === 'source' ? app.source : app.program; }
function curTime() { return app.focus === 'source' ? app.source.time : ((app.seq() || {}).playhead || 0); }
function fpsNow() { return app.focus === 'source' ? ((app.source.media || {}).fps || 25) : ((app.seq() || {}).fps || 25); }
function seekNow(t) {
  if (app.focus === 'source') { if (app.source.media) { app.source.pause(); app.source.seek(Math.max(0, Math.min(t, app.source.media.duration))); } }
  else app.setPlayhead(t, { scrub: true });
}
let shuttle = 0;

const commands = {
  play() { shuttle = 0; mon().toggle(); },
  shuttleL() { shuttle = shuttle <= 0 ? 1 : Math.min(8, shuttle * 2); mon().play(shuttle); },
  shuttleJ() { shuttle = shuttle >= 0 ? -1 : Math.max(-8, shuttle * 2); mon().play(shuttle); },
  shuttleK() { shuttle = 0; mon().pause(); },
  stepBack(n = 1) { mon().pause(); seekNow(curTime() - n / fpsNow()); },
  stepFwd(n = 1) { mon().pause(); seekNow(curTime() + n / fpsNow()); },
  gotoStart() { seekNow(0); },
  gotoEnd() { seekNow(app.focus === 'source' ? ((app.source.media || {}).duration || 0) : seqDuration(app.seq() || newSequence())); },
  prevEdit() { const s = app.seq(); if (s) { app.focusPanel(app.focus === 'source' ? 'program' : app.focus); app.setPlayhead(E.prevEdit(s, s.playhead), { scrub: true }); } },
  nextEdit() { const s = app.seq(); if (s) { const n = E.nextEdit(s, s.playhead); if (n !== null) app.setPlayhead(n, { scrub: true }); } },
  markIn() {
    if (app.focus === 'source') { const m = app.source.media; if (m) { m.srcIn = app.source.time; if (m.srcOut !== undefined && m.srcOut !== null && m.srcOut <= m.srcIn) m.srcOut = null; app.source.ui(); } return; }
    const s = app.seq(); if (!s) return; s.inPoint = s.playhead; if (s.outPoint !== null && s.outPoint <= s.inPoint) s.outPoint = null; project.dirty = true; app.program.ui(); app.timeline.drawRuler();
  },
  markOut() {
    if (app.focus === 'source') { const m = app.source.media; if (m) { m.srcOut = app.source.time + 1 / (m.fps || 25); if (m.srcIn !== undefined && m.srcIn !== null && m.srcIn >= m.srcOut) m.srcIn = null; app.source.ui(); } return; }
    const s = app.seq(); if (!s) return; s.outPoint = E.snapT(s, s.playhead + 1 / s.fps); if (s.inPoint !== null && s.inPoint >= s.outPoint) s.inPoint = null; project.dirty = true; app.program.ui(); app.timeline.drawRuler();
  },
  clearIn() { if (app.focus === 'source') { const m = app.source.media; if (m) { m.srcIn = null; app.source.ui(); } } else { const s = app.seq(); if (s) { s.inPoint = null; app.program.ui(); app.timeline.drawRuler(); } } },
  clearOut() { if (app.focus === 'source') { const m = app.source.media; if (m) { m.srcOut = null; app.source.ui(); } } else { const s = app.seq(); if (s) { s.outPoint = null; app.program.ui(); app.timeline.drawRuler(); } } },
  clearInOut() { commands.clearIn(); commands.clearOut(); },
  gotoIn() { if (app.focus === 'source') { const m = app.source.media; if (m && m.srcIn !== null && m.srcIn !== undefined) seekNow(m.srcIn); } else { const s = app.seq(); if (s && s.inPoint !== null) seekNow(s.inPoint); } },
  gotoOut() { if (app.focus === 'source') { const m = app.source.media; if (m && m.srcOut !== null && m.srcOut !== undefined) seekNow(m.srcOut - 1 / (m.fps || 25)); } else { const s = app.seq(); if (s && s.outPoint !== null) seekNow(s.outPoint - 1 / s.fps); } },

  insert() { sourceEdit('insert'); },
  overwrite() { sourceEdit('overwrite'); },
  lift() { inOutEdit(false); },
  extract() { inOutEdit(true); },
  rippleTrimPrev() { const s = app.seq(); if (!s) return; const p = E.prevEdit(s, s.playhead); app.edit('Ripple trim (Q)', () => E.rippleTrimToPlayhead(s, s.playhead, 'prev')); app.setPlayhead(p); },
  rippleTrimNext() { const s = app.seq(); if (!s) return; app.edit('Ripple trim (W)', () => E.rippleTrimToPlayhead(s, s.playhead, 'next')); },
  addEdit() {
    const s = app.seq(); if (!s) return;
    if (app.sel.size) {
      app.edit('Add Edit', () => { const lm = new Map(); for (const id of app.sel) { const f = E.findClip(s, id); if (f) E.splitClip(s, f.trackObj, f.clip, E.snapT(s, s.playhead), lm); } });
    } else {
      // jako Premiere: Ctrl+K řeže cílové stopy (Track Targeting v hlavičce stopy)
      const tracks = [];
      E.eachTrack(s, (t, kind, ti) => { if (t.trackTarget !== false) tracks.push({ kind, track: ti }); });
      app.edit('Add Edit', () => E.razor(s, s.playhead, tracks));
    }
    app.warnMidWord(s, s.playhead);
  },
  /** Střih (žiletka) uprostřed slova podle přepisu → upozornit, ať se posune do pauzy (jako varování In/Out ve Zdroji). */
  warnMidWord(s, t) {
    const a = window.__pzASR;
    if (!a || !s) return;
    for (const tr of s.tracks.audio) {
      if (tr.muted) continue;
      // konec klipu na t (žiletka, ořez konce) i začátek klipu na t (ripple trim začátku, redaktorka S8: „zajímavým“)
      for (const [c, src] of tr.clips.filter((x) => !x.disabled).flatMap((x) => [[x, x.out, x.start + (x.out - x.in)], [x, x.in, x.start]]).filter(([, , at]) => Math.abs(at - t) < 0.02).map(([x, sv]) => [x, sv])) {
        const m = project.mediaById(c.mediaId);
        const tx = m && a.get(m);
        const w = tx && tx.words && tx.words.find((x) => x.s + 0.04 < src && x.e - 0.04 > src);
        if (w) { app.toast(`The cut is in the middle of the word “${String(w.w).replace(/[.,!?…]+$/, '')}” – move it into a pause (Q / W, or drag the edit).`, true); return; }
      }
    }
  },
  addEditAll() { const s = app.seq(); if (s) { app.edit('Add Edit to All Tracks', () => E.razor(s, s.playhead)); app.warnMidWord(s, s.playhead); } },
  delete() {
    const s = app.seq(); if (!s) return;
    if (app.transSel) {
      const ts = app.transSel; app.transSel = null;
      app.edit('Clear Transition', () => { const f = E.findClip(s, ts.clipId); if (f) f.clip[ts.side] = null; });
      return;
    }
    if (app.gapSel) { const g = app.gapSel; app.gapSel = null; app.edit('Ripple Delete Gap', () => { if (!E.rippleDeleteGap(s, g.kind, g.ti, g.t)) throw new Error('The gap cannot be closed – another track has media in it.'); }); return; }
    if (app.sel.size) app.edit('Clear', () => E.removeClips(s, [...app.sel], false));
  },
  rippleDelete() {
    const s = app.seq(); if (!s) return;
    if (app.gapSel) return commands.delete();
    if (app.sel.size) {
      app.edit('Ripple Delete', () => E.removeClips(s, [...app.sel], true));
      if (E.removeClips.blocked) app.toast('The gap stays open: another clip lies across it (B-roll, music). To remove the part from all tracks use Extract (I and O around it, then the apostrophe key).', true);
    }
  },
  selectAll() { const s = app.seq(); if (!s) return; E.eachTrack(s, (t) => t.clips.forEach((c) => app.sel.add(c.id))); app.timeline.render(); },
  deselect() { app.sel.clear(); app.gapSel = null; app.timeline.render(); },
  copy() {
    const s = app.seq(); if (!s || !app.sel.size) return;
    const items = [];
    E.eachTrack(s, (t, kind, ti) => t.clips.forEach((c) => { if (app.sel.has(c.id)) items.push({ kind, ti, clip: JSON.parse(JSON.stringify(c)) }); }));
    const t0 = Math.min(...items.map((x) => x.clip.start));
    app.clipboard = items.map((x) => ({ ...x, off: x.clip.start - t0 }));
    app.status(`Copied ${items.length} clip(s)`);
  },
  paste() {
    const s = app.seq(); if (!s || !app.clipboard) return;
    const at = s.playhead;
    app.edit('Paste', () => {
      const lm = new Map(), ids = [];
      let end = at;
      for (const x of app.clipboard) {
        const c = Object.assign({}, x.clip, { id: U.uid('c'), start: E.snapT(s, at + x.off) });
        if (c.linkId) { if (!lm.has(c.linkId)) lm.set(c.linkId, U.uid('l')); c.linkId = lm.get(c.linkId); }
        while (s.tracks[x.kind].length <= x.ti) s.tracks[x.kind].push({ clips: [], muted: false, locked: false, target: false });
        E.placeClip(s, x.kind, x.ti, c);
        ids.push(c.id);
        end = Math.max(end, clipEnd(c));
      }
      app.sel = new Set(ids);
      s.playhead = end;
    });
    app.setPlayhead(s.playhead);
  },
  toggleLink() {
    const s = app.seq(); if (!s || !app.sel.size) return;
    const items = [...app.sel].map((id) => E.findClip(s, id)).filter(Boolean);
    const anyLinked = items.some((x) => x.clip.linkId);
    app.edit(anyLinked ? 'Unlink' : 'Link', () => E.setLinked(s, [...app.sel], !anyLinked));
  },
  toggleEnable() { const s = app.seq(); if (!s || !app.sel.size) return; app.edit('Enable', () => { for (const id of app.sel) { const f = E.findClip(s, id); if (f) f.clip.disabled = !f.clip.disabled; } }); },
  toggleFit() {
    const s = app.seq(); if (!s || !app.sel.size) return;
    app.edit('Set to Fill', () => { for (const id of app.sel) { const f = E.findClip(s, id); if (f && f.kind === 'video') f.clip.fit = f.clip.fit === 'cover' ? 'contain' : 'cover'; } });
  },
  gain() { gainDialog(); },
  /** Ctrl+Shift+D jako Premiere (Constant Power): střih dvou klipů = prolnutí přes střih (xIn, oba znějí z rezervy zdroje),
   *  volný kraj = roztmívání z ticha / do ticha. S výběrem oba kraje vybraných zvukových klipů, bez výběru střih nejblíž
   *  hlavě na cílových zvukových stopách. Délka = délka přechodů (jako video, výchozí 1 s). Střihač z Premiere S11: dřív
   *  6snímkové zeslabení obou konců všech klipů v okolí = propad −20 dB na střihu. */
  audioFade() {
    const s = app.seq(); if (!s) return;
    const d0 = app.transDur || 1;
    const dur = (c) => (project.mediaById(c.mediaId) || {}).duration || Infinity;
    const edges = [];
    const sel = [...app.sel].map((id) => E.findClip(s, id)).filter((x) => x && x.kind === 'audio');
    if (sel.length) for (const f of sel) edges.push({ tr: f.trackObj, c: f.clip, side: 'in' }, { tr: f.trackObj, c: f.clip, side: 'out' });
    else {
      for (const tr of s.tracks.audio) {
        if (tr.locked || tr.trackTarget === false) continue;
        let best = null;
        for (const c of tr.clips) for (const side of ['in', 'out']) {
          if (c.disabled) continue;
          const dd = Math.abs((side === 'in' ? c.start : clipEnd(c)) - s.playhead);
          if (!best || dd < best.dd - 1e-6) best = { c, side, dd };
        }
        if (best) edges.push({ tr, c: best.c, side: best.side });
      }
    }
    if (!edges.length) { app.status('Select audio clips or park the playhead on an edit point'); return; }
    let n = 0;
    app.edit('Apply Audio Transition', () => {
      const done = new Set();
      for (const { tr, c, side } of edges) {
        const nb = side === 'in' ? tr.clips.find((x) => x !== c && !x.disabled && Math.abs(clipEnd(x) - c.start) < 1e-3)
          : tr.clips.find((x) => x !== c && !x.disabled && Math.abs(x.start - clipEnd(c)) < 1e-3);
        if (nb) {
          const A = side === 'in' ? nb : c, B = side === 'in' ? c : nb;
          if (done.has(B.id)) continue;
          done.add(B.id);
          // rezerva zdroje za koncem A a před začátkem B, nejvýš délka kratšího klipu
          const d = Math.min(d0, 2 * Math.max(0, dur(A) - A.out), 2 * B.in, A.out - A.in, B.out - B.in);
          if (d >= 2 / s.fps) { B.xIn = d; A.fadeOut = 0; B.fadeIn = 0; n++; }
          else { const f = Math.min(d0 / 2, (A.out - A.in) / 3, (B.out - B.in) / 3); A.fadeOut = f; B.fadeIn = f; n++; } // bez rezervy zdroje: krátké zeslabení
        } else {
          const f = Math.min(d0, (c.out - c.in) / 2);
          if (side === 'in') c.fadeIn = f; else c.fadeOut = f;
          n++;
        }
      }
    });
    app.status(n ? `Audio transitions: ${n}` : 'Select audio clips or park the playhead on an edit point');
  },
  exportFrame() { exportFrame(); },
  // přechody obrazu (Ctrl+D výchozí = Cross Dissolve), u vybraných klipů na jejich nejbližším střihu, jinak u playheadu
  applyCross(type) { applyVideoTransition(typeof type === 'string' ? type : 'cross'); },
  applyDipBlack() { applyVideoTransition('dipBlack'); },
  applyDipWhite() { applyVideoTransition('dipWhite'); },
  applyBothTransitions() { applyVideoTransition('cross'); commands.audioFade(); },
  removeTransitions() {
    const s = app.seq(); if (!s) return;
    const ids = app.sel.size ? [...app.sel] : s.tracks.video.flatMap((t) => t.clips.filter((c) => Math.abs(c.start - s.playhead) < 0.6 || Math.abs(clipEnd(c) - s.playhead) < 0.6).map((c) => c.id));
    app.edit('Clear Transitions', () => E.removeTransitions(s, ids));
  },
  transitionDuration() { transitionDurationDialog(); },
  fadeInOut() {
    // roztmívání na začátku a zatmívání na konci sekvence (obraz i zvuk) – rychlá úprava pro sítě
    const s = app.seq(); if (!s) return;
    const d = app.transDur || 1;
    const end = seqDuration(s);
    app.edit('Fade In/Out', () => {
      E.applyTransitionAt(s, 0, 'dipBlack', d, s.tracks.video.map((_, ti) => ({ track: ti })));
      E.applyTransitionAt(s, end, 'dipBlack', d, s.tracks.video.map((_, ti) => ({ track: ti })));
      for (const t of s.tracks.audio) for (const c of t.clips) {
        if (c.start < 1e-3) c.fadeIn = Math.min(d, (c.out - c.in) / 2);
        if (Math.abs(clipEnd(c) - end) < 1e-3) c.fadeOut = Math.min(d, (c.out - c.in) / 2);
      }
    });
  },
  marker() { const s = app.seq(); if (!s) return; app.edit('Add Marker', () => { s.markers.push({ id: U.uid('k'), time: s.playhead, duration: 0, name: '', comment: '', color: 0 }); s.markers.sort((a, b) => a.time - b.time); }); },
  matchFrame() {
    const s = app.seq(); if (!s) return;
    const c = app.program.player.topVideo(s, s.playhead) || app.program.player.audioAt(s, s.playhead)[0];
    if (!c) return;
    const m = project.mediaById(c.mediaId);
    // jako Premiere: ve Zdroji In/Out = hranice klipu, hlava na stejném snímku (střihač z Premiere S11)
    if (m) app.openSource(m, { at: c.in + (s.playhead - c.start), inPoint: c.in, outPoint: c.out });
  },
  toolSelect() { commands.setTool('select'); },
  toolRazor() { commands.setTool('razor'); },
  addMarkerHere() { commands.marker(); },
  snap() { app.snap = !app.snap; updateTools(); app.status(app.snap ? 'Snap on' : 'Snap off'); },
  linkedSel() { app.linkedSel = !app.linkedSel; updateTools(); },
  zoomIn() { app.timeline.zoomIn(); },
  zoomOut() { app.timeline.zoomOut(); },
  zoomFit() { app.timeline.zoomFit(); },
  undo() { const l = project.undo(); app.status(l ? 'Undo: ' + l : 'Nothing to undo'); app.afterEdit(); },
  redo() { const l = project.redo(); app.status(l ? 'Redo: ' + l : 'Nothing to redo'); app.afterEdit(); },

  import: () => importDialog(),
  newSequence: () => seqDialog(null),
  seqSettings: () => { const s = app.seq(); if (s) seqDialog(s); },
  export: () => exportDialog(),
  save: () => saveProject(false),
  saveAs: () => saveProject(true),
  openProject: () => openProjectDialog(),
  newProject: () => newProject(),
  toggleAi: (arg) => toggleAi(arg === true ? true : undefined),
  help: () => helpDialog(),
  focusPanelKey: (name) => {
    app.focusPanel(name);
    if (name === 'project' && app.transcript && $('projList').offsetParent === null) app.transcript.show('project');
    const el = name === 'project' ? $('projList') : document.querySelector(`.panel[data-panel="${name}"]`);
    if (el) { if (!el.hasAttribute('tabindex')) el.tabIndex = -1; el.focus({ preventScroll: true }); }
    const n = { project: ['Project', 'Projekt'], source: ['Source', 'Zdroj'], timeline: ['Timeline', 'Časová osa'], program: ['Program', 'Program'] }[name];
    app.status(TN.lang === 'cs' ? 'Panel: ' + n[1] : 'Panel: ' + n[0]);
  },
  installFfmpeg: () => installFfmpeg(),
  socialGuide: () => socialGuide(),
  reframe916: () => reframeTo(9, 16, 1080, 1920),
  reframe45: () => reframeTo(4, 5, 1080, 1350),
  reframe11: () => reframeTo(1, 1, 1080, 1080),
  reframeAll: () => reframeAll(),
  exportSocial: () => exportSocial(),
  captionStyle: () => require('./ui/captionstyle').openCaptionStyle(app),
  headline: () => require('./ui/captionstyle').openCaptionStyle(app, true),
  editCaptionHere: () => { const s = app.seq(); if (!s) return; if (!(s.captions || []).length && window.__pzASR) { captionsFromTranscript(); return; } if ((s.captions || []).length) { app.transcript.show('cap'); if (app.captionList.editAtPlayhead()) return; } const i = (s.captions || []).findIndex((c) => c.start <= s.playhead + 0.001 && c.end > s.playhead); if (i >= 0) app.editCaption(i); else app.toast('No caption at the playhead'); },
  clearCaptions: () => { const s = app.seq(); if (s) app.edit('Delete Captions', () => { s.captions = []; }); },
  captionsFromTranscript: () => captionsFromTranscript(),
  transcribeAccurately: (m) => transcribeAccurately(m),
  transcribeAgain: (m) => retranscribe(m),
  find: () => { if (!(app.transcript && app.transcript.find())) { if (app.transcript) app.transcript.show('project'); $('projSearch').focus(); } },
  beforeClose: () => confirmClose(),
};
function runCmd(name, arg) {
  const f = commands[name];
  if (!f) { console.warn('unknown command', name); return; }
  try {
    const r = f(arg);
    if (r && typeof r.catch === 'function') r.catch((e) => { app.toast(e.message, true); console.error(e); }); // pád a obnova S12
  } catch (e) { app.toast(e.message, true); console.error(e); }
}
ipcRenderer.on('cmd', (_e, name, arg) => runCmd(name, arg));

function sourceEdit(mode) {
  const m = app.source.media;
  if (!m) { app.toast('Open a clip in the Source monitor first (double-click it in the Project panel).'); return; }
  const a = m.srcIn ?? 0, b = m.srcOut ?? m.duration;
  const s = app.seq();
  const wasEmpty = !s || seqDuration(s) < 0.01;
  app.dropMedia(m, a, b, s ? s.playhead : 0, mode === 'insert', {});
  const s2 = app.seq();
  if (s2) app.setPlayhead((s ? s.playhead : 0) + (b - a), { noFollow: wasEmpty });
  if (s2 && wasEmpty) app.timeline.zoomFit();
}
app.transDur = Number(settings.transDur) || 1;
const TRANS_NAMES = { cross: 'Cross Dissolve', dipBlack: 'Dip to Black', dipWhite: 'Dip to White' };
function applyVideoTransition(type) {
  const s = app.seq(); if (!s) return;
  const mediaDuration = (id) => (project.mediaById(id) || {}).duration || Infinity;
  // kde: vybrané klipy -> jejich kraj nejblíž playheadu; jinak nejbližší střih k playheadu (cílové stopy)
  let at, tracks;
  const sel = [...app.sel].map((id) => E.findClip(s, id)).filter((f) => f && f.kind === 'video');
  if (sel.length) {
    const c = sel[0].clip;
    at = Math.abs(c.start - s.playhead) <= Math.abs(clipEnd(c) - s.playhead) ? c.start : clipEnd(c);
    tracks = [...new Set(sel.map((f) => f.track))].map((track) => ({ track }));
  } else {
    at = E.nearestEdit(s, s.playhead);
    if (at === null) { app.status('No edit point'); return; }
  }
  let r;
  app.edit(TRANS_NAMES[type], () => { r = E.applyTransitionAt(s, at, type, app.transDur, tracks, mediaDuration); });
  if (!r) return;
  if (!r.applied && r.noHandles) app.toast('Insufficient media: Cross Dissolve needs extra frames beyond the clip ends (handles).', true);
  else if (r.shortened) app.status(`${TRANS_NAMES[type]} shortened to the available media handles`);
  else app.status(`${TRANS_NAMES[type]} applied at ${U.timecode(at, s.fps)}`);
}
function transitionDurationDialog() {
  const fps = (app.seq() || {}).fps || 25;
  openModal(`<h2>Default Transition Duration</h2>
    <div class="row"><label>Video transitions</label><input type="number" id="tdS" step="0.1" min="0.1" value="${app.transDur}" style="width:90px"> ${TN.lang === 'cs' ? `sekund (${Math.round(app.transDur * fps)} snímků)` : `seconds (${Math.round(app.transDur * fps)} frames)`}</div>
    <div class="btns"><button id="tdNo">Cancel</button><button class="primary" id="tdOk">OK</button></div>`, (b) => {
    b.querySelector('#tdNo').onclick = closeModal;
    b.querySelector('#tdOk').onclick = () => { app.transDur = Math.max(0.1, Number(b.querySelector('#tdS').value) || 1); settings.transDur = app.transDur; saveSettings(); closeModal(); };
  });
}

function inOutEdit(ripple) {
  const s = app.seq(); if (!s) return;
  if (s.inPoint === null && s.outPoint === null) { app.toast('Set an In point (I) and an Out point (O) in the sequence.'); return; }
  const a = s.inPoint ?? 0, b = s.outPoint ?? seqDuration(s);
  // Lift jen z cílových stop (Track Targeting v hlavičce, jako Premiere – redaktorka S6); Extract ze všech, ať se nic nerozjede
  const tracks = []; E.eachTrack(s, (t, kind, ti) => { if (t.trackTarget !== false) tracks.push({ kind, track: ti }); });
  app.edit(ripple ? 'Extract' : 'Lift', () => { if (ripple) E.extractRange(s, a, b); else E.liftRange(s, a, b, tracks); s.inPoint = null; s.outPoint = null; });
  app.setPlayhead(a);
}
// Panel nástrojů jako v Premiere (svisle mezi Projektem a timeline)
const ICONS = require('./ui/icons');
const TOOLS = [
  ['select', 'Selection Tool (V)'], ['trackfwd', 'Track Select Forward Tool (A)'], ['ripple', 'Ripple Edit Tool (B)'],
  ['rolling', 'Rolling Edit Tool (N)'], ['razor', 'Razor Tool (C)'], ['slip', 'Slip Tool (Y)'], ['hand', 'Hand Tool (H)'],
  ['zoom', 'Zoom Tool (Z) – Alt+click zooms out'], ['type', 'Type Tool (T) – not available yet'],
];
function renderToolList() {
  $('toolList').innerHTML = TOOLS.map(([id, t]) =>
    `<button class="ptool${app.tool === id ? ' on' : ''}${id === 'type' ? ' dis' : ''}" data-tool="${id}" title="${t}">${ICONS[id]}</button>`).join('');
}
$('toolList').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tool]');
  if (!b || b.dataset.tool === 'type') return;
  app.tool = b.dataset.tool; updateTools();
});
function updateTools() {
  renderToolList();
  app.timeline.render();
}
app.warnMidWord = (s, t) => commands.warnMidWord(s, t); // i pro žiletku na časové ose
commands.setTool = (id) => { app.tool = id; updateTools(); const t = TOOLS.find((x) => x[0] === id) || (id === 'trackback' && ['trackback', 'Track Select Backward Tool (Shift+A)']); if (t) app.status(t[1]); };

/* ======================================================= další příkazy podle výchozích zkratek Premiere (.kys) */
const MD = (id) => (project.mediaById(id) || {}).duration || Infinity;
function targetedTracks(s) { const out = []; E.eachTrack(s, (t, kind, ti) => { if (t.trackTarget !== false && !t.locked) out.push({ kind, track: ti, t }); }); return out; }
function editPointsOn(s, tracks) {
  const pts = new Set([0]);
  for (const x of tracks) for (const c of x.t.clips) { pts.add(Math.round(c.start * 1000) / 1000); pts.add(Math.round(clipEnd(c) * 1000) / 1000); }
  return [...pts].sort((a, b) => a - b);
}
function jumpEdit(dir, any) {
  // ↑/↓ = střihy na cílových stopách (Track Targeting), Shift+↑/↓ = na všech stopách – jako v Premiere
  const s = app.seq(); if (!s) return;
  const pts = any ? E.editPoints(s) : editPointsOn(s, targetedTracks(s));
  const h = 0.5 / s.fps;
  const p = dir > 0 ? pts.find((x) => x > s.playhead + h) : [...pts].reverse().find((x) => x < s.playhead - h);
  if (p !== undefined) app.setPlayhead(p, { scrub: true });
}
function clipsAtPlayhead(s) {
  const out = [];
  for (const x of targetedTracks(s)) for (const c of x.t.clips) if (c.start <= s.playhead + 1e-6 && clipEnd(c) > s.playhead + 1e-6) out.push(c);
  return out;
}
function selectedClips(s) { return [...app.sel].map((id) => E.findClip(s, id)).filter(Boolean); }
Object.assign(commands, {
  prevEdit() { jumpEdit(-1, false); },
  nextEdit() { jumpEdit(1, false); },
  prevEditAny() { jumpEdit(-1, true); },
  nextEditAny() { jumpEdit(1, true); },
  cut() { commands.copy(); commands.delete(); },
  pasteInsert() {
    const s = app.seq(); if (!s || !app.clipboard) return;
    const span = Math.max(...app.clipboard.map((x) => x.off + (x.clip.out - x.clip.in)));
    app.edit('Paste Insert', () => E.insertSpace(s, s.playhead, span));
    commands.paste();
  },
  selectClipAtPlayhead() {
    const s = app.seq(); if (!s) return;
    app.sel = new Set();
    for (const c of clipsAtPlayhead(s)) for (const l of (app.linkedSel ? E.linked(s, c) : [c])) app.sel.add(l.id);
    app.timeline.render();
  },
  selectNextClip(dir = 1) {
    const s = app.seq(); if (!s) return;
    const cur = selectedClips(s)[0];
    const tr = cur ? cur.trackObj : (targetedTracks(s).find((x) => x.kind === 'video') || {}).t;
    if (!tr) return;
    const ref = cur ? cur.clip.start : s.playhead;
    const list = tr.clips.slice().sort((a, b) => a.start - b.start);
    const c = dir > 0 ? list.find((x) => x.start > ref + 1e-6) : [...list].reverse().find((x) => x.start < ref - 1e-6);
    if (!c) return;
    app.sel = new Set((app.linkedSel ? E.linked(s, c) : [c]).map((x) => x.id));
    app.setPlayhead(c.start, { scrub: true });
    app.timeline.render();
  },
  selectPrevClip() { commands.selectNextClip(-1); },
  nudge(frames) {
    // Alt+←/→ (Shift = 5 snímků): posun vybraných klipů, přepisuje cíl jako v Premiere
    const s = app.seq(); if (!s || !app.sel.size) return;
    app.edit('Nudge', () => E.moveClips(s, [...app.sel], frames / s.fps));
  },
  nudgeTrack(dir) {
    const s = app.seq(); if (!s || !app.sel.size) return;
    const f = selectedClips(s)[0];
    app.edit('Nudge Clip Selection ' + (dir > 0 ? 'Up' : 'Down'), () => E.moveClips(s, [...app.sel], 0, f.kind === 'video' ? dir : -dir, f.kind));
  },
  slipSel(frames) {
    const s = app.seq(); if (!s || !app.sel.size) return;
    const f = selectedClips(s)[0];
    app.edit('Slip', () => E.slipClip(s, f.clip.id, frames / s.fps, { unlinked: !app.linkedSel, mediaDuration: MD }));
  },
  extendSelectedEdit() {
    // E: nejbližší kraj vybraného klipu k playheadu se dotáhne na playhead (bez ripple)
    const s = app.seq(); if (!s) return;
    const f = selectedClips(s)[0]; if (!f) { app.status('Select a clip first'); return; }
    const c = f.clip, edge = Math.abs(c.start - s.playhead) < Math.abs(clipEnd(c) - s.playhead) ? 'in' : 'out';
    app.edit('Extend Edit', () => E.trimEdge(s, c.id, edge, s.playhead, { unlinked: !app.linkedSel, mediaDuration: MD }));
  },
  extendEditToPlayhead(side) {
    // Shift+Q / Shift+W (a Ctrl+Alt+Q / W): klipy pod playheadem na cílových stopách – začátek / konec na playhead, bez ripple
    const s = app.seq(); if (!s) return;
    const clips = clipsAtPlayhead(s);
    if (!clips.length) { app.status('No clip under the playhead on targeted tracks'); return; }
    app.edit(side === 'in' ? 'Trim In to Playhead' : 'Trim Out to Playhead', () => {
      for (const c of clips) if (E.findClip(s, c.id)) E.trimEdge(s, c.id, side, s.playhead, { unlinked: true, mediaDuration: MD });
    });
  },
  gotoMarker(dir = 1) {
    const s = app.seq(); if (!s || !s.markers.length) return;
    const h = 0.5 / s.fps;
    const m = dir > 0 ? s.markers.find((x) => x.time > s.playhead + h) : [...s.markers].reverse().find((x) => x.time < s.playhead - h);
    if (m) app.setPlayhead(m.time, { scrub: true });
  },
  clearMarker() {
    const s = app.seq(); if (!s) return;
    const h = 0.5 / s.fps;
    app.edit('Clear Selected Marker', () => { s.markers = s.markers.filter((m) => Math.abs(m.time - s.playhead) > h); });
  },
  clearAllMarkers() { const s = app.seq(); if (s) app.edit('Clear All Markers', () => { s.markers = []; }); },
  markClip() {
    // X: In/Out kolem klipu pod playheadem (cílové stopy)
    const s = app.seq(); if (!s) return;
    const c = clipsAtPlayhead(s)[0]; if (!c) return;
    s.inPoint = c.start; s.outPoint = clipEnd(c); project.dirty = true; app.program.ui(); app.timeline.drawRuler();
  },
  markSelection() {
    const s = app.seq(); if (!s || !app.sel.size) return;
    const cs = selectedClips(s).map((f) => f.clip);
    s.inPoint = Math.min(...cs.map((c) => c.start)); s.outPoint = Math.max(...cs.map(clipEnd)); project.dirty = true; app.program.ui(); app.timeline.drawRuler();
  },
  gotoGap(dir = 1) {
    // Shift+; / Ctrl+Shift+; – mezera, kde je prázdno na všech stopách
    const s = app.seq(); if (!s) return;
    const iv = [];
    E.eachTrack(s, (t) => t.clips.forEach((c) => iv.push([c.start, clipEnd(c)])));
    iv.sort((a, b) => a[0] - b[0]);
    const gaps = []; let end = 0;
    for (const [a, b] of iv) { if (a > end + 1e-3) gaps.push(end); end = Math.max(end, b); }
    const h = 0.5 / s.fps;
    const g = dir > 0 ? gaps.find((x) => x > s.playhead + h) : [...gaps].reverse().find((x) => x < s.playhead - h);
    if (g !== undefined) app.setPlayhead(g, { scrub: true }); else app.status('No gap');
  },
  clipVolume(db) {
    const s = app.seq(); if (!s) return;
    let cs = selectedClips(s).filter((f) => f.kind === 'audio').map((f) => f.clip);
    if (!cs.length) cs = clipsAtPlayhead(s).filter((c) => c.kind === 'audio');
    if (!cs.length) return;
    app.edit(db > 0 ? 'Increase Clip Volume' : 'Decrease Clip Volume', () => { for (const c of cs) c.gainDb = Math.max(-60, Math.min(24, Math.round(((c.gainDb || 0) + db) * 10) / 10)); });
    app.status(`Clip volume ${cs[0].gainDb > 0 ? '+' : ''}${cs[0].gainDb} dB`);
  },
  toggleAllTargets(kind) {
    const s = app.seq(); if (!s) return;
    const all = s.tracks[kind].every((t) => t.trackTarget !== false);
    s.tracks[kind].forEach((t) => { t.trackTarget = !all; });
    app.timeline.render();
  },
  trackHeight([kind, d]) { app.timeline.trackHeight(kind, d); },
  expandAllTracks() { app.timeline.expandAll(); },
  minimizeAllTracks() { app.timeline.minimizeAll(); },
  pageScroll(dir) { app.timeline.pageScroll(dir); },
  maximizeFrame() {
    // ` – panel pod kurzorem / aktivní panel přes celé okno (jako Maximize Frame v Premiere)
    const map = { source: 'sourcePanel', program: 'programPanel', project: 'projectPanel', timeline: 'timelinePanel', tools: 'toolsPanel' };
    const el = $(map[app.focus] || 'timelinePanel');
    const on = !el.classList.contains('maxed');
    document.querySelectorAll('.panel.maxed').forEach((p) => p.classList.remove('maxed'));
    if (on) el.classList.add('maxed');
    setTimeout(() => { app.program.layout(); app.source.layout(); app.timeline.render(); }, 30);
  },
  programZoom(v) { $('prgFit').value = v; app.program.layout(); },
  reverseMatchFrame() {
    // Shift+R: snímek ze Zdroje najde v aktivní sekvenci
    const s = app.seq(), m = app.source.media; if (!s || !m) return;
    const t = app.source.time;
    for (const x of s.tracks.video.concat(s.tracks.audio)) for (const c of x.clips) {
      if (c.mediaId === m.id && c.in <= t && c.out > t) { app.setPlayhead(c.start + (t - c.in), { scrub: true }); return; }
    }
    app.status('The source frame is not in the sequence');
  },
  closeSequence() { const s = app.seq(); if (s) { project.closeSequence(s.id); renderTabs(); } },
  saveCopy() { saveCopyDialog(); },
  quit() { confirmClose(); },
});
async function saveCopyDialog() {
  const r = await ipcRenderer.invoke('dialog', 'save', { title: 'Save a Copy', defaultPath: path.join(settings.lastProjectDir || path.join(process.env.USERPROFILE || 'C:\\', 'Documents'), (project.name || 'Project') + ' copy.' + BRAND.PROJECT_EXT), filters: [{ name: (TN.lang === 'cs' ? `Projekt ${BRAND.SHORT_NAME}` : `${BRAND.SHORT_NAME} project`), extensions: [BRAND.PROJECT_EXT] }] });
  if (!r.canceled && r.filePath) { writeProject(r.filePath); app.status('Saved a copy: ' + r.filePath); }
}
$('btnImport').onclick = () => runCmd('import');
$('btnNewSeq').onclick = () => runCmd('newSequence');
$('btnExport').onclick = () => runCmd('export');
$('btnAi').onclick = () => runCmd('toggleAi');
$('btnDelItem').onclick = () => deleteProjectItem();

/* ======================================================= klávesnice (výchozí zkratky Premiere) */
const KEYMAP = [
  ['Space', 'play'], ['KeyL', 'shuttleL'], ['KeyJ', 'shuttleJ'], ['KeyK', 'shuttleK'],
  ['ArrowLeft', 'stepBack'], ['ArrowRight', 'stepFwd'], ['Shift+ArrowLeft', 'stepBack', 5], ['Shift+ArrowRight', 'stepFwd', 5],
  ['ArrowUp', 'prevEdit'], ['ArrowDown', 'nextEdit'], ['Home', 'gotoStart'], ['End', 'gotoEnd'],
  ['KeyI', 'markIn'], ['KeyO', 'markOut'], ['Shift+KeyI', 'gotoIn'], ['Shift+KeyO', 'gotoOut'],
  ['Ctrl+Shift+KeyI', 'clearIn'], ['Ctrl+Shift+KeyO', 'clearOut'], ['Ctrl+Shift+KeyX', 'clearInOut'],
  ['Comma', 'insert'], ['Period', 'overwrite'], ['Semicolon', 'lift'], ['Quote', 'extract'],
  ['KeyQ', 'rippleTrimPrev'], ['KeyW', 'rippleTrimNext'],
  ['Ctrl+KeyK', 'addEdit'], ['Ctrl+Shift+KeyK', 'addEditAll'],
  ['Delete', 'delete'], ['Backspace', 'delete'], ['Shift+Delete', 'rippleDelete'], ['Shift+Backspace', 'rippleDelete'],
  ['Ctrl+KeyZ', 'undo'], ['Ctrl+Shift+KeyZ', 'redo'], ['Ctrl+KeyY', 'redo'],
  ['Ctrl+KeyC', 'copy'], ['Ctrl+KeyV', 'paste'], ['Ctrl+KeyA', 'selectAll'], ['Ctrl+Shift+KeyA', 'deselect'], ['Escape', 'deselect'],
  ['Ctrl+KeyL', 'toggleLink'], ['Shift+KeyE', 'toggleEnable'], ['KeyG', 'gain'], ['Ctrl+Shift+KeyD', 'audioFade'],
  ['KeyM', 'marker'], ['KeyF', 'matchFrame'], ['KeyV', 'setTool', 'select'], ['KeyC', 'setTool', 'razor'], ['KeyS', 'snap'],
  ['KeyA', 'setTool', 'trackfwd'], ['KeyB', 'setTool', 'ripple'], ['KeyN', 'setTool', 'rolling'], ['KeyY', 'setTool', 'slip'],
  ['KeyH', 'setTool', 'hand'], ['KeyZ', 'setTool', 'zoom'], ['Ctrl+Shift+KeyE', 'exportFrame'],
  ['Ctrl+KeyD', 'applyCross'], ['Shift+KeyD', 'applyBothTransitions'],
  // doplněno podle výchozích zkratek Premiere Pro 2027 (Keyboard Shortcuts\en\Adobe Premiere Pro Defaults.kys)
  ['Shift+ArrowUp', 'prevEditAny'], ['Shift+ArrowDown', 'nextEditAny'],
  ['Ctrl+KeyX', 'cut'], ['Ctrl+Shift+KeyV', 'pasteInsert'], ['Alt+Backspace', 'rippleDelete'],
  ['KeyD', 'selectClipAtPlayhead'], ['Ctrl+ArrowDown', 'selectNextClip'], ['Ctrl+ArrowUp', 'selectPrevClip'],
  ['Alt+ArrowLeft', 'nudge', -1], ['Alt+ArrowRight', 'nudge', 1], ['Alt+Shift+ArrowLeft', 'nudge', -5], ['Alt+Shift+ArrowRight', 'nudge', 5],
  ['Alt+ArrowUp', 'nudgeTrack', 1], ['Alt+ArrowDown', 'nudgeTrack', -1],
  ['Ctrl+Alt+ArrowLeft', 'slipSel', -1], ['Ctrl+Alt+ArrowRight', 'slipSel', 1], ['Ctrl+Alt+Shift+ArrowLeft', 'slipSel', -5], ['Ctrl+Alt+Shift+ArrowRight', 'slipSel', 5],
  ['KeyE', 'extendSelectedEdit'], ['Shift+KeyQ', 'extendEditToPlayhead', 'in'], ['Shift+KeyW', 'extendEditToPlayhead', 'out'],
  ['Ctrl+Alt+KeyQ', 'extendEditToPlayhead', 'in'], ['Ctrl+Alt+KeyW', 'extendEditToPlayhead', 'out'],
  ['Shift+KeyM', 'gotoMarker', 1], ['Ctrl+Shift+KeyM', 'gotoMarker', -1], ['Ctrl+Alt+KeyM', 'clearMarker'], ['Ctrl+Alt+Shift+KeyM', 'clearAllMarkers'],
  ['KeyX', 'markClip'], ['Slash', 'markSelection'], ['Shift+Semicolon', 'gotoGap', 1], ['Ctrl+Shift+Semicolon', 'gotoGap', -1],
  ['BracketLeft', 'clipVolume', -1], ['BracketRight', 'clipVolume', 1], ['Shift+BracketLeft', 'clipVolume', -6], ['Shift+BracketRight', 'clipVolume', 6],
  ['Ctrl+Digit0', 'toggleAllTargets', 'video'], ['Ctrl+Digit9', 'toggleAllTargets', 'audio'],
  ['Ctrl+Equal', 'trackHeight', ['video', 8]], ['Ctrl+Minus', 'trackHeight', ['video', -8]], ['Alt+Equal', 'trackHeight', ['audio', 8]], ['Alt+Minus', 'trackHeight', ['audio', -8]],
  ['Shift+Equal', 'expandAllTracks'], ['Shift+Minus', 'minimizeAllTracks'], ['PageUp', 'pageScroll', -1], ['PageDown', 'pageScroll', 1],
  ['Backquote', 'maximizeFrame'], ['Shift+Backquote', 'maximizeFrame'], ['Ctrl+Shift+Digit0', 'programZoom', 'fit'], ['Ctrl+Shift+Digit1', 'programZoom', '1'],
  ['Shift+KeyR', 'reverseMatchFrame'], ['Shift+KeyA', 'setTool', 'trackback'],
  ['Ctrl+KeyW', 'closeSequence'], ['Ctrl+Alt+KeyS', 'saveCopy'], ['Ctrl+KeyQ', 'quit'],
  ['Ctrl+KeyF', 'find'], ['F2', 'editCaptionHere'],
  // fokus panelu z klávesnice jako v Premiere (S14 Přístupnost: šlo jen myší)
  ['Shift+Digit1', 'focusPanelKey', 'project'], ['Shift+Digit2', 'focusPanelKey', 'source'], ['Shift+Digit3', 'focusPanelKey', 'timeline'], ['Shift+Digit4', 'focusPanelKey', 'program'],
  ['Equal', 'zoomIn'], ['NumpadAdd', 'zoomIn'], ['Minus', 'zoomOut'], ['NumpadSubtract', 'zoomOut'], ['Backslash', 'zoomFit'],
];
const keyIndex = new Map(KEYMAP.map(([k, c, a]) => [k, [c, a]]));
/** Zkratka -> příkaz; true = zpracováno. Volá se i z AI panelu (iframe), když v něm nepíšeš do pole –
 *  zkratky Premiere tak fungují pořád, ať je fokus kdekoli (jako v Premiere). */
function handleKey(ev) {
  const tag = (ev.target && ev.target.tagName || '').toLowerCase();
  // Esc zavře dialog i s kurzorem v textovém poli (vzhled S2: Export a Nová sekvence se Esc nezavřely)
  if (ev.key === 'Escape' && (tag === 'input' || tag === 'select' || tag === 'textarea') && $('modal').classList.contains('show') && !$('modal').dataset.busy && !(Date.now() - (+$('modal').dataset.pickEnd || 0) < 1500)) { closeModal(); return true; }
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || (ev.target && ev.target.isContentEditable)) return false;
  // Esc ze systémového okna uložení (zrušení) nesmí zavřít i dialog Export (redaktor-4) – chvíli po zrušení se ignoruje
  if ($('modal').classList.contains('show')) { if (ev.key === 'Escape' && !$('modal').dataset.busy && !(Date.now() - (+$('modal').dataset.pickEnd || 0) < 1500)) closeModal(); return false; }
  // mezerník/Enter na tlačítku vybraném z klávesnice ho stiskne, nespustí přehrávání (S14 Přístupnost)
  if ((ev.code === 'Space' || ev.key === 'Enter') && !ev.ctrlKey && !ev.altKey && ev.target && ev.target.closest
    && ev.target.closest('button,[role=button],[role=tab],[role=menuitem],a[href],summary') && ev.target.matches(':focus-visible')) return false;
  const combo = (ev.ctrlKey ? 'Ctrl+' : '') + (ev.altKey ? 'Alt+' : '') + (ev.shiftKey ? 'Shift+' : '') + ev.code;
  let hit = keyIndex.get(combo);
  if (!hit && !ev.ctrlKey && !ev.altKey && (ev.key === ',' || ev.key === '.')) hit = keyIndex.get(ev.key === ',' ? 'Comma' : 'Period');
  if (!hit && !ev.ctrlKey && !ev.altKey && ev.key === '\\') hit = keyIndex.get('Backslash');
  if (!hit) return false;
  hideContextMenu();
  runCmd(hit[0], hit[1]);
  return true;
}
window.addEventListener('keydown', (ev) => { if (handleKey(ev)) ev.preventDefault(); });

/* ======================================================= kontextové menu */
const ctx = $('ctxMenu');
function hideContextMenu() {
  const had = ctx.contains(document.activeElement);
  ctx.style.display = 'none';
  if (had && menuReturn && menuReturn.isConnected) menuReturn.focus({ preventScroll: true });
}
// kontextové menu z klávesnice (S14 Přístupnost: šlo jen myší) – šipky, Enter, Esc, fokus zpět
let menuReturn = null;
function menuA11y(m) {
  m.setAttribute('role', 'menu');
  if (!m.contains(document.activeElement)) menuReturn = document.activeElement;
  const items = [...m.children].filter((d) => d.tagName === 'DIV');
  items.forEach((d) => { d.setAttribute('role', 'menuitem'); d.tabIndex = -1; if (d.classList.contains('dis')) d.setAttribute('aria-disabled', 'true'); });
  const first = items.find((d) => !d.classList.contains('dis'));
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 0);
}
ctx.addEventListener('keydown', (ev) => {
  const items = [...ctx.children].filter((d) => d.tagName === 'DIV' && !d.classList.contains('dis'));
  const i = items.indexOf(document.activeElement);
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { const n = items.length; if (n) items[(i + (ev.key === 'ArrowDown' ? 1 : -1) + n) % n].focus(); }
  else if (ev.key === 'Home' || ev.key === 'End') { if (items.length) items[ev.key === 'Home' ? 0 : items.length - 1].focus(); }
  else if ((ev.key === 'Enter' || ev.key === ' ') && i >= 0) items[i].click();
  else if (ev.key === 'Escape' || ev.key === 'Tab') hideContextMenu();
  else return;
  ev.preventDefault(); ev.stopPropagation();
});
window.addEventListener('mousedown', (ev) => { if (!ctx.contains(ev.target)) hideContextMenu(); });
function showContextMenu(x, y, kind) {
  const s = app.seq();
  let items = [];
  if (kind === 'clip') {
    const sel = [...app.sel].map((id) => s && E.findClip(s, id)).filter(Boolean);
    const linked = sel.some((f) => f.clip.linkId);
    items = [
      ['Ripple Delete', 'rippleDelete', 'Shift+Del'], ['Clear', 'delete', 'Del'], '-',
      [linked ? 'Unlink' : 'Link', 'toggleLink', 'Ctrl+L'],
      ['Enable', 'toggleEnable', 'Shift+E'],
      ['Audio Gain…', 'gain', 'G'],
      ['Apply Audio Transition', 'audioFade', 'Ctrl+Shift+D'],
      ['Apply Cross Dissolve', () => applyVideoTransition('cross'), 'Ctrl+D'],
      ['Apply Dip to Black', () => applyVideoTransition('dipBlack'), ''],
      ['Apply Dip to White', () => applyVideoTransition('dipWhite'), ''],
      ['Clear Transitions', 'removeTransitions', ''],
      ['Set to Fill / Scale to Frame Size', 'toggleFit', ''], '-',
      ['Copy', 'copy', 'Ctrl+C'],
      ['Match Frame', 'matchFrame', 'F'],
      ['Open in Source Monitor', () => { const f = sel[0]; if (f) app.openSource(project.mediaById(f.clip.mediaId), { inPoint: f.clip.in, outPoint: f.clip.out, at: f.clip.in }); }, 'double-click'],
      ...asrItems(sel[0] && project.mediaById(sel[0].clip.mediaId), true),
    ];
  } else if (kind === 'timelineView') {
    app.view = app.view || {};
    const v = app.view;
    items = [
      [(v.thumbs !== false ? '✓ ' : '   ') + 'Show Video Thumbnails', () => { v.thumbs = v.thumbs === false; app.timeline.render(); }, ''],
      [(v.waves !== false ? '✓ ' : '   ') + 'Show Audio Waveform', () => { v.waves = v.waves === false; app.timeline.render(); }, ''],
      '-',
      ['Zoom to Sequence', 'zoomFit', '\\'],
    ];
  } else if (kind === 'gap') {
    items = [['Ripple Delete', 'delete', 'Del']];
  } else if (kind === 'projMedia') {
    const m = app.projectPanel.selectedMedia();
    items = [
      ['Open in Source Monitor', () => app.openSource(m), ''],
      ...asrItems(m, false),
      '-',
      ['New Sequence From Clip', () => newSeqFromMedia(m), ''],
      ['Append to Active Sequence', () => { const s2 = app.seq(); app.dropMedia(m, 0, m.duration, s2 ? seqDuration(s2) : 0, false, {}); }, ''],
      '-',
      ...(media.WEB ? [] : [['Reveal in Explorer', () => ipcRenderer.invoke('reveal', m.path), '']]),
      ['Remove From Project', () => deleteProjectItem(), ''],
    ];
  } else if (kind === 'projSeq') {
    const sel = app.projectPanel.selected;
    const sq = sel && project.sequences.find((q) => q.id === sel.id);
    items = [
      ['Open in Timeline', () => app.openSequence(sq.id), ''],
      ['Rename…', () => renameSeq(sq), ''],
      ['Duplicate', () => duplicateSeq(sq), ''],
      ['Sequence Settings…', () => seqDialog(sq), ''],
      '-',
      ['Delete Sequence', () => deleteProjectItem(), ''],
    ];
  }
  ctx.innerHTML = '';
  for (const it of items) {
    if (it === '-') { ctx.appendChild(document.createElement('hr')); continue; }
    const d = document.createElement('div');
    d.innerHTML = `<span>${it[0]}</span><span class="k">${it[2] || ''}</span>`;
    d.onclick = () => { hideContextMenu(); if (typeof it[1] === 'function') { try { it[1](); } catch (e) { app.toast(e.message, true); } } else runCmd(it[1]); };
    ctx.appendChild(d);
  }
  ctx.style.display = 'block';
  menuA11y(ctx);
  const r = ctx.getBoundingClientRect();
  ctx.style.left = Math.min(x, window.innerWidth - r.width - 4) + 'px';
  ctx.style.top = Math.min(y, window.innerHeight - r.height - 4) + 'px';
}

/* ======================================================= modální okna */
let modalReturn = null;
/** Pole bez přístupného názvu dostanou název ze sousedního popisku (S14 Přístupnost: textbox "" ve stromu). */
function labelFields(box) {
  box.querySelectorAll('input:not([type=hidden]),select,textarea,button').forEach((f) => {
    if (f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || (f.labels && f.labels.length && f.labels[0].textContent.trim() && f.labels[0].querySelectorAll('input,select,textarea').length < 2)) return;
    if (f.tagName === 'BUTTON') { if (!f.textContent.trim() || f.textContent.trim() === '…') f.setAttribute('aria-label', f.title || (TN.lang === 'cs' ? 'Vybrat…' : 'Browse…')); return; }
    let t = '';
    const prev = f.previousElementSibling;
    if (prev && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(prev.tagName)) t = prev.textContent.trim();
    if (!t && f.parentElement) {
      const lab = [...f.parentElement.children].find((c) => c !== f && /^(LABEL|SPAN|DIV|B)$/.test(c.tagName) && !c.querySelector('input,select,textarea') && c.textContent.trim());
      if (lab) t = lab.textContent.trim();
    }
    if (!t) t = f.title || f.placeholder || '';
    if (t) f.setAttribute('aria-label', t.slice(0, 80));
  });
}
function modalFocusables() {
  return [...$('modalBox').querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')]
    .filter((e) => !e.disabled && e.offsetParent !== null);
}
function openModal(html, onReady) {
  if (!$('modal').classList.contains('show')) modalReturn = document.activeElement;
  $('modalBox').innerHTML = html;
  // přístupnost (S14): dialog pro čtečku s názvem z nadpisu
  $('modalBox').setAttribute('role', 'dialog');
  $('modalBox').setAttribute('aria-modal', 'true');
  const h2 = $('modalBox').querySelector('h2');
  if (h2) { h2.id = 'modalTitle'; $('modalBox').setAttribute('aria-labelledby', 'modalTitle'); } else $('modalBox').removeAttribute('aria-labelledby');
  const box = $('modalBox'); setTimeout(() => labelFields(box), 0); // až po českém překladu popisků (MutationObserver)
  // pevná šířka (data-w u nadpisu): dialog se nemění podle délky textu a tlačítka neuskakují (redaktorka S2, Export)
  const wEl = $('modalBox').querySelector('[data-w]');
  $('modalBox').style.width = wEl ? Math.min(window.innerWidth - 40, +wEl.dataset.w) + 'px' : '';
  $('modal').classList.add('show');
  const first = $('modalBox').querySelector('input,select,button');
  // fokus bez odrolování (vzhled S1/S2: Klávesové zkratky F1 se otevřely na konci – první tlačítko je dole)
  if (first) setTimeout(() => { first.focus({ preventScroll: true }); $('modalBox').scrollTop = 0; }, 10);
  if (onReady) onReady($('modalBox'));
}
function closeModal() {
  $('modal').classList.remove('show'); $('modalBox').innerHTML = '';
  // fokus zpět na prvek, který dialog otevřel (S14 Přístupnost: skončil na BODY)
  const r = modalReturn; modalReturn = null;
  if (r && r.isConnected && r !== document.body) { try { r.focus({ preventScroll: true }); } catch (e) { /* skrytý */ } }
}
// past fokusu: Tab nesmí z otevřeného dialogu utéct do aplikace (S14 Přístupnost: Enter za dialogem otevřel jiné okno)
document.addEventListener('keydown', (ev) => {
  if (!$('modal').classList.contains('show')) return;
  const box = $('modalBox');
  if (ev.key === 'Tab') {
    const f = modalFocusables();
    if (!f.length) { ev.preventDefault(); return; }
    const i = f.indexOf(document.activeElement);
    if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && (i === -1 || i === f.length - 1)) { ev.preventDefault(); f[0].focus(); }
  } else if (!box.contains(ev.target) && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); ev.stopPropagation(); }
}, true);
document.addEventListener('focusin', (ev) => {
  if (!$('modal').classList.contains('show') || $('modal').contains(ev.target)) return;
  const f = modalFocusables(); if (f.length) f[0].focus({ preventScroll: true });
});
$('modal').addEventListener('mousedown', (ev) => { if (ev.target === $('modal') && !$('modal').dataset.busy) closeModal(); });

function gainDialog() {
  const s = app.seq(); if (!s || !app.sel.size) { app.status('Select clips first'); return; }
  const clips = [...app.sel].map((id) => E.findClip(s, id)).filter((x) => x && x.kind === 'audio').map((x) => x.clip);
  if (!clips.length) { app.status('Select audio clips'); return; }
  // jako Premiere: „Nastavit zesílení na“ (stejné všem) nebo „Změnit zesílení o“ (každému klipu zvlášť přičíst) – redaktorka S3
  const same = clips.every((c) => (c.gainDb || 0) === (clips[0].gainDb || 0));
  openModal(`<h2>Audio Gain</h2>
    <label class="row" style="gap:8px;cursor:pointer"><input type="radio" name="gMode" id="gSetR" value="set"> <span style="width:150px">Set Gain to (dB)</span><input type="number" id="gSet" step="0.5" value="${same ? clips[0].gainDb || 0 : ''}" style="width:90px"></label>
    <label class="row" style="gap:8px;cursor:pointer"><input type="radio" name="gMode" id="gAdjR" value="adj" checked> <span style="width:150px">Adjust Gain by (dB)</span><input type="number" id="gAdj" step="0.5" value="0" style="width:90px"></label>
    <div class="dim">${TN.lang === 'cs' ? `Vybrané zvukové klipy: ${clips.length} · 0 dB = původní hlasitost, −60 dB = ticho.` : `Selected audio clips: ${clips.length} · 0 dB = original level, −60 dB = silent.`}</div>
    <div class="btns"><button id="gNo">Cancel</button><button class="primary" id="gOk">OK</button></div>`, (b) => {
    b.querySelector('#gNo').onclick = closeModal;
    const pick = (m) => () => { b.querySelector(m === 'set' ? '#gSetR' : '#gAdjR').checked = true; };
    b.querySelector('#gSet').addEventListener('focus', pick('set'));
    b.querySelector('#gAdj').addEventListener('focus', pick('adj'));
    const lim = (v) => Math.max(-60, Math.min(24, v));
    const ok = () => {
      const set = b.querySelector('#gSetR').checked;
      const v = Number(b.querySelector(set ? '#gSet' : '#gAdj').value) || 0;
      closeModal();
      if (!set && !v) return;
      app.edit('Audio Gain', () => { for (const c of clips) c.gainDb = lim(set ? v : (c.gainDb || 0) + v); });
    };
    b.querySelector('#gOk').onclick = ok;
    for (const id of ['#gSet', '#gAdj']) b.querySelector(id).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    setTimeout(() => { const i = b.querySelector('#gAdj'); i.focus(); i.select(); }, 20);
  });
}

const PRESETS = [
  ['1080×1920 (vertical 9:16 – Reels, TikTok, Shorts)', 1080, 1920], ['1080×1350 (4:5 Instagram)', 1080, 1350], ['1080×1080 (square 1:1)', 1080, 1080],
  ['1920×1080 (Full HD 16:9)', 1920, 1080], ['1280×720 (HD 16:9)', 1280, 720], ['3840×2160 (4K)', 3840, 2160],
];
if (!media.WEB) {
  // přepis řeči lokálním Workerem MY Premiere MCP – panel Přepis, Přepsat řeč a titulky z přepisu jako na webu (kolo S1)
  try { require('./ai/asr-desktop').install({ app, aiRoot: cfg.aiRoot, ffmpeg: media.FFMPEG, LL: (en, cz) => (window.TN && window.TN.lang === 'cs' ? cz : en) }); } catch (e) { console.warn('asr', e.message); }
  // přesné snímky v monitoru tam, kde přehrávač po skoku ukazuje zastaralý obraz (TN MP4 s ne-IDR I-snímky)
  try {
    const RFm = require('../web/ai/reframe');
    const files = new Map();
    require('../web/ai/stillframes').install(app.program.player, app, (m) => {
      const p = importer.playPath(m);
      if (!p) return null;
      if (!files.has(p)) { try { files.set(p, new RFm.FsFile(p)); } catch (e) { files.set(p, null); } }
      return files.get(p);
    });
  } catch (e) { console.warn('still frames', e.message); }
  // zbytky jiného záběru na krajích klipů (16:9 vložení, AI sestřih, Auto Reframe) – jako web (kolo 7/8, kontrolor S1)
  window.__pzEdgeShots = (s, opts) => {
    const RF = require('../web/ai/reframe');
    const files = new Map();
    return RF.fixEdgeShots(app, s, (m) => {
      const p = importer.playPath(m) || m.path;
      if (!files.has(p)) files.set(p, new RF.FsFile(p));
      return files.get(p);
    }, () => {}, opts || {});
  };
  // výřez podle obličeje přímo v sekvenci na výšku (vkládání z Přepisu, Auto Reframe na stejný formát) – jako web;
  // redaktorka S7: v sekvenci 9:16 založené dialogem se další klipy jen ořízly na střed (v celku jen stůl)
  window.__pzReframeHere = async (s, only) => {
    const RF = require('../web/ai/reframe');
    try { await Promise.race([RF.detector(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]); } catch (e) {
      app.toast(LL('The crop could not follow the face here – edit in 16:9 and use Sequence → Auto Reframe.', 'Výřez podle obličeje se tu nepodařil – stříhej v 16:9 a použij Sekvence → Auto Reframe.'), true);
      throw e;
    }
    app.edit('Set to Fill', () => { for (const tr of s.tracks.video) for (const c of tr.clips) { if (only && !only.has(c.id)) continue; c.fit = 'cover'; c.scale = 1; c.posX = 0; c.posY = 0; } });
    const files = new Map();
    return RF.reframeSequence(app, s, (m) => {
      const p = importer.playPath(m) || m.path;
      if (!files.has(p)) files.set(p, new RF.FsFile(p));
      return files.get(p);
    }, (text) => app.status(i18n.tr ? i18n.tr(text) : text), only || null);
  };
  window.__pzReframe = async (src, num, den, W, H) => {
    const RF = require('../web/ai/reframe');
    const files = new Map();
    const viaApi = async () => {
      const r = await api.reframeSequence({ sequence: src.id, num, den, width: W, height: H });
      return { name: r.name, shots: r.shots, facesFound: r.facesFound, splits: r.cameraSplits };
    };
    // MediaPipe (malé tváře, mluvčí) jen když se dá načíst – Electron s nodeIntegration ho z CDN nenačte → ffmpeg + OpenCV
    try { await Promise.race([RF.detector(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]); } catch (e) { return viaApi(); }
    try {
      return await RF.reframeCopy(app, src, num, den, W, H, (m) => {
        if (!files.has(m.path)) files.set(m.path, new RF.FsFile(importer.playPath(m) || m.path));
        return files.get(m.path);
      }, (text) => app.status(i18n.tr ? i18n.tr(text) : text));
    } catch (e) {
      console.warn('reframe (MediaPipe) failed, using ffmpeg + OpenCV:', e.message);
      // nepovedená kopie (např. jiný kodek než H.264) – vrátit a zkusit původní cestu
      const last = app.project.sequences[app.project.sequences.length - 1];
      if (last && last.name.startsWith(src.name + ' ' + num + 'x' + den) && last.id !== src.id) app.cmd('undo');
      return viaApi();
    } finally {
      for (const f of files.values()) { try { if (f.fd !== null) f.fs.closeSync(f.fd); } catch (e) { /* zavřeno */ } }
    }
  };
}
/** Auto Reframe: NOVÁ sekvence v daném formátu, obraz posunutý na obličej (desktop: ffmpeg + OpenCV, web: window.__pzReframe). */
function reframeTo(num, den, width, height) {
  const s = app.seq(); if (!s) return;
  if (s.width === width && s.height === height && window.__pzReframeHere) {
    app.status(`Auto Reframe to ${num}:${den} (camera cuts and faces)…`);
    window.__pzReframeHere(s).then((r) => {
      app.status('');
      app.toast(TN.lang === 'cs' ? `Sekvence už je ${num}:${den} – výřez podle obličeje upraven přímo v ní (obličej v ${r.faced} z ${r.shots} záběrů). Zpět: Ctrl+Z.` : `The sequence is already ${num}:${den} – the crop now follows the face in it (face in ${r.faced} of ${r.shots} shots). Undo: Ctrl+Z.`);
    }).catch((e) => { app.status(''); app.toast(e.message, true); });
    return;
  }
  app.status(`Auto Reframe to ${num}:${den} (camera cuts and faces)…`);
  const run = window.__pzReframe ? window.__pzReframe(s, num, den, width, height) : api.reframeSequence({ sequence: s.id, num, den, width, height });
  run.then((r) => { app.status(''); app.toast(`Created sequence “${r.name}” (${width}×${height}) · ${r.shots} shots, face found in ${r.facesFound}`); app.timeline.zoomFit(); })
    .catch((e) => { app.status(''); app.toast(e.message, true); });
}
/** Všechny formáty pro sítě z jedné sekvence 16:9 – postupně 9:16, 4:5, 1:1 (každý jako nová sekvence). */
async function reframeAll() {
  const s = app.seq(); if (!s) return;
  const made = [];
  for (const [num, den, w, h] of [[9, 16, 1080, 1920], [4, 5, 1080, 1350], [1, 1, 1080, 1080]]) {
    app.status(`Auto Reframe to ${num}:${den} (camera cuts and faces)…`);
    try {
      const r = await (window.__pzReframe ? window.__pzReframe(s, num, den, w, h) : api.reframeSequence({ sequence: s.id, num, den, width: w, height: h }));
      made.push(r.name);
    } catch (e) { app.status(''); app.toast(e.message, true); return; }
  }
  app.status('');
  app.toast(`Created: ${made.join(' · ')}`);
  app.timeline.zoomFit();
}
function seqDialog(seq, opts) {
  const m = !seq && ((opts && opts.media) || app.projectPanel.selectedMedia());
  const d = seq || { name: project.uniqueSeqName(m ? U.stripExt(m.name) : (TN.lang === 'cs' ? 'Sekvence' : 'Sequence')), width: settings.lastSeq ? settings.lastSeq[0] : (m && m.hasVideo && m.width > m.height ? m.width : 1080), height: settings.lastSeq ? settings.lastSeq[1] : (m && m.hasVideo && m.width > m.height ? m.height : 1920), fps: m && m.hasVideo ? m.fps : 25 };
  const mIn = m ? (m.srcIn ?? 0) : 0, mOut = m ? (m.srcOut ?? m.duration) : 0;
  const mPart = m && (mIn > 0.01 || mOut < m.duration - 0.01);
  const mmss = (x) => Math.floor(x / 60) + ':' + String(Math.round(x % 60)).padStart(2, '0');
  openModal(`<h2>${seq ? 'Sequence Settings' : 'New Sequence'}</h2>
    <div class="row"><label>Sequence Name</label><input type="text" id="sqName" value="${d.name.replace(/"/g, '&quot;')}"></div>
    <div class="row"><label>Preset</label><select id="sqPreset"><option value="">custom</option>${PRESETS.map((p, i) => `<option value="${i}" ${p[1] === d.width && p[2] === d.height ? 'selected' : ''}>${p[0]}</option>`).join('')}</select></div>
    <div class="row"><label>Frame Size</label><input type="number" id="sqW" value="${d.width}" style="width:90px"> × <input type="number" id="sqH" value="${d.height}" style="width:90px"></div>
    <div class="row"><label>Timebase (fps)</label><select id="sqFps">${[23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((f) => `<option value="${f}" ${Math.abs(f - d.fps) < 0.01 ? 'selected' : ''}>${TN.lang === 'cs' ? String(f).replace('.', ',') : f}</option>`).join('')}</select></div>
    ${!seq && m ? `<label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" id="sqPut" ${opts && opts.put ? 'checked' : ''}> <span>${mPart ? 'Place the selected clip in it (In–Out, ' + mmss(mOut - mIn) + ')' : 'Place the selected clip in it (whole clip, ' + mmss(m.duration) + ')'}</span></label><div class="cs-warn" id="sqPutInfo" style="display:none">${TN.lang === 'cs' ? `Vloží se celý klip (${mmss(m.duration)}). Pro krátké video nejdřív označ úsek – třeba kliknutím na větu v záložce Přepis.` : `The whole clip is placed (${mmss(m.duration)}). For a short video mark a part first – e.g. click a sentence on the Transcript tab.`}</div>` : ''}
    <div class="btns"><button id="sqNo">Cancel</button><button class="primary" id="sqOk">OK</button></div>`, (b) => {
    b.querySelector('#sqPreset').onchange = (e) => { const p = PRESETS[e.target.value]; if (p) { b.querySelector('#sqW').value = p[1]; b.querySelector('#sqH').value = p[2]; } };
    const put = b.querySelector('#sqPut'), info = b.querySelector('#sqPutInfo');
    const upd = () => { if (info) info.style.display = put && put.checked && !mPart && m.duration > 120 ? 'block' : 'none'; };
    if (put) put.onchange = upd;
    upd();
    b.querySelector('#sqName').onkeydown = (e) => { if (e.key === 'Enter') b.querySelector('#sqOk').click(); };
    setTimeout(() => { const n = b.querySelector('#sqName'); if (n) { n.focus(); n.select(); } }, 0);
    b.querySelector('#sqNo').onclick = closeModal;
    b.querySelector('#sqOk').onclick = () => {
      const name = b.querySelector('#sqName').value.trim() || 'Sequence';
      const w = Math.max(16, Math.round(Number(b.querySelector('#sqW').value) / 2) * 2), h = Math.max(16, Math.round(Number(b.querySelector('#sqH').value) / 2) * 2);
      const fps = Number(b.querySelector('#sqFps').value);
      const put = !!(b.querySelector('#sqPut') && b.querySelector('#sqPut').checked);
      closeModal();
      if (!seq) { settings.lastSeq = [w, h]; saveSettings(); } // příště stejný formát (redaktorka S1: 16:9 klip → nabízelo 9:16)
      if (seq) app.edit('Sequence Settings', () => Object.assign(seq, { name, width: w, height: h, fps }));
      else {
        app.edit('New Sequence', () => {
          const s = newSequence({ name: project.uniqueSeqName(name), width: w, height: h, fps });
          if (m && put) { E.editFromSource(s, m, mIn, mOut, 0, 'overwrite'); s.playhead = E.snapT(s, mOut - mIn); } // hlava za vložený úsek (kolo 5, B1: další výrok jde za něj)
          project.addSequence(s);
        });
        app.timeline.zoomFit();
        if (m && put) autoFace(project.sequences[project.sequences.length - 1], m);
      }
      app.program.refresh();
    };
  });
}
function newSeqFromMedia(m) {
  app.edit('New Sequence From Clip', () => {
    const s = newSequence({ name: project.uniqueSeqName(U.stripExt(m.name)), width: m.hasVideo ? m.width : 1920, height: m.hasVideo ? m.height : 1080, fps: m.hasVideo ? m.fps : 25 });
    E.editFromSource(s, m, 0, m.duration, 0, 'overwrite');
    project.addSequence(s);
  });
  app.timeline.zoomFit();
}
function renameSeq(sq) {
  openModal(`<h2>Rename Sequence</h2><div class="row"><input type="text" id="rn" value="${sq.name.replace(/"/g, '&quot;')}"></div>
    <div class="btns"><button id="rnNo">Cancel</button><button class="primary" id="rnOk">OK</button></div>`, (b) => {
    const ok = () => { const v = b.querySelector('#rn').value.trim(); closeModal(); if (v) app.edit('Rename', () => { sq.name = v; }); renderTabs(); };
    b.querySelector('#rnNo').onclick = closeModal; b.querySelector('#rnOk').onclick = ok;
    b.querySelector('#rn').onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  });
}
function duplicateSeq(sq) {
  app.edit('Duplicate Sequence', () => {
    const c = JSON.parse(JSON.stringify(sq));
    c.id = U.uuid(); c.name = project.uniqueSeqName(sq.name + (TN.lang === 'cs' ? ' kopie' : ' Copy'));
    E.eachTrack(c, (t) => t.clips.forEach((x) => { x.id = U.uid('c'); }));
    project.addSequence(c);
  });
}
async function deleteProjectItem() {
  const sel = app.projectPanel.selected;
  if (!sel) return;
  if (sel.type === 'seq') {
    const sq = project.sequences.find((q) => q.id === sel.id);
    if (!sq) return;
    const r = await ipcRenderer.invoke('dialog', 'message', { type: 'question', buttons: ['Delete', 'Cancel'], defaultId: 1, message: `Delete sequence “${sq.name}”?`, detail: 'You can bring it back with Edit → Undo.' });
    if (r.response === 0) app.edit('Delete Sequence', () => project.deleteSequence(sq.id));
  } else {
    try { project.removeMedia(sel.id); app.projectPanel.clearSelection(); if (app.source.media && app.source.media.id === sel.id) app.source.close(); } catch (e) { app.toast(e.message, true); }
  }
}

/** Krátký postup pro video na sítě (texty rovnou v obou jazycích – modál se nepřekládá slovníkem). */
function socialGuide() {
  const cs = TN.lang === 'cs';
  const steps = cs ? [
    ['Import', 'Soubor → Importovat, nebo přetáhni video do okna. ' + (window.__pzASR ? (window.__pzASR.auto ? '<b>Řeč se přepíše sama hned po importu</b> – v tomto počítači, bez AI. Průběh vidíš u klipu a v záložce <b>Přepis</b> vedle panelu Projekt.' : 'Přepis spustíš pravým klikem na klip → <b>Přepsat řeč</b>.') : '')],
    ['Najdi výrok', 'V záložce <b>Přepis</b> hledej slovo (Ctrl+F) a klikni na větu – nastaví se začátek a konec úseku (Shift+klik přidá další věty). Pak tlačítko <b>Vložit…</b> pod přepisem (do nové sekvence, na konec nebo na hlavu).'],
    ['Střih s AI', 'V panelu AI (vpravo) napiš zadání nebo klikni na rychlou akci – třeba <b>Upoutávka</b>. Stopáž a formát vybereš pod ní. AI postaví <b>novou</b> sekvenci, původní zůstane.'],
    ['Formát pro sítě', '<b>Sekvence → Auto Reframe sekvence</b> – 9:16, 4:5, 1:1 nebo <b>Všechny formáty</b> najednou. Výřez sleduje obličej (v širokém záběru toho, kdo mluví), titulky se přeskládají.'],
    ['Titulky', '<b>Sekvence → Titulky → Vytvořit titulky z přepisu</b> (nebo tlačítko v okně Text v obraze). Bez AI.'],
    ['Text v obraze', '<b>Aa</b> u stopy titulků (nebo Sekvence → Titulky): nadpis nahoře, řádky, velikost, výška, barva, podklad a <b>zvýraznění vyslovovaného slova</b>. Titulek přepíšeš kliknutím na něj.'],
    ['Kontrola', 'U 9:16 tlačítko <b>Bezpečné zóny</b> v monitoru ukáže, co na telefonu zakryje Instagram / TikTok. ' + (media.WEB ? 'Poslechni místa střihů – na webu jsou přibližná.' : 'Před exportem si střih jednou celý poslechni.')],
    ['Export', '<b>Soubor → Exportovat verze pro sítě</b> uloží všechny formáty do jedné složky (titulky vypálené, hlasitost −14 LUFS). Jednu sekvenci: Soubor → Exportovat média.'],
  ] : [
    ['Import', 'File → Import, or drop the video into the window. ' + (window.__pzASR ? (window.__pzASR.auto ? '<b>Speech is transcribed automatically right after import</b> – on this computer, without AI. You see the progress on the clip and on the <b>Transcript</b> tab next to the Project panel.' : 'Start the transcript with a right-click on the clip → <b>Transcribe Speech</b>.') : '')],
    ['Find the quote', 'On the <b>Transcript</b> tab search for a word (Ctrl+F) and click a sentence – it sets the start and end of the part (Shift+click adds more). Then the <b>Insert…</b> button under the transcript (into a new sequence, at the end or at the playhead).'],
    ['Edit with AI', 'In the AI panel (right) write a task or click a quick action – e.g. <b>Teaser</b>. Pick the length and format below it. The AI builds a <b>new</b> sequence; the original stays.'],
    ['Social format', '<b>Sequence → Auto Reframe Sequence</b> – 9:16, 4:5, 1:1 or <b>All Social Formats</b> at once. The crop follows the face (the speaker in wide shots); captions are re-laid out.'],
    ['Captions', '<b>Sequence → Captions → Create Captions from Transcript</b> (or the button in the Text on video window). No AI needed.'],
    ['Text on video', '<b>Aa</b> on the caption track (or Sequence → Captions): headline at the top, lines, size, height, colour, background and <b>highlighting of the spoken word</b>. Click a caption to rewrite it.'],
    ['Check', 'For 9:16 the <b>Safe zones</b> button in the monitor shows what Instagram / TikTok cover on a phone. ' + (media.WEB ? 'Listen to the cut points – on the web they are approximate.' : 'Listen to the whole edit once before exporting.')],
    ['Export', '<b>File → Export Social Versions</b> saves all formats into one folder (captions burned in, loudness −14 LUFS). One sequence: File → Export Media.'],
  ];
  if (!AI_OK) {
    steps.splice(1, 2);
    const ci = steps.findIndex((s) => s[0] === 'Titulky' || s[0] === 'Captions');
    if (ci >= 0) steps[ci] = [steps[ci][0], cs ? 'Titulky z přepisu potřebují přepis řeči – <b>MY Premiere MCP</b> (README, bod 1). Bez něj můžeš titulky napsat ručně (stopa titulků, <b>Aa</b>).'
      : 'Captions from the transcript need speech transcription – <b>MY Premiere MCP</b> (README, step 1). Without it you can type captions by hand (caption track, <b>Aa</b>).'];
  }
  openModal(`<h2>${cs ? 'Jak na video pro sítě' : 'How to make a social video'}</h2>
    <ol class="guide">${steps.map(([h, t]) => `<li><b>${h}</b><span>${t}</span></li>`).join('')}</ol>
    <div class="btns"><button class="primary" id="gdOk">${cs ? 'Rozumím' : 'Got it'}</button></div>`, (b) => { b.querySelector('#gdOk').onclick = closeModal; });
}
function helpDialog() {
  const groups = {
    'Playback': ['Space|Play-Stop Toggle', 'J K L|Shuttle Left / Stop / Right (again = faster)', '← →|Step 1 frame (Shift = 5 frames)', '↑ ↓|Previous / Next Edit Point (targeted tracks)', 'Shift+↑ ↓|Previous / Next Edit Point on Any Track', 'Home End|Go to Start / End', 'Shift+M / Ctrl+Shift+M|Next / Previous Marker', 'Shift+; / Ctrl+Shift+;|Next / Previous Gap', 'PageUp PageDown|Previous / Next screen'],
    'Marks and Editing': ['I O|Mark In / Mark Out', 'Shift+I / O|Go to In / Out', 'X|Mark Clip', '/|Mark Selection', 'Ctrl+Shift+X|Clear In and Out', ',|Insert', '.|Overwrite', ';|Lift', "'|Extract", 'M|Add Marker', 'Ctrl+Alt+M|Clear Marker (Shift = all)', 'F|Match Frame', 'Shift+R|Reverse Match Frame'],
    'Timeline': ['Ctrl+K|Add Edit (targeted tracks)', 'Ctrl+Shift+K|Add Edit to All Tracks', 'Q / W|Ripple Trim Previous / Next Edit to Playhead', 'Shift+Q / Shift+W|Extend Previous / Next Edit to Playhead', 'E|Extend Selected Edit to Playhead', 'Delete|Clear (gap = close it)', 'Shift+Delete, Alt+Backspace|Ripple Delete', 'D|Select Clip at Playhead', 'Ctrl+↑ ↓|Select Previous / Next Clip', 'Alt+← →|Nudge 1 frame (Shift = 5)', 'Alt+↑ ↓|Nudge to track above / below', 'Ctrl+Alt+← →|Slip 1 frame (Shift = 5)', 'Ctrl+X / C / V|Cut / Copy / Paste', 'Ctrl+Shift+V|Paste Insert', 'Ctrl+L|Link / Unlink', 'Shift+E|Enable', 'G|Audio Gain', '[ ]|Clip volume −/+ 1 dB (Shift = 6 dB)', 'Ctrl+D|Cross Dissolve', 'Ctrl+Shift+D|Audio Crossfade', 'Shift+D|Default Transitions', 'Ctrl+0 / Ctrl+9|Toggle all video / audio track targets', 'S|Snap'],
    'Tools': ['V|Selection', 'A / Shift+A|Track Select Forward / Backward', 'B|Ripple Edit', 'N|Rolling Edit', 'C|Razor (Shift+click = all tracks)', 'Y|Slip', 'H|Hand', 'Z|Zoom (Alt = out)', 'Ctrl+drag edge|Ripple Edit with Selection Tool', 'Alt+click|Video or audio only'],
    'View and File': ['= / −|Zoom In / Out', '\\|Zoom to Sequence', 'Ctrl+= / Ctrl+−|Video track height', 'Alt+= / Alt+−|Audio track height', 'Shift+= / Shift+−|Expand / Minimize all tracks', '`|Maximize panel', 'Ctrl+Shift+0 / 1|Program: Fit / 100 %', 'Ctrl+Z / Ctrl+Shift+Z|Undo / Redo', 'Ctrl+S|Save', 'Ctrl+Alt+S|Save a Copy', 'Ctrl+I|Import', 'Ctrl+N|New Sequence', 'Ctrl+F|Search the transcript', 'F2|Fix the caption at the playhead', 'Shift+1 / 2 / 3 / 4|Panel: Project / Source / Timeline / Program', 'Shift+F10|Context menu (Project panel)', 'Ctrl+W|Close Sequence', 'Ctrl+M|Export Media', 'Ctrl+Shift+E|Export Frame', 'F4|AI Panel'],
  };
  openModal(`<h2>Keyboard Shortcuts (Premiere Pro defaults)</h2><p class="hint"><a href="#" id="hGuide">${TN.lang === 'cs' ? 'Nový v programu? Jak na video pro sítě →' : 'New here? How to make a social video →'}</a></p><div class="keys">${Object.entries(groups).map(([g, l]) =>
    `<h3>${g}</h3>` + l.map((x) => { const i = x.lastIndexOf('|'); const d = x.slice(i + 1); let k = x.slice(0, i); if (TN.lang === 'cs') k = k.replace(/Space/g, 'Mezerník').replace(/drag edge/g, 'tažení okraje').replace(/drag/g, 'tažení').replace(/click/g, 'klik'); return `<div><span>${d}</span><kbd>${k}</kbd></div>`; }).join('')).join('')}</div>
    <div class="btns"><button class="primary" id="hOk">Close</button></div>`, (b) => { b.querySelector('#hOk').onclick = closeModal; b.querySelector('#hGuide').onclick = (e) => { e.preventDefault(); closeModal(); socialGuide(); }; });
}

/* ======================================================= import, export */
const MEDIA_FILTER = [{ name: 'Video and audio', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'mxf', 'avi', 'webm', 'mts', 'm2ts', 'wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'] }, { name: 'All files', extensions: ['*'] }];
async function importDialog() {
  const r = await ipcRenderer.invoke('dialog', 'open', { title: 'Import', properties: ['openFile', 'multiSelections'], filters: MEDIA_FILTER, defaultPath: settings.lastImportDir });
  if (r.canceled || !r.filePaths.length) return;
  settings.lastImportDir = path.dirname(r.filePaths[0]); saveSettings();
  await app.importPaths(r.filePaths);
}

function defaultExportPath(s) {
  if (media.WEB) return s.name.replace(/[\\/:*?"<>|]/g, '_') + '.mp4'; // web: složku vybere uživatel v dialogu Chrome
  const dir = cfg.exportDir || settings.lastExportDir || path.join(process.env.USERPROFILE || 'C:\\', 'Videos', BRAND.SHORT_NAME);
  return path.join(dir, s.name.replace(/[\\/:*?"<>|]/g, '_') + '.mp4');
}
function exportDialog() {
  const s = app.seq();
  if (!s) { app.toast('No sequence is open.'); return; }
  const hasIO = s.inPoint !== null || s.outPoint !== null;
  openModal(`<h2 data-w="640">Export – ${s.name.replace(/</g, '&lt;')}</h2>
    <div class="row"><label>Output Name</label><input type="text" id="exOut" value="${defaultExportPath(s).replace(/"/g, '&quot;')}"><button id="exBrowse">…</button></div>
    <div class="row"><label>Format</label><select id="exFmt">${Object.entries(exporter.FORMATS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('')}</select></div>
    <div class="row"><label></label><span class="dim" id="exInfo"></span></div>
    <div class="row" id="exEncRow"><label>Encoder</label><select id="exEnc"><option value="libx264">Software (best quality)</option><option value="h264_nvenc">NVIDIA GPU (NVENC, fast)</option></select></div>
    <div class="row"><label>Loudness</label><select id="exLoud"><option value="off">Off (keep levels)</option><option value="social">Normalize to −14 LUFS (social media)</option><option value="tv">Normalize to −23 LUFS (TV, EBU R128)</option></select></div>
    <div class="row"><label>Source Range</label><select id="exRange"><option value="all">Entire Sequence (${U.timecode(seqDuration(s), s.fps)})</option>${hasIO ? '<option value="inout" selected>Sequence In/Out</option>' : ''}</select></div>
    <div class="row"><label>Captions</label><label style="width:auto"><input type="checkbox" id="exBurn" ${s.captions.length ? 'checked' : ''} ${s.captions.length ? '' : 'disabled'}> burn into video</label>
      <label style="width:auto"><input type="checkbox" id="exSrt" ${s.captions.length ? 'checked' : ''} ${s.captions.length ? '' : 'disabled'}> create sidecar .srt</label></div>
    <div class="bar"><i id="exBar"></i></div><div class="dim" id="exMsg">&nbsp;</div>
    <div class="btns"><button id="exNo">Close</button><button class="primary" id="exGo">Export</button></div>`, (b) => {
    b.querySelector('#exEnc').value = settings.encoder || cfg.videoEncoder || 'libx264';
    // XDCAM jen pro sekvence, které ten formát má (1920×1080 25/29,97/50; 1280×720 50/59,94) – jinak nabídnout H.264 (redaktorka S1: „XDCAM 1080×1920“)
    for (const o of b.querySelectorAll('#exFmt option')) if (o.value === 'xdcam' && !exporter.xdcamOk(s)) { o.disabled = true; o.textContent += LL(' – only 1920×1080 or 1280×720 at 25/50 fps', ' – jen 1920×1080 nebo 1280×720 při 25/50 fps'); }
    const fmt0 = settings.exportFormat || 'h264';
    b.querySelector('#exFmt').value = fmt0 === 'xdcam' && !exporter.xdcamOk(s) ? 'h264' : fmt0;
    // formát pro sítě (9:16, 4:5, 1:1) → rovnou −14 LUFS, pokud si uživatel pro sítě nevybral jinak
    const socialFmt = s.width / s.height < 1.06;
    b.querySelector('#exLoud').value = socialFmt ? (settings.loudnessSocial || 'social') : (settings.loudness || 'off');
    const fmtInfo = () => {
      const k = b.querySelector('#exFmt').value, F = exporter.FORMATS[k];
      const out = b.querySelector('#exOut');
      out.value = out.value.replace(/\.[^.\\/]+$/, '') + '.' + F.ext;
      const a = exporter.audioLabel ? exporter.audioLabel : F.audio === 'aac' ? 'AAC 256 kb/s' : F.audio === 'pcm' ? 'PCM 24-bit 48 kHz' : '2× mono PCM 24-bit 48 kHz';
      b.querySelector('#exInfo').textContent = `${s.width}×${s.height} · ${s.fps} fps · ${a}`;
      // skrýt, ale nechat místo – jinak se dialog zmenší a tlačítko Exportovat uskočí pod kurzorem (redaktorka S1)
      b.querySelector('#exEncRow').style.visibility = ['h264', 'h265', 'mov_h264'].includes(k) && !media.WEB ? '' : 'hidden';
    };
    {
      const offl = new Set();
      for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) { const m = project.mediaById(c.mediaId); if (m && m.missing) offl.add(m.name); }
      if (offl.size) { const el = b.querySelector('#exMsg'); el.textContent = `Media offline: ${[...offl].join(', ')} – the file was moved or renamed. Import it from its new place (File → Import) and the clips reconnect.`; el.style.color = 'var(--danger, #e5484d)'; }
    }
    b.querySelector('#exFmt').onchange = () => {
      fmtInfo();
      // jiný formát = jiný export: starý „✔ Hotovo“ pryč; MXF je pro TV → hlasitost −23 LUFS, když byla vypnutá
      b.querySelector('#exMsg').innerHTML = '&nbsp;'; b.querySelector('#exBar').style.width = '0%';
      // MXF = TV → −23 LUFS; zpátky na MP4/MOV vrátit hlasitost, kterou měl dialog předtím (redaktorka + vzhled S2)
      const lo = b.querySelector('#exLoud'), mxf = exporter.FORMATS[b.querySelector('#exFmt').value].ext === 'mxf';
      if (mxf && lo.value !== 'tv') { lo.dataset.before = lo.value; lo.value = 'tv'; } else if (!mxf && lo.dataset.before) { lo.value = lo.dataset.before; delete lo.dataset.before; }
      // MXF pro TV: titulky zvlášť (.srt), ne vypálené do obrazu (redaktorka S5); zpět na MP4 = vypálit, jako výchozí
      const burn = b.querySelector('#exBurn'), srt = b.querySelector('#exSrt');
      if (burn && !burn.disabled) { burn.checked = !mxf; if (mxf && srt) srt.checked = true; }
    };
    fmtInfo();
    if (exporter.FORMATS[b.querySelector('#exFmt').value].ext === 'mxf') {
      if (!b.querySelector('#exBurn').disabled) { b.querySelector('#exBurn').checked = false; b.querySelector('#exSrt').checked = true; }
      // předvybrané MXF (po minulém exportu MXF) = TV −23 LUFS, ne hlasitost pro MP4 (redaktorka S9: MXF s −14 LUFS)
      const lo = b.querySelector('#exLoud'); if (lo.value !== 'tv') { lo.dataset.before = lo.value; lo.value = 'tv'; }
    }
    b.querySelector('#exBrowse').onclick = async () => {
      const r = await ipcRenderer.invoke('dialog', 'save', { title: 'Export', defaultPath: b.querySelector('#exOut').value, filters: [{ name: exporter.FORMATS[b.querySelector('#exFmt').value].label, extensions: [exporter.FORMATS[b.querySelector('#exFmt').value].ext] }] });
      if (!r.canceled && r.filePath) b.querySelector('#exOut').value = r.filePath;
    };
    let signal = null;
    b.querySelector('#exNo').onclick = () => { if (signal) { signal.cancelled = true; if (signal.kill) signal.kill(); } else closeModal(); };
    b.querySelector('#exGo').onclick = async () => {
      b.querySelector('#exMsg').style.color = '';
      const out = b.querySelector('#exOut').value.trim();
      if (!out) return;
      // existující soubor nepřepsat bez dotazu (redaktorka S4)
      if (!media.WEB && fs.existsSync(out)) {
        const q = await ipcRenderer.invoke('dialog', 'message', { type: 'question', buttons: ['Replace', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true, message: `The file ${path.basename(out)} already exists.`, detail: 'Do you want to replace it?' });
        if (q.response !== 0) return;
      }
      settings.lastExportDir = path.dirname(out); settings.encoder = b.querySelector('#exEnc').value;
      settings.exportFormat = b.querySelector('#exFmt').value;
      // MXF má vlastní výchozí hlasitost (TV −23) – nepřenášet ji do příštího exportu MP4 (redaktorka S8)
      if (exporter.FORMATS[settings.exportFormat].ext !== 'mxf') { if (s.width / s.height < 1.06) settings.loudnessSocial = b.querySelector('#exLoud').value; else settings.loudness = b.querySelector('#exLoud').value; }
      saveSettings();
      signal = {};
      $('modal').dataset.busy = '1';
      b.querySelector('#exGo').disabled = true;
      b.querySelector('#exNo').textContent = 'Cancel';
      const t0 = Date.now();
      try {
        const r = await exporter.exportSequence(project, s, {
          output: out, range: b.querySelector('#exRange').value, burnCaptions: b.querySelector('#exBurn').checked, srtSidecar: b.querySelector('#exSrt').checked,
          encoder: b.querySelector('#exEnc').value, format: b.querySelector('#exFmt').value, loudness: b.querySelector('#exLoud').value, signal,
          onProgress: (p, msg) => { b.querySelector('#exBar').style.width = Math.round(p * 100) + '%'; b.querySelector('#exMsg').textContent = `${Math.round(p * 100)} % ${msg || ''}`; },
        });
        b.querySelector('#exMsg').innerHTML = `✔ Done in ${Math.round((Date.now() - t0) / 1000)} s · ${r.sizeMB >= 10 ? Math.round(r.sizeMB) : r.sizeMB.toLocaleString(TN.lang === 'cs' ? 'cs-CZ' : 'en-US', { maximumFractionDigits: 1 })} MB · <a href="#" id="exShow" style="color:var(--accent2)">reveal in Explorer</a>`;
        b.querySelector('#exShow').onclick = (e) => { e.preventDefault(); ipcRenderer.invoke('reveal', r.output); };
      } catch (e) {
        // zrušené systémové okno uložení: dialog zůstane, stačí zkusit znovu
        if (e && e.name === 'AbortError') { $('modal').dataset.pickEnd = String(Date.now()); b.querySelector('#exMsg').textContent = LL('Saving cancelled – click Export to choose where to save.', 'Ukládání zrušeno – klikni na Exportovat a vyber, kam uložit.'); b.querySelector('#exBar').style.width = '0%'; }
        else { b.querySelector('#exMsg').textContent = '✖ ' + e.message; b.querySelector('#exMsg').style.color = 'var(--danger, #e5484d)'; }
      } finally {
        delete $('modal').dataset.busy;
        signal = null;
        b.querySelector('#exGo').disabled = false;
        b.querySelector('#exNo').textContent = 'Close';
      }
    };
  });
}

/**
 * Verze pro sítě do jedné složky: sekvence „<název> 9x16 / 4x5 / 1x1“ (z Auto Reframe) – nebo jen aktivní, když jiné
 * nejsou. Titulky a nadpis se vypálí, hlasitost −14 LUFS, soubory pojmenované podle sekvencí.
 */
async function exportSocial() {
  const s = app.seq(); if (!s) { app.toast('No sequence is open.'); return; }
  const base = s.name.replace(/ (9x16|4x5|1x1)( \d+)?$/, '');
  // ke každému formátu nejnovější verze („… 9x16“, „… 9x16 2“ …) – po opakovaném Auto Reframe ta poslední
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
  let list = ['9x16', '4x5', '1x1'].map((f) => { const re = new RegExp('^' + esc + ' ' + f + '( \\d+)?$'); return project.sequences.filter((x) => re.test(x.name)).pop(); }).filter(Boolean);
  if (!list.length) list = [s];
  let outFor;
  if (window.__pzPickExportDir) {
    outFor = await window.__pzPickExportDir();
    if (!outFor) return;
  } else {
    const r = await ipcRenderer.invoke('dialog', 'open', { title: 'Folder for the social versions', properties: ['openDirectory', 'createDirectory'], defaultPath: settings.lastExportDir || undefined });
    if (!r || r.canceled || !r.filePaths || !r.filePaths.length) return;
    const dir = r.filePaths[0];
    settings.lastExportDir = dir; saveSettings();
    outFor = async (name) => path.join(dir, name);
  }
  const done = [];
  try {
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      const name = q.name.replace(/[\\/:*?"<>|]/g, '_') + '.mp4';
      const out = await outFor(name);
      await exporter.exportSequence(project, q, {
        output: out, range: 'all', burnCaptions: true, srtSidecar: false, encoder: settings.encoder || cfg.videoEncoder || 'libx264', format: 'h264', loudness: 'social',
        onProgress: (p) => app.status(`Export ${i + 1}/${list.length} – ${q.name} ${Math.round(p * 100)} %`),
      });
      done.push(name);
    }
    app.status('');
    app.toast(`Exported: ${done.join(' · ')}`);
  } catch (e) { app.status(''); app.toast(e.message, true); }
}

/* ======================================================= projekt: uložit / otevřít */
async function saveProject(as) {
  let p = project.path;
  if (as || !p) {
    const r = await ipcRenderer.invoke('dialog', 'save', {
      title: 'Save Project', defaultPath: (p && p.toLowerCase().endsWith('.' + BRAND.PROJECT_EXT)) ? p : path.join(settings.lastProjectDir || path.join(process.env.USERPROFILE || 'C:\\', 'Documents'), projBaseName() + '.' + BRAND.PROJECT_EXT),
      filters: [{ name: (TN.lang === 'cs' ? `Projekt ${BRAND.SHORT_NAME}` : `${BRAND.SHORT_NAME} project`), extensions: [BRAND.PROJECT_EXT] }],
    });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  writeProject(p);
  if (!media.WEB) dropAutosave();
  project.path = p;
  project.name = U.baseName(p).replace(/\.(pzcut|tnproj)$/i, '');
  project.dirty = false;
  settings.lastProject = p; settings.lastProjectDir = path.dirname(p); saveSettings();
  updateTitle();
  app.status('Saved: ' + p);
  return p;
}
function writeProject(p) {
  const tmp = p + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(project.toJSON(), null, 1), 'utf8');
    fs.renameSync(tmp, p);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch (x) { /* */ }
    // pád a obnova S12: soubor jen pro čtení / složka bez práva zápisu – dřív žádná hláška, jen „*“ a .tmp
    throw new Error(`Cannot save the project to ${p} – the file is read-only or the folder is not writable. Save it elsewhere (File → Save As).`);
  }
}
function loadProjectFile(p, asUntitled, data0) {
  let data = data0;
  if (!data) {
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new Error(`${U.baseName(p)} is not a readable project file (damaged or unfinished).`); }
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.sequences) || !Array.isArray(data.media)) throw new Error(`${U.baseName(p)} is not a ${BRAND.SHORT_NAME} project.`);
  require('./ui/captionstyle').discardCaptionStyle();
  app.source.close();
  app.waves.clear();
  project.load(data, asUntitled ? null : p);
  if (asUntitled) { project.dirty = true; }
  // Bezpečnost S13: projekt z cizí ruky může odkazovat na \\server\… – Windows by se při pouhém ověření existence souboru
  // připojil a poslal přihlašovací hash. Náhledové kopie jen z vlastní cache; média na serveru, kterému uživatel ještě
  // nedůvěřoval, zůstanou offline, dokud připojení nepotvrdí (servery si pamatujeme – redakční disky se ptají jen jednou).
  // \\server\… a //server/… = síť; \\?\C:\… (dlouhá místní cesta) ne, \\?\UNC\server\… ano
  const uncHost = (q) => {
    const mm = /^(?:\\\\|\/\/)([^\\/]+)[\\/]?([^\\/]*)[\\/]?([^\\/]*)/.exec(String(q || ''));
    if (!mm) return null;
    if (mm[1] === '?' || mm[1] === '.') return /^unc$/i.test(mm[2]) ? (mm[3] || '').toLowerCase() || null : (mm[1] === '.' ? '.' : null);
    return mm[1].toLowerCase();
  };
  const trusted = new Set((settings.trustedHosts || []).map((h) => String(h).toLowerCase()));
  const askHosts = new Set();
  for (const m of project.media) {
    if (m.proxy && !path.resolve(m.proxy).toLowerCase().startsWith(path.resolve(media.CACHE).toLowerCase())) delete m.proxy;
    const h = uncHost(m.path);
    if (h && !trusted.has(h)) { m.uncBlocked = true; askHosts.add(h); }
  }
  if (askHosts.size && !media.WEB) setTimeout(() => askNetworkHosts([...askHosts]), 300);
  importer.relink(project);
  for (const m of project.media) { loadThumb(m); }
  app.projectPanel.render();
  renderTabs();
  updateTitle();
  const miss = project.media.filter((m) => m.missing);
  if (miss.length && !media.WEB) setTimeout(() => { app.toast(`Media offline: ${miss.map((m) => m.name).join(', ')} – the file was moved or renamed. Import it from its new place (File → Import) and the clips reconnect.`, true); if (app.program && app.program.ui) app.program.ui(); }, 400);
}
/** Dotaz na připojení k síťovým serverům z projektu (bezpečnost S13). */
async function askNetworkHosts(hosts) {
  const cs = TN.lang === 'cs';
  const r = await ipcRenderer.invoke('dialog', 'message', {
    type: 'question', noLink: true, defaultId: 0, cancelId: 1,
    buttons: cs ? ['Připojit', 'Nepřipojovat'] : ['Connect', 'Do not connect'],
    message: cs ? `Projekt odkazuje na média na síti: ${hosts.map((h) => '\\\\' + h).join(', ')}` : `The project uses media on the network: ${hosts.map((h) => '\\\\' + h).join(', ')}`,
    detail: cs ? 'Připoj se jen k serverům, které znáš (třeba redakční disk). U projektu z neznámého zdroje zvol Nepřipojovat – média zůstanou offline.'
      : 'Only connect to servers you know (e.g. the newsroom drive). For a project from an unknown source choose Do not connect – the media stay offline.',
  }).catch(() => ({ response: 1 }));
  if (r.response !== 0) { app.toast(cs ? 'Média na síti zůstala offline.' : 'Network media stay offline.'); return; }
  settings.trustedHosts = [...new Set([...(settings.trustedHosts || []), ...hosts])]; saveSettings();
  for (const m of project.media) if (m.uncBlocked) delete m.uncBlocked;
  importer.relink(project);
  for (const m of project.media) loadThumb(m);
  app.projectPanel.render(); app.timeline.render(); if (app.program && app.program.ui) app.program.ui();
}
async function openProjectDialog() {
  if (!(await confirmDiscard())) return;
  const r = await ipcRenderer.invoke('dialog', 'open', { title: 'Open Project', properties: ['openFile'], filters: [{ name: (TN.lang === 'cs' ? `Projekt ${BRAND.SHORT_NAME}` : `${BRAND.SHORT_NAME} project`), extensions: BRAND.PROJECT_EXTS }], defaultPath: settings.lastProjectDir });
  if (r.canceled || !r.filePaths.length) return;
  try { loadProjectFile(r.filePaths[0]); settings.lastProject = r.filePaths[0]; saveSettings(); } catch (e) { app.toast('Cannot open the project: ' + e.message, true); }
}
async function newProject() {
  if (!(await confirmDiscard())) return;
  require('./ui/captionstyle').discardCaptionStyle();
  if (window.__pzAI && window.__pzAI.clearTasks) window.__pzAI.clearTasks(); // zadání pro AI ze starého projektu
  app.source.close();
  app.waves.clear();
  app.sel = new Set();
  project.load({ name: 'Untitled', media: [], sequences: [] }, null);
  importer.relink(project); // skryje lištu „Nenalezená média“ starého projektu
  settings.lastProject = null; saveSettings();
  // záloha musí být prázdná hned – po F5 se nesmí vrátit starý projekt (ani jeho nadpis)
  try { if (fs.existsSync(AUTOSAVE)) fs.unlinkSync(AUTOSAVE); } catch (e) { /* bez zálohy */ }
  app.projectPanel.render();
  renderTabs();
  app.timeline.render();
  app.program.reset();
  app.status('');
  updateTitle();
}
async function confirmDiscard() {
  if (!project.dirty) return true;
  const r = await ipcRenderer.invoke('dialog', 'message', { type: 'question', buttons: ['Save', "Don't Save", 'Cancel'], defaultId: 0, cancelId: 2, message: 'Save changes to the project?' });
  if (r.response === 2) return false;
  if (r.response === 0) return !!(await saveProject(false));
  if (!media.WEB) dropAutosave(); // Neukládat: změny zahodit i ze zálohy (jinak by se po startu „obnovily“)
  return true;
}
async function confirmClose() {
  if (await confirmDiscard()) { try { if (fs.existsSync(AUTOSAVE) && !project.dirty) fs.unlinkSync(AUTOSAVE); } catch (e) {} ipcRenderer.send('closeNow'); }
}
// automatické uložení každou minutu. Desktop: jen do záložního souboru (jako Premiere Auto-Save) – soubor projektu přepíše
// až Ctrl+S, takže pokus jde zahodit („Neukládat“). Redaktorka S3: značka byla v .pzcut za 43 s bez uložení, „*“ zmizela.
// Web: do projektu (zápis do prohlížeče, jiný model ukládání).
setInterval(() => {
  if (!project.dirty || window.__pzAutosaveOff) return; // web: v jiné kartě se pracuje → tady neukládat
  try {
    if (media.WEB && project.path) { writeProject(project.path); project.dirty = false; updateTitle(); app.status('Auto-saved'); }
    else { const j = project.toJSON(); j.autosaveOf = project.path || null; fs.writeFileSync(AUTOSAVE, JSON.stringify(j), 'utf8'); }
  } catch (e) { console.warn('autosave', e.message); }
}, media.WEB ? 10000 : 60000); // web: častěji (zápis do prohlížeče je levný)
const dropAutosave = () => { try { if (fs.existsSync(AUTOSAVE)) fs.unlinkSync(AUTOSAVE); } catch (e) { /* bez zálohy */ } };

/* ======================================================= AI panel a most */
// Port mostu: standardní 7880 (jako panel v Premiere – funguje tak i Claude v aplikaci s pluginem). Když na něm
// už běží panel v Premiere, Střihátko vezme 7890 a agentům port předá (PMCP_PORT / vlastní mcp.json).
let BRIDGE_PORT = Number(cfg.bridgePort) || 7880;
function portFree(port) {
  return new Promise((res) => {
    const srv = require('net').createServer();
    srv.once('error', () => res(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => res(true)));
  });
}
(async () => {
  if (media.WEB) { $('aiFrame').src = 'ai-web.html'; return; } // webová verze: AI přes Claude Desktop (web/ai-web.html)
  if (cfg.bridgePort === 'auto' || !Number(cfg.bridgePort)) BRIDGE_PORT = (await portFree(7880)) ? 7880 : 7890;
  process.env.PMCP_PORT = String(BRIDGE_PORT);
  window.TN.bridgePort = BRIDGE_PORT;
  $('aiFrame').src = AI_OK ? 'ai/index.html' : 'ai-missing.html'; // bez MY Premiere MCP vysvětlení místo nefunkčních karet
})();
const api = createApi(project, {
  isSelected: (id) => app.sel.has(id),
  save: () => (project.path ? (writeProject(project.path), project.dirty = false, updateTitle(), project.path) : saveProject(false)),
  exportProgress: (p, msg) => app.status(`Export ${Math.round(p * 100)} % ${msg || ''}`),
  progress: (msg) => app.status(msg),
  edgeShots: (s, opts) => (window.__pzEdgeShots ? window.__pzEdgeShots(s, opts) : null),
});
app.api = api;

/** Vyhodnocení „ExtendScriptu“ z panelu: PMCP.call(name, json) -> API Střihátka. */
async function evalScript(code) {
  if (/\$\.evalFile\(/.test(code)) return 'function';
  const m = code.match(/^\s*PMCP\.call\(\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")\s*\)\s*;?\s*$/s);
  if (!m) return JSON.stringify({ error: 'PZ AI Cut Standalone has no ExtendScript (run_extendscript / yt_* tools work only in Premiere). Use the editing tools (build_sequence_from_transcript, plan_edit_local…).' });
  const name = JSON.parse(m[1]);
  let args;
  try { args = JSON.parse(JSON.parse(m[2]) || '{}'); } catch (e) { return JSON.stringify({ ok: false, error: 'Invalid arguments' }); }
  const fn = Object.prototype.hasOwnProperty.call(api, name) && typeof api[name] === 'function' ? api[name] : null;
  if (!fn) return JSON.stringify({ ok: false, error: 'Unknown function: ' + name });
  try {
    const result = await fn(args || {});
    if (name !== 'projectInfo' && name !== 'getSequence' && name !== 'ping' && name !== 'listItems' && name !== 'getMarkers') {
      // čitelný název kroku místo interního názvu funkce (vzhled S1: „AI: addMarkers“)
      const STEP = { importFiles: 'Import Media', buildSequence: 'Build Sequence', buildTimeline: 'Build Timeline', razor: 'Add Edit', removeRanges: 'Extract Ranges',
        removeClips: 'Clear Clips', addMarkers: 'Add Markers', setPlayhead: 'Set Playhead', exportSequence: 'Export', saveProject: 'Save', openSequence: 'Open Sequence',
        reframeSequence: 'Auto Reframe Sequence', deleteSequences: 'Delete Sequences', undo: 'Undo', addCaptions: 'Captions', detectSceneCuts: 'Detect Camera Cuts' };
      app.status('AI: ' + (STEP[name] || name));
      if (/^build|reframe|import/.test(name)) app.timeline.zoomFit();
    }
    return JSON.stringify({ ok: true, result });
  } catch (e) {
    // MCP (AI) mluví česky – chyby přes most přeložit (AI tok S8: česká předpona, anglický text)
    return JSON.stringify({ ok: false, error: require('./core/lang').tr(String(e && e.message || e)) });
  }
}
window.TN = { aiRoot: cfg.aiRoot, bridgePort: BRIDGE_PORT, evalScript, app, handleKey: (ev) => handleKey(ev), lang: settings.lang ? (settings.lang === 'cs' ? 'cs' : 'en') : (/^(cs|sk)/i.test((typeof navigator !== 'undefined' && navigator.language) || '') ? 'cs' : 'en') }; // bez volby podle jazyka prohlížeče (kolegové v TN = česky)

/* ======================================================= jazyk rozhraní (vlaječky nahoře vpravo) */
const FLAGS = {
  cs: '<svg viewBox="0 0 30 20" width="24" height="16"><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0 15 10 0 20z" fill="#11457e"/></svg>',
  en: '<svg viewBox="0 0 38 20" width="24" height="16"><rect width="38" height="20" fill="#b22234"/>'
    + [1, 3, 5, 7, 9, 11].map((i) => `<rect y="${(i * 20 / 13).toFixed(2)}" width="38" height="${(20 / 13).toFixed(2)}" fill="#fff"/>`).join('')
    + '<rect width="15.2" height="10.77" fill="#3c3b6e"/>'
    + [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((c) => `<circle cx="${1.3 + c * 2.5 + (r % 2) * 1.25}" cy="${1.2 + r * 2.1}" r=".45" fill="#fff"/>`).join('')).join('')
    + '</svg>',
};
function renderLangSwitch() {
  const el = $('langSw');
  el.innerHTML = ['cs', 'en'].map((l) => `<button class="lang-btn${TN.lang === l ? ' on' : ''}" data-lang="${l}" title="${l === 'cs' ? 'Čeština' : 'English'}">${FLAGS[l]}</button>`).join('');
  el.querySelectorAll('button').forEach((b) => { b.onclick = () => setLanguage(b.dataset.lang); });
}
// AI panel se při změně jazyka načte znovu (jeho vlastní překlad do angličtiny se zapíná jen v režimu „en“) –
// ale ne uprostřed běžící úlohy: to se počká, až doběhne
let aiReloadTimer = null;
function aiBusy() {
  try { const d = $('aiFrame').contentDocument; const st = d && d.getElementById('stop'); return !!(st && getComputedStyle(st).display !== 'none' && !st.disabled); } catch (e) { return false; }
}
function reloadAiPanel() {
  clearInterval(aiReloadTimer);
  if (!$('aiFrame').getAttribute('src')) return;
  if (!aiBusy()) { $('aiFrame').contentWindow.location.reload(); return; }
  app.status(i18n.tr('The AI panel switches language when the task finishes.'));
  aiReloadTimer = setInterval(() => { if (!aiBusy()) { clearInterval(aiReloadTimer); $('aiFrame').contentWindow.location.reload(); } }, 2000);
}
function setLanguage(l, initial) {
  l = l === 'cs' ? 'cs' : 'en';
  const changed = l !== TN.lang;
  TN.lang = l;
  settings.lang = l; saveSettings();
  i18n.setLang(l);
  renderLangSwitch();
  if (app.program && app.program.ui) app.program.ui(); // úvodní obrazovka v monitoru je v jazyce rozhraní
  if (changed && !initial) { app.status(''); reloadAiPanel(); app.projectPanel.render(); app.timeline.render(); app.updatePlayButtons && app.updatePlayButtons(); if (app.transcript && app.transcript.relang) app.transcript.relang(); if (app.captionList && app.captionList.visible) app.captionList.render(); require('./ui/captionstyle').relangCaptionStyle(app); repaintAiRail(); }
}
commands.setLang = (l) => {
  if (exporter.exportSequence.active && exporter.exportSequence.active() > 0) {
    app.toast('Language changes after the export finishes.');
    clearInterval(app._langWait);
    app._langWait = setInterval(() => { if (exporter.exportSequence.active() === 0) { clearInterval(app._langWait); setLanguage(l); } }, 500);
    return;
  }
  setLanguage(l);
};
// ovládání AI panelu (layout.js) se překládá jen v češtině – v angličtině běží uvnitř panelu jeho vlastní překlad
let aiErrReloads = 0;
$('aiFrame').addEventListener('load', () => {
  // zablokovaná cizí navigace (main.js will-frame-navigate) nechá panel na chybové stránce Chromia – vrátit ho
  // na vlastní stránku (S13 Bezpečnost N3); pojistka proti smyčce
  let here = '';
  try { here = $('aiFrame').contentWindow.location.href; } catch (e) { here = 'cizí'; }
  const own = $('aiFrame').getAttribute('src');
  if (own && !/^(file:|about:)/.test(here) && !media.WEB && aiErrReloads < 3) {
    aiErrReloads++;
    $('aiFrame').src = 'about:blank';
    setTimeout(() => { $('aiFrame').src = own; }, 50);
    return;
  }
  if (/^file:/.test(here)) aiErrReloads = 0;
  try {
    const d = $('aiFrame').contentDocument;
    if (TN.lang === 'cs' && d.documentElement.lang === 'cs') i18n.observe(d);
  } catch (e) { /* jiný původ */ }
});
i18n.observe(document);
setLanguage(TN.lang, true);

/** Panel AI: otevřený, nebo sbalený do pruhu 36 px (design-2 §2.1) – nikdy úplně skrytý. user = volba uživatele
 *  (tlačítko, F4, menu, »), jen ta se pamatuje; bez volby: AI nepřipojená → sbaleno, připojení → otevřít. */
function setAiPanel(open, user) {
  const p = $('aiPanel'), sp = $('aiSplit');
  p.classList.remove('hidden');
  p.classList.toggle('collapsed', !open);
  sp.classList.toggle('hidden', !open);
  $('btnAi').classList.toggle('on', open);
  if (user) { settings.aiPanel = open ? 'open' : 'collapsed'; delete settings.aiHidden; saveSettings(); }
  // otevření panelu AI = uživatel čeká připojení: hledat konektor hned, ne až po řídkém intervalu
  if (open && user && window.__pzAI && window.__pzAI.state && window.__pzAI.state.state !== 'connected') window.__pzAI.retry();
  setTimeout(() => { app.program.layout(); app.source.layout(); app.timeline.render(); }, 30);
}
function toggleAi(force) {
  const open = force !== undefined ? !!force : $('aiPanel').classList.contains('collapsed');
  setAiPanel(open, true);
}
$('aiRailBtn').onclick = () => toggleAi(true);
// stav AI v pruhu (tečka) a automatické otevření při připojení, když si uživatel nic nevybral
let lastAiState = null, repaintAiRail = () => {};
(function watchAi() {
  const AI = window.__pzAI;
  if (!AI) { if ((watchAi.n = (watchAi.n || 0) + 1) < 20) setTimeout(watchAi, 500); return; }
  let was = null;
  AI.on((S) => { lastAiState = S; paintAiRail(S); });
  function paintAiRail(S) {
    const on = S.state === 'connected';
    const busy = on && S.lastCall && Date.now() - S.lastCall < 4000;
    const dot = $('aiRailDot');
    dot.className = 'ai-dot' + (busy ? ' busy' : on ? ' on' : '');
    const who = (S.clients || []).join(' + ');
    const cs = TN.lang === 'cs';
    $('aiRailBtn').title = cs ? 'Otevřít panel AI (F4) – ' + (busy ? 'AI pracuje na zadání' : on ? who + ' připojen' : 'AI není připojena') : 'Open the AI panel (F4) – ' + (busy ? 'AI is working on a task' : on ? who + ' connected' : 'AI not connected');
    if (on !== was) { if (!settings.aiPanel) setAiPanel(on, false); was = on; }
  }
  repaintAiRail = () => { if (lastAiState) paintAiRail(lastAiState); };
})();

function pingBridge() {
  const req = http.get({ host: '127.0.0.1', port: BRIDGE_PORT, path: '/ping', timeout: 1500 }, (res) => {
    let b = ''; res.on('data', (d) => { b += d; });
    res.on('end', () => {
      let ok = false; try { ok = JSON.parse(b).app === 'TNSTRIH'; } catch (e) {}
      const el = $('bridgeState');
      el.className = 'bridge ' + (ok ? 'on' : 'off');
      el.textContent = ok ? `bridge :${BRIDGE_PORT}` : `port ${BRIDGE_PORT} is used by another program`;
    });
  });
  req.on('error', () => { const el = $('bridgeState'); el.className = 'bridge off'; el.textContent = 'bridge not running (AI panel)'; });
  req.on('timeout', () => req.destroy());
}
if (!media.WEB && AI_OK) { setInterval(pingBridge, 5000); setTimeout(pingBridge, 2500); }
else if (!media.WEB) { const el = $('bridgeState'); if (el) { el.className = 'bridge off'; el.textContent = 'AI not installed'; } }
if (!AI_OK) {
  setTimeout(() => app.toast(LL('AI is not installed – editing, 9:16 and export work. For transcription and AI install MY Premiere MCP (README, step 1).',
    'AI není nainstalovaná – střih, 9:16 a export fungují. Pro přepis a AI nainstaluj MY Premiere MCP (README, bod 1).')), 1500);
}
// bez ffmpeg nejde import ani export – na čerstvém PC z přenosného zipu (S14 Nováček)
function installFfmpeg() {
  const cs = TN.lang === 'cs';
  try {
    require('child_process').spawn('cmd.exe', ['/c', 'start', '"ffmpeg"', 'cmd.exe', '/k', 'winget install -e --id Gyan.FFmpeg'], { detached: true, windowsHide: false, shell: false, windowsVerbatimArguments: true }).unref();
    app.toast(cs ? 'Instalace ffmpeg běží v novém okně – potvrď ji tam. Pak zkus import znovu (aplikaci není třeba restartovat).'
      : 'ffmpeg is being installed in a new window – confirm it there. Then try the import again (no restart needed).');
  } catch (e) {
    require('electron').shell.openExternal('https://www.gyan.dev/ffmpeg/builds/');
  }
}
if (!media.WEB && media.ffmpegMissing && media.ffmpegMissing()) {
  setTimeout(async () => {
    const cs = TN.lang === 'cs';
    const r = await ipcRenderer.invoke('dialog', 'message', {
      type: 'warning', noLink: true, defaultId: 0, cancelId: 1,
      buttons: cs ? ['Nainstalovat ffmpeg', 'Později'] : ['Install ffmpeg', 'Later'],
      message: cs ? 'Chybí program ffmpeg' : 'ffmpeg is missing',
      detail: cs ? 'Bez něj nejde načíst ani exportovat video. Instalace proběhne přes winget (Windows) v novém okně: winget install Gyan.FFmpeg. Později ji najdeš v menu Nápověda → Nainstalovat ffmpeg.'
        : 'Without it videos cannot be opened or exported. It installs via winget (Windows) in a new window: winget install Gyan.FFmpeg. Later: Help → Install ffmpeg.',
    }).catch(() => ({ response: 1 }));
    if (r.response === 0) installFfmpeg();
  }, 1200);
}

/* ======================================================= rozdělovače panelů */
document.querySelectorAll('[data-split]').forEach((sp) => {
  sp.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    const kind = sp.dataset.split;
    const startX = ev.clientX, startY = ev.clientY;
    const top = $('topRow'), proj = $('projectPanel'), src = $('sourcePanel'), ai = $('aiPanel');
    const h0 = top.getBoundingClientRect().height, w0 = proj.getBoundingClientRect().width, s0 = src.getBoundingClientRect().width, a0 = ai.getBoundingClientRect().width;
    const move = (e) => {
      if (kind === 'rows') top.style.height = Math.max(150, h0 + e.clientY - startY) + 'px';
      else if (kind === 'project') proj.style.width = Math.max(180, w0 + e.clientX - startX) + 'px';
      else if (kind === 'monitors') { src.style.flex = 'none'; src.style.width = Math.max(180, s0 + e.clientX - startX) + 'px'; }
      else if (kind === 'ai') ai.style.width = Math.max(280, a0 - (e.clientX - startX)) + 'px';
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      settings.layout = { top: top.style.height, proj: proj.style.width, src: src.style.width, ai: ai.style.width }; saveSettings();
      app.program.layout(); app.source.layout(); app.timeline.render();
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });
});
if (settings.layout) {
  const L = settings.layout;
  if (L.top) $('topRow').style.height = L.top;
  if (L.proj) $('projectPanel').style.width = L.proj;
  if (L.src) { $('sourcePanel').style.flex = 'none'; $('sourcePanel').style.width = L.src; }
  if (L.ai) $('aiPanel').style.width = L.ai;
}
// převod staré volby; web bez volby začíná sbalený (AI se teprve připojuje), desktop otevřený jako dřív
if (settings.aiHidden && !settings.aiPanel) settings.aiPanel = 'collapsed';
if (settings.aiPanel) setAiPanel(settings.aiPanel === 'open', false);
else if (media.WEB) setAiPanel(false, false);

// soubory přetažené kamkoli do okna = import
window.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); });
window.addEventListener('drop', (ev) => {
  if (ev.defaultPrevented) return;
  ev.preventDefault();
  const paths = require('./core/dropfiles').droppedPaths(ev.dataTransfer);
  if (paths.length) app.importPaths(paths);
});

/* ======================================================= ikony, Fit, Export Frame, pohled Projektu */
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon] || ''; });
for (const id of ['srcFit', 'prgFit']) {
  $(id).addEventListener('change', () => { app.program.layout(); app.source.layout(); });
}
/** Export Frame (fotoaparát v monitoru): aktuální snímek Zdroje nebo Programu jako PNG v plném rozlišení. */
async function exportFrame() {
  let m, t;
  if (app.focus === 'source' && app.source.media) { m = app.source.media; t = app.source.time; } else {
    const s = app.seq(); if (!s) return;
    const c = app.program.player.topVideo(s, s.playhead);
    if (!c) { app.toast('No video at the playhead.'); return; }
    m = project.mediaById(c.mediaId); t = c.in + (s.playhead - c.start);
  }
  const dir = settings.lastExportDir || path.join(process.env.USERPROFILE || 'C:\\', 'Pictures');
  const r = await ipcRenderer.invoke('dialog', 'save', { title: 'Export Frame', defaultPath: path.join(dir, `${U.stripExt(m.name)} ${U.timecode(t, m.fps || 25).replace(/:/g, '-')}.png`), filters: [{ name: 'PNG', extensions: ['png'] }] });
  if (r.canceled || !r.filePath) return;
  try {
    if (media.exportFramePng) await media.exportFramePng(m.path, t, r.filePath); // webová verze
    else await media.run(media.FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', t.toFixed(3), '-i', m.path, '-frames:v', '1', r.filePath]);
    app.toast('Frame exported: ' + U.baseName(r.filePath));
  } catch (e) { app.toast(e.message, true); }
}
// Projekt: dlaždice / seznam a velikost náhledů (jako v Premiere)
function setProjView(v) {
  settings.projView = v; saveSettings();
  $('projList').classList.toggle('icons', v === 'icons');
  $('btnIconView').classList.toggle('on', v === 'icons');
  $('btnListView').classList.toggle('on', v !== 'icons');
  app.projectPanel.render();
}
$('btnIconView').onclick = () => setProjView('icons');
$('btnListView').onclick = () => setProjView('list');
$('thumbSize').addEventListener('input', () => { $('projList').style.setProperty('--thumb', $('thumbSize').value + 'px'); settings.thumbSize = $('thumbSize').value; saveSettings(); });
if (settings.thumbSize) { $('thumbSize').value = settings.thumbSize; $('projList').style.setProperty('--thumb', settings.thumbSize + 'px'); }
setProjView(settings.projView || 'icons');

/** Záběr na šířku vložený do prázdné sekvence na výšku: výřez podle obličeje hned (jinak výřez na střed = často stůl). */
/** B-roll vložený do V2+ přes jiný obraz: zbytek cizího záběru na jeho kraji odstřihnout hned (kontrolor S6), Ctrl+Z vrátí.
 *  span = [{track, a, b}] vložené klipy; i po výřezu podle obličeje v sekvenci na výšku (kontrolor S9: větev výřezu úklid
 *  přeskočila – 7 snímků celku na kraji b-rollu v 9:16). */
function edgeCleanup(s, span, withV1) {
  if (!window.__pzEdgeShots) return;
  const ids = [];
  s.tracks.video.forEach((tr, ti) => {
    if (ti === 0 && !withV1) return;
    for (const c of tr.clips) {
      const ce = c.start + (c.out - c.in);
      if (span.some((x) => x.track === ti && c.start < x.b - 1e-3 && ce > x.a + 1e-3)) ids.push(c.id);
    }
  });
  if (ids.length) window.__pzEdgeShots(s, { only: ids }).then((r) => { if (r && r.merged) { app.toast(withV1 ? LL('A few frames of another camera shot at the clip edge were fixed (Ctrl+Z undoes it).', 'Na kraji klipu bylo opraveno pár snímků jiného záběru kamery (Ctrl+Z vrátí).') : LL('A few frames of another camera shot at the B-roll edge were trimmed (Ctrl+Z undoes it).', 'Na kraji b-rollu bylo odstřiženo pár snímků jiného záběru kamery (Ctrl+Z vrátí).')); app.timeline.render(); app.program.refresh(); } }).catch(() => {});
}
/** Kroky Zpět, které přidá výřez podle obličeje (Set to Fill, AI: Reframe…), sloučit s předchozím krokem (vložením).
 *  Jen ty kroky, ne celý rozsah od vložení: výřez trvá sekundy a mezitím přidaný krok uživatele nebo další vložení by se
 *  ztratil (revize noc 2026-11-23). Krok = stav PŘED úpravou, takže odebrání kroku ho jen sloučí s předchozím. */
function reframeMerger(also) {
  const before = new Set(project.history);
  return () => {
    for (let i = project.history.length - 1; i >= 0; i--) {
      const h = project.history[i];
      if (!before.has(h) && (/^(Set to Fill|AI: Reframe)/.test(h.label) || (also && also.test(h.label)))) project.history.splice(i, 1);
    }
  };
}
function autoFace(s, m) {
  if (s && m && m.hasVideo && !(s.height > s.width) && window.__pzEdgeShots) {
    // na šířku: jen úklid zbytků jiného záběru na krajích klipu (kolo 7)
    window.__pzEdgeShots(s).then((r) => { if (r && r.merged) app.program.refresh(); }).catch(() => {});
    return;
  }
  if (!s || !m || !m.hasVideo || !(s.height > s.width) || !(m.width > m.height) || !window.__pzReframeHere) return;
  app.status(LL('Crop follows the face…', 'Výřez podle obličeje…'));
  const merge = reframeMerger(/^Clean up camera-cut leftovers$/); // jedno Ctrl+Z vrátí vložení, výřez i úklid krajů
  // po výřezu úklid krajů (redaktorka S9: klip končící 4 snímky v celku dostal výřez detailu – na konci stůl a nohy)
  const clean = () => (window.__pzEdgeShots ? window.__pzEdgeShots(s).catch(() => {}) : Promise.resolve());
  window.__pzReframeHere(s).then(clean).then(() => { merge(); app.status(''); app.program.refresh(); }).catch(() => { merge(); app.status(''); });
}
/** Název projektu pro soubor: „Bez názvu“ v češtině místo Untitled. */
function projBaseName() { const n = project.name || 'Untitled'; return n === 'Untitled' && TN.lang === 'cs' ? 'Bez názvu' : n; }

/* ======================================================= přepis řeči a titulky z přepisu (bez AI) */
const LL = (en, cz) => (TN.lang === 'cs' ? cz : en);
/** Položky kontextového menu pro přepis řeči klipu (design-1 §4). Nikdy samotné „Přepsat“ (= Overwrite). */
function asrItems(m, sep) {
  const a = window.__pzASR;
  if (!a || !m || m.missing) return [];
  const st = a.status(m);
  const items = sep ? ['-'] : [];
  if (a.get(m) || st.state === 'stopped') items.push(['Show Transcript', () => { app.openSource(m); app.transcript.show('tr'); }, '']);
  if (m.hasAudio === false) items.push(['Transcribe Speech (the clip has no sound)', () => {}, '']);
  else if (st.state === 'running' || st.state === 'queued') items.push(['Stop Transcription', () => { a.stop(m); app.toast(LL('Transcription stopped. You can use the finished part.', 'Přepis zastaven. Hotovou část můžeš používat.')); }, '']);
  else if (st.state === 'stopped') items.push(['Resume Transcription', () => a.start(m).catch(() => {}), '']);
  else if (st.state === 'done') {
    // starší přepis menším modelem: nabídnout přesnější (titulky se nezmění, starý přepis platí, dokud není nový)
    if (a.isAccurate && !a.weak && !a.isAccurate(a.get(m))) items.push(['Transcribe More Accurately…', () => transcribeAccurately(m), '']);
    items.push(['Transcribe Again…', () => retranscribe(m), '']);
  }
  else items.push(['Transcribe Speech', () => { a.start(m).catch(() => {}); }, '']);
  return items;
}
/** Přepsat přesněji (design-2 §3.3): dosavadní přepis platí, dokud není nový; titulky se nemění. */
function transcribeAccurately(m) {
  const a = window.__pzASR;
  if (!a || !m) return;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const est = a.accEstimate ? a.accEstimate(m) : null; // stejný odhad jako nabídka v Přepisu (rychlost tohoto počítače)
  const mins = est ? (est < 600 ? Math.max(1, Math.ceil(est / 60)) : Math.round(est / 300) * 5) : 0;
  openModal(`<h2>${LL('Transcribe more accurately?', 'Přepsat přesněji?')}</h2>
    <div style="max-width:420px;line-height:1.5">${esc(mins ? LL(`The accurate transcript makes fewer mistakes but takes longer – about ${mins} min for this clip.`, `Přesný přepis dělá méně chyb, ale trvá déle – u tohoto klipu asi ${mins} min.`) : LL('The accurate transcript makes fewer mistakes but takes longer. You can keep working meanwhile.', 'Přesný přepis dělá méně chyb, ale trvá déle. Můžeš mezitím normálně pracovat.'))}</div>
    <div class="dim" style="max-width:420px;line-height:1.5;margin-top:6px">${esc(LL('The current transcript stays valid until the new one is finished – you can keep searching it. Captions in sequences do not change. Your fixes from captions carry over.', 'Dosavadní přepis platí, dokud nebude nový – dál v něm můžeš hledat. Titulky v sekvencích se nezmění. Tvoje opravy z titulků se přenesou.'))}</div>
    <div class="dim" id="taDl" style="max-width:420px;margin-top:6px;min-height:18px"></div>
    ${a.preciseCaptions ? `<div style="max-width:420px;margin-top:6px;line-height:1.5;color:#ecebf3">${esc(LL('You do not need it for captions – Captions from transcript transcribe only the used parts accurately (about 30 s).', 'Na titulky to potřeba není – Titulky z přepisu přepíšou přesně jen použité úseky (asi 30 s).'))}</div>` : ''}
    <div class="btns"><button id="taNo">${LL('Cancel', 'Zrušit')}</button><button class="primary" id="taOk">${LL('Transcribe more accurately', 'Přepsat přesněji')}</button></div>`, (b) => {
    // „stáhne 1 GB“ jen když přesný model v úložišti prohlížeče ještě není (whisper-worker.js, složka pz-models)
    (async () => { try { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('pz-models'); let got = false; for await (const [n] of d.entries()) { if (/large-v3-turbo.*encoder_model_quantized/.test(n)) got = true; } const el = b.querySelector('#taDl'); if (el) el.textContent = got ? LL('Nothing is downloaded. Before the transcript starts it prepares for a while – a few seconds to 2 minutes.', 'Nic se nestahuje. Než přepis začne, chvíli se připravuje – pár sekund až 2 minuty.') : LL('The first time about 1 GB is downloaded – only once.', 'Poprvé se stáhne asi 1 GB – jen jednou.'); } catch (e) { const el = b.querySelector('#taDl'); if (el) el.textContent = LL('The first time about 1 GB is downloaded – only once.', 'Poprvé se stáhne asi 1 GB – jen jednou.'); } })();
    b.querySelector('#taNo').onclick = closeModal;
    b.querySelector('#taOk').onclick = () => {
      closeModal();
      app.transcript.show('tr');
      a.start(m, { force: true, quality: 'accurate', upgrade: true }).then(() => app.toast(LL(`Accurate transcript ready: ${m.name}. Captions did not change – make new ones via Create again from transcript.`, `Přesný přepis hotový: ${m.name}. Titulky se nezměnily – nové vytvoříš přes Vytvořit znovu z přepisu.`))).catch(() => {});
    };
  });
}
function retranscribe(m) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  openModal(`<h2>${LL('Transcribe speech again?', 'Přepsat řeč znovu?')}</h2>
    <div class="dim" style="max-width:420px;line-height:1.5">${esc(LL(`The current transcript of “${m.name}” stays until the new one is finished. Captions in sequences do not change.`, `Stávající přepis klipu „${m.name}“ zůstane, dokud nebude hotový nový. Titulky v sekvencích se nezmění.`))}</div>
    <div class="btns"><button id="rtNo">${LL('Cancel', 'Zrušit')}</button><button class="primary" id="rtOk">${LL('Transcribe again', 'Přepsat znovu')}</button></div>`, (b) => {
    b.querySelector('#rtNo').onclick = closeModal;
    b.querySelector('#rtOk').onclick = () => { closeModal(); window.__pzASR.start(m, { force: true }).catch(() => {}); };
  });
}
/** Vytvoří titulky ze slov, která v sekvenci zazní – jeden krok Zpět. Vrací počet titulků. */
function makeCaptions(s, words, hl, fill) {
  const base = CL.styleOf(s);
  const st = Object.assign({}, base, { highlight: hl ? (base.highlight || '#ffd60a') : '' });
  // fill = doplnit jen úseky bez titulků (kolo 5: druhé „Titulky z přepisu“ nesmí přepsat ani zdvojit opravené titulky)
  const rs = fill ? E.uncaptionedRanges(s) : null;
  const ws = rs ? words.filter((w) => rs.some((r) => (w.s + w.e) / 2 >= r.start && (w.s + w.e) / 2 < r.end)) : words;
  const caps = CL.layout(ws, s, st, CL.contentEnd(s) || undefined);
  // titulek nesmí přesahovat do dalšího klipu (kolo 5, B1: konec titulku se natahoval do začátku sousedního výroku)
  const atr = s.tracks.audio.filter((x) => !x.muted).find((x) => x.clips.length);
  // titulek začínající přesně na střihu patří k DALŠÍMU klipu (kontrolor S5: 16,12 < 16,1200000000001 → nulová délka a poslední věta bez titulku)
  // konec titulku jen na konci úseku zvuku – navazující kusy téhož zdroje (zvuk rozříznutý spolu s obrazem) jsou jeden úsek (kontrolor S11)
  if (atr) for (const c of caps) { const cl = E.audioRuns(atr.clips).find((k) => c.start >= k.start - 0.01 && c.start < k.start + (k.out - k.in) - 0.01); if (cl) c.end = Math.max(Math.min(c.end, cl.start + (cl.out - cl.in)), Math.min(c.end, c.start + 0.3)); }
  if (!caps.length) return 0;
  app.edit(fill ? 'Add Captions from Transcript' : 'Captions from Transcript', () => {
    s.captionStyle = st;
    s.captions = fill ? (s.captions || []).concat(caps).sort((x, y) => x.start - y.start) : caps;
  });
  app.program.refresh();
  app.timeline.render();
  return caps.length;
}
let capWait = null; // titulky čekající na dokončení přepisu
function waitForCaptions(s, hl, fill) {
  const a = window.__pzASR;
  if (capWait) capWait.off();
  let busy = false, again = false;
  const w = { seqId: s.id };
  const tick = async () => {
    if (busy) { again = true; return; } // událost během kontroly se nesmí ztratit (jinak by titulky čekaly navždy)
    busy = true; again = false;
    try {
      const sq = project.sequences.find((q) => q.id === w.seqId);
      if (!sq) { w.off(); return; }
      const r = await a.seqWords(sq);
      if (!r.pending.length) {
        w.off();
        app.status('');
        const n = r.words.length ? makeCaptions(sq, r.words, hl, fill) : 0;
        if (n) { app.transcript.show('cap'); app.captionList.focusFirst(); }
        app.toast(n ? LL(`Captions ready (${n}). Check them on the Captions tab – Enter saves and jumps to the next.`, `Titulky hotové (${n}). Zkontroluj je v záložce Titulky – Enter uloží a skočí na další.`) : LL('No speech found in the used parts – no captions were created.', 'V použitých úsecích jsme nenašli žádnou řeč – titulky nevznikly.'));
        return;
      }
      const sts = r.pending.map((m) => a.status(m));
      if (sts.some((x) => x.state === 'stopped' || x.state === 'error' || x.state === 'none')) {
        w.off(); app.status('');
        // selhaný přepis není „zastavený“ (redaktorka S9) – říct pravou příčinu
        const err = sts.find((x) => x.state === 'error');
        app.toast(err ? LL(`No captions were created – the transcription failed${err.msg ? ': ' + err.msg : ''}.`, `Titulky nevznikly – přepis řeči selhal${err.msg ? ': ' + err.msg : ''}.`)
          : LL('No captions were created – the transcript is stopped.', 'Titulky nevznikly – přepis je zastavený.'), true);
        return;
      }
      const p = Math.min(...sts.map((x) => x.p || 0));
      app.status(LL(`Captions are waiting for the transcript… ${Math.floor(p * 100)} %`, `Titulky čekají na přepis… ${Math.floor(p * 100)} %`));
    } finally { busy = false; if (again && capWait === w) setTimeout(tick, 0); }
  };
  const un = a.on(() => tick());
  w.off = () => { un(); if (capWait === w) capWait = null; };
  capWait = w;
  tick();
}
const aboutT = (sec, cs) => U.aboutT(sec, cs);
async function captionsFromTranscript() {
  const s = app.seq();
  const a = window.__pzASR;
  if (!s) { app.toast(LL('Open a sequence first.', 'Nejdřív otevři sekvenci.')); return; }
  if (!a) {
    app.toast(AI_OK ? LL('Captions from the transcript: use the AI panel (Captions) in this version.', 'Titulky z přepisu: v této verzi přes panel AI (Titulky).')
      : LL('Captions from the transcript need speech transcription – install MY Premiere MCP (README, step 1); the app then finds it itself.', 'Titulky z přepisu potřebují přepis řeči – nainstaluj MY Premiere MCP (README, bod 1), aplikace ho pak najde sama.'), !AI_OK);
    return;
  }
  const tr0 = s.tracks.audio.filter((x) => !x.muted).find((x) => x.clips.length);
  if (!tr0) { app.toast(LL('The sequence has no clips with sound.', 'Sekvence nemá klipy se zvukem.')); return; }
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const names = [...new Set(tr0.clips.map((c) => (project.mediaById(c.mediaId) || {}).name).filter(Boolean))];
  const nSeg = E.audioRuns(tr0.clips).length; // navazující kusy téhož zdroje = jeden úsek (vzhled S11: „6 úseků“ místo 3)
  const vertical = s.height > s.width * 1.05, square = Math.abs(s.height - s.width) <= s.width * 0.05;
  const fmtName = vertical ? (s.height / s.width > 1.5 ? LL('vertical 9:16', 'na výšku 9:16') : LL('vertical 4:5', 'na výšku 4:5')) : square ? LL('square 1:1', 'čtverec 1:1') : LL('landscape 16:9', 'na šířku 16:9');
  let hl = !(s.width > s.height * 1.2);
  try { const v = localStorage.getItem('pzCapHl'); if (v !== null) hl = v === '1'; } catch (e) { /* bez úložiště */ }
  const st = CL.styleOf(s);
  const segTxt = LL(`${nSeg} part${nSeg === 1 ? '' : 's'} of ${names.join(', ')}`, `${nSeg} ${nSeg === 1 ? 'úsek' : nSeg < 5 ? 'úseky' : 'úseků'} z klipu ${names.join(', ')}`);
  const has = (s.captions || []).length;
  // druhé „Titulky z přepisu“ (kolo 5, B1): úseky bez titulků se jen doplní, hotové titulky a opravy zůstanou beze změny
  const gaps = has ? E.uncaptionedRanges(s).length : 0;
  const fill = gaps > 0;
  const mmss = (x) => Math.floor(x / 60) + ':' + String(Math.round(x % 60)).padStart(2, '0');
  openModal(`<h2>${LL('Captions from the transcript', 'Titulky z přepisu')}</h2>
    <div class="dim" style="margin:-4px 0 10px">${esc(s.name)} · ${mmss(seqDuration(s))} · ${fmtName}</div>
    <div id="cfMsg" style="line-height:1.5;min-height:${media.WEB ? 72 : 36}px;width:420px"><span class="dim">${LL('Finding the words heard in the sequence…', 'Zjišťuji, která slova v sekvenci zazní…')}</span></div>
    <label class="row" style="gap:8px;cursor:pointer;min-height:28px;margin-top:8px"><input type="checkbox" id="cfHl" ${hl ? 'checked' : ''}> <span>${LL('Highlight the spoken word', 'Zvýrazňovat vyslovované slovo')}</span></label>
    <div class="dim" style="font-size:11.5px">${LL(`Look follows the format: ${st.lines} line${st.lines === 1 ? '' : 's'}, ${Math.round(st.pos)} % from the bottom. Change it in the Text on video window.`, `Vzhled podle formátu: ${st.lines} ${st.lines === 1 ? 'řádek' : 'řádky'}, ${Math.round(st.pos)} % od spodu. Změníš ho v okně Text v obraze.`)}</div>
    ${fill ? `<div class="cs-warn" style="margin-top:10px">${LL(`The sequence already has captions (${has}). Captions are added only to the ${gaps} part${gaps === 1 ? '' : 's'} without captions – the existing ones and your fixes stay as they are. Undo with Ctrl+Z.`, `Sekvence už má titulky (${has}). Doplní se jen ${gaps === 1 ? 'úseku' : 'úsekům'} bez titulků (${gaps}) – hotové titulky i tvoje opravy zůstanou, jak jsou. Vrátíš to Ctrl+Z.`)}</div>` : has ? `<div class="cs-warn" style="margin-top:10px">${LL(`The sequence already has captions (${has}). They are made again from the transcript – your text fixes stay, because they are saved in the transcript too. The caption style stays. Undo with Ctrl+Z.`, `Sekvence už má titulky (${has}). Vytvoří se znovu z přepisu – tvoje opravy textu zůstanou, protože se ukládají i do přepisu. Styl titulků zůstane. Vrátíš to Ctrl+Z.`)}</div>` : ''}
    <div class="btns"><button id="cfNo">${LL('Cancel', 'Zrušit')}</button><button class="primary" id="cfOk" disabled style="min-width:180px">${fill ? LL('Add captions', 'Doplnit titulky') : has ? LL('Replace captions', 'Nahradit titulky') : LL('Create captions', 'Vytvořit titulky')}</button></div>`, (b) => {
    const msg = b.querySelector('#cfMsg'), ok = b.querySelector('#cfOk'), hlBox = b.querySelector('#cfHl');
    let state = null, un = null, busy = false, again = false;
    const close = () => { if (un) un(); un = null; closeModal(); };
    let plan = null, working = false, hidden = false, cancelled = false;
    const only = fill ? E.uncaptionedRanges(s) : null;
    const refresh = async () => {
      if (working) return;
      if (busy) { again = true; return; }
      busy = true; again = false;
      try {
        const r = await a.seqWords(s);
        state = r;
        plan = a.captionPlan ? await a.captionPlan(s, only) : null;
        if (!r.pending.length) {
          if (!r.words.length && !(plan && plan.precise)) { msg.innerHTML = esc(LL('No speech found in the used parts – no captions can be created.', 'V použitých úsecích jsme nenašli žádnou řeč – titulky nevzniknou.')); ok.textContent = LL('Close', 'Zavřít'); ok.disabled = false; return; }
          if (plan && plan.precise) {
            // notebook (kolo 5, design-4 §2.2): přesně se přepíšou jen použité úseky
            const tr = plan.estimate || 30, dl = plan.dlLeft || 0;
            const l1 = fill ? LL(`Captions are added to the part${plan.clips === 1 ? '' : 's'} without captions (${plan.clips}) – transcribed accurately, ${aboutT(tr + dl, false)}.`, `Doplní se titulky ${plan.clips === 1 ? 'úseku' : 'úsekům'} bez titulků (${plan.clips}) – přepíše se přesně, ${aboutT(tr + dl, true)}.`)
              : LL(`Captions will be transcribed accurately – ${aboutT(tr + dl, false)}.`, `Titulky se přepíšou přesně – ${aboutT(tr + dl, true)}.`);
            const pf = plan.prefetch, mb = (x) => Math.round(x / 1048576).toLocaleString(TN.lang === 'cs' ? 'cs-CZ' : 'en-US');
            const used = mmss(Math.max(0, plan.seconds - 3 * plan.clips));
            const l2 = plan.stored ? LL(`Only the ${used} used in the sequence is transcribed (${segTxt}). The Transcript tab stays standard.`, `Přesně se přepíše jen ${used} použitých úseků (${segTxt}). Přepis v záložce Přepis zůstane standardní.`)
              : pf.state === 'running' ? LL(`First the download finishes: ${mb(pf.loaded)} / ${mb(pf.total)} MB (${aboutT(dl, false)}, first time only), then the parts take ${aboutT(tr, false)}.`, `Nejdřív se dostáhne ${mb(pf.loaded)} / ${mb(pf.total)} MB (${aboutT(dl, true)}, jen poprvé), pak přepis úseků ${aboutT(tr, true)}.`)
                : LL(`The first time about 1 GB is downloaded (${aboutT(dl, false)}), then the parts take ${aboutT(tr, false)}.`, `Poprvé se stáhne asi 1 GB (${aboutT(dl, true)}), pak přepis úseků ${aboutT(tr, true)}.`);
            msg.innerHTML = `<div style="color:#ecebf3">${esc(l1)}</div><div class="dim">${esc(l2)}</div>` + (fill ? `<div class="dim">${esc(LL(`The existing captions (${has}) and your fixes stay. Undo with Ctrl+Z.`, `Hotové titulky (${has}) i tvoje opravy zůstanou. Vrátíš to Ctrl+Z.`))}</div>` : '');
            const w = b.querySelector('.cs-warn'); if (w && fill) w.style.display = 'none';
            ok.textContent = fill ? LL('Add captions', 'Doplnit titulky') : has ? LL('Replace captions', 'Nahradit titulky') : LL('Create captions', 'Vytvořit titulky');
            ok.disabled = false;
            return;
          }
          msg.innerHTML = (a.weak ? `<div style="color:#ecebf3">${esc(LL('Captions are made from the standard transcript.', 'Titulky vzniknou ze standardního přepisu.'))}</div><div class="dim">${esc(LL('The accurate one is not possible on this computer – check them, they tend to have more mistakes.', 'Na tomto počítači přesný nejde – zkontroluj je, bývá v nich víc chyb.'))}</div>` : '') + '<span class="dim">' + esc(LL(`Captions are made only from words that are heard in the sequence (${segTxt}).`, `Titulky vzniknou jen ze slov, která v sekvenci zazní (${segTxt}).`)) + '</span>';
          ok.textContent = fill ? LL('Add captions', 'Doplnit titulky') : has ? LL('Replace captions', 'Nahradit titulky') : LL('Create captions', 'Vytvořit titulky');
        } else {
          const m = r.pending[0], x = a.status(m);
          const running = x.state === 'running' || x.state === 'queued';
          msg.innerHTML = running
            ? esc(LL(`Waiting for the transcript: ${m.name} – ${Math.floor((x.p || 0) * 100)} %`, `Čekám na přepis: ${m.name} – ${Math.floor((x.p || 0) * 100)} %`)) + `<div class="bar" style="height:3px;margin-top:6px"><i style="width:${Math.max(1, Math.round((x.p || 0) * 100))}%"></i></div>`
            : esc(LL(`The clip “${m.name}” has no transcript yet – I will start it (on this computer, without AI).`, `Klip „${m.name}“ ještě nemá přepis – spustím ho (v tomto počítači, bez AI).`));
          ok.textContent = LL('Create when the transcript is ready', 'Vytvořit, až bude přepis');
        }
        ok.disabled = false;
      } finally { busy = false; if (again && un) setTimeout(refresh, 0); }
    };
    un = a.on(() => refresh());
    refresh();
    b.querySelector('#cfNo').onclick = () => { if (working) cancelled = true; close(); };
    ok.focus();
    ok.onclick = async () => {
      if (!state) return;
      if (working) { hidden = true; close(); app.status(LL('Captions: transcribing the parts accurately… (finishes by itself)', 'Titulky: přepisuji úseky přesně… (dokončí se samo)')); return; }
      const h = hlBox.checked;
      try { localStorage.setItem('pzCapHl', h ? '1' : '0'); } catch (e) { /* bez úložiště */ }
      if (!state.pending.length && plan && plan.precise) {
        // přesné titulky po úsecích: dialog zůstane s průběhem, „Skrýt“ ho zavře a dokončí se samo (design-4 §2.2)
        working = true; ok.textContent = LL('Hide – it finishes by itself', 'Skrýt – dokončí se samo'); ok.classList.remove('primary');
        const bar = (p) => `<div class="bar" style="height:3px;margin-top:6px"><i style="width:${Math.max(1, Math.round(p * 100))}%"></i></div>`;
        const show = (t1, p) => { if (!hidden && msg.isConnected) msg.innerHTML = `<div style="color:#ecebf3">${esc(t1)}</div>` + bar(p); else app.status(LL('Captions: ', 'Titulky: ') + t1); };
        try {
          if (!plan.stored) {
            const offPf = a.onPrefetch((pf) => show(LL(`Downloading for accurate captions: ${Math.round(pf.loaded / 1048576)} / ${Math.round((pf.total || 1) / 1048576)} MB`, `Stahuji pro přesné titulky: ${Math.round(pf.loaded / 1048576)} / ${Math.round((pf.total || 1) / 1048576)} MB`), pf.total ? pf.loaded / pf.total : 0));
            try { await a.ensureAccurate(); } finally { offPf(); }
          }
          const t0 = Date.now(), estT = plan.estimate || 20;
          // krátký úsek = jeden kousek pro model → procenta by stála (redaktor-5: „1 %“ celou dobu); ukazovat běžící čas proti odhadu
          const tick = () => { const el = Math.round((Date.now() - t0) / 1000); show(LL(`Transcribing the parts accurately… ${el} s of about ${Math.round(estT)} s`, `Přepisuji úseky přesně… ${el} s z asi ${Math.round(estT)} s`), Math.min(0.95, el / Math.max(1, estT))); };
          tick(); const tickI = setInterval(tick, 1000);
          let r;
          try { r = await a.seqWords(s, { precise: true, only }); } finally { clearInterval(tickI); }
          if (cancelled) return;
          if (!hidden) close();
          const before = fill ? (s.captions || []).map((c) => c.start) : [];
          const n = r.words.length ? makeCaptions(s, r.words, h, fill) : 0;
          if (n) s.captionsPrecise = true;
          const firstNew = fill ? s.captions.findIndex((c) => !before.includes(c.start)) : 0;
          app.status('');
          if (n) { app.transcript.show('cap'); app.captionList.focusFirst(Math.max(0, firstNew)); }
          app.toast(n ? LL(`Captions ready (${n}) – from the accurate transcript. Check them on the Captions tab – Enter saves and jumps to the next.`, `Titulky hotové (${n}) – z přesného přepisu. Zkontroluj je v záložce Titulky – Enter uloží a skočí na další.`) : LL('No speech found in the used parts – no captions were created.', 'V použitých úsecích jsme nenašli žádnou řeč – titulky nevznikly.'));
        } catch (e) {
          working = false;
          const t = /memory|allocation/i.test(e.message || '') ? LL('The accurate transcript of the parts failed – the computer ran out of memory. Close other tabs and try again.', 'Přesný přepis úseků se nepodařil – počítači došla paměť. Zavři jiné karty a zkus to znovu.')
            : /HTTP|fetch|network/i.test(e.message || '') ? LL('Accurate captions could not be downloaded.', 'Přesné titulky se nestáhly.') : LL('The accurate transcript of the parts failed.', 'Přesný přepis úseků se nepodařil.') + ' ' + (e.message || '');
          if (msg.isConnected) { msg.innerHTML = `<div class="cs-warn">${esc(t)}</div>`; ok.textContent = LL('Try again', 'Zkusit znovu'); ok.classList.add('primary'); }
          else app.toast(t, true);
        }
        return;
      }
      close();
      if (!state.pending.length) {
        if (!state.words.length) return;
        const before = fill ? (s.captions || []).map((c) => c.start) : [];
        const n = makeCaptions(s, state.words, h, fill);
        const firstNew = fill ? s.captions.findIndex((c) => !before.includes(c.start)) : 0;
        app.transcript.show('cap'); app.captionList.focusFirst(Math.max(0, firstNew));
        app.toast(LL(`Captions ready (${n}). Check them on the Captions tab – Enter saves and jumps to the next.`, `Titulky hotové (${n}). Zkontroluj je v záložce Titulky – Enter uloží a skočí na další.`));
        return;
      }
      for (const m of state.pending) { const x = a.status(m); if (x.state !== 'running' && x.state !== 'queued') a.start(m).catch(() => {}); }
      waitForCaptions(s, h, fill);
    };
  });
}

/* ======================================================= start */
(function start() {
  try {
    // záloha neuložených změn uloženého projektu (novější než projekt) → otevřít projekt se změnami, označený jako neuložený
    let rec = null;
    try { if (!media.WEB && settings.lastProject && fs.existsSync(AUTOSAVE)) { const j = JSON.parse(fs.readFileSync(AUTOSAVE, 'utf8')); if (j.autosaveOf && fs.existsSync(j.autosaveOf) && path.resolve(j.autosaveOf).toLowerCase() === path.resolve(settings.lastProject).toLowerCase() && fs.statSync(AUTOSAVE).mtimeMs > fs.statSync(j.autosaveOf).mtimeMs) rec = j; } } catch (e) { rec = null; }
    let auto = null, autoBad = false;
    if (!media.WEB && fs.existsSync(AUTOSAVE)) { try { auto = JSON.parse(fs.readFileSync(AUTOSAVE, 'utf8')); } catch (e) { autoBad = true; } }
    if (autoBad) {
      // poškozená záloha: odložit stranou (nepřepsat), srozumitelně
      try { fs.renameSync(AUTOSAVE, AUTOSAVE.replace(/\.tnproj$/, '.damaged-' + Date.now() + '.tnproj')); } catch (e) { /* */ }
      app.toast('The auto-save file is damaged – it was set aside, nothing was recovered.', true);
    }
    if (rec) { loadProjectFile(settings.lastProject, false, rec); project.dirty = true; updateTitle(); app.toast('Recovered unsaved changes from the auto-save. Save them with Ctrl+S, or close without saving to discard them.'); }
    else if (auto && auto.autosaveOf && !fs.existsSync(auto.autosaveOf)) {
      // projekt přesunutý / na odpojeném disku: neuložená práce ze zálohy jako nový projekt (dřív se tiše ztratila a další
      // automatické uložení ji přepsalo – pád a obnova S12)
      loadProjectFile(AUTOSAVE, true, auto);
      app.toast(`Recovered unsaved changes, but the project ${U.baseName(auto.autosaveOf)} was not found (moved or on a disconnected drive) – they are open as a new project. Save them with Ctrl+S.`);
    } else if (settings.lastProject && fs.existsSync(settings.lastProject)) loadProjectFile(settings.lastProject);
    else if (auto && !auto.autosaveOf) { loadProjectFile(AUTOSAVE, true, auto); app.toast('Recovered an unsaved project from the auto-save.'); }
  } catch (e) { app.toast('Cannot open the last project: ' + e.message, true); }
  if (!media.WEB) exporter.cleanStaleExports();
  app.projectPanel.render();
  renderTabs();
  app.timeline.restoreView();
  app.program.reset();
  app.source.ui();
  updateTools();
  updateTitle();
  app.focusPanel('timeline');
  app.status(media.WEB ? 'Ready' : media.ffmpegMissing() ? 'Ready · ffmpeg not found – Help → Install ffmpeg' : `Ready · ffmpeg: ${media.FFMPEG === 'ffmpeg' ? 'from PATH' : media.FFMPEG}`);
})();
