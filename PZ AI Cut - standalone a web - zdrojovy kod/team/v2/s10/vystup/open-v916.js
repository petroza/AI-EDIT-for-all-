const s = TN.app.project.sequences.find((x) => x.name === 's10-v916'); TN.app.openSequence(s.id); TN.app.setPlayhead(1.0); await new Promise((r) => setTimeout(r, 1500)); return 'ok';
