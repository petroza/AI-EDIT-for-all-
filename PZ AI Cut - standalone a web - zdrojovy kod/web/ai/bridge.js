'use strict';
/* Most mezi stránkou a konektory AI (connector/server/index.js – Claude Desktop i Codex, klidně oba naráz) na tomto počítači:
 * stránka konektory najde na http://127.0.0.1:7895–7897, dlouhým dotazem si vyzvedává nástroje, které Claude zavolal,
 * provede je (ai/tools.js) a pošle výsledek zpět. Nic nejde přes internet – jen mezi Chrome a Claude Desktop.
 * Stav (window.__pzAI) čte AI panel (static/ai-web.html). */
const { createTools } = require('./tools');
const T = require('./transcripts');
const vfs = require('../shims/vfs');
const CLq = require('../../src/core/captionlayout');

const PORTS = [7895, 7896, 7897];
/* Výchozí přesnost přepisu (kolo 2, změřeno na vzorku test/asr-ref): viz team/log.md. */
const DEFAULT_QUALITY = 'accurate';
/* Přesné je proti Standardnímu pomalejší ACC_SLOWER× (změřeno na simulaci notebooku, kolo 3 – team/log.md). */
const ACC_SLOWER = 2.2; // simulace notebooku 2026-11-22: 4 CPU 2,4×, 8 CPU 1,9×
/* Pomalejší počítač (odhad Přesného pro 28 min > 14 min): Standardní hned + nabídka Přesného. window.__pzAsrSlow = simulace. */
const SLOW_CORES = 16; // Přesné 28 min: 16 CPU 12,4 min ✓, 8 CPU 16,8 min ✗, 4 CPU 26,3 min ✗ (hranice 14 min)
function slowPc() {
  if (typeof window !== 'undefined' && window.__pzAsrSlow) return true;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  return cores < SLOW_CORES;
}
const offerHidden = new Set();
/** Přesnost pro nový přepis: výslovná volba uživatele (pzAsrQuality2), jinak podle počítače (vyhodnocuje se pokaždé). */
function qualityNow() {
  if (weakPc()) return 'standard';
  let q = null; try { q = localStorage.getItem('pzAsrQuality2'); } catch (e) { /* bez úložiště */ }
  return q || (slowPc() ? 'standard' : DEFAULT_QUALITY);
}
/** Počítač, na kterém by přesný přepis trval příliš dlouho (málo vláken nebo paměti). window.__pzAsrWeak = simulace. */
function weakPc() {
  if (typeof window !== 'undefined' && window.__pzAsrWeak) return true;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;
  return cores < 4 || mem < 4; // přesný přepis potřebuje ~3,3 GB paměti; pod tím jen Standardní (bez nabídky)
}
const listeners = new Set();
const S = {
  state: 'searching', // searching | connected | blocked
  port: null,         // první připojený (kvůli zpětné kompatibilitě)
  clients: [],        // ['Claude', 'Codex'] – kdo je připojený
  log: [],            // { t, kind: 'call'|'ok'|'err'|'task'|'info', text }
  progress: null,     // { text, p }
  tasks: [],          // úkoly z panelu čekající na Clauda
  lastCall: 0,
  result: null,       // { name, at } – poslední sekvence, kterou AI vytvořila (karta Výsledek v panelu)
  quality: (() => { let q = null; try { q = localStorage.getItem('pzAsrQuality2'); /* starý klíč pzAsrQuality (kolo 1) se úmyslně nečte */ } catch (e) { /* bez úložiště */ } return q || (weakPc() || slowPc() ? 'standard' : DEFAULT_QUALITY); })(),
  // pzAutoAsr2 (kolo 5): stará hodnota pzAutoAsr se ignoruje – vypnul ji tester/automat, ne uživatel (redaktor-4: přepis se po importu nespustil)
  auto: (() => { try { return localStorage.getItem('pzAutoAsr2') !== '0'; } catch (e) { return true; } })(),
  transcribed: new Set(), // media id s hotovým přepisem
};
const emit = () => { for (const f of listeners) { try { f(S); } catch (e) { /* panel zavřen */ } } };
function addLog(kind, text) {
  S.log.push({ t: Date.now(), kind, text: String(text).slice(0, 600) });
  if (S.log.length > 200) S.log.splice(0, S.log.length - 200);
  emit();
}

