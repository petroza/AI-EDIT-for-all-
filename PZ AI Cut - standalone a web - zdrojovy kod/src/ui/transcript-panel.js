'use strict';
/* Záložka Přepis vedle panelu Projekt (team/design/design-1.md): text klipu ze Zdroje, hledání bez diakritiky,
 * klik na větu = In/Out Zdroje na hranicích věty v pauze (nikdy useknuté slovo), Shift+klik přidá věty, stav přepisu
 * se Zastavit/Pokračovat, upozornění na ruční In/Out uprostřed věty. Přepis dodává window.__pzASR (webová verze,
 * web/ai/bridge.js) – na desktopu záložka není. */

function createTranscriptPanel(app) {
  const $ = (id) => document.getElementById(id);
  const asr = () => window.__pzASR || null;
  const cs = () => !!(window.TN && window.TN.lang === 'cs');
  const L = (en, c) => (cs() ? c : en);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const panel = $('projectPanel'), pane = $('trPane'), tabP = $('tabProj'), tabT = $('tabTr'), tabState = $('trTabState'), warnEl = $('srcWarn');

  let active = 'project';
  try { const v = localStorage.getItem('pzProjTab'); if (v === 'tr' || v === 'cap') active = v; } catch (e) { /* bez úložiště */ }
  const tabC = $('tabCap');
  if (tabC) tabC.addEventListener('click', () => show('cap'));
  let autoSwitchedFor = null; // projekt, ve kterém se záložka už jednou sama přepnula
  // výběr vět: indexy a, b (souvislý úsek), kotva pro Shift+klik; inT/outT = In/Out, které nastavil klik na větu
  const sel = { mediaId: null, a: -1, b: -1, anchor: -1, inT: null, outT: null };
  let gen = 0;
  let query = '', hits = [], hitIdx = -1;
  let listKey = '';
  let stopAt = null; // přehrát výběr: zastavit na Out
  let userScrollAt = 0;
  let eta = { shown: null, at: 0 };

  /* ---------- data ---------- */
  function media() { return app.source.media || (app.projectPanel && app.projectPanel.selectedMedia()) || null; }
  function trOf(m) { const a = asr(); return a && m && !m.missing ? a.get(m) : null; }
  const loading = new Set();
  function ensureLoaded(m) {
    // přepis z úložiště prohlížeče (po obnovení stránky) – načíst jednou na pozadí
    const a = asr();
    if (!a || !m || m.missing || loading.has(m.id) || trOf(m)) return;
    loading.add(m.id);
    a.load(m).then((t) => { if (t) render(); });
  }
  function sentencesOf(t) {
    if (!t) return [];
    return t.sentences.map((s, i) => ({ i, s: s.s, e: s.e, w0: s.w0, w1: s.w1, text: t.words.slice(s.w0, s.w1 + 1).map((w) => w.w).join(' '),
      pending: !!t.partial && i === t.sentences.length - 1 }));
  }
  /* Vynechané halucinace (adresa webu, „Titulky vytvořil…“) jako řádek na svém místě (kolo 5, B6: pod „www…“ byla i skutečná řeč) –
   * klik přehraje úsek, ať redaktor slyší, jestli tam něco neříkají. Do výběru vět se nepočítá. */
  function withGaps(S, t) {
    const gaps = ((t && t.removed) || []).map((r) => ({ gap: true, s: r.s, e: r.e, text: r.text }));
    if (!gaps.length) return S;
    return S.concat(gaps).sort((a, b) => a.s - b.s || (a.gap ? -1 : 1));
  }
  function gapRow(g) {
    const tip = L(`Recognition made up “${g.text}” here (over music or silence) and it was left out. Click to listen – there may be speech.`, `Rozpoznávání si tu vymyslelo „${g.text}“ (nad hudbou nebo tichem) a vynechali jsme to. Klikni a poslechni – může tam být řeč.`);
    return `<div class="tr-gap" data-gs="${g.s}" data-ge="${g.e}" title="${esc(tip)}"><span class="tt">${mmss(g.s)}</span><span class="tx">${esc(L(`${mmss(g.s)}–${mmss(g.e)} not transcribed (music / maybe speech) ▶`, `${mmss(g.s)}–${mmss(g.e)} nepřepsáno (hudba / možná řeč) ▶`))}</span></div>`;
  }
  const mmss = (x) => { x = Math.max(0, x); const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = Math.floor(x % 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
  const durTxt = (x) => { x = Math.max(0, x); return x < 60 ? `0:${String(Math.round(x)).padStart(2, '0')}` : mmss(Math.round(x)); };
  function etaText(st) {
    if (st.eta == null || !isFinite(st.eta) || !st.tp0 || Date.now() - st.tp0 < 20000) return L('estimating the time…', 'odhaduji čas…');
    const now = Date.now();
    if (eta.shown == null || now - eta.at > 5000) { eta.shown = eta.shown == null ? st.eta : 0.6 * eta.shown + 0.4 * st.eta; eta.at = now; }
    const s = eta.shown;
    // pod minutu odpočet po 10 s – číslo se hýbe i mezi kousky přepisu (tasks-4 úkol 2.3: nic nestojí > 10 s)
    if (s < 60) { const left = Math.max(10, Math.ceil((s - (now - eta.at) / 1000) / 10) * 10); return L(`about ${left} s left`, `zbývá asi ${left} s`); }
    const min = s / 60;
    if (min <= 10) return L(`about ${Math.ceil(min)} min left`, `zbývá asi ${Math.ceil(min)} min`);
    if (min <= 60) return L(`about ${Math.round(min / 5) * 5} min left`, `zbývá asi ${Math.round(min / 5) * 5} min`);
    const h = Math.floor(min / 60), r = Math.round((min - h * 60) / 5) * 5;
    return L(`about ${h} h ${r} min left`, `zbývá asi ${h} h ${r} min`);
  }
  const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  /* ---------- záložky ---------- */
  function show(which, focusSearch) {
    if (which === 'tr' && !asr()) which = 'project';
    if (which !== 'tr' && which !== 'cap') which = 'project';
    active = which;
    try { localStorage.setItem('pzProjTab', which); } catch (e) { /* bez úložiště */ }
    panel.classList.toggle('show-tr', which === 'tr');
    panel.classList.toggle('show-cap', which === 'cap');
    tabP.classList.toggle('on', which === 'project');
    tabT.classList.toggle('on', which === 'tr');
    if (tabC) tabC.classList.toggle('on', which === 'cap');
    if (app.captionList) app.captionList.setVisible(which === 'cap');
    if (which !== 'tr' && app.projectPanel && app.projectPanel.paintAsr) app.projectPanel.paintAsr();
    if (which === 'tr') { listKey = ''; render(); if (focusSearch) setTimeout(() => { const q = $('trQ'); if (q) { q.focus(); q.select(); } }, 0); }
  }
  tabP.addEventListener('click', () => show('project'));
  let pfStoredHint = false; // přesný model už je v úložišti (pro odhad v menu)
  setInterval(async () => { const a = asr(); if (a && a.modelStored) pfStoredHint = await a.modelStored(); }, 5000);
  // menu ≡ v hlavičce (design-2 §3.1): v záložce Přepis přesnost a automatický přepis
  const menuBtn = $('projMenu');
  if (menuBtn) menuBtn.addEventListener('click', (ev) => {
    const a = asr();
    if (active !== 'tr' || !a) return;
    ev.stopPropagation();
    const m = media(), t = trOf(m);
    const items = [
      [(a.auto ? '✓ ' : '   ') + L('Transcribe new videos automatically', 'Automaticky přepisovat nová videa'), () => a.setAuto(!a.auto)],
      '-',
      [L('Transcript accuracy:', 'Přesnost přepisu:'), null],
      [(a.quality === 'accurate' ? '✓ ' : '   ') + (a.weak ? L('Accurate – not possible on this computer', 'Přesné – na tomto počítači nejde') : L('Accurate – fewer mistakes, takes longer', 'Přesné – méně chyb, trvá déle')), a.weak ? null : () => a.setQuality('accurate')],
      [(a.quality !== 'accurate' ? '✓ ' : '   ') + L('Standard – faster', 'Standardní – rychlejší'), () => a.setQuality('standard')],
    ];
    if (m && t && !t.partial) {
      items.push('-');
      if (!a.weak && !a.isAccurate(t)) {
        items.push([L('Transcribe whole clip more accurately…', 'Přepsat přesněji celý klip…'), () => app.cmd('transcribeAccurately', m)]);
        // rozdělený odhad (design-4 §2.3): stažení jen poprvé + přepis
        const est = a.accEstimate(m), pf = a.prefetch;
        const tr = est ? Math.max(1, Math.round(est / 60)) : null;
        const dl = pf.state === 'done' ? 0 : pf.state === 'running' && pf.total ? Math.max(1, Math.round((pf.total - pf.loaded) / 8.3e6 / 60)) : (pfStoredHint ? 0 : 2);
        if (tr) items.push([dl ? (pf.state === 'running' ? L(`   download finishing ~${dl} min + transcription ~${tr} min`, `   dostahuje se ~${dl} min + přepis ~${tr} min`) : L(`   download ~${dl} min (first time only) + transcription ~${tr} min`, `   stažení ~${dl} min (jen poprvé) + přepis ~${tr} min`)) : L(`   transcription ~${tr} min`, `   přepis ~${tr} min`), null]);
      }
      items.push([L('Transcribe again…', 'Přepsat znovu…'), () => app.cmd('transcribeAgain', m)]);
    }
    app.popupMenu(ev.clientX, ev.clientY, items);
  });
  tabT.addEventListener('click', () => show('tr'));

  function paintTab() {
    const a = asr();
    tabT.style.display = a ? '' : 'none';
    if (!a) { tabState.textContent = ''; return; }
    let txt = '', cls = '', title = '';
    let run = null, stopped = false, err = false;
    for (const m of app.project.media) {
      const st = a.status(m);
      if (st.state === 'running' && !run) run = st;
      if (st.state === 'stopped') stopped = true;
      if (st.state === 'error') err = true;
    }
    if (run) { txt = run.p > 0.0005 ? Math.floor(run.p * 100) + ' %' : '…'; cls = 'run'; }
    else if (err) { txt = '!'; cls = 'err'; title = L('Transcription failed', 'Přepis se nepodařil'); }
    else if (stopped) { txt = '‖'; cls = 'stop'; title = L('Transcription is stopped', 'Přepis je zastavený'); }
    tabState.textContent = txt;
    tabState.className = 'tr-tabstate ' + cls;
    tabT.title = title;
  }

  /* ---------- vykreslení ---------- */
  function render() {
    paintTab();
    if (active !== 'tr') return;
    const a = asr();
    const m = media();
    const t = trOf(m);
    if (m && !t) ensureLoaded(m);
    const st = a && m ? a.status(m) : { state: 'none' };
    const key = [cs(), m && m.id, m && m.missing, t && t.sentences.length, t && t.partial, t && t.upTo, st.state, app.project.media.length, a && a.fixesKey ? a.fixesKey(m) : ''].join('|');
    if (key !== listKey) { listKey = key; build(m, t, st); }
    paintStatus(m, st, t);
    paintSel();
    paintFoot();
  }

  function empty(title, text, btn) {
    const auto = asr() ? `<label class="tr-auto"><input type="checkbox" id="trAuto" ${asr().auto ? 'checked' : ''}> <span>${L('Transcribe new videos automatically', 'Automaticky přepisovat nová videa')}</span></label>` : '';
    return `<div class="tr-empty"><div class="tr-et">${esc(title)}</div><div class="tr-ed">${esc(text)}</div>${btn ? `<button class="tr-primary" id="trEmptyBtn">${esc(btn)}</button>` : ''}${btn ? auto : ''}</div>`;
  }

  function build(m, t, st) {
    const q0 = $('trQ');
    if (q0) query = q0.value; // rozepsané hledání (před debounce) nesmí zmizet
    let html = '';
    if (!app.project.media.length) html = empty(L('Here you will see what is said in the video', 'Tady uvidíš, co se ve videu říká'), (asr() && asr().auto === false ? L('Import a video – then start the transcript with right-click on the clip → Transcribe Speech (on this computer, without AI).', 'Importuj video – přepis pak spustíš pravým klikem na klip → Přepsat řeč (v tomto počítači, bez AI).') : L('Import a video – speech is transcribed automatically, on this computer and without AI.', 'Importuj video – řeč se přepíše sama, v tomto počítači a bez AI.')), L('Import video…', 'Importovat video…'));
    else if (!m) html = empty(L('Here you will see what is said in the video', 'Tady uvidíš, co se ve videu říká'), L('Double-click a clip on the Project tab.', 'Dvojklikem otevři klip v záložce Projekt.'));
    else if (m.missing) html = empty(L('The clip file is missing', 'Soubor klipu chybí'), (asr() && asr().desktop ? L('The file was moved or renamed – import it from the new place (File → Import), the clips reconnect to it automatically.', 'Soubor byl přesunut nebo přejmenován – naimportuj ho z nového místa (Soubor → Importovat), klipy se k němu samy připojí.') : L('Find it via the missing-media bar, then the transcript appears.', 'Najdi ho přes lištu Nenalezená média, pak se přepis ukáže.')));
    else if (m.hasAudio === false) html = empty(L('The clip has no sound', 'Klip nemá zvuk'), L('There is nothing to transcribe.', 'Není co přepsat.'));
    else if (!t && (st.state === 'none' || st.state === 'error')) {
      html = `<div class="tr-clip"><span class="nm">${esc(m.name)}</span></div><div id="trStatus"></div>`
        + empty(L('The speech in this clip is not transcribed yet', 'Řeč v klipu ještě není přepsaná'), L('Transcription runs on this computer, without AI. You can keep working meanwhile.', 'Přepis běží v tomto počítači, bez AI. Mezitím můžeš normálně pracovat.'), L('Transcribe speech', 'Přepsat řeč'));
    } else {
      const S = sentencesOf(t);
      if (t && !t.partial && !S.length) {
        html = `<div class="tr-clip"><span class="nm">${esc(m.name)}</span></div>` + empty(L('No speech found in this clip', 'V klipu jsme nenašli žádnou řeč'), L('If there is speech, try Transcribe again (menu ≡).', 'Pokud tam řeč je, zkus Přepsat znovu (menu ≡).'));
      } else {
        const wide = m.duration >= 3600 ? ' wide' : '';
        html = `<div class="tr-clip"><span class="nm" title="${esc(m.name)}">${esc(m.name)}</span><span class="dim" id="trCount"></span></div>
          <div class="tr-search"><input id="trQ" placeholder="${esc(L('Search the transcript (Ctrl+F)', 'Hledat v přepisu (Ctrl+F)'))}" value="${esc(query)}" spellcheck="false"><span id="trHits" class="tr-hits"></span>
          <button class="pf tr-nav" id="trPrev" title="${esc(L('Previous (Shift+Enter)', 'Předchozí (Shift+Enter)'))}">▲</button><button class="pf tr-nav" id="trNext" title="${esc(L('Next (Enter)', 'Další (Enter)'))}">▼</button></div>
          <div id="trStatus"></div><div id="trPf" class="pf-line" hidden></div>
          <div class="tr-list${wide}" id="trList" tabindex="0">${withGaps(S, t).map((s) => s.gap ? gapRow(s) : `<div class="tr-row${s.pending ? ' pending' : ''}" data-i="${s.i}" ${s.pending ? `title="${esc(L('This sentence is still being transcribed', 'Tahle věta se ještě dopisuje'))}"` : ''}><span class="tt">${mmss(s.s)}</span><span class="tx">${esc(s.text)}</span></div>`).join('')}
          ${t && t.partial ? `<div class="tr-more"><i></i>${esc(L(`Transcribing further… (done up to ${mmss(t.upTo)})`, `Přepisuji dál… (hotovo do ${mmss(t.upTo)})`))}</div>` : ''}</div>
          <div class="tr-foot" id="trFoot"></div>`;
      }
    }
    const list0 = $('trList');
    // na konec jen když se dopisuje rozpracovaný přepis a uživatel byl na konci (vzhled S2: po dokončení skočil na poslední větu)
    const keepScroll = list0 ? list0.scrollTop : 0, atEnd = list0 && list0.querySelector('.tr-more') ? list0.scrollTop + list0.clientHeight >= list0.scrollHeight - 4 : false;
    const hadFocus = document.activeElement && document.activeElement.id === 'trQ';
    pane.innerHTML = html;
    const list = $('trList');
    if (list) { list.scrollTop = atEnd ? list.scrollHeight : keepScroll; bindList(list); }
    const q = $('trQ');
    if (q) {
      let deb = null;
      q.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { query = q.value; search(true); }, 150); });
      q.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') { ev.preventDefault(); query = q.value; if (!hits.length) search(true); else step(ev.shiftKey ? -1 : 1); }
        else if (ev.key === 'Escape') { ev.preventDefault(); if (q.value) { q.value = ''; query = ''; search(false); } else if (list) list.focus(); }
        else if (ev.key === 'ArrowDown') { ev.preventDefault(); const r = hits[hitIdx] && list.querySelector(`.tr-row[data-i="${hits[hitIdx].si}"]`); (r || list).focus && list.focus(); focusRow(hits[hitIdx] ? hits[hitIdx].si : 0); }
      });
      if (hadFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      $('trPrev').onclick = () => step(-1);
      $('trNext').onclick = () => step(1);
    }
    const eb = $('trEmptyBtn');
    if (eb) eb.onclick = () => { if (!app.project.media.length) app.cmd('import'); else if (m) start(m); };
    const au = $('trAuto');
    if (au) au.onchange = () => asr().setAuto(au.checked);
    if (query) search(false); else { hits = []; hitIdx = -1; paintHits(); }
    const c = $('trCount');
    if (c && t) {
      c.textContent = L(`${t.sentences.length} sentences`, `${t.sentences.length} ${t.sentences.length === 1 ? 'věta' : t.sentences.length < 5 ? 'věty' : 'vět'}`) + (t.partial ? '' : asr().isAccurate(t) ? L(' · accurate', ' · přesný přepis') : L(' · standard', ' · standardní přepis'));
      c.title = asr().isAccurate && asr().isAccurate(t) ? L('Accurate transcript', 'Přesný přepis') : L('Standard transcript – right-click the clip → Transcribe More Accurately', 'Standardní přepis – přesnější: pravý klik na klip → Přepsat přesněji');
      // vynechané halucinace (adresa webu, „Titulky vytvořil…“) – automatika nic nemaže potichu (developer-rules 12)
      const rm = (t.removed || []).length;
      // malá výška okna (řádek s názvem skrytý): počet vět v políčku hledání
      const q1 = $('trQ');
      if (q1) { q1.placeholder = L(`Search ${t.sentences.length} sentences (Ctrl+F)`, `Hledat v ${t.sentences.length} ${t.sentences.length === 1 ? 'větě' : 'větách'} (Ctrl+F)`); q1.title = c.textContent + (rm ? L(` · ${rm} omitted`, ` · vynecháno ${rm}`) : ''); }
      if (rm) {
        c.textContent += L(` · ${rm} omitted`, ` · vynecháno ${rm}`);
        c.title += '\n' + L('Omitted – words the recognition made up over music or silence:', 'Vynecháno – slova, která rozpoznávání vymyslelo nad hudbou nebo tichem:') + '\n' + t.removed.map((r) => `${mmss(r.s)} „${r.text}“`).join('\n');
      }
    }
  }

  function paintStatus(m, st, t) {
    const box = $('trStatus');
    if (!box) return;
    const a = asr();
    let html = '';
    const bar = (p) => `<div class="tr-bar"><i style="width:${Math.max(1, Math.round((p || 0) * 100))}%"></i></div>`;
    if (st.state === 'queued') {
      let other = '';
      for (const x of app.project.media) if (x !== m && a.status(x).state === 'running') other = x.name;
      // standalone: hotový přepis se teprve načítá (Worker / mezipaměť) – ne „čeká na přepis“ (vzhled S3)
      html = a.desktop && st.msg && !other
        ? `<div class="tr-st"><span><b>${esc(L('Loading the transcript…', 'Načítám přepis…'))}</b></span></div><div class="tr-bar indet"><i></i></div>`
        : `<div class="tr-st"><span><b>${esc(L('Waiting to transcribe', 'Čeká na přepis'))}</b>${other ? ' · ' + esc(L(`“${other}” is finished first`, `nejdřív se dopíše „${other}“`)) : ''}</span><button id="trStop">${esc(L('Stop', 'Zastavit'))}</button></div>`;
    } else if (st.state === 'running') {
      const prep = !(st.p > 0.0005) || /model/.test(st.msg || '');
      // stahování (jen poprvé, součet MB všech souborů) × načítání z mezipaměti (pár sekund, „jen poprvé“ by lhalo)
      const dl = /download/.test(st.msg || '') && /(\d+) \/ (\d+) MB/.exec(st.msg || '');
      const up = st.upgrade;
      html = prep
        ? (dl
          ? `<div class="tr-st"><span><b>${esc(L(`Downloading speech recognition… ${dl[1]} of ${dl[2]} MB`, `Stahuji rozpoznávání řeči… ${dl[1]} z ${dl[2]} MB`))}</b> · ${esc(L('only once', 'jen jednou'))}</span><button id="trStop">${esc(L('Stop', 'Zastavit'))}</button></div>${bar(+dl[1] / Math.max(1, +dl[2]))}`
          : `<div class="tr-st"><span><b>${esc(st.accurate ? L('Preparing the accurate transcript…', 'Připravuji přesný přepis…') : L('Preparing the transcript…', 'Připravuji přepis…'))} <span class="tr-prep">${prepClock(st)}</span></b> · ${esc(prepHint(st))}${st.upgrade ? esc(L(' · the current transcript stays valid', ' · zatím platí dosavadní přepis')) : ''}</span><button id="trStop">${esc(L('Stop', 'Zastavit'))}</button></div><div class="tr-bar indet"><i></i></div>`)
        : `<div class="tr-st"><span><b>${esc(up ? L(`Transcribing more accurately… ${Math.floor(st.p * 100)} %`, `Přepisuji přesněji… ${Math.floor(st.p * 100)} %`) : L(`Transcribing speech… ${Math.floor(st.p * 100)} %`, `Přepisuji řeč… ${Math.floor(st.p * 100)} %`))}</b> · ${esc(etaText(st))}${up ? esc(L(' · the current transcript stays valid meanwhile', ' · zatím platí dosavadní přepis')) : ''}${a.weak ? '<br><span class="dim">' + esc(L('This computer can only do the standard transcript – the accurate one would take too long.', 'Na tomto počítači jde jen standardní přepis – přesný by trval příliš dlouho.')) + '</span>' : ''}</span><button id="trStop">${esc(L('Stop', 'Zastavit'))}</button></div>${bar(st.p)}`;
    } else if (st.state === 'stopped') {
      const up = t && t.upTo;
      // standalone: Worker rozpracovanou část neukládá – nic neslibovat, tlačítko spustí přepis znovu (vzhled S3)
      html = a.desktop
        ? `<div class="tr-st"><span><b>${esc(L('Transcription stopped', 'Přepis zastaven'))}</b></span><button id="trGo" class="go">${esc(L('Start again', 'Spustit znovu'))}</button></div>`
        : `<div class="tr-st"><span><b>${esc(up ? L(`Transcription stopped at ${mmss(up)}`, `Přepis zastaven u ${mmss(up)}`) : L('Transcription stopped', 'Přepis zastaven'))}</b> (${Math.floor((st.p || 0) * 100)} %) · ${esc(L('you can use the finished part', 'hotovou část můžeš používat'))}</span><button id="trGo" class="go">${esc(L('Resume', 'Pokračovat'))}</button></div>${bar(st.p)}`;
    } else if (st.state === 'error') {
      html = `<div class="tr-st err"><span><b>${esc(L('Transcription failed.', 'Přepis se nepodařil.'))}</b> ${esc(errText(st.msg))}</span><button id="trGo">${esc(L('Try again', 'Zkusit znovu'))}</button></div>`;
    } else {
      eta = { shown: null, at: 0 };
      // po standardním přepisu na pomalejším počítači: nabídka přesného s odhadem (design-3 §2.1)
      // řádek nabídky „Přepsat přesněji“ zmizel (kolo 5: na notebooku titulky přepíšou přesně jen použité úseky; celý klip je v menu ≡)
      if (st.state === 'done' && t && !t.partial && a.weak && !(a.isAccurate && a.isAccurate(t))) {
        html = `<div class="tr-st offer"><span>${esc(L('This computer can only do the standard transcript – the accurate one would take too long here.', 'Na tomto počítači jde jen standardní přepis – přesný by tu trval příliš dlouho.'))}</span></div>`;
      }
    }
    const htmlKey = html.replace(/<span class="tr-prep">[^<]*<\/span>/, '');
    if (box.dataset.h !== htmlKey) {
      box.dataset.h = htmlKey;
      box.innerHTML = html;
      const sb = $('trStop'); if (sb) sb.onclick = () => { a.stop(m); app.toast(a.desktop ? L('Transcription stopped. Start it again any time.', 'Přepis zastaven. Spustíš ho znovu kdykoli.') : L('Transcription stopped. You can use the finished part.', 'Přepis zastaven. Hotovou část můžeš používat.')); };
      const gb = $('trGo'); if (gb) gb.onclick = () => start(m);
      const ox = $('trOfferX'); if (ox) ox.onclick = () => a.hideOffer(m);
      const ob = $('trOffer'); if (ob) ob.onclick = () => app.cmd('transcribeAccurately', m);
    }
    const hits0 = $('trHits');
    if (hits0 && t && t.partial && query) paintHits();
  }
  /* Stahování přesného modelu na pozadí (design-4 §2.1): stejný text v Přepisu i v Projektu, MB se mění, při zastavení hodiny. */
  const pfView = { last: -1, at: 0, doneAt: 0 };
  function pfText() {
    const a = asr();
    if (!a || !a.preciseCaptions) return null;
    const p = a.prefetch;
    const mb = (x) => Math.round(x / 1048576).toLocaleString(window.TN && window.TN.lang === 'cs' ? 'cs-CZ' : 'en-US');
    if (p.state === 'running') {
      if (p.loaded !== pfView.last) { pfView.last = p.loaded; pfView.at = Date.now(); }
      const stall = Date.now() - pfView.at > 10000 ? Math.floor((Date.now() - pfView.at) / 1000) : 0;
      const clock = stall ? ` · ${L('waiting for network', 'čekám na síť')} ${Math.floor(stall / 60)}:${String(stall % 60).padStart(2, '0')}` : '';
      return { cls: '', frac: p.total ? p.loaded / p.total : 0, text: L(`Preparing accurate captions: downloading ${mb(p.loaded)} / ${mb(p.total || 1087000000)} MB`, `Připravuji přesné titulky: stahuji ${mb(p.loaded)} / ${mb(p.total || 1087000000)} MB`) + clock };
    }
    if (p.state === 'done') {
      if (!pfView.doneAt) pfView.doneAt = Date.now();
      if (Date.now() - pfView.doneAt < 5000) return { cls: 'ok', frac: 1, text: L('✓ Downloaded – captions from the transcript will be accurate', '✓ Staženo – titulky z přepisu budou přesné') };
      return null;
    }
    if (p.state === 'error') return { cls: 'err', frac: 0, text: L('Accurate captions could not be downloaded – check the internet.', 'Přesné titulky se nestáhly – zkontroluj internet.'), retry: true };
    return null;
  }
  function paintPf() {
    const v = pfText();
    for (const id of ['trPf', 'projPf']) {
      const el = $(id);
      if (!el) continue;
      if (!v) { el.hidden = true; el.dataset.h = ''; continue; }
      const h = v.cls + '|' + v.text;
      el.hidden = false;
      el.title = L('Only the first time, about 1 GB. It does not slow the computer down, you can keep working. Captions from the transcript then transcribe the used parts accurately.', 'Jen poprvé, asi 1 GB. Počítač to nezdržuje, můžeš pracovat. Titulky z přepisu pak přepíšou použité úseky přesně.');
      if (el.dataset.h !== h) {
        el.dataset.h = h;
        el.className = 'pf-line ' + v.cls;
        el.innerHTML = `<span>${esc(v.text)}</span>${v.retry ? `<button>${esc(L('Try again', 'Zkusit znovu'))}</button>` : ''}<i></i>`;
        const b = el.querySelector('button'); if (b) b.onclick = () => asr().retryPrefetch();
      }
      el.querySelector('i').style.width = Math.round(v.frac * 100) + '%';
    }
  }
  setInterval(paintPf, 500);
  // příprava (načtení z disku): běžící čas a poctivá poznámka (design-3 §2.3); minulá délka v localStorage pzAsrPrepSec
  function prepClock(st) { if (!st.prep0) st.prep0 = Date.now(); const s = Math.floor((Date.now() - st.prep0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function prepHint(st) {
    let last = 0; try { last = Number(localStorage.getItem('pzAsrPrepSec')) || 0; } catch (e) { /* bez úložiště */ }
    const s = st.prep0 ? (Date.now() - st.prep0) / 1000 : 0;
    if (last && s > 60 && s > 2 * last) return L('taking longer than usual', 'trvá déle než obvykle');
    if (!last) return L('usually a few seconds to 2 min', 'obvykle pár sekund až 2 min');
    return last < 20 ? L('last time a few seconds', 'minule pár sekund') : last < 90 ? L('last time about a minute', 'minule asi minutu') : L(`last time about ${Math.round(last / 60)} min`, `minule asi ${Math.round(last / 60)} min`);
  }
  function errText(msg) {
    msg = String(msg || '');
    if (/fetch|network|download|Failed to load/i.test(msg)) return L('Could not download speech recognition. Check the internet connection – it is downloaded only the first time.', 'Nepodařilo se stáhnout rozpoznávání řeči. Zkontroluj připojení k internetu – stahuje se jen poprvé.');
    if (/memory|allocation|OOM/i.test(msg)) return L('The computer ran out of memory. Close other tabs or programs and try again.', 'Počítači došla paměť. Zavři jiné karty nebo programy a zkus to znovu.');
    if (/audio|decode|codec/i.test(msg)) return L('The sound in this file cannot be read. Save the video as MP4 (H.264, AAC) and import it again.', 'Zvuk v tomhle souboru neumíme přečíst. Ulož video jako MP4 (H.264, AAC) a importuj znovu.');
    return L('Something went wrong during speech recognition.', 'Při rozpoznávání řeči se něco pokazilo.');
  }
  function start(m, force) {
    const a = asr();
    if (!a || !m) return;
    eta = { shown: null, at: 0 };
    a.start(m, { force: !!force }).catch(() => {});
    render();
  }

  /* ---------- hledání ---------- */
  function search(jump) {
    const m = media(), t = trOf(m);
    hits = []; hitIdx = -1;
    const S = sentencesOf(t);
    const q = norm(query.trim()).replace(/\s+/g, ' ');
    if (q && S.length) {
      // celý text (věty oddělené mezerou) v normalizované podobě s mapou na původní znaky – fráze i přes hranici vět
      let flat = '';
      const map = []; // index ve flat -> [věta, znak]
      S.forEach((s, si) => {
        if (si) { flat += ' '; map.push([si, -1]); }
        for (let k = 0; k < s.text.length; k++) { const n = norm(s.text[k]); for (const ch of n) { flat += ch; map.push([si, k]); } }
      });
      let from = 0;
      for (;;) {
        const at = flat.indexOf(q, from);
        if (at < 0) break;
        const ranges = new Map(); // věta -> [od, do)
        for (let x = at; x < at + q.length; x++) { const [si, k] = map[x]; if (k < 0) continue; const r = ranges.get(si); if (!r) ranges.set(si, [k, k + 1]); else r[1] = k + 1; }
        const si0 = map[at][0] >= 0 && map[at][1] >= 0 ? map[at][0] : map[at + 1][0];
        hits.push({ si: si0, ranges });
        from = at + Math.max(1, q.length);
      }
      if (hits.length) {
        // první nález od místa, kde stojí výběr / přehrávání
        hitIdx = 0;
        if (jump && sel.a >= 0) { const k = hits.findIndex((h) => h.si >= sel.a); if (k >= 0) hitIdx = k; }
      }
    }
    paintMarks();
    paintHits();
    if (jump && hitIdx >= 0) scrollToRow(hits[hitIdx].si, true);
  }
  function step(d) {
    if (!hits.length) return;
    hitIdx = (hitIdx + d + hits.length) % hits.length;
    paintMarks(); paintHits();
    scrollToRow(hits[hitIdx].si, true);
  }
  function paintHits() {
    const el = $('trHits');
    if (!el) return;
    const t = trOf(media());
    if (!query.trim()) { el.textContent = ''; return; }
    el.textContent = hits.length ? `${hitIdx + 1} / ${hits.length}` + (t && t.partial ? L(` · so far up to ${mmss(t.upTo)}`, ` · zatím do ${mmss(t.upTo)}`) : '') : L('Not found', 'Nenalezeno');
  }
  function paintMarks() {
    const list = $('trList');
    if (!list) return;
    const S = sentencesOf(trOf(media()));
    const per = new Map(); // věta -> [[od, do, aktuální]]
    hits.forEach((h, hi) => { for (const [si, r] of h.ranges) { if (!per.has(si)) per.set(si, []); per.get(si).push([r[0], r[1], hi === hitIdx]); } });
    list.querySelectorAll('.tr-row').forEach((row) => {
      const i = +row.dataset.i, s = S[i];
      if (!s) return;
      const tx = row.querySelector('.tx');
      const rs = per.get(i);
      if (!rs) { if (tx.dataset.m) { tx.textContent = s.text; delete tx.dataset.m; } return; }
      rs.sort((x, y) => x[0] - y[0]);
      let h = '', k = 0;
      for (const [a, b, cur] of rs) { if (a < k) continue; h += esc(s.text.slice(k, a)) + `<mark${cur ? ' class="cur"' : ''}>` + esc(s.text.slice(a, b)) + '</mark>'; k = b; }
      h += esc(s.text.slice(k));
      tx.innerHTML = h; tx.dataset.m = '1';
    });
  }

  /* ---------- výběr vět ---------- */
  function bindList(list) {
    list.addEventListener('mousedown', (ev) => { if (ev.shiftKey) ev.preventDefault(); }); // Shift+klik nevybírá text
    list.addEventListener('click', (ev) => {
      const g = ev.target.closest('.tr-gap');
      if (g) { const m = media(); if (m && app.source.media !== m) app.openSource(m); app.source.seek(+g.dataset.gs); stopAt = +g.dataset.ge; app.source.play(1); return; }
      const row = ev.target.closest('.tr-row');
      if (!row || row.classList.contains('pending')) return;
      pick(+row.dataset.i, ev.shiftKey, false);
    });
    list.addEventListener('dblclick', (ev) => {
      const row = ev.target.closest('.tr-row');
      if (!row || row.classList.contains('pending')) return;
      window.getSelection && window.getSelection().removeAllRanges();
      pick(+row.dataset.i, ev.shiftKey, true);
    });
    list.addEventListener('wheel', () => { userScrollAt = Date.now(); }, { passive: true });
    list.addEventListener('keydown', (ev) => {
      const S = sentencesOf(trOf(media()));
      const cur = list.querySelector('.tr-row.kf');
      let i = cur ? +cur.dataset.i : (sel.b >= 0 ? sel.b : -1);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault(); ev.stopPropagation();
        i = Math.max(0, Math.min(S.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)));
        if (ev.shiftKey) pick(i, true, false); else focusRow(i);
      } else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); if (i >= 0) pick(i, ev.shiftKey, false); }
      else if (ev.key === 'c' && ev.ctrlKey && sel.a >= 0) {
        ev.preventDefault(); ev.stopPropagation();
        const txt = S.slice(sel.a, sel.b + 1).map((s) => s.text).join(' ');
        try { navigator.clipboard.writeText(txt); app.toast(L('Text copied', 'Text zkopírován')); } catch (e) { /* bez schránky */ }
      }
    });
  }
  function focusRow(i) {
    const list = $('trList');
    if (!list) return;
    list.querySelectorAll('.tr-row.kf').forEach((r) => r.classList.remove('kf'));
    const r = list.querySelector(`.tr-row[data-i="${i}"]`);
    if (r) { r.classList.add('kf'); scrollToRow(i, false); }
  }
  function scrollToRow(i, center) {
    const list = $('trList');
    const r = list && list.querySelector(`.tr-row[data-i="${i}"]`);
    if (!r) return;
    const top = r.offsetTop - list.offsetTop, h = r.offsetHeight;
    if (center) list.scrollTop = top - list.clientHeight / 3;
    else if (top < list.scrollTop) list.scrollTop = top;
    else if (top + h > list.scrollTop + list.clientHeight) list.scrollTop = top + h - list.clientHeight;
  }
  async function pick(i, shift, play) {
    const m = media(), t = trOf(m), a = asr();
    if (!t || !a) return;
    const S = t.sentences;
    if (!S[i]) return;
    if (app.source.media !== m) app.openSource(m);
    if (shift && sel.mediaId === m.id && sel.anchor >= 0) { sel.a = Math.min(sel.anchor, i); sel.b = Math.max(sel.anchor, i); }
    else { sel.anchor = i; sel.a = sel.b = i; }
    // poslední (dopisovaná) věta rozpracovaného přepisu se nevybírá
    if (t.partial) sel.b = Math.min(sel.b, S.length - 2);
    if (sel.b < sel.a) return;
    sel.mediaId = m.id;
    focusRow(i);
    paintSel();
    app.source.pause();
    stopAt = null;
    const my = ++gen;
    const b = await a.cutBounds(m, t, S[sel.a].w0, S[sel.b].w1);
    if (my !== gen || app.source.media !== m) return;
    m.srcIn = b.in; m.srcOut = b.out;
    sel.inT = b.in; sel.outT = b.out; sel.inOk = b.inOk !== false; sel.outOk = b.outOk !== false;
    app.source.seek(b.in);
    app.source.ui();
    app.focusPanel('source'); // I / O / mezerník / „,“ teď patří Zdroji
    paintSel(); paintFoot(); paintWarn();
    if (play) playSel();
  }
  function playSel() {
    const m = app.source.media;
    if (!m || m.srcIn == null) return;
    app.source.seek(m.srcIn);
    stopAt = m.srcOut;
    app.source.play(1);
  }
  function selValid(m) { return m && sel.mediaId === m.id && sel.a >= 0 && sel.inT != null && Math.abs((m.srcIn ?? -1) - sel.inT) < 0.002 && Math.abs((m.srcOut ?? -1) - sel.outT) < 0.002; }
  function paintSel() {
    const list = $('trList');
    if (!list) return;
    const m = media();
    const S = sentencesOf(trOf(m));
    const mine = m && sel.mediaId === m.id && sel.a >= 0 && (sel.inT == null || selValid(m));
    // ruční In/Out: zvýraznit věty, které celé pokrývá, a oranžově větu, kde leží bod uprostřed
    const manual = !mine && m && (m.srcIn != null || m.srcOut != null);
    const mi = manual ? (m.srcIn ?? 0) : 0, mo = manual ? (m.srcOut ?? m.duration) : 0;
    const mids = manual ? midSentences(m) : { inS: -1, outS: -1 };
    const playT = app.source.media === m ? app.source.time : -1;
    list.querySelectorAll('.tr-row').forEach((row) => {
      const i = +row.dataset.i, s = S[i];
      if (!s) return;
      const on = mine ? i >= sel.a && i <= sel.b : manual && s.s >= mi - 0.05 && s.e <= mo + 0.05;
      row.classList.toggle('sel', !!on);
      row.classList.toggle('mid', manual && (i === mids.inS || i === mids.outS));
      row.classList.toggle('play', playT >= s.s && playT < s.e);
    });
  }
  function paintFoot() {
    const f = $('trFoot');
    if (!f) return;
    const m = media();
    const n = selValid(m) ? sel.b - sel.a + 1 : 0;
    let html;
    if (!n) html = `<span class="tip">${esc(L('Click a sentence = start and end of the part. Shift+click adds more sentences.', 'Klikni na větu = začátek a konec úseku. Shift+klik přidá další věty.'))}</span>`;
    else {
      const d = m.srcOut - m.srcIn;
      const noSeq = !app.seq();
      // rada nesmí vést mimo výběr (review-3: „přidej předchozí větu“ = 6 s navíc) – jen co to znamená a co udělat
      const flow = !sel.inOk && !sel.outOk ? L('⚠ Start and end are in continuous speech – listen whether a word is cut.', '⚠ Začátek i konec v souvislé řeči – poslechni, jestli není useknuté slovo.')
        : !sel.outOk ? L('⚠ The end is in continuous speech – listen whether the last word is cut.', '⚠ Konec v souvislé řeči – poslechni, jestli není useknuté poslední slovo.')
        : !sel.inOk ? L('⚠ The start is in continuous speech – listen whether the first word is cut.', '⚠ Začátek v souvislé řeči – poslechni, jestli není useknuté první slovo.') : '';
      // po vložení je patička v jednom řádku (report-5: varování + „✓ V nové sekvenci“ = 2 řádky → stav 07 o větu méně): varování jako ⚠ s bublinou
      const done = insDone();
      html = (flow ? (done ? '' : `<div class="tr-flow">${esc(flow)}</div>`) : '') + (done ? (flow ? `<span class="tr-flow-i" title="${esc(flow)}">⚠</span>` : '') + doneSpan() + '<span class="spacer"></span>' : `<span class="cnt">${n} ${L(n === 1 ? 'sentence' : 'sentences', n === 1 ? 'věta' : n < 5 ? 'věty' : 'vět')} · ${durTxt(d)}</span><span class="spacer"></span>`)
        + `<button id="trPlay" title="${esc(L('Play the selection (Space)', 'Přehrát výběr (mezerník)'))}">▶<span class="lbl"> ${esc(L('Play', 'Přehrát'))}</span></button>`
        + insButtons(noSeq);
    }
    if (f.dataset.h === html) return;
    f.dataset.h = html;
    f.innerHTML = html;
    const pb = $('trPlay'); if (pb) pb.onclick = playSel;
    const ib = $('trIns');
    if (ib) ib.onclick = () => doInsert();
    const mb = $('trInsMore');
    if (mb) mb.onclick = () => insMenu(mb);
    const nx = $('trCapNext'); // (dřív id trNext = stejné jako šipka hledání → tlačítko nereagovalo, redaktor-5)
    if (nx) nx.onclick = () => app.cmd('captionsFromTranscript');
  }
  /* Tlačítka vložení (kolo 5, B1, design-4 §1): z Přepisu jen na hranici klipů – text říká, kam úsek půjde; ▾ = další možnosti
   * včetně nové sekvence jedním klikem. Po vložení: „✓ Na konci · 0:19–0:38“ a hlavní tlačítko = další krok (titulky). */
  let lastIns = null; // { seqId, at, dur, where, key }
  /** Platí stav „vloženo“? Stejná sekvence, stejný výběr a vložený klip tam pořád je (Ctrl+Z stav zruší). */
  function insDone() {
    const s = app.seq(), m = media();
    if (!lastIns || !s || !m || lastIns.seqId !== s.id || lastIns.key !== `${m.id}|${sel.a}|${sel.b}`) return false;
    const ok = s.tracks.audio.concat(s.tracks.video).some((tr) => tr.clips.some((c) => c.mediaId === m.id && Math.abs(c.start - lastIns.at) < 0.05 && Math.abs((c.out - c.in) - lastIns.dur) < 0.05));
    if (!ok) lastIns = null;
    return ok;
  }
  function doneSpan() {
    return `<span class="ins-done">✓ ${esc(lastIns.where === 'end' ? L('At the end', 'Na konci') : lastIns.where === 'new' ? L('In new sequence', 'V nové sekvenci') : L(`Inserted at ${mmss(lastIns.at)}`, `Vloženo na ${mmss(lastIns.at)}`))} · ${mmss(lastIns.at)}–${mmss(lastIns.at + lastIns.dur)}</span>`;
  }
  function insPlace(s) {
    if (!s) return { where: 'new' };
    const p = app.editCore.transcriptInsertPoint(s, s.playhead);
    if (p.where === 'playhead' && p.at < 0.01) return { where: 'start', at: 0 };
    return p;
  }
  function insLabel(p) {
    if (p.where === 'new') return [L('Insert into new sequence', 'Vložit do nové sekvence'), L('Creates a new sequence with this part.', 'Vytvoří novou sekvenci s tímto úsekem.')];
    if (p.where === 'start') return [L('Insert at start', 'Vložit na začátek'), L('Inserts the part before the first clip. Everything else moves on.', 'Vloží úsek před první klip. Všechno ostatní se posune dál.')];
    if (p.where === 'playhead') return [L(`Insert at playhead · ${mmss(p.at)}`, `Vložit na hlavu · ${mmss(p.at)}`), L(`Inserts the part at the clip boundary at ${mmss(p.at)}. Clips and captions after it move on.`, `Vloží úsek na hranici klipů v ${mmss(p.at)}. Klipy a titulky za ní se posunou dál.`)];
    const s = app.seq(), inside = s && Math.abs(p.at - s.playhead) > 0.5;
    return [L('Add to end of sequence', 'Přidat na konec sekvence'), L(`Adds the part after the last clip. Nothing gets cut, captions stay with their clips.${inside ? ' The playhead is inside a clip, so the part goes to the end. Put the playhead on a clip boundary (↑ / ↓ on the timeline) to insert it elsewhere.' : ''}`, `Přidá úsek za poslední klip. Nic se nerozřízne, titulky zůstanou u svých klipů.${inside ? ' Hlava stojí uvnitř klipu, proto se úsek přidá na konec. Jinam ho vložíš, když hlavu postavíš na hranici klipů (↑ / ↓ na časové ose).' : ''}`)];
  }
  function insButtons(noSeq) {
    const s = app.seq(), m = media();
    const key = m ? `${m.id}|${sel.a}|${sel.b}` : '';
    // stav po vložení: další krok místo druhého vložení téhož úseku
    if (insDone()) {
      const hasCaps = (s.captions || []).length > 0;
      const next = hasCaps ? L('Add captions…', 'Doplnit titulky…') : L('Captions from transcript…', 'Titulky z přepisu…');
      return `<button class="tr-primary split" id="trCapNext">${esc(next)}</button><button class="tr-primary tr-more" id="trInsMore" title="${esc(L('More insert options (Alt+↓)', 'Další možnosti vložení (Alt+↓)'))}">▾</button>`;
    }
    const p = insPlace(noSeq ? null : s);
    const [lbl, tip] = insLabel(p);
    return `<button class="tr-primary split" id="trIns" title="${esc(tip)}">${esc(lbl)}</button><button class="tr-primary tr-more" id="trInsMore" title="${esc(L('More insert options (Alt+↓)', 'Další možnosti vložení (Alt+↓)'))}">▾</button>`;
  }
  function insMenu(btn) {
    const s = app.seq(), r = btn.getBoundingClientRect();
    const p = s ? app.editCore.transcriptInsertPoint(s, s.playhead) : null;
    const items = [];
    if (s) {
      items.push([L('Add to end of sequence', 'Přidat na konec sekvence'), () => doInsert('end')]);
      // hlava na konci sekvence = „Přidat na konec“ výše; šedá položka jen když hlava opravdu stojí uvnitř klipu (report-5 C10)
      const atEnd = p && p.where === 'end' && Math.abs(p.at - s.playhead) <= 0.5;
      if (p && p.where === 'playhead' && p.at > 0.01) items.push([L(`Insert at playhead · ${mmss(p.at)}`, `Vložit na hlavu · ${mmss(p.at)}`), () => doInsert()]);
      else if (!atEnd) items.push([L('Insert at playhead – the playhead is inside a clip', 'Vložit na hlavu – hlava je uvnitř klipu'), null]);
      items.push([L('Insert at start', 'Vložit na začátek'), () => doInsert('start')]);
      items.push('-');
    }
    items.push([L('Into new sequence…', 'Do nové sekvence…'), () => doInsert('new')]);
    app.popupMenu(Math.max(0, r.right - 260), r.top - 30 * items.length - 8, items);
  }
  function doInsert(mode) {
    const m = media(), s0 = app.seq();
    const res = app.insertFromTranscript(mode);
    if (res) lastIns = Object.assign({}, res, { key: m ? `${m.id}|${sel.a}|${sel.b}` : '' });
    else if (mode === 'new' || !s0) {
      // nová sekvence vzniká dialogem: stav „V nové sekvenci“ až když opravdu vznikne
      const before = app.project.sequences.length;
      const t = setInterval(() => { const s = app.seq(); if (app.project.sequences.length > before && s) { clearInterval(t); lastIns = { seqId: s.id, at: 0, dur: (m.srcOut - m.srcIn), where: 'new', key: m ? `${m.id}|${sel.a}|${sel.b}` : '' }; paintFoot(); } }, 300);
      setTimeout(() => clearInterval(t), 120000);
    }
    paintFoot();
    app.focusPanel('source');
  }


  /* ---------- upozornění: ruční In/Out uprostřed věty ---------- */
  function midSentences(m) {
    const t = trOf(m);
    const out = { inS: -1, outS: -1 };
    if (!t) return out;
    const S = t.sentences;
    const lim = t.partial ? t.upTo : Infinity;
    const find = (x) => S.findIndex((s) => x > s.s + 0.25 && x < s.e - 0.25 && s.e < lim);
    if (m.srcIn != null && m.srcIn > 0.01) out.inS = find(m.srcIn);
    if (m.srcOut != null && m.srcOut < m.duration - 0.01) out.outS = find(m.srcOut);
    return out;
  }
  let warnKey = '';
  function paintWarn() {
    if (!warnEl) return;
    const m = app.source.media;
    const ok = m && asr() && trOf(m) && !selValid(m);
    const mids = ok ? midSentences(m) : { inS: -1, outS: -1 };
    const key = [cs(), m && m.id, mids.inS, mids.outS, warnEl.clientWidth > 0].join('|');
    if (key === warnKey) return;
    warnKey = key;
    if (mids.inS < 0 && mids.outS < 0) { warnEl.innerHTML = ''; warnEl.classList.remove('on'); return; }
    const t = trOf(m), S = sentencesOf(t);
    const narrow = (warnEl.parentElement && warnEl.parentElement.clientWidth < 520);
    let txt, btn, tip;
    if (mids.inS >= 0 && mids.outS >= 0) { txt = L('Start and end are mid-sentence', 'Začátek i konec jsou uprostřed věty'); btn = L('Snap to whole sentences', 'Přichytit na celé věty'); tip = ''; }
    else if (mids.outS >= 0) { const s = S[mids.outS]; txt = L('The end is mid-sentence', 'Konec je uprostřed věty'); btn = L('Snap to end of sentence', 'Přichytit na konec věty'); tip = L(`Out moves to ${mmss(s.e)} – the end of “…${s.text.slice(-30)}”`, `Out se posune na ${mmss(s.e)} – konec věty „…${s.text.slice(-30)}“`); }
    else { const s = S[mids.inS]; txt = L('The start is mid-sentence', 'Začátek je uprostřed věty'); btn = L('Snap to start of sentence', 'Přichytit na začátek věty'); tip = L(`In moves to ${mmss(s.s)} – the start of “${s.text.slice(0, 30)}…”`, `In se posune na ${mmss(s.s)} – začátek věty „${s.text.slice(0, 30)}…“`); }
    if (narrow) { tip = txt + (tip ? ' – ' + tip : ''); txt = L('Mid-sentence', 'Uprostřed věty'); btn = L('Snap', 'Přichytit'); }
    warnEl.innerHTML = `<span class="w">⚠ ${esc(txt)}</span><button id="srcSnap" title="${esc(tip)}">${esc(btn)}</button>`;
    warnEl.classList.add('on');
    $('srcSnap').onclick = () => snap(m, mids);
  }
  async function snap(m, mids) {
    const t = trOf(m), a = asr();
    if (!t || !a) return;
    const S = t.sentences;
    if (mids.inS >= 0) { const b = await a.cutBounds(m, t, S[mids.inS].w0, S[mids.inS].w1); m.srcIn = b.in; }
    if (mids.outS >= 0) { const b = await a.cutBounds(m, t, S[mids.outS].w0, S[mids.outS].w1); m.srcOut = b.out; }
    // přichycený rozsah = celé věty od In do Out → vybrat je i v seznamu
    const i0 = S.findIndex((s) => s.s >= (m.srcIn ?? 0) - 0.3), i1 = (() => { let k = -1; S.forEach((s, i) => { if (s.e <= (m.srcOut ?? m.duration) + 0.3) k = i; }); return k; })();
    if (i0 >= 0 && i1 >= i0) { sel.mediaId = m.id; sel.a = i0; sel.b = i1; sel.anchor = i0; sel.inT = m.srcIn ?? 0; sel.outT = m.srcOut ?? m.duration; if (m.srcIn == null) m.srcIn = 0; if (m.srcOut == null) m.srcOut = m.duration; }
    app.source.ui();
    warnKey = '';
    paintWarn(); paintSel(); paintFoot();
  }

  /* ---------- napojení ---------- */
  let lastSrc = { id: null, a: null, b: null, t: -1 };
  app.onSourceUi = (m, time) => {
    if (stopAt != null && m && time >= stopAt - 0.02) { stopAt = null; app.source.pause(); }
    const k = { id: m && m.id, a: m && m.srcIn, b: m && m.srcOut };
    const changed = k.id !== lastSrc.id || k.a !== lastSrc.a || k.b !== lastSrc.b;
    if (k.id !== lastSrc.id) { sel.a = sel.b = sel.anchor = -1; sel.inT = sel.outT = null; }
    if (changed) { lastSrc = { ...k, t: time }; if (active === 'tr') { render(); } paintWarn(); return; }
    // přehrávání: zvýraznit hrající větu a držet ji v zorném poli (ne během hledání / chvíli po ručním rolování)
    if (active === 'tr' && Math.abs(time - lastSrc.t) > 0.1) {
      lastSrc.t = time;
      paintSel();
      if (app.source.playing && !query && Date.now() - userScrollAt > 3000) {
        const list = $('trList'); const r = list && list.querySelector('.tr-row.play');
        if (r) scrollToRow(+r.dataset.i, false);
      }
    }
  };
  /** Dvojklik na klip (Zdroj): záložka Přepis se jednou za projekt sama ukáže, když klip má přepis. */
  function onSourceOpen(m) {
    sel.a = sel.b = sel.anchor = -1; sel.inT = sel.outT = null;
    query = query; listKey = '';
    const a = asr();
    if (a && m && autoSwitchedFor !== app.project && active !== 'tr') {
      const st = a.status(m);
      if (trOf(m) || st.state === 'running' || st.state === 'queued') { autoSwitchedFor = app.project; show('tr'); return; }
    }
    render();
  }
  // běžící čas přípravy: překreslit stav každou sekundu, dokud se připravuje
  setInterval(() => { if (selValid(media())) paintFoot(); }, 300); // popisek Vložit podle hlavy a otevřené sekvence (design-4 §0)
  setInterval(() => { const m0 = media(), a0 = asr(), s0 = m0 && a0 && a0.status(m0); if (s0 && s0.state === 'running' && s0.p > 0.0005 && eta.shown != null && eta.shown < 60) paintStatus(m0, s0, trOf(m0)); }, 1000);
  setInterval(() => { const box = $('trStatus'); const c = box && box.querySelector('.tr-prep'); if (c) { const m = media(); const st = m && asr() && asr().status(m); if (st) c.textContent = prepClock(st); } }, 1000);
  let raf = 0;
  const later = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); };
  let hookTries = 0;
  if (active === 'cap') setTimeout(() => show('cap'), 0); // Titulky nepotřebují přepis (i desktop)
  function hook() {
    const a = asr();
    if (!a) { if (++hookTries < 20) setTimeout(hook, 500); return; } // desktop: přepis v aplikaci není – záložka zůstane skrytá
    a.on(() => { later(); if (app.projectPanel && app.projectPanel.paintAsr) app.projectPanel.paintAsr(); });
    show(active);
    render();
  }
  let firstFor = null, mediaCount = app.project.media.length;
  app.project.on((what) => {
    if (what === 'media') {
      const n = app.project.media.length;
      if (n === 0) { firstFor = null; autoSwitchedFor = null; } // Nový projekt (stejný objekt projektu) = znovu od začátku
      if (mediaCount === 0 && n > 0 && firstFor !== app.project && asr()) {
        firstFor = app.project;
        const m = app.project.media[n - 1];
        setTimeout(() => { if (!app.source.media) app.openSource(m); show('tr'); }, 0);
      } else if (n > mediaCount && active === 'tr' && !media()) {
        setTimeout(() => app.openSource(app.project.media[n - 1]), 0); // prázdný Přepis ukáže nový klip
      }
      mediaCount = n;
    }
    if (what === 'media' || what === 'edit') { if (what === 'media') listKey = ''; later(); }
  });
  hook();

  return {
    render, show, onSourceOpen,
    /** po přepnutí jazyka: seznam vět i patička se postaví znovu (jinak zůstaly texty v původním jazyce) */
    relang() { listKey = ''; render(); },
    get active() { return active; },
    /** Přepis konkrétního klipu (karta Začni tady): Zdroj → jediný → vybraný → naposledy importovaný. */
    showFor() {
      const ms = app.project.media;
      const m = app.source.media || (ms.length === 1 ? ms[0] : null) || (app.projectPanel && app.projectPanel.selectedMedia()) || ms[ms.length - 1];
      if (m && app.source.media !== m) app.openSource(m);
      show('tr');
    },
    /** Ctrl+F: záložka Přepis + hledání, když je co hledat */
    find() {
      const m = media();
      if (asr() && m && (trOf(m) || asr().status(m).state !== 'none')) { show('tr', true); return true; }
      return false;
    },
    selectionText() { const m = media(); const S = sentencesOf(trOf(m)); return selValid(m) ? S.slice(sel.a, sel.b + 1).map((s) => s.text).join(' ') : ''; },
  };
}

module.exports = { createTranscriptPanel };
