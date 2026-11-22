# Kolo S1 – Kontrolor výstupu: „Je každý exportní formát standalone bezchybný pro diváka i pro vysílání?“

**Ne. Kodéry a kontejnery jsou čisté, ale chyby jsou na střizích a v TV formátech.**

Kodéry a kontejnery jsou z velké části v pořádku:
- barvy jsou správně a mají značky `tv/bt709`,
- střihy kamer ve výřezech sedí na snímek,
- nikde nejsou kostičky,
- A/V sync je 0,0 ms,
- prolínačka i stmívačka jsou plynulé.

Divák ale uvidí na střizích 7 snímků moderátorky a pro vysílání mají MXF exporty tři vady:
- chybí jim snímek,
- hlasitost leží mimo toleranci,
- formát je ve dvou bodech nestandardní.

Jak jsem testoval:
- Instance `standalone.js start 9372 %TEMP%\pz-s1-vystup --size 1600x900 --lang cs --ai`, most 7890.
- Import `test/media/vyrez-5min.mp4`, přepis přes Worker (46 vět, 19 s).
- Sekvence jsem postavil přes MCP server MY Premiere MCP napojený na most instance (`s1/vystup/mcp.js`): `build_sequence_from_transcript`, `reframe_sequence`, `add_captions`. Nadpis a přechody jsem zadal přes `TN.app` (`cmd('applyCross')`, `cmd('applyDipBlack')`).
- Exportoval jsem pomůckou `exporter.exportSequence`, ne přes dialog. Dialog jsem otevřel a prohlédl, viz `02-export-dialog.png` a `03-export-dialog-xdcam.png`.
- 12 exportů je v `web/test-out/vystup-s1-*`.
- Měřil jsem skripty z r7/r8 upravenými pro S1 a k tomu přidal `posun*.py` a `whisper_spot.py`. Vše je v `team/v2/s1/vystup/`.

## Tři nejdůležitější nálezy
1. **Probliknutí cizího člověka: 7 snímků (0,28 s) moderátorky na začátku klipu, a to i v 16:9.**
   - Kde: a 16:9 a b 9:16 v 7,24–7,52 s, d 1:1 v 8,60–8,88 s.
   - Moderátorka je pod titulkem „Všechno, naprosto všechno,“, takže to vypadá, že to říká ona.
   - Proč: klip začíná v 145,68 a střih kamery ve zdroji je v 145,96.
   - Na konci d (27,44–27,64) a e (9,60–9,80) je navíc 5 snímků celku, takže poslední snímek videa je jiný záběr.
   - Na webu to v r8 bylo opravené (`edgeFragments` ve `web/ai/reframe.js`). Standalone staví přes MCP server a `src/core/pmcp-api.js`, kde tahle oprava není. Je to **regrese proti webu**.
   - Důkaz: `a-arch-7.24.png`, `b-arch-7.24.png`, `d-snimky-8.6.png`, `d-arch-27.44.png`.
2. **MXF s vypálenými titulky (přes cestu s překódováním) je o 1 snímek kratší a XDCAM je od 12,72 s o snímek napřed proti zvuku.**
   - Délky: `a-xdcam` (720p i 1080p) má 399 snímků místo 400 a trvá 15,96 s. `d.mxf` (DNxHR) má 690 snímků místo 691. Zvuk se zkrátí s obrazem.
   - XDCAM: od klipu 4 (12,72 s) je obraz posunutý o +1 snímek. Střih kamery je proto v 15,08 místo 15,12 a obraz předbíhá zvuk o 40 ms. Chyba snímku je 48,7 při mediánu 0,33.
   - DNxHR ztratí jen poslední snímek. `e.mxf` (bez titulků, cesta `-c:v copy`) má správných 245 snímků.
   - ProRes a H.264 mají počet snímků přesný.
   - Důkaz: `axd-snimky-15.08.png` vs `a-snimky-15.08.png`, `artefakty.txt`, `posun_useky.py`.
