const P = TN.app.project, app = TN.app, E = app.editCore;
const id = P.sequences.find(x => x.name === 'S14 sd-titulky').id;
app.openSequence(id); await new Promise(r => setTimeout(r, 200));
const S = () => P.sequences.find(x => x.id === id);
const st = () => { const s = S(); return JSON.stringify({ t: s.tracks, c: s.captions, m: s.markers }); };
const a = st();
const s = S(); app.sel = new Set(E.linked(s, s.tracks.video[0].clips[0]).map(c => c.id)); app.cmd('rippleDelete');
const b = st(); app.cmd('undo'); const c = st(); app.cmd('redo'); const d = st();
return { editChanged: a !== b, undoRestores: a === c, redoRestores: b === d };
