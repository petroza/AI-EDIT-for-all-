const r = await TN.app.api.reframeSequence({ sequence: 's3-sim', name: 's3-sim916-reflow', num: 9, den: 16, faces: false });
const s = TN.app.project.sequences.find((x) => x.id === r.sequenceID);
return JSON.stringify(s.captions.filter((c) => c.end > 27 && c.start < 33).map((c) => [+c.start.toFixed(2), +c.end.toFixed(2), c.text.replace('\n', ' / ')]));