let taskSeq = 0;
const taskWaiters = [];
const ctx = {
  progress(text, p) { S.progress = text ? { text, p } : null; emit(); },
  quality: () => qualityNow(),
  waitTask(ms) {
    if (S.tasks.length) { const t = S.tasks.shift(); emit(); return Promise.resolve(t); }
    return new Promise((res) => {
      const w = { res };
      w.timer = setTimeout(() => { const i = taskWaiters.indexOf(w); if (i >= 0) taskWaiters.splice(i, 1); res(null); }, ms);
      taskWaiters.push(w);
    });
  },
  report(a) { addLog(a.error ? 'err' : a.done ? 'ok' : 'info', a.message); },
};
const tools = createTools(ctx);

function addTask(text) {
  const t = { id: 't' + (++taskSeq), text: String(text).trim(), seconds: 0, at: Date.now() };
  if (!t.text) return null;
  addLog('task', t.text);
  const w = taskWaiters.shift();
  if (w) { clearTimeout(w.timer); w.res(t); } else S.tasks.push(t);
  claimTab();
  emit();
  return t;
}

const LABEL = {
  editor_status: 'Reading the project', transcribe_media: 'Transcribing speech', get_transcript: 'Reading the transcript',
  search_transcript: 'Searching the transcript', build_sequence_from_transcript: 'Building a new sequence', build_sequence: 'Building a new sequence', set_title: 'Setting the headline', reframe_sequence: 'Reframing for social media',
  get_sequence: 'Reading the sequence', sequence_text: 'Checking the edit', open_sequence: 'Opening a sequence', add_captions: 'Adding captions',
  add_markers: 'Adding markers', undo: 'Undo', get_captions: 'Reading captions', set_captions: 'Correcting captions',
};

async function hello(port) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 1500);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/hello`, { signal: ctl.signal, cache: 'no-store' });
    const j = await r.json();
    return j && j.app === 'pz-ai-cut-connector' ? j : null;
  } finally { clearTimeout(tm); }
}

async function run(job, port) {
  const silent = job.tool === 'wait_task' || job.tool === 'report_task';
  if (!silent) addLog('call', LABEL[job.tool] || job.tool);
  S.lastCall = Date.now();
  let body;
  try {
    const fn = tools[job.tool];
    if (!fn) throw new Error('Unknown tool ' + job.tool);
    const result = await fn(job.args || {});
    body = { id: job.id, ok: true, result };
    if (!silent && /^build|add_captions|set_captions|set_title|reframe|undo/.test(job.tool)) addLog('ok', String(result).split('\n')[0]);
    const made = /^(build|reframe)/.test(job.tool) && /Created sequence "([^"]+)"/.exec(String(result));
    if (made) { S.result = { name: made[1], at: Date.now() }; emit(); }
  } catch (e) {
    body = { id: job.id, ok: false, error: String(e && e.message || e) };
    if (!silent) addLog('err', body.error);
    ctx.progress('', 1);
  }
  await fetch(`http://127.0.0.1:${port}/result`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

