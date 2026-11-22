'use strict';
/* Simulace redakčního notebooku (kolo 3, úkol 1): samostatný Chrome s vlastním profilem a afinitou na N logických CPU,
 * přepis 5min výřezu zvoleným modelem; měří stažení, přípravu, přepis, odhad aplikace, CPU % a RAM prohlížeče.
 *   node test/notebook.js <cpu 4|8> <accurate|standard> [port]
 * Profil: %TEMP%\pz-notebook-<cpu> (první běh = první stažení modelu). Vypíše JSON s výsledky. */
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');
const cpu = Number(process.argv[2] || 4), quality = process.argv[3] || 'accurate', port = Number(process.argv[4] || 9340 + cpu);
const prof = path.join(os.tmpdir(), 'pz-notebook-' + cpu);
const mask = ((1 << cpu) - 1).toString(16).toUpperCase();
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const VIDEO = 'O:/TN_strihatko/test/media/vyrez-5min.mp4';

const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** CPU % (z celého počítače, přepočteno na povolená jádra) a RAM všech procesů Chrome s tímto profilem za 3 s. */
function sample() {
  const ps = `$f='*pz-notebook-${cpu}*'; function s { Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ? { $_.CommandLine -like $f } | % { Get-Process -Id $_.ProcessId -EA SilentlyContinue } }; $a = s; $c1 = ($a | Measure-Object -Property TotalProcessorTime -Sum).Sum; if (-not $c1) { $c1 = [TimeSpan]0 }; $t1 = (($a | % { $_.TotalProcessorTime.TotalMilliseconds }) | Measure-Object -Sum).Sum; Start-Sleep -Seconds 3; $b = s; $t2 = (($b | % { $_.TotalProcessorTime.TotalMilliseconds }) | Measure-Object -Sum).Sum; $ws = (($b | % { $_.WorkingSet64 }) | Measure-Object -Sum).Sum; $mx = (($b | % { $_.WorkingSet64 }) | Measure-Object -Maximum).Maximum; "$t1;$t2;$ws;$mx"`;
  try {
    const [t1, t2, ws, mx] = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim().split(';').map(Number);
    return { cpu: Math.round((t2 - t1) / 3000 / cpu * 100), ramGB: +(ws / 1073741824).toFixed(1), maxProcGB: +(mx / 1073741824).toFixed(1) };
  } catch (e) { return { err: e.message.slice(0, 80) }; }
}

(async () => {
  // Chrome s afinitou (start /affinity – podřízené procesy ji zdědí)
  spawn('cmd', ['/c', 'start', '""', '/affinity', mask, CHROME, '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1366,768', '--no-first-run', 'http://127.0.0.1:8791/'], { detached: true, stdio: 'ignore' }).unref();
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { await sleep(500); try { page = (await getJson('/json')).find((t) => t.type === 'page' && /8791/.test(t.url)); } catch (e) { /* ještě neběží */ } }
  if (!page) throw new Error('Chrome se nespustil');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const ev = (expr) => new Promise((r) => { const i = ++id; pend.set(i, (m) => r(m.result && m.result.result && m.result.result.value)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true } })); });
  await sleep(4000);
  // přepis výřezu: časy fází a odhad aplikace (status.eta) v průběhu
  await ev(`window.__pzAsrWorkers = 1; window.__pzAsrThreads = ${cpu}; localStorage.setItem('pzAsrQuality2', '${quality}'); __pzASR.setAuto(false);
    TN.app.project.dirty = false; TN.app.cmd('newProject'); await new Promise((r) => setTimeout(r, 500));
    await __pzDevImport('/devfile?p=' + encodeURIComponent('${VIDEO}'), 'vyrez-5min-${cpu}.mp4');
    const m = TN.app.project.media[0]; const R = window.__nb = { t0: performance.now(), dlMB: 0, ev: [], etas: [] };
    __pzASR.start(m, { force: true, quality: '${quality}' }).then((t) => { R.done = (performance.now() - R.t0) / 1000; R.model = t.model; R.words = t.words.length; }).catch((e) => { R.err = e.message; });
    __pzASR.on(() => { const st = __pzASR.status(m); const now = (performance.now() - R.t0) / 1000; const dl = /(\\d+) \\/ (\\d+) MB/.exec(st.msg || '');
      if (dl) { R.dlMB = +dl[2]; R.dlEnd = now; } if (st.p > 0.001 && R.start == null) R.start = now; if (st.eta && st.p > 0.05) R.etas.push([+now.toFixed(1), +st.p.toFixed(3), Math.round(st.eta)]); });
    return 'ok';`);
  const samples = [];
  for (;;) {
    await sleep(8000);
    const r = await ev('return window.__nb');
    if (r && r.start != null && !r.done && samples.length < 6) samples.push(sample());
    if (r && (r.done || r.err)) {
      const transc = r.done - (r.start || 0), prep = (r.start || 0) - (r.dlEnd || 0);
      const etas = r.etas.filter((e, i) => i % Math.max(1, Math.floor(r.etas.length / 6)) === 0).map(([t, p, eta]) => ({ t, p, eta, skutecne: Math.round(r.done - t), chyba: Math.round((eta - (r.done - t)) / Math.max(1, r.done - t) * 100) + ' %' }));
      const cpuAvg = samples.filter((s) => s.cpu != null);
      const OUT = { cpu, quality, model: r.model, err: r.err, stazeniMB: r.dlMB, stazeniS: r.dlEnd ? +r.dlEnd.toFixed(1) : 0, pripravaS: +prep.toFixed(1), prepis5minS: +transc.toFixed(1),
        celkemS: +r.done.toFixed(1), odhad28min: +(transc * 5.6 / 60).toFixed(1) + ' min', odhadNotebook: +(transc * 5.6 * 1.5 / 60).toFixed(1) + ' min (ODHAD ×1,5)',
        cpuProc: cpuAvg.length ? Math.round(cpuAvg.reduce((a, s) => a + s.cpu, 0) / cpuAvg.length) : null, ramGB: cpuAvg.length ? Math.max(...cpuAvg.map((s) => s.ramGB)) : null, maxProcGB: cpuAvg.length ? Math.max(...cpuAvg.map((s) => s.maxProcGB)) : null, etas };
      console.log(JSON.stringify(OUT, null, 1)); require("fs").writeFileSync(require("path").join(__dirname, "..", "web", "test-out", `nb-${cpu}-${quality}.json`), JSON.stringify(OUT, null, 1));
      break;
    }
  }
  ws.close();
  try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*pz-notebook-${cpu}*' } | % { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"`); } catch (e) { /* už neběží */ }
  process.exit(0);
})();
