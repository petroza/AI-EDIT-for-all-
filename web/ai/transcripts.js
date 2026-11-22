'use strict';
/* Přepisy médií ve webové verzi: přepis Whisperem v prohlížeči (static/whisper-worker.js), uložení do IndexedDB
 * (podle souboru: název, velikost, změna) a model vět s ID jako v MY Premiere MCP:
 *   transcript = { key, language, model, duration, words: [{w, s, e}], sentences: [{id, s, e, w0, w1, cont}] }
 * cont = věta pokračuje předchozí (předchozí neskončila tečkou – rozdělena kvůli délce/pauze). */
const vfs = require('../shims/vfs');
const { decodeAudioRange } = require('../engine/decode');

// varianty _timestamped mají výstup pozornosti -> přesné časy slov (střih mezi slovy)
const MODELS = {
  standard: 'onnx-community/whisper-small_timestamped',
  accurate: 'onnx-community/whisper-large-v3-turbo_timestamped',
};
const LANGS = { cs: 'czech', en: 'english', sk: 'slovak', uk: 'ukrainian', de: 'german', pl: 'polish', ru: 'russian', fr: 'french', es: 'spanish' };
const WINDOW = 240; // s zvuku na jedno dekódování (dělí se na ≤29s kousky)

const mem = new Map(); // key -> transcript
const partials = new Map(); // key -> rozpracovaný přepis (hotová část během přepisování; zmizí po dokončení)
// verze postupu přepisu: starší uložené přepisy (jiný model, chyby) se ignorují a udělají znovu
const ENGINE = 2;
const keyOf = (f, lang) => `${f.name}|${f.size}|${f.lastModified}|${lang}`;
const sigOf = (f) => `${f.name}|${f.size}|${f.lastModified}`;
/* Identita podle OBSAHU (velikost + otisk začátku, středu a konce souboru): stejné video pod jiným jménem
 * nebo znovu importované má hotový přepis hned. sig (jméno|velikost|změna) -> cid kvůli rychlému hledání. */
const sigCid = new Map();
async function contentId(f) {
  const sig = sigOf(f);
  if (sigCid.has(sig)) return sigCid.get(sig);
  let cid = null;
  try {
    const MB = 1 << 20, n = f.size;
    const parts = n <= 3 * MB ? [f] : [f.slice(0, MB), f.slice(Math.floor(n / 2), Math.floor(n / 2) + MB), f.slice(n - MB)];
    const bufs = await Promise.all(parts.map((b) => b.arrayBuffer()));
    const all = new Uint8Array(bufs.reduce((a, b) => a + b.byteLength, 0));
    let o = 0; for (const b of bufs) { all.set(new Uint8Array(b), o); o += b.byteLength; }
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
    cid = 'c' + n + '-' + Array.from(d.slice(0, 12), (x) => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { cid = null; }
  sigCid.set(sig, cid);
  return cid;
}
/* Zastavení: zrušené soubory (sig) a generace – běžící přepis se ukončí zabitím vláken (uvolní procesor hned). */
const cancelled = new Set();
let current = null; // sig právě přepisovaného souboru
function abortErr() { const e = new Error('Transcription stopped'); e.name = 'AbortError'; return e; }

/* ---------- IndexedDB ---------- */
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('pz-ai-cut-transcripts', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('t');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function dbGet(k) { try { const d = await db(); return await new Promise((res) => { const r = d.transaction('t').objectStore('t').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; } }
async function dbPut(k, v) { try { const d = await db(); d.transaction('t', 'readwrite').objectStore('t').put(v, k); } catch (e) { /* bez úložiště */ } }
async function dbDel(k) { try { const d = await db(); d.transaction('t', 'readwrite').objectStore('t').delete(k); } catch (e) { /* bez úložiště */ } }

/* ---------- zvuk 16 kHz mono ---------- */
async function audio16k(file, t0, t1) {
  // test/edges.js (Node): celý zvuk 16 kHz předem dekódovaný ffmpegem
  if (file && file.pcm16k) return file.pcm16k.slice(Math.max(0, Math.round(t0 * 16000)), Math.max(0, Math.round(t1 * 16000)));
  const pcm = await decodeAudioRange(file, t0, t1);
  const a = pcm.channels[0], b = pcm.channels[1] || a;
  const ratio = pcm.sampleRate / 16000;
  const n = Math.floor(a.length / ratio);
  const out = new Float32Array(n);
  const w = Math.max(1, Math.round(ratio));
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i * ratio);
    let s = 0, k = 0;
    for (let j = c; j < c + w && j < a.length; j++) { s += a[j] + b[j]; k += 2; }
    out[i] = k ? s / k : 0;
  }
  return out;
}
/** Nejtišší místo (střed 30ms okna) v úseku [a, b) zvuku 16 kHz začínajícího v čase t0. */
function quietest(x, t0, a, b) {
  const sr = 16000, win = 480;
  let best = a, bestE = Infinity;
  for (let t = a; t + 0.03 <= b; t += 0.01) {
    const i0 = Math.round((t - t0) * sr);
    if (i0 < 0 || i0 + win > x.length) continue;
    let e = 0;
    for (let i = i0; i < i0 + win; i++) e += x[i] * x[i];
    if (e < bestE) { bestE = e; best = t + 0.015; }
  }
  return { t: best, rms: Math.sqrt(bestE / win) };
}

/* ---------- Whisper ve vlákně ---------- */
let worker = null, reqId = 0;
const waiters = new Map();
let onDownload = null, onStep = null;
/* Víc souběžných přepisů (každý s částí vláken procesoru): počet z window.__pzAsrWorkers (výchozí 1). */
const pool = [];
const poolDone = []; let poolTotal = 0; // průběh souběžných přepisů (kousků hotovo / celkem v okně)
// změřeno (32 vláken): 1 = 50 s, 2 = 40 s na 150 s záznamu, 3–4 už nepomohou; 2 jen na silném počítači (paměť 2× model)
function poolSize() {
  const forced = Number(typeof window !== 'undefined' && window.__pzAsrWorkers);
  if (forced) return Math.max(1, Math.min(4, forced));
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const memGb = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;
  return cores >= 12 && memGb >= 8 ? 2 : 1;
}
function poolWorker(i) {
  if (!pool[i]) {
    const w = new Worker('whisper-worker.js', { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'download') { if (onDownload) onDownload(m); return; }
      if (m.type === 'step') { poolDone[i] = m.done; if (onStep && poolTotal) onStep({ done: poolDone.reduce((a, b) => a + (b || 0), 0), total: poolTotal }); return; }
      const x = waiters.get(m.id);
      if (!x) return;
      waiters.delete(m.id);
      if (m.type === 'error') x.reject(new Error(m.error)); else x.resolve(m);
    };
    w.onerror = (e) => { for (const x of waiters.values()) x.reject(new Error(e.message || 'Transcription worker failed')); waiters.clear(); pool[i] = null; };
    pool[i] = w;
  }
  return pool[i];
}
function askOn(i, msg, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    waiters.set(id, { resolve, reject });
    poolWorker(i).postMessage({ ...msg, id }, transfer || []);
  });
}
function getWorker() {
  if (!worker) {
    worker = new Worker('whisper-worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'download') { if (onDownload) onDownload(m); return; }
      if (m.type === 'step') { if (onStep) onStep(m); return; }
      const w = waiters.get(m.id);
      if (!w) return;
      waiters.delete(m.id);
      if (m.type === 'error') w.reject(new Error(m.error)); else w.resolve(m);
    };
    worker.onerror = (e) => { for (const w of waiters.values()) w.reject(new Error(e.message || 'Transcription worker failed')); waiters.clear(); worker = null; };
  }
  return worker;
}
function ask(msg, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    waiters.set(id, { resolve, reject });
    getWorker().postMessage({ ...msg, id }, transfer || []);
  });
}
/** Kde poběží přepis: { dev: 'wasm' (procesor) | 'webgpu' (grafika), gpu: je vhodná grafika }.
 *  window.__pzAsrDevice = 'wasm' | 'webgpu' | 'nogpu' (simulace počítače bez vhodné grafiky) – pro testy. */