const conns = new Map(); // port -> { client }
// víc otevřených karet se střižnou: konektor posílá úkoly té, se kterou se naposledy pracovalo (má fokus)
const TAB = Math.random().toString(36).slice(2, 10);
let lastAct = document.hasFocus() ? Date.now() : 0;
const touch = () => { if (document.hasFocus()) lastAct = Date.now(); };
setInterval(touch, 2000);
for (const ev of ['focus', 'pointerdown', 'keydown']) window.addEventListener(ev, () => { lastAct = Date.now(); }, true);
function syncState() {
  S.clients = [...new Set([...conns.values()].map((c) => c.client || 'AI'))];
  S.port = conns.size ? [...conns.keys()][0] : null;
  if (conns.size) S.state = 'connected';
  else if (S.state === 'connected') S.state = 'searching';
  emit();
}
async function pollPort(port, info) {
  conns.set(port, { client: info.client || 'Claude' });
  syncState();
  addLog('info', (info.client || 'Claude') + ' connected');
  for (;;) {
    try {
      touch();
      const r = await fetch(`http://127.0.0.1:${port}/next?tab=${TAB}&act=${lastAct}${S.tasks.length || Date.now() < claimUntil ? '&task=1' : ''}`, { cache: 'no-store' });
      const job = await r.json();
      if (job && job.tool) run(job, port).catch((e) => addLog('err', e.message));
    } catch (e) {
      const c = conns.get(port);
      conns.delete(port);
      syncState();
      addLog('info', ((c && c.client) || 'AI') + ' disconnected');
      return;
    }
  }
}
let misses = 0;
let claimUntil = 0; // „AI pracuj v téhle kartě“ (zadání z panelu, nebo __pzAI.claim()) – konektor se přichytí sem
/** Konektoru hned říct, že AI má pracovat v téhle kartě (zadání z panelu) – jinak by se to dozvěděl až s dalším /next. */
function claimTab() { for (const p of conns.keys()) fetch(`http://127.0.0.1:${p}/claim?tab=${TAB}`, { cache: 'no-store' }).catch(() => {}); }
let kick = null;
async function loop() {
  for (;;) {
    let blocked = false;
    // bez připojení stačí většinou první port (konektor bere první volný od 7895), ostatní jen každé 4. kolo
    const scan = conns.size || misses % 4 === 0 ? PORTS : PORTS.slice(0, 1);
    for (const p of scan) {
      if (conns.has(p)) continue;
      try { const j = await hello(p); if (j) { misses = 0; pollPort(p, j); } } catch (e) { if (e && e.name === 'TypeError' && /permission|denied|blocked/i.test(e.message)) blocked = true; }
    }
    if (!conns.size) { misses++; S.state = blocked ? 'blocked' : 'searching'; emit(); }
    // hledat dál (další AI se může připojit kdykoli), bez připojení čím dál řidčeji (3 s … 15 s, po 5 min 60 s; skrytá karta 60 s),
    // ať se nezahlcuje konzole (každý nedostupný port = červená chyba sítě v DevTools); návrat do karty / panel AI hledá hned
    const wait = conns.size ? 10000 : document.hidden || misses > 25 ? 60000 : Math.min(15000, 3000 + misses * 1000);
    await new Promise((r) => { kick = r; setTimeout(r, wait); });
  }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && !conns.size && kick) { misses = Math.min(misses, 12); kick(); } });
window.__pzAI = {
  get state() { return S; },
  on(f) { listeners.add(f); f(S); return () => listeners.delete(f); },
  addTask,
  clearTasks() { if (S.tasks.length) { S.tasks.length = 0; addLog('info', 'Waiting tasks cleared (new project)'); } emit(); },
  engine: () => T.device().then((d) => d.dev), // 'wasm' (procesor) | 'webgpu' (grafika) – na čem běží přepis
  setQuality(q) { if (q === 'accurate' && weakPc()) q = 'standard'; S.quality = q; try { localStorage.setItem('pzAsrQuality2', q); } catch (e) { /* bez úložiště */ } emit(); asrEmit(null); },
  retry() { misses = 0; if (kick) kick(); },
  claim() { claimUntil = Date.now() + 30000; claimTab(); },
  setAuto(v) { S.auto = !!v; try { localStorage.setItem('pzAutoAsr2', v ? '1' : '0'); } catch (e) { /* bez úložiště */ } emit(); asrEmit(null); try { window.TN.app.program.refresh(); } catch (e) { /* úvodní karta podle volby */ } if (v) autoScan(); },
};
/* Přepis řeči pro rozhraní – funguje i bez AI (panel Přepis, stav u klipu, titulky z přepisu).
 * Stav po médiích: none | queued | running | stopped | done | error | noaudio; p 0–1, eta (s) – odhad z rychlosti. */
