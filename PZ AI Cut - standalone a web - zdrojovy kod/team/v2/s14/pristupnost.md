# S14 – Přístupnost a klávesnice (PZ AI Cut Standalone, Windows)

Instance `node test/standalone.js start 9385 %TEMP%\pz-s14-pristupnost --size 1366x768 --lang cs --ai` (viewport 1350×703, DPR 1), na konci `stop 9385`.
Ovládání: vlastní pomůcka přes CDP (skutečné klávesy `Input.dispatchKeyEvent` s virtual key code, aby fungoval Tab a Enter), computed style a strom přístupnosti Chromia (`Accessibility.getFullAXTree`).
Import jen přes `TN.app.importPaths` (`test/media/vyrez-5min.mp4`). Zkratky z nativní nabídky (Ctrl+N, Ctrl+M, F1) CDP poslat neumí, proto jsem šel přes tlačítka (Enter na „+“ / Export) a nápovědu otevřel přes `TN.app.cmd('help')`.
Prostředí: Worker přepisu tentokrát odmítl přístupový klíč (`Worker přepisu odmítl přístupový klíč`, kopie tokenu v profilu je stejná jako uživatelova), takže přepis neproběhl. Psaní do titulku (F2) jsem proto zkoušel na jednom titulku vloženém přes `app.edit`. AI agenta jsem nespouštěl.
Snímky jsou v `s14/shots-pristupnost/`.

## Verdikt
**Ze 2/3 ovladatelné klávesnicí, pro čtečku obrazovky zatím nepoužitelné.**

Co jde jen klávesnicí: In/Out ve Zdroji, vložení (`,`), střih Ctrl+K, výběr (D), zesílení (G + Enter), dialog Titulky z přepisu i celý export (Enter na Export, napsat cestu, Tab, Enter → MP4 1,4 MB v `web/test-out/pristupnost-s14-klavesnice.mp4`).

Cestu ale zastaví tři věci:
- panel Projekt nejde ovládat klávesnicí,
- fokus panelu (Zdroj, nebo Program/časová osa) nejde přepnout klávesou,
- modální okna nedrží fokus.

Čtečka u formulářových polí v dialozích neslyší jejich název a neohlásí žádný toast ani stav.

