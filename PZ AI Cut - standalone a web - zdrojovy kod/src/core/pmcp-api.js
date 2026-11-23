'use strict';
// Náhrada host.jsx z MY Premiere MCP: stejná jména funkcí, argumenty i tvar výsledků, ale nad vlastním
// modelem TN Střihátka. MCP server (server/index.js) tak stříhá tady stejně jako v Premiere.
const fs = require('fs');
const path = require('path');
const { newSequence, newClip, clipEnd, seqDuration, sortTrack } = require('./model');
const E = require('./edit');
const { r3, uid, stripExt, timecode, baseName } = require('./util');
const importer = require('./importer');
const media = require('./media');
const exporter = require('./exporter');

const AUDIO_EXT = /\.(wav|mp3|aac|m4a|aif|aiff|flac|ogg|wma)$/i;
const VERSION = '0.1.0';

function createApi(project, hooks = {}) {
  const api = {};
  const getSeq = (id) => {
    const s = project.seqById(id);
    if (!s) throw new Error(id ? 'Sequence not found: ' + id : 'No active sequence');
    return s;
  };

  async function resolveMedia(key, autoImport = true) {
    const k = String(key);
    let m = project.mediaById(k) || project.mediaByPath(k) || project.media.find((x) => x.name === k);
    if (!m && autoImport && fs.existsSync(k)) m = await importer.importPath(project, k);
    if (!m) throw new Error('Project item not found: ' + k);
    if (!m.duration) m = await importer.importPath(project, m.path);
    return m;
  }

  function seqFromMedia(name, m) {
    return newSequence({
      name: project.uniqueSeqName(name),
      width: m.hasVideo ? m.width : 1920,
      height: m.hasVideo ? m.height : 1080,
      fps: m.hasVideo ? m.fps : 25,
    });
  }

  function clipInfo(c, kind, ti, ci) {
    const m = project.mediaById(c.mediaId);
    return {
      kind, track: ti, index: ci, name: c.name,
      start: r3(c.start), end: r3(clipEnd(c)), inPoint: r3(c.in), outPoint: r3(c.out),
      mediaPath: m ? m.path : '', nodeId: c.mediaId, disabled: !!c.disabled, speed: 1,
      selected: !!(hooks.isSelected && hooks.isSelected(c.id)),
    };
  }

  function dumpSeq(seq, withClips) {
    const r = {
      name: seq.name, sequenceID: seq.id, fps: r3(seq.fps), width: seq.width, height: seq.height,
      duration: r3(seqDuration(seq)), playhead: r3(seq.playhead || 0),
      videoTracks: seq.tracks.video.length, audioTracks: seq.tracks.audio.length,
      inPoint: seq.inPoint === null ? null : r3(seq.inPoint), outPoint: seq.outPoint === null ? null : r3(seq.outPoint),
    };
    if (withClips) {
      r.clips = [];
      for (const kind of ['video', 'audio']) {
        seq.tracks[kind].forEach((t, ti) => {
          sortTrack(t);
          t.clips.forEach((c, ci) => r.clips.push(clipInfo(c, kind, ti, ci)));
        });
      }
      if (seq.captions && seq.captions.length) r.captions = seq.captions.length;
    }
    return r;
  }

  const activate = (seq) => { project.openSequence(seq.id); };

  /* ---------- API ---------- */
  api.ping = () => {
    const r = { app: 'TNSTRIH', version: VERSION, build: 'PZ AI Cut Standalone', project: null };
    r.project = { name: project.name, path: project.path || '' };
    const a = project.activeSequence();
    if (a) r.activeSequence = a.name;
    return r;
  };

  api.projectInfo = () => {
    const a = project.activeSequence();
    return {
      name: project.name, path: project.path || '',
      sequences: project.sequences.map((s) => ({ name: s.name, sequenceID: s.id, duration: r3(seqDuration(s)) })),
      activeSequence: a ? { name: a.name, sequenceID: a.id } : null,
    };
  };

  api.listItems = () => {
    const out = project.media.map((m) => ({ type: 'item', name: m.name, nodeId: m.id, bin: '', mediaPath: m.path, isSequence: false }));
    for (const s of project.sequences) out.push({ type: 'item', name: s.name, nodeId: s.id, bin: '', mediaPath: '', isSequence: true });
    return out;
  };

  api.importFiles = async (a) => {
    const res = [];
    for (const p of a.paths || []) {
      try {
        const m = await resolveMedia(p, true);
        const r = { path: p, name: m.name, nodeId: m.id };
        if (a.openSequence && m.hasVideo) {
          const seq = project.edit('New Sequence From Clip', () => {
            const s = seqFromMedia(stripExt(m.name), m);
            E.editFromSource(s, m, 0, m.duration, 0, 'overwrite', { video: 0, audio: 0 });
            return project.addSequence(s);
          });
          r.sequence = seq.name;
        }
        res.push(r);
      } catch (e) { res.push({ path: p, error: e.message }); }
    }
    return res;
  };

  api.getSequence = (a) => dumpSeq(getSeq(a.sequence), a.clips !== false);

  api.openSequence = (a) => { const s = getSeq(a.sequence); activate(s); return { name: s.name, sequenceID: s.id }; };

  /* Nová sekvence z úseků: [{source, in, out, audioOnly?, audioTrack?, videoTrack?, extra:[{source, offset, audioTrack}]}] */
  api.buildSequence = async (a) => {
    const segs = a.segments;
    if (!segs || !segs.length) throw new Error('No segments');
    const resolved = [];
    for (const sg of segs) {
      const extra = [];
      for (const x of sg.extra || []) extra.push({ ...x, media: await resolveMedia(x.source, true) });
      resolved.push({ sg, m: await resolveMedia(sg.source, true), extra });
    }
    const tmpl = (resolved.find((r) => r.m.hasVideo) || resolved[0]).m;
    const res = project.edit('AI: Build Sequence', () => {
      const seq = seqFromMedia(a.name || 'AI Edit', tmpl);
      const fd = 1 / seq.fps;
      const warnings = [], placed = [];
      let cursor = 0;
      const gap = a.gap || 0;
      resolved.forEach(({ sg, m, extra }, i) => {
        const inS = Math.max(0, Math.floor(sg.in / fd + 1e-6) * fd);
        const outS = Math.min(m.duration || Infinity, Math.ceil(sg.out / fd - 1e-6) * fd);
        if (outS - inS < fd) { warnings.push('segment ' + i + ' too short, skipped'); return; }
        const audioOnly = sg.audioOnly || !m.hasVideo || AUDIO_EXT.test(m.path);
        const rec = { i, source: sg.source, in: r3(inS), out: r3(outS), at: r3(cursor), placed: [] };
        const link = !audioOnly && m.hasAudio ? uid('l') : null;
        if (!audioOnly) {
          const vt = sg.videoTrack || 0;
          E.placeClip(seq, 'video', vt, newClip(m, 'video', cursor, inS, outS, { linkId: link }));
          rec.placed.push({ kind: 'video', track: vt, start: r3(cursor), end: r3(cursor + outS - inS) });
        }
        if (m.hasAudio) {
          const at = audioOnly ? (sg.audioTrack || 0) : 0;
          E.placeClip(seq, 'audio', at, newClip(m, 'audio', cursor, inS, outS, { linkId: link }));
          if (audioOnly) rec.placed.push({ kind: 'audio', track: at, start: r3(cursor), end: r3(cursor + outS - inS) });
        }
        for (const x of extra) {
          try {
            const off = x.offset || 0;
            const xi = Math.max(0, inS + off), xo = outS + off;
            const tr = x.audioTrack === undefined ? 1 : x.audioTrack;
            while (seq.tracks.audio.length <= tr) seq.tracks.audio.push({ clips: [], muted: false, locked: false, target: false });
            E.placeClip(seq, 'audio', tr, newClip(x.media, 'audio', cursor + (xi - (inS + off)), xi, xo));
            rec.placed.push({ kind: 'audio', track: tr, start: r3(cursor), end: r3(cursor + xo - xi) });
          } catch (e) { warnings.push('segment ' + i + ' extra: ' + e.message); }
        }
        placed.push(rec);
        cursor = Math.round((cursor + outS - inS + gap) * seq.fps) / seq.fps;
      });
      let fades = 0;
      if (a.audioFades && placed.length > 1) fades = E.addAudioFades(seq, a.audioFades);
      project.addSequence(seq, a.open !== false);
      return { sequenceID: seq.id, name: seq.name, duration: r3(cursor), segments: placed.length, placed, warnings, audioFades: fades };
    });
    await edgeShots(res);
    return res;
  };
  /* Zbytky jiného záběru kamery na krajích klipů (pár snímků před/za střihem kamery) převezme sousední klip – jako web (kolo 7/8).
   * Kontrolor výstupu S1: AI sestřih ve standalone ukázal 7 snímků moderátorky na začátku klipu. Zvuk (In/Out) se nemění. */
  async function edgeShots(res) {
    if (!hooks.edgeShots || !res || !res.sequenceID) return;
    try {
      // nejvýš 20 s – úklid krajů je navíc, sekvence platí i bez něj; most nesmí čekat (AI tok S4: zaseknutí na 10 min)
      const signal = { cancelled: false };
      const r = await Promise.race([hooks.edgeShots(getSeq(res.sequenceID), { signal }), new Promise((ok) => setTimeout(() => { signal.cancelled = true; ok(null); }, 20000))]);
      if (r && r.merged) res.edgeShotsFixed = r.merged;
    } catch (e) { /* bez opravy krajů – sekvence platí */ }
  }

  /* Klipy na přesné pozice: [{kind:'video'|'audio', source, in, at, dur, track, videoOnly}] (multicam, komentář) */
  api.buildTimeline = async (a) => {
    const clips = a.clips;
    if (!clips || !clips.length) throw new Error('No clips');
    const cache = new Map();
    for (const c of clips) if (!cache.has(c.source)) cache.set(c.source, await resolveMedia(c.source, true));
    const tmpl = cache.get((clips.find((c) => c.kind !== 'audio') || clips[0]).source);
    return project.edit('AI: Build Timeline', () => {
      const seq = seqFromMedia(a.name || 'AI multicam', tmpl);
      const fd = 1 / seq.fps;
      const snap = (t) => Math.round(t * seq.fps) / seq.fps;
      let placed = 0;
      const warnings = [];
      const order = clips.filter((c) => c.kind !== 'audio').concat(clips.filter((c) => c.kind === 'audio'));
      for (const c of order) {
        try {
          const m = cache.get(c.source);
          const atS = snap(c.at), endS = snap(c.at + c.dur);
          if (endS - atS < fd) continue;
          const inS = Math.max(0, snap(c.in));
          const kind = c.kind === 'audio' ? 'audio' : 'video';
          const tr = c.track || 0;
          const list = seq.tracks[kind];
          while (list.length <= tr) list.push({ clips: [], muted: false, locked: false, target: false });
          E.placeClip(seq, kind, tr, newClip(m, kind, atS, inS, inS + (endS - atS)));
          placed++;
        } catch (e) { if (warnings.length < 20) warnings.push(`${c.kind} ${c.source} @${r3(c.at)}: ${e.message}`); }
      }
      let closed = 0;
      for (const t of seq.tracks.video) {
        sortTrack(t);
        for (let q = 0; q + 1 < t.clips.length; q++) {
          const g = t.clips[q + 1].start - clipEnd(t.clips[q]);
          if (g > 1e-3 && g <= 2 * fd + 1e-3) { t.clips[q].out += g; closed++; }
        }
      }
      project.addSequence(seq, a.open !== false);
      return { sequenceID: seq.id, name: seq.name, duration: r3(seqDuration(seq)), clips: placed, total: order.length, gapsClosed: closed, warnings };
    });
  };

  api.razor = (a) => {
    const seq = getSeq(a.sequence);
    activate(seq);
    return project.edit('AI: Add Edit', () => {
      const cuts = [];
      for (const t of a.times || []) { E.razor(seq, t); cuts.push(timecode(E.snapT(seq, t), seq.fps)); }
      return { cuts };
    });
  };

  api.removeRanges = (a) => {
    const seq = getSeq(a.sequence);
    activate(seq);
    const ripple = a.ripple !== false;
    return project.edit('AI: Extract Ranges', () => {
      const ranges = (a.ranges || []).map((r) => ({ start: E.snapT(seq, r.start), end: E.snapT(seq, r.end) }))
        .filter((r) => r.end - r.start >= E.fd(seq) - 1e-6).sort((p, q) => q.start - p.start);
      let removed = 0;
      for (const r of ranges) {
        if (ripple) removed += E.extractRange(seq, r.start, r.end);
        else { const before = countClips(seq); E.liftRange(seq, r.start, r.end); removed += Math.max(0, before - countClips(seq)); }
      }
      return { removed, shifted: ripple ? ranges.length : 0, ranges: ranges.length, duration: r3(seqDuration(seq)) };
    });
  };
  const countClips = (seq) => seq.tracks.video.concat(seq.tracks.audio).reduce((n, t) => n + t.clips.length, 0);

  api.removeClips = (a) => {
    const seq = getSeq(a.sequence);
    return project.edit('AI: Clear Clips', () => {
      const ids = (a.clips || []).map((c) => {
        const t = seq.tracks[c.kind === 'audio' ? 'audio' : 'video'][c.track];
        sortTrack(t || { clips: [] });
        const clip = t && t.clips[c.index];
        if (!clip) throw new Error('Clip not found: ' + JSON.stringify(c));
        return clip.id;
      });
      const removed = E.removeClips(seq, ids, !!a.ripple);
      return a.ripple && E.removeClips.blocked ? { removed, gapsLeftOpen: E.removeClips.blocked, note: 'Mezera nezavřena: přes ni leží jiný klip (b-roll, hudba). Úsek ze všech stop vyjme remove_timeline_ranges.' } : { removed };
    });
  };

  api.addMarkers = (a) => {
    const seq = getSeq(a.sequence);
    return project.edit('AI: Add Markers', () => {
      for (const m of a.markers || []) {
        seq.markers.push({ id: uid('k'), time: m.time, duration: m.duration || 0, name: m.name || '', comment: m.comment || '', color: m.color || 0 });
      }
      seq.markers.sort((x, y) => x.time - y.time);
      return { added: (a.markers || []).length };
    });
  };

  api.getMarkers = (a) => getSeq(a.sequence).markers.map((m) => ({
    name: m.name, comment: m.comment, start: r3(m.time), end: r3(m.time + (m.duration || 0)), type: 'Comment',
  }));

  api.setPlayhead = (a) => {
    const seq = getSeq(a.sequence);
    seq.playhead = Math.max(0, Number(a.time) || 0);
    project.emit('playhead', seq);
    return { playhead: r3(seq.playhead) };
  };

  api.exportSequence = async (a) => {
    const seq = getSeq(a.sequence);
    const output = String(a.output);
    if (hooks.beforeExport) hooks.beforeExport(seq, output);
    // výchozí jako dialog Export (AI tok S2: přes MCP vyšlo 9:16 bez titulků a −30 LUFS): titulky vypálit, když jsou;
    // hlasitost na výšku/čtverec pro sítě −14, MXF pro TV −23, jinak beze změny
    const hasCaps = (seq.captions || []).length > 0;
    const mxf = /\.mxf$/i.test(output) || ['xdcam', 'dnxhr'].includes(a.format);
    const loud = a.loudness || (mxf ? 'tv' : seq.width / seq.height < 1.06 ? 'social' : 'off');
    const r = await exporter.exportSequence(project, seq, {
      output, range: a.range === 'inout' || a.range === 'workarea' ? 'inout' : 'all', format: a.format,
      burnCaptions: a.burnCaptions !== undefined ? !!a.burnCaptions : hasCaps && !mxf, srtSidecar: a.srt !== undefined ? !!a.srt : hasCaps && mxf, loudness: loud, onProgress: hooks.exportProgress,
    });
    return { result: 'No Error', output: r.output, format: r.format, sizeMB: r.sizeMB, duration: r.duration, captionsBurned: a.burnCaptions !== undefined ? !!a.burnCaptions && hasCaps : hasCaps && !mxf, srt: a.srt !== undefined ? !!a.srt && hasCaps : hasCaps && mxf, loudness: loud };
  };

  api.saveProject = async () => {
    if (!hooks.save) throw new Error('Saving is not available');
    const p = await hooks.save();
    return { saved: p };
  };

  // Formát pro sítě: nová sekvence num:den (např. 1080×1920), klipy vyplní obraz. Jako Auto Reframe v Premiere:
  // video se rozřízne na střizích kamery uvnitř klipů (ffmpeg) a každý záběr se posune na obličej (OpenCV).
  api.reframeSequence = async (a) => {
    const src = getSeq(a.sequence);
    const num = a.num || 9, den = a.den || 16;
    if (src.width / src.height < num / den + 0.02) { // ze širší sekvence (i 4:5 → 9:16, kolo 8)
      throw new Error(`“${src.name}” is ${src.width}×${src.height} – reframe to ${num}:${den} only from a wider sequence; open the original landscape (16:9) one`);
    }
    const H = a.height || 1920;
    const W = a.width || Math.round(H * num / den / 2) * 2;
    const seq = JSON.parse(JSON.stringify(src));
    for (const kind of ['video', 'audio']) for (const t of seq.tracks[kind]) for (const c of t.clips) c.id = uid('c');
    seq.width = W; seq.height = H;
    for (const t of seq.tracks.video) for (const c of t.clips) { c.fit = 'cover'; c.scale = 1; c.posX = 0; c.posY = 0; }
    // titulky přeskládat na nový tvar obrazu (styl podle formátu: 9:16 výš kvůli rozhraní sítí)
    if ((seq.captions || []).length) { try { const CL = require('./captionlayout'); const src = { captionStyle: seq.captionStyle }; const keepSt = {}; for (const k of ['highlight', 'color', 'box', 'lines']) if (src.captionStyle && src.captionStyle[k] !== undefined) keepSt[k] = src.captionStyle[k]; delete seq.captionStyle; if (Object.keys(keepSt).length) seq.captionStyle = Object.assign(CL.styleOf(seq), keepSt); seq.captions = CL.reflow(seq); } catch (e) { /* ponechat */ } }
    let splits = 0, faced = 0, shots = 0;
    if (a.faces !== false) {
      // 1) střihy kamery uvnitř klipů -> rozříznout jen video
      if (hooks.progress) hooks.progress('Auto Reframe: detecting camera cuts…');
      for (const t of seq.tracks.video) {
        for (const c of t.clips.slice()) {
          const m = project.mediaById(c.mediaId);
          if (!m || c.out - c.in < 1.5) continue;
          try {
            const r = await api.detectSceneCuts({ source: m.path, ranges: [{ from: c.in, to: c.out }], sensitivity: 'MediumSensitivity' });
            const lm = new Map();
            let cur = c;
            for (const cut of r.cuts.sort((x, y) => x - y)) {
              const at = E.snapT(seq, cur.start + (cut - cur.in));
              const right = E.splitClip(seq, t, cur, at, lm);
              if (right) { right.linkId = null; cur.linkId = null; splits++; cur = right; } // obraz rozříznutý, zvuk v celku – kusy obrazu bez vazby (Delete nesmí smazat celý zvuk)
            }
          } catch (e) { /* bez detekce střihů – celý klip jedním posunem */ }
        }
      }
      // 2) obličej v každém záběru
      const shotsList = [];
      for (const t of seq.tracks.video) for (const c of t.clips) {
        const m = project.mediaById(c.mediaId);
        if (!m || !m.hasVideo) continue;
        const d = c.out - c.in;
        shotsList.push({ c, m, item: { path: m.path, times: [0.2, 0.5, 0.8].map((f) => c.in + d * f), range: [c.in, c.out], transcript: transcriptFor(m.path) } });
      }
      shots = shotsList.length;
      if (hooks.progress) hooks.progress(`Auto Reframe: finding faces in ${shots} shots…`);
      const res = await faceCenters(shotsList.map((x) => x.item));
      if (res) {
        res.forEach((f, i) => {
          if (!f || f.x === null) return;
          const { c, m } = shotsList[i];
          const iw = m.width, ih = m.height;
          const k = Math.max(W / iw, H / ih) * (c.scale || 1);
          const sw = iw * k;
          if (sw <= W + 1) return;
          // střed obličeje (o kousek víc do směru pohledu nedělá – drží se na středu)
          const x = f.x * sw - W / 2;
          c.posX = Math.max(-1, Math.min(1, x / ((sw - W) / 2) - 1));
          faced++;
        });
      }
    }
    if (hooks.progress) hooks.progress('');
    const res = project.edit('Auto Reframe Sequence', () => {
      seq.id = require('./util').uuid();
      seq.name = project.uniqueSeqName(a.name || `${src.name} ${num}x${den}`);
      E.relinkAV(seq); // kusy obrazu po rozříznutí na střihu kamery propojit s jejich zvukem (kontrolor S10 #2)
      project.addSequence(seq);
      return { sequenceID: seq.id, name: seq.name, width: W, height: H, reframedFrom: `${src.width}x${src.height}`, scale: 100,
        cameraSplits: splits, shots, facesFound: faced };
    });
    await edgeShots(res);
    return res;
  };

  api.deleteSequences = (a) => project.edit('AI: Delete Sequences', () => {
    const done = [];
    for (const id of a.ids || []) { const s = project.sequences.find((x) => x.id === id); if (s && project.deleteSequence(s.id)) done.push(s.name); }
    return { deleted: done };
  });

  api.undo = () => { const l = project.undo(); return { undone: !!l, step: l }; };

  api.addCaptions = (a) => {
    const seq = getSeq(a.sequence);
    if (!a.srtPath) throw new Error('Missing srtPath');
    let caps = parseSrt(fs.readFileSync(a.srtPath, 'utf8'));
    // přeskládat podle stylu sekvence a skutečné šířky obrazu (src/core/captionlayout.js) – jako na webu;
    // počet řádků z panelu (SRT) se zachová, pokud sekvence ještě nemá vlastní styl
    let newStyle = null;
    try {
      const CL = require('./captionlayout');
      const srtLines = Math.max(1, ...caps.map((c) => String(c.text).split('\n').length));
      const st = Object.assign(CL.styleOf(seq), seq.captionStyle ? {} : { lines: Math.min(3, srtLines) });
      // výslovné zadání agenta (add_captions lines / charsPerLine) má přednost před stylem sekvence (AI tok S3: lines:1 ignorováno)
      if (a.lines) st.lines = Math.max(1, Math.min(3, Math.round(a.lines)));
      if (a.charsPerLine) st.maxChars = Math.max(12, Math.min(60, Math.round(a.charsPerLine)));
      if (caps.length) caps = CL.layout(CL.wordsOfCaptions(caps), seq, st, CL.contentEnd(seq) || undefined);
      if (!seq.captionStyle || a.lines || a.charsPerLine) newStyle = Object.assign({}, seq.captionStyle || {}, st);
    } catch (e) { /* bez přeskládání */ }
    return project.edit('AI: Captions', () => {
      seq.captions = caps;
      if (newStyle) seq.captionStyle = newStyle;
      return { added: true, sequence: seq.name, count: caps.length };
    });
  };

  api.detectSceneCuts = async (a) => {
    if (!a.source) throw new Error('Missing source');
    const m = await resolveMedia(a.source, true);
    const th = { LowSensitivity: 0.4, MediumSensitivity: 0.3, HighSensitivity: 0.2 }[a.sensitivity] || 0.4;
    const ranges = a.ranges && a.ranges.length
      ? a.ranges.map((r) => [Math.max(0, Number(r.from) || 0), Math.min(m.duration, Number(r.to) || m.duration)])
      : [[0, a.to > 0 ? Math.min(a.to, m.duration) : m.duration]];
    const cuts = [], placed = [];
    let analyzed = 0;
    for (const [f, t] of ranges) {
      if (t - f < 0.5) continue;
      placed.push([r3(f), r3(t)]);
      analyzed += t - f;
      const pre = Math.max(0, f - 11), post = f - pre; // preroll: přesný obraz i za ne-IDR I-snímkem (viz exporter.preroll)
      const { out } = await media.run(media.FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', pre.toFixed(3), '-t', (t - pre).toFixed(3), '-i', m.path,
        '-an', '-vf', `trim=start=${post.toFixed(3)},setpts=PTS-STARTPTS,scale=320:-2,select='gt(scene,${th})',metadata=print:file=-`, '-f', 'null', '-']);
      for (const mm of String(out).matchAll(/pts_time:([\d.]+)/g)) {
        const c = f + Number(mm[1]);
        if (c > f + 0.04 && c < t - 0.04) cuts.push(r3(c));
      }
    }
    return { sequence: '(ffmpeg)', sequenceID: '', ranges: placed, analyzed: r3(analyzed), cuts, count: cuts.length };
  };

  return api;
}