const jobs = new Map(); // media id -> { state, p, eta, msg, p0, tp0, job }
const asrL = new Set();
const asrEmit = (id) => { for (const f of asrL) { try { f(id); } catch (e) { /* posluchač */ } } };
function asrStatus(m) {
  if (!m) return { state: 'none', p: 0 };
  if (m.hasAudio === false) return { state: 'noaudio', p: 0 };
  const j = jobs.get(m.id);
  if (j) return j;
  if (T.forMedia(m)) return { state: 'done', p: 1 };
  const pt = T.partialForMedia(m);
  if (pt) return { state: 'stopped', p: Math.min(0.99, pt.upTo / (pt.duration || 1)) };
  return { state: 'none', p: 0 };
}
function asrStart(m, opts = {}) {
  const f = m && !m.missing && vfs.getFile(m.path);
  if (!f) return Promise.reject(new Error('The media file is not available.'));
  const old = jobs.get(m.id);
  const j = { state: 'queued', p: old && old.p || 0, eta: null, msg: '', p0: null, tp0: 0 };
  jobs.set(m.id, j); asrEmit(m.id);
  const q = weakPc() ? 'standard' : (opts.quality || qualityNow());
  j.accurate = q === 'accurate'; j.upgrade = !!opts.upgrade;
  const job = T.transcribe(f, { language: 'cs', quality: q, force: !!opts.force }, (p, msg) => {
    if (j.state === 'stopped') return;
    // načítání modelu hlásí 0 – při pokračování nechat dosavadní procento
    if (/loading/.test(msg || '') && !j.prep0) j.prep0 = Date.now(); // příprava = načítání z disku (ne stahování)
    if (p > 0.0005 && j.prep0 && !j.prepDone) { j.prepDone = true; try { localStorage.setItem('pzAsrPrepSec', String(Math.round((Date.now() - j.prep0) / 1000))); } catch (e) { /* bez úložiště */ } }
    j.state = 'running'; if (p > 0 || !j.p) j.p = p; j.msg = msg;
    // odhad času z rychlosti (od prvního skutečného postupu – načtení modelu se nepočítá)
    if (p > 0.0015 && j.p0 === null) { j.p0 = p; j.tp0 = Date.now(); }
    if (p >= 1 && j.p0 !== null && !j.speedSaved && m.duration >= 60) { /* krátký klip rychlost nezměří (jedno okno) */ j.speedSaved = true; const sp = m.duration * (1 - j.p0) / Math.max(1, (Date.now() - j.tp0) / 1000); try { localStorage.setItem(q === 'accurate' ? 'pzAsrSpeedAcc' : 'pzAsrSpeedStd', sp.toFixed(3)); } catch (e) { /* bez úložiště */ } }
    else if (j.p0 !== null && p > j.p0 + 0.004) { const rate = (p - j.p0) / ((Date.now() - j.tp0) / 1000); j.eta = (1 - p) / rate; }
    ctx.progress(p >= 1 ? '' : `Transcribing ${m.name} – ${msg}`, p);
    if (p > 0 && q === 'standard') maybePrefetch(); // standardní model je stažený → přesný stahovat na pozadí (notebook)
    if (opts.onProgress) { try { opts.onProgress(p, msg); } catch (e) { /* volající */ } }
    asrEmit(m.id);
  });
  j.job = job;
  job.then(() => { if (jobs.get(m.id) === j) jobs.delete(m.id); S.transcribed.add(m.id); addLog('ok', 'Transcript ready: ' + m.name); },
    (e) => { if (e && e.name === 'AbortError') j.state = 'stopped'; else { j.state = 'error'; j.msg = e.message; addLog('err', m.name + ': ' + e.message); } })
    .finally(() => { ctx.progress('', 1); asrEmit(m.id); emit(); });
  return job;
}
function asrStop(m) {
  const f = m && vfs.getFile(m.path);
  const j = m && jobs.get(m.id);
  if (f) T.stop(f);
  if (j) { j.state = 'stopped'; j.eta = null; }
  ctx.progress('', 1);
  asrEmit(m && m.id);
}
/* Notebook (kolo 5, tasks-4 úkol 2): přesný model se jen stáhne na pozadí, titulky se přepíšou přesně po úsecích klipů.
 * Stanice (přesný přepis celého klipu výchozí) a slabý počítač (jen standardní) beze změny. */
function preciseCaptions() { return !weakPc() && ((slowPc() && qualityNow() === 'standard') || exactAll()); }
/* Titulky z přesného přepisu zvuku klipu i tam, kde už je přesný přepis celého klipu (stanice): kraje podle toho, co v klipu
 * opravdu zazní (kolo 5, úkol 3 – heuristiky nad časy slov přepisu narazily na strop 64–75 %). window.__pzCapExact = false vypne. */
