# Redaktorka – kolo S4, závěrečná regrese (2026-11-22/23)

**Otázka:** Projde po všech nočních opravách celý den redaktorky bez zaseknutí a bez nových chyb?
**Odpověď: ano.** Obě zakázky jsem dotáhla do exportu v jednom projektu. Nic se nezaseklo, aplikaci jsem nemusela restartovat (kromě plánovaného „pádu“) a S3 regrese se nevrátily.
Nové jsou jen drobnosti (závažnost 1).

**Instance:** 9371, `--size 1366x768 --lang cs --ai`, profil `%TEMP%\pz-s4-redaktor`, verze z HEAD 5bd438e. AI panel jsem nepoužila.
**Zdroj:** kopie rozhovoru v `%TEMP%\pz-s4-redaktor-media\rozhovor.mp4`. Originál v Downloads jsem neměnila.
**Ovládání:** vlastní `ui.js` ve scratchpadu přes CDP `Input.*` (myš, klávesy, psaní). `test/cdp.js` umí jen eval/shot/key/drag.

**Pomůcky:**
- Import: `TN.app.importPaths`.
- Nativní menu: `TN.app.cmd('headline' | 'reframe916' | 'newSequence')`.
- První uložení: `TN.app.project.path = …; TN.app.cmd('save')`.
- Nativní dialog „Uložit změny v projektu?“ a zavření okna (křížek): Windows UI Automation (`win.ps1`).
  Tlačítko „Neukládat“ (CCCommandLink) nepodporuje Invoke, proto: fokus na tlačítko + mezerník.
- Ctrl+M a Ctrl+Q přes CDP nereagují, protože jsou to nativní akcelerátory. Export jsem proto otevírala tlačítkem „⇪ Export“ v liště.

**Pozn. k průběhu:** první pokus jsem zahodila. Posílala jsem v něm příkazy, které `cdp.js` nezná, takže se nic neprovedlo. Všechno níže je z druhého, ověřeného běhu.

**Výstupy** v `web/test-out/`:
- `redaktorka-s4-socky-9x16.mp4` (+ `.srt`): 1080×1920 25p, 36,04 s, −14,0 LUFS, export 7 s
- `redaktorka-s4-tv-16x9.mp4`: 1920×1080 25p, 59,72 s, −23,0 LUFS, export 5 s
- `redaktorka-s4-tv-16x9.mxf`: XDCAM mpeg2 1080 25p, 2× PCM 24 bit, obě stopy −23,0 LUFS, export 5 s

## 3 nejdůležitější nálezy

