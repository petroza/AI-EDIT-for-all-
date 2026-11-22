/* Most panelu MY Premiere MCP do TN Střihátka: panel volá „ExtendScript“ (window.__adobe_cep__.evalScript)
 * a my místo Premiere zavoláme API Střihátka (src/core/pmcp-api.js) v hlavním okně. */
(function () {
  'use strict';
  var TN = window.parent && window.parent.TN;
  if (!TN) { document.title = 'AI panel: chybí TN Střihátko'; return; }
  var fs = require('fs');
  var path = require('path');
  window.TN_AI_ROOT = TN.aiRoot;
  window.TN_BRIDGE_PORT = TN.bridgePort;
  // agenti (Claude, Codex, Hermes) spouští MCP server jako podproces – port mostu se jim předá proměnnou prostředí
  process.env.PMCP_PORT = String(TN.bridgePort);
  // a pro Claude Code i v MCP konfiguraci (CLI nemusí předat celé prostředí)
  try {
    var dir = path.join(process.env.APPDATA || TN.aiRoot, 'TN_strihatoko');
    fs.mkdirSync(dir, { recursive: true });
    var f = path.join(dir, 'mcp.json');
    fs.writeFileSync(f, JSON.stringify({ mcpServers: { premiere: {
      command: 'node', args: [path.join(TN.aiRoot, 'server', 'index.js').replace(/\\/g, '/')],
      env: { PMCP_PORT: String(TN.bridgePort) },
    } } }, null, 1));
    window.TN_MCP_JSON = f;
  } catch (e) { /* bez vlastní konfigurace – výchozí mcp.json */ }
  window.__adobe_cep__ = {
    evalScript: function (code, cb) {
      TN.evalScript(String(code)).then(function (raw) { cb(raw); }, function (e) {
        cb(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
      });
    },
  };
})();
