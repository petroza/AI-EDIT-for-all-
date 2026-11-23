#!/usr/bin/env node
'use strict';
/* PZ AI Cut – konektor pro Claude Desktop a Codex (MCP server, stdio). Bez závislostí.
 *
 * Claude Desktop ho spustí jako rozšíření (.mcpb), Codex podle záznamu v ~/.codex/config.toml (instalace codex/install.*). Konektor sám nic nestříhá: nástroje, které Claude zavolá,
 * předá stránce PZ AI Cut otevřené v Chrome na stejném počítači (přes http://127.0.0.1:7895, stránka si úkoly
 * vyzvedává sama) a vrátí výsledek. Video, přepisy i projekty tak zůstávají na počítači uživatele –
 * do Claude jde jen text (přepis, seznam sekvencí), stejně jako při běžné konverzaci.
 * Konektor přijímá požadavky jen od stránky PZ AI Cut (kontrola Origin) a jen z tohoto počítače (127.0.0.1). */

const http = require('http');
const { TOOLS, INSTRUCTIONS } = require('./tools');

const VERSION = '1.4.0';
const PORTS = [7895, 7896, 7897];
const ORIGINS_ALL = [
  'https://pz-ai-cut.pages.dev',
  'http://127.0.0.1:8791', 'http://localhost:8791',
];
// testy (test/connector-pin.js): jen vybrané adresy, aby se do testu nepřipojila otevřená karta uživatele
const ORIGINS = process.env.PZ_CONNECTOR_ORIGINS ? process.env.PZ_CONNECTOR_ORIGINS.split(',') : ORIGINS_ALL;
const WEB_URL = ORIGINS_ALL[0];

const log = (...a) => process.stderr.write('[pz-ai-cut] ' + a.join(' ') + '\n');

/* ---------- most ke stránce ---------- */
const queue = [];            // úkoly čekající na vyzvednutí stránkou
const pending = new Map();   // id -> { resolve, timer }
const pollers = [];          // čekající dlouhé dotazy stránky
let lastSeen = 0;
let seq = 0;
let webInfo = null;
let client = { name: '', app: '' }; // kdo konektor spustil (Claude / Codex) – stránka to ukazuje v panelu

function webConnected() { return Date.now() - lastSeen < 8000 || pollers.length > 0; }

/* Střižna může být otevřená ve víc kartách (nebo v Chrome i jinde) – úkoly jdou do té, se kterou uživatel naposledy
 * pracoval (stránka posílá ?tab=…&act=čas poslední aktivity). Když ta zrovna nečeká (právě vrací výsledek), úkol
 * chvilku počká na její další dotaz; až po 4 s ho dostane jiná karta. */
const tabs = new Map(); // tab -> { act, seen, task }
/* Relace AI je přichycená k jedné kartě (kolo 7, AI tok): dřív šel každý úkol kartě s fokusem, takže když se uživatel
 * přepnul do jiné karty se střižnou, další build / titulky / undo proběhly v cizím projektu. Karta se mění jen když
 * (1) přichycená karta zmizí (zavřená, 25 s bez dotazu), nebo (2) uživatel zadal úkol z panelu AI v jiné kartě.
 * Výsledek prvního úkolu po změně nese upozornění pro AI. */
let pinned = null, tabNote = '';
function bestTab() {
  let best = null;
  for (const [id, t] of tabs) {
    if (Date.now() - t.seen > 25000) { tabs.delete(id); continue; }
    if (!best || t.act > best.act) best = { id, act: t.act, seen: t.seen };
  }
  const claim = [...tabs.entries()].find(([id, t]) => t.task && id !== pinned);
  if (claim) { if (pinned) tabNote = 'the user gave a task from the AI panel in another editor tab – you now work there'; pinned = claim[0]; }
  else if (pinned && !tabs.has(pinned)) { pinned = null; tabNote = 'the previous editor tab was closed'; }
  if (!pinned && best) pinned = best.id;
  const t = pinned && tabs.get(pinned);
  return t ? { id: pinned, act: t.act, seen: t.seen } : best;
}
let redispatch = null;
function dispatch() {
  while (queue.length && pollers.length) {
    const best = bestTab();
    let i = best ? pollers.findIndex((p) => p.tab === best.id) : 0;
    if (i < 0) {
      // přichycená karta právě nečeká (vrací výsledek) – počkat na její další dotaz, jiné kartě úkol nedávat
      if (Date.now() - best.seen < 25000) { clearTimeout(redispatch); redispatch = setTimeout(dispatch, 500); return; }
      i = 0;
    }
    const job = queue.shift();
    const p = pollers.splice(i, 1)[0];
    clearTimeout(p.timer);
    send(p.res, 200, job, p.origin);
  }
}

