/* Rozhraní AI panelu PZ AI (návrh Petra 2026-11-21): hlavička, záložky Assistant / Captions / Media, karty rychlých
 * akcí, velké Run task, patička se stavem systému. Prvky panelu MY Premiere MCP (main.js) se jen přesunou do nového
 * rozložení – id i obsluha zůstávají, takže logika panelu se nemění. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  var svg = function (body, sw) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>'; };
  var I = {
    sparkle: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M9 3.5l1.6 4.4L15 9.5l-4.4 1.6L9 15.5l-1.6-4.4L3 9.5l4.4-1.6z" fill="#a78bfa"/><path d="M17.5 12l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="#c4b5fd"/><path d="M17 3l.6 1.5 1.4.5-1.4.6L17 7l-.6-1.4L15 5l1.4-.5z" fill="#ddd6fe"/></svg>',
    assistant: svg('<path d="M12 3l1.8 4.9L19 9.7l-5.2 1.9L12 16.5l-1.8-4.9L5 9.7l5.2-1.8z"/>'),
    captions: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M7 21l3-4"/><path d="M7 9.5h10M7 12.5h6"/>'),
    media: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 1.5),
    seq: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 7l2-4M12 7l2-4M17 7l2-4"/>'),
    bubble: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
    clapper: svg('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9l1.5-4.5 15.5-.8.8 3.3z"/><path d="M8 4.5l2.5 4M13.5 4l2.5 4.5"/>'),
    frame: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/>'),
    mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.5l4.5 5M21.5 9.5l-4.5 5"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    crop: svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
    layers: svg('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
    play: svg('<path d="M7 4.5l13 7.5-13 7.5z"/>', 2),
    queueAdd: svg('<path d="M4 6h12M4 11h12M4 16h7"/><path d="M18 14v6M15 17h6"/>'),
    undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    cc: svg('<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10.5 10.2a2.5 2.5 0 1 0 0 3.6M17 10.2a2.5 2.5 0 1 0 0 3.6"/>'),
    film: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18"/>'),
    upload: svg('<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>'),
    chev: svg('<path d="M6 9l6 6 6-6"/>', 2),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>'),
  };
  var FLAG_CZ = '<svg class="flag" viewBox="0 0 30 20" width="20" height="13"><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0 15 10 0 20z" fill="#11457e"/></svg>';

  function start() {
    var body = document.body;
    var stash = el('div', 'pz-stash'); // původní prvky, které nové rozhraní ovládá (skryté)
    body.appendChild(stash);
    var ui = el('div', 'pz-ui');

    /* ---------- hlavička ---------- */
    var head = el('div', 'pz-head');
    head.appendChild(el('span', 'pz-logo', I.sparkle));
    head.appendChild(el('span', 'pz-title', 'PZ AI'));
    head.appendChild(el('span', 'pz-grow'));
    var link = $('claudeLink'); if (link) { link.classList.add('pz-conn'); head.appendChild(link); }
    var gearBtn = el('button', 'pz-icon-btn', I.gear); gearBtn.title = 'Settings';
    head.appendChild(gearBtn);
    ui.appendChild(head);

    // nastavení (ozubené kolo): Stop AI, stav mostu, technický log
    var settings = el('div', 'pz-settings');
    settings.appendChild(el('div', 'pz-settings-title', 'Settings'));
    var stRow = el('div', 'pz-srow');
    if ($('dot')) stRow.appendChild($('dot'));
    if ($('stav')) stRow.appendChild($('stav'));
    settings.appendChild(stRow);
    if ($('stopAll')) { var sa = $('stopAll'); sa.classList.add('pz-danger'); settings.appendChild(sa); }
    var tools = $('nastroje') && $('nastroje').closest('label');
    if (tools) { tools.style.display = ''; tools.classList.add('pz-check'); settings.appendChild(tools); }
    var det = body.querySelector('details'); if (det) settings.appendChild(det);
    ui.appendChild(settings);
    gearBtn.onclick = function (e) { e.stopPropagation(); settings.classList.toggle('open'); };
    document.addEventListener('click', function (e) { if (!settings.contains(e.target)) settings.classList.remove('open'); });

    /* ---------- záložky ---------- */
    var tabs = el('div', 'pz-tabs');
    var panes = {};
    [['assistant', 'Assistant'], ['captions', 'Captions'], ['media', 'Media']].forEach(function (t) {
      var b = el('button', 'pz-tab', I[t[0]] + '<span>' + t[1] + '</span>');
      b.dataset.tab = t[0];
      b.onclick = function () { show(t[0]); };
      tabs.appendChild(b);
      panes[t[0]] = el('div', 'pz-pane pz-pane-' + t[0]);
    });
    ui.appendChild(tabs);
    function show(name) {
      Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle('on', b.dataset.tab === name); });
      Object.keys(panes).forEach(function (k) { panes[k].style.display = k === name ? '' : 'none'; });
      try { localStorage.setItem('pzTab', name); } catch (e) { /* bez paměti */ }
    }

    /* ---------- Assistant ---------- */
    var A = panes.assistant;
    var seqBar = el('div', 'pz-seqbar', I.seq + '<span class="pz-dim">Active sequence</span><span class="pz-sep"></span>');
    var srcName = $('srcName');
    if (srcName) { var srcWrap = srcName.parentElement; seqBar.appendChild(srcName); srcName.classList.add('pz-seqname'); if (srcWrap) stash.appendChild(srcWrap); }
    A.appendChild(seqBar);

    var hero = el('div', 'pz-hero', '<div class="pz-hero-ico">' + I.sparkle + '</div><h2>What shall we edit today?</h2><p>Enter a task or choose a quick action.</p>');
    A.appendChild(hero);
    var out = $('out'); if (out) { out.classList.add('pz-out'); A.appendChild(out); }
    var queue = $('queue'); if (queue) A.appendChild(queue);
    function heroState() { var has = out && out.children.length > 0; hero.style.display = has ? 'none' : ''; if (out) out.style.display = has ? '' : 'none'; }
    if (out) new MutationObserver(heroState).observe(out, { childList: true });
    // nízké okno (výpis je pod Spustit): nový řádek výpisu → posunout panel, ať je vidět (vzhled S7)
    if (out) new MutationObserver(function () { if (window.innerHeight <= 700 && A.scrollHeight > A.clientHeight) { var r = out.getBoundingClientRect(); if (r.top > window.innerHeight - 40) out.scrollIntoView({ block: 'nearest' }); } }).observe(out, { childList: true });
    heroState();

    // karty rychlých akcí – klik na původní tlačítka (vyplní zadání a délku)
    var cards = el('div', 'pz-quick');
    var tpls = document.querySelectorAll('.tpl');
    var qIcons = [I.bubble, I.clapper, I.frame, I.mute];
    var qNames = ['Soundbite', 'Teaser', 'Short version', 'Remove pauses'];
    Array.prototype.forEach.call(tpls, function (t, i) {
      var c = el('button', 'pz-qcard', (qIcons[i] || I.assistant) + '<span>' + (qNames[i] || t.textContent) + '</span>');
      c.title = t.getAttribute('data-text') || '';
      c.onclick = function () { t.click(); };
      cards.appendChild(c);
    });
    A.appendChild(cards);
    if ($('templates')) stash.appendChild($('templates'));

    A.appendChild(el('div', 'pz-label', 'Task'));
    var taskBox = el('div', 'pz-task');
    var prompt = $('prompt'); if (prompt) { var en = (window.parent && window.parent.TN && window.parent.TN.lang) === 'en'; prompt.placeholder = en ? 'E.g.: Pick the best moments and make a short edit for Instagram.' : 'Např.: Vyber nejlepší momenty a udělej krátký sestřih pro Instagram.'; prompt.lang = en ? 'en' : 'cs'; taskBox.appendChild(prompt); }
    var mic = $('mic'); if (mic) { mic.innerHTML = I.mic; mic.className = 'pz-mic'; mic.title = 'Dictate the task (local Whisper) – click, speak, click again'; taskBox.appendChild(mic); }
    A.appendChild(taskBox);

    // délka + formát
    var lf = el('div', 'pz-lf');
    var lenCol = el('div', 'pz-col', '<div class="pz-label">Length</div>');
    var seg = el('div', 'pz-seg');
    Array.prototype.forEach.call(document.querySelectorAll('.chip[data-sec]'), function (b) { seg.appendChild(b); });
    lenCol.appendChild(seg);
    var fmtCol = el('div', 'pz-col', '<div class="pz-label">Format</div>');
    var fmt = $('format'); if (fmt) { fmt.classList.add('pz-select'); fmtCol.appendChild(fmt); }
    lf.appendChild(lenCol); lf.appendChild(fmtCol);
    A.appendChild(lf);
    var reframe = $('reframeNow');
    if (reframe) { reframe.className = 'pz-link'; reframe.innerHTML = I.crop + '<span>Reframe sequence</span>'; A.appendChild(reframe); }
    var oldLen = document.querySelector('.chips[title]'); if (oldLen) stash.appendChild(oldLen);

    // AI settings (agent + model), sbalitelné
    var ais = el('div', 'pz-ais');
    var aisHead = el('button', 'pz-ais-head', I.layers + '<span class="pz-ais-t">AI settings</span><span class="pz-grow"></span><span class="pz-ais-sum"></span>' + I.chev);
    var aisBody = el('div', 'pz-ais-body');
    var agent = $('agent'), model = $('model');
    if (agent) { agent.classList.add('pz-select'); aisBody.appendChild(agent); }
    if (model) { model.classList.add('pz-select'); aisBody.appendChild(model); }
    ais.appendChild(aisHead); ais.appendChild(aisBody);
    aisHead.onclick = function () { ais.classList.toggle('open'); };
    function aisSum() {
      var a = agent && agent.options[agent.selectedIndex], m = model && model.options[model.selectedIndex];
      var an = a ? a.textContent.replace(/ \(.*\)$/, '').replace('Claude Code', 'Claude') : '';
      var mn = m && model.style.display !== 'none' && m.value ? ' · ' + m.textContent.replace(/ \(.*\)$/, '') : '';
      aisHead.querySelector('.pz-ais-sum').textContent = an + mn;
    }
    [agent, model].forEach(function (s) { if (s) { s.addEventListener('change', aisSum); new MutationObserver(aisSum).observe(s, { subtree: true, childList: true, characterData: true, attributes: true }); } });
    aisSum();
    A.appendChild(ais);
    var cont = $('pokracovat') && $('pokracovat').closest('label');
    if (cont) {
      cont.className = 'pz-check'; A.appendChild(cont);
      Array.prototype.forEach.call(cont.childNodes, function (n) { if (n.nodeType === 3 && n.nodeValue.trim()) n.nodeValue = ' Continue conversation'; });
    }

    // Run task + fronta + Stop
    var runRow = el('div', 'pz-runrow');
    var run = $('run'), enq = $('enqueue'), stop = $('stop'), undo = $('undo');
    if (run) { run.className = 'pz-run'; run.innerHTML = I.play + '<span>Run task</span>'; runRow.appendChild(run); }
    if (stop) { stop.className = 'pz-stop'; stop.innerHTML = I.stop; stop.title = 'Stop'; runRow.appendChild(stop); }
    if (enq) { enq.className = 'pz-icon-btn pz-enq'; enq.innerHTML = I.queueAdd; runRow.appendChild(enq); }
    A.appendChild(runRow);
    var sub = el('div', 'pz-subrow');
    if (undo) { undo.className = 'pz-link'; undo.innerHTML = I.undo + '<span>Undo</span>'; sub.appendChild(undo); }
    sub.appendChild(el('span', 'pz-grow'));
    var qInfo = el('span', 'pz-dim pz-qinfo', I.layers + '<span>Queue</span> <b class="pz-qn">0</b>');
    sub.appendChild(qInfo);
    A.appendChild(sub);
    var qCount = $('qCount');
    function qSync() { var n = ((qCount && qCount.textContent) || '').match(/\d+/); qInfo.querySelector('.pz-qn').textContent = n ? n[0] : '0'; }
    if (qCount) new MutationObserver(qSync).observe(qCount, { subtree: true, childList: true, characterData: true });
    var oldAgentRow = agent && agent.parentElement === null ? null : document.querySelector('.actions'); if (oldAgentRow) stash.appendChild(oldAgentRow);

    // souhrn titulků na Assistantovi
    var capSum = el('div', 'pz-card pz-capsum', '<span class="pz-card-ico">' + I.cc + '</span><div class="pz-card-txt"><b>Captions</b><span class="pz-dim pz-capinfo"></span></div>');
    var capAdd = el('button', 'pz-outline', 'Add');
    capAdd.onclick = function () { var b = $('addCaptions'); if (b) b.click(); };
    capSum.appendChild(capAdd);
    capSum.querySelector('.pz-card-txt').onclick = function () { show('captions'); };
    A.appendChild(capSum);

    /* ---------- Captions ---------- */
    var C = panes.captions;
    C.appendChild(el('div', 'pz-hint', 'Generate captions from the transcript of the active sequence – run it when the edit is finished.'));
    var fields = el('div', 'pz-fields');
    [['ccChars', 'Characters per line'], ['ccLines', 'Lines'], ['ccLang', 'Language']].forEach(function (f) {
      var s = $(f[0]); if (!s) return;
      var r = el('div', 'pz-field', '<div class="pz-label">' + f[1] + '</div>');
      s.classList.add('pz-select');
      r.appendChild(s);
      fields.appendChild(r);
    });
    C.appendChild(fields);
    var addCap = $('addCaptions'); if (addCap) { addCap.className = 'pz-run pz-run-sm'; addCap.innerHTML = I.cc + '<span>Add captions</span>'; C.appendChild(addCap); }
    var capRowOld = document.querySelector('#ccChars') && null; void capRowOld;
    function capInfo() {
      var ch = $('ccChars'), li = $('ccLines'), la = $('ccLang');
      var t = (ch ? ch.value + ' chars' : '') + (li ? ' · ' + li.value + (li.value === '1' ? ' line' : ' lines') : '') +
        (la ? ' · ' + (la.value === 'cs' ? 'Czech translation' : 'Transcript language') : '');
      capSum.querySelector('.pz-capinfo').textContent = t;
    }
    ['ccChars', 'ccLines', 'ccLang'].forEach(function (id) { if ($(id)) $(id).addEventListener('change', capInfo); });
    capInfo();
    setTimeout(capInfo, 300); setTimeout(capInfo, 1500); // main.js obnovuje uložená nastavení titulků až po startu

    /* ---------- Media (import přímo do projektu PZ AI Cut) ---------- */
    var M = panes.media;
    var drop = el('div', 'pz-drop', I.upload + '<div><b>Import video</b><span class="pz-dim">or drag and drop a file</span></div>');
    var TN = window.parent && window.parent.TN;
    drop.onclick = function () { if (TN) TN.app.cmd('import'); };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('over');
      var paths = [];
      try { paths = require('../core/dropfiles').droppedPaths(e.dataTransfer); } catch (err) { /* mimo aplikaci */ }
      if (TN && paths.length) TN.app.importPaths(paths);
    });
    M.appendChild(drop);
    M.appendChild(el('div', 'pz-hint', 'MKV, MXF, MOV and other formats work directly – the editor creates playback proxies automatically. Files are added to the Project panel.'));
    if ($('dropRow')) stash.appendChild($('dropRow'));

    Object.keys(panes).forEach(function (k) { ui.appendChild(panes[k]); });

    /* ---------- patička: stav systému ---------- */
    var foot = el('div', 'pz-foot');
    var footHead = el('button', 'pz-foot-head', '<span class="pz-dotok"></span><span class="pz-sys">System ready</span><span class="pz-grow"></span><span class="pz-dim pz-gpu"></span><span class="pz-sep"></span><span class="pz-dim pz-vram"></span>' + I.chev);
    var footBody = el('div', 'pz-foot-body');
    if ($('worker')) footBody.appendChild($('worker'));
    if ($('workerBar')) foot.appendChild($('workerBar'));
    if ($('res')) footBody.appendChild($('res'));
    foot.appendChild(footHead); foot.appendChild(footBody);
    footHead.onclick = function () { foot.classList.toggle('open'); };
    function footSync() {
      var wt = ($('workerText') && $('workerText').textContent) || '';
      var busy = /\d+ ?%|queued|ve frontě|Edit plan|Transcription|LLM/i.test(wt) && !/ready|připraven/i.test(wt);
      footHead.querySelector('.pz-sys').textContent = busy ? wt.replace(/^Worker:\s*/, '') : (/not running|neběží/i.test(wt) ? 'System idle' : 'System ready');
      footHead.querySelector('.pz-dotok').className = 'pz-dotok' + (busy ? ' busy' : '');
      var g = $('resGpu') && $('resGpu').querySelector('.v'), v = $('resVram') && $('resVram').querySelector('.v');
      footHead.querySelector('.pz-gpu').textContent = g && $('resGpu').style.display !== 'none' ? 'GPU ' + g.textContent : '';
      footHead.querySelector('.pz-vram').textContent = v && $('resVram').style.display !== 'none' ? 'VRAM ' + v.textContent : '';
    }
    new MutationObserver(footSync).observe(footBody, { subtree: true, childList: true, characterData: true, attributes: true });
    footSync();
    ui.appendChild(foot);

    // staré obaly z původního panelu (prázdné řádky) schovat
    Array.prototype.forEach.call(body.children, function (c) { if (c !== ui && c !== stash && c.tagName !== 'SCRIPT') stash.appendChild(c); });
    body.appendChild(ui);
    body.classList.add('pz-layout');
    flagSelect($('ccLang')); // až po vložení do stránky
    var last = 'assistant'; try { last = localStorage.getItem('pzTab') || 'assistant'; } catch (e) { /* výchozí */ }
    show(panes[last] ? last : 'assistant');
  }

  /** Rozbalovací výběr s vlajkou (Windows emoji vlajky neumí) – synchronizovaný s původním <select>. */
  function flagSelect(sel) {
    if (!sel) return;
    var wrap = el('span', 'fsel');
    var btn = el('button', 'fsel-btn pz-select'); btn.type = 'button';
    var menu = el('div', 'fsel-menu');
    function label(opt) { var t = opt.textContent.trim(); return (opt.value === 'cs' ? FLAG_CZ : '') + '<span>' + t + '</span>'; }
    function sync() {
      var o = sel.options[sel.selectedIndex];
      btn.innerHTML = (o ? label(o) : '') + '<i class="caret">▾</i>';
      menu.innerHTML = '';
      Array.prototype.forEach.call(sel.options, function (opt) {
        var it = el('div', 'fsel-item' + (opt.selected ? ' on' : ''), label(opt));
        it.onclick = function () { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); menu.classList.remove('open'); sync(); };
        menu.appendChild(it);
      });
    }
    btn.onclick = function (e) { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', function () { menu.classList.remove('open'); });
    sel.style.display = 'none';
    sel.insertAdjacentElement('afterend', wrap);
    wrap.appendChild(btn); wrap.appendChild(menu);
    new MutationObserver(sync).observe(sel, { subtree: true, childList: true, characterData: true });
    sel.addEventListener('change', sync);
    sync();
  }

  // zkratky střihu (Premiere) fungují i s fokusem v AI panelu – kromě psaní do polí (zadání, výběry)
  document.addEventListener('keydown', function (ev) {
    var TN = window.parent && window.parent.TN;
    if (!TN || !TN.handleKey) return;
    if (ev.key === 'Enter' || ev.key === 'Escape') return;
    if (TN.handleKey(ev)) ev.preventDefault();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
