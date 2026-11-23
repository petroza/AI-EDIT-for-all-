/* AI panel in English: the panel comes from MY Premiere MCP (Czech). This layer translates only what is DISPLAYED
 * (text, tooltips, placeholders, live messages from the panel, Worker, Hermes and the MCP server). What is sent to
 * the AI stays the same – Hermes recognises the kind of task from Czech keywords, so quick-task prompts are shown
 * in English but sent in their tested Czech wording (TN_UNTRANSLATE). */
(function () {
  'use strict';

  // quick tasks: [Czech text sent to the AI, English text shown]
  var TEMPLATES = [
    ['Nejsilnější výrok hosta: celá myšlenka, která obstojí sama o sobě, bez moderátora.',
      "The guest's strongest soundbite: a complete thought that stands on its own, without the host."],
    ['Upoutávka ve stylu zpravodajství: krátké silné údery, hák hned na začátku, napětí na konec, bez moderátora.',
      'News-style teaser: short strong beats, a hook right at the start, tension at the end, without the host.'],
    ['Zkrácená verze rozhovoru na 3 minuty: nejzajímavější myšlenky v původním pořadí, otázky moderátora jen tam, kde jsou potřeba. Vyhoď přeřeknutí a opakování.',
      "3-minute short version of the interview: the most interesting thoughts in the original order, the host's questions only where needed. Remove slips and repetitions."],
    ['Vystřihni hluchá místa a dlouhé pauzy, ať řeč plyne – krátké pauzy na nádech nech.',
      'Cut out dead air and long pauses so the speech flows – keep short breathing pauses.'],
  ];
  var LANG_NOTE = '\n\n(Odpovídej uživateli anglicky – rozhraní je v angličtině.)';

  var EXACT = {
    'Připojit Claude': 'Connect Claude', 'Fronta': 'Queue', 'vyčistit hotové': 'clear finished', 'pozastavit': 'pause',
    'pokračovat': 'resume', 'Délka:': 'Length:', 'Formát:': 'Format:', '4:5 Instagram / FB příspěvek': '4:5 Instagram / FB post',
    '1:1 čtverec': '1:1 square', '📱 Převést aktivní': '📱 Reframe active', 'Zdroj:': 'Source:', 'Rychle:': 'Quick:',
    '💬 Výrok': '💬 Soundbite', '🎬 Upoutávka': '🎬 Teaser', '✂ Zkrácená verze': '✂ Short version', '🔇 Bez pauz': '🔇 No pauses',
    'Hermes (lokálně, zdarma)': 'Hermes (local, free)', 'Claude (aplikace)': 'Claude (app)', 'výchozí model': 'default model',
    'GPT-6-Astra (drahé)': 'GPT-6-Astra (expensive)', 'navázat': 'continue', 'nástroje': 'tools', '↶ Zpět': '↶ Undo',
    'Spustit': 'Run', '+ Do fronty': '+ Queue', 'Titulky:': 'Captions:', 'znaků/řádek': 'chars/line', 'řádky': 'lines',
    'jednořádkové': 'single line', 'dvouřádkové': 'two lines', 'jazyk': 'language', 'jen přepis': 'transcript only',
    'překlad do češtiny': 'translate to Czech', '💬 Přidat titulky': '💬 Add captions', '🎬 Vložit video…': '🎬 Import video…',
    'nebo sem přetáhni soubor · MKV se samo převede na MP4': 'or drop a file here · MKV is converted to MP4 automatically',
    'Most (port': 'Bridge (port', ') · požadavků:': ') · requests:', 'znovu načíst host.jsx': 'reload host.jsx',
    '■ Zastavit AI': '■ Stop AI', 'Zastavit AI': 'Stop AI', 'startuji…': 'starting…', 'Skrýt': 'Hide',
    'Worker: připraven': 'Worker: ready', 'Worker: neznámý stav': 'Worker: unknown state',
    'Worker: neběží (spustí se při první úloze)': 'Worker: not running (starts with the first task)',
    'Claude čeká na zadání': 'Claude is waiting for a task', 'Claude připojen': 'Claude connected',
    '👍 díky, uloženo': '👍 thanks, saved', '👎 uloženo – napiš klidně do zadání, co bylo špatně, a spusť znovu': '👎 saved – write what was wrong into the task and run it again',
    '▶ Otevřít': '▶ Open', 'žádná': 'none', 'žádná aktivní sekvence – otevři sekvenci s klipem': 'no active sequence – open a sequence with a clip',
    'žádná aktivní sekvence – otevři sekvenci na timeline': 'no active sequence – open a sequence in the timeline',
    'Ze které sekvence se bude stříhat (aktivní ve Střihátku)': 'The sequence the edit will use (active in the editor)',
    'Titulky do aktivní sekvence': 'Captions for the active sequence', '■ úloha zastavena': '■ task stopped',
    '↶ Sekvence z posledního zadání už v projektu nejsou.': "↶ The last task's sequences are no longer in the project.",
    'Nejdřív počkej, až agent doběhne (nebo klikni Stop).': 'Wait until the agent finishes (or click Stop).',
    'Nejdřív počkej, až předchozí úloha doběhne (nebo klikni Stop).': 'Wait until the previous task finishes (or click Stop).',
    'Vložit video do projektu': 'Import video into the project', '🔑 Přihlásit Claude Code': '🔑 Sign in to Claude Code',
    '✔ Claude Code přihlášen.': '✔ Claude Code signed in.', '▶ Poslat do aplikace Claude': '▶ Send to the Claude app',
    '▶ Místo toho v Hermesovi (lokálně, zdarma)': '▶ Use Hermes instead (local, free)', '▶ Místo toho v Codexu (GPT)': '▶ Use Codex (GPT) instead',
    'Codex skončil s chybou': 'Codex ended with an error', '🎤 žádná nahrávka.': '🎤 nothing recorded.',
    '🎤 přepisuji nahrávku (lokálně)…': '🎤 transcribing (locally)…', '🎤 nerozpoznal jsem žádný text.': '🎤 no speech recognized.',
    '🎤 nahrávám… (klikni znovu pro ukončení)': '🎤 recording… (click again to stop)', '✖ Mikrofon není v tomhle panelu dostupný.': '✖ The microphone is not available in this panel.',
    '✖ Node.js nenalezen v PATH (potřebný pro lokální střih).': '✖ Node.js not found in PATH (needed for local editing).',
    '✖ sekvence se nevytvořila (žádné vybrané věty?)': '✖ no sequence was created (no sentences selected?)',
    '⚙ přepis (z cache, pokud už existuje)': '⚙ transcript (from cache if it exists)',
    '⚙ osnova + výběr vět lokálním modelem (u dlouhého videa to trvá minuty)': '⚙ outline + sentence selection by the local model (takes minutes for long videos)',
    '➕ běží jiná úloha – zadání čeká ve frontě': '➕ another task is running – this one waits in the queue',
    '⚙ Claude (aplikace) převzal zadání a pracuje…': '⚙ Claude (app) took the task and is working…',
    '✖ Claude (aplikace): zadání se nepovedlo': '✖ Claude (app): the task failed', '✔ hotovo (Claude, aplikace)': '✔ done (Claude, app)',
    'ℹ Příkazový Claude Code je u tvého účtu zakázaný – zadání jde do aplikace Claude.': 'ℹ The Claude Code CLI is blocked for your account – the task goes to the Claude app.',
    '⚙ předáno Claude (aplikace) – pracuje přes plugin, průběh se objeví tady': '⚙ sent to Claude (app) – it works through the plugin, progress appears here',
    '⚙ zadání čeká – Claude (aplikace) si ho vyzvedne, až dokončí předchozí': '⚙ the task is waiting – Claude (app) picks it up after the previous one',
    // tooltips
    'Stav připojení aplikace Claude k pluginu': 'Claude app plugin connection status', 'Lokální Worker pracuje': 'The local Worker is busy',
    'Průběh úlohy lokálního Workeru': 'Local Worker task progress', 'Navázat na předchozí konverzaci': 'Continue the previous conversation',
    'Zobrazit i technické volání nástrojů (ladění)': 'Show technical tool calls too (debugging)',
    'Nadiktovat zadání mikrofonem (lokálně, Whisper) - klikni, mluv, klikni znovu': 'Dictate the task with the microphone (local Whisper) – click, speak, click again',
    'Spustí hned (Enter). Když něco běží, zařadí se do fronty.': 'Runs now (Enter). If something is running, it is queued.',
    'Max. znaků na jeden řádek titulku': 'Max. characters per caption line', 'Počet řádků jednoho titulku': 'Lines per caption',
    'Model': 'Model',
    'Např.: Vyber nejlepší momenty a udělej krátký sestřih pro Instagram.': 'E.g.: Pick the best moments and make a short edit for Instagram.',
  };
  // dlouhé popisky (title / placeholder) – podle začátku
  var STARTS = [
    ['Zastaví všechny AI procesy', 'Stops all AI processes – Hermes (also from another folder, e.g. O:\\Hermes), Ollama, local models and the Whisper Worker – and frees graphics memory and RAM. A running task is interrupted.'],
    ['Vytížení počítače', 'Computer load (refreshed every 2 s). VRAM = graphics memory – when it runs out, local models (Whisper, Hermes) slow down or crash.'],
    ['Fronta zadání', 'Task queue – runs one task at a time.'],
    ['Cílová délka výsledného střihu', 'Target length of the edit. It is added to the task – no need to type it. Click again to clear.'],
    ['Formát výsledku', 'Output format. Anything other than 16:9 = the new sequence is automatically reframed for social media (follows the face, full resolution, e.g. 1080×1920). The 16:9 original stays.'],
    ['Převede hned aktivní sekvenci', 'Reframes the active sequence for social media now – follows the face, full resolution. Creates a new sequence; the original stays.'],
    ['Rychlá zadání', 'Quick tasks – click to fill in the task, edit it and run it (pick the length and format next to it).'],
    ['Např.: Přepiš zvuk aktivní sekvence', 'E.g.: Transcribe the active sequence and make a new sequence with only the sentences about prices, so it makes sense. Remove slips and long pauses.'],
    ['Předá zadání desktopové aplikaci Claude', 'Sends the task to the Claude desktop app (a new session with the plugin folder) – works even on a company account where the Claude Code CLI is blocked.'],
    ['Smaže sekvence, které vytvořilo poslední zadání', 'Deletes the sequences created by the last task (click again for earlier ones). The original edit and media are untouched.'],
    ['Přidá zadání do fronty', 'Adds the task to the queue (with the selected agent, length and current sequence) – the queue runs one at a time, you can keep typing. Ctrl+Enter.'],
    ['Jazyk titulků', 'Caption language: transcript only (as spoken), or translated to Czech (local model, free) – speech can be in any language or a mix.'],
    ['Vygeneruje titulky z přepisu', 'Generates captions from the transcript for the current state of the sequence (optionally translated to Czech) and adds them as a caption track. Run it after the edit is finished.'],
    ['Vloží video do projektu', 'Imports a video into the project. MKV/WebM is converted to MP4 first (the picture is rewrapped without loss; a damaged file is repaired by re-encoding).'],
    ['Aplikace Claude je napojená na panel', 'The Claude app is connected to the panel: tasks for the Claude (app) agent are picked up right away and progress is shown here.'],
    ['Aplikace Claude má plugin připojený', 'The Claude app has the plugin connected but is not waiting for panel tasks – click to connect it to the panel.'],
    ['Aplikace Claude není připojená', 'The Claude app is not connected – click: a session connected to the panel opens there; confirm the folder and press Enter.'],
    ['Claude (aplikace) je napojený na panel a čeká', 'Claude (app) is connected and waiting for a task – pick the Claude (app) agent and click Run.'],
  ];
  // dynamické hlášky: [regex, náhrada]
  var RULES = [
    [/ · ve frontě /g, ' · queued '], [/\bve frontě\b/g, 'queued'],
    [/^Přepis\b/, 'Transcription'], [/^Mluvčí \(YouTuber\)/, 'Speakers (YouTuber)'], [/^Mluvčí\b/, 'Speakers'],
    [/^Plán střihu\b/, 'Edit plan'], [/^Plán YouTuber\b/, 'YouTuber plan'], [/^Překlad\b/, 'Translation'],
    [/^Dolaďování hranic\b/, 'Refining cut edges'], [/^Převod videa\b/, 'Converting video'], [/^Rejstřík záběrů\b/, 'Shot index'],
    [/^Výběr záběrů\b/, 'Shot selection'], [/^Popis snímku\b/, 'Frame description'], [/^Snímek\b/, 'Frame'],
    [/LLM hodnotí pasáže (\d+)–(\d+) z (\d+)/g, 'LLM is rating passages $1–$2 of $3'], [/LLM vybírá nejlepší pasáž/g, 'LLM is picking the best passage'],
    [/\bhotovo\b/g, 'done'],
    [/most běží · 127\.0\.0\.1:(\d+)/, 'bridge running · 127.0.0.1:$1'], [/^port (\d+) je obsazený/, 'port $1 is in use'],
    [/^Jak dopadl střih „(.+)“\?/, 'How did the edit “$1” turn out?'], [/^✖ hodnocení se neuložilo: /, '✖ rating not saved: '],
    [/^Otevřít „(.+)“ ve Střihátku/, 'Open “$1” in the editor'], [/^Exportovat „(.+)“ do složky export vedle projektu \(H\.264, jako zdroj\)/, 'Export “$1” to the export folder next to the project (H.264, like the source)'],
    [/ \(přeložené do češtiny\)/g, ' (translated to Czech)'],
    [/^✔ Titulky přidány do „(.+)“ – (\d+) titulků/, '✔ Captions added to “$1” – $2 captions'],
    [/^↶ Smazáno z posledního zadání: /, '↶ Deleted from the last task: '], [/ · dalším klikem i předchozí \(/, ' · click again for the previous one ('],
    [/^✖ Zpět se nepodařilo: /, '✖ Undo failed: '], [/^✖ Zpět: časový limit.*/, '✖ Undo: timed out (the editor is busy?)'],
    [/^Vložit do projektu: /, 'Import into project: '], [/^✖ Okno pro výběr souborů se neotevřelo: /, '✖ The file dialog did not open: '],
    [/^✖ Diktování selhalo: /, '✖ Dictation failed: '], [/^✖ Mikrofon nedostupný: /, '✖ Microphone not available: '],
    [/^⚙ cílová délka (\d+) s$/, '⚙ target length $1 s'], [/ čeká$/, ' waiting'], [/^➕ do fronty: /, '➕ queued: '],
    [/^⚙ lokální model \((\w+)\), cílová délka (\d+) s – kredity se nečerpají/, '⚙ local model ($1), target length $2 s – no credits used'],
    [/^⚙ lokální model \((\w+)\) – kredity se nečerpají/, '⚙ local model ($1) – no credits used'],
    [/^⚙ zdroj z aktivní sekvence „(.+)": (.+)$/, '⚙ source from the active sequence “$1”: $2'], [/^⚙ zdroj z projektu: /, '⚙ source from the project: '],
    [/^✔ vybráno (\d+) vět, odhad (\d+) s/, '✔ $1 sentences selected, about $2 s'],
    [/^✔ hotovo: sekvence „(.+?)" \(Vytvořena sekvence „.+?“ \((.+?)\) z (\d+) úseků\.\)/, '✔ done: sequence “$1” ($2, $3 segments)'],
    [/^✔ hotovo: sekvence „(.+?)"/, '✔ done: sequence “$1”'],
    [/Vytvořena sekvence „(.+?)“ \((.+?)\) z (\d+) úseků\./g, 'Created sequence “$1” ($2) from $3 segments.'],
    [/témata: /g, 'topics: '], [/\bplán (\d+) s\b/g, 'planning $1 s'],
    [/vynechány věty moderátora \/ jiných mluvčích \((\d+)\)/g, "host / other speakers' sentences left out ($1)"],
    [/vyřazeno mimo téma: (\d+) vět/g, 'off-topic removed: $1 sentences'], [/doplněny začátky souvětí: (\d+)/g, 'sentence starts added: $1'],
    [/kraje dotaženy k pauze: (\d+)/g, 'edges snapped to pauses: $1'],
    [/^ℹ plán složen znovu bez vět se slyšitelnou hranicí: /, 'ℹ plan rebuilt without sentences that have an audible edge: '],
    [/^ℹ vyřazen úder se slyšitelnou hranicí: /, 'ℹ beat with an audible edge dropped: '], [/^ℹ místo něj náhradní úder: /, 'ℹ replacement beat: '],
    [/^ℹ souvislá pasáž \((\d+) kandidátů\)/, 'ℹ continuous passage ($1 candidates)'],
    [/^ℹ krátký klip složený z vět k tématu \((\d+) kandidátů\)/, 'ℹ short clip built from on-topic sentences ($1 candidates)'],
    [/^ℹ upoutávka z úderů \((\d+) kandidátů\)/, 'ℹ teaser built from beats ($1 candidates)'],
    [/^ℹ vyřazeno – vytržené by zkreslilo význam: /, 'ℹ removed – out of context it would distort the meaning: '],
    [/střih obrazu ([\d.]+) s po začátku klipu, uvnitř řeči – obraz jen bleskne/g, 'picture cut $1 s after the clip start, inside speech – the shot only flashes'],
    [/střih obrazu ([\d.]+) s před koncem klipu, uvnitř řeči – obraz jen bleskne/g, 'picture cut $1 s before the clip end, inside speech – the shot only flashes'],
    [/začátek (\S+) posunut na střih obrazu (\S+)/g, 'start $1 snapped to picture cut $2'], [/konec (\S+) posunut na střih obrazu (\S+)/g, 'end $1 snapped to picture cut $2'],
    [/#(\d+) pokračuje větou #(\d+) \(„(.*?)…“\), která ve střihu chybí – souvětí skončí uprostřed/g, '#$1 continues in #$2 (“$3…”), which is not in the edit – the sentence ends mid-way'],
    [/#(\d+) začíná uprostřed souvětí – chybí #(\d+)/g, '#$1 starts mid-sentence – #$2 is missing'],
    [/: Auto Reframe podle obličeje – „/, ': Auto Reframe following the face – “'], [/, střihy kamery: /, ', camera cuts: '], [/ se nepovedl: /, ' failed: '],
    [/^⚙ komentář na samostatné stopě: (.+) – skládám pod něj obraz z (\d+) záznamů/, '⚙ voice-over on a separate track: $1 – building picture under it from $2 recordings'],
    [/časový limit/g, 'time limit'], [/Střihátko je zaneprázdněné\?/g, 'the editor is busy?'],
    [/^(\s*)Zdroj:/, '$1Source:'], [/^(\s*)Rychle:/, '$1Quick:'], [/^(\s*)Titulky:/, '$1Captions:'], [/^(\s*)jazyk(\s*)$/, '$1language$2'],
    [/Do fronty/, 'Queue'], [/Most \(port/, 'Bridge (port'], [/Zastavit AI/, 'Stop AI'], [/MY Premiere MCP/, 'PZ AI'],
    [/^(\s*)požadavků:/, '$1requests:'],
  ];

  function translate(s) {
    if (!s || !s.trim()) return s;
    var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
    if (Object.prototype.hasOwnProperty.call(EXACT, core)) return lead + EXACT[core] + trail;
    for (var i = 0; i < STARTS.length; i++) if (core.indexOf(STARTS[i][0]) === 0) return lead + STARTS[i][1] + trail;
    var out = s;
    for (var t = 0; t < TEMPLATES.length; t++) if (out.indexOf(TEMPLATES[t][0]) >= 0) out = out.split(TEMPLATES[t][0]).join(TEMPLATES[t][1]);
    if (out.indexOf(LANG_NOTE.trim()) >= 0) out = out.split(LANG_NOTE.trim()).join('').replace(/\s+$/, '');
    for (var r = 0; r < RULES.length; r++) out = out.replace(RULES[r][0], RULES[r][1]);
    return out;
  }

  var busy = false;
  function fixNode(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode;
      if (p && (p.nodeName === 'STYLE' || p.nodeName === 'SCRIPT' || p.nodeName === 'TEXTAREA')) return;
      if (p && p.closest && p.closest('#out')) return; // chat (průběh, odpovědi AI) zůstává česky
      var v = translate(n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
      return;
    }
    if (n.nodeType !== 1 || n.nodeName === 'STYLE' || n.nodeName === 'SCRIPT' || n.id === 'out') return;
    fixAttrs(n);
    for (var c = n.firstChild; c; c = c.nextSibling) fixNode(c);
  }
  function fixAttrs(el) {
    ['title', 'placeholder'].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (v) { var t = translate(v); if (t !== v) el.setAttribute(a, t); }
    });
    // data-text rychlých zadání zůstává česky (obsah chatu je česky)
  }

  // prompt od uživatele -> pro AI: anglická rychlá zadání zpět na ověřené české znění; Claude/Codex odpovídají anglicky
  window.TN_UNTRANSLATE = function (prompt, agent) {
    var p = String(prompt || '');
    for (var i = 0; i < TEMPLATES.length; i++) p = p.split(TEMPLATES[i][1]).join(TEMPLATES[i][0]);
    return p;
  };
  window.TN_TRANSLATE = translate;

  function start() {
    // čeština: panel je v originále česky – nepřekládá se (ovládání z layout.js přeloží okno aplikace, src/i18n-app.js)
    try { if (window.parent && window.parent.TN && window.parent.TN.lang === 'cs') { document.documentElement.lang = 'cs'; document.title = 'PZ AI panel'; return; } } catch (e) {}
    document.documentElement.lang = 'en';
    document.title = 'PZ AI panel';
    fixNode(document.body);
    new MutationObserver(function (muts) {
      if (busy) return;
      busy = true;
      try {
        muts.forEach(function (m) {
          if (m.type === 'characterData') fixNode(m.target);
          else if (m.type === 'attributes') fixAttrs(m.target);
          else m.addedNodes.forEach(fixNode);
        });
      } finally { busy = false; }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'data-text'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
