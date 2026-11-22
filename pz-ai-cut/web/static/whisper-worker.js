// Přepis řeči v prohlížeči (Whisper, transformers.js). Běží ve vlastním vlákně, nic se neodesílá –
// z internetu se stáhne jen model (jednou, pak je v mezipaměti prohlížeče).
// Dostává hotové ≤30s kousky zvuku (rozdělené v tichých místech) a zpracuje je po dávkách.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;
/* Mezipaměť modelu v úložišti prohlížeče (OPFS, složka pz-models): Cache API soubory velkého modelu (615 a 420 MB)
 * neuložilo – změřeno 2026-11-22, uložily se jen soubory do ~230 MB – a model by se stahoval při každém otevření.
 * OPFS zapisuje proudově a čte jako File (bez načtení celého souboru do paměti). Starší záznamy v Cache API se čtou dál. */
const cachedFiles = new Set(); // soubory čtené z mezipaměti (průběh „stahování“ je pak jen načítání z disku)
const keyOf = (req) => String(req && req.url ? req.url : req).replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-200);
async function modelDir() { const root = await navigator.storage.getDirectory(); return root.getDirectoryHandle('pz-models', { create: true }); }
const opfsCache = {
  async match(req) {
    try {
      const dir = await modelDir();
      const fh = await dir.getFileHandle(keyOf(req));
      const f = await fh.getFile();
      if (f.size > 0) { cachedFiles.add(String(req.url || req).split('/').pop()); return new Response(f, { headers: { 'content-length': String(f.size) } }); }
    } catch (e) { /* není v OPFS */ }
    try {
      const c = await caches.open('transformers-cache');
      const r = await c.match(req);
      if (r) { cachedFiles.add(String(req.url || req).split('/').pop()); return r; }
    } catch (e) { /* bez Cache API */ }
    return undefined;
  },
  async put(req, res) {
    try {
      const dir = await modelDir();
      const name = keyOf(req);
      const tmp = await dir.getFileHandle(name + '.part', { create: true });
      const w = await tmp.createWritable();
      if (res.body) await res.body.pipeTo(w); else { await w.write(await res.arrayBuffer()); await w.close(); }
      try { await tmp.move(name); } catch (e) {
        // starší prohlížeč bez move(): zkopírovat
        const f = await tmp.getFile(); const fh = await dir.getFileHandle(name, { create: true }); const w2 = await fh.createWritable(); await w2.write(f); await w2.close(); await dir.removeEntry(name + '.part');
      }
    } catch (e) { /* plné úložiště – příště se stáhne znovu */ }
  },
};
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = opfsCache;
// víc vláken procesoru (výchozí jsou jen 4); funguje jen na stránce s izolací COOP/COEP (viz _headers)
try { env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(16, (self.navigator.hardwareConcurrency || 4) - 1)); } catch (e) { /* starší verze */ }
let asr = null;
let loadedKey = '';

