'use strict';
/* AI tok r8: jedna trvalá MCP relace s konektorem (jako Claude Desktop), volání přes HTTP 127.0.0.1:7990.
 * Pojistka: PZ_CONNECTOR_ORIGINS vynuceně jen 127.0.0.1:8791 + před každou dávkou editor_status s ai-r8.mp4. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = 'O:/TN_strihatko/team/v2/r8/ai';
const LOG = path.join(OUT, 'calls.jsonl');
const env = Object.assign({}, process.env, { PZ_CONNECTOR_ORIGINS: 'http://127.0.0.1:8791' });
const proc = spawn(process.execPath, ['O:/TN_strihatko/connector/server/index.js'], { stdio: ['pipe', 'pipe', 'pipe'], env });
proc.stderr.on('data', (d) => fs.appendFileSync(path.join(OUT, 'connector-stderr.txt'), d));
let buf = '', id = 0;
const waiting = new Map();
proc.stdout.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) { const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); const w = waiting.get(msg.id); if (w) { waiting.delete(msg.id); w(msg); } }
});
const rpc = (method, params) => new Promise((res) => { const k = ++id; waiting.set(k, res); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: k, method, params }) + '\n'); });
async function call(name, args) {
  const t0 = Date.now();
  const r = await rpc('tools/call', { name, arguments: args || {} });
  const txt = r.result ? r.result.content.map((x) => x.text).join('\n') : JSON.stringify(r.error);
  return { name, args: args || {}, out: txt, isError: !!(r.result && r.result.isError), secs: (Date.now() - t0) / 1000 };
}
(async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-ai-r8-test', version: '1' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tl = await rpc('tools/list', {});
  const instr = init.result.instructions || '';
  const toolsJson = JSON.stringify(tl.result.tools);
  fs.writeFileSync(path.join(OUT, 'init.json'), JSON.stringify({ instructionsChars: instr.length, toolsChars: toolsJson.length, tools: tl.result.tools.map((t) => t.name), instructions: instr, toolsList: tl.result.tools }, null, 1));
  // čekat na připojení stránky
  for (let k = 0; k < 30; k++) { const r = await call('editor_status'); if (!r.isError) break; await new Promise((res) => setTimeout(res, 1000)); }
  http.createServer((req, res) => {
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', async () => {
      const q = JSON.parse(body || '{}');
      const out = [];
      const g = await call('editor_status');
      fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), task: q.task, guard: true, ...g, inChars: 0, outChars: g.out.length }) + '\n');
      if (g.isError || !/ai-r8\.mp4/.test(g.out)) { res.end('STOP – guard failed:\n' + g.out); return; }
      out.push('[guard ok]');
      for (const c of q.calls || []) {
        const r = await call(c.name, c.arguments);
        const inChars = JSON.stringify({ name: c.name, input: c.arguments || {} }).length;
        fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), task: q.task, guard: false, ...r, inChars, outChars: r.out.length }) + '\n');
        out.push(`=== ${c.name} (${r.secs.toFixed(1)} s)${r.isError ? ' ERROR' : ''} [in ${inChars} / out ${r.out.length} chars]\n${r.out}`);
      }
      res.end(out.join('\n\n'));
    });
  }).listen(7990, '127.0.0.1', () => console.log('agent-srv ready'));
})();
