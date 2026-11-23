// Posloucha konzoli okna aplikace (vc. iframe AI panelu) pres CDP a zapisuje do souboru. node listen.js <port> <soubor> <sekund>
const http = require('http'); const fs = require('fs');
const [port, out, secs] = [Number(process.argv[2]), process.argv[3], Number(process.argv[4] || 3600)];
const log = (o) => fs.appendFileSync(out, JSON.stringify(Object.assign({ t: new Date().toISOString().slice(11, 23) }, o)) + '\n');
http.get({ host: '127.0.0.1', port, path: '/json' }, (r) => { let b = ''; r.on('data', (d) => b += d); r.on('end', async () => {
  const list = JSON.parse(b); log({ targets: list.map((t) => t.type + ' ' + t.url.slice(-60)) });
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url) && !/\/ai\//.test(t.url));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res) => ws.onopen = res);
  let id = 0; const send = (m, p = {}) => ws.send(JSON.stringify({ id: ++id, method: m, params: p }));
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) log({ console: m.params.type, ctx: m.params.executionContextId, text: m.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ').slice(0, 600) });
    else if (m.method === 'Runtime.exceptionThrown') log({ exception: (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 600), url: m.params.exceptionDetails.url });
    else if (m.method === 'Log.entryAdded') log({ logEntry: m.params.entry.level, source: m.params.entry.source, text: m.params.entry.text.slice(0, 600), url: m.params.entry.url });
    else if (m.method === 'Runtime.executionContextCreated') log({ ctx: m.params.context.id, origin: m.params.context.origin, name: m.params.context.name, frame: m.params.context.auxData && m.params.context.auxData.frameId });
  };
  send('Runtime.enable'); send('Log.enable');
  setTimeout(() => { log({ end: true }); process.exit(0); }, secs * 1000);
}); });
