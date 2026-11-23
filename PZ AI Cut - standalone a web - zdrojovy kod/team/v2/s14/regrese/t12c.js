const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter'); const P = TN.app.project, api = TN.app.api, app = TN.app;
const out = (n) => APP + '/web/test-out/regrese-s14-' + n;
const Vm = P.media.find(m => m.name === 'vyrez-5min.mp4');
const r = {};
const sx = P.sequences.find(x => x.id === window.__s14.id);
r.xf = await X.exportSequence(P, sx, { output: out('crossfade.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(() => 'ok', e => e.message);
// Solo prazdne A2
const b = await api.buildSequence({ name: 'S14 solo', segments: [{ source: Vm.path, in: 20, out: 26 }] });
await new Promise(res => setTimeout(res, 2500));
const s = P.sequences.find(x => x.id === b.sequenceID); s.tracks.audio[1].solo = true;
r.solo = await X.exportSequence(P, s, { output: out('solo-a2.mp4'), range: 'all', format: 'h264', encoder: 'libx264', loudness: 'off' }).then(() => 'ok', e => e.message);
// Match Frame: zdroj s jinymi znackami
const b2 = await api.buildSequence({ name: 'S14 match', segments: [{ source: Vm.path, in: 20, out: 26 }, { source: Vm.path, in: 60, out: 70 }] });
await new Promise(res => setTimeout(res, 2500));
const s2 = P.sequences.find(x => x.id === b2.sequenceID); app.openSequence(s2.id); await new Promise(res => setTimeout(res, 300));
app.openSource(Vm, { at: 100, inPoint: 200, outPoint: 205 }); await new Promise(res => setTimeout(res, 500));
r.srcBefore = [Vm.srcIn, Vm.srcOut];
app.setPlayhead(9.0); app.cmd('matchFrame'); await new Promise(res => setTimeout(res, 800));
const c = s2.tracks.video[0].clips[1];
r.match = { srcIn: app.source.media.srcIn, srcOut: app.source.media.srcOut, time: app.source.time, clip: [c.in, c.out], expectTime: c.in + (9 - c.start) };
return r;
