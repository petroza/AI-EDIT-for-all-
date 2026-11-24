'use strict';
/* Napojení webové verze na okno aplikace: varování při zavření s neuloženými změnami, obnovení médií,
 * hlášky ze zápisu na disk, vývojářský import pro testy (jen na localhost). */
const vfs = require('./shims/vfs');
const { tr } = require('../src/core/lang');

const app = window.TN && window.TN.app;
const t = (s) => (window.TN && window.TN.lang === 'cs' ? tr(s) : s);

window.addEventListener('beforeunload', (e) => {
  if (window.__pzForceClose) return;
  if (app && app.project && app.project.dirty) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('pz-media-restored', () => {
  if (!app) return;
  for (const m of app.project.media) if (!m.missing) { try { app.loadWave(m.id); } catch (e) { /* bez zvuku */ } }
  app.projectPanel.render(); app.timeline.render(); app.program.refresh && app.program.refresh();
  app.toast(t('Media files are available again.'));
});
window.addEventListener('pz-reveal', () => app && app.toast(t('The file is in the folder you chose when saving.')));
// převod MXF v prohlížeči (engine/mxf.js) – průběh ve stavovém řádku
window.addEventListener('pz-mxf-progress', (e) => {
  if (!app) return;
  const d = e.detail || {}, cs = window.TN && window.TN.lang === 'cs', pc = Math.round((d.p || 0) * 100);
  const msg = {
    download: cs ? `MXF: stahuji převodník (jednou, ~32 MB)… ${d.mb || 0} MB` : `MXF: downloading the converter (once, ~32 MB)… ${d.mb || 0} MB`,
    probe: cs ? `MXF: čtu ${d.name}…` : `MXF: reading ${d.name}…`,
    convert: cs ? `MXF: převádím ${d.name} na MP4… ${pc} %` : `MXF: converting ${d.name} to MP4… ${pc} %`,
    save: cs ? `MXF: ukládám převod ${d.name}…` : `MXF: saving the conversion of ${d.name}…`,
    done: cs ? `MXF převeden: ${d.name}` : `MXF converted: ${d.name}`,
  }[d.stage];
  if (msg) app.status(msg);
});
window.addEventListener('pz-write-error', (e) => app && app.toast(t('Cannot write the file: ') + e.detail, true));

// jen pro vývoj na localhost: import souboru z místního testovacího serveru (web/serve.js)
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.__pzDevImport = async (url, name) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob();
    const file = new File([blob], name || decodeURIComponent(url.split('/').pop().split('?')[0]), { type: blob.type || 'video/mp4', lastModified: 1 });
    const p = vfs.registerFile(file);
    await app.importPaths([p]);
    return p;
  };
}

// jen pro vývoj na localhost: export do soukromého úložiště prohlížeče (bez dialogu) a odeslání na místní
// testovací server, aby šel výsledek ověřit přes ffprobe
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.__pzDevExport = async (opts = {}) => {
    const exporter = require('./export-web');
    const root = await navigator.storage.getDirectory();
    const name = /.mp4$/i.test(opts.name || '') ? opts.name : (opts.name || 'pz-test') + '.mp4'; // vždy s příponou (report-3)
    const h = await root.getFileHandle(name, { create: true });
    const out = vfs.registerSaveHandle(h, name);
    const t0 = performance.now();
    const r = await exporter.exportSequence(app.project, app.seq(), { output: out, range: opts.range || 'all', burnCaptions: !!opts.burn, loudness: opts.loudness || 'off', signal: {}, onProgress: opts.onProgress });
    const secs = (performance.now() - t0) / 1000;
    const file = await h.getFile();
    const up = await fetch('/devsave?name=' + encodeURIComponent(name), { method: 'POST', body: file });
    return { ...r, secs: Math.round(secs * 10) / 10, bytes: file.size, saved: await up.text() };
  };
}

// jen pro vývoj: import z úložiště prohlížeče přes handle (jako z dialogu) a okamžitá automatická záloha
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.__pzDevImportOpfs = async (name) => {
    const root = await navigator.storage.getDirectory();
    const p = await vfs.registerHandle(await root.getFileHandle(name));
    await app.importPaths([p]);
    return p;
  };
  window.__pzDevAutosave = () => {
    require('fs').writeFileSync('/appdata/TN_strihatoko/autosave.tnproj', JSON.stringify(app.project.toJSON()));
    return true;
  };
}

// jen pro vývoj: moduly pro ladění z konzole
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.__pzDev = { T: require('./ai/transcripts'), vfs, media: require('./media-web'), decode: require('./engine/decode'), mp4: require('./engine/mp4'), tools: require('./ai/tools').createTools({ progress: (t, p) => { window.__pzDevProg = t; }, quality: () => 'standard', waitTask: () => Promise.resolve(null), report: () => {} }), CL: require('../src/core/captionlayout'), RF: require('./ai/reframe') };
}

// automatická záloha i při zavření / obnovení stránky (jinak by se ztratila poslední minuta práce)
window.addEventListener('pagehide', () => {
  try { if (app && app.project && app.project.dirty && !window.__pzAutosaveOff) require('fs').writeFileSync('/appdata/TN_strihatoko/autosave.tnproj', JSON.stringify(app.project.toJSON())); } catch (e) { /* plné úložiště */ }
});

