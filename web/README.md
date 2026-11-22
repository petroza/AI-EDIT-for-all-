# PZ AI Cut Web

Webová verze střižny PZ AI Cut: https://pz-ai-cut.pages.dev (Google Chrome / Edge na počítači).

- **Nic se neinstaluje a nic neopouští počítač.** Stránka je jen program; videa se čtou přímo z disku uživatele
  (File System Access API), projekty se ukládají do souborů `.pzcut` tam, kam si je uživatel uloží.
  Na serveru nejsou žádná data – Cloudflare jen doručí statické soubory.
- **Formáty:** H.264 + AAC v MP4 / MOV / M4V (import), export MP4 H.264 + AAC (na Windows N bez Media Feature Packu
  Opus – okno Exportu to ukáže).
- **Střih:** stejný kód jako desktop (`src/`): časová osa, nástroje, zkratky Premiere, přechody, titulky, CZ/EN.
- **AI:** přes Claude Desktop uživatele. Konektor `pz-ai-cut.mcpb` (ke stažení v AI panelu) se nainstaluje do
  Claude Desktop jedním kliknutím; Claude pak volá nástroje (přepis, výběr vět, nová sekvence, titulky), které
  provede stránka v Chrome. Spojení jde jen přes `127.0.0.1` (Chrome se jednou zeptá na přístup k místní síti).
  Řeč se přepisuje v prohlížeči (Whisper, transformers.js; model se stáhne jednou). Claude dostane jen text.
- **Tři cesty připojení AI** (průvodce v AI panelu, stav se kontroluje sám):
  1. Claude Desktop – rozšíření `pz-ai-cut.mcpb` (dvojklik → Instalovat; Node dodá Claude Desktop).
  2. Claude Desktop, když firma blokuje rozšíření – plugin `pz-ai-cut-plugin.zip` (Customize → Plugins → Add →
     Upload plugin). Obsahuje stejný .mcpb + skill s postupem. Místní server z pluginu běží jen v **Cowork** a v záložce
     Code, ne v obyčejném chatu (dokumentace Anthropic). Ověřeno v Claude Code (`--plugin-dir`), Cowork neověřen.
  3. Codex (ChatGPT) – jeden příkaz: Windows `irm https://pz-ai-cut.pages.dev/codex/install.ps1 | iex`,
     Mac `curl -fsSL https://pz-ai-cut.pages.dev/codex/install.sh | sh`. Stáhne konektor do `~/.pz-ai-cut` a zapíše
     `[mcp_servers.pz-ai-cut]` do `~/.codex/config.toml` (záloha `.bak-pz-ai-cut`). Node: systémový, jinak ten
     z aplikace Codex (`start.cmd` / `start.sh`). Ověřeno na Windows se skutečným Codexem; Mac neověřen.
  Claude i Codex můžou být připojené naráz (porty 7895–7897). Je-li střižna otevřená ve víc kartách, úkoly jdou do
  karty, se kterou se naposledy pracovalo.
- **Formát pro sítě (9:16, 4:5, 1:1):** `ai/reframe.js` – výřez podle obličeje jako Auto Reframe na desktopu: střihy
  kamery uvnitř klipu (porovnání zmenšených snímků, upřesnění na snímek) → klip se rozřízne (jen obraz), v každém
  záběru MediaPipe Face Detector (CDN, model jednou) na celém snímku i menších dílech (malé tváře v širokém záběru);
  víc tváří → kdo mluví (pohyb úst vůči čelu), nerozhodné → větší. Na rozhovoru TALK: 7 záběrů / 3 s, vše správně;
  měření proti mluvčím z přepisu Premiere v 25 širokých záběrech: 88 % správně (podle úst 17/18 = 94 %).
- **Titulky:** `src/core/captionlayout.js` (společné pro náhled, oba exporty, okno stylu i AI) – skládání po větách do
  vyrovnaných řádků podle skutečné šířky textu; styl sekvence (řádky, délka řádku, velikost, výška, barva, podklad)
  v okně Sekvence → Titulky → Styl titulků… nebo „Aa“ u stopy titulků (`src/ui/captionstyle.js`) – změna se hned
  přeskládá, ruční opravy textu zůstanou. Klik na titulek v obraze nebo na časové ose = přepsat (Enter uloží, Esc zruší).
- **Sítě:** výchozí styl titulků podle tvaru obrazu (`SHAPES` v captionlayout.js): 9:16 titulky ve 30 % výšky
  (dolních ~22 % a pravý sloupec zakrývá rozhraní Reels/TikTok/Shorts), 4:5 v 10 %, 1:1 v 7 %; tučné písmo s obrysem
  a stínem. Programový monitor u 9:16 ukazuje bezpečné zóny (tlačítko „Bezpečné zóny“), okno stylu varuje, když jsou
  titulky v zakryté oblasti. Export sekvence pro sítě má rovnou −14 LUFS. Opravený text, který se nevejde do nastavených
  řádků, se rozdělí na dva titulky (`retext`).
