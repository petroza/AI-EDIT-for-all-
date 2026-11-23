# Redaktorka – kolo S10 (ověření oprav S9 před ranním vydáním, 2026-11-23)

**Otázka:** Udělám v tom za 10 minut výrok na sítě (16:9 i 9:16), aniž bych se zasekla?

**Verdikt: Opravy S9 platí, ale k vydání ne bez jedné opravy.**
- Obraz a zvuk po výřezu i úklidu krajů zůstávají propojené. Funguje žiletka, Shift+Delete, ořez i Extract.
- Konec 9:16 už neukazuje celek oříznutý na stůl.
- MXF je předvybrané s −23 LUFS.
- Přepis, Vložit z Přepisu a titulky fungují v 16:9 i 9:16.
- **Novinka:** zopakované snímky konce (klip `rep`, 0,16 s, bez propojení) zůstanou ležet, když smažu nebo zkrátím klip před nimi.
  - Výsledkem je černá díra a 4snímkové bliknutí v exportu, k tomu znovu mylná hláška o b-rollu (nález 1).
  - Stačí běžný krok: smazat poslední nebo první větu.

**Prostředí:**
- Instance 9371, `--size 1366x768 --lang cs --ai`, čistý profil `%TEMP%\pz-s10-redaktorka`, HEAD b47efd0, 04:03–04:18.
- AI panel jsem hned zavřela. Claude, Codex ani Hermes jsem nespustila.
- Ovládání přes CDP `Input.*`: klik, klávesy, tažení. Zdroj → osa je skutečný HTML drag&drop.
- Pomůcky místo nativních prvků:
  - import přes `TN.app.importPaths`;
  - Nová sekvence a Titulky z přepisu přes `TN.app.cmd(...)`, protože nabídky okna jsou nativní;
  - formát v dialogu Export jsem přepnula nastavením `select` + `change`;
  - cestu exportu jsem vepsala do pole dialogu, export spustilo tlačítko Exportovat.

## 3 nejdůležitější nálezy

1. **Zopakované snímky konce („rep“) osiří po smazání nebo zkrácení klipu před nimi (záv. 3, nové po S9).**
   - **Příčina:** úklid konce vytvoří za klipem samostatný 4snímkový obrazový klip `rep` bez `linkId`. Zvuk pod ním patří k hlavnímu klipu.
   - **16:9.** Zdroj I/O 151,12–185,12, Nová sekvence 1920×1080 s „Vložit do ní…“. Žiletka 20,04, pak Shift+Delete posledního kusu.
     - Kus zmizí, ale `rep` zůstane na 23,88. Mezera 10,08–23,88 se nezavře.
     - Objeví se hláška „Mezera zůstala: přes ni leží jiný klip (b-roll, hudba)…“ (04). Žádný b-roll ani hudba v sekvenci nejsou.
   - **Totéž po přetažení na prázdnou osu** (sekvence vyrez-5min). Žiletka 17, Shift+Delete konce, export `redaktorka-s10-1-169-konec-smazany.mp4`:
     - délka 34,00 s, **blackdetect 17,00–33,84 s černá**, pak 4 snímky obličeje (19);
     - sekvence se nezkrátila.
   - **9:16 („Vertikal 916“).** Shift+Delete prvního klipu 0–33,84 nechá na začátku 33,84 s černé, `rep` na 33,84 a stejnou hlášku (09).
   - **Ořez konce tažením** zkrátí V1 i A1 (oprava S9 platí), ale `rep` zůstane na původním místě. Vznikne díra a bliknutí na konci (05).
   - **W (zkrátit do dalšího střihu)** na 30 s před koncem klipu (9:16):
     - `rep` se posune na 30,00–30,16 a pod ním zůstane 4snímkový kus zvuku 184,96–185,12 (konec „pryč“);
     - na střihu tedy skočí obraz o 3,7 s dopředu a ozve se úlomek slova (18).
   - Všechno vrátí Ctrl+Z. Uživatelka ale `rep` na ose skoro nevidí, je to proužek široký 3 px.
2. **Opravy S9 #1–#3 ověřeny.** Podrobnosti v tabulce Stav nálezů S9.
3. **Přepis ve standalone poprvé ověřen redaktorkou:**
   - přepis se po importu načetl z mezipaměti (67 vět);
   - výběr vět, Shift+klik, „Přidat na konec sekvence“ do 16:9 i 9:16;
   - titulky z přepisu, vypálené v exportu;
   - varování „Střih je uprostřed slova „pohromadě““ u žiletky.
   - Výsledek viz „Co funguje“.

## Tabulka nálezů S10

| # | Nález | Důkaz | Záv. |
|---|---|---|---|
| 1 | Klip `rep` (zopakované snímky konce) není svázaný s klipem před sebou. Shift+Delete / Delete / ořez / W ho nechají ležet: černá díra (v exportu 16,84 s), bliknutí 4 snímků, úlomek zvuku po W, mylná hláška o b-rollu | 04, 05, 09, 18, 19; export `redaktorka-s10-1-169-konec-smazany.mp4` blackdetect 17–33,84 | 3 |
| 2 | Vložení z Přepisu do 9:16 vybere jen první kus (V+A). Další kusy rozdělené výřezem zůstanou nevybrané, takže Delete hned po vložení smaže jen část | dump po vložení: `*SEL` jen u 0–6,16 | 1 |
| 3 | Export 16:9 MP4 má v čistém profilu hlasitost „Vypnuto“: výrok pro sítě 16:9 vyšel na −26,6 LUFS. Podle kódu záměr (na šířku = ponechat úrovně), ale redaktorka sítí to snadno přehlédne | `redaktorka-s10-4-prepis-169.mp4` ebur128 −26,6 LUFS | 1 |
| 4 | Dialog Nová sekvence: po ručním přepsání velikosti na 1920×1080 zůstane v poli Předvolba „1280×720 (HD 16:9)“ (sekvence se ale vytvoří správně 1920×1080) | snímek dialogu (scratch), dump „Test A 169 1920x1080“ | 1 |
| 5 | Začátek výběru „My jsme byly kamarádky.“ leží v řeči (prvních 80 ms −19 dB) | aplikace sama varuje „⚠ Začátek v souvislé řeči“ (12). Whisper slyší „My“ celé, sluchem neověřeno | info |

