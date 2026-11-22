# Kolo S3 – Kontrolor výstupu: „Je výstup po opravách S2 bezchybný pro diváka?“

**Skoro. Opravy z S2 platí:**
- titulky už neberou slova ze sousedního úseku („dále.“, „poprat“, „že“ zmizely, ve 9:16 už není 4snímkový titulek na začátku),
- 4 snímky celku za #219 v upoutávce jsou pryč (16:9 i 9:16),
- `export_sequence` přes MCP vypálí titulky a 9:16 srovná na −13,9 LUFS.

Divák ale pořád uvidí nebo uslyší tři věci:
- **9:16 titulky na střihu uprostřed řeči**: titulek s 0,34 s a pak 1,25 s řeči bez titulku,
- **úlomek „Tak“** na začátku #22 v upoutávce,
- **5 snímků celku na konci sekvence** (beze změny od S1).

Jak jsem testoval:
- Instance `standalone.js start 9372 %TEMP%\pz-s3-vystup --size 1600x900 --lang cs --ai`, na konci `stop 9372`.
- Most 7880 patřil mé instanci (PID 59280 → rodič electron `--remote-debugging-port=9372`; redaktorka měla 7890). Před každou sérií MCP jsem zavolal `premiere_status` = `PZ AI Cut Standalone` a ověřil, že aktivní sekvence je moje (`s3-sim916`, `S3V upoutavka`).
- Import obou zdrojů přes `TN.app.importPaths`. Přepis byl v mezipaměti Workeru (done hned).
- Scény z S2 jsem postavil přes `TN.app.api.buildSequence` (`audioFades: 2` jako MCP) a `api.reframeSequence`. Postavil jsem a 16:9, b 9:16, d 1:1, e 16:9, a1080/e1080 a Šimkovou `s3-sim` 16:9 a `s3-sim916` (`build.js`, `b1080.js`).
- **Titulky jsem dělal dialogem** `TN.app.cmd('captionsFromTranscript')` → klik „Vytvořit titulky“ zvlášť na každé sekvenci (`01-titulky-dialog-a.png`).
- Upoutávka přes MCP (`mcp.js`, PMCP_PORT=7880): `build_sequence_from_transcript` (picks 211, 219, 189, 190, 48, 49, 22, `sceneCuts: true`), pak `reframe_sequence` 9:16 `slower`, `add_captions` a `export_sequence` (`m1`–`m3*.log`).
- Ostatní exporty jsem dělal pomůckou `exporter.exportSequence` místo dialogu. Dialog Export jsem otevřel a nasnímal (`02`, `03`).
- 15 exportů je ve `web/test-out/vystup-s3-*`.
- Měření skripty z S2 (`zabery`, `whisper_s2`, `titulky`, `titulky_rms`, `sync_*`, `cvak`, `hranice`), dál ebur128 a ffprobe. Hermes jsem nespouštěl.