async function device(model) {
  const forced = typeof window !== 'undefined' && window.__pzAsrDevice;
  let gpu = false;
  if (forced !== 'nogpu') {
    try { const a = typeof navigator !== 'undefined' && navigator.gpu && await navigator.gpu.requestAdapter(); gpu = !!a; } catch (e) { /* bez WebGPU */ }
  }
  if (forced === 'wasm' || forced === 'nogpu') return { dev: 'wasm', gpu, f16: false };
  if (forced === 'webgpu' && gpu) return { dev: 'webgpu', gpu, f16: false };
  // velký model (Přesné) na grafice; menší model: procesor ve více vláknech (stránka s izolací COOP/COEP) byl rychlejší
  // (velký model na grafice změřen 2026-11-22: q4 = chybovost 11 % proti 6,4 % na procesoru, fp32 2,7 GB se nenačetl → procesor)
  if (self.crossOriginIsolated && (navigator.hardwareConcurrency || 2) >= 6) return { dev: 'wasm', gpu, f16: false };
  // fp16 (q4f16) dával na části grafik nesmyslný přepis – zatím vždy fp32 kodér + q4 dekodér
  return { dev: gpu ? 'webgpu' : 'wasm', gpu, f16: false };
}
/** Zacyklený model („třeba třeba třeba…“): víc než 3 stejná slova za sebou se zkrátí. */
function dedupe(words) {
  const out = [];
  for (const w of words) {
    const n = out.length;
    const k0 = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const key = k0(w.w);
    if (n >= 3 && key && [1, 2, 3].every((k) => k0(out[n - k].w) === key)) continue;
    out.push(w);
  }
  return out;
}

/* Halucinace Whisperu nad hudbou/tichem (kolo 4, review-3): adresy webů („www.hradeckralove.cz“) a titulkové podpisy z filmových
 * titulků, na kterých se model učil („Titulky vytvořil JohnyX.“, „Subtitles by …“, „amara.org“). Taková slova v řeči nezazní –
 * vypadnou z přepisu a vrátí se v removed [{text, s, e}] (aplikace to ukáže u počtu vět). */
const HAL_WORD = /^[„"(]?(https?:\/\/|www\.)|\.(cz|sk|com|org|net|eu|tv|info)[.,!?"“”)]*$/i;
const HAL_SENT = /\b(titulky|podtitulky|titulk[yů] a překlad)\s+(vytvořil[a]?|připravil[a]?|přeložil[a]?|zpracoval[a]?)\b|\bsubtitles\s+(by|created)\b|\bamara\.org\b|\bpřeklad\s*:/i;
/** Text, který vypadá jako halucinace (titulkový podpis nebo adresa webu) – pro kontrolu prvních/posledních vět (test/edges.js). */
function hallucinated(text) { return HAL_SENT.test(text) || String(text).split(/\s+/).some((w) => HAL_WORD.test(w)); }
function dropHallucinations(words) {
  const removed = [];
  const S = sentences(words);
  const drop = new Set();
  for (const s of S) {
    const ws = words.slice(s.w0, s.w1 + 1), text = ws.map((w) => w.w).join(' ');
    if (HAL_SENT.test(text)) { for (let k = s.w0; k <= s.w1; k++) drop.add(k); removed.push({ text, s: s.s, e: s.e }); continue; }
    // adresa jako „slovo“ přes 2,5 s = přikrytá hudba/ticho; vyslovená adresa („na web Nova.cz“) trvá kratší dobu a zůstane
    ws.forEach((w, j) => { if (HAL_WORD.test(w.w) && w.e - w.s > 2.5) { drop.add(s.w0 + j); removed.push({ text: w.w, s: w.s, e: w.e }); } });
  }
  return { words: drop.size ? words.filter((w, k) => !drop.has(k)) : words, removed };
}