## Stav nálezů S9

| S9 # | Stav | Důkaz |
|---|---|---|
| 1 Rozpojený V/A po úklidu krajů a výřezu | **Opraveno** – viz výčet pod tabulkou. Zbývá nový nález 1 (`rep`) | 03, 08 |
| 2 9:16 konec = celek oříznutý na stůl | **Opraveno** – 9:16 prázdná sekvence, Zdroj I/O 151,12–185,12, „,“: konec je `rep` 184,80–184,96 s výřezem na detail | 06, 07 |
| 3 MXF předvybrané s −14 LUFS | **Opraveno** – viz výčet pod tabulkou | 10, 11 |
| 4 Toast „přepis je zastavený“ po selhání | Neověřeno – s `--ai` přepis neselhal | – |
| 5 Ctrl+S přes CDP | Neověřeno (nativní akcelerátor), Uložit jsem nezkoušela | – |

Podrobnosti k S9 #1 (propojený V/A):
- 16:9 přes dialog i přetažení na prázdnou osu: hlavní klip V1+A1 má společné `linkId`, klik vybere oba.
- Ctrl+K s výběrem i bez výběru, nástroj C, Shift+Delete prostředního kusu a ořez konce tažením působí na V i A.
- 9:16: přetažený celek 185,12–191,20 je rozdělený na střihu 190,36. Každý kus obrazu má svůj zvuk (`ywiv`, `lw0w`).
- Žiletka i Shift+Delete v 9:16 působí na oba.

Podrobnosti k S9 #2 (konec 9:16), export `redaktorka-s10-2-916.mp4`:
- 1080×1920, 34,00 s, −14,0 LUFS;
- posledních 10 snímků 33,60–34,00 = detail mluvčí;
- scdet nenašel žádný střih.

Podrobnosti k S9 #3 (MXF), postup jako v S9:
1. MXF „Test A 169“ → −22,9 LUFS.
2. Otevřít a zavřít MP4 dialog „vyrez-5min“.
3. Nová sekvence „Test C 1080“: export předvybral MXF + „−23 LUFS (TV)“; `redaktorka-s10-3-mxf-predvolba.mxf` = −22,6 LUFS.
4. Přepnutí na H.264 vrátilo hlasitost, kterou měl dialog pro MP4 (Vypnuto).

## Co funguje (ověřeno)
- **Přepis z mezipaměti Workeru** hned po importu (02): panel Přepis, 67 vět, hledání.
- **Vložit z Přepisu do 9:16**, věty 39–43:
  - 3 propojené dvojice rozdělené na střizích kamery 184,945 a 190,345;
  - export `redaktorka-s10-4-prepis-916.mp4`: střihy obrazu přesně 6,16 a 11,56 (scdet), žádný snímek se špatným výřezem (14, 15);
  - konec „…v mým životě.“ celý (Whisper konec 12,38 z 12,40), bez úlomku další věty; −14,0 LUFS.
- **Vložit z Přepisu do 16:9** (věty 33–34) + titulky z přepisu (4 titulky, 2 řádky, zvýrazněné slovo). Export 1920×1080 s vypálenými titulky (16).
- **Titulky 9:16 z přepisu:** 6 titulků, dialog nabízí „2 řádky, 30 % od spodu“; v exportu jsou vidět (13, 14).
- **Varování před řezem uprostřed slova** u Ctrl+K (17).
- **Shift+Delete s titulky:** titulky se posunou a rozdělí podle slov.
- **Extract (I/O + apostrof)** v 9:16 působí na V, A i titulky.
- **Kopírovat/Vložit** propojené dvojice zachová propojení (nové `linkId`) i posX.
- **Zpět/Znovu** (strojové porovnání stavu stop a titulků):
  - Ctrl+Z / Ctrl+Y po žiletce, Shift+Delete, Extract a vložení;
  - jedno Ctrl+Z vrátí vložení z Přepisu do 9:16 i s výřezem;
  - 2× Ctrl+Z a 2× Ctrl+Y dají přesně původní stavy.
  - Ctrl+Z v jiné kartě vrátí poslední krok projektu a přepne na jeho sekvenci (globální historie jako v Premiere).

## Neověřeno
- poslech sluchem (jen Whisper a RMS);
- nativní dialogy Import / Uložit / Procházet, Ctrl+S, nabídky okna (spouštěno přes `cmd`);
- S9 #4 (toast po selhaném přepisu);
- AI panel (podle zadání nespouštěn).

Exporty: `APP\web\test-out\redaktorka-s10-*` (1-169-konec-smazany, 2-916, 3-mxf-A, 3-mxf-predvolba, 4-prepis-916, 4-prepis-169). Snímky: `s10\shots-redaktorka\01–19`.
