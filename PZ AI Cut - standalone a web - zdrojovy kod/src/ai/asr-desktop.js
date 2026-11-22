'use strict';
/* Přepis řeči ve standalone (kolo S1, redaktorka: „ve standalone chybí přepis“). Stejné rozhraní window.__pzASR jako webová verze
 * (web/ai/bridge.js) – panel Přepis, stav u klipu, titulky z přepisu i Přepsat řeč fungují beze změny. Jen motor je jiný:
 * místo Whisperu v prohlížeči lokální Worker MY Premiere MCP (faster-whisper large-v3 na grafice, sdílená mezipaměť přepisů).
 * Hranice střihu a titulky z přepisu počítá web/ai/transcripts.js (zvuk 16 kHz tady dekóduje ffmpeg). */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const T = require('../../web/ai/transcripts');
const CLq = require('../core/captionlayout');

/** Soubor z disku s rozhraním, které čeká transcripts.js (name, size, lastModified, slice().arrayBuffer(), decode16k). */
class DFile {
  constructor(p, ffmpeg) {
    const st = fs.statSync(p);
    this.path = p; this.name = path.basename(p); this.size = st.size; this.lastModified = Math.round(st.mtimeMs); this.ffmpeg = ffmpeg; this.fd = null;
  }
  slice(a, b) {
    const self = this;
    return {
      async arrayBuffer() {
        if (self.fd === null) self.fd = fs.openSync(self.path, 'r');
        const n = Math.max(0, Math.min(b, self.size) - a);
        const buf = Buffer.alloc(n);
        fs.readSync(self.fd, buf, 0, n, a);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + n);
      },
    };
  }
  /** Zvuk [t0, t1) jako 16 kHz mono Float32 (ffmpeg – jakýkoli kontejner a kodek). */
  decode16k(t0, t1) {
    const a = Math.max(0, t0), d = Math.max(0.05, t1 - a);
    return new Promise((res, rej) => {
      const p = spawn(this.ffmpeg, ['-nostdin', '-v', 'error', '-ss', a.toFixed(3), '-i', this.path, '-t', d.toFixed(3), '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], { windowsHide: true });
      const parts = []; let err = '';
      p.stdout.on('data', (b) => parts.push(b));
      p.stderr.on('data', (b) => { err += b; });
      p.on('error', rej);
      p.on('close', (code) => {
        const b = Buffer.concat(parts);
        if (code !== 0 && !b.length) { rej(new Error('ffmpeg: ' + err.trim().slice(0, 200))); return; }
        const n = b.length >> 2, out = new Float32Array(n);
        for (let i = 0; i < n; i++) out[i] = b.readFloatLE(i * 4);
        res(out);
      });
    });
  }
}

function install({ app, aiRoot, ffmpeg, LL }) {
  if (!aiRoot || !fs.existsSync(path.join(aiRoot, 'worker', 'server.py'))) return null; // bez MY Premiere MCP přepis není
  let conf = {}; try { conf = JSON.parse(fs.readFileSync(path.join(aiRoot, 'config.json'), 'utf8')); } catch (e) { /* výchozí */ }
  const PORT = (conf.worker && conf.worker.port) || 7881;
  const TOKEN_FILE = path.join(process.env.APPDATA || '', 'MYpremiereMCP', 'token.txt');
  const token = () => { try { return fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch (e) { return ''; } };
  const files = new Map();
  const fileOf = (p) => {
    if (!p) return null;
    if (!files.has(p)) { try { files.set(p, new DFile(p, ffmpeg)); } catch (e) { return null; } }
    return files.get(p);
  };
  // Node http (ne fetch): Worker odmítá požadavky s hlavičkou Origin, kterou by poslal prohlížeč
  const wf = (pathname, body, timeout = 15000) => new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const rq = http.request({ host: '127.0.0.1', port: PORT, path: pathname, method: data ? 'POST' : 'GET', timeout,
      headers: Object.assign({ 'X-PMCP-Token': token() }, data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) }, (r) => {
      let b = ''; r.setEncoding('utf8'); r.on('data', (d) => { b += d; });
      r.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) { /* prázdné */ } if (r.statusCode >= 400) rej(new Error(j.error === 'bad token' ? LL('the transcription Worker rejected the access token – restart PZ AI Cut', 'Worker přepisu odmítl přístupový klíč – restartuj PZ AI Cut') : 'Worker: ' + (j.error || r.statusCode))); else res(j); });
    });
    rq.on('timeout', () => rq.destroy(new Error('Worker timeout')));
    rq.on('error', rej);
    if (data) rq.write(data);
    rq.end();
  });
  let starting = null;
  async function ensureWorker(onProgress) {
    try { await wf('/health', null, 4000); return; } catch (e) { /* spustit */ }
    starting = starting || (async () => {
      const cands = [conf.worker && conf.worker.python, '.venv/Scripts/python.exe', 'tools/python311/python.exe'].filter(Boolean).map((x) => path.resolve(aiRoot, x));
      const py = cands.find((x) => fs.existsSync(x));
      if (!py) throw new Error(LL('MY Premiere MCP is not installed (no Python) – run its installer', 'MY Premiere MCP není nainstalovaný (chybí Python) – spusť jeho instalaci'));
      if (onProgress) onProgress(0, LL('starting the speech model', 'spouštím model řeči'));
      spawn(py, [path.join(aiRoot, 'worker', 'server.py')], { cwd: aiRoot, detached: true, stdio: 'ignore', windowsHide: true }).unref();
      for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 1000)); try { await wf('/health', null, 2000); return; } catch (e) { /* startuje */ } }
      throw new Error(LL('the transcription Worker did not start in 90 s (see cache/worker.log)', 'Worker přepisu se nespustil do 90 s (viz cache/worker.log)'));
    })().finally(() => { starting = null; });
    return starting;
  }
  const running = new Map(); // cesta -> id úlohy
  async function backend(file, opts, onProgress, isStopped) {
    await ensureWorker(onProgress);
    let job = await wf('/jobs', { type: 'transcribe', params: { path: file.path, force: !!opts.force } });
    running.set(file.path, job.id);
    try {
      for (;;) {
        if (job.status === 'done') break;
        if (job.status === 'error') throw new Error(job.error || 'transcription failed');
        if (job.status === 'cancelled' || isStopped()) { const e = new Error('Transcription stopped'); e.name = 'AbortError'; throw e; }
        if (onProgress) onProgress(Math.max(0.001, Math.min(0.99, job.progress || 0)), job.status === 'queued' ? LL('waiting for the Worker', 'čeká na Worker') : `${Math.round((job.progress || 0) * 100)} %`);
        await new Promise((r) => setTimeout(r, 1000));
        job = await wf('/jobs/' + job.id, null, 60000);
      }
    } finally { running.delete(file.path); }
    const d = JSON.parse(fs.readFileSync(job.result.file, 'utf8'));
    const words = [];
    for (const sg of d.segments || []) for (const w of sg.words || []) words.push(Object.assign({ w: w.w, s: w.s, e: Math.max(w.e, w.s + 0.03) }, w.spk ? { spk: w.spk } : {}));
    return { words, duration: d.duration, model: d.model || 'large-v3', language: d.language || 'cs', device: d.device, speakers: d.speakers, exact: true };
  }
  backend.stop = (file) => { const id = running.get(file.path); if (id) wf('/jobs/' + id + '/cancel', {}).catch(() => {}); };
  T.setDesktop({ fileOf, backend });

  /* ---- stav po médiích (jako web/ai/bridge.js) ---- */
  const jobs = new Map();
  const L = new Set();
  const transcribed = new Set();
  const checked = new Set(); // média, u kterých už scan zjistil, jestli přepis existuje
  const emitA = (id) => { for (const f of L) { try { f(id); } catch (e) { /* posluchač */ } } };
  const ls = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  let auto = ls('pzAutoAsr2', '1') !== '0';
  function status(m) {
    if (!m) return { state: 'none', p: 0 };
    if (m.hasAudio === false) return { state: 'noaudio', p: 0 };
    const j = jobs.get(m.id);
    if (j) return j;
    if (T.forMedia(m)) return { state: 'done', p: 1 };
    // hned po importu / otevření projektu se hotový přepis teprve načítá (vzhled S2: 3–8 s „ještě není přepsaná“)
    if (!checked.has(m.id) && !m.missing) return { state: 'queued', p: 0, eta: null, msg: LL('loading the transcript…', 'načítám přepis…') };
    return { state: 'none', p: 0 };
  }
  function start(m, opts = {}) {
    const f = m && !m.missing && fileOf(m.path);
    if (!f) return Promise.reject(new Error(LL('The media file is not available.', 'Soubor média není dostupný.')));
    const est = asr.accEstimate(m) || 0, t0 = Date.now();
    const j = { state: 'queued', p: 0, eta: est || null, msg: LL('loading the transcript…', 'načítám přepis…'), p0: null, tp0: t0, accurate: true };
    jobs.set(m.id, j); emitA(m.id);
    const job = T.transcribe(f, { language: 'cs', quality: 'accurate', force: !!opts.force }, (p, msg) => {
      if (j.state === 'stopped') return;
      j.state = 'running'; if (p > 0 || !j.p) j.p = p; j.msg = msg;
      // odhad: změřená rychlost tohoto počítače, zpřesněný podle průběhu (Worker hlásí průběh po větších kusech)
      if (est) j.eta = Math.max(5, est - (Date.now() - t0) / 1000);
      if (p > 0.02 && j.p0 === null) { j.p0 = p; j.tp1 = Date.now(); } else if (j.p0 !== null && p > j.p0 + 0.05 && p < 1) { j.eta = (1 - p) / ((p - j.p0) / ((Date.now() - j.tp1) / 1000)); }
      if (p >= 1 && j.p0 !== null && m.duration >= 60) { const sp = m.duration * (1 - j.p0) / Math.max(1, (Date.now() - j.tp1) / 1000); if (sp >= 1 && sp < 500) { try { localStorage.setItem('pzAsrSpeedDesk', sp.toFixed(2)); } catch (e) { /* bez úložiště */ } } }
      app.status(p >= 1 ? '' : LL(`Transcribing ${m.name} – ${msg}`, `Přepis ${m.name} – ${msg}`));
      if (opts.onProgress) { try { opts.onProgress(p, msg); } catch (e) { /* volající */ } }
      emitA(m.id);
    });
    job.then(() => { if (jobs.get(m.id) === j) jobs.delete(m.id); transcribed.add(m.id); app.status(LL('Transcript ready: ', 'Přepis hotový: ') + m.name); },
      (e) => { if (e && e.name === 'AbortError') j.state = 'stopped'; else { j.state = 'error'; j.msg = e.message; app.status(m.name + ': ' + e.message, true); } })
      .finally(() => emitA(m.id));
    return job;
  }
  function stop(m) {
    const f = m && fileOf(m.path), j = m && jobs.get(m.id);
    if (f) T.stop(f);
    if (j) { j.state = 'stopped'; j.eta = null; }
    app.status('');
    emitA(m && m.id);
  }
  const fixCache = new Map();
  function withFixes(m, t) {
    const fx = app.project.asrFixes && app.project.asrFixes[m.id];
    if (!t || !fx || !fx.length) return t;
    const key = JSON.stringify(fx), c = fixCache.get(m.id);
    if (c && c.key === key && c.base === t) return c.out;
    const out = T.applyFixes(t, fx);
    fixCache.set(m.id, { key, base: t, out });
    return out;
  }
  const PF = { state: 'done', loaded: 0, total: 0, error: null };
  const asr = {
    desktop: true,
    status, start, stop,
    get: (m) => (m && withFixes(m, T.forMedia(m))) || null,
    load: async (m) => (m && withFixes(m, await T.loadForMedia(m))) || null,
    fixSpan(m, s0, e0, oldText) { const t = m && withFixes(m, T.forMedia(m)); return t ? T.matchSpan(t.words, s0, e0, oldText) : null; },
    fixesKey: (m) => { const p = app.project; return m && p.asrFixes && p.asrFixes[m.id] ? JSON.stringify(p.asrFixes[m.id]).length + ':' + p.asrFixes[m.id].length : ''; },
    on(f) { L.add(f); return () => L.delete(f); },
    cutBounds: (m, t, a, b) => T.cutBounds(fileOf(m.path), t, a, b),
    /** Slova sekvence v čase timeline – jen to, co v sestřihu zazní (kraje podle zvuku klipu). pending = média bez přepisu. */
    async seqWords(s) {
      const p = app.project;
      const tr = s.tracks.audio.filter((x) => !x.muted).find((x) => x.clips.length);
      const words = [], pending = [];
      if (!tr) return { words, pending };
      for (const c of tr.clips) {
        if (c.disabled) continue;
        const m = p.mediaById(c.mediaId);
        if (!m) continue;
        const t = withFixes(m, await T.loadForMedia(m));
        if (!t) { if (!pending.includes(m)) pending.push(m); continue; }
        const cw = await T.clipCaptionWords(fileOf(m.path), t, c);
        for (const w of cw) words.push(Object.assign(w, { w: CLq.czQuotes(w.w) }));
      }
      words.sort((a, b) => a.s - b.s);
      return { words, pending };
    },
    async captionPlan() { return { precise: false, seconds: 0, clips: 0, estimate: 0, stored: true, prefetch: PF, dlLeft: 0 }; },
    get prefetch() { return PF; },
    retryPrefetch() {},
    async ensureAccurate() { return true; },
    onPrefetch: () => () => {},
    modelStored: async () => true,
    get preciseCaptions() { return false; },
    get auto() { return auto; },
    get quality() { return 'accurate'; },
    get weak() { return false; },
    setQuality() {},
    isAccurate: (t) => !!(t && /large/.test(t.model || '')),
    /** Odhad přepisu na grafice: změřená rychlost, jinak ~15× rychleji než záznam + start modelu. */
    accEstimate(m) { if (!m || !m.duration) return null; const sp = Number(ls('pzAsrSpeedDesk', 0)) || 15; return m.duration / sp + 15; },
    offerAccurate: () => false,
    hideOffer() {},
    setAuto(v) { auto = !!v; try { localStorage.setItem('pzAutoAsr2', auto ? '1' : '0'); } catch (e) { /* bez úložiště */ } emitA(null); if (auto) scan(); },
  };
  // nově importovaná videa: hotový přepis (i z MCP mezipaměti) se jen načte, jinak se přepíše na pozadí (jedno po druhém)
  async function scan() {
    for (const m of app.project.media) {
      if (m.missing || jobs.has(m.id) || transcribed.has(m.id) || !fileOf(m.path)) { checked.add(m.id); continue; }
      if (await T.loadForMedia(m)) { transcribed.add(m.id); checked.add(m.id); emitA(m.id); continue; }
      if (auto && m.hasAudio !== false) start(m).catch(() => {});
      checked.add(m.id); emitA(m.id);
    }
  }
  let st = null;
  app.project.on((what) => { if (what === 'media') { clearTimeout(st); st = setTimeout(scan, 300); } });
  setTimeout(scan, 600);
  window.__pzASR = asr;
  return asr;
}

module.exports = { install, DFile };