/* ---------- věty ---------- */
function toWords(res, offset, maxEnd) {
  const words = [];
  if (res.words) {
    for (const c of res.chunks) {
      const w = String(c.text || '').trim();
      if (!w) continue;
      const s = (c.ts[0] != null ? c.ts[0] : 0) + offset;
      const e = (c.ts[1] != null ? c.ts[1] : c.ts[0] + 0.3) + offset;
      words.push({ w, s, e: Math.max(e, s + 0.05) });
    }
  } else {
    // jen časy úseků: slova rozpočítat podle délky
    for (const c of res.chunks) {
      const parts = String(c.text || '').trim().split(/\s+/).filter(Boolean);
      const s0 = (c.ts[0] || 0) + offset;
      let e0 = (c.ts[1] != null ? c.ts[1] + offset : (maxEnd != null ? maxEnd : s0 + 2));
      if (maxEnd != null) e0 = Math.min(e0, maxEnd);
      if (e0 <= s0) e0 = s0 + 0.3;
      const total = parts.reduce((x, p) => x + p.length + 1, 0) || 1;
      let t = s0;
      for (const p of parts) { const d = (e0 - s0) * (p.length + 1) / total; words.push({ w: p, s: t, e: t + d * 0.92, approx: true }); t += d; }
    }
  }
  return words;
}
function sentences(words) {
  const out = [];
  let w0 = 0, prevEnded = true;
  for (let i = 0; i < words.length; i++) {
    const w = words[i], next = words[i + 1];
    const end = /[.?!…]["“”»)]*$/.test(w.w);
    const pause = next ? next.s - w.e : 0;
    const long = i - w0 >= 34;
    if (!next || end || pause > 1.2 || long) {
      // dlouhá věta (> 8 s): rozdělit na pauzách, aby šel výrok vybrat kliknutím (report-3: věta 15,7 s) – text se nemění
      for (const [a, b] of splitLong(words, w0, i)) {
        out.push({ id: out.length + 1, s: words[a].s, e: words[b].e, w0: a, w1: b, cont: a === w0 ? !prevEnded : true });
      }
      prevEnded = end || !next;
      w0 = i + 1;
    }
  }
  return out;
}
/** Úsek slov [a, b] delší než 8 s → kusy 3–8 s rozdělené na pauze ≥ 0,25 s (pauza u čárky má přednost); bez pauzy zůstane celý. */
function splitLong(words, a, b) {
  if (words[b].e - words[a].s <= 8) return [[a, b]];
  let best = -1, bs = -Infinity;
  for (let k = a; k < b; k++) {
    const gap = words[k + 1].s - words[k].e;
    const left = words[k].e - words[a].s, right = words[b].e - words[k + 1].s;
    const comma = /[,;:–—]["“”»)]*$/.test(words[k].w);
    // časy slov jsou často rozpočítané (bez skutečných mezer) → kandidát je i čárka; hranici v pauze pak najde cutBounds podle zvuku
    if ((gap < 0.25 && !comma) || left < 3 || right < 3) continue;
    // nejlépe čárka, pak delší pauza, pak blíž středu
    const sc = (comma ? 2 : 0) + Math.min(gap, 1) - Math.abs(left - right) / 20;
    if (sc > bs) { bs = sc; best = k; }
  }
  if (best < 0) return [[a, b]];
  return splitLong(words, a, best).concat(splitLong(words, best + 1, b));
}
function textOf(t, s, from, to) {
  const a = s.w0 + (from || 0), b = to != null ? s.w0 + to : s.w1;
  return t.words.slice(a, b + 1).map((x) => x.w).join(' ');
}

/* ---------- veřejné funkce ---------- */
async function cached(file, lang) {
  const cid = await contentId(file);
  const k = cid ? cid + '|' + lang : keyOf(file, lang);
  if (mem.has(k)) return mem.get(k);
  let t = await dbGet(k);
  if ((!t || t.engine !== ENGINE) && cid) {
    // starší záznam uložený podle jména souboru: převzít pod otisk obsahu
    const old = await dbGet(keyOf(file, lang));
    if (old && old.engine === ENGINE) { t = old; dbPut(k, t); }
  }
  if (!t || t.engine !== ENGINE) return null;
  t.sig = sigOf(file);
  const hal = dropHallucinations(t.words); // i u přepisů uložených před kolem 4
  if (hal.removed.length) { t.words = hal.words; t.removed = (t.removed || []).concat(hal.removed); }
  t.sentences = sentences(t.words); // věty vždy podle aktuálních pravidel (např. dělení dlouhých vět, kolo 3)
  mem.set(k, t);
  return t;
}
/** Přepis souboru (z mezipaměti, nebo nově). onProgress(p 0–1, text). Souběžné žádosti o stejný soubor
 *  počkají na jeden běh; různé soubory se přepisují po sobě. */
const running = new Map();
let chain = Promise.resolve();
function transcribe(file, opts = {}, onProgress) {
  cancelled.delete(sigOf(file)); // nové spuštění ruší dřívější Zastavit
  const k = keyOf(file, opts.language || 'cs') + (opts.maxSeconds ? '|' + opts.maxSeconds : '');
  if (!opts.force && running.has(k)) {
    const r = running.get(k);
    if (onProgress) r.listeners.add(onProgress);
    return r.job;
  }
  const listeners = new Set(onProgress ? [onProgress] : []);
  const fan = (p, m) => { for (const f of listeners) { try { f(p, m); } catch (e) { /* posluchač */ } } };
  const job = chain.then(() => { if (cancelled.has(sigOf(file))) throw abortErr(); current = sigOf(file); return transcribeNow(file, opts, fan); }).finally(() => { if (current === sigOf(file)) current = null; });
  chain = job.catch(() => {});
  running.set(k, { job, listeners });
  job.finally(() => running.delete(k)).catch(() => {});
  return job;
}
async function transcribeNow(file, opts = {}, onProgress) {
  const lang = opts.language || 'cs';
  const hit = await cached(file, lang);
  if (hit && !opts.force) return hit;
  const sig = sigOf(file);
  const cid = await contentId(file);
  const pkey = 'p|' + (cid || sig) + '|' + lang;
  const check = () => { if (cancelled.has(sig)) throw abortErr(); };
  const { openMp4 } = require('../engine/mp4');
  const mp = await openMp4(file);
  if (!mp.audio) throw new Error(file.name + ' has no audio.');
  const dur = opts.maxSeconds ? Math.min(mp.duration, opts.maxSeconds) : mp.duration; // maxSeconds jen pro testy
  const model = MODELS[opts.quality || 'standard'] || MODELS.standard;
  const { dev } = await device(model);
  const dtype = (typeof window !== 'undefined' && window.__pzAsrDtype) || undefined;
  // model má víc souborů (kodér, dekodér…) – hlásit součet v MB, ne procenta střídavě za každý soubor
  const dl = new Map();
  onDownload = (d) => {
    dl.set(d.file || '?', d);
    let L = 0, A = 0, net = false; for (const x of dl.values()) { L += x.loaded || 0; A += x.total || 0; if (!x.cached) net = true; }
    // z mezipaměti se jen načítá (žádné „stahování“); hlásit jen skutečné stahování
    if (onProgress) onProgress(0, net ? `downloading the speech model ${Math.round(L / 1048576)} / ${Math.max(1, Math.round(A / 1048576))} MB (once)` : 'loading the speech model');
  };
  onProgress && onProgress(0, 'loading the speech model');
  // souběžné přepisy na silném počítači (≥ 12 vláken, ≥ 8 GB): i velký model (2× ~1 GB v paměti)
  const N = dev === 'wasm' ? poolSize() : 1;
  const threads0 = N > 1 ? Math.max(1, Math.floor((((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1) / N)) : undefined;
  // window.__pzAsrThreads = N: počet vláken přepisu (simulace notebooku – počítač s omezenou afinitou dál hlásí všechna jádra)
  const threads = (typeof window !== 'undefined' && Number(window.__pzAsrThreads)) || threads0;
  // první vlákno model stáhne (a uloží), ostatní ho pak načtou z mezipaměti – ne dvojí stahování
  if (N > 1) { await askOn(0, { type: 'load', model, device: dev, threads }); await Promise.all(Array.from({ length: N - 1 }, (_, i) => askOn(i + 1, { type: 'load', model, device: dev, threads }))); }
  else await ask({ type: 'load', model, device: dev, dtype, threads });
  check();
  const words = [];
  const holesFixed = []; // opravené díry (do přepisu, pro kontrolu)
  let t0 = 0;
  // pokračování po Zastavit / zavření stránky: hotová část se nepřepisuje znovu
  const prev = !opts.force && !opts.maxSeconds && (partials.get(keyOf(file, lang)) || await dbGet(pkey));
  if (prev && prev.engine === ENGINE && prev.model === model && prev.upTo > 0 && prev.upTo < dur) {
    for (const w of prev.words) words.push(w);
    t0 = prev.upTo;
  }
  onProgress && onProgress(Math.max(0.001, t0 / dur), `${Math.round(t0 / dur * 100)} %`);
  while (t0 < dur - 0.2) {
    let t1 = Math.min(dur, t0 + WINDOW);
    check();
    const x = await audio16k(file, t0, Math.min(dur, t1 + 4));
    if (t1 < dur) t1 = quietest(x, t0, t1 - 4, t1 + 3.5).t;
    // kousky do 29 s, rozdělené v nejtišších místech (slovo se nerozpůlí, model nic neslučuje)
    const cuts = [t0];
    while (t1 - cuts[cuts.length - 1] > 29.5) { const a = cuts[cuts.length - 1]; cuts.push(quietest(x, t0, a + 22, a + 29.5).t); }
    cuts.push(t1);
    const audios = [], starts = [], ends = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const seg = x.subarray(Math.round((cuts[i] - t0) * 16000), Math.round((cuts[i + 1] - t0) * 16000));
      let e = 0; for (let k = 0; k < seg.length; k += 4) e += seg[k] * seg[k];
      if (Math.sqrt(e / Math.max(1, seg.length / 4)) < 0.002) continue; // ticho: Whisper by si vymýšlel
      audios.push(new Float32Array(seg)); starts.push(cuts[i]); ends.push(cuts[i + 1]);
    }
    const base = t0, span = t1 - t0;
    onStep = (st) => onProgress && onProgress(Math.min(0.99, (base + span * st.done / st.total) / dur), `${Math.round((base + span * st.done / st.total) / dur * 100)} %`);
    if (audios.length) {
      if (N > 1) {
        // kousky okna rozdělit mezi souběžná vlákna (střídavě), výsledky složit podle pořadí
        const parts = Array.from({ length: N }, (_, k) => audios.map((a, i) => i).filter((i) => i % N === k));
        poolDone.length = 0; poolTotal = audios.length;
        const rs = await Promise.all(parts.map((idx, k) => idx.length ? askOn(k, { type: 'run', model, device: dev, threads, language: LANGS[lang] || lang || null, audios: idx.map((i) => audios[i]) }, idx.map((i) => audios[i].buffer)) : null));
        rs.forEach((r, k) => { if (!r) return; r.outs.forEach((o, j) => { const i = parts[k][j]; for (const w of toWords({ words: false, chunks: o.chunks }, starts[i], ends[i])) words.push(w); }); });
      } else {
        const res = await ask({ type: 'run', model, device: dev, dtype, language: LANGS[lang] || lang || null, audios }, audios.map((a) => a.buffer));
        res.outs.forEach((o, i) => { for (const w of toWords({ words: false, chunks: o.chunks }, starts[i], ends[i])) words.push(w); });
      }
      // díry: řeč podle zvuku, ale > 3 s bez slova (report-3: přesný přepis vynechal úvod 25 s) → znovu v kratších kouscích (≤ 12 s)
      try {
        const thrW = levelOf(x) * Math.pow(10, -15 / 20);
        const winWords = words.filter((w) => w.e > t0 && w.s < t1);
        for (const h of findHoles(winWords, x, t0, thrW, t0, t1)) {
          check();
          const pieces = [h.s];
          while (h.e - pieces[pieces.length - 1] > 12.5) { const a = pieces[pieces.length - 1]; pieces.push(quietest(x, t0, a + 8, a + 12).t); }
          pieces.push(h.e);
          const auds = [], st = [], en = [];
          for (let i = 0; i < pieces.length - 1; i++) { auds.push(new Float32Array(x.subarray(Math.round((pieces[i] - t0) * 16000), Math.round((pieces[i + 1] - t0) * 16000)))); st.push(pieces[i]); en.push(pieces[i + 1]); }
          const rr = N > 1 ? await askOn(0, { type: 'run', model, device: dev, threads, language: LANGS[lang] || lang || null, audios: auds }, auds.map((a) => a.buffer))
            : await ask({ type: 'run', model, device: dev, dtype, language: LANGS[lang] || lang || null, audios: auds }, auds.map((a) => a.buffer));
          const neu = [];
          rr.outs.forEach((o, i) => { for (const w of toWords({ words: false, chunks: o.chunks }, st[i], en[i])) neu.push(w); });
          if (neu.length) {
            // slova v díře (včetně nesmyslně dlouhého „slova“) nahradit novými
            for (let k = words.length - 1; k >= 0; k--) { const m = (words[k].s + words[k].e) / 2; if (m >= h.s && m < h.e) words.splice(k, 1); }
            for (const w of neu) words.push(w);
            holesFixed.push({ s: h.s, e: h.e, words: neu.length });
          }
        }
      } catch (e) { if (e && e.name === 'AbortError') throw e; /* kontrola děr je navíc – přepis bez ní platí */ }
    }
    t0 = t1;
    // hotová část: AI ji může číst hned (poslední věta může být useknutá na hranici okna)
    if (!opts.maxSeconds && t0 < dur - 0.2) {
      const ws = dropHallucinations(dedupe(words.slice().sort((a, b) => a.s - b.s))).words;
      const pt = { engine: ENGINE, key: keyOf(file, lang), sig, file: file.name, language: lang, model, device: dev, duration: dur, words: ws, sentences: sentences(ws), partial: true, upTo: t0, created: Date.now() };
      partials.set(keyOf(file, lang), pt);
      dbPut(pkey, pt);
    }
    onProgress && onProgress(Math.min(0.99, t0 / dur), `${Math.round(t0 / dur * 100)} %`);
  }
  words.sort((a, b) => a.s - b.s);
  const hal = dropHallucinations(dedupe(words));
  words.length = 0; words.push(...hal.words);
  const sk = cid ? cid + '|' + lang : keyOf(file, lang);
  const t = { engine: ENGINE, key: sk, sig, file: file.name, language: lang, model, device: dev, duration: dur, words, sentences: sentences(words), holesFixed, removed: hal.removed, created: Date.now() };
  partials.delete(keyOf(file, lang));
  if (!opts.maxSeconds) { mem.set(sk, t); dbPut(sk, t); dbDel(pkey); }
  onProgress && onProgress(1, 'done');
  return t;
}

/**
 * Hranice střihu pro slova [a, b]. Časy vět z Whisperu v prohlížeči jsou jen přibližné (časy frází, ±0,2 s);
 * přesné časy slov (jako faster-whisper na desktopu) tu nejsou – zarovnání slov Whisperem v prohlížeči se
 * v testu rozpadalo. Změřeno na rozhovoru s přesnými časy z desktopu (test/tune-bounds.js): nejlépe vychází
 * nejtišší 20ms místo v ±0,2 s od odhadu (~50 % střihů do 40 ms od hranice slov). Proto výsledek nese
 * příznak approx a Claude dostane upozornění, ať uživatel střihy poslechne.
 */
async function cutBounds(file, t, a, b) {
  const W = t.words, first = W[a], last = W[b];
  let tin = Math.max(0, first.s), tout = Math.min(t.duration, last.e);
  let inOk = true, outOk = true; // false = podle zvuku tam není pauza (souvislá řeč) – hranice může useknout slovo
  try {
    const i = await edgeIn(file, t, a), o = await edgeOut(file, t, b);
    tin = i.t; inOk = i.ok; tout = o.t; outOk = o.ok;
  } catch (e) { /* bez zvuku: odhad z přepisu */ }
  if (tout <= tin + 0.2) { tin = Math.max(0, first.s); tout = Math.min(t.duration, last.e); }
  return { in: tin, out: tout, approx: true, inOk, outOk };
}
/* Začátek a konec se počítají každý zvlášť (práh z 8 s řeči za začátkem / před koncem), takže začátek věty vyjde stejně,
 * ať je vybraná sama nebo s dalšími – podle toho titulky poznají, že hranice klipu je hranice věty (clipCaptionWords).
 * Okno je nesymetrické: začátek věty hledáme spíš dřív, konec spíš později – raději kousek pauzy navíc než useknuté slovo
 * (test/tune-bounds.js). Práh pauzy: 15 dB pod úrovní řeči (horní kvartil 20ms oken). Když v úzkém okně pauza není, vezme
 * se nejbližší pauza směrem VEN. ok = podle zvuku je hranice v pauze (o časy slov z přepisu se nerozhoduje – bývají
 * posunuté o 0,1–0,5 s, kolo 4: „stalo.“). */
async function edgeIn(file, t, a) {
  const first = t.words[a];
  const thr = (await speechLevel(file, first.s, Math.min(t.duration || Infinity, first.s + 8))) * Math.pow(10, -15 / 20);
  const i0 = Math.max(0, first.s - 1.5); // (kolo 6: pauzy hledá i 1,2 s před větou)
  const x = await audio16k(file, i0, Math.min(t.duration, first.s + 2.2));
  let pi = null;
  // kolo 6 (tasks-5 úkol 1): časy slov přepisu bývají posunuté o desetiny sekundy → ze všech pauz v okolí (−1,2 … +0,6 s) ta,
  // kterou logika titulků (pauseBoundary) přiřadí přesně k hranici před vybranou větou; střih a titulky se tak shodnou
  // (B4a: In padl 0,7 s pozdě doprostřed „Já se taky moc těším.“). Nenajde-li se, postaru (nejtišší místo u začátku věty).
  if (EW.consistent && a > 0) {
    const W = t.words;
    let best = null;
    for (const pz of pausesIn(x, i0, Math.max(i0 + 0.05, first.s - 1.2), first.s + 0.6, thr)) {
      const mid = (pz.q0 + pz.q1) / 2;
      if (pauseBoundary(W, pz.q0, pz.q1, mid) !== a - 1) continue;
      if (!best || Math.abs(mid - first.s) < Math.abs(best.mid - first.s)) best = { mid, pz };
    }
    if (best) pi = { t: Math.min(best.pz.q1, Math.max(best.pz.q0, best.pz.q1 - 0.02)), ok: true };
  }
  if (!pi) pi = pauseNear(x, i0, Math.max(0, first.s - 0.25), first.s + 0.1, Math.max(0, first.s - 0.75), -1, thr, EW.nearest);
  // kolo 8: pauza (nebo nejtišší místo) až před celým slovem předchozí věty = klip by začal útržkem cizí věty („nasbírala, ne?“,
  // „neřekla ani doma?“) – raději střih v nejtišším místě mezery mezi slovy na hranici, je-li tam ticho
  const prv = a > 0 ? t.words[a - 1] : null;
  if (prv && EW.noOverreach && prv.e - prv.s > 0.1 && pi.t < prv.e - 0.12) {
    const q = quietest20(x, i0, Math.max(i0, prv.e - 0.1), first.s + 0.08);
    const v = rmsWin(x, i0, q, 0.03), soft = thr * Math.pow(10, (15 - EW.gapDb) / 20);
    // jen když je tam opravdu ticho (mezera mezi slovy) – jinak by střih padl do slova (časy přepisu bývají posunuté, R 23:20)
    if (deepAt(x, i0, q, thr) || (v !== null && v <= soft)) pi = { t: q, ok: v !== null && v <= thr };
  }
  let tin = pi.t, ok = pi.ok;
  // hák pro sítě: z pauzy jen krátký nádech (0,15 s) před nástupem řeči (tester kolo 2: 0,9 s ticha na začátku)
  if (ok) {
    tin = tightenIn(x, i0, tin, thr);
    // mezi předchozí řečí a nástupem méně než 0,08 s ticha → hák začne úlomkem (report-3 V3)
    let quietBefore = 0;
    for (let u = tin; u > tin - 0.2; u -= 0.005) { const v = rmsWin(x, i0, u, 0.03); if (v === null || v > thr) break; quietBefore += 0.005; }
    let onAfter = 0;
    for (let u = tin; u < tin + 0.3; u += 0.005) { const v = rmsWin(x, i0, u, 0.03); if (v === null || v > thr) break; onAfter += 0.005; }
    if (quietBefore + onAfter < 0.08) ok = false;
  }
  return { t: tin, ok: ok || deepAt(x, i0, tin, thr) };
}
async function edgeOut(file, t, b) {
  const last = t.words[b];
  const thr = (await speechLevel(file, Math.max(0, last.e - 8), last.e)) * Math.pow(10, -15 / 20);
  const o0 = Math.max(0, last.e - 1.35);
  const y = await audio16k(file, o0, Math.min(t.duration, last.e + 1.4));
  let po = null;
  if (EW.consistent && b + 1 < t.words.length) {
    const W = t.words;
    let best = null;
    for (const pz of pausesIn(y, o0, last.e - 1.0, Math.min(t.duration, last.e + 1.0), thr)) {
      const mid = (pz.q0 + pz.q1) / 2;
      if (pauseBoundary(W, pz.q0, pz.q1, mid) !== b) continue;
      if (!best || Math.abs(mid - last.e) < Math.abs(best.mid - last.e)) best = { mid, pz };
    }
    if (best) po = { t: Math.max(best.pz.q0, Math.min(best.pz.q1, best.pz.q0 + 0.02)), ok: true };
  }
  if (!po) po = pauseNear(y, o0, last.e - 0.1, Math.min(t.duration, last.e + 0.25), Math.min(t.duration, last.e + 0.75), 1, thr, EW.nearest);
  // kolo 8: pauza až za celým slovem další věty = klip by skončil začátkem cizí věty („Musí ho někdo“, „Aby“, „Já jsem“) –
  // střih v nejtišším místě mezery mezi slovy na hranici, je-li tam ticho
  const nxt = b + 1 < t.words.length ? t.words[b + 1] : null;
  if (nxt && EW.noOverreach && nxt.e - nxt.s > 0.1 && po.t > nxt.s + 0.12) {
    const q = quietest20(y, o0, last.e - 0.08, Math.min(t.duration, nxt.s + 0.1));
    const v = rmsWin(y, o0, q, 0.03), soft = thr * Math.pow(10, (15 - EW.gapDb) / 20);
    if (deepAt(y, o0, q, thr) || (v !== null && v <= soft)) po = { t: q, ok: v !== null && v <= thr };
  }
  let tout = po.t;
  // konec: doznění ~0,2 s po posledním slově, ale nikdy do dalšího slova (tester: konec jen 70 ms po slově)
  if (po.ok) tout = tightenOut(y, o0, tout, thr);
  return { t: tout, ok: po.ok || deepAt(y, o0, tout, thr) };
}
/** Hluboký propad v bodě t (30ms okno ≥ 30 dB pod řečí): krátká, ale čistá mezera mezi slovy – střih tu slovo neusekne
 *  (kolo 4, výrok 23:20: „stalo. | Ale“ jen 60 ms mezera, −33 dB). thr = práh 15 dB pod řečí. */
function deepAt(x, x0, t, thr) {
  const v = rmsWin(x, x0, t, 0.03);
  return v !== null && v <= thr * Math.pow(10, -15 / 20);
}
/** Začátek úseku z bodu t v pauze: první řeč do +1,2 s → t posunout na (nástup − pre); bez řeči t beze změny. */
function tightenIn(x, x0, t, thr, pre = 0.15, ahead = 2.0) {
  // nástup řeči za bodem t (v pauze)
  let on = null;
  for (let u = t; u <= t + ahead; u += 0.005) {
    const v = rmsWin(x, x0, u, 0.03);
    if (v === null) break;
    if (v > thr) { on = u - 0.015; break; }
  }
  if (on === null) return t;
  // cíl = nástup − pre (0,15 s nádech) – i dřív než t, ale nikdy do předchozí řeči
  let want = on - pre;
  for (let u = on - 0.02; u >= want; u -= 0.005) {
    const v = rmsWin(x, x0, u, 0.03);
    if (v !== null && v > thr) { want = u + 0.03; break; }
  }
  return Math.max(x0 + 0.015, want);
}
/** Konec úseku z bodu t v pauze: poslední řeč před t (do −1,2 s) + doznění post, ale nejvýš 0,05 s před další řečí. */
function tightenOut(x, x0, t, thr, post = 0.2, back = 1.2) {
  let off = null;
  for (let u = t; u >= t - back; u -= 0.005) {
    const v = rmsWin(x, x0, u, 0.03);
    if (v === null) break;
    if (v > thr) { off = u + 0.015; break; }
  }
  if (off === null) return t;
  let next = null;
  for (let u = Math.max(t, off + 0.03); u <= off + post + 0.5; u += 0.005) {
    const v = rmsWin(x, x0, u, 0.03);
    if (v === null) break;
    if (v > thr) { next = u - 0.015; break; }
  }
  let want = off + post;
  if (next !== null) want = Math.min(want, next - 0.05);
  return Math.max(off + 0.05, want);
}
/**
 * Časy slov podle zvuku (titulky, karaoke): Whisper v prohlížeči dává časy frází rozpočítané podle délky slov – první slovo
 * fráze po pauze často „svítí“ dřív, než řeč začne (tester: 0,4 s). 1) slovo, které celé leží v tichu (např. „to.“ z předchozí
 * věty v pauze), vypadne; 2) každá fráze po pauze začne nástupem řeči a slova se v ní rozpočítají znovu (poměr délek zůstane).
 * words = [{w, s, e}] ve zdrojovém čase, x = zvuk 16 kHz od x0, thr = práh řeči.
 */
function speechAlign(words, x, x0, thr) {
  const loud = (a, b) => { for (let u = a; u <= b; u += 0.01) { const v = rmsWin(x, x0, u, 0.03); if (v !== null && v > thr) return true; } return false; };
  const quiet = (a, b) => { for (let u = a; u <= b; u += 0.01) { const v = rmsWin(x, x0, u, 0.03); if (v === null || v > thr * 0.5) return false; } return true; };
  const kept = words.filter((w, k) => {
    const nx = words[k + 1];
    const endOfPrev = /[.?!…]["“”»)]*$/.test(w.w) && nx && /^[„"«(]?\p{Lu}/u.test(nx.w);
    return !(endOfPrev && quiet(w.s, w.e));
  });
  const out = kept.map((w) => ({ ...w }));
  let i = 0;
  while (i < out.length) {
    let j = i;
    while (j + 1 < out.length && out[j + 1].s - out[j].e <= 0.25) j++;
    const p0 = out[i].s, p1 = out[j].e;
    // nástup řeči kolem začátku fráze (−0,3 … +1,0 s), ne za polovinou fráze; nástup = hlasité místo PO aspoň 40 ms ticha
    // (kolo 4: okno začínalo v dozvuku předchozího slova → fráze se posunula o 0,3 s dřív a první slovo „tak“/„Takže“ vypadlo z klipu)
    // Začíná-li okno v řeči (dozvuk předchozího slova nebo fráze začala dřív), nástup smí být nejvýš 0,15 s za odhadem.
    let on = null, quietRun = 0, startLoud = null;
    for (let u = Math.max(x0, p0 - 0.3); u <= Math.min(p0 + 1.0, p0 + (p1 - p0) / 2); u += 0.005) {
      const v = rmsWin(x, x0, u, 0.03);
      if (v === null) continue;
      if (startLoud === null) startLoud = v > thr;
      if (startLoud && u > p0 + 0.15) break;
      if (v <= thr) { quietRun += 0.005; continue; }
      if (quietRun >= 0.04) { on = u - 0.015; break; }
      quietRun = 0;
    }
    if (on !== null && Math.abs(on - p0) > 0.03 && p1 - on > 0.08 * (j - i + 1)) {
      const k = (p1 - on) / Math.max(0.01, p1 - p0);
      for (let q = i; q <= j; q++) { out[q].s = on + (out[q].s - p0) * k; out[q].e = on + (out[q].e - p0) * k; }
    }
    i = j + 1;
  }
  return out;
}
/** Úroveň řeči (RMS horního kvartilu 20ms oken) v už dekódovaném zvuku. */
function levelOf(x) {
  const v = [];
  for (let i = 0; i + 320 <= x.length; i += 320) { let e = 0; for (let k = i; k < i + 320; k++) e += x[k] * x[k]; v.push(Math.sqrt(e / 320)); }
  if (!v.length) return 0;
  v.sort((p, q) => p - q);
  return v[Math.floor(v.length * 0.75)];
}
/**
 * Díry v přepisu: úseky [a, b] (v rozsahu from–to), kde podle zvuku zní řeč (≥ 30 % oken nad prahem) a přes 3 s v nich
 * není žádné slovo – „slovo“ delší než 3 s (Whisper tak přikryje vynechaný úsek) se nepočítá. Vrací [{s, e}].
 */
function findHoles(words, x, x0, thr, from, to, minLen = 3) {
  const cover = words.filter((w) => w.e - w.s <= 3).map((w) => [w.s, w.e]).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let at = from;
  for (const [a, b] of cover) { if (a - at > minLen) gaps.push([at, a]); at = Math.max(at, b); }
  if (to - at > minLen) gaps.push([at, to]);
  const out = [];
  for (const [a, b] of gaps) {
    let n = 0, sp = 0, first = null, last = null;
    for (let u = a + 0.05; u < b - 0.05; u += 0.1) { const v = rmsWin(x, x0, u, 0.03); if (v === null) continue; n++; if (v > thr) { sp++; if (first === null) first = u; last = u; } }
    if (n && sp / n >= 0.3 && last - first > minLen * 0.8) out.push({ s: Math.max(a, first - 0.3), e: Math.min(b, last + 0.3) });
  }
  return out;
}
/** Úroveň řeči (RMS horního kvartilu 20ms oken) v úseku – nejvýš prvních 8 s. */
async function speechLevel(file, a, b) {
  const x = await audio16k(file, a, Math.min(b, a + 8));
  const v = [];
  for (let i = 0; i + 320 <= x.length; i += 160) { let e = 0; for (let k = i; k < i + 320; k++) e += x[k] * x[k]; v.push(Math.sqrt(e / 320)); }
  if (!v.length) return 0;
  v.sort((p, q) => p - q);
  return v[Math.floor(v.length * 0.75)];
}
/** RMS okna délky w (s) se středem v t, nebo null mimo data. */
function rmsWin(x, x0, t, w) {
  const n = Math.round(w * 16000), i0 = Math.round((t - w / 2 - x0) * 16000);
  if (i0 < 0 || i0 + n > x.length) return null;
  let e = 0; for (let k = i0; k < i0 + n; k++) e += x[k] * x[k];
  return Math.sqrt(e / n);
}
// pauza mezi slovy trvá aspoň ~60 ms; kratší ticho bývá uvnitř slova (p, t, k) – to za hranici brát nesmíme
const PAUSE_W = 0.06;
/** Hranice v pauze: střed nejtiššího 60ms místa v [a, b]; není-li to pauza (nad prahem), první pauza směrem ven
 *  (dir −1 = dřív, +1 = později) až po far; bez pauzy nejtišší místo v celém rozšířeném okně. */
function pauseNear(x, x0, a, b, far, dir, thr, nearest) {
  const quiet = (p, q) => { let bt = (p + q) / 2, br = Infinity; for (let t = p; t <= q; t += 0.005) { const v = rmsWin(x, x0, t, PAUSE_W); if (v !== null && v < br) { br = v; bt = t; } } return { t: bt, r: br }; };
  // nearest (kolo 5, B3/B4): z pauz v okně ta nejblíž vybrané větě – pro začátek poslední (dir −1), pro konec první (dir +1);
  // nejtišší místo mohlo ležet před posledním slovem předchozí věty („práce,“) a to pak v klipu zaznělo
  if (nearest && thr) {
    let best = null, run = [];
    const flush = () => { if (run.length) { const mid = run[Math.floor(run.length / 2)]; if (dir < 0 ? (best === null || mid > best) : (best === null)) best = mid; } run = []; };
    for (let t = a; t <= b; t += 0.005) { const v = rmsWin(x, x0, t, PAUSE_W); if (v !== null && v <= thr) run.push(t); else flush(); }
    flush();
    if (best !== null) return { t: best, ok: true };
  }
  const q = quiet(a, b);
  if (!thr || q.r <= thr) return { t: q.t, ok: true };
  for (let t = dir < 0 ? a : b; dir < 0 ? t >= far : t <= far; t += dir * 0.005) {
    const v = rmsWin(x, x0, t, PAUSE_W);
    if (v !== null && v <= thr) return { t: t + dir * 0.015, ok: true }; // kousek dál do ticha (doznění slova)
  }
  return { t: quiet(Math.min(a, far), Math.max(b, far)).t, ok: false };
}
function quietest20(x, x0, a, b) {
  const win = 320;
  let best = (a + b) / 2, be = Infinity;
  for (let t = a; t + 0.02 <= b; t += 0.005) {
    const i0 = Math.round((t - x0) * 16000);
    if (i0 < 0 || i0 + win > x.length) continue;
    let e = 0; for (let k = i0; k < i0 + win; k++) e += x[k] * x[k];
    if (e < be) { be = e; best = t + 0.01; }
  }
  return best;
}

function forMedia(m, lang) {
  const f = vfs.getFile(m.path);
  if (!f) return null;
  const sig = sigOf(f), cid = sigCid.get(sig);
  for (const [k, v] of mem) if ((cid && k.startsWith(cid + '|')) || v.sig === sig || k.startsWith(sig + '|')) { if (!lang || v.language === lang) return v; }
  return null;
}
async function loadForMedia(m) {
  const f = vfs.getFile(m.path);
  if (!f) return null;
  const hit = forMedia(m);
  if (hit) return hit;
  for (const l of Object.keys(LANGS)) { const t = await cached(f, l); if (t) return t; }
  return null;
}

/* ---------- přesné titulky na notebooku (kolo 5, tasks-4 úkol 2) ----------
 * Notebook má k hledání standardní přepis celého klipu; přesný model se jen stáhne na pozadí (prefetch) a „Titulky z přepisu“
 * přepíšou přesně jen úseky klipů v sekvenci (transcribeRange) – desítky sekund místo minut. */
const pf = { state: 'none', loaded: 0, total: 0, error: '', job: null, listeners: new Set() };
function pfEmit() { for (const f of pf.listeners) { try { f(pf); } catch (e) { /* posluchač */ } } }
/** Stažení přesného modelu do úložiště prohlížeče bez načtení do paměti. Stav: prefetchState(); onPrefetch(f) = posluchač. */
function prefetch(quality = 'accurate') {
  if (pf.job) return pf.job;
  const model = MODELS[quality] || MODELS.accurate;
  pf.state = 'running'; pf.error = ''; pfEmit();
  const w = new Worker('whisper-worker.js', { type: 'module' });
  pf.job = new Promise((resolve, reject) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'prefetch') { pf.loaded = m.loaded; pf.total = m.total; pfEmit(); return; }
      if (m.type === 'ready') { pf.state = 'done'; pf.loaded = pf.total; w.terminate(); pfEmit(); resolve(true); return; }
      if (m.type === 'error') { pf.state = 'error'; pf.error = m.error; w.terminate(); pfEmit(); reject(new Error(m.error)); }
    };
    w.onerror = (e) => { pf.state = 'error'; pf.error = e.message || 'prefetch failed'; pfEmit(); reject(new Error(pf.error)); };
    w.postMessage({ type: 'prefetch', model, id: ++reqId });
  });
  pf.job.catch(() => { pf.job = null; });
  return pf.job;
}
function prefetchState() { return { state: pf.state, loaded: pf.loaded, total: pf.total, error: pf.error }; }
function onPrefetch(f) { pf.listeners.add(f); return () => pf.listeners.delete(f); }
/** Je model v úložišti prohlížeče (OPFS)? Kontrola podle největšího souboru (kodér). */
async function modelStored(quality = 'accurate') {
  try {
    const model = MODELS[quality] || MODELS.accurate;
    const key = ('huggingface.co/' + model + '/resolve/main/onnx/encoder_model_quantized.onnx').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-200);
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('pz-models');
    const f = await (await dir.getFileHandle(key)).getFile();
    return f.size > 100e6;
  } catch (e) { return false; }
}
const rangeCache = new Map(); // cid|a|b|model -> words
/** Přesný přepis úseku [a, b] souboru (slova ve zdrojovém čase). Běží ve frontě s ostatními přepisy (jedno vlákno modelu).
 *  onProgress(p 0–1, text). Výsledek se pamatuje (dialog titulků se ptá víckrát). */
