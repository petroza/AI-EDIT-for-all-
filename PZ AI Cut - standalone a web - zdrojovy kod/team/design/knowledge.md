# Znalostní základna UX designéra – PZ AI Cut

Udržuje UX designér (`team/ux-designer.md`). Jen pravidla a vzory, které jdou přímo použít. Stav k 2026-11-21.
Cílový uživatel: **redaktor TN, 10 minut, 1–2 krátká videa na sítě, žádné školení, žádné technické pojmy.**

---

## A. Principy a vzory (se zdroji)

### A1. Nielsenových 10 heuristik – jak je číst pro střižnu
Zdroj: [NN/g – 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

| # | Heuristika | Pravidlo pro PZ AI Cut |
|---|---|---|
| 1 | Viditelnost stavu systému | Každá dlouhá věc (přepis, AI, výřez, export) ukazuje **co se děje + % + odhad času** na místě, kam se uživatel dívá (ne jen ve stavovém řádku 11 px). |
| 2 | Shoda se skutečným světem | Slova redaktora: „video / verze / náhled / titulky / hlasitost pro sítě“, ne „sekvence / Program / kodér / LUFS / sidecar / bridge“. |
| 3 | Kontrola a svoboda | AI vždy staví **novou** verzi (původní zůstává) – říkat to nahlas. Zpět (Ctrl+Z) i viditelné „Zrušit“ u dlouhých úloh. |
| 4 | Konzistence | Jeden akcent, jeden poloměr rohů, stejné slovo pro stejnou věc v menu, panelu i nápovědě. |
| 5 | Prevence chyb | Rozumné výchozí hodnoty (9:16 → titulky 30 %, −14 LUFS, vypálit titulky). Varovat dřív, než chyba vznikne (titulky v zakryté zóně – už máme). |
| 6 | Rozpoznání místo vybavování | Postup ukázat **v rozhraní** (kroky, hlavní tlačítko), ne v nápovědě, kterou si musí pamatovat („Sekvence → Auto Reframe…“). |
| 7 | Flexibilita | Zkratky Premiere pro střihače ponechat, ale skryté; začátečník je nepotřebuje vidět. |
| 8 | Minimalismus | Co redaktor nepotřebuje pro svůj úkol (zdrojový monitor, panel nástrojů, vytížení CPU, log), nemá soutěžit o pozornost. |
| 9 | Rozpoznat a napravit chyby | Chyba = co se stalo + proč + co mám udělat, česky, s tlačítkem nápravy. Nikdy holé `e.message`. |
| 10 | Nápověda | Krátká, u místa použití, v krocích. |

### A2. Progresivní odhalování a onboarding
- Úvodní tutoriály uživatelé přeskakují a nepamatují si je; účinnější jsou **tipy v kontextu** v okamžiku potřeby. Zdroj: [NN/g – Onboarding tutorials](https://www.nngroup.com/articles/onboarding-tutorials/), [NN/g – Mobile app onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/).
- Pokročilé volby skrýt za „Podrobnosti / Více možností“, ale dát najevo, že existují. Zdroj: [NN/g – Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
- **Jedna hlavní akce na obrazovku** (jediné vyplněné tlačítko akcentem); ostatní sekundární (obrys).
- Onboarding = „udělej první věc“ (Importovat video), ne „přečti si 6 kroků“.

### A3. Prázdné stavy
Zdroj: [NN/g – Designing Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)
- Nikdy úplně prázdno – uživatel neví, jestli se načítá, selhalo to, nebo nic není.
- Prázdný stav = **co tu bude + jak to sem dostat + tlačítko, které to spustí**.
- Během načítání nepsat „nic tu není“ – ukázat průběh.
- Nabídnout alternativu (např. „Vyzkoušet na ukázkovém videu“).
- Text konkrétní a akční: „Přetáhni sem video z disku“, ne „Žádná média“.

### A4. Chybové hlášky
Zdroj: [NN/g – Error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/)
- Zobrazit **u zdroje** chyby; závažnost = forma (inline / toast / dialog jen u vážných).
- Nespoléhat jen na barvu – ikona + tučný text.
- Lidská řeč, konkrétní problém, **návrh nápravy**; kód chyby jen do „Podrobností“.
- Neobviňovat („neplatný“, „chybný“), bez humoru.
- **Zachovat práci** uživatele (zadání v textovém poli se po chybě nesmaže).
- Šablona pro nás: **„[Co se nepovedlo]. [Proč, jednou větou]. [Tlačítko: co teď]“** – např. „Export se nepodařil. Na disku není dost místa. [Vybrat jinou složku]“.

### A5. Jak vedou začátečníka konkurenční nástroje (import → export pro sítě)

| Nástroj | Vzor, který stojí za převzetí | Zdroj |
|---|---|---|
| **CapCut** | Auto titulky = jedno tlačítko (jazyk → Rozpoznat), volitelně zvýraznění klíčových slov; hodně hotových stylů titulků; export s vypálenými titulky nebo souborem. | [CapCut – auto captions desktop](https://capcut.com/desktop/captions-for-video), [CapCut – subtitles guide](https://www.capcut.com/resource/how-to-add-subtitle-in-capcut) |
| **Descript** | Střih **přes text přepisu** (smažu slovo = smažu záběr); hromadné „Odstranit vycpávková slova“ s náhledem před použitím; AI „Clips“ najde silné momenty, uživatel jen dolaďuje. | [Descript – video editing](https://www.descript.com/video-editing), [Descript – Clips](https://www.descript.com/clips), [Zapier review](https://zapier.com/blog/descript-review) |
| **Premiere Pro – Auto Reframe** | Příkaz nad celou sekvencí → **nová kopie** sekvence v cílovém poměru, efekt na každém klipu; 3 předvolby pohybu (pomalejší / výchozí / rychlejší). | [Adobe – Auto Reframe](https://helpx.adobe.com/premiere-pro/using/auto-reframe.html) |
| **Premiere Pro – Captions** | Přepis → dialog „Vytvořit titulky“ s počtem řádků a max. znaků na řádek → styly. Uživatelé hlásí, že pravidla řádků nejsou vždy dodržena – po vygenerování se kontroluje. | [Adobe – Speech to Text](https://helpx.adobe.com/premiere-pro/using/speech-to-text.html), [Streaming Media tutorial](https://streamingmedia.com/Producer/Articles/Editorial/Featured-Articles/Tutorial-Speech-to-Text-in-Adobe-Premiere-Pro-148113.aspx) |
| **VEED** | Velikost podle **jména sítě** (TikTok, Shorts, Instagram…), titulky se při změně poměru přeskládají; předvolby stylů (Karaoke, Box highlight…); vypálení titulků doporučeno, protože sítě sidecar SRT většinou neberou. | [VEED – add subtitles](https://www.veed.io/tools/add-subtitles), [VEED – auto subtitle](https://veed.io/auto-subtitle) |
| **Canva** | Text → Dynamický text → Titulky → Vygenerovat; „Resize / Magic Switch“ podle předvoleb rozměrů. | [Canva – creating and editing videos](https://www.canva.com/help/creating-and-editing-videos/), [Canva – resize](https://www.canva.com/help/resize/) |

Společný vzorec všech: **(1) nahraj → (2) vyber formát podle sítě (jménem, s ikonou tvaru) → (3) auto titulky jedním klikem + hotový styl → (4) náhled s rozhraním sítě → (5) export s vypálenými titulky.** Technické volby (kodek, bitrate, hlasitost) jsou skryté nebo předvyplněné.

### A6. Formáty pro sítě
- 9:16 = 1080×1920 (Reels, TikTok, Shorts, Stories); 4:5 = 1080×1350 (příspěvek IG/FB); 1:1 = 1080×1080; 16:9 = 1920×1080. Zdroj: [Kapwing – aspect ratios guide](https://kapwing.com/resources/social-media-video-aspect-ratios-and-sizes-the-2025-guide).
- Formát pojmenovat **sítí** a ukázat **obrys tvaru** (AI panel to už dělá – držet).

### A7. Bezpečné zóny 9:16 (kam sahá rozhraní aplikace)
Oficiální čísla platformy zveřejňují jen pro reklamy a liší se; ber jako orientační a ověř na telefonu.
- **Meta (Reels reklamy):** nahoře 14 %, dole 35 %, po stranách 6 % bez textu a loga. Zdroj (souhrn Ads Guide): [AdNabu – Meta safe zones](https://blog.adnabu.com/meta-ads/meta-safe-zones/).
- **TikTok:** safe zone závisí na délce popisku a doplňcích; TikTok dává šablony ke stažení. Měření třetích stran: ~160 px nahoře, ~440 px dole, ~80 px po stranách (z 1080×1920). Zdroj: [TikTok Ads – TopView specs](https://ads.tiktok.com/help/article/tiktok-reservation-topview), [AdNabu – TikTok ad specs](https://blog.adnabu.com/tiktok/tiktok-ad-specs/).
- **YouTube Shorts:** oficiálně jen „nebezpečná oblast“ u okrajů v editoru; neoficiálně pravý sloupec tlačítek ~ 18–20 % šířky, dole ~ 35 %. Zdroj: [YouTube – Enhance your Shorts](https://support.google.com/youtube/answer/16215842), [Google universal safe zones PDF](https://services.google.com/fh/files/misc/universalsafezones-youtube.pdf).
- Společně bezpečný střed ~ 900×1400 px uprostřed. Zdroj: [Reap – safe zones](https://reap.video/blog/short-form-video-safe-zones).
- **Pravidlo pro nás:** titulky 25–35 % od spodu (výchozí 30 % – OK), nic důležitého v horních ~10–14 %, nic v pravém sloupci ~16–20 % mezi 40–80 % výšky, obličej v horní polovině středu. Nadpis nahoře pod horní lištou (~12 %+).

### A8. Titulky – čitelnost
- 1–2 řádky, max. ~42 znaků na řádek (TV/streaming), rychlost čtení dospělí do ~17 znaků/s. Zdroj: [Netflix Timed Text – General Requirements](https://backlothelp.netflix.com/hc/en-us/articles/215758617), [Netflix – Slovak guide](https://backlothelp.netflix.com/hc/en-us/articles/115002812588-Slovak-Timed-Text-Style-Guide); [BBC Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/).
- Na sítích kratší řádky (telefon, 9:16): ~20–28 znaků, tučné písmo, obrys/stín nebo podklad, bílá nebo žlutá. (Naše výchozí 24 zn. pro 9:16 – OK.)
- Vždy **vypálit** do obrazu – sítě externí SRT většinou neberou (viz VEED výše); spousta lidí kouká bez zvuku.
- Zvýraznění vyslovovaného slova (karaoke) = standard CapCut/VEED; nabízet, ne vnucovat.

### A9. Přístupnost (WCAG 2.2 AA)
- **Kontrast textu** 4,5 : 1 (běžný), 3 : 1 (velký = ≥ 24 px, nebo ≥ 18,66 px tučně). Zdroj: [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Kontrast ovládacích prvků a grafiky** (hrana pole, ikona, stav zapnuto) 3 : 1. Zdroj: [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- **Velikost cíle** min. 24×24 CSS px (nebo dost volného místa kolem); u důležitých prvků mířit na 44×44. Zdroj: [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [WCAG 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html).
- Viditelný fokus (`:focus-visible` obrys 2 px akcentem), vše ovladatelné klávesnicí, stav nesdělovat jen barvou (tečka + text).

---

## B. Design systém aplikace (jak je skutečně v CSS)

Soubory: `src/app.css` (základ), `src/premiere-look.css` (přebíjí: timeline, monitory, projekt), `web/static/web.css`
(menu, dialogy webu), `web/static/ai-web.html` (AI panel – vlastní tokeny), okno Text v obraze (`.capstyle` v app.css).

### B1. Barvy
**Střižna (šedá Premiere, modrý akcent):**
| Token | Hodnota | Použití |
|---|---|---|
| `--bg` | `#1b1b1b` | pozadí aplikace |
| panel (premiere-look) | `#1d1d1d` | panely, timeline `--tl-bg` |
| `--panel` / `--panel2` / `--head` | `#232323` / `#2b2b2b` / `#1f1f1f` | (app.css; přebito na #1b1b1b/#1d1d1d) |
| topbar / statusbar | `#141414` | |
| `--line` | `#3a3a3a` | linky, okraje tlačítek `#444` |
| `--text` / `--dim` | `#d6d6d6` / `#8e8e8e` | text / vedlejší |
| `--accent` / `--ph-blue` | `#2d8ceb` | výběr, playhead, timecode, primární tlačítka střižny |
| `--patch` | `#2d6ae0` | aktivní nástroj, cíl stopy |
| `--clip` / `--clip-hi` | `#2f6e88` / `#5c9dbb` | klipy / vybraný klip |
| `--sel` | `#f0b532` | vybraná mezera |
| `--danger` | `#e2574c` | chyba |
| titulky na timeline | `#6b5aa8`, stopa `#24222b` | |

**AI panel, okno Text v obraze, úvodní obrazovka (fialová):**
| Token | Hodnota |
|---|---|
| `--bg` | `#17161c` |
| `--card` / `--card2` | `#1f1e26` / `#26252f` |
| `--line` | `#34323f` (capstyle `#3a3846`) |
| `--text` / `--dim` | `#ecebf3` / `#a19fb3` |
| `--accent` / `--accent2` | `#8b5cf6` / `#a78bfa` (nadpisy sekcí `#c4b5fd`) |
| `--ok` / `--err` / `--warn` | `#22c55e` / `#f87171` / `#fbbf24` (capstyle varování `#f59e0b` + text `#fcd34d`) |
| bezpečné zóny | výplň `rgba(255,50,70,.32)`, čárkovaný okraj `rgba(255,140,150,.9)`; tlačítko zapnuto `#5b2330` / `#b4475a` |

**Změřený kontrast (WCAG):**
| Kombinace | Poměr | Verdikt |
|---|---|---|
| `#d6d6d6` na `#1d1d1d` | 11,6 | OK |
| `#8e8e8e` (dim) na `#1d1d1d` | 5,15 | OK; na `#2a2a2a` jen 4,38 ✗ |
| `#ecebf3` na `#17161c` | 15,2 | OK |
| `#a19fb3` (dim AI) na `#1f1e26` | 6,39 | OK |
| **bílá na `#8b5cf6`** (primární tlačítka AI, 12–13 px) | **4,23** | ✗ pro běžný text → plné tlačítko `#7c3aed` (5,70) |
| **bílá na `#2d8ceb`** (primární tlačítka střižny) | **3,46** | ✗ → `#1f74d0` (4,70) |
| `#2d8ceb` text na `#1d1d1d` (timecode) | 4,87 | OK |
| **`#555` na `#111`** (prázdný zdrojový monitor) | **2,53** | ✗ |
| **`#666` na `#1d1d1d`** (prázdná timeline) | **2,94** | ✗ → min. `#8e8e8e` |
| `#34323f` okraj pole na `#17161c` | 1,43 | ✗ pro 1.4.11 (textarea zadání) → okraj ≥ `#5f5c70` nebo světlejší podklad pole |

### B2. Písmo
- **Segoe UI**, system-ui. Střižna základ **12 px**; menu 12,5 px; stavový řádek a drobnosti 10–11 px.
- AI panel základ **13 px**, hlavička 17 px / 700, karty h3 13,5 px, popisky 11–12 px; tlačítka 600.
- Timecode: monitory Segoe UI 16 px (premiere-look), timeline 18 px, app.css fallback Consolas 14 px / 600.
- Kód / příkazy: Consolas / Cascadia Mono 12 px.
- Čísla v okně stylu `tabular-nums`. Nadpisy sekcí capstyle: 11 px VERZÁLKY, letter-spacing .04em, `#c4b5fd`.

### B3. Rohy
- Pravidlo týmu: **2–3 px**. Skutečnost: 3 px (tlačítka, vstupy, karty AI, seg. přepínače), 2 px (capstyle, onboard, klipy).
- **Odchylky k sjednocení:** `.mb/.pf/.ptool/.hi/.th .patch` 4 px, `.ctx-menu` 4 px, `.toast` 5 px, `.modal-box` **6 px**, hledání v projektu 12 px (pilulka), zoombar 7 px (OK – posuvník), tečky 50 % (OK).

### B4. Rozestupy a rozměry (bez formální škály – nejčastější hodnoty)
- Mezery: 2 / 3 / 4 / 6 / 8 / 10 / 12 / 14 px. AI panel: odsazení 14 px, mezi kartami 10 px, karta 11×13 px.
- Výšky: topbar 32, hlavička panelu 28 (ptab), lišta timeline 30, stavový řádek 22, monitor bar 30, transport 40, hlavička timeline 64.
- Tlačítka: AI `.btn` 32 / `.small` 26, chip 26, rychlé akce 38, záložky 34; střižna `.mb` 32×30, `.pf` 28×26, nástroje 32×32.
- **Pod 24 px (WCAG 2.5.8):** „Aa“ u stopy titulků **16 px výška**, „Bezpečné zóny“ **20 px**, `.th .tl` 20×20, `.th .ti` 22×22, vlaječky jazyka 30×20, křížek záložky sekvence, `cs-x`.

### B5. Komponenty
| Komponenta | Kde | Poznámka |
|---|---|---|
| Panel se záložkou (`.panel-head.ptab`) | Zdroj / Program / Projekt | „Program:“ a „Zdroj:“ = Premiere slovník |
| Transport (`.mb` ikony) | pod monitory | 11–13 ikon v řadě |
| Monitor + prázdný stav / onboarding (`.mon-empty.onboard`) | Program | 3 kroky + fialové tlačítko 26 px |
| Bezpečné zóny (`.safe-zones`, `.safe-btn`) | Program u 9:16 | výchozí zapnuto; popisek v obraze „Reels / TikTok / Shorts UI“ jen anglicky |
| Okno Text v obraze (`.capstyle`) | plovoucí, 320 px | živý náhled, posuvníky, seg. tlačítka, barvy, varování zóny – **nejlepší vzor v aplikaci** |
| Modální dialog (`.modal-box`) | Export, nápověda, zkratky | 420–760 px, primární vpravo |
| Toast, kontextové menu, menu lišta (web.css) | | |
| AI panel: záložky Zadání / Připojení, karta, seg. přepínač, chipy stopáže, dlaždice formátu s tvarem, rychlé akce 2×3, karta Výsledek (fialový přechod), průběh, log, vytížení | `ai-web.html/js` | |
| Pilulka stavu AI (`.pill`) | hlavička AI panelu | červená / zelená + text |

---

## C. Prvních 8 UX doporučení pro PZ AI Cut (redaktor TN, 10 minut) – podle přínosu

1. **Režim „Video pro sítě“ – jedna cesta místo celé Premiere.** Po otevření a bez rozdělané práce ukázat zjednodušené rozvržení: velký náhled (Program) + panel AI/postup vpravo + timeline; **skrýt zdrojový monitor a panel nástrojů** (přepínač „Plná střižna“ vrátí vše). Nahoře krokový ukazatel **1 Video → 2 Výběr → 3 Formát a titulky → 4 Export** s jedním zvýrazněným tlačítkem dalšího kroku.
   *Proč:* dnes redaktor vidí 4 panely, 13 ikon transportu a 10 nástrojů, které nepotřebuje (H8 minimalismus, progresivní odhalování); postup „Jak na video pro sítě“ je schovaný v Nápovědě a odkazuje na menu (H6 rozpoznání místo vybavování). Všechny konkurenční nástroje vedou lineárně import → formát → titulky → export (A5).

2. **Cesta bez AI musí jít dokončit.** Když AI není připojená, nabídnout v panelu přímo tlačítka, která AI nepotřebují: **„Titulky automaticky“** (přepis běží v prohlížeči), **„Převést na 9:16“**, **„Export pro sítě“**; „Poslat AI“ vypnout s vysvětlením „Nejdřív připoj AI (2 minuty) – nebo použij tlačítka výš“. Návod na instalaci (.mcpb, PowerShell) přesunout do sbaleného „Připojit AI“ a říct, že to dělá jednou IT/kolega.
   *Proč:* panel dnes bez AI otevře záložku Připojení s instalací konektoru – pro redaktora zeď a důvod to vzdát (H1, H9, A3 „nabídni alternativu“). Klik „Poslat AI“ bez připojení zadání jen zařadí do fronty (`bridge.js addTask`), zkopíruje ho a vyprázdní pole – bez věty, že čeká na připojení AI (H1, A4 zachovat vstup).

3. **Export pro sítě bez technických pojmů.** Výchozí dialog: název, složka, přepínač formátů (9:16 / 4:5 / 1:1, předvybrané ty, které existují), zaškrtnuto „Titulky vypálit do obrazu“, jedno tlačítko **„Uložit video pro sítě“**. Kodér, „Hlasitost −14 LUFS“, Rozsah, „.srt“ do sbaleného „Podrobnosti“. Hlasitost popsat lidsky: „Hlasitost pro sítě (doporučeno)“. Po dokončení: „Hotovo – 12 MB, 0:24. [Otevřít složku]“.
   *Proč:* „Kodér“, „LUFS“, „samostatné .srt“, „Rozsah“ jsou přesně ty pojmy, které redaktora zastaví (H2, H8); konkurence (VEED, CapCut) má vypálení titulků jako výchozí (A5, A8).

4. **Viditelný stav přepisu a AI tam, kde se uživatel dívá.** V náhledu / kartě v AI panelu: „Přepisuji řeč… 45 % · zbývá asi 1 min“ s možností pokračovat v práci; u AI úkolu kroky „Čtu přepis → Vybírám věty → Stavím verzi“. Log „Průběh“ a „Vytížení počítače“ přesunout do záložky Připojení / Podrobnosti.
   *Proč:* přepis trvá ~1–1,5× délky záznamu; bez jasného stavu redaktor neví, jestli čekat nebo něco udělat (H1, A3 „ne prázdno během načítání“). RAM/CPU měřiče nemají pro redaktora žádnou akci (H8).

5. **Opravit kontrast a velikost klíčových cílů.** Plná primární tlačítka: fialová `#7c3aed` (bílá 5,7 : 1) místo `#8b5cf6` (4,23), modrá `#1f74d0` místo `#2d8ceb` (3,46). Texty prázdných stavů min. `#8e8e8e`. Okraj textového pole zadání ≥ 3 : 1. Tlačítka **„Aa“ (16 px) a „Bezpečné zóny“ (20 px) zvětšit na ≥ 24 px** výšky a dát jim text („Aa Styl titulků“).
   *Proč:* WCAG 1.4.3 / 1.4.11 / 2.5.8 (A9, změřeno v B1, B4); právě tyto dva prvky jsou jádrem práce pro sítě, a jsou nejmenší v aplikaci.

6. **Jeden akcent a jeden slovník.** Akcent aplikace = fialová (pravidlo týmu); modrou Premiere nechat jen pro playhead/timecode/výběr na timeline, ne pro primární tlačítka a menu hover. Sjednotit rohy na 2–3 px (modal 6, toast 5, ikony 4). V CZ režimu nahradit: „Program:“ → „Náhled“, „Zdroj:“ → „Klip“, „sekvence“ → „verze“ (v textech pro redaktora), „Auto Reframe“ → „Převést na formát pro sítě“, popisek v bezpečných zónách „Reels / TikTok / Shorts UI“ → „Sem sahá rozhraní Reels / TikToku / Shorts“ (dnes jen anglicky, `monitors.js`).
   *Proč:* dvě barvy akcentu působí jako dvě aplikace a ředí, co je hlavní akce (H4); premiérovské pojmy nejsou slovník redaktora (H2).

7. **Výsledek AI jako hlavní karta s dalším krokem.** Po dokončení úlohy: karta Výsledek nahoru, automaticky přehrát v náhledu, pod ní tlačítka v pořadí práce **▶ Přehrát · Upravit titulky · Exportovat pro sítě** (primární = Exportovat) + věta „Původní video zůstalo beze změny“. U upoutávky ukázat i délku („0:21“) a co AI vybrala (věty).
   *Proč:* uzavírá smyčku (H1), jasná další akce (A2 jedna hlavní akce), ujištění o vratnosti (H3). Descript/CapCut také vrací výsledek rovnou do náhledu.

8. **Chybové hlášky podle šablony a česky.** Nahradit `✖ + e.message` a toasty typu „No sequence is open.“ šablonou „Co se nepovedlo. Proč. [Tlačítko nápravy]“, technický detail do „Podrobnosti“. Typické: chybějící soubor („Video se přesunulo – [Najít soubor]“), zablokovaný přístup k místní síti (už dobře popsané – vzor), plný disk, nepodporovaný formát („Tohle video neumíme přečíst. Ulož ho jako MP4 (H.264) – [Jak na to]“).
   *Proč:* H9 a A4; redaktor bez vysvětlení nepozná, jestli chyba je jeho, aplikace, nebo videa, a skončí u střihačů.

### Co je dobré a držet
- Okno **Text v obraze**: živý náhled, varování na zakrytou zónu, „Výchozí“, klik na titulek = přepsat.
- **Dlaždice formátu** s obrysem tvaru a jménem sítě; chipy stopáže; rychlé akce (Výrok / Upoutávka / …).
- **Bezpečné zóny** výchozí zapnuté u 9:16; titulky 9:16 ve 30 %.
- AI staví **novou** verzi – původní zůstane.
- Text o soukromí („video zůstává na počítači“) – pro redakci důležitý argument, ponechat viditelně.
