# Redaktorka – kolo S5: TV reportáž z více zdrojů (2026-11-23)

**Otázka:** Udělám v PZ AI Cut Standalone TV reportáž (~75 s) z více zdrojů jako v Premiere?
**Odpověď: skoro ano.** Reportáž jsem dotáhla do MP4, MXF i 9:16 a nic se nezaseklo. Fungovaly:
- výroky z přepisu,
- b-roll na V2 se ztlumeným zvukem,
- hudba na A2 (−18 dB),
- J-cut a L-cut,
- prolínačky,
- nadpis a titulky jen z A1.

Úprava uprostřed ale umí potichu rozjet V2, hudbu i titulky (nález 1). Ctrl+D na klipu V2 udělá zatmívačku do černé (nález 2).

**Instance:** 9371, `--size 1920x1080 --lang cs --ai`, profil `%TEMP%\pz-s5-redaktor`, HEAD 9819f34. AI panel jsem zavřela a nepoužila.

**Ovládání:** vlastní `ui.js` (scratchpad) přes CDP `Input.dispatchMouseEvent/KeyEvent/insertText` – klik, dvojklik, Shift/Alt+klik, tažení, kolečko, klávesy, psaní. Stav jsem jen četla přes `eval` (časová osa, titulky, souřadnice klipů).

**Pomůcky místo nativních dialogů a nabídek:**
- `TN.app.importPaths([3 soubory])` – import,
- `TN.app.cmd('newSequence' | 'transitionDuration' | 'fadeInOut' | 'headline' | 'reframe916')` – položky nativní nabídky,
- první uložení: `project.path = …` + `cmd('save')`,
- jeden zkušební export přes `exporter.exportSequence` (rozsah In/Out 9–14 s) kvůli měření nálezu 2.

Všechny ostatní exporty šly přes dialog **⇪ Export**. Obsah rozhovoru jsem plánovala z přepisu, který jsem jen četla (`__pzASR.get`), a z kontaktních archů ffmpeg (místo ručního projíždění).

**Zdroje:**
- A1/V1: rozhovor 28 min (přepis z cache Workeru, 409 vět),
- b-roll: `test/media/vyrez-5min.mp4`,
- hudba: `O:\STRIH TEST\SPRT168_181-We_March_Toward_Certain_Death.wav` (60 s, WAV s obrázkem obalu – správně jen zvuk).

**Výstupy** v `web/test-out/`:

| Soubor | Formát | Délka | Hlasitost | Export |
|---|---|---|---|---|
| `redaktorka-s5-A-16x9.mp4` (+.srt), před úpravami | 1080p25 H.264 | 70,40 s | −22,9 LUFS | 13 s |
| `redaktorka-s5-B-16x9.mp4` (+.srt), po úpravách | 1080p25 H.264 | 69,04 s | −22,9 LUFS | 12 s |
| `redaktorka-s5-B-16x9.mxf` | XDCAM mpeg2 1080p25, 2× mono PCM 24 bit, TC 00:00:00:00 | 69,04 s | pár −22,9 LUFS (každá mono −25,9) | 12 s |
| `redaktorka-s5-C-9x16.mp4` (+.srt), Auto Reframe | 1080×1920 | 69,04 s | −14,2 LUFS | 16 s |
| `redaktorka-s5-D-po-ripple-pres-v2.mp4`, důkaz k nálezu 1 | – | – | – | 16 s |
| `redaktorka-s5-test-v2-prechod.mp4`, důkaz k nálezu 2 | 5 s | – | – | – |

Černé snímky (blackdetect) jsou jen v roztmívačce a zatmívačce na začátku a konci (0–0,28 s a posledních 0,2 s).

## 3 nejdůležitější nálezy

1. **⚠ Ripple Delete na V1 rozjede V2, hudbu a titulky, když na V2 leží klip přes mazaný úsek (záv. 3).**
   - **Kroky:**
     1. Ctrl+Shift+K v 38:00 a 39:00. Řez projde všemi stopami včetně b-rollu na V2 (37,00–40,52) a jeho zvuku na A3.
     2. Klik na kousek V1 38–39 (vybere V1+A1).
     3. Shift+Delete.
   - **Výsledek:**
     - Posunuly se jen V1 a A1 (−1 s).
     - Na místě zůstaly V2 (b-roll 53,64), A2 (hudba 49,00), A3 a **všech 16 titulků**.
     - Délka sekvence zůstala 69,04 s, i když obraz končí v 68,04 s.
     - Žádné varování (stav „Připraveno“).
   - **Whisper exportu D:** „A tam vlastně“ zazní v 50,34 s, titulek začíná v 51,605 s (+1,27 s). „A šli jsme běhat“ zazní v 48,76 s, titulek je v 49,71 s.
   - **Pro srovnání:** první ripple delete (13,28–14,64, na V2 tam nic nebylo) posunul V2, A2, A3 i titulky správně o −1,36 s (34).
   - **Premiere:** stopy se zapnutým Sync Lock se posunou s ním. Co Premiere udělá s klipem přes vyříznutý úsek, jsem neověřovala.
   - Vrátila jsem to Ctrl+Z ×3.