async function transcribeRange(file, a, b, opts = {}, onProgress) {
  const quality = opts.quality || 'accurate', lang = opts.language || 'cs';
  const model = MODELS[quality] || MODELS.accurate;
  const cid = await contentId(file);
  const key = `${cid || sigOf(file)}|${a.toFixed(2)}|${b.toFixed(2)}|${model}`;
  if (rangeCache.has(key)) return rangeCache.get(key);
  const job = chain.then(async () => {
    const { dev } = await device(model);
    const dl = new Map();
    onDownload = (d) => { dl.set(d.file || '?', d); let L = 0, A = 0, net = false; for (const x of dl.values()) { L += x.loaded || 0; A += x.total || 0; if (!x.cached) net = true; }
      if (onProgress) onProgress(0, net ? `downloading the speech model ${Math.round(L / 1048576)} / ${Math.max(1, Math.round(A / 1048576))} MB (once)` : 'loading the speech model'); };
    onProgress && onProgress(0, 'loading the speech model');
    const threads = (typeof window !== 'undefined' && Number(window.__pzAsrThreads)) || undefined;
    await ask({ type: 'load', model, device: dev, threads });
    const x = await audio16k(file, a, b);
    // kousky do 29 s v nejtišších místech
    const cuts = [a];
    while (b - cuts[cuts.length - 1] > 29.5) { const c0 = cuts[cuts.length - 1]; cuts.push(quietest(x, a, c0 + 22, c0 + 29.5).t); }
    cuts.push(b);
    const audios = [], st = [], en = [];
    for (let i = 0; i < cuts.length - 1; i++) { audios.push(new Float32Array(x.subarray(Math.round((cuts[i] - a) * 16000), Math.round((cuts[i + 1] - a) * 16000)))); st.push(cuts[i]); en.push(cuts[i + 1]); }
    onStep = (s1) => onProgress && onProgress(Math.min(0.99, s1.done / s1.total), `${Math.round(s1.done / s1.total * 100)} %`);
    onProgress && onProgress(0.01, '1 %');
    const res = await ask({ type: 'run', model, device: dev, language: LANGS[lang] || lang || null, audios }, audios.map((q) => q.buffer));
    const words = [];
    res.outs.forEach((o, i) => { for (const w of toWords({ words: false, chunks: o.chunks }, st[i], en[i])) words.push(w); });
    const clean = dropHallucinations(dedupe(words.sort((p, q) => p.s - q.s))).words;
    onProgress && onProgress(1, '100 %');
    return clean;
  });
  chain = job.catch(() => {});
  const words = await job;
  rangeCache.set(key, words);
  return words;
}

