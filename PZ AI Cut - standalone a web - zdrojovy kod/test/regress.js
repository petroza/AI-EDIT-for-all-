'use strict';
/* Regresní průchod (developer-rules 4): samostatný headless Chrome s ČISTÝM profilem (první stažení modelu) a afinitou na N CPU
 * (simulace notebooku), 5min výřez, výchozí kvalita podle počítače. Projde celou cestu redaktora a v každém stavu uloží snímky
 * při 1366×768 a 1040×1100 + počet celých viditelných řádků seznamu (Přepis / Titulky). Pod 8 řádků = ✘.
 *   node test/regress.js <složka snímků> [--cpu 8] [--slow] [--video cesta] [--port 9350]
 * Výstup: <složka>/rr-<krok>-<stav>-<šířka>x<výška>.png, <složka>/regress.json; přepis výřezu → web/test-out/<video>-<model>.json */
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(argv[0] || 'team/reports/shots-dev-4');
const CPU = Number(opt('--cpu', 8));
const SLOW = argv.includes('--slow');
const VIDEO = opt('--video', 'O:/TN_strihatko/test/media/vyrez-5min.mp4');
const PORT = Number(opt('--port', 9350));
// --profile <složka> = opakované ladění rozvržení: profil zůstane (model i přepis v mezipaměti, stavy 01–03 se přeskočí)
const KEEP = opt('--profile');
const PROF = KEEP ? path.resolve(KEEP) : path.join(os.tmpdir(), 'pz-regress-' + Date.now());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SIZES = [[1366, 768], [1040, 1100]];
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));

