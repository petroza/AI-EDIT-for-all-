'use strict';
/* Sestaví a nasadí webovou verzi na Cloudflare Pages (https://pz-ai-cut.pages.dev – v adrese není jméno účtu).
 * Přístup bere z web/.env (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN) – soubor je v .gitignore.
 * Spuštění: node web/deploy.js */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const env = { ...process.env };
for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
require('./build');
const candidates = [path.join(__dirname, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'O:\\OliverMilk\\node_modules\\wrangler\\bin\\wrangler.js'];
const wrangler = candidates.find((p) => fs.existsSync(p));
if (!wrangler) throw new Error('wrangler not found (npm i -D wrangler in web/)');
execFileSync(process.execPath, [wrangler, 'pages', 'deploy', '--branch', 'main', '--commit-dirty=true'], { cwd: __dirname, env, stdio: 'inherit' });