- **Nadpis nahoře** (`seq.title`, okno Text v obraze / Sekvence → Titulky → Nadpis nahoře…, klik na nadpis v monitoru,
  nástroj AI `set_title`): bílé tučné písmo na tmavém podkladu, u 9:16 pod horní lištou aplikace; nejvýš 2 řádky
  (písmo se případně zmenší), vypaluje se vždy (web: canvas, desktop: ASS přes libass).
- **Auto Reframe → Všechny formáty pro sítě:** z jedné sekvence 16:9 rovnou 9:16, 4:5 a 1:1 (nadpis se přenese,
  titulky se přeskládají na nový tvar).
- **AI panel – karta Výsledek:** poslední sekvence od AI s tlačítky Přehrát / Text v obraze / Exportovat.
- **Víc karet:** automatickou zálohu ukládá jen jedna karta (BroadcastChannel); další ukáže „Pracovat tady“
  a převzetím si načte poslední stav – karty si už nepřepisují práci.
- **Souběžný přepis:** na silném počítači (≥ 12 vláken, ≥ 8 GB) dva přepisovací procesy s polovinou vláken –
  změřeno 50 s → 40 s na 150 s záznamu (3–4 procesy už nepomohou). Vynutit: `window.__pzAsrWorkers = N`.
- **Průběžný přepis:** během přepisování je hotová část (po oknech 240 s) dostupná nástrojům AI (`T.partialForMedia`) –
  get_transcript / search_transcript ji vrátí s poznámkou, transcribe_media řekne, kam už přepis došel.
- **Karaoke titulky:** styl `highlight` (okno Text v obraze, nástroj AI `add_captions highlight`) – vyslovované slovo
  žlutě; časy slov `caption.ws` z přepisu (jinak odhad podle znaků). Náhled, webový export i desktop (ASS, událost na slovo).
- **Soubor → Exportovat verze pro sítě:** 9x16 / 4x5 / 1x1 téže sekvence do jedné složky (web: showDirectoryPicker).
- **Nápověda → Jak na video pro sítě:** postup v 6 krocích. AI panel: rychlé akce Všechny formáty a Karaoke titulky.
- **Přehrávání v problémových GOP:** web i desktop podkládají přesné snímky z WebCodecs i při přehrávání (`web/ai/stillframes.js`).
- **Ne-IDR I-snímky (TN MP4):** při střihu kamery má soubor I-snímek, který stss vydává za klíčový. ffmpeg
  `-ss` před `-i` i Chrome `<video>` po skoku do takového GOP ukazují zastaralý obraz až do dalšího IDR. Řešení:
  desktop export a hledání střihů skok o 11 s dřív + trim (`exporter.preroll`), OpenCV čte vpřed (tools/faces.py),
  webový náhled zastaveného obrazu v těchto úsecích přes WebCodecs (`player.stillProvider`).
- **Auto Reframe i na desktopu přes MediaPipe** (web/ai/reframe.js `reframeCopy` + `FsFile`), záloha ffmpeg + OpenCV.
- **Dekódování:** jako klíčový snímek se posílá jen skutečný IDR (stss v MP4 označuje i ne-IDR snímky → Chrome
  dekodér jinak spadne; projevilo se při výřezu na náhodných místech rozhovoru).
- **AI panel:** předvolby stopáže (15 s … 5 min) a formátu pro sítě (9:16, 4:5, 1:1, 16:9) se připíšou k zadání;
  vytížení počítače (paměť karty přes `measureUserAgentSpecificMemory`, zatížení CPU přes Compute Pressure API –
  VRAM ani přesné % CPU prohlížeč nezjistí).
- **Přepis bez AI (kolo 1 týmu):** `window.__pzASR` (web/ai/bridge.js) – stav po klipech (none / queued / running /
  stopped / done / error), start / stop / load / seqWords. Přepis se spouští sám po importu (volba „Automaticky přepisovat“),
  Zastavit ukončí vlákna hned, hotová část (okna 240 s) se ukládá do IndexedDB (`p|<otisk>|jazyk`) a Pokračovat na ni
  naváže (i po F5). Přepis je uložený podle **otisku obsahu** (velikost + SHA-256 začátku/středu/konce), stejné video pod
  jiným jménem ho má hned; starší záznamy podle jména se převezmou.
- **Záložka Přepis** (src/ui/transcript-panel.js) vedle panelu Projekt: věty, hledání bez diakritiky (Ctrl+F), klik na větu =
  In/Out Zdroje (cutBounds), Shift+klik víc vět, Vložit do sekvence; upozornění na ruční In/Out uprostřed věty (Přichytit);
  štítek stavu přepisu na dlaždici klipu. Na desktopu skrytá (přepis v aplikaci je jen na webu).
- **Hranice podle zvuku:** pauza = 60ms okno 15 dB pod úrovní řeči; bez pauzy u odhadu nejbližší pauza směrem ven
  (cutBounds vrací `inOk` / `outOk` – false = souvislá řeč, panel radí přidat větu).
- **Titulky z přepisu bez AI:** Sekvence → Titulky → Vytvořit titulky z přepisu (také okno Text v obraze, AI panel „Titulky
  (bez AI)“) – jen slova, která v sekvenci zazní, jeden krok Zpět; chybí-li přepis, spustí ho a titulky doplní po dokončení.
