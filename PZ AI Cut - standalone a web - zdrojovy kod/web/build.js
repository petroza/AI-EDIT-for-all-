'use strict';
/* Sestavení webové verze do web/dist (node web/build.js). Bez bundleru: projde require() od web/entry.js,
 * moduly Node/Electronu nahradí webovými náhradami (web/shims, media-web, importer-web, export-web)
 * a vše zabalí do jednoho dist/app.js. Kód střihu, časové osy a monitorů je SDÍLENÝ s desktopem (src/). */
const fs = require('fs');
const path = require('path');

const WEB = __dirname;
const ROOT = path.dirname(WEB);
const SRC = path.join(ROOT, 'src');
const DIST = path.join(WEB, 'dist');

const BUILTIN = {
  electron: 'shims/electron.js', fs: 'shims/fs.js',
  path: 'shims/builtin-path.js', url: 'shims/builtin-url.js', http: 'shims/builtin-http.js', net: 'shims/builtin-net.js',
  child_process: 'shims/builtin-child_process.js', crypto: 'shims/builtin-crypto.js',
};
const ALIAS = {
  [path.join(SRC, 'core', 'media.js')]: path.join(WEB, 'media-web.js'),
  [path.join(SRC, 'core', 'importer.js')]: path.join(WEB, 'importer-web.js'),
  [path.join(SRC, 'core', 'exporter.js')]: path.join(WEB, 'export-web.js'),
  [path.join(SRC, 'core', 'dropfiles.js')]: path.join(WEB, 'shims', 'dropfiles.js'),
};
// malé moduly Node se generují z node-basics.js
const GEN = {
  'shims/builtin-path.js': "module.exports = require('./node-basics').path;",
  'shims/builtin-url.js': "module.exports = require('./node-basics').url;",
  'shims/builtin-http.js': "module.exports = require('./node-basics').http;",
  'shims/builtin-net.js': "module.exports = require('./node-basics').net;",
  'shims/builtin-child_process.js': "module.exports = require('./node-basics').childProcess;",
  'shims/builtin-crypto.js': "module.exports = require('./node-basics').crypto;",
};

const mods = new Map(); // abs -> { id, code, deps: {req: id} }
function resolve(from, req) {
  if (BUILTIN[req]) return path.join(WEB, BUILTIN[req]);
  if (!req.startsWith('.')) throw new Error(`Unknown module "${req}" in ${path.relative(ROOT, from)}`);
  let p = path.resolve(path.dirname(from), req);
  for (const c of [p, p + '.js', path.join(p, 'index.js')]) {
    const a = ALIAS[c] || c;
    if (GEN[path.relative(WEB, a).replace(/\\/g, '/')] || (fs.existsSync(a) && fs.statSync(a).isFile())) return a;
  }
  throw new Error(`Cannot resolve "${req}" from ${path.relative(ROOT, from)}`);
}
function load(abs) {
  if (mods.has(abs)) return mods.get(abs).id;
  const rel = path.relative(WEB, abs).replace(/\\/g, '/');
  const code = GEN[rel] || fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
  const m = { id: mods.size, rel: path.relative(ROOT, abs).replace(/\\/g, '/'), code, deps: {} };
  mods.set(abs, m);
  const re = /require\(\s*'([^']+)'\s*\)|require\(\s*"([^"]+)"\s*\)/g;
  let x;
  while ((x = re.exec(code))) {
    const req = x[1] || x[2];
    if (m.deps[req] !== undefined) continue;
    m.deps[req] = load(resolve(abs, req));
  }
  return m.id;
}