async function load(model, device, dtypeOverride, threads) {
  // počet vláken lze nastavit jen před vytvořením modelu (víc souběžných přepisů = každý méně vláken)
  if (threads && !asr) { try { env.backends.onnx.wasm.numThreads = threads; } catch (e) { /* starší verze */ } }
  const key = model + '|' + device + '|' + JSON.stringify(dtypeOverride || '');
  if (asr && loadedKey === key) return;
  // jiný model (standardní ↔ přesný pro titulky): uvolnit paměť předchozího, na notebooku by se nevešly oba
  if (asr) { try { await asr.dispose(); } catch (e) { /* starší verze */ } asr = null; loadedKey = ''; }
  // grafika: fp32 kodér + q4 dekodér (fp16/q4f16 dával na části grafik nesmysl); procesor: q8
  const dtype = dtypeOverride || (device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8');
  asr = await pipeline('automatic-speech-recognition', model, {
    device,
    dtype,
    progress_callback: (p) => { if (p.status === 'progress') postMessage({ type: 'download', file: p.file, loaded: p.loaded, total: p.total, cached: cachedFiles.has(String(p.file || '').split('/').pop()) }); },
  });
  loadedKey = key;
}

/* Stažení modelu na pozadí (kolo 5, notebook): jen soubory do OPFS, nic se nenačítá do paměti ani nepočítá.
 * Stejné adresy (klíče mezipaměti) jako při načtení modelu v pipeline(). Průběh = součet MB všech souborů. */
const PREFETCH_FILES = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'];
async function prefetch(model, id) {
  const urls = PREFETCH_FILES.map((f) => `${env.remoteHost}${env.remotePathTemplate.replaceAll('{model}', model).replaceAll('{revision}', 'main')}${f}`);
  const sizes = new Map(), done = new Map();
  const report = () => { let L = 0, A = 0; for (const u of urls) { L += done.get(u) || 0; A += sizes.get(u) || 0; } postMessage({ type: 'prefetch', id, loaded: L, total: A }); };
  // velikosti předem (HEAD), ať je celkový počet MB známý od začátku
  await Promise.all(urls.map(async (u) => {
    const hit = await opfsCache.match(u);
    if (hit) { const n = Number(hit.headers.get('content-length')) || 0; sizes.set(u, n); done.set(u, n); return; }
    try { const r = await fetch(u, { method: 'HEAD' }); sizes.set(u, Number(r.headers.get('content-length')) || 0); } catch (e) { sizes.set(u, 0); }
  }));
  report();
  for (const u of urls) {
    if ((done.get(u) || 0) > 0 && done.get(u) === sizes.get(u)) continue;
    const r = await fetch(u);
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u.split('/').pop());
    if (!sizes.get(u)) sizes.set(u, Number(r.headers.get('content-length')) || 0);
    const dir = await modelDir();
    const name = keyOf(u);
    const tmp = await dir.getFileHandle(name + '.part', { create: true });
    const w = await tmp.createWritable();
    const rd = r.body.getReader();
    let n = 0, last = 0;
    for (;;) {
      const { done: end, value } = await rd.read();
      if (end) break;
      await w.write(value);
      n += value.length; done.set(u, n);
      if (Date.now() - last > 400) { last = Date.now(); report(); }
    }
    await w.close();
    try { await tmp.move(name); } catch (e) { const f = await tmp.getFile(); const fh = await dir.getFileHandle(name, { create: true }); const w2 = await fh.createWritable(); await w2.write(f); await w2.close(); await dir.removeEntry(name + '.part'); }
    report();
  }
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'prefetch') { await prefetch(m.model, m.id); postMessage({ type: 'ready', id: m.id }); return; }
    if (m.type === 'load') {
      await load(m.model, m.device, m.dtype, m.threads);
      postMessage({ type: 'ready', id: m.id });
      return;
    }
    if (m.type === 'align') {
      // krátký úsek kolem střihu s časy jednotlivých slov (přesná hranice slova)
      await load(m.model, m.device, m.dtype, m.threads);
      const o = await asr(m.audio, m.language ? { task: 'transcribe', language: m.language, return_timestamps: 'word' } : { task: 'transcribe', return_timestamps: 'word' });
      postMessage({ type: 'result', id: m.id, chunks: (o.chunks || []).map((c) => ({ text: c.text, ts: c.timestamp })) });
      return;
    }
    if (m.type === 'run') {
      await load(m.model, m.device, m.dtype, m.threads);
      const opts = { task: 'transcribe', return_timestamps: true };
      if (m.language) opts.language = m.language;
      const outs = [];
      const batch = m.device === 'webgpu' ? 4 : 1;
      for (let i = 0; i < m.audios.length; i += batch) {
        const part = m.audios.slice(i, i + batch);
        let r = await asr(part.length === 1 ? part[0] : part, opts);
        if (!Array.isArray(r)) r = [r];
        for (const o of r) outs.push({ text: o.text, chunks: (o.chunks || []).map((c) => ({ text: c.text, ts: c.timestamp })) });
        postMessage({ type: 'step', id: m.id, done: Math.min(m.audios.length, i + batch), total: m.audios.length });
      }
      postMessage({ type: 'result', id: m.id, outs });
    }
  } catch (err) {
    postMessage({ type: 'error', id: m.id, error: String(err && err.message || err) });
  }
};
