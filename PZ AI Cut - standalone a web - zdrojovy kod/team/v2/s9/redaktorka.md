# Redaktorka – kolo S9 (závěrečná regrese před vydáním, 2026-11-23)

**Otázka:** Udělám v tom za 10 minut výrok na sítě (16:9 i 9:16), aniž bych se zasekla?

**Verdikt: Ne bez výhrad.**
- Výrok 16:9 i 9:16 jsem dotáhla do MP4 za 17 min (03:37:50 → 03:54:33), bez pádu aplikace.
- Hlavní novinka S9 funguje: výřez podle obličeje u přetaženého širokého záběru a jedno Ctrl+Z, které vrátí vložení i výřez.
- **Ale po vložení ze Zdroje přes I/O se v běžných případech rozpojí obraz a zvuk** (nález 1). Žiletka, ořez kraje i Shift+Delete pak zasáhnou jen obraz a hláška radí špatně.
- **MXF může vyjít s −14 LUFS** (nález 3). Je to zrcadlo nálezu 3 z S8.
- **Přepis, Vložit z Přepisu a titulky jsem neověřila.** Instance bez `--ai` nemá klíč Workeru: „Worker přepisu odmítl přístupový klíč“ (02). Restart s `--ai` mi oprávnění nepovolilo. Výrok jsem proto stříhala ve Zdroji podle časového kódu (I/O). Hranice slov jsem měřila vlastním Whisperem.

**Prostředí:**
- Instance 9371, `--size 1366x768 --lang cs`, bez `--ai`, čistý profil `%TEMP%\pz-s9-redaktorka`, HEAD e5942e6.
- AI panel jsem hned zavřela a nepoužila.
- Ovládání přes CDP `Input.*`: klik, klávesy, tažení. Přetahování z monitoru Zdroj na časovou osu je skutečný HTML drag&drop (`Input.setInterceptDrags` + `dispatchDragEvent`).
- Pomůcky místo nativních prvků:
  - import přes `TN.app.importPaths`,
  - Uložit přes `TN.app.cmd('save')`, cestu projektu jsem nastavila v `eval`,
  - export přes dialog ⇪ Export, cestu jsem vepsala do pole.

## 3 nejdůležitější nálezy

1. **Rozpojený obraz a zvuk po automatickém úklidu krajů nebo výřezu podle obličeje (záv. 3).**
   - **Kroky:** Zdroj I 00:02:31:03 / O 00:03:05:02. Konec leží 4 snímky za střihem kamery 184,96. Pak:
     - (a) Nová sekvence 1920×1080 se zaškrtnutým „Vložit do ní vybraný klip“, nebo
     - (b) přetažení ze Zdroje na prázdnou časovou osu.
   - **Výsledek:** obraz dostane zopakované snímky na konci (správně, bez probliknutí), ale V1 i A1 mají `linkId: null`. Kontrola bez úklidu (I/O 160–180 s): klipy propojené.
   - V 9:16 je to stejné u každého klipu, který výřez rozdělí na střihu kamery (34,00 a 39,24 = „nelink“).
   - **Důsledky** (propojený výběr zapnutý):
     - Klik na klip vybere jen obraz.
     - **Žiletka (C) rozřízne jen V1**, A1 zůstane vcelku (09).
     - **Shift+Delete** smaže jen obraz. Zůstane černá díra 11,5 s se zvukem a hláška „Mezera zůstala: přes ni leží jiný klip (b-roll, hudba)…“. Žádný b-roll ani hudba tam není (10). Totéž platí v 9:16 pro klip 34,00.
     - **Ořez kraje** (tažení konce) zkrátí jen obraz: V1 končí 18,24, A1 19,32 (11).
   - Teprve když jsem žiletkou ručně rozřízla i A1 a vybrala oba kusy, Shift+Delete mezeru zavřel (12).
   - V kódu je to záměr: `web/ai/reframe.js` ř. 234–256, „rozříznutý jen obraz – zvuk zůstává v celku“. Pro uživatelku ale výsledek vypadá jako rozbitý střih.
   - Regresi proti S8 jsem neověřila. V S8 jsem vkládala z Přepisu a tam se úklid krajů nespouští.
2. **9:16: krátký zbytek širokého záběru na konci klipu má špatný výřez (záv. 3).**
   - **Kroky:**
     1. Prázdná sekvence 1080×1920 z dialogu.
     2. Zdroj I/O 151,12–185,12 (detail mluvčí, posledních 0,16 s už je celek), „,“.
   - **Výsledek:** výřez posX 0,345 platí pro celý klip. Na rozdíl od 16:9 se nerozdělí a zbytek se neuklidí.
   - **V exportu** `redaktorka-s9-2-vyrok-916.mp4` jsou snímky 33,84–33,96 celek oříznutý na stůl a nohy, obličej není vidět (06; scdet střih v 33,84 a 34,00).
   - Pak následuje navazující celek s výřezem na mluvčí (posX 0,744). Divák uvidí 4snímkové „cuknutí“.
   - V kódu `autoFace` u svislé sekvence volá jen `__pzReframeHere`, bez `__pzEdgeShots`.
