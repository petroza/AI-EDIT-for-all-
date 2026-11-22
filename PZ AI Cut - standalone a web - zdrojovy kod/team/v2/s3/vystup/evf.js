'use strict';
// Kontrolor výstupu S3: vyhodnotí soubor JS (tělo async funkce, return …) v okně instance. CDP_PORT=9372 node evf.js soubor.js
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const body = fs.readFileSync(process.argv[2], 'utf8');
const expr = `(async () => {${body}\n})()`;
process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, '../../../../test/cdp.js'), 'eval', expr], { env: process.env, maxBuffer: 1 << 26 }).toString());
