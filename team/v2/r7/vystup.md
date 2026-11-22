# Kolo 7 – Kontrolor výstupu: „Je hotové MP4 bezchybné pro diváka?“

**Ne.** Verze `app.js?v=mws2qvzb`, 4 exporty z `vyrez-5min.mp4` (`web/test-out/vystup-r7-{a,b,c,d}.mp4`), všechno měřeno stroji
(ffmpeg, OpenCV YuNet, faster-whisper large-v3 na GPU, RMS po 10 ms). Důkazy v `team/v2/r7/vystup/`.

## Tři nejdůležitější nálezy
1. **Rozpadlý obraz (kostičky, růžové/oranžové fleky) 0,4–0,5 s po rychlém sledu dvou střihů obrazu – i v 16:9.**
   Kodér (WebCodecs H.264, klíčový snímek jen po 50 snímcích, při střihu žádný) dá prvnímu novému záběru velký P-snímek
   (60–100 kB) a následujícím jen 37–500 B. Když se hned potom obraz znovu změní (probliknutí z bodu 2/3), dekodér skládá nový
   záběr ze špatné reference. Chyba proti zdroji (RGB, pás bez titulků) skočí z mediánu 3,0–3,4 na **9,3** (b 15,04–15,52 s)
   a **6,4** (a 7,60–7,96 s). Dekódování H.264 je deterministické, takže to uvidí každý přehrávač. → `b-artefakty-375-383.png`, `a-pas-187-199-vyrez.png`, `b-pas-375-405.png`
2. **Useknutá slova a útržky cizích vět na střizích, v titulcích i ve zvuku.** (c) 18,84 s: Out 85,88 je 0,4 s uvnitř další věty
   „nikdo jsme ne-“: RMS posledních 10 ms **−17,6 dBFS** (medián řeči −15,2) a zdroj za Out −30 dB = řeč se utne uprostřed slova,
   titulek „**Nikdo** Že vlastně…“. (a/b) začíná útržkem „(tak) **dále.**“ z předchozí věty (Whisper „tak dále.“ 0,02–0,46 s,
   titulek „dále.“). (a/b) 12,84 s: posledních 10 ms −26,7 dB = 10ms výbuch „T“ slova „To“, titulek „**To** A byla to…“,
   Whisper „To“ neslyší. (a/b) konec: Out 191,20 je 20 ms před koncem „životě“, v posledních 50 ms náběh další slabiky (−25 dB).
3. **Probliknutí na střizích obrazu.** (a) 16:9 7,52–7,56 s: **2 snímky moderátorky** (zbytek záběru 145,88–145,96 před střihem
   kamery). Stavění 16:9 zbytky záběru vůbec neřeší – oprava `edgeFragments` z log.md platí jen pro Reframe. Ve výřezech je
   řez Reframe v **6 z 9 střihů kamery o 1 snímek pozdě** (106,00 místo 105,96; 115,64/115,60; 190,40/190,36; 221,52/221,48;
   227,24/227,20; 185,00/184,96): první snímek nového záběru má starý výřez a obličej je uříznutý na kraji (b 1,72 s, b 3,60 s,
   c 28,28 s). Ten snímek pak spouští i nález 1. Zbytky 0,36–0,40 s (nad prahem 0,3 s) zůstávají: b 3,20–3,60 s, d 26,04–26,40 s
   (video končí 9 snímky celku). → `a-snimky-7.52.png`, `b-snimky-1.72.png`, `b-snimky-3.6.png`, `c-snimky-28.28.png`, `d-snimky-26.0.png`

## Co je v pořádku (změřeno)
- **A/V sync:** zvuk každého klipu proti zdroji (křížová korelace) **0,0 ms**, korelace 0,999–1,0. Obraz v 16:9 snímek po snímku
  odpovídá zdroji (318/396 posun 0, zbytek jsou statické snímky; kontrola na pohybu ruky 0 snímků). Střihy kamer ve výřezech
  sedí na snímek se zdrojem (mimo 1snímkové zpoždění Reframe).
- **Délka:** video = sekvence přesně (15,84 / 15,84 / 35,08 / 26,40 s), zvuk Opus +20 ms. Žádné černé snímky. Zdánlivé
  „zamrznutí“ u střihů jsou statické záběry (zdroj se tam také mění jen o 0,01–0,03).
- **Cvaknutí:** skok vzorku na střihu 0× (poměr k p99,5 sousedních 0,5 s = 0,00–0,01). Prolínání zvuku je jen 3,2 ms.
- **Hlasitost:** všechny čtyři −14,0 LUFS (LRA 3,4–8,9 LU). True peak −1,1 / −1,1 / **−0,9** / −1,0 dBTP – (c) je nad stropem −1,0
  (v kole 1 bylo −1,1).