2. **⚠ Ctrl+D na b-rollu ve V2 = zatmívačka do černé uprostřed výroku (záv. 3).**
   - Vybrala jsem klip V2 (10,00–13,04) a dala Ctrl+D. Stav napsal „Prolínačka použita v 00:00:13:01“, ale v klipu je `vOut: dipBlack 2 s`.
   - Monitor Programu b-roll ztmaví (25). Export ukazuje jas YAVG 121 → 90 → 17,5 ve 13,0 s a pak tvrdý střih na rozhovor (YAVG 121).
   - **Premiere:** Cross Dissolve na volném kraji klipu ve V2 prolne do stopy pod ním (průhlednost).
   - Pro výsledné exporty jsem to vrátila Ctrl+Z. Prolnutí b-rollu do rozhovoru tedy v aplikaci udělat nejde.

3. **⚠ Po ripple delete zůstane titulek se smazanými slovy a překrývá další titulek (záv. 2).**
   - Vystřihla jsem „Ani doma, ani mámě.“: Ctrl+Shift+K na 13,28 a 14,64 a Shift+Delete.
   - Titulek „Já jsem to vlastně nikomu neřekla. / Ani doma, ani mámě.“ zůstal v rozsahu 11,83–14,72 a v 13,39–14,72 se kryje s titulkem „Prostě nikomu…“.
   - Ve 14,00 s Program ukazuje text, který už nezazní (35). Žádné upozornění.
   - **Oprava funguje:** Text v obraze → Vytvořit titulky z přepisu → **Nahradit titulky**. Titulek se zkrátí na 11,83–13,28 „Já jsem to vlastně / nikomu neřekla.“ a moje oprava ASR („na Novu“) zůstane.
   - **Premiere:** titulky taky nepřepíše, ale titulková stopa se Sync Lock se při ripple zkrátí, takže se titulky nepřekrývají. Neověřeno.

## Tabulka

| # | Krok | Výsledek | Premiere dělá | Záv. | Důkaz |
|---|---|---|---|---|---|
| 1 | Import 3 zdrojů (pomůcka) | 0,28 s. Rozhovor má přepis z cache. Hudba se taky „přepsala“ (0 slov) a dlaždice má „✓ Přepis“ | Přepis jen na požádání | 1 | 02, 14 |
| 2 | Nová sekvence (čistý profil) | Předvolba **1080×1920 9:16**, i když ve Zdroji je klip 1280×720. Full HD šipkou | Podle zvolené předvolby / klipu | 1–2 | 03, 04 |
| 3 | Přepis: hledat, klik na větu, Shift+klik, „Přidat na konec sekvence“ | 4 výroky za ~4 min. Varování „Začátek v souvislé řeči“ u 2 výroků | Text-Based Editing podobně | ok | 06–13 |
| 4 | Shift+klik na řádek pod varovným pruhem | Pruh `.tr-foot` zakrývá spodní řádky seznamu. Klik padne na pruh, výběr se nerozšíří a omylem jsem vložila jen 1 větu (4,4 s). Opraveno Ctrl+Z | – | 2 | 12 |
| 5 | Intro: Zdroj vyrez In 2:00/Out 7:00, A1 patch vypnout, Home, čárka | Vloží se jen obraz na V1, vše se posune (ripple insert) | Stejně | ok | 16 |
| 6 | J-cut: N + Alt+tažení střihu V1 o +1 s | Obraz 5,96, zvuk 5,04, synchron drží | Stejně (Alt = jen jedna stopa) | ok | 17 |
| 7 | L-cut: N + Alt+tažení střihu V1 o −1,6 s | Obraz výroku 4 od 51,24, zvuk výroku 3 do 52,84 | Stejně | ok | 18 |
| 8 | Ctrl+D s playheadem na 20,48 | Prolínačka padla na **5,96**: po vložení zůstal intro klip vybraný a Ctrl+D jde na vybraný klip. Stav to napsal. Po Esc a Ctrl+D správně na 20,48 | Vložený klip se nevybírá | 1–2 | 19 |
| 9 | B-roll na V2: patch V2, A vypnout / A3, In/Out, timecode, tečka (overwrite) | 3 klipy na V2, jeden se zvukem na A3, A3 „M“ (ztlumeno). Whisper exportu: v 37–40,5 s jen řeč Šimkové, zvuk b-rollu neslyšet | Stejně | ok | 20, 23 |
| 10 | Ctrl+D na klipu V2 | Zatmívačka do černé (nález 2) | Prolnutí do V1 | 3 | 24, 25 |
| 11 | Hudba A2: WAV In/Out, 2 klipy (intro 0–8 s, závěr 49–69 s), výběr obou, G, −18 | Oba −18 dB, štítek „-18 dB“ | Stejně | ok | 22 |
| 12 | Stmívačka hudby: Ctrl+Shift+D | Pevně **6 snímků (0,24 s)**. Délku nejde nastavit („Výchozí délka přechodu“ jen pro video), krajem nejde táhnout, keyframy nejsou. Delší fade jen přes „Fade In/Out sekvence“ (2 s na začátku a konci, ztmaví i obraz) | Výchozí délka audio přechodu, tažení přechodu, keyframy hlasitosti | 2 | 23 |
| 13 | Nadpis (pomůcka `headline`) | Nadpis nahoře přes celou sekvenci. Časově omezenou jmenovku (lower third) udělat nejde | Grafika na V3 s vlastní délkou | 2 | 27 |
| 14 | Titulky z přepisu | „4 úseky z klipu tncz…“, tedy jen A1. 16 titulků za ~1 s. b-roll ani hudba se nepřidaly. Start titulků ±0,25 s proti Whisperu | Speech to Text, výběr stopy | ok | 28, 29 |
| 15 | Oprava ASR v seznamu Titulky | „Jsem na Novo“ → „na Novu…“, Enter. Oprava přežila „Nahradit titulky“ | Stejně | ok | – |
| 16 | Titulek výroku 3 | Začíná „pak si pamatuju“, chybí „A“, které je slyšet (Whisper 31,34–31,42; klip od 31,36) | – | 1 | – |
| 17 | Ctrl+Z | Vrátí i polohu playheadu (64,36 po vrácení přechodu) | Playhead se nevrací | 1 | – |
| 18 | Export A přes dialog | MP4 má výchozí hlasitost „Vypnuto“, přepnula jsem na TV −23. Hotovo za 13 s | – | ok | 30–32 |
| 19 | Ripple delete 13,28–14,64 (na V2 nic) | V2, A2, A3 i titulky posunuté o −1,36 s ✓. Titulek se smazanými slovy zůstal (nález 3) | – | 2 | 33–35 |
| 20 | Posun klipu V2 tažením (34,64 → 37,00) | Spojený A3 jel s ním, titulky beze změny (správně) | Stejně | ok | 36 |
| 21 | Ripple delete pod klipem V2 | Rozjede se V2, hudba i titulky o 1 s (nález 1) | Sync Lock | 3 | 41 |
| 22 | Export B MP4 + MXF (formát šipkou, hlasitost zůstane TV) | 12 s + 12 s. MXF má výchozí „vypálit titulky“ zaškrtnuté | Pro TV se obvykle exportuje čistý obraz | 1 | 38 |
| 23 | Auto Reframe 9:16 (pomůcka) | Nová sekvence za < 3 s, 12 záběrů, obličej ve 12. **V2 se reframuje samostatně**: b-roll (široký záběr) vyřízne na Šimkovou (posX 0,73–0,77), intro a závěr na moderátorku (−0,60). V1 se rozřízne ve střizích kamery (20,76; 58,88). L-cut se posunul o 0,16 s (49,88 → 50,04, úklid kraje). Titulky přeskládané na 35 (2×20 zn.), nadpis zůstal | Auto Reframe všech videostop, nová sekvence | ok | 39, 40 |
| 24 | Export 9:16 | Sám zvolí MP4 a −14. 16 s, −14,2 LUFS | – | ok | 40 |