- **Nová sekvence:** výchozí prázdná 1080×1920; vybraný klip jen zaškrtnutím (s In–Out). Klip na šířku v sekvenci na výšku = cover.
- **Přesnost přepisu (kolo 2):** pevný měřicí vzorek `test/asr-ref/` (Šimková 18:00–20:00 a 25:51–26:10, reference s `[?]`
  u nejistých míst), `node test/asr-wer.js [-v]` = chybovost slov po modelech. Přesné (large-v3-turbo q8) běží na procesoru
  (na grafice q4 horší chybovost, fp32 2,7 GB se nenačetl); na silném PC 2 vlákna. Slabý počítač (< 8 vláken nebo < 8 GB) =
  jen Standardní (`window.__pzAsrWeak` simulace). Přepsat přesněji… = nový přepis, dosavadní platí do dokončení.
- **Mezipaměť modelu v OPFS** (whisper-worker.js, `env.customCache`, složka `pz-models`): Cache API soubory velkého modelu
  (615 / 420 MB) neuložilo a model se stahoval při každém otevření. Teď se stáhne jednou, další vlákna i otevření ho načtou z disku.
- **Záložka Titulky** (src/ui/caption-list.js): seznam titulků, oprava v řádku (Enter uloží a další, Esc, ↑↓, F2 = titulek pod
  hlavou). Oprava se zapíše i do přepisu: `project.asrFixes[mediaId] = [{s, e, text}]` (součást kroku Zpět), přepis se čte s
  opravami (`T.applyFixes`), úsek se najde podle textu (`T.matchSpan`) – „Vytvořit znovu z přepisu“ ani „Přepsat přesněji“ opravy neztratí.
- **Hák bez ticha (cutBounds):** z pauzy jen 0,15 s před nástupem řeči (`tightenIn`), konec doznění 0,2 s, ale ne do další řeči
  (`tightenOut`). **Časy slov pro titulky** podle zvuku klipu (`speechAlign`): slovo celé v tichu vypadne, fráze po pauze začne nástupem řeči.
- **Rozvržení:** panel AI bez AI sbalený do pruhu 36 px (`settings.aiPanel`, tečka stavu); Text v obraze je záložka v rámu Zdroje
  (nikdy nepřekryje monitory ani export); štítek přepisu u klipu otevře Přepis; první import otevře klip a Přepis.

## Struktura
| Soubor | Co dělá |
|---|---|
| `entry.js` | vstup: menu, okno aplikace ze `src/renderer.js`, napojení, AI most |
| `build.js` | sestavení do `dist/` bez bundleru (náhrady modulů Node/Electron), balík konektoru `.mcpb` |
| `shims/` | `fs` (localStorage + soubory uživatele), `electron` (dialogy Chrome), `vfs` (virtuální cesty, IndexedDB handle) |
| `engine/mp4.js` | čtení MP4/MOV (moov, vzorky) bez knihoven |
| `engine/decode.js` | WebCodecs: snímek v čase, zvuk úseku, průběh zvuku |
| `engine/mp4-writer.js` | zápis MP4 přímo na disk |
| `media-web.js`, `importer-web.js`, `export-web.js` | webové verze `src/core/media|importer|exporter` |
| `ai/bridge.js`, `ai/tools.js`, `ai/transcripts.js` | most ke konektoru, nástroje pro Clauda, přepisy |
| `static/` | web.css, AI panel (`ai-web.html/js`), Whisper worker, `_headers` |
| `codex/` | instalace konektoru do Codexu (`install.ps1`, `install.sh`) a spouštěče hledající Node |
| `plugin/` | plugin pro Claude (manifest + skill); `pz-ai-cut.mcpb` se přibalí při sestavení |
| `../connector/` | konektor pro Claude Desktop (MCP server bez závislostí) |

## Příkazy
```
node web/build.js        # sestavit do web/dist
node web/serve.js        # místní test na http://127.0.0.1:8791
node web/deploy.js       # sestavit a nasadit (přístup v web/.env, mimo git)
node test/mcp-client.js '[{"name":"editor_status"}]'   # test konektoru jako Claude Desktop
```

## Jak změřit přepis na redakčním notebooku (bez instalace)
1. Na notebooku otevři v Chrome https://pz-ai-cut.pages.dev, importuj libovolný 5min rozhovor (Soubor → Importovat).
2. Přepis se spustí sám; v záložce Přepis sleduj „Stahuji…“, „Připravuji… m:ss“ a „Přepisuji řeč… % · zbývá asi N min“.
3. Po dokončení: čas přepisu 5 min × 5,6 = odhad pro 28min rozhovor (pravidlo kola 3: Přesné jako výchozí jen do 14 min).
4. Pro srovnání Přepis ≡ → Přesnost přepisu → druhá volba a pravý klik na klip → Přepsat znovu…; obě doby zapiš do team/log.md.
5. Simulace na silném PC: `node test/notebook.js <4|8> <accurate|standard>` (Chrome s afinitou na 4/8 CPU, vlastní profil, výsledky web/test-out/nb-*.json).