/** Rozpracovaný přepis média (hotová část), nebo null. */
function partialForMedia(m) {
  const f = vfs.getFile(m.path);
  if (!f) return null;
  for (const [k, v] of partials) if (k.startsWith(`${f.name}|${f.size}|${f.lastModified}|`)) return v;
  return null;
}
/** Rozpracovaný přepis z úložiště (po Zastavit nebo zavření stránky) – pro zobrazení „zastaveno“. */
async function savedPartial(m, lang = 'cs') {
  const f = vfs.getFile(m.path);
  if (!f) return null;
  const mp = partialForMedia(m);
  if (mp) return mp;
  const cid = await contentId(f);
  const p = await dbGet('p|' + (cid || sigOf(f)) + '|' + lang);
  if (p && p.engine === ENGINE) { partials.set(keyOf(f, lang), p); return p; }
  return null;
}
/** Zastavit přepis souboru: čekající se nespustí, běžící skončí hned (vlákna se ukončí, uvolní procesor).
 *  Hotová část (po 4 min úsecích) zůstane a příští spuštění na ni naváže. */
function stop(file) {
  const sig = sigOf(file);
  cancelled.add(sig);
  if (current !== sig) return;
  const err = abortErr();
  for (const x of waiters.values()) x.reject(err);
  waiters.clear();
  if (worker) { worker.terminate(); worker = null; }
  for (let i = 0; i < pool.length; i++) if (pool[i]) { pool[i].terminate(); pool[i] = null; }
}
function isStopped(file) { return cancelled.has(sigOf(file)); }