3. **Dialog Export předvybere MXF (TV) s hlasitostí −14 LUFS (záv. 2, zrcadlo S8 #3).**
   - **Kroky:**
     1. Export MXF sekvence „Test propojeni B“ (dialog správně přepne na −23).
     2. Otevřít a zavřít export MP4 jiné sekvence (H.264, −14).
     3. Otevřít export sekvence 1920×1080, která se ještě neexportovala.
   - **Výsledek:** předvolený formát „MXF OP1a – XDCAM HD422 (TV)“, hlasitost „Normalizovat na −14 LUFS (sociální sítě)“ (13).
   - Export `redaktorka-s9-3-mxf-predvolba.mxf` má −14,0 LUFS. Pro srovnání `redaktorka-s9-3-mxf-test.mxf` má −23,6.
   - Do vysílání by šlo o 9 LU hlasitější MXF.
   - Oprava S8 #3 (MP4 po MXF už nedostane −23) platí: 14.

## Tabulka nálezů

| # | Nález | Důkaz | Záv. |
|---|---|---|---|
| 1 | Úklid krajů / výřez rozpojí V a A → žiletka, ořez a Shift+Delete jen obraz, mylná hláška o b-rollu | 09, 10, 11, 12; `linkId` v uloženém `Redaktorka S9.pzcut` | 3 |
| 2 | 9:16 vložení do prázdné sekvence: 4 snímky celku s výřezem na stůl na konci klipu | 05, 06, export 33,84–33,96 s | 3 |
| 3 | Export: MXF předvybrané s −14 LUFS | 13, ebur128 −14,0 LUFS | 2 |
| 4 | Po neúspěšném přepisu toast „Titulky nevznikly – přepis je zastavený.“: přepis nebyl zastavený, selhal (klíč). Stavový řádek radí „restartuj PZ AI Cut“ | 02, text toastu | 1 |
| 5 | Ctrl+S přes CDP nic neudělá (nativní akcelerátor). Uložení přes Soubor → Uložit funguje: 7445 B, titulek „Redaktorka S9.pzcut“ | eval | neověřeno |

## Co funguje (ověřeno)
- **Přetažení ze Zdroje na prázdnou osu** založí sekvenci podle klipu (1280×720 25p).
- **16:9 konec na střihu kamery** = zopakované snímky. V exportu je posledních 15 snímků detail, bez probliknutí (08), a scdet nenašel žádný střih.
- **Export 16:9** `redaktorka-s9-1-vyrok-169.mp4`:
  - H.264 1280×720 25p, 34,00 s, −14,0 LUFS, za 3 s;
  - začátek „To byl někdo…“ je v pauze (−40 dB v prvních 80 ms);
  - konec „…byl pryč.“ celý (Whisper konec 33,98).
- **S9 výřez podle obličeje** při přetažení celku 185,12–191,20 do prázdné 9:16 i na konec neprázdné 9:16:
  - posX 0,744 (mluvčí vpravo, ne střed), na střihu kamery 190,36 rozdělené (posX 0,374);
  - první klip si výřez nechal (jen vložené klipy, správně) (04, 07).
- **Jedno Ctrl+Z vrátí vložení i výřez** (prázdná i neprázdná sekvence, přetažení i „,“):
  - stav se strojově shoduje s výchozím;
  - Ctrl+Y vrátí klipy i posX.
- **Export 9:16** `redaktorka-s9-2-vyrok-916.mp4`:
  - 1080×1920, 40,08 s, −14,0 LUFS, výchozí hlasitost −14 správně;
  - spoj 34,00 „pryč. | A já jsem…“ plynulý, konec „…životě.“ celý.
- **Zpět/Znovu** po žiletce, Shift+Delete a ořezu: 3× Ctrl+Z a 3× Ctrl+Y dají přesně původní stavy (porovnáno strojově).
- **Uložený projekt** obsahuje posX i úpravy.

## Neověřeno
- panel Přepis, výběr vět, Vložit z Přepisu;
- titulky z přepisu (16:9 i jednořádkové 9:16) a varování před řezem uprostřed slova. Varování podle všeho potřebuje přepis: žiletka uprostřed „svolával“ (5,84 s) nic nehlásila;
- nativní dialogy Import/Uložit/Export (tlačítko „…“), Ctrl+S jako klávesa;
- poslech sluchem (jen Whisper a RMS).
