const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter'); const fs = require('fs'), path = require('path');
const P = TN.app.project, api = TN.app.api, E = TN.app.editCore;
const out = (n) => APP + '/web/test-out/regrese-s14-' + n;
const V = P.media.find(m => m.name === 'vyrez-5min.mp4').path;
const r = {};
// 1) jen In -> do konce
const b = await api.buildSequence({ name: 'S14 inonly', segments: [{ source: V, in: 30, out: 40 }] });
const si = P.sequences.find(s => s.id === b.sequenceID); si.inPoint = 5; si.outPoint = null;
r.inOnly = await X.exportSequence(P, si, { output: out('jen-in.mp4'), range: 'inout', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(x => x.duration || 'ok', e => 'ERR ' + e.message);
// 2) export na zdroj
r.overSource = await X.exportSequence(P, si, { output: V, range: 'all', format: 'h264', loudness: 'off' }).then(() => 'PREPSAL!', e => e.message);
// 3) dva exporty do jednoho souboru + 4) uprava behem exportu (zmrazeny snimek)
const b2 = await api.buildSequence({ name: 'S14 dlouha', segments: [{ source: V, in: 0, out: 120 }] });
const sl = P.sequences.find(s => s.id === b2.sequenceID);
const p1 = X.exportSequence(P, sl, { output: out('behem-upravy.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'social' });
await new Promise(res => setTimeout(res, 300));
r.second = await X.exportSequence(P, sl, { output: out('behem-upravy.mp4'), range: 'all', format: 'h264', loudness: 'off' }).then(() => 'DRUHY PROSEL', e => e.message);
// uprava behem exportu: ripple delete 10-70 s na sekvenci
TN.app.project.edit('S14 extract', () => E.extractRange(sl, 10, 70));
r.seqDurAfterEdit = TN.app.seqDuration ? TN.app.seqDuration(sl) : null;
r.activeDuring = X.exportSequence.active();
// jazyk behem exportu
TN.app.cmd('setLang', 'en'); await new Promise(res => setTimeout(res, 800));
r.langDuring = TN.lang || (require(APP + '/src/i18n-app').lang);
r.first = await p1.then(x => ({ dur: x.duration }), e => 'ERR ' + e.message);
await new Promise(res => setTimeout(res, 1500));
r.langAfter = TN.lang;
TN.app.cmd('setLang', 'cs'); await new Promise(res => setTimeout(res, 800));
r.langBack = TN.lang;
// 5) zruseni
const sig = { cancelled: false };
let works0 = []; const cache = path.join(process.env.LOCALAPPDATA || '', 'TN_strihatoko');
const p3 = X.exportSequence(P, sl, { output: out('zruseno.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'social', signal: sig, _onWork: (w) => works0.push(w) });
await new Promise(res => setTimeout(res, 1500));
sig.cancelled = true; if (sig.kill) sig.kill();
r.cancel = await p3.then(() => 'DOKONCIL', e => e.message);
r.cancelFile = fs.existsSync(out('zruseno.mp4')); r.cancelPart = fs.existsSync(out('zruseno.pzpart.mp4'));
return r;
