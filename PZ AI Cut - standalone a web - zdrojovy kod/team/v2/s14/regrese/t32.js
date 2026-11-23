const APP = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod';
const X = require(APP + '/src/core/exporter'); const P = TN.app.project;
const s = P.sequences.find(x => x.name === 'S14 offline2');
const e = await X.exportSequence(P, s, { output: APP + '/web/test-out/regrese-s14-zamceny.mp4', range: 'all', format: 'h264', loudness: 'off' }).then(() => 'EXPORTOVAL', e => e.message);
let cz = e; try { cz = require(APP + '/src/core/lang.js').tr ? require(APP + '/src/core/lang.js').tr(e) : e; } catch (x) {}
return { e, cz, file: require('fs').existsSync(APP + '/web/test-out/regrese-s14-zamceny.mp4') };