3. **TV hlasitost a formát XDCAM nejsou připravené na příjem do vysílání.**
   - Hlasitost: `loudness:'tv'` dá −22,0 LUFS (d.mxf), −22,3 (a-xdcam) a −23,0 (e.mxf). R128 pro soubory chce −23 ±0,5 LU. Sociální sítě: −13,4 až −13,6 místo −14,0 (web měl přesně −14,0). Příčina: jednoprůchodový `loudnorm`.
   - Formát a dialog:
     - XDCAM povolí 1280×720 25p. Sekvence z 720p zdroje je 720p, takže vznikne nestandardní XDCAM 720/25p bez varování.
     - V MXF jsou jen 2 mono stopy (vysílání obvykle chce 4 nebo 8).
     - Timecode je 00:00:00:00.
     - Formát nejde nastavit jako prokládaný 1080i25.
     - V dialogu zůstane po volbě XDCAM (TV) hlasitost na „Vypnuto“.
   - Bez kopie TV specifikace Novy to neumím rozhodnout. Je ale potřeba ho porovnat se specifikací.

## Nálezy
| # | výstup | formát | čas | vada | naměřeno | záv. | důkaz |
|---|---|---|---|---|---|---|---|
| 1 | a 16:9, b 9:16 | h264, h265 | 7,24–7,52 | 7 snímků moderátorky pod větou „Všechno…“ | video In 145,68, střih kamery 145,96 | 3 | a-arch-7.24.png, b-arch-7.24.png |
| 2 | d 1:1 | h264, dnxhr | 8,60–8,88 | totéž (moderátorka 7 snímků) | In 145,68 | 3 | d-snimky-8.6.png |
| 3 | a-xdcam 720p i 1080p | xdcam | 12,72–16,00 | ztracený snímek, obraz o 1 snímek napřed, střih kamery o snímek dřív, délka 15,96 | 399/400 sn., posun +1 od klipu 4, chyba snímku 48,7 | 3 | axd-snimky-15.08.png, ffprobe.txt |
| 4 | d | dnxhr | konec | chybí poslední snímek a zvuk má 27,60 místo 27,64 | 690/691 | 2 | ffprobe.txt |
| 5 | d, a-xdcam | dnxhr, xdcam (TV) | celé | hlasitost mimo −23 ±0,5 LU | −22,0 / −22,3 LUFS (e −23,0) | 2 | hlasitost.txt |
| 6 | a, b, c, d | h264, h265, prores | celé | hlasitost pro sítě není přesně −14 | −13,6 / −13,6 / −13,5 / −13,4 LUFS; TP −1,4 až −1,5 dBTP | 1 | hlasitost.txt |
| 7 | a | xdcam | – | XDCAM povolí 1280×720 25p, bez varování | MXF 1280×720p25 mpeg2 422 | 2 | ffprobe.txt, exporter.js `videoCodec` |
| 8 | všechna MXF | xdcam, dnxhr | – | jen 2 mono stopy PCM, TC 00:00:00:00, jen progresivní, dialog XDCAM nechá hlasitost „Vypnuto“ | 2× pcm_s24le, `timecode=00:00:00:00` | 2 | ffprobe.txt, 03-export-dialog-xdcam.png |
| 9 | e | xdcam (bez titulků) | spoje 2,04 / 6,28 | nepravidelné GOP na spojích úseků (IBBPBBPBP, IBBPP), velikosti snímků 213–287 kB. Zda se poruší VBV na spoji, neověřeno | GOP 12 jinde; průměr 50,00 Mb/s | 2 | ffprobe -show_frames |
| 10 | d, a, e | všechny | d 0,00 · a 12,72 · e 6,28 | útržek slova na začátku klipu: „Že…“, „(popr)at“, „(neře)kla“ | Whisper „Že…“ / „Klak.“; RMS hned za střihem −24 až −21 dB (řeč −14,8) | 2 | whisper-spot.txt, obalka.txt |
| 11 | a, b | h264, h265 | 15,91–16,00 | konec: náběh dalšího slova „a“ | posl. 50 ms −26 dB; Out 191,24, slovo „a“ od 191,20 | 1 | obalka.txt |
| 12 | d / c | h264 / prores | 17,73 / 25,11 | titulek o 0,91 s (d) a 0,59 s (c) později než řeč. Předchozí titulek visí 1,19 s po dořečení | Whisper „pohromadě“ 16,82, titulek 17,73 | 2 | titulky-vs-whisper.txt |
| 13 | e | xdcam, h264 | 2,56–2,84 | po prolínačce 7 snímků celku a pak střih kamery | zdroj In 119,48, střih 120,28 | 2 | e-arch-2.04.png |
| 14 | c / d | prores / h264 | konec | zvuk je kratší než obraz | 31,12 vs 31,16 s; 27,58 vs 27,64 s | 1 | m-c.log, ffmpeg počet vzorků |
| 15 | c | prores | 8,64 | chyba přepisu je vypálená v obraze: „formu **rakovy**“ (Whisper slyší „rakovin“), „doposavať“ | – | 1 | titulky-vs-whisper.txt |

