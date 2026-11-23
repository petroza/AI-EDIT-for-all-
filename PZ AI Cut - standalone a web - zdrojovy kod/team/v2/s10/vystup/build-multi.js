// S8 vystup (kopie S6; po kazdem b-rollu cekani 3 s na automaticky uklid kraju): vicestopa sekvence s5-multi
// 1) V1/A1: TN.app.api.buildSequence (3 vyroky z 28min rozhovoru, audioFades 2)
// 2) V2/A2: b-roll z vyrez-5min pres TN.app.dropMedia(m, in, out, at, overwrite, {video:1, audio:1}) = stejna funkce jako pretazeni z Projektu na V2/A2
//    A2 zesileni -12 dB (clip.gainDb jako okno Zesileni G "Nastavit na")
// 3) A3: hudba mus_stem.wav pres dropMedia(..., {audio:2}), zesileni -18 dB
// 4) Prechody prikazy menu (TN.app.cmd): applyCross na V1 strizich (playhead na strihu, nic nevybrano),
//    applyCross na krajich b-rollu 1 (klip vybrany, playhead u kraje), applyDipBlack na konci sekvence
const V = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4';
const L = 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4';
const app = TN.app, P = app.project, api = app.api;
const med = (n) => P.media.find((m) => m.name === n);
const mL = med('tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4'), mV = med('vyrez-5min.mp4'), mM = med('mus_stem.wav');
const log = {};
const t0 = Date.now();
const r = await api.buildSequence({ name: 's10-multi', audioFades: 2, segments: [{ source: L, in: 1544.4, out: 1574.2 }, { source: L, in: 1596.0, out: 1612.1 }, { source: L, in: 749.52, out: 753.32 }] });
log.build = { dur: r.duration, edge: r.edgeShotsFixed || null, ms: Date.now() - t0, warnings: r.warnings };
const s = P.sequences.find((x) => x.id === r.sequenceID);
app.openSequence(s.id);
const end1 = app.seqDuration ? app.seqDuration(s) : null;
// b-roll
const B = [[8.0, 30.0, 4.0], [27.0, 200.0, 6.0], [40.0, 120.0, 3.0]]; // [na timeline, in ve vyrez-5min, delka]
const bids = [];
for (const [at, inn, d] of B) {
  app.dropMedia(mV, inn, inn + d, at, false, { video: 1, audio: 1 });
  bids.push([...app.sel]); await new Promise((r) => setTimeout(r, 3000)); bids.push((document.querySelector('.toast,#toast,.statusbar,#status') || {}).innerText);
}
// zesileni A2 -12 dB, hudba A3 -18 dB
const endT = Math.max(...s.tracks.video[0].clips.map((c) => c.start + c.out - c.in));
app.dropMedia(mM, 0, endT, 0, false, { audio: 2 });
const musId = [...app.sel];
app.edit('Audio Gain', () => {
  for (const c of s.tracks.audio[1].clips) c.gainDb = -12;
  for (const c of s.tracks.audio[2].clips) c.gainDb = -18;
});
// prolinacky V1 (playhead na strihu, nic nevybrano)
const v1 = s.tracks.video[0].clips.slice().sort((a, b) => a.start - b.start);
const cuts = v1.slice(1).map((c) => c.start);
const tr = [];
for (const t of cuts) { app.sel = new Set(); app.setPlayhead(t); app.cmd('applyCross'); tr.push(['V1 cross', t, (document.querySelector('.statusbar,#status') || {}).innerText]); }
// prolinacka na krajich b-rollu 1 (V2): vybrat klip obrazu, playhead u kraje
const b1 = s.tracks.video[1].clips.find((c) => Math.abs(c.start - 8) < 0.02);
for (const t of [8.0, 12.0]) { app.sel = new Set([b1.id]); app.setPlayhead(t + (t === 8 ? 0.1 : -0.1)); app.cmd('applyCross'); tr.push(['V2 cross', t, (document.querySelector('.statusbar,#status') || {}).innerText]); }
// stmivacka do cerne na konci
app.sel = new Set(); app.setPlayhead(endT); app.cmd('applyDipBlack'); tr.push(['dipBlack end', endT, (document.querySelector('.statusbar,#status') || {}).innerText]);
app.sel = new Set();
log.endT = endT; log.bids = bids; log.toasts = [...document.querySelectorAll('.toast, .toasts *')].map((e) => e.innerText); log.cuts = cuts; log.transitions = tr;
const cl = (t) => t.clips.map((c) => ({ start: +c.start.toFixed(3), end: +(c.start + c.out - c.in).toFixed(3), in: +c.in.toFixed(3), out: +c.out.toFixed(3), gainDb: c.gainDb, fadeIn: c.fadeIn, fadeOut: c.fadeOut, vIn: c.vIn || null, vOut: c.vOut || null, link: c.linkId, media: (P.mediaById(c.mediaId) || {}).name.slice(0, 12) }));
log.seq = { w: s.width, h: s.height, fps: s.fps, video: s.tracks.video.map(cl), audio: s.tracks.audio.map(cl) };
return JSON.stringify(log, null, 1);
