const P = TN.app.project, o = {};
for (const s of P.sequences) for (const k of ['video']) s.tracks[k].forEach((t, ti) => t.clips.forEach((c) => { if (c.hold) (o[s.name] = o[s.name] || []).push([ti, +c.start.toFixed(3), +(c.start + c.out - c.in).toFixed(3), +c.in.toFixed(3), +c.out.toFixed(3), c.hold]); }));
return JSON.stringify(o);
