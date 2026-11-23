'use strict';
// node c.js eval <file.js|-e "expr"> [tab]  |  node c.js shot <file.png> [tab]  |  node c.js newtab <url> | targets | close | cdp <method> <json> [tab]
const http = require('http');
const fs = require('fs');
const [cmd, a, b, c] = process.argv.slice(2);
let path, body;
if (cmd === 'eval') { path = '/eval'; const expr = a === '-e' ? b : fs.readFileSync(a, 'utf8'); body = { expr, tab: Number(a === '-e' ? c || 0 : b || 0) }; }
else if (cmd === 'shot') { path = '/shot'; body = { file: a, tab: Number(b || 0) }; }
else if (cmd === 'newtab') { path = '/newtab'; body = { url: a }; }
else if (cmd === 'cdp') { path = '/cdp'; body = { method: a, params: JSON.parse(b || '{}'), tab: Number(c || 0) }; }
else { path = '/' + cmd; body = {}; }
const req = http.request({ socketPath: '\\\\.\\pipe\\pz-s14-web', path, method: 'POST' }, (r) => { let s = ''; r.on('data', (d) => { s += d; }); r.on('end', () => { const o = JSON.parse(s); console.log(o.error ? 'CHYBA: ' + o.error : typeof o.value === 'string' ? o.value : JSON.stringify(o.value !== undefined ? o.value : o, null, 1)); }); });
req.end(JSON.stringify(body));
