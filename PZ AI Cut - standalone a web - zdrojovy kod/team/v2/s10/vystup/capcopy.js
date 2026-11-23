// S10: kopie s10-multi916 (Auto Reframe z menu = zvuk A1 rozriznuty na 7 kusu) bez titulku -> titulky dialogem po reframu (doporuceny postup)
const P = TN.app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
P.edit('S10 cc', () => { const s = JSON.parse(JSON.stringify(P.sequences.find((x) => x.name === 's10-multi916'))); s.id = U.uuid(); s.name = 's10-multi916-cc'; const lm = {}; for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) { c.id = U.uid('c'); if (c.linkId) c.linkId = lm[c.linkId] = lm[c.linkId] || U.uid('l'); } s.captions = []; P.addSequence(s); });
window.__S10SEQS = ['s10-multi916-cc']; return 'ok';
