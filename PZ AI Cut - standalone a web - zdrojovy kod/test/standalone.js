'use strict';
/* Izolovaná instance PZ AI Cut Standalone pro testy (tým v2): vlastní APPDATA/LOCALAPPDATA (nastavení, autosave, cache
 * uživatele zůstanou netknuté), ladicí port, velikost okna (PZ_WINDOW_SIZE v main.js), jazyk.
 *   node test/standalone.js start <port> <složka profilu> [--size 1920x1080] [--lang cs|en] [--ai]
 *   node test/standalone.js stop <port>
 * --ai: zkopíruje %APPDATA%\MYpremiereMCP (token Workeru, root.txt) do profilu – bez toho AI panel hlásí „bad token“.
 * MY Premiere MCP si aplikace najde sama (vedlejší složka v O:\AI STRIH ALL app nebo root.txt).
 * Ovládání pak: CDP_PORT=<port> node test/cdp.js eval "…" | shot soubor.png | key KeyK Ctrl
 * Užitečné v eval: TN.app (project, edit, editCore, openSequence, importPaths([cesta]), cmd(…), seq()),
 * require('<složka>/src/core/exporter').exportSequence(TN.app.project, seq, { output, range:'all', burnCaptions:true,
 *   encoder:'libx264', format:'h264'|'h265'|'prores'|'mxf'…, loudness:'social'|'tv' }), TN.evalScript('PMCP.call("…", "{…}")'). */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const [cmd, portS, profS] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const port = Number(portS);
const ELECTRON = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');

if (cmd === 'stop') {
  try {
    execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='electron.exe'\\" | ? { $_.CommandLine -like '*remote-debugging-port=${port}*' } | % { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }"`);
  } catch (e) { /* neběží */ }
  console.log('stopped ' + port);
  process.exit(0);
}
if (cmd !== 'start' || !port || !profS) { console.log('použití: node test/standalone.js start <port> <profil> [--size WxH] [--lang cs|en] [--ai] | stop <port>'); process.exit(2); }

const prof = path.resolve(profS);
const appdata = path.join(prof, 'appdata'), local = path.join(prof, 'local');
fs.mkdirSync(path.join(appdata, 'TN_strihatoko'), { recursive: true });
fs.mkdirSync(local, { recursive: true });
const setF = path.join(appdata, 'TN_strihatoko', 'settings.json');
let set = {}; try { set = JSON.parse(fs.readFileSync(setF, 'utf8')); } catch (e) { /* nový profil */ }
set.lang = opt('--lang', set.lang || 'cs');
fs.writeFileSync(setF, JSON.stringify(set));
if (process.argv.includes('--ai')) {
  const src = path.join(process.env.APPDATA, 'MYpremiereMCP');
  fs.mkdirSync(path.join(appdata, 'MYpremiereMCP'), { recursive: true });
  for (const f of ['token.txt', 'root.txt']) { try { fs.copyFileSync(path.join(src, f), path.join(appdata, 'MYpremiereMCP', f)); } catch (e) { /* chybí */ } }
}
const size = opt('--size', '1920x1080');
const env = Object.assign({}, process.env, { APPDATA: appdata, LOCALAPPDATA: local, PZ_WINDOW_SIZE: size, PZ_USERDATA: path.join(appdata, 'electron') });
const p = spawn(ELECTRON, ['.', `--remote-debugging-port=${port}`], { cwd: path.join(__dirname, '..'), env, detached: true, stdio: 'ignore' });
p.unref();

const getJson = () => new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path: '/json' }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
(async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const l = await getJson(); if (l.some((t) => t.type === 'page' && /index\.html/.test(t.url))) break; } catch (e) { /* ještě ne */ }
  }
  await new Promise((r) => setTimeout(r, 2500));
  console.log(`started pid ${p.pid} port ${port} profile ${prof} size ${size} lang ${set.lang}`);
  process.exit(0);
})();