## V pořádku (změřeno)
- **Kontejnery a kodeky:**
  - H.264 High, `avc1`, faststart (moov před mdat), I-snímek na každém úseku.
  - H.265 Main s `hvc1` (přehraje i Apple).
  - ProRes 422 HQ `apch`, 10 bit 4:2:2, `apl0` (a `prores` = `Standard`).
  - XDCAM: mpeg2video 4:2:2, **50,00 Mb/s**, 1920×1080p25, GOP 12 IBB uzavřené. MXF **OP1a** (UL …0d010201.01010900), kódování 422P@HL Long GOP, zvuk AES3 24 bit / 48 kHz.
  - DNxHR HQ v MXF OP1a (VC-3).
  - Všechny formáty mají značky **`color_range=tv, bt709`** (na webu `unknown`).
- **Jas:** export = 1,000·zdroj + 0,0 (a), 0,98–0,99 ve výřezech. MXF a H.265 jsou totožné s H.264.
- **Obraz:**
  - Žádné kostičky ani špičky (chyba snímku je nejvýš 1,6× medián, kromě nálezu 3).
  - 0 černých snímků mimo stmívačku.
  - Střihy kamer ve výřezech b/c/d jsou přesně na snímek (b 1,36 / 3,48 / 15,12, c 7,16 / 11,12 / 28,24).
  - Prázdný výřez s člověkem ve zdroji 0× v 464 kontrolovaných snímcích.
- **Přechody (e):**
  - Cross Dissolve 1,56–2,56 s je lineární (jas 122 → 90,6, krok 1,2/snímek, bez skoku).
  - Dip to Black: 12 snímků dolů, 1 černý snímek (Y = 16), 12 nahoru, plynule.
  - MXF i MP4 vypadají stejně.
- **Zvuk:**
  - A/V sync 0,0 ms ve všech 16 klipech (korelace 0,97–1,0).
  - Cvaknutí na střizích 0× (skok 0,00× p99,5).
  - True peak ≤ −1,4 dBTP (na webu −0,9).
  - c 18,76 „neslyšela“ je celé.
  - Délky H.264/H.265/ProRes jsou přesně podle sekvence.
- **Titulky:**
  - První slovo „Nebyla“ v d je (regrese z r8 N1 tu není).
  - Nadpis 9:16 od 12,7 %, titulky 62,8–70,1 % výšky, x 233–845 (mimo sloupec tlačítek).
  - Žádný skutečný překryv s obličejem (b 8,5 s je falešná detekce na hrudi, `b-8.5.png`).

## Standalone vs web (r8)
| | web r8 | standalone S1 |
|---|---|---|
| zbytek cizího záběru na začátku klipu | 0 (a/b), d 10 snímků na konci | **7 snímků moderátorky v a, b, d** (horší) + 5 snímků celku na konci d, e |
| barvy / značky | 0,98·zdroj, `unknown` | **1,000·zdroj, tv/bt709** (lepší) |
| střih kamery ve výřezu | na snímek | na snímek |
| hlasitost sítě | −14,0, TP −0,9 až −1,1 | −13,4 až −13,6, TP −1,4 až −1,5 |
| útržky slov na krajích | „tak dále.“, „nikdo jsme ne-“ (c) | „dále.“ neslyšet a c je celé (lepší); nově „Že…“ (d), „-kla“ (e), „-at“ (a) |
| zpoždění titulků | +0,63 s | +0,32 (a), ale +0,91 (d) |
| formáty | jen MP4 | + H.265, ProRes, XDCAM, DNxHR (nové vady jen v MXF) |

Úplně bez chyby jsou kontejnery H.264, H.265 a ProRes. MXF mají vady 3–5 a 7–9.
