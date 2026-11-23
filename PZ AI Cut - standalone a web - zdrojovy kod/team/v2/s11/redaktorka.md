# Redaktorka – kolo S11 (3 zakázky od importu po export, 2026-11-23)

**Otázka:** Udělám v tom zpravodajské zakázky (výrok pro sítě 16:9 + 9:16, sestřih s b-rollem, rychlou TV verzi), aniž bych se zasekla?

**Verdikt: Všechny tři zakázky jsem dokončila (výrok asi za 11 min, sestřih 6 min, TV verze 2 min). Nic jsem neobcházela. Výsledek ale není pro diváka bezchybný.**
- **9:16 z Auto Reframe** má na každém střihu kamery jeden snímek se špatným výřezem (nález 1).
- **Výrok z Přepisu** začíná cizím slovem moderátorky („…zlomilo?“). Vadné jsou všechny tři výstupy (nález 2).
- **Nově ověřeno, že funguje:**
  - nadpis Zobrazit vyp/zap (náhled i export);
  - oprava S10 #1 (zopakovaný konec);
  - ruční střih s b-rollem a Zpět/Znovu;
  - MXF XDCAM s .srt.

**Prostředí:**
- Instance 9371, `--size 1366x768 --lang cs --ai`, čistý profil `%TEMP%\pz-s11-redaktorka`, 10:46–11:14.
- Kód při startu = HEAD 72430ec. Commity d510598 (11:04) a c0b1c27 (11:07) přišly během testu a **neprověřovala jsem je**.
- AI panel jsem hned zavřela. Claude, Codex ani Hermes jsem nespustila.
- **Ovládání přes CDP `Input.*`:** klik, Shift+klik, klávesy (Ctrl+K, Shift+Delete, Q, W, B, `.`, `\`, `=`, Ctrl+Z/Y), tažení, psaní do polí.
- **Pomůcky místo nativních prvků:**
  - import přes `TN.app.importPaths`;
  - Auto Reframe 9:16 a Nová sekvence (Ctrl+N) přes `TN.app.cmd('reframe916' | 'newSequence')`, protože nabídky okna jsou nativní;
  - rozbalovací pole (formát, hlasitost, předvolba sekvence) nastavena přes `value` + `change`;
  - řádky Přepisu posunuté do zorného pole přes `scrollIntoView`, kliky na ně byly skutečné;
  - u jedné opravy titulku jsem kurzor umístila přes `setSelectionRange`.
- Exporty jsem spouštěla tlačítkem Exportovat v dialogu, cestu jsem vepsala do pole.

## 3 nejdůležitější nálezy

1. **9:16 (Auto Reframe z menu): v exportu jeden snímek se špatným výřezem na každém střihu kamery (záv. 3).**
   - Výrok 16:9 (zdroj 96,69–128,61) → `reframe916` → 4 propojené dvojice V/A, střihy na 7,6 / 10,6 / 30,2 s.
   - Export `redaktorka-s11-1-916.mp4`: scdet hlásí střihy na 7,56 / 10,56 / 30,16 (+30,2), tedy o snímek dřív než střihy klipů.
   - Na snímcích n=189, 264 a 754 už je nový záběr kamery, ale ještě s výřezem předchozího klipu:
     - stůl s polovinou postavy;
     - prázdná fialová stěna;
     - stůl a půlka Báry (08).
   - Náhled v Programu na 00:00:10:14 ukazuje správně předchozí záběr (09). **Export se tedy od náhledu liší o 1 snímek.**
   - Pravděpodobná příčina (v kódu neověřená): začátek klipu z Přepisu 96,69 s neleží na hranici snímku (2417,25. snímek). Export bere obraz o snímek posunutý proti náhledu. V S10 byl začátek 151,12 s, tedy přesně na snímek, a vada se tam neobjevila.
2. **Výrok vložený z Přepisu začíná koncem otázky moderátorky „(jako) zlomilo?“ (záv. 3).**
   - Kroky: věty 22–27 (klik + Shift+klik) → Vložit do nové sekvence.
   - Klip začíná 96,69 s. Whisper ve zdroji slyší moderátorčino „zlomilo?“ na 96,68–97,12 a odpověď „Jo,“ až od 97,20.
   - Export 16:9 (0–3 s) Whisper přepíše jako „jako[0,00–0,08] zlomilo?[0,08–0,38] Jo,[0,50–0,70] vím přesně…“. RMS je od 0,04 s na −20 dB.
   - Totéž platí pro 9:16 i MXF, protože mají stejný začátek.
   - Aplikace sice ukáže „⚠ Začátek v souvislé řeči – poslechni, jestli není useknuté první slovo.“, ale nic nenabídne. Panel Zdroj má „Přichytit na začátek věty“, Přepis ne.
   - Redaktorka spěchající s výrokem vloží a pošle cizí hlas na začátku.
3. **Panel Přepis se tiše přepne na přepis souboru, který je zrovna ve Zdroji (záv. 2).**
   - Kroky: otevřu b-roll `vyrez-5min.mp4` ve Zdroji kvůli In/Out a přepnu na Přepis.
   - Panel ukazuje 67 vět b-rollu místo 409 vět rozhovoru. Název souboru je jen v tooltipu, změnu prozrazuje jen počet vět v poli Hledat.
   - Můj Shift+klik „věty 22–27“ vybral úplně jiný text (6 vět · 0:19 místo 0:32) (13). Zachránilo mě až dvojité kliknutí na rozhovor v Projektu.

## Tabulka nálezů S11

| # | Nález | Důkaz | Kroky | Záv. |
|---|---|---|---|---|
| 1 | Export 9:16 po Auto Reframe: 1 snímek nového záběru s výřezem předchozího klipu na každém střihu kamery (3× za 32 s); náhled je v pořádku | `redaktorka-s11-1-916.mp4` scdet 7,56/10,56/30,16; snímky 07, 08 (n=189, 264, 754); náhled 09 | Věty 22–27 → nová sekvence 1280×720 → Auto Reframe 9:16 → export MP4 | 3 |
| 2 | Výrok z Přepisu začíná moderátorčiným „…zlomilo?“ (0–0,38 s). Varování je, nabídka posunu začátku chybí | Whisper zdroj 96,68–97,12 / export 0,08–0,38; všechny 3 výstupy zakázky 1 | Přepis → věty 22–27 → Vložit do nové sekvence → export | 3 |
| 3 | Přepis ukazuje přepis souboru ve Zdroji bez viditelného názvu souboru → výběr vět z jiného videa | 13; „Hledat v 67 větách“ vs. 409; výběr „6 vět · 0:19“ | Otevřít b-roll ve Zdroji → záložka Přepis → vybrat věty | 2 |
| 4 | MXF XDCAM ze sekvence 1280×720 25p: formát jde vybrat, export skončí chybou „…použij MXF DNxHR HQ nebo H.264“. Chybí rada, jak dostat XDCAM: vytvořit sekvenci 1920×1080. Musela jsem znovu vložit výrok a znovu udělat titulky | 12 | Výrok 16:9 (zdroj 720p) → Export → MXF XDCAM → Exportovat | 2 |
| 5 | Zdroj varuje „⚠ Začátek je uprostřed věty“ i u b-rollu, který jde na V2 bez zvuku (patch A1 vypnutý). Zbytečně to straší | 16 | B-roll ve Zdroji, In 00:00:42:05 | 1 |
| 6 | Výchozí tlačítko Přepisu nad hotovou 9:16 sekvencí je „Vložit na hlavu · 0:10“, tedy vložení doprostřed hotového výroku. Nová sekvence je až v ▾ | text tlačítka v dumpu, snímek scratch | Hotový výrok 9:16 otevřený → vybrat jiné věty v Přepisu | 1 |
| 7 | Oprava textu titulku (Enter) zahodí časy slov (`ws`) u opraveného titulku. Dopad na „Zvýrazňovat vyslovované slovo“ jsem neověřila (zvýraznění jsem neměla zapnuté) | dump: titulek 4 před `ws:[…]`, po opravě bez `ws` | Titulky → klik do titulku → oprava → Enter | 1 |
| 8 | (trvá S10 #5, info) Začátek „My jsme byly kamarádky.“: řez 1258,785 leží ve 40ms poklesu (−42 dB) těsně před „my“. Whisper na izolovaném exportu „My“ nepozná, s kontextem ano. Sluchem neověřeno, aplikace varuje | RMS zdroje po 20 ms; Whisper export 28,96+ | Sestřih, úsek C | info |
| 9 | Auto Reframe pojmenuje sekvenci „Vyrok Simkova 16x9 9x16“ (připojí formát i k názvu, který už formát má) | dump | Auto Reframe ze sekvence s „16x9“ v názvu | info |

Beze změny proti S10: v čistém profilu má první export MP4 hlasitost „Vypnuto“ (S10 #3). Ručně jsem ji přepnula na −14 a dialog si ji pak pamatoval.

## Co funguje (ověřeno)

**Zakázka 1 – výrok 30 s (rozhovor 28 min, 1280×720 25p)**
- Přepis 28min souboru byl z mezipaměti Workeru hotový do 40 s po importu (409 vět).
- Věty 22–27 vložené do nové sekvence: 31,92 s, V1+A1 propojené.
- Titulky z přepisu (9).
- Oprava „damu → DAMU“ a „novu → Novu“ v panelu Titulky:
  - opravy se propsaly do přepisu;
  - platí i v pozdějších sekvencích 9:16 a TV (titulky tam vznikly už opravené).
- Konec „…jako reportérka.“ je celý (Whisper konec 31,72 z 31,92).

**Nadpis nahoře**
- Přepínač Zobrazit:
  - vypnutím se v modelu nastaví `title.off:true`, text zůstane v poli a náhled nadpis skryje (02, 03);
  - zapnutím se nadpis vrátí.
- Exporty `…-1-169-bez-nadpisu.mp4` (bez nadpisu) a `…-1-169.mp4` (s nadpisem) vyšly přesně podle přepínače (05). Oba mají 31,92 s a −14,0 LUFS.

**Auto Reframe 9:16**
- Hotovo za ~3 s; obličej nalezen ve 4 záběrech ze 4.
- Každý kus obrazu má svůj zvuk (4 dvojice `linkId`).
- Nadpis se přenesl a titulky se rozdělily na 17 (20 zn., 30 % od spodu).
- Nadpis i titulky jsou uvnitř bezpečných zón (06).
- Export 1080×1920, −14,0 LUFS, bez černých snímků. Vadu mimo nález 1 jsem nenašla.

**Zakázka 2 – sestřih 60 s**
- 5 úseků z Přepisu přes „Přidat na konec sekvence“: věty 49–53, 244–247, 304–307, 386, 374–376.
- Dva b-rolly z `vyrez-5min.mp4`: In/Out ve Zdroji, patch V1→V2, A1 vypnutý, klávesa `.`. Obraz šel na V2 bez zvuku.
- Ruční úpravy, všechny působí na V i A:
  - Ctrl+K ×2 a Shift+Delete prostředního kusu: věta „Já jsem to vlastně nikomu neřekla.“ pryč, b-roll na V2 se posunul s osou;
  - Q (odstraněno „Prostě my ani nepotřebujeme nic slyšet,“);
  - W (pryč úlomek „Je-“ z „Jenom“ na konci);
  - ripple ořez nástrojem B tažením (konec úseku B před „Okej“).
- Zpět/Znovu: 2× Ctrl+Z a 2× Ctrl+Y vrátí bajtově stejný stav stop.
- Titulky po střihu (19) obsahují jen to, co zazní. Vystřižené věty v nich nejsou.
- Export `redaktorka-s11-2-sestrih-60s.mp4` (1280×720):
  - 57,48 s, −14,0 LUFS, bez černých snímků;
  - hrany b-rollu jsou čisté, snímek přesně (10);
  - konec „…kouknem se na film.“ je celý (Whisper 57,34 z 57,48);
  - začátek „No a pak…“ je v tichu (RMS zdroje −45 dB na 221,68 s).

**Zakázka 3 – TV verze**
- Nová sekvence 1920×1080 25p (Přepis → Do nové sekvence, předvolba Full HD) + titulky z přepisu.
- Export předvybral MXF XDCAM, −23 LUFS, „vypálit“ vypnuto a „.srt“ zapnuto (14).
- `redaktorka-s11-3-tv.mxf`:
  - mpeg2video 4:2:2, 50 Mb/s, 1920×1080, 25p;
  - 2× mono PCM 24bit 48 kHz;
  - 31,92 s, −22,8 LUFS;
  - v obraze titulky nejsou (15).
- `.srt`: UTF-8, 9 titulků, časy shodné se sekvencí.

**S10 #1 (zopakovaný konec) – opraveno**
- Scénář z S10:
  1. vyrez 151,12–185,12 vložený do nové sekvence;
  2. klip má `hold {d:0,16, out:185,12}`, žádný samostatný klip `rep`;
  3. Ctrl+K na 20,04, Shift+Delete posledního kusu.
- Výsledek: na ose nic nezbylo a nepřišla žádná hláška o b-rollu.
- Export `redaktorka-s11-4-hold-po-shiftdelete.mp4` má 20,04 s, scdet ani blackdetect nic nenašly.
- Po Ctrl+Z a W na 30 s se klip zkrátí na 0–30 a nic nezůstane.

## Neověřeno
- Poslech sluchem (jen Whisper large-v3 a RMS).
- Nativní nabídky okna, dialogy Import/Uložit/Procházet a Ctrl+S.
- Commity d510598 a c0b1c27 (přišly během testu).
- Export po W v testu `hold`.
- Zvýrazňování slov u opraveného titulku (nález 7).
- AI panel (podle zadání nespouštěn).

**Exporty:** `APP\web\test-out\redaktorka-s11-*`
- 1-169-bez-nadpisu, 1-169, 1-916 (MP4 + .srt);
- 2-sestrih-60s;
- 3-tv.mxf + .srt;
- 4-hold-po-shiftdelete.

XDCAM z 720p neprošel, žádný soubor nevznikl.

**Snímky:** `s11\shots-redaktorka\01–16`.
