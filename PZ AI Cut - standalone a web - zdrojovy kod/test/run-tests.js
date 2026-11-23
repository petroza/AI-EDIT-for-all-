'use strict';
// Testy jádra bez UI: node test/run-tests.js [cesta k videu pro test exportu]
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { Project, newSequence, newClip, clipEnd } = require('../src/core/model');
const E = require('../src/core/edit');
const { createApi, parseSrt } = require('../src/core/pmcp-api');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); ok++; console.log('✔ ' + name); } catch (e) { fail++; console.log('✖ ' + name + '\n   ' + (e.stack || e).split('\n').slice(0, 3).join('\n   ')); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, `${msg || ''} ${a} ≠ ${b}`);
const M = { id: 'm1', name: 'a.mp4', path: 'C:/x/a.mp4', duration: 100, hasVideo: true, hasAudio: true, width: 1920, height: 1080, fps: 25 };

function seqWith(...ranges) {
  const s = newSequence({ fps: 25 });
  let at = 0;
  for (const [i, o] of ranges) { E.editFromSource(s, M, i, o, at, 'overwrite'); at += o - i; }
  return s;
}

(async () => {
  await t('overwrite + linked A/V', () => {
    const s = seqWith([0, 10]);
    assert.strictEqual(s.tracks.video[0].clips.length, 1);
    assert.strictEqual(s.tracks.audio[0].clips.length, 1);
    assert.ok(s.tracks.video[0].clips[0].linkId && s.tracks.video[0].clips[0].linkId === s.tracks.audio[0].clips[0].linkId);
  });
  await t('razor rozdělí obě stopy a zachová propojení vpravo', () => {
    const s = seqWith([0, 10]);
    E.razor(s, 4);
    const v = s.tracks.video[0].clips, a = s.tracks.audio[0].clips;
    assert.strictEqual(v.length, 2); assert.strictEqual(a.length, 2);
    near(v[1].start, 4); near(v[1].in, 4); near(v[0].out, 4);
    assert.strictEqual(v[1].linkId, a[1].linkId);
    assert.notStrictEqual(v[0].linkId, v[1].linkId);
  });
  await t('insert odsune zbytek', () => {
    const s = seqWith([0, 10]);
    E.editFromSource(s, M, 50, 52, 5, 'insert');
    const v = s.tracks.video[0].clips.map((c) => [c.start, clipEnd(c), c.in]);
    assert.deepStrictEqual(v.map((x) => x.map((y) => Math.round(y * 100) / 100)), [[0, 5, 0], [5, 7, 50], [7, 12, 5]]);
  });
  await t('overwrite uprostřed rozdělí klip', () => {
    const s = seqWith([0, 10]);
    E.editFromSource(s, M, 50, 52, 3, 'overwrite');
    const v = s.tracks.video[0].clips.map((c) => [c.start, clipEnd(c)]);
    assert.deepStrictEqual(v, [[0, 3], [3, 5], [5, 10]]);
  });
  await t('extract (ripple) zavře mezeru na všech stopách', () => {
    const s = seqWith([0, 10], [20, 30]);
    E.extractRange(s, 2, 4);
    near(Math.max(...s.tracks.video[0].clips.map(clipEnd)), 18);
    near(Math.max(...s.tracks.audio[0].clips.map(clipEnd)), 18);
  });
  await t('ripple delete klipu', () => {
    const s = seqWith([0, 10], [20, 30], [40, 45]);
    const mid = s.tracks.video[0].clips[1];
    E.removeClips(s, E.linked(s, mid).map((c) => c.id), true);
    const v = s.tracks.video[0].clips.map((c) => [c.start, c.in]);
    assert.deepStrictEqual(v, [[0, 0], [10, 40]]);
    assert.strictEqual(s.tracks.audio[0].clips.length, 2);
  });
  await t('trim konce bez ripple nepřesáhne souseda', () => {
    const s = seqWith([0, 10], [20, 30]);
    const c = s.tracks.video[0].clips[0];
    E.trimEdge(s, c.id, 'out', 15, { mediaDuration: () => 100 });
    near(clipEnd(c), 10);
    E.trimEdge(s, c.id, 'out', 8, { mediaDuration: () => 100 });
    near(clipEnd(c), 8);
    near(clipEnd(s.tracks.audio[0].clips[0]), 8, 'propojený zvuk');
  });
  await t('ripple trim začátku posune zbytek', () => {
    const s = seqWith([0, 10], [20, 30]);
    const c = s.tracks.video[0].clips[0];
    E.trimEdge(s, c.id, 'in', 2, { ripple: true, mediaDuration: () => 100 });
    near(c.start, 0); near(c.in, 2); near(clipEnd(c), 8);
    near(s.tracks.video[0].clips[1].start, 8);
  });
  await t('Q/W ripple trim k playheadu', () => {
    const s = seqWith([0, 10], [20, 30]);
    E.rippleTrimToPlayhead(s, 13, 'prev');
    near(s.tracks.video[0].clips[1].start, 10); near(s.tracks.video[0].clips[1].in, 23);
    E.rippleTrimToPlayhead(s, 15, 'next');
    near(Math.max(...s.tracks.video[0].clips.map(clipEnd)), 15);
  });
  await t('move přepíše cíl', () => {
    const s = seqWith([0, 10], [20, 30]);
    const c = s.tracks.video[0].clips[1];
    E.moveClips(s, E.linked(s, c).map((x) => x.id), -5);
    const v = s.tracks.video[0].clips.map((x) => [x.start, clipEnd(x)]);
    assert.deepStrictEqual(v, [[0, 5], [5, 15]]);
  });
  await t('Rolling Edit posune střih, délka sekvence stejná', () => {
    const s = seqWith([0, 10], [20, 30]);
    const [a, b] = s.tracks.video[0].clips;
    E.rollEdit(s, a.id, b.id, 2, { mediaDuration: () => 100 });
    near(clipEnd(a), 12); near(b.start, 12); near(b.in, 22); near(clipEnd(b), 20);
    near(clipEnd(s.tracks.audio[0].clips[0]), 12, 'zvuk');
  });
  await t('Slip posune obsah, poloha stejná', () => {
    const s = seqWith([10, 20]);
    const c = s.tracks.video[0].clips[0];
    E.slipClip(s, c.id, -3, { mediaDuration: () => 100 });
    near(c.start, 0); near(c.in, 7); near(c.out, 17); near(s.tracks.audio[0].clips[0].in, 7);
    E.slipClip(s, c.id, -50, { mediaDuration: () => 100 });
    near(c.in, 0, 'nepřeteče před začátek média');
  });
  await t('Track Select Forward', () => {
    const s = seqWith([0, 10], [20, 30], [40, 45]);
    assert.strictEqual(E.clipsFrom(s, 12).length, 4);
  });
  await t('undo/redo', () => {
    const p = new Project();
    p.addSequence(seqWith([0, 10]));
    const s = p.activeSequence();
    p.edit('řez', () => E.razor(s, 5));
    assert.strictEqual(p.activeSequence().tracks.video[0].clips.length, 2);
    p.undo();
    assert.strictEqual(p.activeSequence().tracks.video[0].clips.length, 1);
    p.redo();
    assert.strictEqual(p.activeSequence().tracks.video[0].clips.length, 2);
  });
  await t('SRT parser', () => {
    const c = parseSrt('1\n00:00:01,000 --> 00:00:02,500\nAhoj\nsvěte\n\n2\n00:00:03,000 --> 00:00:04,000\nDruhý\n');
    assert.strictEqual(c.length, 2); near(c[0].end, 2.5); assert.strictEqual(c[0].text, 'Ahoj\nsvěte');
  });

  const video = process.argv[2];
  if (video && fs.existsSync(video)) {
    const p = new Project();
    const api = createApi(p);
    await t('API buildSequence + getSequence na skutečném videu', async () => {
      const r = await api.buildSequence({ name: 'TEST', audioFades: 2, segments: [{ source: video, in: 10.03, out: 13.51 }, { source: video, in: 30, out: 32 }] });
      assert.strictEqual(r.segments, 2);
      assert.strictEqual(r.audioFades, 4);
      const g = api.getSequence({ sequence: r.sequenceID });
      assert.strictEqual(g.clips.length, 4);
      near(g.clips[0].inPoint, 10.0); near(g.clips[0].outPoint, 13.52);
      near(g.duration, 5.52);
    });
    await t('API removeRanges ripple', async () => {
      const r = api.removeRanges({ ranges: [{ start: 1, end: 2 }] });
      near(r.duration, 4.52);
    });
    await t('detekce střihů obrazu (ffmpeg)', async () => {
      const r = await api.detectSceneCuts({ source: video, ranges: [{ from: 0, to: 30 }] });
      assert.ok(Array.isArray(r.cuts));
      console.log('   střihy:', r.cuts.join(', ') || '(žádné)');
    });
    await t('export MP4', async () => {
      const out = path.join(require('../src/core/media').CACHE, 'export', 'test-export.mp4');
      const t0 = Date.now();
      const r = await api.exportSequence({ output: out });
      const pr = await require('../src/core/media').probe(out);
      console.log(`   ${r.sizeMB} MB, ${pr.duration.toFixed(3)} s, ${pr.width}×${pr.height}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      near(Math.round(pr.duration * 25) / 25, 4.52);
      assert.ok(pr.hasAudio && pr.hasVideo);
    });
    await t('přechody + exporty všech formátů', async () => {
      const r = await api.buildSequence({ name: 'TRANS', segments: [{ source: video, in: 100, out: 103 }, { source: video, in: 200, out: 203 }, { source: video, in: 300, out: 303 }] });
      const s = p.seqById(r.sequenceID);
      const md = () => 2000;
      const a = E.applyTransitionAt(s, 3, 'cross', 1, undefined, md);
      const b = E.applyTransitionAt(s, 6, 'dipBlack', 1, undefined, md);
      E.applyTransitionAt(s, 0, 'dipBlack', 0.5, undefined, md);
      assert.strictEqual(a.applied, 1); assert.strictEqual(b.applied, 1);
      assert.strictEqual(s.tracks.video[0].clips[1].vIn.type, 'cross');
      const media = require('../src/core/media');
      const ex = require('../src/core/exporter');
      const segs = ex.videoSegments(s, 0, 9);
      assert.ok(segs.some((x) => x.cross), 'segment s prolínačkou');
      for (const fmt of ['h264', 'h265', 'prores_hq', 'mov_h264', 'xdcam', 'dnxhr']) {
        const t0 = Date.now();
        const out = path.join(media.CACHE, 'export', 'fmt-' + fmt + '.' + ex.FORMATS[fmt].ext);
        const res = await ex.exportSequence(p, s, { output: out, format: fmt, loudness: fmt === 'h264' ? 'social' : 'off' });
        const { out: o } = await media.run(media.FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt,channels:format=duration', '-of', 'compact', res.output]);
        const info = String(o).trim().replace(/\r?\n/g, ' | ');
        console.log(`   ${fmt}: ${res.sizeMB} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s · ${info}`);
        const dur = Number((String(o).match(/duration=([\d.]+)/) || [])[1]);
        assert.ok(Math.abs(dur - 9) < 0.1, fmt + ' délka ' + dur);
      }
      // snímek uprostřed prolínačky a ve zatmívačce
      const mp4 = path.join(media.CACHE, 'export', 'fmt-h264.mp4');
      await media.run(media.FFMPEG, ['-y', '-v', 'error', '-ss', '3', '-i', mp4, '-frames:v', '1', '-vf', 'scale=320:-2', mp4.replace('.mp4', '-cross.jpg')]);
      await media.run(media.FFMPEG, ['-y', '-v', 'error', '-ss', '5.98', '-i', mp4, '-frames:v', '1', '-vf', 'scale=320:-2', mp4.replace('.mp4', '-dip.jpg')]);
      console.log('   náhledy:', mp4.replace('.mp4', '-cross.jpg'), mp4.replace('.mp4', '-dip.jpg'));
    });
    await t('reframe 9:16', async () => {
      const src = p.sequences[0];
      const r = await api.reframeSequence({ sequence: src.id, num: 9, den: 16, width: 1080, height: 1920 });
      assert.strictEqual(r.width, 1080);
      const s = p.seqById(r.sequenceID);
      assert.ok(s.tracks.video[0].clips.every((c) => c.fit === 'cover'));
      console.log(`   záběrů ${r.shots}, střihů kamery ${r.cameraSplits}, obličej v ${r.facesFound}; posX ${s.tracks.video[0].clips.map((c) => c.posX.toFixed(2)).join(', ')}`);
      assert.ok(r.facesFound > 0, 'obličej nenalezen');
      const out = path.join(require('../src/core/media').CACHE, 'export', 'test-916.mp4');
      await api.exportSequence({ sequence: s.id, output: out });
      await require('../src/core/media').run(require('../src/core/media').FFMPEG, ['-y', '-v', 'error', '-ss', '1', '-i', out, '-frames:v', '1', '-vf', 'scale=270:-2', out.replace('.mp4', '.jpg')]);
      console.log('   náhled:', out.replace('.mp4', '.jpg'));
    });
  }
  // kolo 1: hranice věty v pauze a slova sekvence z přepisu (web/ai/transcripts.js)
  const TR = require('../web/ai/transcripts');
  await t('hranice: 20ms ticho uvnitř slova není pauza, bere se skutečná pauza', () => {
    // 2 s zvuku 16 kHz: slovo 0–0,8 s (s 25ms dírou v 0,5 s), pauza 0,8–1,0 s, slovo 1,0–2,0 s
    const x = new Float32Array(32000);
    for (let i = 0; i < x.length; i++) { const t0 = i / 16000; const speech = (t0 < 0.8 && !(t0 > 0.5 && t0 < 0.525)) || t0 >= 1.0; x[i] = speech ? 0.3 * Math.sin(i * 0.2) : 0.0005 * Math.sin(i * 0.37); }
    const thr = 0.3 / Math.SQRT2 * Math.pow(10, -15 / 20);
    // konec slova odhadnutý na 0,55 s (uvnitř slova, u díry): úzké okno [0,45; 0,8] → pauza musí být až za 0,8 s
    const r = TR.pauseNear(x, 0, 0.45, 0.8, 1.3, 1, thr);
    assert.ok(r.ok && r.t > 0.8 && r.t < 1.0, 'hranice ' + r.t.toFixed(3));
    // začátek odhadnutý na 1,1 s (uvnitř druhého slova): hledá dřív → pauza 0,8–1,0
    const q = TR.pauseNear(x, 0, 1.05, 1.2, 0.3, -1, thr);
    assert.ok(q.ok && q.t > 0.8 && q.t < 1.0, 'začátek ' + q.t.toFixed(3));
    // souvislá řeč bez pauzy → ok: false (panel radí přidat větu)
    const y = new Float32Array(32000).map((v, i) => 0.3 * Math.sin(i * 0.2));
    assert.strictEqual(TR.pauseNear(y, 0, 0.5, 0.8, 1.5, 1, thr).ok, false);
  });
  await t('titulky z přepisu: jen slova, která v klipu zazní, v čase sekvence', () => {
    const tr = { words: [{ w: 'Ahoj', s: 9.5, e: 9.9 }, { w: 'jak', s: 10.0, e: 10.3 }, { w: '-', s: 10.3, e: 10.35 }, { w: '- se', s: 10.4, e: 10.7 }, { w: 'máš', s: 10.8, e: 11.4 }, { w: 'dnes', s: 11.6, e: 12.0 }] };
    const ws = TR.clipWords(tr, { start: 5, in: 10, out: 11.5 });
    assert.deepStrictEqual(ws.map((w) => w.w), ['jak', 'se', 'máš']);
    near(ws[0].s, 5); near(ws[2].e, 6.4);
  });
  await t('hák: začátek 0,15 s před nástupem řeči, konec s dozněním 0,2 s (ne do další řeči)', () => {
    // pauza 0–0,9 s, řeč 0,9–2,0, pauza 2,0–2,25, řeč od 2,25
    const x = new Float32Array(48000);
    for (let i = 0; i < x.length; i++) { const t0 = i / 16000; const sp = (t0 >= 0.9 && t0 < 2.0) || t0 >= 2.25; x[i] = sp ? 0.3 * Math.sin(i * 0.2) : 0.0005 * Math.sin(i * 0.37); }
    const thr = 0.3 / Math.SQRT2 * Math.pow(10, -15 / 20);
    const tin = TR.tightenIn(x, 0, 0.1, thr);
    assert.ok(tin > 0.7 && tin < 0.8, 'In ' + tin.toFixed(3));
    const tout = TR.tightenOut(x, 0, 2.1, thr);
    assert.ok(tout > 2.08 && tout <= 2.2, 'Out ' + tout.toFixed(3));
  });
  await t('karaoke: první slovo fráze začne s řečí, slovo v tichu vypadne', () => {
    const x = new Float32Array(48000);
    for (let i = 0; i < x.length; i++) { const t0 = i / 16000; x[i] = (t0 >= 0.9 && t0 < 2.4) ? 0.3 * Math.sin(i * 0.2) : 0.0005 * Math.sin(i * 0.37); }
    const thr = 0.3 / Math.SQRT2 * Math.pow(10, -15 / 20);
    const ws = [{ w: 'to.', s: 0.1, e: 0.35 }, { w: 'Tady', s: 0.5, e: 0.9 }, { w: 'není', s: 0.9, e: 1.4 }, { w: 'jiná', s: 1.4, e: 2.4 }];
    const r = TR.speechAlign(ws, x, 0, thr);
    assert.deepStrictEqual(r.map((w) => w.w), ['Tady', 'není', 'jiná']);
    // vyslovené slovo s nepřesným časem (v tichu podle přepisu) nevypadne – jen konec předchozí věty
    const r2 = TR.speechAlign([{ w: 'Tak', s: 0.3, e: 0.5 }, { w: 'neříká', s: 0.9, e: 1.4 }, { w: 'se', s: 1.4, e: 2.4 }], x, 0, thr);
    assert.deepStrictEqual(r2.map((w) => w.w), ['Tak', 'neříká', 'se']);
    assert.ok(Math.abs(r[0].s - 0.9) < 0.05, 'Tady ' + r[0].s.toFixed(3));
    near(r[2].e, 2.4);
  });
  await t('titulky: úlomek předchozí věty v pauze na začátku klipu vypadne, vyslovené slovo zůstane', () => {
    // řeč 0,9–2,4 s; klip od 0,6 s. „to.“ (konec předchozí věty) časované do pauzy 0,62–0,8 s
    const x = new Float32Array(48000);
    for (let i = 0; i < x.length; i++) { const t0 = i / 16000; x[i] = (t0 >= 0.9 && t0 < 2.4) ? 0.3 * Math.sin(i * 0.2) : 0.0005 * Math.sin(i * 0.37); }
    const thr = 0.3 / Math.SQRT2 * Math.pow(10, -15 / 20);
    const sents = [{ w0: 0, w1: 2 }, { w0: 3, w1: 5 }];
    const ws = [{ w: 'zvládáš', s: 0.0, e: 0.3, k: 1 }, { w: 'to.', s: 0.62, e: 0.8, k: 2 }, { w: 'Tady', s: 0.95, e: 1.2, k: 3 }, { w: 'není', s: 1.2, e: 1.6, k: 4 }, { w: 'jiná', s: 1.6, e: 2.3, k: 5 }];
    const r = TR.dropEdgeFragments(ws, sents, { in: 0.6, out: 2.5 }, x, 0, thr);
    assert.deepStrictEqual(r.filter((w) => (w.s + w.e) / 2 >= 0.6).map((w) => w.w), ['Tady', 'není', 'jiná']);
    // dlouhá slepená věta: In v pauze, ale před hlavní větou ještě zazní slovo úlomku („Tak“ v 0,95 s) → zůstane
    const ws3 = [{ w: 'doporučila', s: 0.0, e: 0.3, k: 1 }, { w: 'Tak', s: 0.95, e: 1.1, k: 2 }, { w: 'Tady', s: 1.3, e: 1.5, k: 3 }, { w: 'není', s: 1.5, e: 1.9, k: 4 }, { w: 'jiná', s: 1.9, e: 2.3, k: 5 }];
    assert.ok(TR.dropEdgeFragments(ws3, [{ w0: 0, w1: 2 }, { w0: 3, w1: 5 }], { in: 0.6, out: 2.5 }, x, 0, thr).some((w) => w.w === 'Tak'));
    // ruční střih uprostřed řeči (In 0,95 s v řeči): úlomek předchozí věty je slyšet → zůstane
    const ws2 = ws.map((w) => (w.w === 'to.' ? Object.assign({}, w, { s: 0.96, e: 1.05 }) : w.w === 'Tady' ? Object.assign({}, w, { s: 1.06 }) : w));
    assert.ok(TR.dropEdgeFragments(ws2, sents, { in: 0.95, out: 2.5 }, x, 0, thr).some((w) => w.w === 'to.'));
  });
  await t('kraje výroku: „to.“ na konci zazní → zůstane; „stalo.“ z předchozí věty v pauze → vypadne', () => {
    // řeč 0,9–2,0 (věta B) a 2,05–2,2 („to.“ – konec věty B podle zvuku, přepis ho dal do věty C); pauza 2,2–2,5, Out 2,45
    const x = new Float32Array(48000);
    for (let i = 0; i < x.length; i++) { const t0 = i / 16000; x[i] = ((t0 >= 0.9 && t0 < 2.0) || (t0 >= 2.05 && t0 < 2.2)) ? 0.3 * Math.sin(i * 0.2) : 0.0005 * Math.sin(i * 0.37); }
    const thr = 0.3 / Math.SQRT2 * Math.pow(10, -15 / 20);
    const sents = [{ w0: 0, w1: 1 }, { w0: 2, w1: 4 }, { w0: 5, w1: 7 }];
    const ws = [{ w: 'co', s: 0.2, e: 0.4, k: 0 }, { w: 'stalo.', s: 0.62, e: 0.85, k: 1 }, { w: 'Ty', s: 0.9, e: 1.1, k: 2 }, { w: 'musíš', s: 1.1, e: 1.5, k: 3 }, { w: 'zvládnout', s: 1.5, e: 2.0, k: 4 },
      { w: 'to.', s: 2.05, e: 2.2, k: 5 }, { w: 'A', s: 2.7, e: 2.8, k: 6 }, { w: 'jediné', s: 2.8, e: 2.95, k: 7 }];
    const r = TR.dropEdgeFragments(ws, sents, { in: 0.75, out: 2.45 }, x, 0, thr).filter((w) => (w.s + w.e) / 2 >= 0.75 && (w.s + w.e) / 2 < 2.45).map((w) => w.w);
    assert.deepStrictEqual(r, ['Ty', 'musíš', 'zvládnout', 'to.']);
  });
  // kolo 4 (review-3): časy slov přepisu bývají proti zvuku pozdě o 0,1–0,6 s → o krajích rozhoduje pauza ve zvuku
  const sig = (spans) => { const x = new Float32Array(16000 * 5); for (let i = 0; i < x.length; i++) { const u = i / 16000; x[i] = spans.some(([a, b]) => u >= a && u < b) ? 0.3 * Math.sin(i * 0.2) : 0.0005 * Math.sin(i * 0.37); } return x; };
  await t('titulky: slovo před In v krátkém hlubokém propadu (přepis pozdě o 0,3 s) → bez titulku (výrok 23:20 „stalo.“)', async () => {
    // zvuk: „…vlastně stalo“ 0,2–1,70, mezera 60 ms, „Ale jako to uvědomění“ 1,76–3,0, pauza do 3,6
    const x = sig([[0.2, 1.7], [1.76, 3.0], [3.6, 4.5]]);
    const words = [{ w: 'vlastně', s: 1.37, e: 1.70 }, { w: 'stalo.', s: 1.73, e: 2.02 }, { w: 'Ale', s: 2.04, e: 2.24 }, { w: 'jako', s: 2.26, e: 2.51 },
      { w: 'to', s: 2.53, e: 2.68 }, { w: 'uvědomění.', s: 2.69, e: 3.25 }, { w: 'Zrovna', s: 3.9, e: 4.3 }];
    const tr = { words, duration: 5, sentences: TR.sentences(words), model: 'onnx-community/whisper-large-v3-turbo_timestamped' };
    const r = await TR.clipCaptionWords({ pcm16k: x }, tr, { in: 1.73, out: 3.25, start: 0 });
    assert.deepStrictEqual(r.map((w) => w.w), ['Ale', 'jako', 'to', 'uvědomění.']);
  });
  await t('titulky: poslední slovo, které podle přepisu leží za Out (přepis pozdě o 0,6 s), zazní → zůstane (V5 „to.“)', async () => {
    // zvuk: věta 0,5–2,0 (končí „…zvládnout to.“), pauza 2,0–2,6, další věta od 2,6; Out 2,2
    const x = sig([[0.5, 2.0], [2.6, 3.5]]);
    const words = [{ w: 'My', s: 0.6, e: 0.8 }, { w: 'se', s: 0.8, e: 1.0 }, { w: 'musíme', s: 1.0, e: 1.85 }, { w: 'zvládnout', s: 1.9, e: 2.45 },
      { w: 'to.', s: 2.5, e: 2.8 }, { w: 'Když', s: 2.82, e: 3.1 }, { w: 'jsem', s: 3.1, e: 3.4 }];
    const tr = { words, duration: 5, sentences: TR.sentences(words) };
    const r = await TR.clipCaptionWords({ pcm16k: x }, tr, { in: 0.35, out: 2.2, start: 0 });
    assert.deepStrictEqual(r.map((w) => w.w), ['My', 'se', 'musíme', 'zvládnout', 'to.']);
    assert.ok(r[r.length - 1].e <= 2.2 + 1e-9, 'konec titulku za Out');
  });
  await t('titulky: první slovo věty po nádechu („tak“ / „Takže“) nevypadne, když nádech přepis posune', async () => {
    // zvuk: „…stalo,“ do 0,38, ticho, nádech 0,48–0,62 (slabší), hluboký propad, „tak neříkat…“ od 0,70
    const x = sig([[0.0, 0.38], [0.70, 2.5]]);
    for (let i = Math.round(0.48 * 16000); i < 0.62 * 16000; i++) x[i] = 0.06 * Math.sin(i * 0.9);
    const words = [{ w: 'stalo,', s: 0.06, e: 0.57 }, { w: 'tak', s: 0.75, e: 1.05 }, { w: 'neříkat', s: 1.07, e: 1.66 }, { w: 'tyhle', s: 1.7, e: 2.1 }, { w: 'věci.', s: 2.1, e: 2.5 }];
    const tr = { words, duration: 5, sentences: TR.sentences(words) };
    const r = await TR.clipCaptionWords({ pcm16k: x }, tr, { in: 0.66, out: 2.6, start: 0 });
    assert.deepStrictEqual(r.map((w) => w.w), ['tak', 'neříkat', 'tyhle', 'věci.']);
  });
  await t('hranice v souvislé řeči: varování podle zvuku, ne podle časů přepisu (cutBounds.inOk)', async () => {
    // hluboký 60ms propad mezi větami = čistá hranice (bez varování); střih uprostřed souvislé řeči = varování
    const x = sig([[0.2, 1.7], [1.76, 3.0], [3.6, 4.5]]);
    const words = [{ w: 'stalo.', s: 1.3, e: 1.72 }, { w: 'Ale', s: 1.8, e: 2.0 }, { w: 'jako', s: 2.0, e: 2.95 }, { w: 'Zrovna', s: 3.7, e: 4.4 }];
    const tr = { words, duration: 5, sentences: TR.sentences(words) };
    const b = await TR.cutBounds({ pcm16k: x }, tr, 1, 2);
    assert.ok(b.inOk && b.outOk, JSON.stringify(b));
    const y = sig([[0.2, 4.5]]);
    const b2 = await TR.cutBounds({ pcm16k: y }, tr, 1, 2);
    assert.ok(!b2.inOk, 'souvislá řeč bez varování');
  });
  await t('halucinace: „www…“ přes hudbu a „Titulky vytvořil …“ vypadnou, vyslovená adresa zůstane', () => {
    const words = [{ w: 'www.hradeckralove.cz', s: 0, e: 8.56 }, { w: 'Talk.', s: 9.3, e: 9.64 }, { w: 'Psala', s: 10, e: 10.3 }, { w: 'jsem', s: 10.3, e: 10.5 },
      { w: 'na', s: 10.5, e: 10.6 }, { w: 'web', s: 10.6, e: 10.8 }, { w: 'Nova.cz.', s: 10.8, e: 11.3 }, { w: 'Titulky', s: 20, e: 21.5 }, { w: 'vytvořil', s: 21.6, e: 23 }, { w: 'JohnyX.', s: 23.1, e: 24.8 }];
    const r = TR.dropHallucinations(words);
    assert.deepStrictEqual(r.words.map((w) => w.w), ['Talk.', 'Psala', 'jsem', 'na', 'web', 'Nova.cz.']);
    assert.deepStrictEqual(r.removed.map((x) => x.text), ['www.hradeckralove.cz', 'Titulky vytvořil JohnyX.']);
    assert.ok(TR.hallucinated('Titulky vytvořil JohnyX.') && !TR.hallucinated('Titulky jsou hotové.'));
  });
  await t('export: sekundové bloky zvuku bez prázdného posledního bloku (16,000 01 s → AudioData s 0 vzorky, regrese kolo 4)', () => {
    const { audioBlocks } = require('../src/core/util');
    assert.deepStrictEqual(audioBlocks(16.00001, 48000), new Array(16).fill(48000));
    assert.deepStrictEqual(audioBlocks(2.5, 48000), [48000, 48000, 24000]);
    assert.ok(audioBlocks(15.96, 48000).every((n) => n > 0));
  });
  await t('B1: vložení z Přepisu po titulcích nerozřízne klip a titulky zůstanou na svém klipu (kolo 5)', () => {
    const s = seqWith([10, 26]); // „V5“ 0–16 s
    s.captions = [{ start: 0.15, end: 1.84, text: 'My jsme vůbec neměli' }, { start: 2, end: 15.9, text: 'zbytek' }];
    s.playhead = 0.2; // sem hlavu dřív přesunulo „Vytvořit titulky“
    const p = E.transcriptInsertPoint(s, s.playhead);
    assert.strictEqual(p.where, 'playhead'); near(p.at, 0); // hlava 0,2 s od začátku sekvence = hranice → před V5
    const p2 = E.transcriptInsertPoint(s, 7);
    assert.deepStrictEqual([p2.where, p2.at], ['end', 16]);
    E.editFromSource(s, M, 50, 69.88, p2.at, 'insert');
    const v = s.tracks.video[0].clips;
    assert.ok(v.every((c) => c.out - c.in >= 1), 'útržek klipu');
    near(v[0].start, 0); near(v[0].in, 10); near(v[1].start, 16);
    assert.deepStrictEqual(s.captions.map((c) => c.start), [0.15, 2]); // titulky V5 beze změny
    assert.deepStrictEqual(E.uncaptionedRanges(s).map((r) => [r.start, +r.end.toFixed(2)]), [[16, 35.88]]); // doplnit jen V2
    // vložení na začátek: titulky V5 se posunou přesně o délku vloženého úseku
    E.editFromSource(s, M, 80, 85, p.at, 'insert');
    near(s.captions[0].start, 5.15); near(s.captions[1].start, 7);
  });
  await t('notebook: odhady pro lidi a titulky z přesného úseku jen ze slov uvnitř klipu (kolo 5)', () => {
    const { aboutT } = require('../src/core/util');
    assert.deepStrictEqual([aboutT(17.7, true), aboutT(52, true), aboutT(100, true), aboutT(150, true), aboutT(30, false)], ['asi 20 s', 'asi minutu', 'asi 1 min 40 s', 'asi 3 min', 'about 30 s']);
    // přesný přepis zvuku klipu [In, Out]: slova už jsou v čase zdroje uvnitř klipu → titulky v čase sekvence
    const ws = [{ w: 'A', s: 104.3, e: 104.4 }, { w: 'zjistilo', s: 104.45, e: 104.9 }, { w: 'pozdě.', s: 106.0, e: 106.6 }];
    const r = TR.clipWords({ words: ws }, { in: 104.25, out: 123.37, start: 16.32 });
    assert.deepStrictEqual(r.map((w) => w.w), ['A', 'zjistilo', 'pozdě.']);
    near(r[0].s, 16.37);
    assert.deepStrictEqual(TR.prefetchState().state, 'none');
  });
  await t('rozhraní: žádné id dvakrát v jednom stavu panelu (redaktor-5: trNext = šipka hledání i tlačítko titulků)', () => {
    // id, která se v kódu opakují jen v různých větvích (nikdy nejsou vidět současně)
    const branches = new Set(['trStatus', 'trCount', 'trList', 'trFoot', 'capList', 'capFoot', 'trEmptyBtn', 'trIns', 'trInsMore', 'trAuto', 'trQ', 'trPf', 'trStop', 'trGo']);
    for (const f of ['src/ui/transcript-panel.js', 'src/ui/caption-list.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      const ids = [...src.matchAll(/id="([A-Za-z][\w-]*)"/g)].map((m) => m[1]);
      const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))].filter((x) => !branches.has(x));
      assert.deepStrictEqual(dup, [], f + ': ' + dup.join(', '));
    }
  });
  await t('české uvozovky v titulcích', () => {
    const CLq = require('../src/core/captionlayout');
    assert.strictEqual(CLq.czQuotes('řekl: "Já jedu za tebou," a'), 'řekl: „Já jedu za tebou,“ a');
    assert.strictEqual(CLq.czQuotes("it's"), "it's");
  });
  await t('WER: záměny, vypuštění, vložení', () => {
    const W = require('./asr-wer');
    const r = W.wer('Ty nemáš v tu chvíli jinou možnost.', 'Ty ne máš v tuh výle jinou možnost');
    assert.strictEqual(r.n, 7);
    assert.strictEqual(r.sub + r.del + r.ins, 4);
    assert.strictEqual(W.wer('Je[?] jí teď líp', 'je jí teď líp').wer, 0);
  });
  await t('oprava titulku → přepis: slova v úseku nahradí opravený text, sousedé zůstanou', () => {
    const tr = { words: [{ w: 'nic', s: 0, e: 0.4 }, { w: 'slišet.', s: 0.5, e: 1.0 }, { w: 'My', s: 1.2, e: 1.4 }, { w: 'potřebujem', s: 1.4, e: 2.0 }, { w: 'jenom', s: 2.1, e: 2.5 }], sentences: [] };
    const r = TR.applyFixes(tr, [{ s: 0.5, e: 2.0, text: 'slyšet. My potřebujeme' }]);
    assert.deepStrictEqual(r.words.map((w) => w.w), ['nic', 'slyšet.', 'My', 'potřebujeme', 'jenom']);
    near(r.words[1].s, 0.5); assert.ok(r.words[3].e <= 2.0 + 1e-9);
    assert.ok(r.sentences.length >= 2, 'věty přepočítané');
    assert.strictEqual(tr.words[1].w, 'slišet.', 'původní přepis beze změny');
    // dopsané slovo na kraji opravy, které v přepisu je hned před úsekem → nezdvojí se
    const t2 = { words: [{ w: 'Tak', s: 0.0, e: 0.2 }, { w: 'neříká', s: 0.3, e: 0.6 }, { w: 'se', s: 0.6, e: 0.8 }, { w: 'tyhle', s: 0.9, e: 1.2 }], sentences: [] };
    const r3 = TR.applyFixes(t2, [{ s: 0.3, e: 0.8, text: 'Tak neříkejte' }]);
    assert.deepStrictEqual(r3.words.map((w) => w.w), ['Tak', 'neříkejte', 'tyhle']);
  });
  await t('oprava titulku najde svá slova v přepisu i při posunutých časech', () => {
    const ws = [{ w: 'nepotřebujeme', s: 9.57, e: 10.2 }, { w: 'nic', s: 10.34, e: 10.5 }, { w: 'slišet.', s: 10.55, e: 10.9 }, { w: 'My', s: 10.99, e: 11.1 }];
    const sp = TR.matchSpan(ws, 10.2, 10.86, 'nic slišet.');
    assert.ok(sp && Math.abs(sp.s - 10.34) < 1e-6 && Math.abs(sp.e - 10.9) < 1e-6, JSON.stringify(sp));
    assert.strictEqual(TR.matchSpan(ws, 10.2, 10.86, 'úplně jiný text tady'), null);
  });
  await t('přepis: věta > 8 s se rozdělí na pauze u čárky, oprava i hledání fungují dál', () => {
    // 16 s věta: slova po 0,5 s, pauza 0,4 s po čárce v 7 s a 0,3 s bez čárky v 11 s
    const ws = []; let at = 0;
    for (let i = 0; i < 30; i++) { const w = i === 13 ? 'rodina,' : i === 21 ? 'domů' : 'slovo' + i; ws.push({ w, s: at, e: at + 0.45 }); at += 0.5 + (i === 13 ? 0.4 : i === 21 ? 0.3 : 0); }
    ws[29].w = 'konec.';
    const S = TR.sentences(ws);
    assert.ok(S.length >= 2, 'rozděleno: ' + S.length);
    assert.ok(S.every((s) => s.e - s.s <= 8.01), S.map((s) => (s.e - s.s).toFixed(1)).join(', '));
    assert.strictEqual(ws[S[0].w1].w, 'rodina,', 'první kus končí u čárky');
    assert.ok(S[1].cont, 'další kus = pokračování věty');
    const fixed = TR.applyFixes({ words: ws, sentences: S }, [{ s: ws[14].s, e: ws[14].e, text: 'opraveno' }]);
    assert.ok(fixed.words.some((w) => w.w === 'opraveno') && fixed.sentences.every((s) => s.e - s.s <= 8.01));
  });
  await t('díry v přepisu: řeč bez slov > 3 s se najde (i pod jedním nesmyslně dlouhým „slovem“)', () => {
    const x = new Float32Array(16000 * 12);
    for (let i = 0; i < x.length; i++) { const t0 = i / 16000; x[i] = (t0 < 10 && Math.floor(t0 * 4) % 4 !== 3) ? 0.3 * Math.sin(i * 0.2) : 0.0005 * Math.sin(i * 0.37); }
    const thr = 0.3 / Math.SQRT2 * Math.pow(10, -15 / 20);
    const h = TR.findHoles([{ w: 'Krasný', s: 0, e: 9.5 }, { w: 'den.', s: 9.6, e: 10 }], x, 0, thr, 0, 12);
    assert.strictEqual(h.length, 1); assert.ok(h[0].s < 0.5 && h[0].e > 9, JSON.stringify(h));
    assert.strictEqual(TR.findHoles([{ w: 'a', s: 0, e: 2.5 }, { w: 'b', s: 2.6, e: 5 }, { w: 'c', s: 5.1, e: 7.6 }, { w: 'd', s: 7.7, e: 10 }], x, 0, thr, 0, 12).length, 0);
  });
  await t('Zpět vrací i opravy přepisu (asrFixes v kroku Zpět)', () => {
    const p = new Project();
    p.edit('Edit Caption', () => { p.asrFixes = { m1: [{ s: 1, e: 2, text: 'x' }] }; });
    assert.strictEqual(p.asrFixes.m1.length, 1);
    p.undo();
    assert.ok(!p.asrFixes.m1);
    p.redo();
    assert.strictEqual(p.asrFixes.m1[0].text, 'x');
  });
  await t('bezpečnost: projekt z cizí ruky se při načtení vyčistí (S12 – podvržený .pzcut spustil kód)', () => {
    const raw = JSON.parse('{"__proto__":{"polluted":1},"name":"P","media":[{"id":"m1","name":"<img src=x onerror=alert(1)>","width":"1920\\" onmouseover=x","thumbUrl":"javascript:x","thumb":"C:/x\'.png","path":"C:/a.mp4"},{"id":"bad\\"><img>","name":"x"}],'
      + '"sequences":[{"id":"s1\\"><img>","name":"x"},{"id":"s2","name":"<b>","fps":"25","markers":[{"time":1,"type":"Comment","name":"n"}],'
      + '"tracks":{"video":[{"clips":[{"id":"c1","mediaId":"m1","gainDb":"<script>","vIn":{"type":"<x>","dur":1},"vOut":{"type":"dipBlack","dur":"1"},"start":0,"in":0,"out":2,"constructor":{"x":1}}]}]}}],'
      + '"openSequenceIds":["s2","x\\"y"]}');
    const p = new Project();
    p.load(raw, null);
    assert.strictEqual(({}).polluted, undefined);
    assert.strictEqual(p.media.length, 1); assert.strictEqual(p.media[0].width, 0); assert.ok(!('thumbUrl' in p.media[0]) && !('thumb' in p.media[0]));
    assert.strictEqual(p.sequences.length, 1); assert.strictEqual(p.sequences[0].fps, 25);
    const c = p.sequences[0].tracks.video[0].clips[0];
    assert.strictEqual(c.gainDb, 0); assert.strictEqual(c.vIn, null); assert.strictEqual(c.vOut.type, 'dipBlack'); assert.strictEqual(c.vOut.dur, 1);
    assert.ok(!Object.prototype.hasOwnProperty.call(c, 'constructor'));
    assert.strictEqual(p.sequences[0].markers[0].type, 'Comment');
    assert.deepStrictEqual(p.openSequenceIds, ['s2']);
    assert.strictEqual(require('../src/core/sanitize').esc('"<a>\'&'), '&quot;&lt;a&gt;&#39;&amp;');
  });
  console.log(`\n${ok} prošlo, ${fail} selhalo`);
  process.exit(fail ? 1 : 0);
})();