/** Slova přepisu, která v klipu sekvence opravdu zazní (střed slova uvnitř In–Out), v čase sekvence.
 *  Samotné pomlčky (střídání mluvčích) se vynechají, pomlčka na začátku slova se odstraní. */
function clipWords(t, c) {
  const out = [];
  for (const w of t.words) {
    const mid = (w.s + w.e) / 2;
    if (mid < c.in || mid >= c.out) continue;
    if (!/[\p{L}\p{N}]/u.test(w.w)) continue;
    out.push({ w: w.w.replace(/^[-–—]\s*/, ''), s: c.start + Math.max(0, w.s - c.in), e: c.start + Math.min(c.out, w.e) - c.in });
  }
  return out;
}

/**
 * Přepis s opravami (z titulků): slova, jejichž střed leží v úseku opravy [s, e), nahradí slova opraveného textu,
 * rozpočítaná podle délky do času nahrazených slov. Vrací nový objekt přepisu (původní zůstává beze změny).
 */
function applyFixes(t, fixes) {
  if (!t || !fixes || !fixes.length) return t;
  let words = t.words.slice();
  for (const f of fixes.slice().sort((a, b) => a.s - b.s)) {
    const hit = [], keep = [];
    for (const w of words) ((w.s + w.e) / 2 >= f.s && (w.s + w.e) / 2 < f.e ? hit : keep).push(w);
    const toks = String(f.text).split(/\s+/).filter(Boolean);
    const nz = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    // soused těsně před / za úsekem, který oprava obsahuje na kraji (uživatel dopsal slovo, které v titulku chybělo)
    const before = keep.filter((w) => w.e <= f.s + 0.01 && w.e > f.s - 1.5).pop();
    if (before && toks.length > 1 && nz(before.w) === nz(toks[0])) { keep.splice(keep.indexOf(before), 1); hit.unshift(before); }
    const after = keep.find((w) => w.s >= f.e - 0.01 && w.s < f.e + 1.5);
    if (after && toks.length > 1 && nz(after.w) === nz(toks[toks.length - 1])) { keep.splice(keep.indexOf(after), 1); hit.push(after); }
    const a = hit.length ? hit[0].s : f.s, b = hit.length ? hit[hit.length - 1].e : f.e;
    const total = toks.reduce((x, w) => x + w.length + 1, 0) || 1;
    let at = a;
    const add = toks.map((w) => { const d = (b - a) * (w.length + 1) / total; const o = { w, s: at, e: at + d * 0.92, fixed: true }; at += d; return o; });
    words = keep.concat(add).sort((x, y) => x.s - y.s);
  }
  return Object.assign({}, t, { words, sentences: sentences(words), fixed: fixes.length });
}

