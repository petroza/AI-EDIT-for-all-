'use strict';
/* Test konektoru jako Claude Desktop: spustí connector/server/index.js, provede MCP handshake a zavolá nástroje.
 *   node test/mcp-client.js '[{"name":"editor_status"},{"name":"transcribe_media","arguments":{}}]'
 * Stránka PZ AI Cut musí běžet (např. http://127.0.0.1:8791 přes web/serve.js). */
const { spawn } = require('child_process');
const path = require('path');

const calls = JSON.parse(process.argv[2] || '[{"name":"editor_status"}]');
const proc = spawn(process.execPath, [path.join(__dirname, '..', 'connector', 'server', 'index.js')], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '', id = 0;
const waiting = new Map();
proc.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    const w = waiting.get(msg.id); if (w) { waiting.delete(msg.id); w(msg); }
  }
});
const rpc = (method, params) => new Promise((res) => { const k = ++id; waiting.set(k, res); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: k, method, params }) + '\n'); });

(async () => {
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  // počkat, až si stránka konektor najde
  for (let k = 0; k < 20; k++) {
    const r = await rpc('tools/call', { name: 'editor_status', arguments: {} });
    if (!r.result.isError) break;
    await new Promise((res) => setTimeout(res, 1000));
  }
  for (const c of calls) {
    const t0 = Date.now();
    const r = await rpc('tools/call', { name: c.name, arguments: c.arguments || {} });
    const txt = r.result ? r.result.content.map((x) => x.text).join('\n') : JSON.stringify(r.error);
    console.log(`\n=== ${c.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${r.result && r.result.isError ? ' ERROR' : ''}\n${txt.slice(0, Number(process.env.MAXOUT || 3000))}`);
  }
  proc.kill();
  process.exit(0);
})();
