// MCP-cesta bez MCP: TN.app.api.addCaptions (to vola add_captions ve standalone) s SRT z 2radkovych titulku s4-sim916
const P = TN.app.project, fs = require('fs');
const src = P.sequences.find((x) => x.name === 's4-sim916');
const t = (x) => { const ms = Math.round(x * 1000); const p = (n, k = 2) => String(n).padStart(k, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
const srt = src.captions.map((c, i) => `${i + 1}\n${t(c.start)} --> ${t(c.end)}\n${c.text}\n`).join('\n');
const path = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/team/v2/s4/vystup/sim916-2radky.srt';
fs.writeFileSync(path, srt, 'utf8');
const mem = {}; for (const k of ['tall', 'wide', 'square']) { mem[k] = localStorage.getItem('pzCapStyle.' + k); localStorage.removeItem('pzCapStyle.' + k); }
const out = { srtCaps: src.captions.length, srtMaxLines: Math.max(...src.captions.map((c) => c.text.split('\n').length)), memoryCleared: mem };
// 9:16 bez stylu, lines:1
let r = TN.app.api.addCaptions({ sequence: 's4-L1api916', srtPath: path, lines: 1 });
let s = P.sequences.find((x) => x.name === 's4-L1api916');
out.api916 = { ret: r, n: s.captions.length, maxLines: Math.max(...s.captions.map((c) => c.text.split('\n').length)), style: s.captionStyle };
// 16:9 se stylem 2 radky (jako panel), lines:1 + charsPerLine:30
s = P.sequences.find((x) => x.name === 's4-L1api169');
P.edit('S4 styl 2 radky', () => { s.captionStyle = { lines: 2, maxChars: 40, size: 1, pos: 5, color: '#ffffff', box: false }; });
r = TN.app.api.addCaptions({ sequence: 's4-L1api169', srtPath: path, lines: 1, charsPerLine: 30 });
out.api169 = { ret: r, n: s.captions.length, maxLines: Math.max(...s.captions.map((c) => c.text.split('\n').length)), maxLen: Math.max(...s.captions.map((c) => c.text.length)), style: s.captionStyle };
// 9:16 sekvence se stylem 2 radky (s4-sim916 sama), lines:1 - kopie pres reframe
const rr = await TN.app.api.reframeSequence({ sequence: 's4-sim', name: 's4-L1api916b', num: 9, den: 16 });
s = P.sequences.find((x) => x.id === rr.sequenceID);
P.edit('S4 styl 2 radky', () => { s.captionStyle = Object.assign({}, s.captionStyle || {}, { lines: 2, maxChars: 25 }); });
r = TN.app.api.addCaptions({ sequence: s.name, srtPath: path, lines: 1 });
out.api916b = { ret: r, n: s.captions.length, maxLines: Math.max(...s.captions.map((c) => c.text.split('\n').length)), style: s.captionStyle };
for (const k in mem) if (mem[k] !== null) localStorage.setItem('pzCapStyle.' + k, mem[k]);
out.all = Object.fromEntries(['s4-L1api916', 's4-L1api169', s.name].map((n) => [n, P.sequences.find((x) => x.name === n).captions.map((c) => [c.start, c.end, c.text])]));
return JSON.stringify(out);
