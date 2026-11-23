'use strict';
// Monitory Zdroj a Program: velikost obrazu podle poměru stran, posuvník s playheadem a in/out, timecode.
const { SeqPlayer, sourceSeq } = require('./player');
const { timecode } = require('../core/util');

function fitScreen(monitor, screen, w, h, zoomSel) {
  const r = monitor.getBoundingClientRect();
  const ar = (w || 16) / (h || 9);
  let W = r.width - 8, H = W / ar;
  if (H > r.height - 8) { H = r.height - 8; W = H * ar; }
  // Select Zoom Level jako v Premiere: Fit, nebo pevné měřítko vůči rozlišení sekvence/klipu
  const z = zoomSel && zoomSel.value !== 'fit' ? Number(zoomSel.value) : 0;
  if (z) { W = (w || 1920) * z / (window.devicePixelRatio || 1); H = W / ar; }
  monitor.style.overflow = z ? 'auto' : 'hidden';
  screen.style.width = Math.max(10, Math.floor(W)) + 'px';
  screen.style.height = Math.max(10, Math.floor(H)) + 'px';
}

function bindScrub(el, getDur, getTime, onSeek, onEnd) {
  let down = false;
  const at = (ev) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * getDur(); };
  el.addEventListener('mousedown', (ev) => { down = true; onSeek(at(ev)); });
  window.addEventListener('mousemove', (ev) => { if (down) onSeek(at(ev)); });
  window.addEventListener('mouseup', () => { if (down) { down = false; if (onEnd) onEnd(); } });
}

function drawScrub(el, dur, t, a, b) {
  const ph = el.querySelector('.ph'), io = el.querySelector('.inout');
  ph.style.left = (dur ? t / dur * 100 : 0) + '%';
  if (a !== null && a !== undefined || b !== null && b !== undefined) {
    const A = a || 0, B = b !== null && b !== undefined ? b : dur;
    io.style.display = 'block';
    io.style.left = (dur ? A / dur * 100 : 0) + '%';
    io.style.width = (dur ? Math.max(0, B - A) / dur * 100 : 0) + '%';
  } else io.style.display = 'none';
}

