'use strict';
// Přehrávání sekvence v monitoru: pro každý aktivní (a nejbližší další) klip jeden <video> prvek ze zásoby,
// další klip se předem nastaví na začátek, takže střih při přehrávání necukne. Zvuk přes WebAudio (hlasitost
// i nad 0 dB, prolnutí). Hodiny = performance.now(), prvky se k nim jen dorovnávají.
const CL = require('../core/captionlayout');
const { pathToFileURL } = require('url');
const { clipEnd } = require('../core/model');
const { dbToGain } = require('../core/util');
const importer = require('../core/importer');

let audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

const LOOKAHEAD = 0.8;

class SeqPlayer {
  /**
   * @param screen div monitoru (poměr stran nastavuje volající)
   * @param project projekt (média)
   * @param getSeq () => sekvence k přehrání (nebo pseudo-sekvence zdroje)
   */
  constructor(screen, project, getSeq) {
    this.screen = screen;
    this.project = project;
    this.getSeq = getSeq;
    this.time = 0;
    this.rate = 0;
    this.pool = [];
    this.onTime = null;
    this.onStop = null;
    this.raf = null;
    this.caption = document.createElement('div');
    this.caption.className = 'caption-overlay';
    this.capSpan = document.createElement('span');
    this.caption.appendChild(this.capSpan);
    screen.appendChild(this.caption);
    // nadpis nahoře (seq.title) – klik na něj otevře okno Text v obraze
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'title-overlay';
    screen.appendChild(this.titleEl);
    this.onTitleClick = null;
    this.titleKey = '';
    this.titleEl.addEventListener('mousedown', (ev) => { if (this.onTitleClick) { ev.preventDefault(); ev.stopPropagation(); this.onTitleClick(); } });
    // úprava titulku přímo v obraze (programový monitor): klik na titulek → psaní, Enter/klik jinam uloží, Esc zruší
    this.onCaptionEdit = null; // (index, text) => void – nastaví okno aplikace
    this.capEdit = null;       // { index, orig }
    this.capSpan.addEventListener('mousedown', (ev) => {
      if (!this.onCaptionEdit || this.capEdit || this.capIndex == null) return;
      ev.preventDefault(); ev.stopPropagation();
      this.editCaption(this.capIndex);
    });
    this.capSpan.addEventListener('keydown', (ev) => {
      if (!this.capEdit) return;
      ev.stopPropagation();
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); this.endCaptionEdit(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); this.endCaptionEdit(false); }
    });
    this.capSpan.addEventListener('blur', () => { if (this.capEdit) this.endCaptionEdit(true); });
    this.blank = document.createElement('div');
    this.blank.className = 'monitor-blank';
    screen.appendChild(this.blank);
    // zatmívačka / roztmívačka (Dip to Black / White) přes obraz
    this.dip = document.createElement('div');
    this.dip.className = 'dip-overlay';
    screen.appendChild(this.dip);
    // přesný zastavený snímek (web): Chrome přehrávač po skoku do GOP za ne-IDR I-snímkem (střih kamery) ukazuje
    // zastaralý obraz – stillProvider(clip, t) vrátí VideoFrame z WebCodecs, jinak null (viz web/web-glue.js)
    this.still = document.createElement('canvas');
    this.still.className = 'monitor-still';
    screen.insertBefore(this.still, this.caption);
    this.stillProvider = null;
    this.stillKey = '';
    this.loop = this.loop.bind(this);
    this.lastReverse = 0;
  }

  get playing() { return this.rate !== 0; }

  duration() {
    const s = this.getSeq();
    if (!s) return 0;
    let e = 0;
    for (const k of ['video', 'audio']) for (const t of s.tracks[k]) for (const c of t.clips) e = Math.max(e, clipEnd(c));
    return e;
  }

  /* ---------- zásoba prvků ---------- */
  elementFor(clip, kind) {
    let el = this.pool.find((e) => e._clipId === clip.id && e._kind === kind);
    if (el) return el;
    const m = this.project.mediaById(clip.mediaId);
    const file = m && importer.playPath(m);
    if (!file) return null;
    const url = pathToFileURL(file).href;
    el = this.pool.find((e) => !e._clipId && e._url === url && e._kind === kind) || this.pool.find((e) => !e._clipId && e._kind === kind && this.pool.length > 10);
    if (!el) {
      el = document.createElement('video');
      el.preload = 'auto';
      el.playsInline = true;
      el.className = 'monitor-video';
      el._kind = kind;
      if (kind === 'audio') {
        el.style.display = 'none';
        try {
          const ac = ctx();
          el._gain = ac.createGain();
          ac.createMediaElementSource(el).connect(el._gain);
          el._gain.connect(ac.destination);
        } catch (e) { el._gain = null; }
      } else el.muted = true;
      this.screen.insertBefore(el, this.caption);
      this.pool.push(el);
    }
    if (el._url !== url) { el.src = url; el._url = url; }
    el._clipId = clip.id;
    return el;
  }

  release(keep) {
    for (const el of this.pool) {
      if (el._clipId && !keep.has(el)) {
        el._clipId = null;
        if (!el.paused) el.pause();
        if (el._kind === 'video') el.style.visibility = 'hidden';
      }
    }
    // nadbytečné prvky uvolnit (dlouhé sekvence z mnoha souborů)
    while (this.pool.length > 14) {
      const i = this.pool.findIndex((e) => !e._clipId);
      if (i < 0) break;
      const [el] = this.pool.splice(i, 1);
      el.removeAttribute('src'); el.load(); el.remove();
    }
  }

  /* ---------- výpočet stavu v čase t ---------- */
  topVideo(seq, t) {
    const v = seq.tracks.video;
    for (let ti = v.length - 1; ti >= 0; ti--) {
      if (v[ti].muted) continue;
      const c = v[ti].clips.find((x) => !x.disabled && x.start <= t + 1e-6 && clipEnd(x) > t + 1e-6);
      if (c) return c;
    }
    return null;
  }
  /** Oblast Cross Dissolve v čase t na nejvyšší stopě, která tam něco má: {L, R, a, d}. */
  crossAt(seq, t) {
    const v = seq.tracks.video;
    for (let ti = v.length - 1; ti >= 0; ti--) {
      if (v[ti].muted) continue;
      for (const R of v[ti].clips) {
        if (!R.vIn || R.vIn.type !== 'cross' || R.disabled) continue;
        const d = R.vIn.dur, a = R.start - d / 2;
        if (t < a || t >= a + d) continue;
        const L = v[ti].clips.find((c) => Math.abs(clipEnd(c) - R.start) < 0.5 / (seq.fps || 25));
        if (L) return { L, R, a, d };
      }
      if (v[ti].clips.some((x) => !x.disabled && x.start <= t && clipEnd(x) > t)) return null;
    }
    return null;
  }

  audioAt(seq, t) {
    const out = [];
    for (const tr of seq.tracks.audio) {
      if (tr.muted) continue;
      if (seq._solo && !tr.solo) continue;
      const c = tr.clips.find((x) => !x.disabled && x.start <= t + 1e-6 && clipEnd(x) > t + 1e-6);
      if (c) out.push(c);
    }
    return out;
  }

  layout(el, clip, seq) {
    const m = this.project.mediaById(clip.mediaId);
    const W = seq.width, H = seq.height, iw = (m && m.width) || W, ih = (m && m.height) || H;
    const base = clip.fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    const k = base * (clip.scale || 1);
    const sw = iw * k, sh = ih * k;
    const left = sw >= W ? (W - sw) / 2 * (1 + (clip.posX || 0)) : (W - sw) / 2;
    const top = sh >= H ? (H - sh) / 2 * (1 + (clip.posY || 0)) : (H - sh) / 2;
    const key = `${sw}|${sh}|${left}|${top}`;
    if (el._layout === key) return;
    el._layout = key;
    el.style.width = (sw / W * 100) + '%';
    el.style.height = (sh / H * 100) + '%';
    el.style.left = (left / W * 100) + '%';
    el.style.top = (top / H * 100) + '%';
  }

  apply(force) {
    const seq = this.getSeq();
    if (!seq) { this.release(new Set()); this.blank.style.display = 'block'; return; }
    const t = this.time;
    const keep = new Set();
    // obraz (na samém konci sekvence poslední snímek, ne černo)
    const endT = this.duration();
    const vc = this.topVideo(seq, t) || (this.rate === 0 && endT > 0 && t >= endT - 1e-3 ? this.topVideo(seq, endT - 0.5 / (seq.fps || 25)) : null);
    const ahead = this.rate > 0 ? this.topVideo(seq, Math.min(this.duration(), t + LOOKAHEAD)) : null;
    let shown = null;
    if (vc) {
      const el = this.elementFor(vc, 'video');
      if (el) {
        keep.add(el);
        shown = el;
        this.layout(el, vc, seq);
        const want = Math.min(vc.out - 0.02, vc.in + (t - vc.start));
        if (this.rate > 0) {
          el.playbackRate = Math.min(4, this.rate);
          if (el.paused) { if (Math.abs(el.currentTime - want) > 0.04) el.currentTime = want; el.play().catch(() => {}); }
          // dorovnání skokem jen mimo poslední ~0,35 s klipu – skok těsně před střihem obraz zamrazí (zbytek klipu by stál)
          else if (Math.abs(el.currentTime - want) > 0.2 && clipEnd(vc) - t > 0.35) el.currentTime = want;
        } else {
          if (!el.paused) el.pause();
          if (force || Math.abs(el.currentTime - want) > 0.02) el.currentTime = want;
        }
      }
    }
    if (ahead && ahead !== vc) {
      const el = this.elementFor(ahead, 'video');
      if (el) {
        keep.add(el);
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - ahead.in) > 0.04 && !el.seeking) el.currentTime = ahead.in;
      }
      this.prefetchStill(ahead);
    }
    // Cross Dissolve: v oblasti přechodu hraje i druhý klip a postupně se přes první prolne
    let crossEl = null;
    const cr = this.crossAt(seq, t);
    if (cr) {
      const { L, R, a, d } = cr;
      const p = Math.max(0, Math.min(1, (t - a) / d));
      const pair = [[L, L.in + (t - L.start)], [R, R.in + (t - R.start)]];
      for (const [c, want0] of pair) {
        const el = this.elementFor(c, 'video');
        if (!el) continue;
        keep.add(el);
        this.layout(el, c, seq);
        const want = Math.max(0, want0);
        if (this.rate > 0) {
          el.playbackRate = Math.min(4, this.rate);
          if (el.paused) { el.currentTime = want; el.play().catch(() => {}); } else if (Math.abs(el.currentTime - want) > 0.2) el.currentTime = want;
        } else { if (!el.paused) el.pause(); if (force || Math.abs(el.currentTime - want) > 0.02) el.currentTime = want; }
        if (c === R) { crossEl = el; el.style.opacity = String(p); el.style.zIndex = 2; } else { el.style.opacity = '1'; el.style.zIndex = 1; }
      }
      shown = this.elementFor(L, 'video');
    }
    for (const el of this.pool) {
      if (el._kind !== 'video') continue;
      el.style.visibility = el === shown || el === crossEl ? 'visible' : 'hidden';
      if (el !== crossEl && !(cr && el === shown)) { el.style.opacity = '1'; el.style.zIndex = ''; }
    }
    this.blank.style.display = shown ? 'none' : 'block';
    // Dip to Black/White
    let dipA = 0, dipColor = '#000';
    const dc = cr ? null : vc;
    if (dc && dc.vIn && dc.vIn.type !== 'cross' && t - dc.start < dc.vIn.dur) { dipA = 1 - (t - dc.start) / dc.vIn.dur; dipColor = dc.vIn.type === 'dipWhite' ? '#fff' : '#000'; }
    if (dc && dc.vOut && clipEnd(dc) - t < dc.vOut.dur) { const a2 = 1 - (clipEnd(dc) - t) / dc.vOut.dur; if (a2 > dipA) { dipA = a2; dipColor = dc.vOut.type === 'dipWhite' ? '#fff' : '#000'; } }
    this.dip.style.background = dipColor;
    this.dip.style.opacity = String(Math.max(0, Math.min(1, dipA)));

    // zvuk (jen při přehrávání dopředu)
    if (this.rate > 0) {
      const acs = this.audioAt(seq, t);
      const next = this.audioAt(seq, Math.min(this.duration(), t + LOOKAHEAD)).filter((c) => !acs.includes(c));
      for (const c of acs) {
        const el = this.elementFor(c, 'audio');
        if (!el) continue;
        keep.add(el);
        const want = c.in + (t - c.start);
        el.playbackRate = Math.min(4, this.rate);
        if (el.paused) { el.currentTime = want; el.play().catch(() => {}); }
        else if (Math.abs(el.currentTime - want) > 0.15) el.currentTime = want;
        let g = dbToGain(c.gainDb);
        const into = t - c.start, left = clipEnd(c) - t;
        if (c.fadeIn > 0 && into < c.fadeIn) g *= Math.max(0, into / c.fadeIn);
        if (c.fadeOut > 0 && left < c.fadeOut) g *= Math.max(0, left / c.fadeOut);
        if (el._gain) el._gain.gain.value = g; else el.volume = Math.min(1, g);
      }
      for (const c of next) {
        const el = this.elementFor(c, 'audio');
        if (!el) continue;
        keep.add(el);
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - c.in) > 0.05 && !el.seeking) el.currentTime = c.in;
      }
    }
    this.release(keep);

    // titulky
    // nadpis nahoře: přepočítat jen při změně textu / velikosti / rozměru
    const tl = seq.title ? CL.titleLines(seq) : null;
    const tkey = tl ? JSON.stringify([tl.lines, tl.fs, tl.top, seq.width, seq.height]) : '';
    if (tkey !== this.titleKey) {
      this.titleKey = tkey;
      this.titleEl.style.display = tl ? 'block' : 'none';
      if (!tl) this.titleEl.innerHTML = ''; // skrytý starý nadpis nesmí zůstat ani v DOM (čtečky, testy)
      if (tl) {
        this.titleEl.innerHTML = '';
        for (const line of tl.lines) { const sp = document.createElement('span'); sp.textContent = line; this.titleEl.appendChild(sp); this.titleEl.appendChild(document.createElement('br')); }
        this.titleEl.style.top = tl.top + '%';
        this.titleEl.style.fontSize = (tl.fs / seq.height * 100).toFixed(3) + 'cqh';
      }
    }
    this.titleEl.classList.toggle('editable', !!this.onTitleClick);
    this.updateStill(seq, t, vc, shown, cr);
    if (this.capEdit) return; // právě se píše – text nepřepisovat
    const caps = seq.captions || [];
    const ci = caps.findIndex((c) => c.start <= t && c.end > t);
    this.capIndex = ci >= 0 ? ci : null;
    const txt = ci >= 0 ? caps[ci].text : '';
    const stH = CL.styleOf(seq);
    if (stH.highlight && ci >= 0) {
      // zvýraznění vyslovovaného slova: přestavět jen při změně titulku nebo aktivního slova
      const aw = CL.activeWord(caps[ci], t);
      const hk = ci + '|' + aw + '|' + txt + '|' + stH.highlight;
      if (this.capHl !== hk) {
        this.capHl = hk;
        this.capSpan.textContent = '';
        let k = 0;
        String(txt).split('\n').forEach((line, li) => {
          if (li) this.capSpan.appendChild(document.createTextNode('\n'));
          line.split(' ').filter(Boolean).forEach((w, wi) => {
            if (wi) this.capSpan.appendChild(document.createTextNode(' '));
            const e = document.createElement('b');
            e.textContent = w;
            if (k === aw) e.style.color = stH.highlight;
            e.style.fontWeight = 'inherit';
            this.capSpan.appendChild(e);
            k++;
          });
        });
      }
    } else {
      this.capHl = '';
      if (this.capSpan.textContent !== txt || this.capSpan.children.length) this.capSpan.textContent = txt;
    }
    this.caption.style.display = txt ? 'block' : 'none';
    // styl sekvence (src/core/captionlayout.js) – stejně jako vypálený export
    const st = CL.styleOf(seq);
    this.caption.style.bottom = st.pos + '%';
    this.caption.style.fontSize = (CL.fontFrac(seq.width, seq.height, st) * 100).toFixed(3) + 'cqh';
    this.capSpan.style.color = st.color || '#fff';
    this.caption.classList.toggle('boxed', !!st.box);
    this.caption.classList.toggle('editable', !!this.onCaptionEdit);
  }

  /**
   * Přesný snímek přes stillProvider (jen v úsecích, kde přehrávač ukazuje špatně – viz web/ai/stillframes.js):
   * zastavený obraz i přehrávání (při přehrávání se snímek dekóduje průběžně, pozdní snímky se zahodí).
   */
  updateStill(seq, t, vc, el, cr) {
    const hide = () => { this.stillKey = ''; this.still.style.display = 'none'; };
    if (!this.stillProvider || !vc || !el || cr || Math.abs(this.rate) > 1.01) { hide(); return; }
    const src = vc.in + (t - vc.start);
    if (this.stillNeeded && this.stillNeeded(vc, src) === false) { hide(); return; }
    const fps = seq.fps || 25;
    const geo = el.style.left + el.style.top + el.style.width + el.style.height;
    const key = vc.id + '|' + Math.round(src * fps) + '|' + geo;
    if (key === this.stillKey) return;
    this.stillKey = key;
    this.stillWant = { clip: vc.id, src, geo };
    // střih při přehrávání: první snímek nového klipu je dekódovaný předem (prefetchStill) – položit ho hned,
    // jinak by do doběhnutí dekodéru (~0,1–0,2 s) problikl zastaralý obraz přehrávače (předchozí záběr kamery)
    const pre = this.preStill;
    if (pre && pre.clip === vc.id && pre.frame && Math.abs(pre.src - src) < 2.5 / fps) {
      this.preStill = null;
      this.drawStill(pre.frame, el);
    }
    this.stillProvider(vc, src).then((fr) => {
      // přijmout i snímek, který dorazil o chvilku později (přehrávání), když je pořád ten správný klip a čas sedí ±2 snímky
      const w = this.stillWant;
      const fresh = this.stillKey === key || (this.rate !== 0 && w && w.clip === vc.id && w.geo === geo && fr && Math.abs(fr.timestamp / 1e6 - w.src) < 2.5 / fps);
      if (!fresh) { if (fr) fr.close(); return; }
      if (!fr) { this.still.style.display = 'none'; return; }
      this.drawStill(fr, el);
    }).catch(() => { if (this.stillKey === key) this.still.style.display = 'none'; });
  }

  /** Snímek z dekodéru přes video prvek el (stejná poloha a velikost); snímek se zavře. */
  drawStill(fr, el) {
    const W = this.screen.clientWidth, H = this.screen.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (this.still.width !== cw || this.still.height !== ch) { this.still.width = cw; this.still.height = ch; }
    const x = this.still.getContext('2d');
    x.clearRect(0, 0, this.still.width, this.still.height);
    const pct = (v) => parseFloat(v) / 100;
    x.drawImage(fr, pct(el.style.left) * this.still.width, pct(el.style.top) * this.still.height, pct(el.style.width) * this.still.width, pct(el.style.height) * this.still.height);
    fr.close();
    this.still.style.display = 'block';
  }

  /** Při přehrávání: další klip začíná v úseku, kde přehrávač ukazuje zastaralý obraz → jeho první snímek dekódovat předem. */
  prefetchStill(ahead) {
    if (!this.stillProvider || !this.stillNeeded || Math.abs(this.rate) > 1.01) return;
    const key = ahead.id + '|' + ahead.in;
    if (this.preStill && this.preStill.key === key) return;
    if (this.stillNeeded(ahead, ahead.in) !== true) return;
    if (this.preStill && this.preStill.frame) this.preStill.frame.close();
    const pre = { key, clip: ahead.id, src: ahead.in, frame: null };
    this.preStill = pre;
    this.stillProvider(ahead, ahead.in, { keep: true }).then((fr) => {
      if (this.preStill === pre && fr) pre.frame = fr; else if (fr) fr.close();
    }).catch(() => {});
  }

  /** Začne psaní do titulku s indexem i (přehrávací hlava už musí být v jeho čase). */
  editCaption(i) {
    const seq = this.getSeq();
    const c = seq && (seq.captions || [])[i];
    if (!c || !this.onCaptionEdit) return;
    if (this.rate) this.pause();
    this.capEdit = { index: i, orig: c.text };
    this.capSpan.textContent = c.text;
    this.caption.style.display = 'block';
    this.caption.classList.add('editing');
    try { this.capSpan.contentEditable = 'plaintext-only'; } catch (e) { this.capSpan.contentEditable = 'true'; }
    this.capSpan.focus();
    const r = document.createRange(); r.selectNodeContents(this.capSpan);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  endCaptionEdit(save) {
    const e = this.capEdit;
    if (!e) return;
    this.capEdit = null;
    this.capSpan.contentEditable = 'false';
    this.caption.classList.remove('editing');
    const text = this.capSpan.innerText.replace(/\s+/g, ' ').trim();
    if (save && text !== e.orig.replace(/\s+/g, ' ').trim()) this.onCaptionEdit(e.index, text); // prázdný text = smazat titulek
    this.capIndex = null;
    this.apply(true);
  }

  /* ---------- ovládání ---------- */
  seek(t, force = true) {
    this.time = Math.max(0, Math.min(t, Math.max(this.duration(), 0)));
    if (this.rate > 0) { this.t0 = this.time; this.w0 = performance.now(); }
    this.apply(force);
    if (this.onTime) this.onTime(this.time);
  }

  play(rate = 1) {
    ctx();
    if (this.time >= this.duration() - 0.02 && rate > 0) this.time = 0;
    this.rate = rate;
    this.t0 = this.time;
    this.w0 = performance.now();
    if (rate < 0) for (const el of this.pool) if (!el.paused) el.pause();
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  pause() {
    this.rate = 0;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    for (const el of this.pool) if (!el.paused) el.pause();
    this.apply(true);
    if (this.onStop) this.onStop(this.time);
  }

  toggle() { if (this.playing) this.pause(); else this.play(1); }

  /** Přehrát úsek [a, b) a zastavit (např. přehrát okolí střihu). */
  playRange(a, b) { this.seek(a); this.stopAt = b; this.play(1); }

  loop(now) {
    this.raf = null;
    if (!this.rate) return;
    let t = this.t0 + (now - this.w0) / 1000 * this.rate;
    const dur = this.duration();
    if (this.rate < 0) {
      if (now - this.lastReverse < 70) { this.raf = requestAnimationFrame(this.loop); return; }
      this.lastReverse = now;
    }
    if (this.stopAt !== undefined && t >= this.stopAt) { t = this.stopAt; this.stopAt = undefined; this.time = t; this.pause(); if (this.onTime) this.onTime(t); return; }
    if (t >= dur || t <= 0) {
      this.time = Math.max(0, Math.min(t, dur));
      this.pause();
      if (this.onTime) this.onTime(this.time);
      return;
    }
    this.time = t;
    this.apply(false);
    if (this.onTime) this.onTime(t);
    this.raf = requestAnimationFrame(this.loop);
  }

  refresh() { this.apply(true); }

  destroy() {
    this.pause();
    for (const el of this.pool) { el.removeAttribute('src'); el.load(); el.remove(); }
    this.pool = [];
  }
}

/** Pseudo-sekvence pro monitor Zdroj (jeden soubor celý). */
function sourceSeq(m) {
  const clipV = { id: 'srcV_' + m.id, mediaId: m.id, kind: 'video', start: 0, in: 0, out: m.duration, gainDb: 0, fit: 'contain', scale: 1 };
  const clipA = { id: 'srcA_' + m.id, mediaId: m.id, kind: 'audio', start: 0, in: 0, out: m.duration, gainDb: 0 };
  return {
    id: 'source', fps: m.fps || 25, width: m.width || 1920, height: m.height || 1080, captions: [],
    tracks: { video: [{ clips: m.hasVideo ? [clipV] : [] }], audio: [{ clips: m.hasAudio ? [clipA] : [] }] },
  };
}

module.exports = { SeqPlayer, sourceSeq, ctx };
