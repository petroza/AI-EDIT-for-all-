const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter');
const P = TN.app.project, api = TN.app.api;
const byName = (n) => P.media.find(m => m.name === n);
const out = (n) => APP + '/web/test-out/regrese-s14-' + n;
const res = {};
async function mk(name, segs) { const r = await api.buildSequence({ name, segments: segs }); return P.sequences.find(s => s.id === r.sequenceID); }
async function ex(seq, n, o) { const t0 = Date.now(); try { const r = await X.exportSequence(P, seq, Object.assign({ output: out(n), range: 'all', burnCaptions: true, srtSidecar: false, encoder: 'libx264', format: 'h264', loudness: 'off' }, o)); return { ok: true, out: r.output, s: (Date.now()-t0)/1000 }; } catch (e) { return { err: e.message }; } }
const V = byName('vyrez-5min.mp4').path;
// hlasitost a formaty z rozhovoru
const sv = await mk('S14 vyrez 16s', [{ source: V, in: 100, out: 108 }, { source: V, in: 150, out: 158 }]);
res.tvmp4 = await ex(sv, 'tv.mp4', { loudness: 'tv' });
res.socmp4 = await ex(sv, 'social.mp4', { loudness: 'social' });
res.xdcam = await ex(sv, 'xdcam.mxf', { format: 'xdcam', loudness: 'tv', burnCaptions: false });
res.dnxhr = await ex(sv, 'dnxhr.mxf', { format: 'dnxhr', loudness: 'tv', burnCaptions: false });
res.xdcamOk_720 = X.xdcamOk(sv); // sekvence 1280x720 25p
res.seqSize = [sv.width, sv.height, sv.fps];
// formaty
const sa = await mk('S14 anam', [{ source: byName('anam.mp4').path, in: 0, out: 4 }]); res.anamSeq = [sa.width, sa.height]; res.anam = await ex(sa, 'anam.mp4', {});
const s2 = await mk('S14 2mono', [{ source: byName('a_2mono.mp4').path, in: 0, out: 6 }]); res.mono2 = await ex(s2, '2mono.mp4', {});
const si = await mk('S14 img', [{ source: byName('img.png').path, in: 0, out: 5 }]); res.img = await ex(si, 'img.mp4', {});
const sm = await mk('S14 mp3', [{ source: byName('au.mp3').path, in: 3, out: 5 }, { source: byName('au.mp3').path, in: 6, out: 8 }]); res.mp3 = await ex(sm, 'mp3.mp4', {});
const s29 = await mk('S14 2997', [{ source: byName('v2997.mp4').path, in: 0, out: 6.006 }]); res.s29fps = s29.fps; res.xdcamOk_2997 = X.xdcamOk(s29); res.v2997 = await ex(s29, '2997-social.mp4', { loudness: 'social' });
const s25i = await mk('S14 i25', [{ source: byName('i25.mp4').path, in: 0, out: 4 }]); res.i25 = await ex(s25i, 'i25.mxf', { format: 'xdcam', burnCaptions: false });
res.i25media = { interlaced: byName('i25.mp4').interlaced };
const snz = await mk('S14 bez zvuku', [{ source: byName('bezzvuku.mp4').path, in: 0, out: 5 }]); res.noaudio = await ex(snz, 'bezzvuku.mxf', { format: 'xdcam', burnCaptions: false });
res.mono2media = byName('a_2mono.mp4').audioStreams;
return res;