/* ---------------- Program ---------------- */
function createProgram(app) {
  const $ = (id) => document.getElementById(id);
  const mon = $('prgScreen').parentElement, screen = $('prgScreen');
  const player = new SeqPlayer(screen, app.project, () => app.seq());
  const tc = $('prgTc'), dur = $('prgDur'), scrub = $('prgScrub'), title = $('prgTitle'), empty = $('prgEmpty');
  let following = false;

  // bezpečné zóny sítí pro 9:16 (přepínač v liště monitoru, pamatuje si stav)
  const zones = document.createElement('div');
  zones.className = 'safe-zones';
  zones.innerHTML = '<i class="z-top"></i><i class="z-right"></i><i class="z-bottom"></i><b>Reels / TikTok / Shorts UI</b>';
  screen.appendChild(zones);
  const safeBtn = $('prgSafe');
  let safeOn = (() => { try { return localStorage.getItem('pzSafeZones') !== '0'; } catch (e) { return true; } })();
  if (safeBtn) safeBtn.onclick = () => { safeOn = !safeOn; try { localStorage.setItem('pzSafeZones', safeOn ? '1' : '0'); } catch (e) { /* bez úložiště */ } layout(); };
  function layout() {
    const s = app.seq();
    fitScreen(mon, screen, s ? s.width : 16, s ? s.height : 9, $('prgFit'));
    const tall = !!(s && s.width / s.height < 0.7);
    screen.classList.toggle('tall', tall);
    screen.classList.toggle('safe-on', safeOn);
    if (safeBtn) { safeBtn.classList.toggle('show', tall); safeBtn.classList.toggle('on', safeOn); }
  }
  new ResizeObserver(layout).observe(mon);

  // úvodní obrazovka: bez sekvence ukázat, jak začít (import → AI → zadání), ne jen prázdný monitor
  let onboardKey = '';
  function onboard() {
    const cs = !!(window.TN && window.TN.lang === 'cs');
    const L = (en, czech) => (cs ? czech : en);
    const hasMedia = app.project.media.length > 0;
    const key = (cs ? 'cs' : 'en') + hasMedia + (window.__pzASR ? window.__pzASR.auto : ''); // text o přepisu podle volby (kolo 5)
    if (key === onboardKey) return;
    onboardKey = key;
    empty.className = 'mon-empty onboard';
    empty.innerHTML = '';
    const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    empty.appendChild(h('div', 'ob-title', hasMedia ? (window.__pzAiOk === false ? L('Open a clip', 'Otevři klip') : L('Open a clip or let the AI cut', 'Otevři klip, nebo nech stříhat AI')) : L('Start here', 'Začni tady')));
    const ol = h('ol', 'ob-steps');
    const step = (text, btnText, fn) => { const li = h('li'); li.appendChild(h('span', null, text)); if (btnText) { const b = h('button', null, btnText); b.onclick = fn; li.appendChild(b); } ol.appendChild(li); };
    if (!hasMedia) step(L('Import a video – or drop it anywhere in the window.', 'Importuj video – nebo ho přetáhni kamkoli do okna.'), L('Import video…', 'Importovat video…'), () => app.cmd('import'));
    else step(L('Double-click a clip in the Project panel to cut it by hand.', 'Dvojklikem na klip v panelu Projekt ho otevřeš a stříháš ručně.'));
    // „přepíše se sama“ jen když je automatický přepis zapnutý (redaktor-4: tvrdilo to i s vypnutou volbou)
    if (window.__pzASR) step(window.__pzASR.auto ? L('Speech is transcribed automatically – on the Transcript tab click a sentence and insert it.', 'Řeč se přepíše sama – v záložce Přepis klikni na větu a vlož ji.')
      : L('Start the transcript: right-click the clip → Transcribe Speech. Then find the quote on the Transcript tab and insert it into the sequence.', 'Přepis spustíš: pravý klik na klip → Přepsat řeč. Výrok pak najdeš v záložce Přepis a vložíš ho do sekvence.'), hasMedia ? L('Transcript', 'Přepis') : '', () => { if (app.transcript) app.transcript.showFor(); });
    if (window.__pzAiOk !== false) step(L('Or let the AI cut: write a task in the AI panel, e.g. “20 s teaser for Reels”.', 'Nebo nech stříhat AI: napiš zadání v panelu AI, třeba „20s upoutávka pro Reels“.'), L('AI panel', 'Panel AI'), () => app.cmd('toggleAi', true));
    else step(L('Then Sequence → Auto Reframe (9:16) and Export. Transcription and AI cutting need MY Premiere MCP (README, step 1).', 'Pak Sekvence → Auto Reframe (9:16) a Export. Přepis řeči a střih s AI potřebují MY Premiere MCP (README, bod 1).'));
    empty.appendChild(ol);
  }
  const offl = document.createElement('div');
  offl.className = 'mon-offline';
  screen.appendChild(offl);
  function offlineAt(s) {
    const t = s.playhead || 0;
    for (const tr of s.tracks.video) for (const c of tr.clips) {
      if (c.disabled || t < c.start || t >= c.start + (c.out - c.in)) continue;
      const m = app.project.mediaById(c.mediaId);
      if (m && m.missing) return m;
    }
    return null;
  }
  function ui() {
    const s = app.seq();
    const om = s && offlineAt(s);
    offl.classList.toggle('show', !!om);
    if (om) offl.textContent = (window.TN && window.TN.lang === 'cs' ? 'Médium offline: ' : 'Media Offline: ') + om.name;
    empty.style.display = s ? 'none' : 'block';
    if (!s) onboard();
    screen.style.visibility = s ? 'visible' : 'hidden';
    title.textContent = s ? `${s.name} · ${s.width}×${s.height} · ${s.fps} fps` : '(no sequence)';
    if (!s) { tc.textContent = dur.textContent = '00:00:00:00'; return; }
    const d = app.seqDuration(s);
    if (!tc.querySelector('input')) tc.textContent = timecode(s.playhead || 0, s.fps);
    const a = s.inPoint, b = s.outPoint;
    dur.textContent = timecode(a !== null || b !== null ? (b !== null ? b : d) - (a || 0) : d, s.fps);
    drawScrub(scrub, d, s.playhead || 0, a, b);
  }

  player.onTime = (t) => {
    const s = app.seq();
    if (!s) return;
    s.playhead = t;
    ui();
    app.timeline.setPlayheadView(t, player.playing);
  };
  player.onStop = () => { ui(); app.updatePlayButtons(); };

  bindScrub(scrub, () => { const s = app.seq(); return s ? app.seqDuration(s) : 0; }, null,
    (t) => { app.focusPanel('program'); app.setPlayhead(t, { scrub: true }); }, () => app.scrubEnd());
  editableTc(tc, { ok: () => !!app.seq(), fps: () => app.seq().fps || 25, now: () => app.seq().playhead || 0, max: () => app.seqDuration(app.seq()),
    seek: (t) => { app.focusPanel('program'); player.pause && player.pause(); app.setPlayhead(t); } });

  return {
    player, ui, layout,
    get playing() { return player.playing; },
    refresh() { layout(); ui(); player.refresh(); },
    seek(t) { player.seek(t); },
    play(r) { player.play(r); app.updatePlayButtons(); },
    pause() { if (player.playing) player.pause(); app.updatePlayButtons(); },
    toggle() { player.toggle(); app.updatePlayButtons(); },
    reset() { player.pause(); player.time = 0; layout(); ui(); player.seek((app.seq() || {}).playhead || 0); },
  };
}