## Tři nejdůležitější nálezy
1. **9:16 titulky z přepisu: na střihu v souvislé řeči vznikne titulek 0,34 s se slovy z dalšího úseku a pak 1,25 s řeči bez titulku (3).**
   - Kde: `s3-sim916` (Šimková 25:44,4–26:14,2 + 26:36,0–26:52,1), střih 29,80.
   - Titulek #16 „**prostě. Ale my / nepotřebujeme**“ je na obraze 29,46–29,80. To je 0,34 s, tedy pod limitem 0,7 s.
   - Whisper v exportu: „prostě,“ 29,38–29,84, „ale“ 29,86, „my“ 30,30, „nepotřebujeme“ ~30,5–31,0.
   - Divák tedy čte „Ale my nepotřebujeme“ dřív, než to zazní, a když to zazní (29,80–31,05), titulek žádný není. Další titulek „prostě někoho…“ začne až 31,05.
   - Stejná sekvence v 16:9 je správně: „…něco. prostě.“ do 29,80, „Ale my nepotřebujeme…“ od 29,99.
   - Druhá cesta: Auto Reframe sekvence, která už titulky má (přeskládání), dá samostatný titulek „**prostě.**“ 29,46–29,85 = 0,39 s. Slova sedí, ale je to krátký záblesk pod limitem 0,7 s (2).
   - Kroky: sekvence ze dvou úseků výše → `api.reframeSequence` 9:16 → Sekvence → Titulky → Vytvořit titulky z přepisu → Vytvořit titulky. Ve scénách z vyrez-5min to nenastalo, protože tam střihy padnou do pauzy.
   - Důkaz: `sim916-titulek-29.5-30.2-30.8-31.2.png` (29,5 s titulek, 30,2 a 30,8 s bez titulku, 31,2 s další), `sim916-titulek-29.6.png` (program monitor), `titulky-vs-whisper.txt` (sim916 #16), `sekvence.json`.
2. **Upoutávka: celek za #219 je pryč, úlomek „Tak“ na začátku #22 zůstal (2).**
   - **Opraveno:** 4 snímky celku za #219 už nejsou. Video #219 končí na 1264,96 (zvuk na 1265,12) a 4 snímky převzal další klip (video #189 od 1095,92, zvuk od 1096,08).
   - **Nový drobný nesoulad:** pod koncem slova „pryč.“ (5,20–5,36) je teď už další záběr Báry. V 9:16 detailu má zavřená ústa, dívá se dolů a začíná se usmívat (`up-upoutavka-916-sn126.png`, snímky 130–133). Nesoulad rtů je 0,16 s v nejcitlivějším místě upoutávky (2). V 16:9 je to polodetail, méně vidět.
   - **„Tak“:** hranice jsou stejné jako v S2. Úsek #22 začíná ve zdroji na 121,32, uvnitř „tak.“ (121,28–121,42, RMS −27 dB).
     - Whisper v obou exportech slyší „**Tak** vlastně jsem si pak uvědomila“ (15,74, p 0,23).
     - `build_sequence_from_transcript` nevrátil `edges`, takže agent se o úlomku nedozví.
     - Titulek „Tak“ správně nemá.
   - **Krátký záběr:** 11 snímků (3,36–3,80) detailu moderátorky na konci #211. Je to ta samá osoba, takže nejde o probliknutí cizího záběru. Je to jen rychlý střih, oprava ≤ 5 snímků na něj nemíří (1).
   - Výsledek má pořád 22,84 s (cíl „do 20 s“) a pořadí #219 → … → #22 („proto jsem se dostala na Novu“) dál svádí k falešné souvislosti. Pořadí vět bylo zadané, hodnotím jen výstup.
   - Důkaz: `zabery.txt`, `whisper.txt` (up169/up916, cut 15,64), `hranice-zdroj.txt` (t=121,32), `m1-build.log`, `up-upoutavka-916-sn80.png`.
3. **5 snímků celku na úplném konci sekvence (2) – beze změny od S1/S2.**
   - d 1:1 27,44–27,64 a e 16:9 / e1080 XDCAM 9,60–9,80.
   - Klip končí 185,16, střih kamery je 184,98 a v posledních 0,2 s doznívá „pryč.“ (do 185,12).
   - `buildSequence` vrátil u e `edgeShotsFixed: null`. Za posledním klipem není soused, který by snímky převzal.
   - Důkaz: `d-konec-sn684-690.png`, `e-konec-sn238-244.png`, `zabery.txt`.

## Nálezy
| # | výstup | čas | vada | naměřeno | záv. | důkaz |
|---|---|---|---|---|---|---|
| 1 | sim916 (dialog) | 29,46–31,05 | titulek 0,34 s se slovy dalšího úseku, pak 1,25 s řeči bez titulku | Whisper „ale“ 29,86, další titulek 31,05 | 3 | sim916-titulek-*.png, titulky-vs-whisper.txt |
| 2 | sim → 9:16 (přeskládání) | 29,46–29,85 | samostatný titulek „prostě.“ 0,39 s (< 0,7 s) | eval `rf.js` | 2 | rf.js (výstup v tomto reportu) |
| 3 | upoutávka 16:9 + 9:16 | 15,64 | úlomek „Tak“ na začátku #22, `edges` mlčí | Whisper p 0,23, zdroj RMS −27 dB na 121,32 | 2 | whisper.txt, hranice-zdroj.txt |
| 4 | upoutávka 9:16 | 5,20–5,36 | pod koncem „pryč.“ další záběr (zavřená ústa, úsměv) | 4 snímky, zvuk 1264,96–1265,12 | 2 | up-upoutavka-916-sn126.png |
| 5 | d, e, e1080 | konec | 5 snímků celku | střih kamery 184,98, Out 185,16 | 2 | d-/e-konec-*.png |
| 6 | upoutávka | 3,36–3,80 | 11 snímků detailu moderátorky (rychlý střih, ne cizí záběr) | střih kamery 0,44 s před koncem #211 | 1 | up-upoutavka-916-sn80.png |
| 7 | MCP `export_sequence` 16:9 | – | bez `loudness` zůstane 16:9 −28,6 LUFS. Podle popisu je to tak záměrně, dialog má pro 16:9 také „Vypnuto“. Agent dělající 16:9 „na sítě“ musí poslat `loudness: social` (pak −13,9) | ebur128 | 1 | m2/m3 log, 02-export-dialog-169.png |
| 8 | sítě (AAC) | konec | zvuk kratší o 60–80 ms (d 27,58/27,64, sim 45,84/45,92, up916 22,78/22,84). TV a 16:9 bez normalizace jsou přesné. Nezměněno ze S2 | dekódované vzorky | 1 | delka-zvuku.txt |
| 9 | MCP `add_captions` | – | hlásí „cues 8“, sekvence má 7 (16:9) / 14 (9:16). Nezměněno ze S2 | – | 1 | m2-reframe-export.log |
| 10 | d (ruční hranice z S1) | 0,00 | zvukový úlomek „Že“ (zdroj 127,36 uvnitř „že“ 127,24–127,56). Titulek ho teď správně nemá | Whisper „Že“ | 1 | whisper.txt, hranice-zdroj.txt |

## PŘED (S2) / PO (S3)
| oblast | S2 | S3 |
|---|---|---|
| titulek slova ze sousedního úseku | „dále.“ (a, a1080), samostatný 4snímkový „dále.“ v 9:16, „poprat“, „že“ | **žádné** v a, b, d, e, sim, upoutávce. 9:16 b začíná „A zjistilo“ 0,13 s |
| titulky kratší než 0,7 s | 0,13 s „dále.“ v 9:16 | **0,34 s v sim916** (nový případ na střihu v řeči, nález 1). Jinak nejkratší 0,74 / 0,80 / 0,85 / 0,90 s |
| slyšené slovo bez titulku | jen výplňová „jako/vlastně“ | výplně jako dřív, k tomu **„Ale my nepotřebujeme“ v sim916** (nález 1) |
| časování titulků (Whisper) | nástup −0,27 až +0,30 s | nástup −0,36 až +0,39 s (u první věty po pauze), konce ±0,2 s, sim 16:9 ±0,2 s |
| upoutávka: probliknutí za #219 | 4 snímky celku (5,20–5,36) | **0 snímků celku**. Místo nich 4 snímky dalšího záběru Báry pod koncem „pryč.“ (nález 4) |
| upoutávka: „Tak“ na začátku #22 | slyšet | **slyšet** (stejné hranice 121,32) |
| MCP export 9:16 | bez titulků, −30,1 LUFS | **titulky vypálené, −13,9 LUFS, TP −1,5 dBFS**. `srt: true` dá .srt, `format: dnxhr` dá MXF DNxHR 571/571 snímků −23,1 LUFS |
| konec sekvence | 5 snímků celku d, e | **5 snímků d, e, e1080** (nezměněno) |
| probliknutí uprostřed | 0 | **0**: a, b, a1080 XDCAM, sim, sim916 (zabery.txt) |
| A/V sync | 0 snímků, 0,0 ms | **0 snímků** (a, a1080 XDCAM, e1080 XDCAM po klipech), **zvuk 0,0 ms r=1,00** (7 exportů) |
| hlasitost | sítě −13,9 až −14,0, TV −22,9 až −23,3 | **sítě −13,9 až −14,0 (TP −1,5), TV −22,9 / −23,0 / −23,4 / −23,4** (MXF stereo) a −22,9 (MP4 TV) |
| MXF počty snímků | 400/400, 245/245, 691/691 | **400/400 (XDCAM i DNxHR), 245/245, 691/691, 571/571** |
| cvaknutí na střihu | 6,1× p99,5 (bez prolnutí) | **0** (stavěno s `audioFades: 2`, tedy jako MCP) |
| dialog Export | 16:9 výchozí „Vypnuto“ | beze změny. 9:16 → −14 LUFS, titulky vypálit + .srt zaškrtnuté |

**Bez chyby:**
- H.264 a MXF: počty snímků, sync, barvy, hlasitost.
- Titulky v 16:9 a ve 4 scénách z vyrez-5min.
- Výřez 9:16: obličej v záběru, titulky vypálené (`up916-titulky-1-6-16.png`).

**Zbývá:**
- 9:16 titulky na střihu v souvislé řeči (nález 1–2),
- „Tak“ na začátku #22 a nehlášené `edges`,
- 5 snímků na konci sekvence,
- drobnosti 6–10.

Skripty a data: `team\v2\s3\vystup\` (evf.js = eval souboru v instanci, build/b1080/capdlg/capok/exp/rf.js, mcp.js, měřicí *.py, *.txt, sekvence.json, whisper.json).
Exporty: `web\test-out\vystup-s3-{a,b,d,e,sim,sim916,sim-tv,upoutavka-169,upoutavka-916,upoutavka-169-social}.mp4`, `vystup-s3-{d,a1080-xdcam,a1080-dnxhr,e1080-xdcam,upoutavka-169}.mxf`.