/** Úsek [s, e) slov přepisu, která tvoří text oldText v okolí [s0, e0] (±1 s) – nejlepší shoda slov (aspoň polovina). */
function matchSpan(words, s0, e0, oldText) {
  const nz = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const toks = String(oldText).split(/\s+/).map(nz).filter(Boolean);
  const cand = words.filter((w) => (w.s + w.e) / 2 >= s0 - 1 && (w.s + w.e) / 2 <= e0 + 1);
  const n = toks.length;
  if (!n || cand.length < n) return null;
  let best = null;
  for (let i = 0; i + n <= cand.length; i++) {
    let sc = 0; for (let k = 0; k < n; k++) if (nz(cand[i + k].w) === toks[k]) sc++;
    const dist = Math.abs(cand[i].s - s0);
    if (!best || sc > best.sc || (sc === best.sc && dist < best.dist)) best = { sc, dist, i };
  }
  if (!best || best.sc < Math.max(1, Math.ceil(n / 2))) return null;
  return { s: cand[best.i].s, e: cand[best.i + n - 1].e };
}

/**
 * Úlomky vět na krajích klipu (konec předchozí věty „…zvládáš to.“ / začátek další „Co ti…“): Whisper je časuje do pauzy,
 * kde In/Out leží, takže by se objevily v titulku, ale v klipu nezazní. Slovo vypadne jen když (1) jeho věta je v klipu méně
 * než z poloviny a (2) v jeho čase uvnitř klipu není řeč (pod prahem). Vyslovené slovo nikdy (developer-rules 10).
 * words = srovnaná slova s indexem k do t.words, sentences = t.sentences (w0, w1), c = klip {in, out}.
 */
function dropEdgeFragments(words, sentences, c, x, x0, thr) {
  const sentOf = (k) => sentences.findIndex((s) => k >= s.w0 && k <= s.w1);
  const inside = (w) => (w.s + w.e) / 2 >= c.in && (w.s + w.e) / 2 < c.out;
  const share = new Map();
  for (const w of words) {
    if (w.k == null) continue;
    const si = sentOf(w.k);
    if (si < 0) continue;
    const r = share.get(si) || { n: sentences[si].w1 - sentences[si].w0 + 1, in: 0 };
    if (inside(w)) r.in++;
    share.set(si, r);
  }
  // hranice klipu v pauze (výběr celých vět) → úlomky vět za ní do klipu nepatří; hranice v řeči (ruční střih uprostřed věty) → nechat
  const quietAt = (u) => { const v = rmsWin(x, x0, u, 0.06); return v !== null && v <= thr; };
  const major = [...share.entries()].filter(([, r]) => r.in / r.n >= 0.5).map(([si]) => si);
  const firstMaj = major.length ? Math.min(...major) : -1, lastMaj = major.length ? Math.max(...major) : -1;
  const inQuiet = quietAt(c.in + 0.02), outQuiet = quietAt(c.out - 0.02);
  const majW = words.filter((w) => w.k != null && major.includes(sentOf(w.k)) && inside(w));
  const firstWordStart = majW.length ? Math.min(...majW.map((w) => w.s)) : c.in;
  const lastWordEnd = majW.length ? Math.max(...majW.map((w) => w.e)) : c.out;
  const speech = (a, b) => { for (let u = Math.max(a, c.in); u <= Math.min(b, c.out); u += 0.01) { const v = rmsWin(x, x0, u, 0.03); if (v !== null && v > thr) return true; } return false; };
  return words.filter((w) => {
    if (w.k == null || !inside(w)) return true;
    const si = sentOf(w.k), r = share.get(si);
    if (!r || r.in / r.n >= 0.5) return true;
    // úlomek sousední věty vypadne jen když mezi hranicí klipu a hlavní větou NENÍ řeč (In/Out v pauze a nic dalšího nezazní);
    // je-li tam řeč (dlouhé slepené věty, ruční In – report-3 „Tak“, „to.“), slova patří do titulku
    if (firstMaj >= 0 && si < firstMaj) return !(inQuiet && !speech(c.in, firstWordStart - 0.1));
    if (lastMaj >= 0 && si > lastMaj) return !(outQuiet && !speech(lastWordEnd + 0.1, c.out));
    return speech(w.s, w.e);
  });
}

/** Slova titulků klipu c ({in, out, start}) – jen to, co v klipu zazní. Sdílí bridge.seqWords i test/edges.js.
 *  Časy slov z přepisu bývají proti zvuku posunuté o 0,1–0,6 s (kolo 4, test/edges.js), proto o krajích rozhoduje zvuk:
 *  - hranice klipu v pauze (aspoň 60 ms ticha nebo hluboký propad) = hranice mezi slovy; které to je, určí nejbližší mezera
 *    mezi slovy přepisu k pauze (+ obvyklý posun 0,15 s), konec věty/čárka má přednost (edgeWord). Slova za ní do klipu nepatří,
 *    slova před ní ano, i když je přepis časuje o kus vedle („stalo.“ navíc, „tak“ a „to.“ chyběly);
 *  - hranice v souvislé řeči (varování) → slovo, do kterého střih padne, v titulcích zůstane (je slyšet aspoň zčásti).
 *  Časy slov uvnitř klipu srovná speechAlign (nástup řeči po pauze). */
