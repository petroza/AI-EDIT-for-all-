const s = TN.app.project.sequences.find((x) => x.name === 's6-multi');
return JSON.stringify((s.captions||[]).slice(0,4).map(c=>[c.start,c.end,c.text,c.ws]));