**Tři nejdůležitější nálezy**
1. **Panel Projekt nejde ovládat klávesnicí** (#1). Bez myši nejde otevřít další klip ve Zdroji ani sekvenci.
2. **Modální okna nedrží fokus** (#2). Nemají `role=dialog`, Tab uteče do pozadí, pozadí reaguje (Enter za otevřeným dialogem Zesílení otevřel panel Text v obraze) a po zavření skončí fokus na `<body>`.
3. **Fokus panelu nejde přepnout klávesou** (#3). Po importu patří klávesy Zdroji a Ctrl+K / Shift+šipky na časovou osu nepůsobí. Obejít to jde jen Enterem na některém tlačítku Programu.

## Nálezy

Závažnost: 3 = zasekne se, 2 = zdrží / neprofesionální, 1 = drobnost.

| # | Záv. | Nález (prvek, důkaz) | Návrh opravy |
|---|---|---|---|
| 1 | 3 | **Panel Projekt bez klávesnice.** `#projList` má `tabindex=0`, ale šipky, Home, Enter ani mezerník nic nevyberou (`selected` = null). Dlaždice `.pi.tile` mají `tabindex=-1`, chybí role i `aria-selected`, chybí focus ring (`.proj-list{outline:none}`, app.css:152). Kontextové menu (Otevřít ve Zdroji, Nová sekvence z klipu, Přepsat řeč) jde jen pravým tlačítkem myši: Shift+F10 nic neudělá, `#ctxMenu` jsou `div` bez `role=menu`. Snímky `03`, `14c`. | `role=listbox` (nebo `grid`) s putujícím `tabindex`. Šipky/Home/End = výběr, Enter = otevřít ve Zdroji / sekvenci na časové ose, Delete = odebrat, Shift+F10 / klávesa Menu = kontextové menu (`role=menu`, `menuitem`, šipky, Esc). |
| 2 | 3 | **Modální okna (Nová sekvence, Export, Titulky z přepisu, Zesílení, Klávesové zkratky)**, `#modal`/`#modalBox` (`openModal`, renderer.js:1074): chybí `role=dialog`, `aria-modal` a `aria-labelledby`, ve stromu přístupnosti žádný dialog není. Tab z posledního tlačítka (OK/Exportovat) pokračuje na `#btnExport` a dál po celé aplikaci (výpis Tabu: krok 7 = `OUT`). Pozadí přijímá klávesy: Enter na `#tabTxt` za otevřeným dialogem Zesílení otevřel panel Text v obraze (`10-po-enter-zesileni.png`). Po zavření (Esc / Enter / OK) je fokus na `BODY`, ne na spouštěcím tlačítku (`#btnNewSeq`, `#btnExport`). | Použít `<dialog>.showModal()` (past fokusu a `inert` zdarma), nebo `role=dialog aria-modal=true aria-labelledby=<h2>` + `inert` na hlavní rozvržení + cyklení Tabu. Při `openModal` uložit `document.activeElement` a v `closeModal` na něj vrátit fokus. |
| 3 | 3 | **Fokus panelu jen myší.** `app.focusPanel` volá jen `mousedown` (renderer.js:432) a ovládací prvky monitorů. Po importu je `TN.app.focus = 'source'`: Shift+→ posouvá Zdroj, Ctrl+K nic nerozstřihne (klipů pořád 1). Funguje až Enter na tlačítku Programu „O snímek vpřed“ (`focus = 'program'`, Ctrl+K → 2 klipy). Nápověda F1 přepínání panelů nezmiňuje. | Zkratky jako v Premiere: Shift+1 Projekt, Shift+2 Zdroj, Shift+3 Časová osa, Shift+4 Program (nebo Ctrl+Tab cyklicky). Ohlásit to do `role=status` a přidat do F1 sekci „Ovládání klávesnicí“ (Tab, Esc, Enter, přepínání panelů). |
| 4 | 2 | **Mezerník na tlačítku s fokusem spustí přehrávání místo stisku tlačítka.** `handleKey` vynechává jen input/textarea/select (renderer.js:984), takže Space → `play` + `preventDefault`. Důkaz: fokus na `#btnListView` (Seznam) + Space → zobrazení zůstalo `icons` a 2 videa začala hrát; Enter tlačítko stiskne. | V `handleKey` vrátit `false` pro Space/Enter, když je cíl `button`, `[role=button]`, `a`, `input[type=checkbox\|radio]`. |
| 5 | 2 | **Esc nezavře dialog, když je fokus v `<select>`** (Export → `#exLoud`: po Esc `modal.show` = true). Větev pro Esc platí jen pro `tag === 'input'` (renderer.js:983). | Podmínku rozšířit na `select` a `textarea` (a na `<dialog>` událost `cancel`). |
| 6 | 2 | **Chybí viditelný fokus.** Zaškrtávací políčka, přepínače a posuvníky: `input:focus{outline:none}` (app.css:31), u nich se `border-color` nijak neprojeví (`#trAuto`, `#cfHl`, `#thumbSize`, posuvníky Text v obraze; snímky `14a`, `14b`). Dále `#projList`, záložky AI panelu `.pz-tab` (fokus na „Titulky“ není vidět, `13-ai-zalozka-fokus-titulky.png`) a `select`/textová pole, kde je fokus jen 1px rámeček `#444 → #2d8ceb` (změna 2,81:1). | Jednotně `:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px }` pro všechny ovládací prvky. `outline:none` ponechat jen u textových polí, která mají výrazný 2px rámeček. |
| 7 | 2 | **Pole bez přístupného názvu** (strom přístupnosti: `textbox ""`, `combobox ""`, `spinbutton ""`, `slider ""`). Nová sekvence: název, předvolba, šířka, výška, fps. Export: `#exOut`, 4× select, tlačítko `#exBrowse` „…“ (bez title/aria). Zesílení: obě číselná pole. Text v obraze: 4 posuvníky (Velikost nadpisu, Délka řádku, Velikost písma, Výška). Editor titulku `textarea.cap-edit`. Důvod: `<label>` bez `for` a nebalí pole. | `label for` / `id`, případně `aria-labelledby` na sousední popisek. U „…“ `aria-label="Vybrat výstupní soubor"`. |
| 8 | 2 | **Nic se neohlašuje.** `#toast` a `#status` jsou bez `aria-live`/`role` a v hlavním okně ani v AI panelu není žádná živá oblast (`[aria-live],[role=status],[role=alert]` = 0 / 0). Chyba „Worker přepisu odmítl…“, „✔ Hotovo za 1 s“ po exportu ani výsledky příkazů čtečka neuslyší. Po Enter na Exportovat navíc fokus spadne na `BODY` (tlačítko se zakáže). | `#status` → `role=status aria-live=polite`, chybový toast `role=alert`, průběh/hotovo exportu do živé oblasti. Během exportu nechat fokus v dialogu (např. na Zavřít). |
| 9 | 2 | **Kontrast textu pod 4,5:1** (computed style, efektivní pozadí): primární modrá tlačítka (OK, Exportovat, Vytvořit…) bílá na `#2d8ceb` **3,46:1** (12px). Popisky v dialozích `#8e8e8e` na `#2a2a2a` **4,38:1**. Vybrané fialové tlačítko „2“ (Řádky) a „Spustit“ (16px) bílá na `#8b5cf6` **4,23:1**. „+3 dB“ na klipu **2,76:1** (11px). Odznak „fx“ **3,51:1** (10px). Zástupný text nadpisu `#757575` na `#26252f` **3,28:1**. | Modrá `#1f6fc4` (5,09:1), fialová `#7c3aed` (5,70:1, už je na „Přepsat řeč“), popisky dialogu `#9a9a9a` (5,10:1), zástupný text `#999` (5,31:1). Štítek dB/fx na tmavém podkladu (např. `rgba(0,0,0,.5)`). |
| 10 | 2 | **Hranice polí v dialozích pod 3:1** (WCAG 1.4.11): rámeček `#444` proti dialogu `#2a2a2a` **1,47:1**, pozadí pole `#1a1a1a` proti dialogu **1,21:1**. Pole v dialogu Nová sekvence a Export jsou na 1366×768 sotva vidět. | Rámeček aspoň `#767676` (3,16:1 proti `#2a2a2a`). |
| 11 | 2 | **Rozhraní nejde zvětšit a při 150 % se rozpadá.** Nabídka nemá role zoom, Ctrl+= je „výška video stop“ a `webFrame.getZoomFactor()` zůstane 1. Při zoomu 1,5 (stejné jako škálování Windows 150 % na 1366×768, viewport 900×469) uřízne `.tbtns` 6 tlačítek Programu (Značka, In, Out, Vyzvednout, Vyjmout, Exportovat snímek). `#prgDur` přeteče přes AI panel (x 631–741 > 560). Nástroje Ruka, Lupa a Text jsou pod okrajem okna (y 473–577 > 469). Snímek `16-zoom150.png`. | Přidat zvětšení rozhraní (Okno → Lupa rozhraní, Ctrl+Shift+= / Ctrl+Shift+−, uložit do nastavení). Lišty monitorů zalamovat nebo schovat do „»“, sloupec nástrojů posouvat. |
| 12 | 2 | **Vysoký kontrast Windows (forced-colors) smaže stavy.** Vybraný a nevybraný nástroj, záložky panelů i Řádky 1/2/3 mají v režimu forced-colors stejné computed barvy (pozadí `#000`, rámeček `#fff`). Chybí `@media (forced-colors)`. Snímek `18-vysoky-kontrast.png`. | `@media (forced-colors: active) { .on, [aria-pressed=true], [aria-selected=true] { outline: 2px solid Highlight; } }` |
| 13 | 2 | **Stav přepínačů a záložek čtečka nezná.** Nástroje, `.ptab-btn` (Projekt/Přepis/Titulky, Zdroj/Text v obraze), přichytávání, propojený výběr, zámek/oko/M/S, Řádky 1–3 a délky 10/20/30 s mají stav jen ve třídě `.on`: chybí `aria-pressed`/`aria-selected`/`role=tab`. Názvy tlačítek berou text místo title: „M“, „S“, „Aa“, „▶“, „×“, „1/2/3“. Zámky stop se jmenují všechny stejně („Zamknout / odemknout stopu“ ×7) a cílení stop V1/A1 (`span.tt`, `span.patch`) nejde fokusovat. | `aria-pressed` u přepínačů, `role=tablist/tab` + `aria-selected`, `aria-label` se stopou („Ztlumit A1“, „Zamknout V2“). Cílové stopy jako `button`. |
| 14 | 1 | **Fokus spadne na `BODY` i po přepnutí jazyka** (Enter na English), takže se Tab začíná od začátku. | Po přerenderování vrátit fokus na přepínač jazyka. |
| 15 | 1 | **Nabídky panelů „≡“** (`span.tab-menu`, 5×) nejdou fokusovat a nemají roli. Tři z nich nemají ani název. | `button aria-label="Nabídka panelu …"`, případně `aria-haspopup`. |
| 16 | 1 | **Malé cíle a písmo** (informativně, WCAG 2.1 AA velikost cíle nevyžaduje, 2.2 AA 24px ano): jazyk 30×20, ≡ 14×19, M/S 20×20, zámek/oko 22×22, zaškrtávátka 13×13, „Pokračovat v konverzaci“ 18×18. Písmo 11px má 27 textových prvků (stopy, stavový řádek, popisky), 10px odznak fx. | Klikací plochu aspoň 24×24 (padding), stavový řádek a popisky stop 12px. |

**Vedlejší nález pro Vzhled a jazyk:** po přepnutí cs → en → cs zůstane v panelu Projekt anglické „Untitled.pzcut“, i když nadpis ukazuje „Bez názvu“ (`.proj-path`).

## Co funguje (ověřeno)
- **Pořadí Tabu v dialozích je logické.** Nová sekvence: název → předvolba → šířka → výška → fps → Zrušit → OK. Export: soubor → … → formát → kodér → hlasitost → rozsah → Zavřít → Exportovat. Zakázaná zaškrtávátka se přeskočí.
- **Otevření, Enter a Esc:** po otevření má fokus první pole. Enter potvrdí Novou sekvenci i Zesílení (+3 dB se zapsalo). Esc zavře dialog z pole i z tlačítka.
- **Psaní do polí nespouští střih.** Nadpis „Most I O C M V K D G“, Ctrl+A, Backspace, Delete a Ctrl+Z v poli i v titulku (F2) nechaly historii, nástroj, In/Out i klipy beze změny. Esc v titulku vrátí text.
- **Názvy ikonových tlačítek:** tlačítka monitorů a nástrojů mají název (z title, včetně zkratky).
- **Výchozí focus ring na tlačítkách** je vidět (oranžová, 6,95:1 proti pozadí).
- **Jazyk stránky:** `lang` se přepne cs/en v okně i v AI panelu.
- **Logo** má `alt=""` (dekorace).
- **Text** má kontrast v naprosté většině 4,8–16:1.
- **Nápověda F1** obsahuje všechny zkratky střihu.
