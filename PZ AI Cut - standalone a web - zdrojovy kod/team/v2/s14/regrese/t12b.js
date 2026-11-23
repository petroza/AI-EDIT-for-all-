const P = TN.app.project, api = TN.app.api, E = TN.app.editCore, app = TN.app;
const Vm = P.media.find(m => m.name === 'vyrez-5min.mp4');
const b = await api.buildSequence({ name: 'S14 ctrl-shift-d', segments: [{ source: Vm.path, in: 20, out: 26 }, { source: Vm.path, in: 40, out: 45 }, { source: Vm.path, in: 60, out: 70 }] });
await new Promise(res => setTimeout(res, 3500));
const s = P.sequences.find(x => x.id === b.sequenceID); app.openSequence(s.id); await new Promise(r => setTimeout(r, 300));
app.sel.clear(); app.setPlayhead(11.0); app.focusPanel('timeline');
window.__s14 = { id: s.id };
return s.tracks.audio[0].clips.map(c => ({ st: c.start, fi: c.fadeIn, fo: c.fadeOut, xIn: c.xIn }));