1. **✅ Den proběhl celý a opravy S3 drží.**
   - Autosave zapisuje jen do zálohy. Záloha `autosave.tnproj` se uložila 13 s po změně, `.pzcut` zůstal z 00:02:00.
   - Po pádu (`standalone.js stop`, >60 s po změně) se při startu obnovila značka i změněný nadpis jako **neuložené** (`den-redaktorky.pzcut *`). Objevila se česká hláška „Obnoveny neuložené změny z automatické zálohy. Uložíš je Ctrl+S, nebo je zahodíš zavřením bez uložení.“ (14).
   - Zavření křížkem otevře nativní „Uložit změny v projektu?“. Po „Neukládat“ zmizí záloha a další start otevře uložený stav, nic se neobnoví (16).
   - G nabízí „Změnit zesílení o“ (vždy 0) i „Nastavit na“ (aktuální hodnota). Funguje desetinná čárka „2,5“ a Ctrl+Z / Ctrl+Shift+Z po krocích (19).
   - Timecode v Zdroji, Programu i na časové ose: Enter vrátí fokus (BODY), takže hned funguje I/O/C/Q/W. Zkratky „5“ a „3604“ fungují.
   - Q/W, C (řez V+A přesně na hlavě), Shift+Delete i vložení čárkou se chovají jako v Premiere.
   - Titulky po Auto Reframe nejsou kratší než 0,92 s (S3 #3 opraveno).

2. **⚠ Offline médium se ohlásí, ale až pozdě** (1).
   - Po startu se sám otevřel poslední projekt, **bez dialogu** „Chybějící média“.
   - Projekt, klipy a monitor Zdroje ukazují červené „Médium offline“, panel Přepis „Soubor klipu chybí“ (23, 24).
   - Monitor Programu je ale **černý, dokud nepohnu hlavou** (23 vs. 23-offline-program).
   - Dialog Export předem nic neukazuje (25). Varování přijde až po „Exportovat“: „✕ Médium offline: rozhovor.mp4 – soubor byl přesunut nebo přejmenován…“. Soubor nevznikl a nezůstal žádný ffmpeg (26).
   - STANDALONE.md slibuje „export to ohlásí předem“. Hlášení je jasné, ale přijde až po kliknutí.

3. **⚠ Ruční žiletka v časové ose nehlídá slovo, Zdroj ano** (1–2).
   - Hranice v TV verzi jsem brala z RMS (−47 dB „díra“ ve 227,40 s) a řízla C na časové ose. Whisper exportu ukázal, že řez padl **doprostřed „stážistů“** (227,24–227,58) a „na televizi Nova“ chybělo.
   - Aplikace na časové ose nic neukázala. Monitor Zdroje přitom při In/Out uprostřed věty ukazuje „⚠ Uprostřed věty · Přichytit“ (22).
   - Opravila jsem to jako v Premiere: In 00:03:47:10 / Out 00:03:48:10 ve Zdroji, hlava na střih a čárka (vložilo se 1,04 s, zbytek se posunul, zesílení klipů zůstalo).
   - Po opravě Whisper: „…stážistů na televizi Nova. | Prostě nikomu…“ a „…na novou. | Já jsem se…“, nic useknuté.
   - Návrh: stejné upozornění pro řez C/Ctrl+K uprostřed slova podle přepisu.

## Tabulka
| # | Krok | Výsledek | Záv. | Důkaz |
|---|---|---|---|---|
| 1 | Import kopie (pomůcka) | Přepis se sám načetl z cache Workeru: 424 vět, „Přepis hotový“ | ok | 01 |
| 2 | Přepis: hledání „nešťastná“ + Enter | 1/1, zvýrazněno, seznam odscrollovaný na nález | ok | 02 |
| 3 | Klik na větu 16:38, Shift+klik na 17:12 | „7 vět · 0:36“, Zdroj In/Out 00:00:36:01 | ok | 03 |
| 4 | Vložit do nové sekvence | Dialog předvyplní 1280×720 podle klipu. Sekvence „Výpověď Šimková“ s jedním klipem 998,50–1034,54 s. Začátek i konec v pauze (−45 / −56 dB) | ok | 04, 05 |
| 5 | Titulky z přepisu… → Vytvořit | 12 titulků (2 řádky / 40 zn.), nejkratší 1,63 s. Text sedí na řeč (Whisper: „já“ 1,16 s, titulek 1,155 s) | ok | 06, 07 |
| 6 | Oprava ASR: klik do titulku, Ctrl+A, přepsat, Enter | „Kamelem/Kamele“ → „Kamilem/Kamile“. Enter skočí na další titulek, oprava se propíše i do 9:16. „řekl jsem zpravdující“ jsem nechala, je to nejspíš chyba ASR (asi „ředitelem zpravodajství“), bez poslechu ji neopravuji | ok | 07 |
| 7 | Titulek „Proč mě otrháváš / od někoho, kde mě“ + „to baví…“ | Hranice titulků padne uprostřed fráze („kde mě \| to baví“) | 1 | 07 |
| 8 | T na časové ose | Nic. Nadpis jde jen přes menu (Premiere T = Type tool). Nadpis přes `cmd('headline')` → panel Text v obraze → nadpis nahoře | ok | 09, 10 |
| 9 | Home/End s fokusem v seznamu titulků | Skáče na první/poslední titulek (0,04 / 34,4), ne na začátek/konec sekvence. Po kliku do časové osy 0 / 36,04 | 1 | – |
| 10 | Auto Reframe 9:16 | Nová sekvence 1080×1920 za ~2 s. 3 výřezy (střih kamery na moderátorku 13,2–17,8 s). Titulky přelomené na 20 zn., 21 ks, min 0,92 s. Nadpis i oprava zůstaly | ok | 11, 13 |
| 11 | ⇪ Export (9:16) | Sám zvolí H.264, −14 LUFS, vypálit + .srt, cesta do Videos. Export 7 s, −14,0 LUFS, žádné černé snímky, scény jen 13,2 a 17,76 (skutečné střihy kamer) | ok | 13 |
| 12 | Uložení (pomůcka), značka M + změna nadpisu | `dirty=true`, záloha za 13 s, `.pzcut` beze změny | ok | – |
| 13 | Pád po >60 s, start se stejným profilem | Obnoveno jako neuložené + hláška | ok | 14 |
| 14 | Ctrl+Q přes CDP | Nic (nativní akcelerátor, CDP ho nespustí). Zavření jsem udělala křížkem přes UIA | – | 15 |
| 15 | Křížek → „Uložit změny v projektu?“ → Neukládat | Proces skončil, záloha smazána | ok | – |
| 16 | Další start | Otevřel se uložený projekt, nadpis původní, 0 značek, bez obnovy | ok | 16 |
| 17 | Nová sekvence „TV verze 60s“ | Předvolba = poslední (1280×720). Šipkou nahoru na Full HD 1920×1080 25p | ok | 17 |
| 18 | Zdroj: timecode 00034113 + I, 00042205 + O, čárka; druhý úsek 00043606 / 00045818 | 2 klipy, 63,24 s, hlava na konci vloženého | ok | 18 |
| 19 | Timecode osy 00000522, C, klik; 00000922, klik; V | Řezy V+A přesně 227,40 a 231,40 | ok | – |
| 20 | Klik na prostřední klip, Shift+Delete | Ripple, 59,24 s | ok | – |
| 21 | Timecode „5“, Q | Začátek o 0,2 s pryč, hlava na 0, monitor i osa 00:00:00:00 | ok | – |
| 22 | Timecode v Programu „3604“, W | Konec 2. klipu 261,88, délka 00:00:58:17 | ok | – |
| 23 | G (Nastavit −3), G (Změnit o 2,5), G (−1), Ctrl+Z, Ctrl+Shift+Z | 0 / −3 / +1,5, štítek „-3 dB“ na klipu, „Není co zopakovat“ na konci | ok | 19, 20 |
| 24 | Export MP4 TV (hlasitost na −23 šipkou) | 5 s, −23,0 LUFS. Cesta si pamatuje složku test-out (S2/S3 ok) | ok | 21 |
| 25 | Export MXF (formát šipkou) | Přípona se sama změní na .mxf, hlasitost zůstane TV, 4–5 s. Existující soubor přepíše bez dotazu | 1 | – |
| 26 | Whisper slov na střizích TV | Useknuté „stážistů“ (moje chyba, viz nález 3) → oprava vložením a nový export | 1–2 | 22 |
| 27 | Ctrl+S přes CDP | Projekt hned `dirty=false` (v S3 přes CDP nešlo). Pro jistotu jsem ještě zavolala `cmd('save')` | ok | – |
| 28 | Přejmenovat kopii, start | Viz nález 2 | 1 | 23–26 |
| 29 | Konec `standalone.js stop 9371`, kopie zdroje přejmenovaná zpět | – | – | – |

**Okrajově:**
- Stav mostu AI vpravo nahoře se během testu měnil („most neběží (AI panel)“ → „Claude připojen“, bridge 7880/7890). Je sdílený s ostatními instancemi, AI jsem nepoužila.
- Náhled klipu na časové ose je pořád snímek 0 zdroje (logo TALK), známé z S2/S3.

**Časy** (kroky posílal skript, čas není lidský):
- Zakázka A od importu po hotové MP4 9:16 ≈ 7 min, včetně zkoumání DOM.
- Zakázka B ≈ 10 min, včetně kontroly Whisperem a opravy.
- Kódování všech exportů 5–7 s.

## Verdikt
**Ano, celý den redaktorky projde bez zaseknutí.** Obě zakázky (výpověď 9:16 z přepisu s titulky, nadpisem a Auto Reframe, i ruční TV verze zkratkami s MP4 a MXF) jsou hotové. Hlasitost sedí (−14 / −23 LUFS) a nikde nejsou černé snímky.

Bezpečnost práce z S3 je opravená:
- záloha nepřepisuje projekt,
- po pádu se změny obnoví jako neuložené,
- „Neukládat“ je opravdu zahodí,
- offline médium je vidět a export se zastaví.

Zbývají drobnosti: varovat před offline médiem už v dialogu Export a při otevření projektu, ukázat offline i v Programu hned po startu a hlídat řez žiletkou uprostřed slova podle přepisu.