/* Auto Reframe ve webové verzi (Sekvence → Auto Reframe sekvence): NOVÁ sekvence v cílovém formátu, obraz posunutý
 * na obličej / mluvčího (web/ai/reframe.js – MediaPipe v prohlížeči), titulky přeskládané na novou šířku. */
window.__pzReframeHere = (s, only) => {
  app.edit('Set to Fill', () => { for (const tr of s.tracks.video) for (const c of tr.clips) { if (only && !only.has(c.id)) continue; c.fit = 'cover'; c.scale = 1; c.posX = 0; c.posY = 0; } });
  return require('./ai/reframe').reframeSequence(app, s, (m) => { const f = vfs.getFile(m.path); if (!f) throw new Error(t('The file is not accessible – click "Allow access to media".')); return f; }, (text) => app.status(t(text)), only || null);
};
window.__pzEdgeShots = (s, opts) => require('./ai/reframe').fixEdgeShots(app, s, (m) => { const f = vfs.getFile(m.path); if (!f) throw new Error('not accessible'); return f; }, () => {}, opts || {});
window.__pzReframe = (src, num, den, W, H) => require('./ai/reframe').reframeCopy(app, src, num, den, W, H, (m) => {
  const f = vfs.getFile(m.path);
  if (!f) throw new Error(`The file ${m.name} is not accessible – click "Allow access to media".`);
  return f;
}, (text) => app.status(t(text)));

/* Víc otevřených karet se střižnou: všechny by si ukládaly automatickou zálohu do stejného místa a navzájem si přepisovaly
 * práci. Ukládá jen jedna karta; nově otevřená se zeptá, jestli už nějaká běží, a když ano, neukládá a nabídne
 * „Pracovat tady“ – tím si práci převezme (stará karta uloží poslední stav a přestane ukládat, nová se načte znovu). */
(function tabGuard() {
  if (!('BroadcastChannel' in window)) return;
  const ID = Math.random().toString(36).slice(2);
  const bc = new BroadcastChannel('pz-ai-cut-tabs');
  let owner = true;
  const AUTOSAVE = '/appdata/TN_strihatoko/autosave.tnproj';
  function flush() { try { if (app && app.project && app.project.dirty) require('fs').writeFileSync(AUTOSAVE, JSON.stringify(app.project.toJSON())); } catch (e) { /* plné úložiště */ } }
  function bar(show) {
    let el = document.getElementById('tabBar');
    if (!show) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div');
    el.id = 'tabBar';
    el.className = 'relink-bar tab-bar';
    const msg = document.createElement('span');
    msg.textContent = t('PZ AI Cut is open in another tab. Changes made here are not saved – work in one tab.');
    const b = document.createElement('button');
    b.className = 'primary';
    b.textContent = t('Work here');
    b.onclick = () => {
      b.disabled = true;
      bc.postMessage({ type: 'takeover', id: ID });
      // starší karta uloží poslední stav a odpoví; pak se tahle načte znovu s aktuální prací
      const go = () => { try { sessionStorage.setItem('pzTakeover', '1'); } catch (e) { /* bez úložiště */ } window.__pzForceClose = true; location.reload(); };
      const tm = setTimeout(go, 1200);
      bc.addEventListener('message', (e) => { if (e.data && e.data.type === 'released') { clearTimeout(tm); setTimeout(go, 150); } });
    };
    el.appendChild(msg); el.appendChild(b);
    document.body.appendChild(el);
  }
  function setOwner(v) { owner = v; window.__pzAutosaveOff = !v; bar(!v); }
  bc.onmessage = (e) => {
    const m = e.data || {};
    if (m.id === ID) return;
    if (m.type === 'hello' && owner) bc.postMessage({ type: 'here', id: ID });
    if (m.type === 'here' && !m.takeover) setOwner(false);
    if (m.type === 'takeover') { if (owner) flush(); setOwner(false); bc.postMessage({ type: 'released', id: ID }); }
  };
  let took = false;
  try { took = sessionStorage.getItem('pzTakeover') === '1'; sessionStorage.removeItem('pzTakeover'); } catch (e) { /* bez úložiště */ }
  if (took) bc.postMessage({ type: 'takeover', id: ID }); else bc.postMessage({ type: 'hello', id: ID });
})();

/* Přesné snímky v monitoru v úsecích, kde Chrome přehrávač ukazuje zastaralý obraz (web/ai/stillframes.js). */
if (app && app.program && app.program.player) require('./ai/stillframes').install(app.program.player, app, (m) => vfs.getFile(m.path));

/* Export více souborů najednou (Soubor → Exportovat verze pro sítě): jedna složka, soubory podle názvů sekvencí. */
window.__pzPickExportDir = async () => {
  if (!window.showDirectoryPicker) throw new Error('This browser cannot save files – use Google Chrome.');
  let dir;
  try { dir = await window.showDirectoryPicker({ id: 'pz-export', mode: 'readwrite' }); } catch (e) { if (e && e.name === 'AbortError') return null; throw e; }
  return async (name) => vfs.registerSaveHandle(await dir.getFileHandle(name, { create: true }), name);
};