// změřeno kolo 5 (test/edges-web.js, stanice, seed 4242): přesný úsek 8/14 začátků, 11/14 konců × celý přepis 10/14, 12/14 a ~17 s na výrok → vypnuto
function exactAll() { return typeof window !== 'undefined' && window.__pzCapExact === true; }
const needsRange = (t0) => exactAll() || !(t0 && /large/.test(t0.model || ''));
let pfAsked = false;
const pfSamples = [];
T.onPrefetch((pf) => { pfSamples.push([Date.now(), pf.loaded]); while (pfSamples.length > 2 && pfSamples[0][0] < Date.now() - 20000) pfSamples.shift(); });
/** Rychlost stahování (B/s) za posledních ~20 s, nebo 0. */
function pfRate() { if (pfSamples.length < 2) return 0; const [t0, b0] = pfSamples[0], [t1, b1] = pfSamples[pfSamples.length - 1]; return t1 > t0 + 1000 ? (b1 - b0) / ((t1 - t0) / 1000) : 0; }
async function maybePrefetch() {
  if (pfAsked || weakPc() || !(slowPc() && qualityNow() === 'standard')) return; // stahovat na pozadí jen na notebooku
  pfAsked = true;
  if (await T.modelStored('accurate')) { asrEmit(null); return; }
  T.prefetch('accurate').catch(() => { pfAsked = false; });
}
T.onPrefetch(() => asrEmit(null));
/* opravy přepisu z titulků (project.asrFixes) – překryv přes uložený přepis, mezipaměť podle obsahu oprav */
const fixCache = new Map(); // media id -> { key, base, out }
function withFixes(m, t) {
  const p = window.TN && window.TN.app && window.TN.app.project;
  const fx = p && p.asrFixes && p.asrFixes[m.id];
  if (!t || !fx || !fx.length) return t;
  const key = JSON.stringify(fx);
  const c = fixCache.get(m.id);
  if (c && c.key === key && c.base === t) return c.out;
  const out = T.applyFixes(t, fx);
  fixCache.set(m.id, { key, base: t, out });
  return out;
}
window.__pzASR = {
  status: asrStatus,
  start: asrStart,
  stop: asrStop,
  /** hotový přepis, nebo rozpracovaná část (partial: true, upTo), nebo null – synchronně */
  get: (m) => (m && withFixes(m, T.forMedia(m) || T.partialForMedia(m))) || null,
  /** totéž, ale dohledá i v úložišti prohlížeče */
  load: async (m) => (m && withFixes(m, await T.loadForMedia(m) || await T.savedPartial(m))) || null,
  /** Úsek zdroje [s, e) slov, která tvoří titulek s textem oldText v okolí [s0, e0] (±1 s) – nejlepší shoda slov. */
  fixSpan(m, s0, e0, oldText) {
    const t = m && withFixes(m, T.forMedia(m) || T.partialForMedia(m));
    if (!t) return null;
    return T.matchSpan(t.words, s0, e0, oldText);
  },
  /** verze oprav (pro překreslení panelu po Zpět / opravě) */
  fixesKey: (m) => { const p = window.TN.app.project; return m && p.asrFixes && p.asrFixes[m.id] ? JSON.stringify(p.asrFixes[m.id]).length + ':' + p.asrFixes[m.id].length : ''; },
  on(f) { asrL.add(f); return () => asrL.delete(f); },
  cutBounds: (m, t, a, b) => T.cutBounds(vfs.getFile(m.path), t, a, b),
  /** Slova sekvence v čase timeline – jen to, co v sestřihu opravdu zazní (střed slova uvnitř klipu).
   *  pending = média klipů, kterým přepis ještě chybí (titulky počkají). */
  async seqWords(s, opts = {}) {
    const p = window.TN.app.project;
    // přesné titulky po úsecích (notebook): jen na výslovné přání volajícího (OK v dialogu), ne při náhledu dialogu
    const precise = !!opts.precise && preciseCaptions();
    const inOnly = (c) => !opts.only || opts.only.some((r) => c.start >= r.start - 0.01 && c.start < r.end);
    const todo = precise ? tr0Clips(s).filter((c) => needsRange(T.forMedia(p.mediaById(c.mediaId))) && inOnly(c)) : [];
    const total = todo.reduce((x, c) => x + (c.out - c.in) + 3, 0) || 1; // (+3 s na úsek = načtení a režie)
    let doneSec = 0;
    const tStart = Date.now();
    const tr = s.tracks.audio.filter((x) => !x.muted).find((x) => x.clips.length);
    const words = [], pending = [];
    if (!tr) return { words, pending };
    for (const c of tr.clips) {
      if (c.disabled) continue;
      const m = p.mediaById(c.mediaId);
      if (!m) continue;
      let t = await T.loadForMedia(m);
      if (!t) { const pt = T.partialForMedia(m) || await T.savedPartial(m); if (pt && c.out <= pt.upTo - 0.5) t = pt; }
      t = withFixes(m, t);
      if (!t) { if (!pending.includes(m)) pending.push(m); continue; }
      let tt = t, exact = null;
      if (precise && todo.includes(c)) {
        // přesně jen zvuk klipu [In, Out] (kolo 5): s okrajem 1,5 s Whisper rozpočítal první větu od začátku okna a „A zjistilo se to“
        // vypadlo před In. Titulky = co přesný model v klipu slyší (jako rozhodčí test/edges.js), opravy z titulků platí i tady.
        const f = vfs.getFile(m.path);
        const a0 = c.in, b0 = c.out;
        const ws = await T.transcribeRange(f, a0, b0, { quality: 'accurate' }, (q, msg) => {
          if (opts.onProgress) opts.onProgress(Math.min(0.99, (doneSec + q * (b0 - a0)) / total), msg);
        });
        doneSec += b0 - a0 + 3;
        window.__pzLastPrecise = { a0, b0, c: { in: c.in, out: c.out }, words: ws }; // ladění (test/notebook5.js)
        let pt = { words: ws, sentences: T.sentences(ws), duration: t.duration, model: T.MODELS.accurate, precise: true };
        const fx = p.asrFixes && p.asrFixes[m.id];
        if (fx && fx.length) pt = T.applyFixes(pt, fx);
        exact = T.clipWords(pt, c);
      }
      const cw = exact || await T.clipCaptionWords(vfs.getFile(m.path), tt, c);
      for (const w of cw) words.push(Object.assign(w, { w: CLq.czQuotes(w.w) }));
    }
    words.sort((a, b) => a.s - b.s);
    // změřit čas přesného přepisu úseků (s práce na s zvuku, včetně načtení modelu) – odhad příště (design-4 §2.2: ±25 %)
    if (todo.length) { const audio = todo.reduce((x, c) => x + (c.out - c.in), 0); if (audio >= 8) { try { localStorage.setItem('pzAsrRangeRate', ((Date.now() - tStart) / 1000 / audio).toFixed(3)); } catch (e) { /* bez úložiště */ } } }
    return { words, pending };
  },
  /** Plán titulků pro dialog: { precise, seconds (zvuk k přesnému přepisu), estimate (s), stored (model v úložišti), prefetch } */
  async captionPlan(s, only) {
    const p = window.TN.app.project;
    const out = { precise: false, seconds: 0, clips: 0, estimate: 0, stored: true, prefetch: T.prefetchState(), dlLeft: 0 };
    if (!preciseCaptions()) return out;
    const todo = tr0Clips(s).filter((c) => needsRange(T.forMedia(p.mediaById(c.mediaId))) && (!only || only.some((r) => c.start >= r.start - 0.01 && c.start < r.end)));
    out.clips = todo.length;
    if (!todo.length) return out;
    out.precise = true;
    out.seconds = todo.reduce((x, c) => x + (c.out - c.in) + 3, 0);
    out.stored = await T.modelStored('accurate');
    // odhad přesného přepisu úseků: změřený poměr na tomto počítači, jinak z měření kola 5 (8 CPU: 22 s zvuku = 18 s)
    const audio = todo.reduce((x, c) => x + (c.out - c.in), 0);
    let rate = 0; try { rate = Number(localStorage.getItem('pzAsrRangeRate')) || 0; } catch (e) { /* bez úložiště */ }
    const cores = Number(window.__pzAsrThreads) || navigator.hardwareConcurrency || 4;
    out.estimate = rate ? audio * rate : (cores >= 8 ? 6 + audio * 0.55 : 8 + audio * 1.0);
    // zbývá stáhnout: podle změřené rychlosti stahování (výchozí ~8 MB/s – tester kolo 4: 1 037 MB za ~125 s)
    if (!out.stored) { const pf = out.prefetch; const left = pf.state === 'running' && pf.total ? pf.total - pf.loaded : 1087e6; out.dlLeft = left / (pfRate() || 8.3e6); }
    return out;
  },
  get prefetch() { return T.prefetchState(); },
  retryPrefetch() { pfAsked = false; maybePrefetch(); },
  /** Stáhnout přesný model hned (dialog titulků, když ještě není) – vrací Promise. */
  async ensureAccurate() { if (await T.modelStored('accurate')) return true; pfAsked = true; return T.prefetch('accurate'); },
  onPrefetch: (f) => T.onPrefetch(f),
  modelStored: (q = 'accurate') => T.modelStored(q),
  get preciseCaptions() { return preciseCaptions(); },
  get auto() { return S.auto; },
  get quality() { return qualityNow(); },
  get weak() { return weakPc(); },
  setQuality: (q) => window.__pzAI.setQuality(q),
  /** přesnost přepisu: 'accurate' = přesný (velký) model, jinak standardní */
  isAccurate: (t) => !!(t && /large/.test(t.model || '')),
  /** Odhad přesného přepisu klipu na tomto počítači v sekundách (příprava + přepis), nebo null. */
  accEstimate(m) {
    if (!m || !m.duration) return null;
    let acc = 0, std = 0, prep = 0;
    try { acc = Number(localStorage.getItem('pzAsrSpeedAcc')) || 0; std = Number(localStorage.getItem('pzAsrSpeedStd')) || 0; prep = Number(localStorage.getItem('pzAsrPrepSec')) || 30; } catch (e) { /* bez úložiště */ }
    // bez měření na tomto počítači: simulace notebooku (s záznamu za s přepisu): 16 CPU 2,25 · 8 CPU 1,67 · 4 CPU 1,06
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const table = (typeof window !== 'undefined' && window.__pzAsrSlow) ? 1.67 : cores >= 16 ? 2.25 : cores >= 8 ? 1.67 : 1.06;
    const speed = acc || (std ? std / ACC_SLOWER : table);
    return m.duration / speed + prep;
  },
  /** Nabídnout „Přepsat přesněji“ po standardním přepisu (pomalejší počítač, kde Přesné není výchozí). */
  offerAccurate(m) { return !weakPc() && slowPc() && !offerHidden.has(m && m.id); },
  hideOffer(m) { if (m) offerHidden.add(m.id); asrEmit(m && m.id); },
  setAuto: (v) => window.__pzAI.setAuto(v),
};
function tr0Clips(s) { const tr = s.tracks.audio.filter((x) => !x.muted).find((x) => x.clips.length); return tr ? tr.clips.filter((c) => !c.disabled) : []; }
/* Automatický přepis nově importovaných videí na pozadí (jedno po druhém) – i bez AI. */
async function autoScan() {
  if (!window.TN || !window.TN.app) return;
  for (const m of window.TN.app.project.media) {
    if (m.missing || jobs.has(m.id) || S.transcribed.has(m.id)) continue;
    if (!vfs.getFile(m.path)) continue;
    // hotový přepis (i stejného videa pod jiným jménem) se jen načte z úložiště
    if (await T.loadForMedia(m)) { S.transcribed.add(m.id); asrEmit(m.id); emit(); maybePrefetch(); continue; }
    if (await T.savedPartial(m)) asrEmit(m.id);
    if (S.auto && m.hasAudio !== false) asrStart(m).catch(() => {});
  }
}
let autoT = null;
function hookProject() {
  if (!window.TN || !window.TN.app) { setTimeout(hookProject, 500); return; }
  window.TN.app.project.on((what) => { if (what === 'media') { clearTimeout(autoT); autoT = setTimeout(autoScan, 300); } });
  setTimeout(autoScan, 2500);
}
hookProject();
// stažený model (1 GB v úložišti prohlížeče) nesmí prohlížeč potichu vyhodit – požádat o trvalé úložiště (kolo 3: složka pz-models zmizela)
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist().catch(() => {}); }); } catch (e) { /* starý prohlížeč */ }
loop();
module.exports = window.__pzAI;