- **Prázdný výřez:** YuNet na zdroji + poloha výřezu (template matching): po 0,2 s a každý snímek ±0,13 s kolem střihů, 474 snímků.
  Výřez bez člověka, i když ve zdroji je, jen 1× (b 1,72 s = 1snímkový řez z bodu 3), c 31,32 s je falešný poplach (hlava otočená).
  „1,2 s prázdného stolu“ z kola 5 se **neopakuje**.
- **Titulky a obličeje:** žádný překryv (YuNet × rámeček titulku, 22 snímků). 9:16: nadpis od 13,0 % výšky (250 px), titulky
  61–70 % (1173–1345 px, x 131–950).

## Další nálezy
- **Exportovaný obraz má jiné úrovně než zdroj:** surové Y exportu p1/p99 = 27/242, zdroj 40/222 (sklon 1,18 ≈ 255/219). Export
  zapisuje plný rozsah bez značky `color_range`/`color_space` (zdroj `tv/bt709`, export `unknown`). Přehrávač ho čte jako TV
  rozsah → vyšší kontrast, přepálené bílé tričko i vlasy, slité stíny. → `a-barvy-zdroj-vs-export.png`
- **Časování titulků:** „protože moje máma…“ se ukáže o **0,63 s** později, než zazní (a, b, d – stejné místo zdroje 147,28 s).
  „To A byla…“ naopak 0,55 s před střihem (běží ještě přes konec minulého záběru). V (c) +0,45 s „vyšetření“.
- **Slova v titulcích proti Whisperu:** chybí „té“ (tmel *té* naší rodiny), „už“, „já“, „to“ (zvládnout *to*). Známé chyby
  („zvolával“, „narození“, „doposavať“) se neopakují jako nové.
- **9:16 bezpečné zóny:** spodní hrana titulků je 575 px (30 %) nad spodkem. Meta pro Reels doporučuje volných 35 % → druhý řádek
  může zakrýt popisek. Pravý okraj titulků x = 950 sahá do sloupce tlačítek (~ posledních 130 px). Nadpis 250 px je přesně na
  hranici 14 % nahoře.
- **Skok šumu pozadí:** (d) 25,12 s: dýchání/ruch −28 dB spadne na střihu na −51 dB (bez prolnutí).

| # | výstup | čas ve videu | vada | naměřeno | záv. | důkaz |
|---|---|---|---|---|---|---|
| 1 | b 9:16 | 15,04–15,52 | rozpad obrazu (kostičky, růžové fleky) po 1snímkovém špatném výřezu | P-snímky 134–1000 B po 97 kB; chyba 9,3 vs medián 3,4 | 3 | b-artefakty-375-383.png, b-pas-375-405.png |
| 2 | a 16:9 | 7,60–7,96 | rozpad obrazu po probliknutí moderátorky | P-snímky 37–500 B; chyba 6,4 vs 3,0 | 3 | a-pas-187-199-vyrez.png |
| 3 | a 16:9 | 7,52–7,56 | 2 snímky jiného člověka (moderátorka) na začátku klipu | zbytek záběru 0,08 s, 16:9 bez `edgeFragments` | 3 | a-snimky-7.52.png |
| 4 | c 4:5 | 18,84 | useknuté slovo „nikdo jsme ne-“ | RMS −17,6 dB v posl. 10 ms, Out 0,4 s v další větě | 3 | whisper-citelne.txt, m-c-mereni.json |
| 5 | a, b | 0,00–0,46 | začíná útržkem „(tak) dále.“ z předchozí věty | Whisper „tak dále.“; In 104,24 (věta od 104,79) | 3 | whisper-citelne.txt, a-2s.png |
| 6 | a, b | 12,80–12,84 | useknutý začátek „To“ (10ms ťuk), titulek „To“ neslyšet | −26,7 dB vs okolí −45 dB | 2 | obálka v příkazech níže |
| 7 | a, b | 15,79–15,84 | konec: utnuté „životě“ + náběh další slabiky | posl. 50 ms −29 dB, Out 20 ms před koncem slova | 2 | m-a-mereni.json |
| 8 | b, c, d | 1,72 / 3,60 / 15,00 (b); 28,28 / 34,00 (c); 26,00 (d) | řez Reframe o 1 snímek pozdě → obličej uříznutý | 6 z 9 střihů kamery +40 ms | 2 | b-snimky-1.72.png, c-snimky-28.28.png |
| 9 | b; d | 3,20–3,60; 26,04–26,40 | krátký zbytek záběru 0,40 / 0,36 s (nad prahem 0,3 s) | 10 a 9 snímků | 2 | b-arch-3.2.png, d-snimky-26.0.png |
| 10 | všechny | celé | plný rozsah bez značky → vyšší kontrast, přepálené bílé | Y p1/p99 27/242 vs 40/222, `color_range=unknown` | 2 | a-barvy-zdroj-vs-export.png |
| 11 | a, b, d | 9,55 (a,b) / 9,83 (d) | titulek o 0,63 s později než řeč | Whisper „protože“ 8,92 vs titulek 9,55 | 2 | titulky-vs-whisper.txt |
| 12 | c | 18,50 | titulek obsahuje „Nikdo“, „To“ (a, b) – slova, která nezazní celá | viz 4, 6 | 2 | titulky-vs-whisper.txt |
| 13 | c | celé | true peak nad −1 dBTP | −0,9 dBTP | 1 | hlasitost.txt |
| 14 | b | 0–15,84 | titulky v dolních 35 % a do sloupce tlačítek (Reels/TikTok) | spodek 1345/1920 px, x do 950 | 1 | b-5s.png |
| 15 | a, b, c, d | různé | v titulcích chybí slyšená slova („té“, „už“, „já“, „to“) | 4 slova | 1 | titulky-vs-whisper.txt |
| 16 | d | 25,12 | skok ruchu na střihu | −28 → −51 dB | 1 | obálka |

