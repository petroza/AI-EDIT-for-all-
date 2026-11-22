const s = TN.app.project.sequences.find((x) => x.name === window.__S3SEQ);
TN.app.openSequence(s.id); await new Promise((r) => setTimeout(r, 300));
await TN.app.api.setPlayhead({ sequence: s.name, time: window.__S3T });
await new Promise((r) => setTimeout(r, 1200));
return s.name + ' @ ' + s.playhead;