/* Minimální ZIP (bez komprese, CRC32) – stačí pro balíček konektoru. */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function listDir(dir) {
  const files = [];
  (function walk(d, rel) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f), r = rel ? rel + '/' + f : f;
      if (fs.statSync(p).isDirectory()) walk(p, r); else files.push([r, fs.readFileSync(p)]);
    }
  })(dir, '');
  return files;
}
function zipDir(dir) { return zipFiles(listDir(dir)); }
function zipFiles(files) {
  const parts = [], central = [];
  let off = 0;
  for (const [name, data] of files) {
    const nm = Buffer.from(name, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nm.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, nm, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nm);
    off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

function build() {
  mods.clear();
  const entry = load(path.join(WEB, 'entry.js'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  let out = `/* PZ AI Cut Web ${pkg.version} – sestaveno ${new Date().toISOString()} */\n`;
  out += `(function () {\n'use strict';\nwindow.__WEB__ = true;\nwindow.process = window.process || { env: { APPDATA: '/appdata', LOCALAPPDATA: '/appdata', USERPROFILE: '/home' }, platform: 'web', versions: {}, cwd: () => '/', on: () => {} };\nwindow.__PZ_VERSION__ = ${JSON.stringify(pkg.version)};\n`;
  out += 'var defs = [];\n';
  for (const m of mods.values()) {
    out += `// ---- ${m.rel}\ndefs[${m.id}] = [${JSON.stringify(m.deps)}, function (require, module, exports, __dirname, __filename) {\n${m.code}\n}];\n`;
  }
  out += `var cache = [];
function req(id) {
  if (cache[id]) return cache[id].exports;
  var d = defs[id], module = { exports: {} };
  cache[id] = module;
  d[1](function (r) { var t = d[0][r]; if (t === undefined) throw new Error('Module not bundled: ' + r); return req(t); }, module, module.exports, '/app', '/app/module.js');
  return module.exports;
}
req(${entry});
})();\n`;
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'app.js'), out);

  // stránka: index.html z desktopu + webové doplňky
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  // desktop: <script src="boot.js"> (CSP bez vložených skriptů); web: svazek app.js. Desktopová CSP (file:, Node) do webu nepatří
  html = html.replace(/<script src="boot\.js"><\/script>|<script>\s*require\('\.\/renderer\.js'\);?\s*<\/script>/, '<script src="app.js?v=' + Date.now().toString(36) + '"></script>');
  // i s konci řádků CRLF (revize S14: checkout s core.autocrlf=true nechal ve webu dvě CSP a přepis se nenačetl)
  html = html.replace(/<!-- Bezpečnost S12[^\r\n]*-->\r?\n/, '').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\r?\n?/g, '');
  // webová CSP (bezpečnost S13): jen vlastní skripty + knihovny pro přepis / výřez z CDN, síť jen na modely a místní konektor
  const WEB_CSP = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; "
    + "img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; frame-src 'self'; "
    + "connect-src 'self' data: blob: http://127.0.0.1:* http://localhost:* https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co "
    + "https://*.hf.co https://storage.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'";
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + WEB_CSP + '">');
  if ((html.match(/Content-Security-Policy/g) || []).length !== 1) throw new Error('web/build.js: index.html musí mít právě jednu CSP (webovou)');
  html = html.replace('<title>PZ AI Cut Standalone</title>', '<title>PZ AI Cut Web</title>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<link rel="icon" href="icon.png">\n<meta name="description" content="PZ AI Cut – online video editor. Your media and projects stay on your computer.">');
  html = html.replace('<link rel="stylesheet" href="premiere-look.css">', '<link rel="stylesheet" href="premiere-look.css">\n<link rel="stylesheet" href="web.css">');
  html = html.replace('PZ AI Cut <i>Standalone</i></span>', 'PZ AI Cut <i>Web</i></span>\n    <nav id="menubar" class="menubar"></nav>');
  if (!html.includes('app.js')) throw new Error('index.html: renderer script not found');
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  for (const f of ['app.css', 'premiere-look.css', 'icon.png']) fs.copyFileSync(path.join(SRC, f), path.join(DIST, f));
  for (const f of fs.readdirSync(path.join(WEB, 'static'))) fs.copyFileSync(path.join(WEB, 'static', f), path.join(DIST, f));
  // konektor pro Claude Desktop (.mcpb = zip složky connector s manifest.json v kořeni)
  const zipped = zipDir(path.join(ROOT, 'connector'));
  fs.writeFileSync(path.join(DIST, 'pz-ai-cut.mcpb'), zipped);
  // plugin pro Claude (Customize → Plugins → Upload plugin) – pro firmy, které blokují rozšíření .mcpb: obsahuje stejný .mcpb
  // (Claude Desktop k němu dodá Node) a skill s postupem střihu. Místní server z pluginu běží v Cowork a v záložce Code.
  const pluginFiles = listDir(path.join(WEB, 'plugin'));
  pluginFiles.push(['pz-ai-cut.mcpb', zipped]);
  fs.writeFileSync(path.join(DIST, 'pz-ai-cut-plugin.zip'), zipFiles(pluginFiles));
  // konektor pro Codex: instalační skripty + stejné soubory serveru (stahuje je codex/install.ps1 / install.sh)
  fs.mkdirSync(path.join(DIST, 'codex', 'server'), { recursive: true });
  for (const f of fs.readdirSync(path.join(WEB, 'codex'))) fs.copyFileSync(path.join(WEB, 'codex', f), path.join(DIST, 'codex', f));
  for (const f of ['index.js', 'tools.js']) fs.copyFileSync(path.join(ROOT, 'connector', 'server', f), path.join(DIST, 'codex', 'server', f));
  console.log(`web/dist: ${mods.size} modules, app.js ${(out.length / 1024).toFixed(0)} kB`);
}

build();
module.exports = { build };
