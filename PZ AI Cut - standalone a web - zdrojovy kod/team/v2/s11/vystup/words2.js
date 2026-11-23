// S11: slova, ktera v sekvenci zazni (seqWords = podklad titulku) v okolich problemovych mist + kusy A1
const P = TN.app.project, o = {};
for (const [n, a, b] of [['s11-v916', 44, 50.4], ['s11-sim916', 31, 38], ['s11-multi916-cc', 31, 50.1], ['s11-a11', 0, 16], ['s11-a916', 12.5, 16]]) {
  const s = P.sequences.find((x) => x.name === n); const r = await window.__pzASR.seqWords(s);
  o[n] = { A1: s.tracks.audio[0].clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2)]),
    words: r.words.filter((w) => w.e > a && w.s < b).map((w) => [w.w, +w.s.toFixed(2), +w.e.toFixed(2)]),
    caps: s.captions.filter((c) => c.end > a && c.start < b).map((c) => [+c.start.toFixed(2), +c.end.toFixed(2), c.text.replace(/\n/g, ' / ')]) };
}
return JSON.stringify(o, null, 0);
