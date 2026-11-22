'use strict';
// Složka MY Premiere MCP (AI panel, server, Worker, modely). Pořadí: config.json → aiRoot, proměnná MYPREMIEREMCP_ROOT,
// %APPDATA%\MYpremiereMCP\root.txt (zapíše instalátor MY Premiere MCP), vedlejší složka my-premiere-mcp
// z repozitáře AI-EDIT-for-all- (ze zdrojů i z přenosné verze). Vrací '' když nic neexistuje.
const fs = require('fs');
const path = require('path');

const ok = (p) => { try { return !!p && fs.existsSync(path.join(p, 'server', 'index.js')); } catch (e) { return false; } };

function resolveAiRoot(configured, appRoot) {
  const cand = [configured, process.env.MYPREMIEREMCP_ROOT];
  try {
    if (process.env.APPDATA) cand.push(fs.readFileSync(path.join(process.env.APPDATA, 'MYpremiereMCP', 'root.txt'), 'utf8').replace(/^[\s]+/, '').trim());
  } catch (e) { /* instalátor neběžel */ }
  // zdroje: <repo>\pz-ai-cut → <repo>\my-premiere-mcp; přenosná: <repo>\PZ AI Cut\resources\app → <repo>\my-premiere-mcp
  cand.push(path.join(appRoot, '..', 'my-premiere-mcp'), path.join(appRoot, '..', '..', '..', 'my-premiere-mcp'));
  for (const c of cand) if (ok(c)) return path.resolve(c);
  return '';
}

module.exports = { resolveAiRoot };