function callWeb(tool, args, timeoutMs) {
  return new Promise((resolve) => {
    const id = 'j' + (++seq);
    const timer = setTimeout(() => {
      pending.delete(id);
      const i = queue.findIndex((j) => j.id === id);
      if (i >= 0) queue.splice(i, 1);
      resolve({ ok: false, error: 'The PZ AI Cut page did not answer in time. Is it still open in Chrome?' });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
    queue.push({ id, tool, args });
    dispatch();
  });
}

function send(res, code, body, origin) {
  const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (origin) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Vary'] = 'Origin';
  }
  res.writeHead(code, h);
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function handle(req, res) {
  const origin = req.headers.origin || '';
  // Host jen místní (DNS rebinding – bezpečnost S12); Origin jen stránka PZ AI Cut
  const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) { res.writeHead(403); res.end('forbidden'); return; }
  if (!ORIGINS.includes(origin)) { res.writeHead(403); res.end('forbidden'); return; }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    });
    res.end();
    return;
  }
  const u = new URL(req.url, 'http://127.0.0.1');
  lastSeen = Date.now();
  if (u.pathname === '/hello') { send(res, 200, { app: 'pz-ai-cut-connector', version: VERSION, queued: queue.length, client: client.app, clientName: client.name }, origin); return; }
  if (u.pathname === '/claim') {
    // stránka: uživatel právě zadal úkol z panelu AI v téhle kartě → AI pracuje tady (bez čekání na další /next)
    const tab = u.searchParams.get('tab') || '';
    const t = tabs.get(tab) || { act: 0 };
    tabs.set(tab, Object.assign(t, { seen: Date.now(), task: true }));
    bestTab();
    tabs.get(tab).task = false;
    send(res, 200, { ok: true, pinned: pinned === tab }, origin);
    dispatch();
    return;
  }
  if (u.pathname === '/next' && req.method === 'GET') {
    const tab = u.searchParams.get('tab') || '';
    tabs.set(tab, { act: Number(u.searchParams.get('act')) || 0, seen: Date.now(), task: u.searchParams.get('task') === '1' });
    const p = { res, origin, timer: null, tab };
    p.timer = setTimeout(() => { const i = pollers.indexOf(p); if (i >= 0) pollers.splice(i, 1); send(res, 200, { idle: true }, origin); }, 20000);
    req.on('close', () => { const i = pollers.indexOf(p); if (i >= 0) { pollers.splice(i, 1); clearTimeout(p.timer); } });
    pollers.push(p);
    dispatch();
    return;
  }
  if (u.pathname === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 20e6) req.destroy(); });
    req.on('end', () => {
      try {
        const r = JSON.parse(body);
        if (r.info) webInfo = r.info;
        const p = r.id && pending.get(r.id);
        if (p) { clearTimeout(p.timer); pending.delete(r.id); p.resolve(r); }
        send(res, 200, { ok: true }, origin);
      } catch (e) { send(res, 400, { ok: false }, origin); }
    });
    return;
  }
  send(res, 404, { ok: false }, origin);
}

let port = null;
function listen(i) {
  const srv = http.createServer(handle);
  srv.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && i + 1 < PORTS.length) listen(i + 1);
    else log('cannot listen:', e.message);
  });
  srv.listen(PORTS[i], '127.0.0.1', () => { port = PORTS[i]; log('listening on 127.0.0.1:' + port); });
}
listen(0);

/* ---------- MCP (JSON-RPC přes stdio, zprávy po řádcích) ---------- */
function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function replyErr(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }
const text = (t, isError) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 1) }], ...(isError ? { isError: true } : {}) });

async function callTool(name, args) {
  const def = TOOLS.find((t) => t.name === name);
  if (!def) return text('Unknown tool: ' + name, true);
  // stránka se ke konektoru připojuje sama (dotaz každé 3–15 s) – po startu AI chvíli počkat, než ohlásit, že chybí
  for (let i = 0; i < 60 && !webConnected(); i++) await new Promise((r) => setTimeout(r, 250));
  if (!webConnected()) {
    return text(`PZ AI Cut is not open. Ask the user to open ${WEB_URL} in Google Chrome on this computer and keep the tab open `
      + '(if Chrome asks to allow access to devices on the local network, they should click Allow). Then try again.', true);
  }
  const r = await callWeb(name, args || {}, def.timeoutMs || 120000);
  const note = tabNote ? `

Note: ${tabNote}. Call editor_status before you edit – the project may be different.` : '';
  tabNote = '';
  if (!r.ok) return text((r.error || 'Failed') + note, true);
  return text((r.result === undefined ? 'OK' : typeof r.result === 'string' ? r.result : JSON.stringify(r.result, null, 1)) + note);
}

async function onMessage(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    const ci = (params && params.clientInfo) || {};
    client = { name: String(ci.name || ''), app: /codex|openai|chatgpt/i.test(ci.name || '') ? 'Codex' : /claude/i.test(ci.name || '') ? 'Claude' : String(ci.name || 'AI') };
    log('client: ' + client.name + ' ' + (ci.version || ''));
    reply(id, {
      protocolVersion: (params && params.protocolVersion) || '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'pz-ai-cut', version: VERSION },
      instructions: INSTRUCTIONS,
    });
    return;
  }
  if (method === 'notifications/initialized' || (method && method.startsWith('notifications/'))) return;
  if (method === 'ping') { reply(id, {}); return; }
  if (method === 'tools/list') {
    reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    return;
  }
  if (method === 'tools/call') {
    try { reply(id, await callTool(params.name, params.arguments)); } catch (e) { reply(id, text(String(e && e.message || e), true)); }
    return;
  }
  if (method === 'resources/list') { reply(id, { resources: [] }); return; }
  if (method === 'prompts/list') { reply(id, { prompts: [] }); return; }
  if (id !== undefined) replyErr(id, -32601, 'Method not found: ' + method);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { log('bad json'); continue; }
    onMessage(msg).catch((e) => log('error', e.message));
  }
});
process.stdin.on('end', () => process.exit(0));
log('PZ AI Cut connector ' + VERSION + ' started');