/** Přepis zdroje z cache MY Premiere MCP (kvůli mluvčím pro výřez širokých záběrů). null = není. */
function transcriptFor(file) {
  try {
    const dir = path.join(media.cfg.aiRoot || '', 'cache', 'transcripts');
    const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    const p = idx[path.resolve(file).toLowerCase()];
    return p && fs.existsSync(p) ? p : null;
  } catch (e) { return null; }
}

/** Obličeje přes tools/faces.py (Python s OpenCV z MY Premiere MCP; YuNet z jeho models/opencv_face). null = není k dispozici. */
function faceCenters(items) {
  if (!items.length) return Promise.resolve([]);
  const root = media.cfg.aiRoot || '';
  const py = [path.join(root, '.venv', 'Scripts', 'python.exe'), path.join(root, 'tools', 'python311', 'python.exe')].find((p) => fs.existsSync(p));
  if (!py) return Promise.resolve(null);
  return new Promise((resolve) => {
    const p = require('child_process').spawn(py, [path.join(media.APP_ROOT, 'tools', 'faces.py')], { windowsHide: true });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', () => {});
    p.on('error', () => resolve(null));
    p.on('close', () => { try { resolve(JSON.parse(out)); } catch (e) { resolve(null); } });
    let yunet = null;
    try { const d = path.join(root, 'models', 'opencv_face'); const f = fs.readdirSync(d).find((n) => /yunet.*\.onnx$/i.test(n)); if (f) yunet = path.join(d, f); } catch (e) { /* jen Haar */ }
    p.stdin.end(JSON.stringify({ items, yunet }));
  });
}

function parseSrt(txt) {
  const t = (s) => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : 0; };
  const out = [];
  for (const block of String(txt).replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    out.push({ start: t(a), end: t(b), text: lines.slice(i + 1).join('\n') });
  }
  return out;
}

module.exports = { createApi, parseSrt };