async function clipCaptionWords(file, t, c) {
  let src = t;
  try {
    const W = t.words;
    const dur = t.duration || c.out + 1.2;
    const a0 = Math.max(0, c.in - 1.2), a1 = Math.min(dur, c.out + 1.2);
    const inClip = [];
    W.forEach((w, k) => { if (w.e > a0 && w.s < a1) inClip.push(Object.assign({}, w, { k })); });
    const x = await audio16k(file, a0, a1);
    const thr = (await speechLevel(file, c.in, Math.min(c.out, c.in + 8))) * Math.pow(10, -15 / 20);
    const al = speechAlign(inClip, x, a0, thr);
    const byK = new Map(al.map((w) => [w.k, w]));
    // začátek podle pauzy jen u přesného přepisu; u standardního (malý model, volnější časy slov) vyšlo líp podle času slov
    // + úlomků v tichu (test/edges.js, kolo 4: standardní začátky 31/39 postaru × 24/39 podle pauzy; konce 26 × 30)
    const mapIn = EW.mapIn === 'all' || (EW.mapIn === 'accurate' && /large/.test(t.model || '')) || EW.mapIn === true;
    const def = mapIn ? null : new Set(dropEdgeFragments(al, t.sentences || sentences(W), c, x, a0, thr).map((w) => w.k));
    const kIn = mapIn ? edgeWord(W, x, a0, thr, c.in, true) : -1, kOut = edgeWord(W, x, a0, thr, c.out, false);
    const words = [];
    let last = c.in;
    for (const w0 of inClip) {
      const k = w0.k;
      if (k < kIn || k > kOut) continue;
      const near = (w0.s < c.in + 1 || w0.e > c.out - 1);
      // uprostřed klipu: slovo, které speechAlign vyřadil (celé v tichu), zůstane venku; na krajích rozhoduje hranice
      if (!byK.has(k) && !near) continue;
      if (!mapIn && w0.s < c.in + 1) { const al1 = byK.get(k); if (!al1 || !def.has(k) || (al1.s + al1.e) / 2 < c.in) continue; }
      const o = Object.assign({}, byK.get(k) || w0);
      o.s = Math.max(o.s, c.in, last); o.e = Math.min(Math.max(o.e, o.s + 0.08), c.out);
      if (o.e - o.s < 0.04) o.s = Math.max(c.in, o.e - 0.04);
      last = o.s;
      words.push(o);
    }
    src = { words };
  } catch (e) { /* bez zvuku: časy z přepisu */ }
  return clipWords(src, c);
}
/* Ladění edgeWord (test/edges.js, kolo 4): posun přepisu proti zvuku a přednost konce věty / čárky (s). */
const EW = { bias: 0, end: 0.4, comma: 0.1, inFrac: 1, mapIn: 'accurate', nearest: false, consistent: false, noOverreach: true, gapDb: 10, gapSpan: true }; // gapDb kolo 8: 15 → 10 (seed A +1 začátek +1 konec, seed B beze změny) // consistent: kolo 6 zkoušeno, na ladicích sadách horší (30→27, 34→30 ze 40)
if (typeof process !== 'undefined' && process.env && process.env.PZ_EW) Object.assign(EW, JSON.parse(process.env.PZ_EW));
/** Mezera mezi slovy k | k+1, kterou pauza [q0, q1] ve zvuku odděluje (nejblíž pauze, konec věty/čárka mají přednost);
 *  k = −1 = před prvním slovem přepisu. u = bod střihu (okno hledání −0,4 … +0,9 s). null = žádná. */
function pauseBoundary(W, q0, q1, u, span = false) {
  let best = null;
  for (let k = -1; k + 1 < W.length; k++) {
    // mezera mezi slovy jako úsek [g0, g1] (ne jen její střed – kolo 8: 2s ticho před „Nebyla“ mělo střed 1 s před střihem a vypadlo)
    const g0 = k < 0 ? W[0].s - 0.05 : W[k].e, g1 = k < 0 ? W[0].s : W[k + 1].s;
    const bt = (g0 + g1) / 2;
    // okno −0,4 … +0,9 s kolem střihu; mezera, která sahá do samotné pauzy, se počítá vždy (přepis bývá o 0,5 s dřív –
    // kolo 7: „Myslím“ přepis 207,84 s, zvuk 208,38 s, In 208,32 → mezera „období. | Myslím“ 0,54 s před In vypadla)
    if ((span ? g1 : bt) < Math.min(u - 0.4, q0 - 0.02)) continue;
    if (g0 > u + 0.9) break; // jen směrem dozadu (Myslím); dopředu ne – kolo 8: tiché první slovo „Nebyla“ uvnitř pauzy vypadlo
    const bonus = k < 0 ? EW.end : /[.?!…]["“”»)]*$/.test(W[k].w) ? EW.end : /[,;:–—]["“”»)]*$/.test(W[k].w) ? EW.comma : 0;
    const d = span ? Math.max(0, q0 + EW.bias - g1, g0 - (q1 + EW.bias)) : Math.max(0, q0 + EW.bias - bt, bt - (q1 + EW.bias));
    const sc = d - bonus;
    if (!best || sc < best.sc) best = { k, sc };
  }
  return best ? best.k : null;
}
/** Pauzy ve zvuku v [a, b]: úseky 60ms okna pod prahem nebo hluboký propad (≥ 30 dB pod řečí) → [{ q0, q1 }]. */
function pausesIn(x, x0, a, b, thr) {
  const out = [];
  let r0 = null;
  for (let u = a; u <= b; u += 0.005) {
    const v60 = rmsWin(x, x0, u, PAUSE_W);
    const q = (v60 !== null && v60 <= thr) || deepAt(x, x0, u, thr);
    if (q && r0 === null) r0 = u;
    if (!q && r0 !== null) { out.push({ q0: r0, q1: u - 0.005 }); r0 = null; }
  }
  if (r0 !== null) out.push({ q0: r0, q1: b });
  return out;
}
/** Index prvního (isIn) / posledního slova přepisu, které na hranici u v klipu zazní. */
function edgeWord(W, x, x0, thr, u, isIn) {
  // pauza kolem hranice podle zvuku
  const quiet = (p) => { const v = rmsWin(x, x0, p, 0.03); return v !== null && v <= thr; };
  // pauza (60 ms pod prahem) nebo hluboký propad v okolí ±0,12 s: tightenIn/Out nechávají kolem pauzy kousek nádechu/doznění
  let pt = null;
  for (let d = 0; d <= 0.12 && pt === null; d += 0.005) {
    for (const p of d ? [u - d, u + d] : [u]) {
      const v60 = rmsWin(x, x0, p, PAUSE_W);
      if ((v60 !== null && v60 <= thr) || deepAt(x, x0, p, thr)) { pt = p; break; }
    }
  }
  if (pt !== null) {
    let q0 = pt, q1 = pt;
    while (q0 > u - 1 && quiet(q0 - 0.005)) q0 -= 0.005;
    while (q1 < u + 1 && quiet(q1 + 0.005)) q1 += 0.005;
    // začátek: mezera jako celý úsek (dlouhé ticho před slovem), konec postaru (kolo 8: úsek na koncích zhoršil 2 z 46)
    const k = pauseBoundary(W, q0, q1, u, isIn && EW.gapSpan);
    if (k !== null) return isIn ? k + 1 : k;
  }
  // souvislá řeč: na začátku slovo, do kterého střih padne, zůstane (je slyšet aspoň zčásti – report-3 V3 „…vůbec“);
  // na konci rozhoduje střed slova (přepis bývá pozdě, slovo začínající těsně před koncem obvykle v klipu nezazní)
  if (isIn) { for (let k = 0; k < W.length; k++) if (W[k].s + (W[k].e - W[k].s) * EW.inFrac > u) return k; return W.length; }
  for (let k = W.length - 1; k >= 0; k--) if ((W[k].s + W[k].e) / 2 < u) return k;
  return -1;
}

module.exports = { prefetch, prefetchState, onPrefetch, modelStored, transcribeRange, hallucinated, dropHallucinations, edgeIn, edgeOut, clipCaptionWords, findHoles, levelOf, dropEdgeFragments, matchSpan, applyFixes, clipWords, pauseNear, tightenIn, tightenOut, speechAlign, speechLevel, rmsWin, partialForMedia, savedPartial, stop, isStopped, contentId, transcribe, cutBounds, forMedia, loadForMedia, textOf, sentences, MODELS, LANGS, audio16k, device };
