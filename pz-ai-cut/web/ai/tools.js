'use strict';
/* Nástroje, které Claude Desktop volá přes konektor (connector/server/tools.js popisuje jejich vstupy).
 * Provádí se tady, v prohlížeči: nad projektem střižny (stejné API jako desktop, src/core/pmcp-api.js)
 * a nad přepisy (ai/transcripts.js). Výsledky jsou krátký text pro Clauda. */
const vfs = require('../shims/vfs');
const T = require('./transcripts');
const CAP = require('./captions');
const RF = require('./reframe');
const { clipEnd, seqDuration } = require('../../src/core/model');
const { r3, timecode } = require('../../src/core/util');

const FORMATS = { '16:9': null, '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const fmt = (t) => (Math.round(t * 100) / 100).toFixed(2);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function createTools(ctx) {
  const app = () => window.TN.app;
  const project = () => app().project;

  function mediaOf(source) {
    const p = project();
    if (source) {
      const k = String(source);
      const m = p.mediaById(k) || p.media.find((x) => x.name === k) || p.media.find((x) => norm(x.name) === norm(k)) || p.media.find((x) => norm(x.name).includes(norm(k)));
      if (!m) throw new Error('Media not found: ' + source + '. Available: ' + p.media.map((x) => x.name).join(', '));
      return m;
    }
    const s = app().seq();
    const c = s && (s.tracks.audio.flatMap((t) => t.clips)[0] || s.tracks.video.flatMap((t) => t.clips)[0]);
    const m = c ? p.mediaById(c.mediaId) : p.media.find((x) => x.hasAudio);
    if (!m) throw new Error('No media in the project – the user must import a video first (File → Import or drag it in).');
    return m;
  }
  function fileOf(m) {
    const f = vfs.getFile(m.path);
    if (!f) throw new Error(`The file ${m.name} is not accessible – ask the user to click "Allow access to media" in the editor or import it again.`);
    return f;
  }
  async function transcriptOf(m) {
    const t = await T.loadForMedia(m) || T.partialForMedia(m);
    if (!t) throw new Error(`${m.name} has no transcript yet – call transcribe_media first.`);
    return t;
  }
  function seqOf(name) {
    const p = project();
    if (!name) { const s = app().seq(); if (!s) throw new Error('No sequence is open.'); return s; }
    const s = p.sequences.find((x) => x.id === name || x.name === name) || p.sequences.find((x) => norm(x.name) === norm(name));
    if (!s) throw new Error('Sequence not found: ' + name + '. Sequences: ' + p.sequences.map((x) => x.name).join(', '));
    return s;
  }
  function line(t, s) { return `${s.cont ? '↳' : ''}#${s.id} [${fmt(s.s)}–${fmt(s.e)}] ${T.textOf(t, s)}`; }

  /** Slova sekvence v čase timeline (z přepisů zdrojů klipů na zvukové stopě). */
  async function seqWords(s) {
    // stejná cesta jako tlačítko Titulky z přepisu: kraje klipů podle zvuku, ne podle středu slova v přepisu
    // (kolo 7: AI titulky vynechaly „Myslím“ – přepis ho časoval 0,5 s před In, ve zvuku zazní až za In)
    if (typeof window !== 'undefined' && window.__pzASR && window.__pzASR.seqWords) {
      try { return (await window.__pzASR.seqWords(s)).words.slice().sort((a, b) => a.s - b.s); } catch (e) { /* níž postaru */ }
    }
    const tracks = s.tracks.audio.filter((tr) => !tr.muted);
    const tr = tracks.find((x) => x.clips.length) || null;
    const out = [];
    if (!tr) return out;
    for (const c of tr.clips) {
      if (c.disabled) continue;
      const m = project().mediaById(c.mediaId);
      const t = m && await T.loadForMedia(m);
      if (!t) continue;
      for (const w of t.words) {
        const mid = (w.s + w.e) / 2;
        if (mid < c.in || mid >= c.out) continue;
        out.push({ w: w.w, s: c.start + Math.max(0, w.s - c.in), e: c.start + Math.min(c.out, w.e) - c.in });
      }
    }
    return out.sort((a, b) => a.s - b.s);
  }

  /** Formát pro sítě: rozměr sekvence + výřez podle obličeje (web/ai/reframe.js). Vrací popis pro AI. */
  async function setFormat(seqId, format) {
    const wh = FORMATS[format];
    if (!wh) return '';
    const p = project();
    const s = p.sequences.find((x) => x.id === seqId);
    p.edit('AI: Format ' + format, () => {
      s.width = wh[0]; s.height = wh[1];
      for (const tr of s.tracks.video) for (const c of tr.clips) { c.fit = 'cover'; c.posX = 0; c.posY = 0; }
    });
    try {
      const r = await RF.reframeSequence(app(), s, (m) => fileOf(m), ctx.progress);
      return `; reframed to faces: ${r.faced} of ${r.shots} shot(s)${r.splits ? `, ${r.splits} camera cut(s) split` : ''}`;
    } catch (e) {
      ctx.progress('', 1);
      return '; face reframing failed (' + e.message + ') – centre crop used';
    }
  }

  /** Bez převodu formátu: zbytky jiného záběru kamery na krajích klipů převezme soused (reframe to dělá sám). */
  async function edgeShots(seqId) {
    try {
      const r = await RF.fixEdgeShots(app(), seqOf(seqId), (m) => fileOf(m), ctx.progress);
      return r.merged ? `; ${r.merged} camera-cut leftover(s) at clip edges removed` : '';
    } catch (e) { ctx.progress('', 1); return ''; }
  }

  // konec obsahu sekvence (poslední klip) – titulky za něj nesmí přesahovat, jinak se sekvence prodlouží o černou
  function contentEnd(s) {
    let end = 0;
    for (const kind of ['video', 'audio']) for (const tr of (s.tracks[kind] || [])) for (const c of tr.clips) end = Math.max(end, c.start + (c.out - c.in));
    return end;
  }
  function captionsFor(s, words, style) {
    if (style) project().edit('AI: Caption style', () => { s.captionStyle = Object.assign(CAP.styleOf(s), style); });
    return CAP.layout(words, s, CAP.styleOf(s), contentEnd(s));
  }

  const tools = {
    async editor_status() {
      const p = project(), s = app().seq();
      const media = [];
      for (const m of p.media) {
        const t = !m.missing && (await T.loadForMedia(m) || T.partialForMedia(m));
        media.push(`- ${m.name} (id ${m.id}) ${timecode(m.duration || 0, m.fps || 25)}${m.hasVideo ? ` ${m.width}×${m.height}` : ' audio'}${m.missing ? ' – NOT ACCESSIBLE' : ''}${t ? ` – transcript ${t.language}, ${t.sentences.length} sentences${t.partial ? ` (still transcribing – done up to ${timecode(t.upTo, m.fps || 25)})` : ''}` : ''}`);
      }
      const seqs = p.sequences.map((q) => `- ${q.name}${s && q.id === s.id ? ' (active)' : ''} ${timecode(seqDuration(q), q.fps)} ${q.width}×${q.height}`);
      return `Project: ${p.name || 'Untitled'}\nMedia:\n${media.join('\n') || '(none – the user must import a video)'}\nSequences:\n${seqs.join('\n') || '(none)'}`;
    },

    async transcribe_media(a) {
      const m = mediaOf(a.source);
      const f = fileOf(m);
      // Claude Desktop nečeká na jedno volání desítky minut: po 50 s vrátit průběh a odhad, přepis běží dál
      const st = { p: 0, t0: Date.now(), p0: null, tp0: 0 };
      const onP = (p, msg) => {
        st.p = p;
        if (st.p0 === null && p > 0.005) { st.p0 = p; st.tp0 = Date.now(); }
        ctx.progress(p >= 1 ? '' : `Transcribing ${m.name} – ${msg}`, p);
      };
      const job = window.__pzASR && !a.language ? window.__pzASR.start(m, { onProgress: onP }) : T.transcribe(f, { language: a.language || 'cs', quality: ctx.quality() }, onP);
      const t = await Promise.race([job, new Promise((r) => setTimeout(() => r(null), 50000))]);
      if (!t) {
        let eta = '';
        if (st.p0 !== null && st.p > st.p0) {
          const rate = (st.p - st.p0) / ((Date.now() - st.tp0) / 1000);
          eta = `, about ${Math.max(1, Math.round((1 - st.p) / rate / 60))} min left`;
        }
        const part = T.partialForMedia(m);
        const partInfo = part && part.sentences.length ? ` The first ${fmt(part.upTo)} s are already transcribed (${part.sentences.length} sentences) – you can start reading them with get_transcript / search_transcript now; the last of them may still be cut off.` : '';
        return `Transcription of ${m.name} is running in the browser: ${Math.round(st.p * 100)} %${eta}.${partInfo} Tell the user, then call transcribe_media again later for the rest (it continues, nothing is lost).`;
      }
      ctx.progress('', 1);
      const head = t.sentences.slice(0, 40).map((s) => line(t, s)).join('\n');
      return `Transcript of ${m.name}: ${t.sentences.length} sentences, ${fmt(t.duration)} s, language ${t.language}${t.words.some((w) => w.approx) ? ' (word times approximate)' : ''}.\n${head}${t.sentences.length > 40 ? `\n… read more with get_transcript fromId=41` : ''}`;
    },

    async get_transcript(a) {
      const m = mediaOf(a.source);
      const t = await transcriptOf(m);
      const from = a.fromId || 1, to = a.toId || Math.min(t.sentences.length, from + 199);
      const rows = t.sentences.filter((s) => s.id >= from && s.id <= to).map((s) => {
        let r = line(t, s);
        if (a.words) r += '\n   ' + t.words.slice(s.w0, s.w1 + 1).map((w, i) => `${i}:${w.w}`).join(' ');
        return r;
      });
      const note = t.partial ? `\n(Partial transcript – transcription is still running, done up to ${fmt(t.upTo)} s of ${fmt(t.duration)} s. More sentences will follow; the last one may be cut off.)` : '';
      return `${m.name} – sentences ${from}–${to} of ${t.sentences.length}\n${rows.join('\n')}` + note;
    },

    async search_transcript(a) {
      const m = mediaOf(a.source);
      const t = await transcriptOf(m);
      const qs = String(a.query).split('|').map((q) => norm(q.trim())).filter(Boolean);
      const hits = t.sentences.filter((s) => { const x = norm(T.textOf(t, s)); return qs.some((q) => x.includes(q)); });
      return hits.length ? hits.slice(0, 80).map((s) => line(t, s)).join('\n') + (hits.length > 80 ? `\n… ${hits.length - 80} more` : '') : 'No match.';
    },

    async build_sequence_from_transcript(a) {
      const m = mediaOf(a.source);
      const f = fileOf(m);
      const t = await transcriptOf(m);
      const byId = new Map(t.sentences.map((s) => [s.id, s]));
      const ranges = [];
      const warnings = [];
      const picked = new Set();
      for (const pk of a.picks || []) {
        const o = typeof pk === 'object' ? pk : { id: pk };
        const s = byId.get(Number(o.id));
        if (!s) { warnings.push(`sentence #${o.id} does not exist`); continue; }
        picked.add(s.id);
        const wa = s.w0 + Math.max(0, o.fromWord || 0);
        const wb = o.toWord != null ? Math.min(s.w1, s.w0 + o.toWord) : s.w1;
        if (wb < wa) { warnings.push(`#${o.id}: empty word range`); continue; }
        const last = ranges[ranges.length - 1];
        if (last && last.b + 1 === wa) last.b = wb; else ranges.push({ a: wa, b: wb });
      }
      for (const id of picked) {
        const s = byId.get(id), nx = byId.get(id + 1);
        if (nx && nx.cont && !picked.has(nx.id)) warnings.push(`#${id} continues in #${nx.id}, which is not used – the thought may be cut`);
        if (s.cont && !picked.has(id - 1)) warnings.push(`#${id} continues #${id - 1}, which is not used – it may start mid-thought`);
      }
      if (!ranges.length) throw new Error('No valid picks.');
      const segments = [];
      let approx = false;
      for (const r of ranges) {
        const b = await T.cutBounds(f, t, r.a, r.b);
        segments.push({ source: m.id, in: b.in, out: b.out });
        if (b.approx) approx = true;
      }
      const res = await app().api.buildSequence({ name: a.name || 'AI edit', segments, audioFades: 2 / (m.fps || 25) });
      const fmtInfo = a.format && FORMATS[a.format] ? await setFormat(res.sequenceID, a.format) : await edgeShots(res.sequenceID);
      let capInfo = '';
      if (a.captions) {
        const s = seqOf(res.sequenceID);
        const caps = captionsFor(s, await seqWords(s));
        project().edit('AI: Captions', () => { s.captions = caps; });
        capInfo = `, ${caps.length} captions`;
      }
      app().timeline.zoomFit();
      return `Created sequence "${res.name}" – ${fmt(res.duration)} s, ${res.segments} cut(s)${a.format ? ', format ' + a.format + fmtInfo : ''}${capInfo}.`
        + (warnings.length ? '\nWarnings:\n- ' + warnings.join('\n- ') : '')
        + (approx ? '\nNote: in the web version cut points come from phrase timings (about ±0.2 s). Ask the user to listen to each cut and nudge it if a word is clipped (drag the clip edge, or Q / W at the playhead).' : '');
    },

    async build_sequence(a) {
      const segs = (a.segments || []).map((g) => ({ source: mediaOf(g.source).id, in: g.in, out: g.out }));
      const res = await app().api.buildSequence({ name: a.name || 'AI edit', segments: segs });
      const fmtInfo = a.format && FORMATS[a.format] ? await setFormat(res.sequenceID, a.format) : await edgeShots(res.sequenceID);
      app().timeline.zoomFit();
      return `Created sequence "${res.name}" – ${fmt(res.duration)} s${a.format ? ', format ' + a.format + fmtInfo : ''}.` + (res.warnings && res.warnings.length ? '\nWarnings: ' + res.warnings.join('; ') : '');
    },

    async get_sequence(a) {
      const s = seqOf(a.name);
      const rows = [];
      for (const kind of ['video', 'audio']) {
        s.tracks[kind].forEach((tr, ti) => tr.clips.forEach((c) => {
          const m = project().mediaById(c.mediaId);
          rows.push(`${kind[0].toUpperCase()}${ti + 1} ${fmt(c.start)}–${fmt(clipEnd(c))}  ${m ? m.name : '?'} [${fmt(c.in)}–${fmt(c.out)}]${c.disabled ? ' (disabled)' : ''}`);
        }));
      }
      return `Sequence "${s.name}" ${s.width}×${s.height} ${s.fps} fps, ${fmt(seqDuration(s))} s, markers ${s.markers.length}, captions ${(s.captions || []).length}${s.title && s.title.text ? `, headline "${s.title.text}"` : ''}\n${rows.join('\n')}`;
    },

    async sequence_text(a) {
      const s = seqOf(a.name);
      const words = await seqWords(s);
      if (!words.length) return 'No transcript for the clips of this sequence – transcribe their media first.';
      const out = [];
      let cur = [];
      for (let i = 0; i < words.length; i++) {
        cur.push(words[i]);
        const nx = words[i + 1];
        if (!nx || /[.?!…]$/.test(words[i].w) || nx.s - words[i].e > 1) { out.push(`[${fmt(cur[0].s)}–${fmt(cur[cur.length - 1].e)}] ${cur.map((w) => w.w).join(' ')}`); cur = []; }
      }
      return `"${s.name}" (${fmt(seqDuration(s))} s):\n` + out.join('\n');
    },

    async open_sequence(a) { const s = seqOf(a.name); app().openSequence(s.id); return `Opened "${s.name}".`; },

    async add_captions(a) {
      const s = seqOf(a.name);
      const style = {};
      if (a.lines) style.lines = Math.max(1, Math.min(3, a.lines));
      if (a.maxChars) style.maxChars = Math.max(12, Math.min(60, a.maxChars));
      if (a.highlight !== undefined) style.highlight = a.highlight ? '#ffd60a' : '';
      const caps = captionsFor(s, await seqWords(s), Object.keys(style).length ? style : null);
      if (!caps.length) throw new Error('No transcript for the clips of this sequence – transcribe their media first.');
      project().edit('AI: Captions', () => { s.captions = caps; });
      return `Added ${caps.length} captions to "${s.name}".`;
    },

    async get_captions(a) {
      const s = seqOf(a.name);
      const caps = s.captions || [];
      if (!caps.length) return `"${s.name}" has no captions.`;
      return `"${s.name}" – ${caps.length} captions (index [start–end] text, \\n = line break):\n` + caps.map((c, i) => `${i} [${fmt(c.start)}–${fmt(c.end)}] ${c.text.replace(/\n/g, '\\n')}`).join('\n');
    },

    async set_captions(a) {
      const s = seqOf(a.name);
      const orig = s.captions || [];
      const fixes = new Map();
      const bad = [];
      for (const fix of a.fixes || []) {
        if (orig[fix.index] && typeof fix.text === 'string') fixes.set(fix.index, fix.text.replace(/\\n/g, ' '));
        else bad.push(fix.index);
      }
      // neplatné indexy nahlásit (kolo 7, AI tok: tiše zahozené, a přesto „Updated N“) – nic se neuloží, ať AI nepracuje se starými indexy
      if (bad.length) throw new Error(`No caption with index ${bad.join(', ')} in "${s.name}" (valid 0–${orig.length - 1}). Nothing was changed – read the captions again with get_captions.`);
      // opravený text, který se do nastaveného počtu řádků nevejde, se rozdělí na víc titulků (CAP.retext)
      const caps = [];
      let split = 0;
      orig.forEach((c, i) => {
        if (!fixes.has(i)) { caps.push({ ...c }); return; }
        const parts = CAP.retext(s, c, fixes.get(i));
        if (parts.length > 1) split++;
        caps.push(...parts);
      });
      project().edit('AI: Fix Captions', () => { s.captions = caps; });
      return `Updated ${fixes.size} caption(s) in "${s.name}" (line breaks are set automatically to fit the frame${split ? `; ${split} too long for the line limit were split in two – indexes changed, read them again with get_captions` : ''}).`;
    },

    async reframe_sequence(a) {
      const s = seqOf(a.name);
      if (!window.__pzReframe) throw new Error('Reframing is not available.');
      const DIM = { '9:16': [9, 16, 1080, 1920], '4:5': [4, 5, 1080, 1350], '1:1': [1, 1, 1080, 1080] };
      const fmts = (a.formats && a.formats.length ? a.formats : ['9:16']).filter((f) => DIM[f]);
      if (!fmts.length) throw new Error('formats must be some of 9:16, 4:5, 1:1');
      const out = [];
      for (const f of fmts) {
        const [n, d, w, h] = DIM[f];
        const r = await window.__pzReframe(s, n, d, w, h);
        out.push(`Created sequence "${r.name}" (${w}×${h}) – faces found in ${r.facesFound} of ${r.shots} shot(s)${r.splits ? `, ${r.splits} camera cut(s) split` : ''}`);
      }
      return out.join('\n') + '\nCaptions were re-laid out for each format and the headline (if any) was kept.';
    },

    async set_title(a) {
      const s = seqOf(a.name);
      const text = String(a.text || '').replace(/\s+/g, ' ').trim();
      project().edit('AI: Headline', () => { if (text) s.title = { text, size: a.size || (s.title && s.title.size) || 1 }; else delete s.title; });
      app().program.refresh();
      if (!text) return `Headline removed from "${s.name}".`;
      const tl = CAP.titleLines(s);
      return `Headline on "${s.name}" (${tl.lines.length} line${tl.lines.length > 1 ? 's' : ''}: ${tl.lines.join(' / ')}). It is burned into the picture for the whole video.`
        + (tl.lines.length > 2 ? ' It is long – a shorter headline (about 30–45 characters) reads better on a phone.' : '');
    },

    async add_markers(a) {
      const s = seqOf(a.name);
      const r = app().api.addMarkers({ sequence: s.id, markers: (a.markers || []).map((x) => ({ time: x.time, name: x.name || '' })) });
      return `Added ${r.added} marker(s).`;
    },

    async undo() { const r = app().api.undo(); return r.undone ? `Undone: ${r.step}` : 'Nothing to undo.'; },

    async wait_task() { const t = await ctx.waitTask(50000); return t ? JSON.stringify(t) : 'no task'; },
    async report_task(a) { ctx.report(a); return 'ok'; },
  };

  return tools;
}

module.exports = { createTools };