## Jak zopakovat (Chrome `--remote-debugging-port=9372 --user-data-dir=%TEMP%\pz-r7-vystup`, `CDP_PORT=9372 node test/shot.js …`)
- Import: `await __pzDevImport('/devfile?p='+encodeURIComponent('O:/TN_strihatko/test/media/vyrez-5min.mp4'),'vyrez-5min.mp4')`
- a) `__pzDev.tools.build_sequence_from_transcript({source:'vyrez-5min.mp4',picks:[27,30,36,46],name:'vystup-r7-a',captions:true})`
- b) `reframe_sequence({name:'vystup-r7-a',formats:['9:16']})` + `set_title({name:'vystup-r7-a 9x16',text:'Mámu ztratila za tři týdny'})`
- c) `build_sequence_from_transcript({…picks:[20,21,22,23,52,53,54],name:'vystup-r7-c',format:'4:5',captions:true})` + `set_title(…'Nemoc, o které nikdy neslyšela')`
- d) `build_sequence_from_transcript({…picks:[33,36,37,38,44],name:'vystup-r7-d',captions:true})` → `reframe_sequence({formats:['1:1']})` + `set_title(…'Máma byla tmel rodiny')`
- Export: `await __pzDevExport({name:'vystup-r7-<x>',burn:true,loudness:'social'})`. Stav sekvencí: `vystup/sekvence.json`.
- Měření (v `team/v2/r7/vystup/`, Python = `O:\ADOBEPREMIERESTRIH\.venv\Scripts\python.exe`):
  `mereni.py <export> "<sekvence>" <zdroj> m-<x>` (RMS ±50/10 ms, zdroj za Out/před In, skok vzorku, korelace sync,
  rozdíly snímků/střihy/černé/krátké záběry, posun snímku 16:9, výřez + YuNet) · `whisper_cuts.py cuda` (celý export + ±1 s kolem
  každého střihu, i ve zdroji) · `titulky.py` (titulky × Whisper) · `obalka.py <soubor> <časy>` (RMS po 10 ms ±150 ms) ·
  `artefakty.py <x> <w> <h> "<sekvence>"` (chyba snímku proti zdroji) · `zony.py <export> <w> <h> <časy>` (poloha nadpisu,
  titulků, obličejů) · `archy.sh <export> <prefix> <časy>` (archy ±2 s po 0,2 s a ±3 snímky).
- Hlasitost: `ffmpeg -i <export> -vn -af ebur128=peak=true:framelog=quiet -f null -`. Velikosti snímků:
  `ffprobe -select_streams v -show_frames -show_entries frame=pict_type,key_frame,pkt_size -of csv=p=0 <export>`.
- Střihy kamer ve zdroji (první snímek nového záběru): 9,04 41,92 46,36 73,88 77,84 101,0 105,96 115,6 120,28 137,04 139,44 145,96
  184,96 190,36 221,48 227,2 229,76 248,88 258,72 (`zdroj-strihy-kamer.txt`).