(async () => {
  const mask = ((2 ** CPU) - 1).toString(16).toUpperCase();
  spawn('cmd', ['/c', 'start', '""', '/affinity', mask, CHROME, '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROF}`, '--window-size=1366,768', '--no-first-run', 'http://127.0.0.1:8791/'], { detached: true, stdio: 'ignore' }).unref();
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { await sleep(500); try { page = (await getJson('/json')).find((t) => t.type === 'page' && /8791/.test(t.url)); } catch (e) { /* ještě neběží */ } }
  if (!page) throw new Error('Chrome se nespustil');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const m = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, timeout: 900000 });
    if (m.result && m.result.exceptionDetails) throw new Error('JS: ' + JSON.stringify(m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description).slice(0, 400));
    return m.result && m.result.result && m.result.result.value;
  };
  const size = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await size(1366, 768);
  await sleep(4000);
  const report = { cpu: CPU, slow: SLOW, video: VIDEO, profile: PROF, steps: [] };
  // celé viditelné řádky seznamu v aktivní záložce + co je vidět kolem
  const MEASURE = `const vis = (el) => el && el.offsetParent !== null && el.getBoundingClientRect().height > 0;
    const L = [document.getElementById('trList'), document.getElementById('capList')].find(vis);
    let rows = null, listH = null;
    if (L) { const r = L.getBoundingClientRect(); listH = Math.round(r.height); rows = [...L.querySelectorAll('.tr-row,.cap-row')].filter((x) => { const q = x.getBoundingClientRect(); return q.top >= r.top - 1 && q.bottom <= r.bottom + 1; }).length; }
    const txt = (id) => { const e = document.getElementById(id); return vis(e) ? e.innerText.replace(/\\s+/g, ' ').trim().slice(0, 160) : null; };
    return { rows, listH, list: L ? L.id : null, status: txt('trStatus'), foot: txt('trFoot') || txt('capFoot'), modal: (document.querySelector('.modal') && vis(document.querySelector('.modal'))) ? document.querySelector('.modal').innerText.replace(/\\s+/g, ' ').slice(0, 160) : null };`;
  async function shot(step, state, need8 = true) {
    const rec = { step, state, sizes: {} };
    for (const [w, h] of SIZES) {
      await size(w, h); await sleep(500);
      const m = await ev(MEASURE);
      const img = await send('Page.captureScreenshot', { format: 'png' });
      const f = path.join(OUT, `rr-${step}-${state}-${w}x${h}.png`);
      fs.writeFileSync(f, Buffer.from(img.result.data, 'base64'));
      rec.sizes[`${w}x${h}`] = Object.assign(m || {}, { ok8: !need8 || (m && m.rows != null && m.rows >= 8) });
    }
    await size(1366, 768); await sleep(200);
    report.steps.push(rec);
    const a = rec.sizes['1366x768'], b = rec.sizes['1040x1100'];
    console.log(`${step}-${state}: řádky ${a.rows}/${b.rows}${need8 && (!a.ok8 || !b.ok8) ? ' ✘ pod 8' : ''}${a.status ? ' | ' + a.status.slice(0, 90) : ''}${a.foot ? ' | ' + a.foot.slice(0, 90) : ''}`);
    fs.writeFileSync(path.join(OUT, 'regress.json'), JSON.stringify(report, null, 1));
    return rec;
  }
  const waitFor = async (expr, ms = 600000, step = 300) => { const t0 = Date.now(); for (;;) { const v = await ev(expr); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + expr.slice(0, 80)); await sleep(step); } };

  // 1) import → stahování → příprava → přepis
  await ev(`window.__pzAsrWorkers = 1; window.__pzAsrThreads = ${CPU}; ${SLOW ? 'window.__pzAsrSlow = true;' : ''}
    TN.app.project.dirty = false; TN.app.cmd('newProject'); await new Promise((r) => setTimeout(r, 500));
    await __pzDevImport('/devfile?p=' + encodeURIComponent('${VIDEO}'), '${path.basename(VIDEO)}'); return 1;`);
  const st = `const m = TN.app.project.media[0]; const s = m && __pzASR.status(m); return s ? JSON.stringify({ state: s.state, p: s.p || 0, msg: s.msg || '' }) : null;`;
  const seen = {};
  const t0 = Date.now();
  for (;;) {
    const s = JSON.parse(await ev(st) || '{}');
    if (!seen.dl && /download/.test(s.msg) && /(\d+) \/ (\d+) MB/.test(s.msg)) { seen.dl = 1; await shot('01', 'stahovani', false); }
    else if (!seen.prep && s.state === 'running' && !(s.p > 0.0005) && /loading/.test(s.msg)) { seen.prep = 1; await shot('02', 'pripravuji', false); }
    else if (!seen.run && s.state === 'running' && s.p > 0.2) { seen.run = 1; await shot('03', 'prepis', false); }
    // notebook (kolo 5): přesný model se stahuje na pozadí – řádek „Připravuji přesné titulky: stahuji …“
    if (!seen.pf && await ev(`const e = document.getElementById('trPf'); return !!(e && !e.hidden && /stahuji|downloading/.test(e.textContent));`)) { seen.pf = 1; await shot('03b', 'stahuji-presne', false); }
    if (s.state === 'done') break;
    if (s.state === 'error') throw new Error('přepis selhal: ' + s.msg);
    if (Date.now() - t0 > 1200000) throw new Error('přepis trvá přes 20 min');
    await sleep(400);
  }
  report.transcribeS = Math.round((Date.now() - t0) / 1000);
  const meta = await ev(`const m = TN.app.project.media[0]; const t = __pzASR.get(m); TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 300));
    const body = JSON.stringify({ model: t.model, words: t.words, removed: t.removed || [] });
    const name = '${path.basename(VIDEO, path.extname(VIDEO))}-' + (/large/.test(t.model) ? 'accurate' : 'standard') + '.json';
    await fetch('/devsave?name=' + name, { method: 'POST', body });
    return { model: t.model, sentences: t.sentences.length, words: t.words.length, removed: t.removed || [], first: t.sentences.slice(0, 3).map((s) => t.words.slice(s.w0, s.w1 + 1).map((w) => w.w).join(' ')), last: t.sentences.slice(-3).map((s) => t.words.slice(s.w0, s.w1 + 1).map((w) => w.w).join(' ')), name };`);
  report.transcript = meta;
  console.log(`přepis ${report.transcribeS} s, ${meta.model}, ${meta.sentences} vět → web/test-out/${meta.name}`);
  await shot('04', 'hotovo');
  // 2) hledání
  const word = await ev(`const t = __pzASR.get(TN.app.project.media[0]); const w = t.words.map((x) => x.w.replace(/[^\\p{L}]/gu, '')).filter((x) => x.length >= 7); return w[Math.floor(w.length / 3)];`);
  await ev(`const q = document.getElementById('trQ'); q.focus(); q.value = ${JSON.stringify(word)}; q.dispatchEvent(new Event('input')); await new Promise((r) => setTimeout(r, 400)); return 1;`);
  await shot('05', 'hledani');
  await ev(`const q = document.getElementById('trQ'); q.value = ''; q.dispatchEvent(new Event('input')); await new Promise((r) => setTimeout(r, 300)); return 1;`);
  // 3) klik + Shift+klik: výběr se varováním (souvislá řeč) – první dvojice vět, kde aplikace varuje
  const pair = await ev(`const m = TN.app.project.media[0], t = __pzASR.get(m), S = t.sentences;
    for (let i = 2; i + 2 < S.length - 2; i++) { const b = await __pzASR.cutBounds(m, t, S[i].w0, S[i + 2].w1); if (!b.inOk || !b.outOk) return [i, i + 2, b.inOk, b.outOk]; }
    return [2, 4, true, true];`);
  report.selection = pair;
  const click = (i, shift) => ev(`const r = document.querySelector('#trList .tr-row[data-i="${i}"]'); r.scrollIntoView({ block: 'center' }); r.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: ${shift} })); await new Promise((x) => setTimeout(x, 900)); return 1;`);
  await click(pair[0], false); await click(pair[1], true);
  await shot('06', 'vyber-varovani');
  // 4) vložit do nové sekvence
  await ev(`document.getElementById('trIns').click(); await new Promise((r) => setTimeout(r, 600)); const ok = document.getElementById('sqOk'); if (ok) ok.click(); await new Promise((r) => setTimeout(r, 1200)); return 1;`);
  await shot('07', 'sekvence');
  // 5) titulky z přepisu
  await ev(`TN.app.cmd('captionsFromTranscript'); for (let i = 0; i < 100; i++) { const b = document.getElementById('cfOk'); if (b && !b.disabled && /Vytvořit titulky|Create captions/.test(b.textContent)) break; await new Promise((r) => setTimeout(r, 200)); } return 1;`);
  await shot('08', 'dialog-titulky', false);
  // titulky: na notebooku se přepíšou přesně úseky (desítky sekund) – čekat, až vzniknou
  report.captionWords = await ev(`const t0 = Date.now(); document.getElementById('cfOk').click(); for (let i = 0; i < 600; i++) { const s = TN.app.seq(); if ((s.captions || []).length) break; await new Promise((r) => setTimeout(r, 500)); }
    window.__capSec = (Date.now() - t0) / 1000; await new Promise((r) => setTimeout(r, 800)); const s = TN.app.seq(); return (s.captions || []).map((c) => c.text);`);
  report.captionSec = await ev(`return window.__capSec;`);
  await shot('09', 'titulky');
  // 6) oprava prvního titulku (klik do textu, úprava, Enter)
  await ev(`const r = document.querySelector('#capList .cap-row[data-i="0"] .tx'); r.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise((x) => setTimeout(x, 400));
    const ta = document.querySelector('#capList textarea'); if (!ta) return 0; ta.value = ta.value.replace(/^./, (c) => c.toUpperCase()) + ''; ta.dispatchEvent(new Event('input'));
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise((x) => setTimeout(x, 500)); return 1;`);
  await shot('10', 'oprava');
  // 7) smazání titulku klávesou Delete
  await ev(`const L = document.getElementById('capList'); L.focus(); const r = L.querySelector('.cap-row[data-i="1"]'); if (r) r.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 1, clientY: 1 }));
    await new Promise((x) => setTimeout(x, 300)); const ta = document.querySelector('#capList textarea'); if (ta) ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((x) => setTimeout(x, 200)); L.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); await new Promise((x) => setTimeout(x, 500)); return (TN.app.seq().captions || []).length;`);
  await shot('11', 'smazani');
  // 8) export (s titulky v obraze)
  report.export = await ev(`return await __pzDevExport({ name: 'regress-4-${CPU}cpu.mp4', burn: true });`);
  console.log('export', JSON.stringify(report.export).slice(0, 200));
  await ev(`TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 300)); return 1;`);
  await shot('12', 'po-exportu');
  // 8b) druhý výrok po titulcích (kolo 5, B1): Přidat na konec sekvence → Doplnit titulky
  const p2 = [Math.min(pair[1] + 6, 60), Math.min(pair[1] + 7, 61)];
  await ev(`TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 400)); return 1;`);
  await click(p2[0], false); await click(p2[1], true);
  report.insLabel2 = await ev(`return (document.getElementById('trIns') || {}).textContent || null;`);
  await ev(`document.getElementById('trIns').click(); await new Promise((r) => setTimeout(r, 1200)); return 1;`);
  await shot('12b', 'druhy-vyrok');
  report.second = await ev(`TN.app.cmd('captionsFromTranscript'); for (let i = 0; i < 100; i++) { const b = document.getElementById('cfOk'); if (b && !b.disabled && /Doplnit|Add/.test(b.textContent)) break; await new Promise((r) => setTimeout(r, 200)); }
    const n0 = TN.app.seq().captions.length; document.getElementById('cfOk').click(); for (let i = 0; i < 600; i++) { if (TN.app.seq().captions.length > n0) break; await new Promise((r) => setTimeout(r, 500)); }
    await new Promise((r) => setTimeout(r, 800)); const s = TN.app.seq(); const tr = s.tracks.audio.find((x) => x.clips.length);
    return { clips: tr.clips.map((c) => [+c.start.toFixed(2), +(c.out - c.in).toFixed(2)]), caps: s.captions.length, before: n0 };`);
  await ev(`TN.app.transcript.show('cap'); await new Promise((r) => setTimeout(r, 400)); return 1;`);
  await shot('12c', 'dva-vyroky-titulky');
  // 9) slabý počítač
  await ev(`window.__pzAsrWeak = true; TN.app.transcript.show('cap'); await new Promise((r) => setTimeout(r, 200)); TN.app.transcript.show('tr'); await new Promise((r) => setTimeout(r, 400)); return 1;`);
  await shot('13', 'slaby-pc');
  fs.writeFileSync(path.join(OUT, 'regress.json'), JSON.stringify(report, null, 1));
  ws.close();
  try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*remote-debugging-port=${PORT}*' } | % { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"`); } catch (e) { /* už neběží */ }
  if (!KEEP) { try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) { /* zamčené soubory */ } }
  console.log('hotovo →', OUT);
  process.exit(0);
})().catch((e) => { console.error(e); try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*remote-debugging-port=${PORT}*' } | % { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"`); } catch (x) { /* */ } process.exit(1); });
