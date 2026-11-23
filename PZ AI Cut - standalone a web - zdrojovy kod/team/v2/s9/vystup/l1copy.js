// S9 (b): kopie 9:16 sekvenci se stylem titulku 1 radek (jako okno Text v obraze: Radky 1), titulky smazane -> pak dialog Titulky z prepisu
const app = TN.app, P = app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util'), CL = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/captionlayout');
const out = [];
for (const n of ['s9-sim916', 's9-a916', 's9-v916', 's9-multi916']) {
  const src = P.sequences.find((x) => x.name === n);
  P.edit('S9 L1', () => { const s = JSON.parse(JSON.stringify(src)); s.id = U.uuid(); s.name = n + '-L1'; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) c.id = U.uid('c'); s.captions = []; s.captionStyle = Object.assign({}, CL.styleOf(src), { lines: 1 }); P.addSequence(s); out.push([s.name, JSON.stringify(s.captionStyle)]); });
}
window.__S9SEQS = out.map((x) => x[0]);
return JSON.stringify(out);
