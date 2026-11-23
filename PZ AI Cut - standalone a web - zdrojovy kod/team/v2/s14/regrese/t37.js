const fs = require('fs'); const P = TN.app.project;
const F = 'C:/Users/Petr/AppData/Local/Temp/claude/e8748af4ca7f4462/9b93f9a2-8c9d-4cd4-96a5-b0bc52e46c70/scratchpad/s14/proj/s14.pzcut';
const AS = require('path').join(process.env.APPDATA, 'TN_strihatoko', 'autosave.tnproj');
const a = fs.existsSync(AS) ? JSON.parse(fs.readFileSync(AS, 'utf8')) : null;
const s = a && a.sequences.find(x => x.name === 'S14 vyrez 1080');
return { now: Date.now(), pzcutMtime: fs.statSync(F).mtimeMs, autosave: !!a, autosaveMtime: a && fs.statSync(AS).mtimeMs, autosaveOf: a && a.autosaveOf, autosaveMarkers: s && s.markers.length, pzcutMarkers: JSON.parse(fs.readFileSync(F, 'utf8')).sequences.find(x => x.name === 'S14 vyrez 1080').markers.length, dirty: P.dirty, appdata: process.env.APPDATA };