/** Timecode v monitoru jde přepsat jako v Premiere (redaktorka S1): klik → čas (00:01:02:10; jen číslice zprava = 1021510 → 01:02:15:10;
 *  +15 / -15 = posun o snímky, +1:00 = o sekundu), Enter skočí, Esc / klik jinam zruší. */
function parseTcInput(v, fps, now) {
  v = String(v).trim();
  const rel = /^[+-]/.test(v) ? v[0] : '';
  const s = rel ? v.slice(1).trim() : v;
  let t;
  if (/^\d+$/.test(s)) {
    if (rel) t = Number(s) / fps;
    else { const d = s.padStart(8, '0').slice(-8); t = +d.slice(0, 2) * 3600 + +d.slice(2, 4) * 60 + +d.slice(4, 6) + +d.slice(6, 8) / fps; }
  } else {
    const p = s.split(/[:;.,]/).map((x) => (x === '' ? 0 : Number(x)));
    if (!p.length || p.length > 4 || p.some((x) => isNaN(x))) return NaN;
    while (p.length < 4) p.unshift(0);
    t = p[0] * 3600 + p[1] * 60 + p[2] + p[3] / fps;
  }
  if (rel === '+') t = now + t; else if (rel === '-') t = now - t;
  return Math.round(t * fps) / fps;
}
function editableTc(el, ctx) {
  if (!el) return;
  el.classList.add('tc-click');
  el.title = 'Click and type a time (Enter = go, +15 = 15 frames forward)';
  el.addEventListener('click', () => {
    if (el.querySelector('input') || !ctx.ok()) return;
    const old = el.textContent;
    const inp = document.createElement('input');
    inp.className = 'tc-edit'; inp.value = old; inp.spellcheck = false;
    el.textContent = ''; el.appendChild(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (go) => {
      if (done) return; done = true;
      const v = inp.value;
      el.textContent = old;
      if (!go) return;
      const t = parseTcInput(v, ctx.fps(), ctx.now());
      if (isFinite(t)) ctx.seek(Math.max(0, Math.min(ctx.max(), t)));
      else if (window.TN && window.TN.app) window.TN.app.status(window.TN.lang === 'cs' ? 'Neplatný čas – napiš třeba 00:01:02:10, 1015 nebo +5' : 'Invalid time – type e.g. 00:01:02:10, 1015 or +5', true);
    };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
    inp.addEventListener('blur', () => finish(false));
  });
}

/* ---------------- Zdroj ---------------- */
function createSource(app) {
  const $ = (id) => document.getElementById(id);
  const mon = $('srcScreen').parentElement, screen = $('srcScreen');
  let media = null, pseudo = null;
  const player = new SeqPlayer(screen, app.project, () => pseudo);
  const tc = $('srcTc'), dur = $('srcDur'), scrub = $('srcScrub'), title = $('srcTitle'), empty = $('srcEmpty');

  function layout() { fitScreen(mon, screen, media && media.hasVideo ? media.width : 16, media && media.hasVideo ? media.height : 9, $('srcFit')); }
  const offl = document.createElement('div');
  offl.className = 'mon-offline';
  screen.appendChild(offl);
  new ResizeObserver(layout).observe(mon);

  function ui() {
    empty.style.display = media ? 'none' : 'block';
    screen.style.visibility = media ? 'visible' : 'hidden';
    if (!media) { title.textContent = '(no clip)'; tc.textContent = dur.textContent = '00:00:00:00'; drawScrub(scrub, 0, 0, null, null); if (app.onSourceUi) app.onSourceUi(null, 0); return; }
    const fps = media.fps || 25;
    offl.classList.toggle('show', !!media.missing);
    if (media.missing) offl.textContent = (window.TN && window.TN.lang === 'cs' ? 'Médium offline: ' : 'Media Offline: ') + media.name;
    title.textContent = media.name + (media.proxy && !media.playable ? ' · proxy' : '') + (!media.playable && !media.proxy ? ' · creating proxy…' : '');
    if (!tc.querySelector('input')) tc.textContent = timecode(player.time, fps);
    const a = media.srcIn ?? null, b = media.srcOut ?? null;
    dur.textContent = timecode((b !== null ? b : media.duration) - (a || 0), fps);
    drawScrub(scrub, media.duration, player.time, a, b);
    if (app.onSourceUi) app.onSourceUi(media, player.time);
  }
  player.onTime = (t) => { if (media) media.srcPos = t; ui(); };
  player.onStop = () => { ui(); app.updatePlayButtons(); };

  bindScrub(scrub, () => (media ? media.duration : 0), null, (t) => { app.focusPanel('source'); player.pause(); player.seek(t); });
  editableTc(tc, { ok: () => !!media, fps: () => media.fps || 25, now: () => player.time, max: () => media.duration,
    seek: (t) => { app.focusPanel('source'); player.pause(); player.seek(t); ui(); } });

  // přetažení obrazu zdroje na timeline (s in/out)
  screen.draggable = true;
  screen.addEventListener('dragstart', (ev) => {
    if (!media) { ev.preventDefault(); return; }
    const a = media.srcIn ?? 0, b = media.srcOut ?? media.duration;
    ev.dataTransfer.setData('text/tn-source', JSON.stringify({ mediaId: media.id, inPoint: a, outPoint: b }));
    ev.dataTransfer.effectAllowed = 'copy';
    app.dragging = { type: 'source', dur: b - a, name: media.name, video: media.hasVideo, audio: media.hasAudio };
  });
  screen.addEventListener('dragend', () => { app.dragging = null; });

  return {
    player, ui, layout,
    get media() { return media; },
    get playing() { return player.playing; },
    open(m, opts = {}) {
      player.pause();
      media = m;
      pseudo = m ? sourceSeq(m) : null;
      if (m && opts.inPoint !== undefined) { m.srcIn = opts.inPoint; m.srcOut = opts.outPoint; }
      layout();
      player.seek(opts.at !== undefined ? opts.at : (m && (m.srcPos ?? m.srcIn)) || 0);
      ui();
      app.focusPanel('source');
    },
    refreshMedia() { if (media) { pseudo = sourceSeq(media); player.refresh(); ui(); } },
    close() { player.pause(); media = null; pseudo = null; player.refresh(); ui(); },
    seek(t) { player.seek(t); },
    play(r) { player.play(r); app.updatePlayButtons(); },
    pause() { if (player.playing) player.pause(); app.updatePlayButtons(); },
    toggle() { if (media) { player.toggle(); app.updatePlayButtons(); } },
    get time() { return player.time; },
  };
}

module.exports = { editableTc, parseTcInput, createProgram, createSource };
