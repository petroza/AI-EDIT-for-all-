'use strict';
// Výpis výchozích zkratek Premiere Pro z jejího souboru .kys (předloha pro ovládání PZ AI Cut).
//   node tools/premiere-kys.js [cesta.kys] [--json]
const fs = require('fs');
const DEF = 'C:/Program Files/Adobe/Adobe Premiere Pro 2027/Keyboard Shortcuts/en/Adobe Premiere Pro Defaults.kys';

const VK = {
  0x08: 'Backspace', 0x09: 'Tab', 0x0d: 'Enter', 0x1b: 'Esc', 0x20: 'Space', 0x21: 'PageUp', 0x22: 'PageDown', 0x23: 'End', 0x24: 'Home',
  0x25: 'Left', 0x26: 'Up', 0x27: 'Right', 0x28: 'Down', 0x2d: 'Insert', 0x2e: 'Delete', 0x6b: 'Num+', 0x6d: 'Num-', 0x6a: 'Num*',
  0xba: ';', 0xbb: '=', 0xbc: ',', 0xbd: '-', 0xbe: '.', 0xbf: '/', 0xc0: '`', 0xdb: '[', 0xdc: '\\', 0xdd: ']', 0xde: "'",
};
// Premiere: s horním bitem = ASCII znak klávesy (V, =, ', [ …); bez něj vlastní číslování speciálních kláves
// (odvozeno ze známých výchozích zkratek: Clear = Delete, Step Forward = Right, Next Edit = Down …)
const SPECIAL = { 1: 'Space', 2: 'Backspace', 3: 'Tab', 4: 'Enter', 7: 'F1', 32: 'Space', 35: 'Delete', 36: 'Backspace', 37: 'Tab', 38: 'PageUp', 39: 'PageDown', 40: 'Home', 41: 'End',
  42: 'Left', 43: 'Right', 44: 'Up', 45: 'Down', 46: 'Enter', 47: 'NumEnter', 48: 'Esc' };
function keyName(v) {
  v = Number(v);
  if (v >= 0x80000000) {
    const k = v - 0x80000000;
    if (k === 0x20) return 'Space';
    return String.fromCharCode(k).toUpperCase();
  }
  if (v >= 1 && v <= 24 && false) return 'F' + v;
  return SPECIAL[v] || ('K' + v);
}

function parse(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const ctx of xml.matchAll(/<context\.([\w.]+) Version="\d+">([\s\S]*?)<\/context\.\1>/g)) {
    for (const it of ctx[2].matchAll(/<item\.\d+ Version="\d+">([\s\S]*?)<\/item\.\d+>/g)) {
      const g = (t) => (it[1].match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1];
      const cmd = g('commandname'), vk = g('virtualkey');
      if (!cmd || !vk) continue;
      const mods = [g('modifier.ctrl') === 'true' && 'Ctrl', g('modifier.alt') === 'true' && 'Alt', g('modifier.shift') === 'true' && 'Shift'].filter(Boolean);
      out.push({ context: ctx[1], command: cmd, key: [...mods, keyName(vk)].join('+') });
    }
  }
  return out;
}

if (require.main === module) {
  const file = process.argv.find((a) => /\.kys$/i.test(a)) || DEF;
  const rows = parse(file);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) console.log(`${r.context.padEnd(22)} ${r.key.padEnd(16)} ${r.command}`);
}
module.exports = { parse, DEF };