**Hranice slov (Whisper large-v3, export B):** na všech střizích A1 jsou celá slova:
- 5,04 „No“,
- 13,28 „neřekla. | Prostě“,
- 19,12 „nebylo. | Takže“,
- 31,36 „web. | A pak“,
- 51,48 „sněhu. | A tam“,
- konec 62,58 „dalo.“

**Hudba:** samotná v intru −39,8 LUFS, řeč −26,2 LUFS (export A). Podkres je tedy zhruba 13,5 LU pod řečí.

**Časy** (kroky posílal skript, čas není lidský):
- import → 4 výroky na časové ose: 5 min,
- → hotová reportáž (V2, hudba, přechody, J/L, nadpis, titulky): 9,5 min,
- → export A: 10,5 min,
- úpravy + nové titulky + MP4 + MXF + 9:16: dalších 4,5 min.

Celkem ~15 min včetně měření. Nic se nezaseklo a kódování trvalo 12–16 s.

## Verdikt
**Reportáž z více zdrojů jako v Premiere v aplikaci udělat jde.** Fungují:
- source patching na V2 / A3,
- ztlumení stopy,
- J/L cut přes Alt + Rolling,
- zesílení −18 dB,
- titulky jen z A1,
- MXF i Auto Reframe, který zpracuje i b-roll na V2.

Pro TV nasazení ale chybí dvě věci, na které divák narazí:
1. **Ripple delete musí posouvat všechny stopy včetně titulků**, i když na V2 leží klip přes mazaný úsek. Kdyby to nešlo, ať aspoň varuje.
2. **Prolínačka na volném kraji klipu ve V2** má prolínat do stopy pod ním, ne do černé.

Menší dluhy:
- délka audio stmívačky,
- časově omezená jmenovka místo nadpisu přes celou sekvenci,
- titulek se smazanými slovy po ripple delete (aspoň výzva „Nahradit titulky“),
- varovný pruh v Přepisu zakrývá řádky,
- Ctrl+D jde na klip, který zůstal vybraný po vložení.
