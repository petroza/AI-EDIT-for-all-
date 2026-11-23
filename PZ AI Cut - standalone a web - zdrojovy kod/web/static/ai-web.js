// AI panel webové verze: průvodce připojením (Claude Desktop / Codex), zadání s předvolbami stopáže a formátu,
// průběh, vytížení počítače. Stav mostu čte z parent.__pzAI (web/ai/bridge.js). Texty jsou česky i anglicky
// podle přepínače jazyka (při přepnutí se panel načte znovu).
try { document.documentElement.lang = parent.TN && parent.TN.lang === 'cs' ? 'cs' : 'en'; } catch (e) { /* jiný původ */ } // dřív vložený skript v ai-web.html (CSP)
(function () {
  'use strict';
  var AI = parent.__pzAI;
  var CS = !!(parent.TN && parent.TN.lang === 'cs');
  var L = function (en, cs) { return CS ? cs : en; };
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bez úložiště */ } },
  };
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') el[k] = attrs[k];
      else if (attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function copyBtn(getText, label) {
    var b = h('button', { class: 'btn small', text: label || L('Copy', 'Kopírovat') });
    b.onclick = function () {
      var t = getText();
      var done = function () { b.textContent = L('Copied ✓', 'Zkopírováno ✓'); setTimeout(function () { b.textContent = label || L('Copy', 'Kopírovat'); }, 1800); };
      try { navigator.clipboard.writeText(t).then(done, function () { parent.navigator.clipboard.writeText(t).then(done); }); } catch (e) { /* bez schránky */ }
    };
    return b;
  }

  var SITE = location.origin;
  var isMac = /Mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  var MAGIC = L('Work from the PZ AI Cut panel.', 'Pracuj z panelu PZ AI Cut.');

  /* ---------------- průvodce připojením ---------------- */
  var aiKind = store.get('pzAiKind', 'claude'); // claude | codex
  var macCmd = isMac;
  function claudeSteps() {
    return h('div', {}, [claudeList(), pluginTip()]);
  }
  function claudeList() {
    return h('ol', { class: 'steps' }, [
      h('li', {}, [L('Install ', 'Nainstaluj '), h('a', { href: 'https://claude.ai/download', target: '_blank', rel: 'noopener', text: 'Claude Desktop' }), L(' and sign in.', ' a přihlas se.')]),
      h('li', {}, [
        L('Download the connector:', 'Stáhni konektor:'),
        h('div', { class: 'act' }, [h('a', { class: 'btn primary small', href: 'pz-ai-cut.mcpb', download: 'pz-ai-cut.mcpb', text: L('Download connector', 'Stáhnout konektor') })]),
        h('div', { class: 'sub', html: L(
          'Double-click the downloaded <b>pz-ai-cut.mcpb</b> and click <b>Install</b> in Claude Desktop.<br>Nothing happens? In Claude Desktop open <b>Settings → Extensions → Advanced settings → Install Extension…</b> and choose the file (or drag it into that window).',
          'Dvakrát klikni na stažený <b>pz-ai-cut.mcpb</b> a v Claude Desktop klikni na <b>Instalovat</b>.<br>Nic se nestalo? V Claude Desktop otevři <b>Settings → Extensions → Advanced settings → Install Extension…</b> a vyber soubor (nebo ho do toho okna přetáhni).') }),
      ]),
      h('li', { html: L('Keep this tab open. When Chrome asks about <b>devices on your local network</b>, click <b>Allow</b> – that is how this page talks to Claude Desktop on your computer.',
        'Nech tuhle kartu otevřenou. Až se Chrome zeptá na <b>zařízení v místní síti</b>, klikni na <b>Povolit</b> – tak stránka mluví s Claude Desktop na tvém počítači.') }),
    ]);
  }
  function pluginTip() {
    return h('div', {}, [
      h('details', { class: 'hint', style: 'margin-top:10px' }, [
        h('summary', { style: 'cursor:pointer', text: L('Your company blocks extensions? Use the plugin instead', 'Firma blokuje rozšíření? Použij plugin') }),
        h('div', { style: 'margin-top:6px', html: L(
          '<a href="pz-ai-cut-plugin.zip" download>Download the plugin</a>, then in Claude Desktop: <b>Customize → Plugins → Add → Upload plugin</b> and choose <b>pz-ai-cut-plugin.zip</b>. The plugin works in <b>Cowork</b> (and in the Code tab), not in ordinary chat – write your tasks there.',
          '<a href="pz-ai-cut-plugin.zip" download>Stáhni plugin</a> a v Claude Desktop otevři <b>Customize → Plugins → Add → Upload plugin</b> a vyber <b>pz-ai-cut-plugin.zip</b>. Plugin funguje v <b>Cowork</b> (a v záložce Code), ne v obyčejném chatu – zadání piš tam.') }),
      ]),
    ]);
  }
  function codexSteps() {
    var cmd = macCmd ? 'curl -fsSL ' + SITE + '/codex/install.sh | sh' : 'irm ' + SITE + '/codex/install.ps1 | iex';
    return h('ol', { class: 'steps' }, [
      h('li', {}, [L('Install the ', 'Nainstaluj aplikaci '), h('a', { href: 'https://chatgpt.com/codex', target: '_blank', rel: 'noopener', text: 'Codex' }), L(' app and sign in with ChatGPT.', ' a přihlas se účtem ChatGPT.')]),
      h('li', {}, [
        h('span', { html: macCmd
          ? L('Open <b>Terminal</b> (⌘ Space → Terminal), paste this command and press Enter:', 'Otevři <b>Terminál</b> (⌘ mezerník → Terminál), vlož tenhle příkaz a stiskni Enter:')
          : L('Open <b>PowerShell</b> (Start → type PowerShell → Enter), paste this command and press Enter:', 'Otevři <b>PowerShell</b> (Start → napiš PowerShell → Enter), vlož tenhle příkaz a stiskni Enter:') }),
        h('code', { class: 'code', text: cmd }),
        h('div', { class: 'act' }, [
          copyBtn(function () { return cmd; }, L('Copy command', 'Kopírovat příkaz')),
          h('a', { href: '#', text: macCmd ? L('I have Windows', 'Mám Windows') : L('I have a Mac', 'Mám Mac'), onclick: function (e) { e.preventDefault(); macCmd = !macCmd; renderSetup(); } }),
        ]),
        h('div', { class: 'sub', text: L('It downloads the small connector into your user folder and adds it to Codex settings (a backup of the settings is kept). Nothing else is installed.',
          'Stáhne malý konektor do tvé uživatelské složky a přidá ho do nastavení Codexu (původní nastavení se zálohuje). Nic jiného se neinstaluje.') }),
      ]),
      h('li', { html: L('<b>Quit Codex completely</b> (also from the tray / menu bar) and start it again. Codex connects when you <b>start a conversation</b> in it – write e.g.: <b>' + MAGIC + '</b>',
        '<b>Ukonči Codex úplně</b> (i z lišty u hodin) a spusť ho znovu. Codex se připojí, až v něm <b>začneš konverzaci</b> – napiš třeba: <b>' + MAGIC + '</b>') }),
      h('li', { html: L('Keep this tab open. When Chrome asks about <b>devices on your local network</b>, click <b>Allow</b>.',
        'Nech tuhle kartu otevřenou. Až se Chrome zeptá na <b>zařízení v místní síti</b>, klikni na <b>Povolit</b>.') }),
    ]);
  }
  function renderSetup() {
    var box = $('setupBody');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(aiKind === 'codex' ? codexSteps() : claudeSteps());
    $('segClaude').className = aiKind === 'claude' ? 'on' : '';
    $('segCodex').className = aiKind === 'codex' ? 'on' : '';
  }
  function setKind(k) { aiKind = k; store.set('pzAiKind', k); renderSetup(); if (AI) render(AI.state); }

  /* ---------------- předvolby stopáže a formátu ---------------- */
  var DUR = [
    { v: '', en: 'Auto', cs: 'Auto' }, { v: '15', en: '15 s' }, { v: '20', en: '20 s' }, { v: '30', en: '30 s' }, { v: '45', en: '45 s' },
    { v: '60', en: '1 min' }, { v: '90', en: '90 s' }, { v: '180', en: '3 min' }, { v: '300', en: '5 min' },
  ];
  var FMT = [
    { v: '', w: 16, hh: 9, en: 'Original', cs: 'Původní', sub: { en: 'as the source', cs: 'jako zdroj' } },
    { v: '9:16', w: 9, hh: 16, en: '9:16 · 1080×1920', sub: { en: 'Reels, TikTok, Shorts, Stories', cs: 'Reels, TikTok, Shorts, Stories' } },
    { v: '4:5', w: 12, hh: 15, en: '4:5 · 1080×1350', sub: { en: 'Instagram / Facebook post', cs: 'příspěvek Instagram / Facebook' } },
    { v: '1:1', w: 14, hh: 14, en: '1:1 · 1080×1080', sub: { en: 'square feed post', cs: 'čtverec do feedu' } },
    { v: '16:9', w: 18, hh: 10, en: '16:9 · 1920×1080', sub: { en: 'YouTube, web, TV', cs: 'YouTube, web, TV' } },
  ];
  var preset = { dur: store.get('pzPresetDur', ''), fmt: store.get('pzPresetFmt', '') };
  function durText(v) { var s = +v; return s >= 60 && s % 60 === 0 ? (s / 60) + ' min' : s + ' s'; }
  function presetSuffix() {
    var parts = [];
    if (preset.dur) parts.push(L('Target length: about ', 'Cílová délka: zhruba ') + durText(preset.dur) + '.');
    if (preset.fmt) {
      var f = FMT.filter(function (x) { return x.v === preset.fmt; })[0];
      parts.push(L('Format: ', 'Formát: ') + f.en + ' (' + (CS ? f.sub.cs : f.sub.en) + ').');
    }
    return parts.join(' ');
  }
  function renderPresets() {
    var dc = $('durChips'); dc.innerHTML = '';
    DUR.forEach(function (d) {
      dc.appendChild(h('button', { class: 'chip' + (preset.dur === d.v ? ' on' : ''), text: CS && d.cs ? d.cs : d.en,
        onclick: function () { preset.dur = d.v; store.set('pzPresetDur', d.v); renderPresets(); } }));
    });
    var fc = $('fmtChips'); fc.innerHTML = '';
    FMT.forEach(function (f) {
      var s = 18 / Math.max(f.w, f.hh);
      fc.appendChild(h('button', { class: 'fmt' + (preset.fmt === f.v ? ' on' : ''), onclick: function () { preset.fmt = f.v; store.set('pzPresetFmt', f.v); renderPresets(); } }, [
        h('span', { class: 'shape' }, [h('i', { style: 'width:' + Math.round(f.w * s) + 'px;height:' + Math.round(f.hh * s) + 'px' })]),
        h('div', {}, [h('b', { text: CS && f.cs ? f.cs : f.en }), h('span', { text: CS ? f.sub.cs : f.sub.en })]),
      ]));
    });
    var sfx = presetSuffix();
    $('adds').textContent = sfx ? L('Added to the task: ', 'Přidá se k zadání: ') + sfx : '';
  }

  var QUICK = [
    { en: 'Soundbite', cs: 'Výrok', dur: '20', fmt: '', p: { en: 'Find the strongest soundbite of the guest: one complete thought that stands on its own, without the host. Make it a new sequence.', cs: 'Najdi nejsilnější výrok hosta: jednu celou myšlenku, která obstojí sama o sobě, bez moderátora. Udělej z ní novou sekvenci.' } },
    { en: 'Teaser', cs: 'Upoutávka', dur: '20', fmt: '9:16', p: { en: 'Make a news-style teaser: 2–4 short strong beats, a hook right at the start, tension at the end. New sequence with captions and a short headline at the top.', cs: 'Udělej upoutávku ve stylu zpravodajství: 2–4 krátké silné údery, hák hned na začátku, napětí na konec. Nová sekvence s titulky a krátkým nadpisem nahoře.' } },
    { en: 'Short version', cs: 'Zkrácená verze', dur: '180', fmt: '', p: { en: 'Make a short version of the interview: the most interesting thoughts in the original order, the host\'s questions only where needed. Remove slips and repetitions.', cs: 'Udělej zkrácenou verzi rozhovoru: nejzajímavější myšlenky v původním pořadí, otázky moderátora jen tam, kde jsou potřeba. Vyhoď přeřeknutí a opakování.' } },
    { en: 'Captions', cs: 'Titulky', dur: '', fmt: '', keep: true, p: { en: 'Add captions to the active sequence (transcribe its media first if needed).', cs: 'Přidej titulky do aktivní sekvence (když chybí přepis, nejdřív ho udělej).' } },
    { en: 'All social formats', cs: 'Všechny formáty', dur: '', fmt: '', keep: true, p: { en: 'Make 9:16, 4:5 and 1:1 versions of the active sequence (reframe_sequence) with a short headline at the top.', cs: 'Z aktivní sekvence udělej verze 9:16, 4:5 a 1:1 (reframe_sequence) a dej na ně krátký nadpis nahoře.' } },
    { en: 'Karaoke captions', cs: 'Karaoke titulky', dur: '', fmt: '', keep: true, p: { en: 'Add captions to the active sequence with the spoken word highlighted (add_captions highlight), then fix obvious recognition errors.', cs: 'Přidej do aktivní sekvence titulky se zvýrazněným vyslovovaným slovem (add_captions highlight) a oprav zjevné chyby rozpoznání.' } },
  ];

  /* ---------------- stavba panelu ---------------- */
  function build() {
    var pane = $('pane');
    pane.appendChild(h('div', { class: 'card', id: 'setup' }, [
      h('h3', { text: L('Connect your AI', 'Připoj svou AI') }),
      h('div', { class: 'seg' }, [
        h('button', { id: 'segClaude', text: 'Claude Desktop', onclick: function () { setKind('claude'); } }),
        h('button', { id: 'segCodex', text: 'Codex (ChatGPT)', onclick: function () { setKind('codex'); } }),
      ]),
      h('div', { id: 'setupBody' }),
      h('div', { class: 'wait', id: 'wait' }, [h('span', { class: 'dot' }), h('span', { id: 'waitText', class: 'grow' }), h('button', { class: 'btn small', text: L('Try again', 'Zkusit znovu'), onclick: function () { if (AI) AI.retry(); } })]),
    ]));
    pane.appendChild(h('div', { class: 'card hidden', id: 'start' }, [
      h('div', { id: 'startText' }),
      h('code', { class: 'code', text: MAGIC }),
      h('div', { class: 'act row', style: 'margin-top:6px' }, [copyBtn(function () { return MAGIC; }), h('span', { class: 'hint', text: L('Or write your request straight into the AI app.', 'Nebo napiš zadání rovnou do aplikace AI.') })]),
    ]));

    pane.appendChild(h('div', { class: 'label', text: L('Task', 'Zadání') }));
    pane.appendChild(h('textarea', { id: 'task', placeholder: L('E.g.: Pick the best moments and make an edit for Instagram.', 'Např.: Vyber nejlepší momenty a udělej sestřih pro Instagram.') }));
    var quick = h('div', { class: 'quick' });
    QUICK.forEach(function (q) {
      quick.appendChild(h('button', { id: q.en === 'Captions' ? 'qCap' : undefined, text: CS ? q.cs : q.en, onclick: function () {
        // bez připojené AI udělá titulky aplikace sama z přepisu (Sekvence → Titulky → Vytvořit titulky z přepisu)
        if (q.en === 'Captions' && !(AI && AI.state.state === 'connected') && parent.TN && parent.TN.app) { parent.TN.app.cmd('captionsFromTranscript'); return; }
        $('task').value = CS ? q.p.cs : q.p.en;
        if (!q.keep) { preset.dur = q.dur; preset.fmt = q.fmt; store.set('pzPresetDur', q.dur); store.set('pzPresetFmt', q.fmt); }
        else { preset.dur = ''; preset.fmt = ''; }
        renderPresets(); $('task').focus();
      } }));
    });
    pane.appendChild(quick);
    pane.appendChild(h('div', { class: 'presets' }, [
      h('div', { class: 'ttl', text: L('Length', 'Stopáž') }), h('div', { class: 'chips', id: 'durChips' }),
      h('div', { class: 'ttl', text: L('Format for social media', 'Formát pro sítě') }), h('div', { class: 'fmts', id: 'fmtChips' }),
      h('div', { class: 'adds', id: 'adds' }),
    ]));
    pane.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn primary grow', id: 'send', text: L('Send to AI', 'Poslat AI') })]));
    pane.appendChild(h('div', { class: 'hint warn hidden', id: 'sendWarn' }));

    pane.appendChild(h('div', { id: 'result', class: 'card result hidden' }, [
      h('div', { class: 'rhead' }, [h('span', { class: 'rlabel', text: L('Result', 'Výsledek') }), h('b', { id: 'resultName' })]),
      h('div', { class: 'row', style: 'margin-top:8px' }, [
        h('button', { class: 'btn small', id: 'resPlay', text: L('▶ Play', '▶ Přehrát') }),
        h('button', { class: 'btn small', id: 'resStyle', text: L('Text on video…', 'Text v obraze…') }),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn small', id: 'resExportAll', text: L('Export all formats…', 'Exportovat vše…') }),
        h('button', { class: 'btn small primary', id: 'resExport', text: L('Export…', 'Exportovat…') }),
      ]),
    ]));
    pane.appendChild(h('div', { id: 'prog', class: 'card hidden' }, [h('div', { id: 'progText', class: 'dim' }), h('div', { class: 'bar' }, [h('i', { id: 'progBar' })])]));
    pane.appendChild(h('div', { class: 'card' }, [h('h3', { text: L('Activity', 'Průběh') }), h('div', { class: 'log', id: 'log' }, [h('div', { class: 'call', text: L('Nothing yet.', 'Zatím nic.') })])]));
    pane.appendChild(h('div', { class: 'card' }, [
      h('h3', { text: L('Computer load', 'Vytížení počítače') }),
      h('div', { class: 'res', id: 'res' }),
    ]));
    pane.appendChild(h('div', { class: 'row', id: 'qualityRow' }, [
      h('span', { class: 'dim grow', text: L('Speech recognition', 'Rozpoznávání řeči') }),
      h('select', { id: 'quality' }, [h('option', { value: 'accurate', text: L('Accurate – fewer mistakes', 'Přesné – méně chyb') }), h('option', { value: 'standard', text: L('Standard – faster', 'Standardní – rychlejší') })]),
    ]));
    pane.appendChild(h('label', { class: 'row', id: 'autoRow', style: 'cursor:pointer' }, [h('input', { type: 'checkbox', id: 'auto' }), h('span', { class: 'grow', text: L('Transcribe new videos automatically', 'Automaticky přepisovat nová videa') })]));
    pane.appendChild(h('div', { class: 'privacy', id: 'privacy', text: L('Your video, audio and projects stay on this computer. Speech is transcribed here, even without AI; the AI only receives the text of the transcript.',
      'Video, zvuk i projekty zůstávají na tomto počítači. Řeč se přepisuje tady, i bez AI; AI dostane jen text přepisu.') }));
  }

  /* ---------------- záložky: Zadání | Připojení ---------------- */
  var tab = null, autoSwitched = false;
  function makeTabs() {
    var pane = $('pane');
    var bar = h('div', { class: 'tabs' }, [
      h('button', { id: 'tabTask', text: L('Task', 'Zadání'), onclick: function () { showTab('task'); } }),
      h('button', { id: 'tabConn' }, [h('span', { class: 'tdot', id: 'tdot' }), L('Connection', 'Připojení')]),
    ]);
    bar.lastChild.onclick = function () { showTab('conn'); };
    var task = h('div', { class: 'tabbody', id: 'bodyTask' }), conn = h('div', { class: 'tabbody', id: 'bodyConn' });
    var connIds = ['setup', 'start', 'qualityRow', 'autoRow', 'privacy'];
    Array.prototype.slice.call(pane.children).forEach(function (el) { (connIds.indexOf(el.id) >= 0 ? conn : task).appendChild(el); });
    pane.appendChild(bar); pane.appendChild(task); pane.appendChild(conn);
    showTab(AI && AI.state && AI.state.state === 'connected' ? 'task' : 'conn');
  }
  function showTab(t) {
    tab = t;
    $('bodyTask').classList.toggle('hidden', t !== 'task');
    $('bodyConn').classList.toggle('hidden', t !== 'conn');
    $('tabTask').className = t === 'task' ? 'on' : '';
    $('tabConn').className = t === 'conn' ? 'on' : '';
  }

  /* ---------------- vytížení ---------------- */
  var res = { mem: null, memKind: '', cpu: null, engine: null };
  var CPU = { nominal: [0.15, L('low', 'nízké')], fair: [0.45, L('medium', 'střední')], serious: [0.75, L('high', 'vysoké')], critical: [1, L('critical', 'kritické')] };
  function gb(b) { return b >= 1e9 ? (b / 1e9).toFixed(1).replace('.', CS ? ',' : '.') + ' GB' : Math.round(b / 1e6) + ' MB'; }
  function renderRes() {
    var box = $('res'); box.innerHTML = '';
    var dm = navigator.deviceMemory; // Chrome zaokrouhluje a strop je 8 GB
    var memRow = res.memKind === 'na' ? L('not available in this browser', 'v tomto prohlížeči nejde zjistit') : res.mem == null ? L('measuring…', 'měřím…') : gb(res.mem);
    var memBar = res.mem != null && dm ? Math.min(1, res.mem / (dm * 1e9)) : null;
    box.appendChild(h('span', { class: 'k', text: L('Tab memory (RAM)', 'Paměť karty (RAM)') }));
    box.appendChild(h('div', { class: 'meter' }, [memBar == null ? null : h('div', { class: 'bar' + (memBar > .8 ? ' crit' : memBar > .55 ? ' hi' : '') }, [h('i', { style: 'width:' + Math.round(memBar * 100) + '%' })]), h('span', { text: memRow })]));
    var c = res.cpu && CPU[res.cpu];
    box.appendChild(h('span', { class: 'k', text: L('CPU load', 'Zatížení procesoru') }));
    box.appendChild(h('div', { class: 'meter' }, c ? [h('div', { class: 'bar' + (res.cpu === 'critical' ? ' crit' : res.cpu === 'serious' ? ' hi' : '') }, [h('i', { style: 'width:' + Math.round(c[0] * 100) + '%' })]), h('span', { text: c[1] + ' · ' + (navigator.hardwareConcurrency || '?') + L(' cores', ' jader') })]
      : [h('span', { text: (('PressureObserver' in window) ? L('measuring… · ', 'měřím… · ') : L('not available · ', 'nejde zjistit · ')) + (navigator.hardwareConcurrency || '?') + L(' cores', ' jader') })]));
  }
  function measureMem() {
    if (document.hidden) return;
    var P = parent.performance;
    if (parent.crossOriginIsolated && P.measureUserAgentSpecificMemory) {
      P.measureUserAgentSpecificMemory().then(function (r) { res.mem = r.bytes; res.memKind = 'all'; renderRes(); }, fallback);
    } else fallback();
    // performance.memory je v Chrome hrubě zaokrouhlené a jen za JavaScript – radši nic než zavádějící číslo
    function fallback() { res.mem = null; res.memKind = 'na'; renderRes(); }
  }
  function startRes() {
    renderRes();
    measureMem();
    setInterval(measureMem, 15000);
    try {
      if ('PressureObserver' in window) {
        var po = new PressureObserver(function (recs) { var r = recs[recs.length - 1]; if (r) { res.cpu = r.state; renderRes(); } });
        po.observe('cpu', { sampleInterval: 2000 }).catch(function () { /* nepodporováno */ });
      }
    } catch (e) { /* bez Compute Pressure */ }
  }

  /* ---------------- stav ---------------- */
  function fmtTime(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  var STATIC = {
    'Claude Desktop connected': 'Claude Desktop připojen', 'Claude connected': 'Claude připojen', 'Codex connected': 'Codex připojen',
    'Claude disconnected': 'Claude odpojen', 'Codex disconnected': 'Codex odpojen', 'Claude Desktop disconnected': 'Claude Desktop odpojen',
  };
  function render(S) {
    var on = S.state === 'connected';
    var who = (S.clients && S.clients.length) ? S.clients.join(' + ') : 'AI';
    var many = S.clients && S.clients.length > 1;
    $('pill').textContent = on ? who + L(' connected', many ? ' připojeni' : ' připojen') : L('AI not connected', 'AI není připojena');
    $('pill').className = 'pill' + (on ? ' on' : '');
    $('setup').classList.toggle('hidden', on);
    $('tdot').className = 'tdot' + (on ? ' on' : '');
    // první otevření: bez připojení rovnou Připojení; jakmile se AI připojí, jednou přepnout na Zadání
    if (on && !autoSwitched && tab === 'conn') { autoSwitched = true; showTab('task'); }
    $('start').classList.toggle('hidden', !on);
    if (on && $('sendWarn')) $('sendWarn').classList.add('hidden');
    if (on) $('startText').textContent = L('To let ' + who + ' take tasks from this panel, write to ' + (many ? 'one of them' : 'it') + ' once:',
      many ? 'Úkoly z tohoto panelu si začne brát ten z nich (' + who + '), kterému jednou napíšeš:' : who + ' si začne brát úkoly z tohoto panelu, když mu jednou napíšeš:');
    if ($('sendWarn') && !(S.tasks && S.tasks.length)) $('sendWarn').classList.add('hidden'); // zadání smazána (Nový projekt) → hláška pryč
    if ($('qCap')) { $('qCap').textContent = on ? L('Captions', 'Titulky') : L('Captions (no AI)', 'Titulky (bez AI)'); $('qCap').title = on ? '' : L('Creates captions from the transcript right here – no AI needed.', 'Vytvoří titulky z přepisu rovnou tady – AI není potřeba.'); }
    $('send').textContent = on && S.clients && S.clients.length === 1 ? L('Send to ' + who, 'Poslat do ' + who) : L('Send to AI', 'Poslat AI');
    var blocked = S.state === 'blocked';
    $('wait').className = 'wait' + (blocked ? ' bad' : '');
    $('waitText').textContent = blocked
      ? L('Chrome blocked the connection. Click the icon left of the address bar → Site settings → allow "Local network access", then reload the page.',
        'Chrome spojení zablokoval. Klikni na ikonu vlevo od adresy → Nastavení webu → povol „Přístup k místní síti“ a načti stránku znovu.')
      : aiKind === 'codex'
        ? L('Waiting for Codex… it connects once a conversation in Codex is running.', 'Čekám na Codex… připojí se, jakmile v něm běží konverzace.')
        : L('Waiting for the connection… it is checked automatically.', 'Čekám na připojení… zkouší se to samo.');
    var res = S.result;
    $('result').classList.toggle('hidden', !res);
    if (res) {
      $('resultName').textContent = res.name;
      // „Exportovat vše“ jen když od sekvence existují další formáty (9x16 / 4x5 / 1x1)
      var base = res.name.replace(/ (9x16|4x5|1x1)( \d+)?$/, ''), seqs = (parent.TN && parent.TN.app.project.sequences) || [];
      var n = ['9x16', '4x5', '1x1'].filter(function (f) { return seqs.some(function (q) { return q.name === base + ' ' + f || q.name.indexOf(base + ' ' + f + ' ') === 0; }); }).length;
      $('resExportAll').classList.toggle('hidden', n < 2);
    }
    if (S.progress) {
      $('prog').classList.remove('hidden');
      $('progText').textContent = S.progress.text;
      $('progBar').style.width = Math.round((S.progress.p || 0) * 100) + '%';
    } else $('prog').classList.add('hidden');
    var log = $('log');
    if (S.log.length) {
      log.innerHTML = '';
      S.log.slice(-60).forEach(function (e) {
        var txt = CS && STATIC[e.text] ? STATIC[e.text] : e.text;
        log.appendChild(h('div', { class: e.kind, text: fmtTime(e.t) + '  ' + (e.kind === 'task' ? '▶ ' : e.kind === 'ok' ? '✔ ' : e.kind === 'err' ? '✖ ' : '') + txt }));
      });
      log.scrollTop = log.scrollHeight;
    }
    if ($('quality').value !== S.quality) $('quality').value = S.quality;
    $('auto').checked = !!S.auto;
  }

  build();
  if ($('collapse')) { $('collapse').title = L('Collapse the AI panel (F4)', 'Sbalit panel AI (F4)'); $('collapse').onclick = function () { if (parent.TN && parent.TN.app) parent.TN.app.cmd('toggleAi'); }; }
  makeTabs();
  renderSetup();
  renderPresets();
  startRes();
  $('send').onclick = function () {
    var text = $('task').value.trim();
    if (!text) { $('task').focus(); return; }
    var sfx = presetSuffix();
    if (sfx) text += '\n' + sfx;
    if (AI) AI.addTask(text);
    if (!AI || AI.state.state !== 'connected') {
      // AI není připojená: úkol počká ve frontě – říct to a ukázat, jak ji připojit
      var warn = $('sendWarn');
      if (warn) { warn.textContent = L('The AI is not connected yet – your task is waiting. Connect it on the Connection tab; it will start then.', 'AI zatím není připojená – zadání počká. Připoj ji v záložce Připojení, pak se do něj hned pustí.'); warn.classList.remove('hidden'); }
    }
    try { navigator.clipboard.writeText(text); } catch (e) { /* bez schránky */ }
    $('task').value = '';
  };
  // karta Výsledek: otevřít sekvenci od AI a přehrát / upravit text / exportovat
  function openResult() {
    var T = parent.TN, r = AI && AI.state.result;
    if (!T || !r) return null;
    var s = T.app.project.sequences.filter(function (x) { return x.name === r.name; })[0];
    if (!s) return null;
    T.app.openSequence(s.id);
    return T;
  }
  $('resPlay').onclick = function () { var T = openResult(); if (T) { T.app.setPlayhead(0); setTimeout(function () { T.app.program.play(1); }, 150); } };
  $('resStyle').onclick = function () { var T = openResult(); if (T) T.app.cmd('captionStyle'); };
  $('resExport').onclick = function () { var T = openResult(); if (T) T.app.cmd('export'); };
  $('resExportAll').onclick = function () { var T = openResult(); if (T) T.app.cmd('exportSocial'); };
  $('task').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('send').click(); });
  $('quality').onchange = function () { AI.setQuality($('quality').value); };
  $('auto').onchange = function () { AI.setAuto($('auto').checked); };
  // zkratky střižny fungují i s fokusem v panelu (mimo psaní)
  window.addEventListener('keydown', function (ev) {
    var tag = (ev.target && ev.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
    if (parent.TN && parent.TN.handleKey && parent.TN.handleKey(ev)) ev.preventDefault();
  });
  if (AI) AI.on(render);
})();
