const a = window.__pzASR; if (!a) return 'no asr';
const P = TN.app.project;
return P.media.map(m => { const t = a.get(m); return { n: m.name, words: t && t.words ? t.words.length : null, sents: t && (t.sentences||t.segments) ? (t.sentences||t.segments).length : null, st: a.status ? a.status(m) : undefined }; }).concat([{ keys: Object.keys(a) }]);
