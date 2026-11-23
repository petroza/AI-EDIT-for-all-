const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter'); const P = TN.app.project, api = TN.app.api, E = TN.app.editCore;
const out = (n) => APP + '/web/test-out/regrese-s14-' + n;
const BIG = P.media.find(m => /BARBOROU/.test(m.name)).path;
const dump = (s) => s.tracks.video.slice(0,1).map((t, i) => 'V' + (i+1) + ': ' + t.clips.map(c => `${c.start.toFixed(2)}[${c.in.toFixed(3)}-${c.out.toFixed(3)}]${c.hold ? ' hold' + JSON.stringify(c.hold) : ''}`).join(' | ')).concat(s.tracks.audio.slice(0,1).map((t) => 'A1: ' + t.clips.map(c => `${c.start.toFixed(2)}[${c.in.toFixed(3)}-${c.out.toFixed(3)}]`).join(' | ')));
async function mkH(name) {
  const b = await api.buildSequence({ name, segments: [{ source: BIG, in: 1544.40, out: 1549.00 }, { source: BIG, in: 1263.60, out: 1265.12 }] });
  await new Promise(res => setTimeout(res, 4000));
  const s = P.sequences.find(x => x.id === b.sequenceID); TN.app.openSequence(s.id); await new Promise(res => setTimeout(res, 300)); return s;
}
const r = {};
let s = await mkH('S14 h'); r.h = dump(s);
// Ctrl+K uvnitr hold
s = await mkH('S14 h-k'); s.playhead = 6.04; TN.app.sel.clear(); TN.app.cmd('addEdit'); r.hk = dump(s);
r.hkExp = await X.exportSequence(P, s, { output: out('h-k.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(() => 'ok', e => e.message);
// W uvnitr hold
s = await mkH('S14 h-w'); s.playhead = 6.04; TN.app.sel.clear(); TN.app.cmd('rippleTrimNext'); r.hw = dump(s);
r.hwExp = await X.exportSequence(P, s, { output: out('h-w.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(() => 'ok', e => e.message);
// Shift+Delete klipu s hold
s = await mkH('S14 h-del'); const c2 = s.tracks.video[0].clips[1]; TN.app.sel = new Set([c2.id, s.tracks.audio[0].clips[1].id]); TN.app.cmd('rippleDelete'); r.hdel = dump(s); r.hdelDur = TN.app.seqDuration(s);
// Delete (bez posunu) klipu s hold
s = await mkH('S14 h-del2'); const d2 = s.tracks.video[0].clips[1]; TN.app.sel = new Set([d2.id]); TN.app.cmd('delete'); r.hdel2 = dump(s);
return r;
