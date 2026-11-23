// S11: slova, ktera v kazde sekvenci zazni (window.__pzASR.seqWords = podklad dialogu Titulky z prepisu), casy timeline
const P = TN.app.project, o = {};
for (const s of P.sequences) { if (!/^s11-/.test(s.name)) continue; const r = await window.__pzASR.seqWords(s); o[s.name] = r.words.map((w) => [w.w, +w.s.toFixed(3), +w.e.toFixed(3)]); }
return JSON.stringify(o);
