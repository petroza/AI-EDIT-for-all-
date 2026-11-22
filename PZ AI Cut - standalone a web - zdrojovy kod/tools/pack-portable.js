'use strict';
/* Přenosná verze PZ AI Cut pro Windows (bez instalace): node tools/pack-portable.js [cílová složka] [--zip]
 * Výchozí cíl: <repo>\PZ AI Cut (vedle START.bat v repozitáři AI-EDIT-for-all-), jinak dist-portable\PZ AI Cut.
 * Potřebuje jen `npm install` (Electron v node_modules). config.json v cíli zůstane, když už existuje. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const APP = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const zip = args.includes('--zip');
const repoRoot = path.join(APP, '..');
const defDst = fs.existsSync(path.join(repoRoot, 'START.bat')) ? path.join(repoRoot, 'PZ AI Cut') : path.join(APP, 'dist-portable', 'PZ AI Cut');
const DST = path.resolve(args.find((a) => !a.startsWith('--')) || defDst);
const ELECTRON = path.join(APP, 'node_modules', 'electron', 'dist');

if (!fs.existsSync(path.join(ELECTRON, 'electron.exe'))) {
  console.error('Chybí Electron – nejdřív spusť `npm install` ve složce ' + APP);
  process.exit(1);
}
const EXE = 'PZ AI Cut.exe';
try { cp.execSync(`tasklist /FI "IMAGENAME eq ${EXE}" | find /I "${EXE}"`, { stdio: 'ignore' }); console.error(EXE + ' běží – zavři ho a spusť znovu.'); process.exit(1); } catch (e) { /* neběží */ }

// 1) Electron runtime
fs.mkdirSync(DST, { recursive: true });
for (const f of fs.readdirSync(ELECTRON)) {
  if (f === 'electron.exe') continue;
  fs.cpSync(path.join(ELECTRON, f), path.join(DST, f), { recursive: true });
}
fs.copyFileSync(path.join(ELECTRON, 'electron.exe'), path.join(DST, EXE));
fs.rmSync(path.join(DST, 'resources', 'default_app.asar'), { force: true });

// 2) aplikace do resources\app (bez vývojových a testovacích věcí)
const APPDST = path.join(DST, 'resources', 'app');
const SKIP_DIR = new Set(['node_modules', '.git', '.wrangler', 'test', 'team', 'dist-portable', 'dist', 'test-out', 'codex']);
const SKIP_FILE = new Set(['.env', 'START.bat', 'package-lock.json', 'deploy.js', 'wrangler.jsonc']);
const keepCfg = fs.existsSync(path.join(APPDST, 'config.json'));
for (const d of ['src', 'tools', 'web', 'connector', 'build']) fs.rmSync(path.join(APPDST, d), { recursive: true, force: true });
(function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory() ? SKIP_DIR.has(e.name) : SKIP_FILE.has(e.name) || e.name.endsWith('.tnproj.tmp')) continue;
    if (!e.isDirectory() && e.name === 'config.json' && src === APP && keepCfg) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copy(s, d); else fs.copyFileSync(s, d);
  }
})(APP, APPDST);
console.log('Hotovo: ' + path.join(DST, EXE));

// 3) volitelně zip pro GitHub Releases
if (zip) {
  const out = path.join(path.dirname(DST), 'PZ-AI-Cut-portable.zip');
  fs.rmSync(out, { force: true });
  cp.execFileSync('tar.exe', ['-a', '-c', '-f', out, '-C', path.dirname(DST), path.basename(DST)], { stdio: 'inherit' });
  console.log('Zip: ' + out);
}
