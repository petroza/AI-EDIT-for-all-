return { keys: Object.keys(TN.app).slice(0,120), cmds: Object.keys(TN.app.commands||{}).length, ver: process.versions.electron, seqs: TN.app.project.sequences.length };
