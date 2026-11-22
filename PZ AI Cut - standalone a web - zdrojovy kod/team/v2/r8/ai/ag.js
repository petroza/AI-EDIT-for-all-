'use strict';
// node ag.js <task> '<json calls>'
const http = require('http');
const [task, calls] = process.argv.slice(2);
const body = JSON.stringify({ task, calls: JSON.parse(calls) });
const req = http.request({ host: '127.0.0.1', port: 7990, method: 'POST', path: '/', timeout: 900000 }, (r) => { let b = ''; r.setEncoding('utf8'); r.on('data', (d) => { b += d; }); r.on('end', () => console.log(b)); });
req.end(body);
