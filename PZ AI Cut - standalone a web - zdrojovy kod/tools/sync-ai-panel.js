'use strict';
// AI panel = panel MY Premiere MCP (O:\ADOBEPREMIERESTRIH\panel). Při startu se zkopíruje do src/ai a upraví:
// místo ExtendScriptu v Premiere volá API Střihátka (shim.js), most poslouchá na vlastním portu.
// Díky tomu se každé vylepšení panelu v MY Premiere MCP projeví i tady. Když složka AI chybí, zůstane poslední kopie.
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
const OUT = path.join(APP, 'src', 'ai');

function readCfg() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(path.join(APP, 'config.json'), 'utf8')); } catch (e) { /* výchozí */ }
  c.aiRoot = require('../src/core/airoot').resolveAiRoot(c.aiRoot, APP);
  return c;
}

function patchMain(js) {
  const rules = [
    // kořen AI (server, skripty, config) z configu Střihátka místo složky panelu
    [/var ROOT = path\.dirname\(extDir\);/, 'var ROOT = window.TN_AI_ROOT || path.dirname(extDir);'],
    // vlastní port mostu (vedle Premiere na 7880)
    [/(\$\('port'\)\.textContent = PORT;)/, 'if (window.TN_BRIDGE_PORT) PORT = window.TN_BRIDGE_PORT;\n  $1'],
    [/app: 'PPRO', panel: '0\.1\.0'/, "app: 'TNSTRIH', panel: '0.1.0'"],
    // Claude Code: MCP konfigurace s portem mostu Střihátka (env proměnná se serveru nemusí předat)
    [/'--mcp-config', path\.join\(ROOT, 'mcp\.json'\)/, "'--mcp-config', (window.TN_MCP_JSON || path.join(ROOT, 'mcp.json'))"],
    // anglické rozhraní: rychlá zadání se AI posílají v ověřeném českém znění (Hermes pozná druh zadání podle češtiny)
    [/var prompt = task\.prompt;/, 'var prompt = window.TN_UNTRANSLATE ? window.TN_UNTRANSLATE(task.prompt, task.agent) : task.prompt;'],
    // Codex: totéž přes -c
    [/('-c', 'mcp_servers\.premiere\.default_tools_approval_mode="approve"')\]/,
      "$1, '-c', 'mcp_servers.premiere.env.PMCP_PORT=\"' + PORT + '\"']"],
  ];
  for (const [re, rep] of rules) {
    if (!re.test(js)) throw new Error('úprava panelu selhala (změnil se main.js v MY Premiere MCP): ' + re);
    js = js.replace(re, rep);
  }
  // texty pro uživatele
  js = js.replace(/modální dialog v Premiere\?/g, 'Střihátko je zaneprázdněné?')
    .replace(/ v Premiere/g, ' ve Střihátku')
    .replace(/otevři sekvenci ve Střihátku/g, 'otevři sekvenci na timeline');
  return '/* VYGENEROVÁNO z MY Premiere MCP panel/main.js (tools/sync-ai-panel.js) – neupravovat ručně */\n' + js;
}

function patchHtml(html) {
  if (!/<script src="main\.js"><\/script>/.test(html)) throw new Error('úprava panelu selhala: index.html bez main.js');
  html = html.replace(/<script src="main\.js"><\/script>/, '<script src="shim.js"></script>\n<script src="main.js"></script>\n<script src="i18n.js"></script>\n<script src="layout.js"></script>');
  html = html.replace(/<\/head>/, '<link rel="stylesheet" href="layout.css">\n</head>');
  html = html.replace(/ v Premiere/g, ' ve Střihátku').replace(/do Premiere/g, 'do Střihátka');
  return html;
}

function syncAiPanel() {
  const cfg = readCfg();
  const src = cfg.aiRoot && path.join(cfg.aiRoot, 'panel');
  if (!src || !fs.existsSync(path.join(src, 'main.js'))) return { synced: false, reason: 'AI složka nenalezena: ' + cfg.aiRoot };
  fs.mkdirSync(OUT, { recursive: true });
  const main = patchMain(fs.readFileSync(path.join(src, 'main.js'), 'utf8'));
  const html = patchHtml(fs.readFileSync(path.join(src, 'index.html'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'main.js'), main, 'utf8');
  fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
  return { synced: true };
}

module.exports = { syncAiPanel, patchMain, patchHtml };
if (require.main === module) console.log(syncAiPanel());
