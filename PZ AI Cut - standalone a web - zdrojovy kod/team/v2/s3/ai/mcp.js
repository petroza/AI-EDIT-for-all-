'use strict';
// Kontrolor výstupu s1: MCP server MY Premiere MCP (stdio) napojený na most VLASTNÍ instance (PMCP_PORT, výchozí 7890).
//   PMCP_PORT=7890 node mcp.js '[{"name":"premiere_status"}, …]'
const { spawn } = require('child_process');
const SERVER = 'O:/AI STRIH ALL app/MY Premiere MCP - plugin do Premiere - zdrojovy kod/server/index.js';
const calls = JSON.parse(process.argv[2] || '[{"name":"premiere_status"}]');
const proc = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'inherit'], env: Object.assign({}, process.env, { PMCP_PORT: process.env.PMCP_PORT || '7890' }) });
let buf = '', id = 0;
const waiting = new Map();
proc.stdout.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } } catch (e) {} }
});
const rpc = (method, params) => new Promise((res) => { const k = ++id; waiting.set(k, res); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: k, method, params }) + '\n'); });
(async () => {
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vystup-s1', version: '1' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  for (const c of calls) {
    const t0 = Date.now();
    const r = await rpc('tools/call', { name: c.name, arguments: c.arguments || {} });
    const txt = r.result ? r.result.content.map((x) => x.text || '').join('\n') : JSON.stringify(r.error);
    console.log(`\n=== ${c.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${r.result && r.result.isError ? ' ERROR' : ''}\n${txt.slice(0, Number(process.env.MAXOUT || 4000))}`);
  }
  proc.kill(); process.exit(0);
})();
