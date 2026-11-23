'use strict';
// S14 web: řídicí démon pro vlastní headless Chrome (CDP 9386). Blokuje konektory 7895–7897 a stahování modelu (HF),
// sbírá konzoli/CSP, poslouchá na pojmenované rouře \\.\pipe\pz-s14-web.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 9386, PIPE = '\\\\.\\pipe\\pz-s14-web';
const PROF = path.join(process.env.TEMP, 'pz-s14-web-chrome');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOG = path.join(__dirname, 'drv-log.jsonl');
const BLOCK = ['*127.0.0.1:7895*', '*127.0.0.1:7896*', '*127.0.0.1:7897*', '*localhost:7895*', '*localhost:7896*', '*localhost:7897*', '*huggingface.co*', '*hf.co/*', '*.hf.co*'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
const log = (o) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...o }) + '\n');
const CSP_HOOK = `(() => { window.__csp = window.__csp || []; addEventListener('securitypolicyviolation', (e) => { window.__csp.push({ dir: e.violatedDirective, uri: e.blockedURI, src: e.sourceFile, line: e.lineNumber, sample: e.sample, at: Date.now() }); console.warn('CSPVIOLATION ' + e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sourceFile + ':' + e.lineNumber); }, true); })();`;

(async () => {
  spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROF}`, '--window-size=1366,768', '--no-first-run', '--no-default-browser-check', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) { await sleep(500); try { ver = await getJson('/json/version'); } catch (e) { /* */ } }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const pend = new Map(); const sessions = new Map(); // sessionId -> {type,url,targetId}
  const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  async function setup(sessionId, info) {
    sessions.set(sessionId, { type: info.type, url: info.url, targetId: info.targetId });
    log({ ev: 'attach', type: info.type, url: info.url });
    const ps = [send('Network.enable', {}, sessionId).then(() => send('Network.setBlockedURLs', { urls: BLOCK }, sessionId)), send('Runtime.enable', {}, sessionId), send('Log.enable', {}, sessionId)];
    if (info.type === 'page' || info.type === 'iframe') {
      ps.push(send('Page.enable', {}, sessionId), send('Page.addScriptToEvaluateOnNewDocument', { source: CSP_HOOK }, sessionId));
    }
    ps.push(send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId));
    await Promise.all(ps);
    await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
  }
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    const s = m.sessionId, p = m.params || {};
    const where = s && sessions.get(s) ? sessions.get(s).type : 'browser';
    switch (m.method) {
      case 'Target.attachedToTarget': setup(p.sessionId, p.targetInfo).catch((e) => log({ ev: 'setupErr', e: String(e) })); break;
      case 'Target.detachedFromTarget': sessions.delete(p.sessionId); break;
      case 'Runtime.consoleAPICalled': if (['error', 'warning', 'assert'].includes(p.type) || p.args.some((a) => /CSPVIOLATION/.test(a.value || ''))) log({ ev: 'console', where, type: p.type, text: p.args.map((a) => a.value !== undefined ? String(a.value) : a.description || '').join(' ').slice(0, 800) }); break;
      case 'Runtime.exceptionThrown': log({ ev: 'exception', where, text: ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').slice(0, 800), url: p.exceptionDetails.url }); break;
      case 'Log.entryAdded': log({ ev: 'log', where, level: p.entry.level, source: p.entry.source, text: String(p.entry.text).slice(0, 800), url: p.entry.url }); break;
      case 'Network.loadingFailed': log({ ev: 'netfail', where, err: p.errorText, blocked: p.blockedReason, cors: p.corsErrorStatus, id: p.requestId }); break;
      case 'Network.requestWillBeSent': if (!/^(data|blob):/.test(p.request.url)) log({ ev: 'req', where, url: p.request.url.slice(0, 300), id: p.requestId }); break;
      default: break;
    }
  };
  await send('Target.setDiscoverTargets', { discover: true });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const tg = (await send('Target.getTargets')).result.targetInfos.filter((t) => t.type === 'page');
  for (const t of tg) { const r = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true }); await setup(r.result.sessionId, t); }

  const pageSess = async (idx) => {
    const ts = (await send('Target.getTargets')).result.targetInfos.filter((t) => t.type === 'page');
    const t = ts[idx || 0];
    for (const [sid, v] of sessions) if (v.targetId === t.targetId) return { sid, t };
    throw new Error('no session for page ' + idx);
  };
  http.createServer(async (req, res) => {
    let body = ''; req.on('data', (d) => { body += d; }); await new Promise((r) => req.on('end', r));
    const q = body ? JSON.parse(body) : {};
    const reply = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    try {
      if (req.url === '/eval') {
        const { sid } = await pageSess(q.tab);
        const m = await send('Runtime.evaluate', { expression: `(async () => { ${q.expr} })()`, awaitPromise: true, returnByValue: true, timeout: q.timeout || 1800000, userGesture: true }, sid);
        if (m.result && m.result.exceptionDetails) return reply({ error: (m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description) || JSON.stringify(m.result.exceptionDetails) });
        return reply({ value: m.result && m.result.result && m.result.result.value, err: m.error });
      }
      if (req.url === '/shot') {
        const { sid } = await pageSess(q.tab);
        const r = await send('Page.captureScreenshot', { format: 'png' }, sid);
        fs.writeFileSync(q.file, Buffer.from(r.result.data, 'base64'));
        return reply({ ok: q.file });
      }
      if (req.url === '/cdp') {
        const { sid } = await pageSess(q.tab);
        return reply(await send(q.method, q.params || {}, q.browser ? undefined : sid));
      }
      if (req.url === '/newtab') { const r = await send('Target.createTarget', { url: q.url }); return reply(r); }
      if (req.url === '/targets') return reply((await send('Target.getTargets')).result.targetInfos.map((t) => ({ type: t.type, url: t.url, id: t.targetId })));
      if (req.url === '/close') { reply({ bye: 1 }); await send('Browser.close'); process.exit(0); }
      reply({ error: 'unknown' });
    } catch (e) { reply({ error: String(e && e.stack || e) }); }
  }).listen(PIPE, () => log({ ev: 'ready' }));
})().catch((e) => { log({ ev: 'fatal', e: String(e.stack || e) }); process.exit(1); });
