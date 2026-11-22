# Kolo S4 – Kontrolor výstupu: „Je výstup po nočních opravách bezchybný a nic se nezhoršilo?“

**Nic se nezhoršilo. Všechny regresní scény S2/S3 jsou stejné nebo lepší.**
- Konec sekvence už nemá cizí záběr.
- Titulek „Ale my nepotřebujeme“ v 9:16 sedí.
- MXF, A/V sync a hlasitost jsou beze změny přesné.

Bezchybné to ale není:
- **jednořádkové titulky v 9:16 bliknou** (15 titulků kratších než 0,7 s, nejkratší 5 snímků),
- **zopakované snímky na konci jsou vidět jako cuknutí** (ve 9:16 s posunem výřezu o 23 px),
- **zbytek 6–12 snímků na konci, pod kterým se mluví, zůstává** (8 snímků celku).

Jak jsem testoval:
- Instance `standalone.js start 9372 %TEMP%\pz-s4-vystup --size 1600x900 --lang cs --ai`, na konci `stop 9372`.
- MCP ani AI panel jsem nepoužil.
- Import přes `TN.app.importPaths`. Sekvence jsem stavěl přes `TN.app.api.buildSequence` (`audioFades: 2`) a `api.reframeSequence`.
- Titulky jsem dělal **dialogem** Sekvence → Titulky → Vytvořit titulky z přepisu (klik na „Vytvořit titulky“).
- Jeden řádek jsem nastavil **oknem Text v obraze** (klik Řádky = 1), viz `10`–`14`.
- Exporty jsem dělal pomůckou `exporter.exportSequence` místo dialogu: 32 souborů `web/test-out/vystup-s4-*`, včetně 6 verzí `*-bez.mp4` bez titulků pro masku textu.
- Měření (skripty z S3 + nové v `s4/vystup/`):
  - `srcstrihy.py`: střihy kamery v celém 28min zdroji,
  - `skok.py` a `posun.py`: skok obrazu a posun výřezu na konci,
  - `pretek.py`: šířka a řádky titulků, maska = export s titulky − bez titulků,
  - `dlazdice.py` a `usta.py`: snímky,
  - `shoda.py`: snímek exportu proti zdroji,
  - Whisper large-v3 int8_float16 a ebur128.

## Tři nejdůležitější nálezy
1. **Jednořádkové titulky ve 9:16 bliknou: 15 ze 46 titulků je kratších než 0,7 s (3).**
   - **Dialog** (`s4-L1dlg916`): Text v obraze → 1 řádek a pak Vytvořit titulky. Dialog správně hlásí „Vzhled podle formátu: 1 řádek, 30 % od spodu“.
     - Výsledek: 46 titulků po max. 20 znacích, všechny opravdu 1 řádek.
     - Krátké titulky: „dlouho“ **0,20 s (5 snímků)**, „kouknem“ 0,24 s, „prostě.“ 0,34 s, „jenom toho“ 0,36 s, „Bych jako“ 0,50 s a další.
     - Na snímcích je „dlouho“ vidět 5 snímků (`L1dlg916-titulek-dlouho-sn513-522.png`).
   - **Přepnutí na 1 řádek u hotových titulků** (`s4-L1post916`): totéž (15×). Navíc „prostě.“ běží 29,456–29,90, tedy 0,10 s přes střih 29,80 do další repliky.
   - **API `addCaptions {lines:1}`** (= MCP `add_captions`): 10× pod 0,7 s, nejkratší „Ale my“ 0,32 s. Časy slov se tu odhadují ze SRT, proto je titulek proti řeči −0,3 s a slova „komu“, „tak“, „se“ a „něco jako“ padnou do sousedního titulku (`titulky-vs-whisper.txt`).
   - **16:9 a 1:1 s jedním řádkem jsou v pořádku**: 0 titulků pod 0,7 s.
   - **Přetečení nikde:** text je v 9:16 v rozmezí 20,8–79,1 % šířky (bezpečné pásmo 16–84 %), v 16:9 28,7–71,4 % a 33,4–66,4 %. Maska ukazuje ve všech 6 exportech 1 řádek (`pretek.txt`).
   - Pravděpodobná příčina: pravidlo „< 0,7 s připojit k předchozímu“ v `captionlayout.layout` krok 4 se při 20 znacích na jeden řádek nevejde (`fits`) a převzetí slov také ne.
2. **Konec sekvence #219: cizí celek je pryč. 4 zopakované snímky detailu jsou ale vidět jako cuknutí (2 v 9:16, 1 v 16:9).**
   - Sekvence `s4-k219a` (jen #219, 1263,60–1265,12) a `s4-k219b` (#218 + #219) končí klipem 1264,80–1264,96. Pod ním je zvuk 1264,96–1265,12, tedy konec „pryč.“ (`sekvence.json`).
   - **Celek ve výstupu není** v 16:9, 9:16 ani 1:1. Snímky 74–77 odpovídají zdroji 1264,80–1264,92, posun 0 (`sync.txt`, `k219b-169-sn66-77.png`).
   - **Rty:** na sn. 73 má Bára ústa skoro zavřená. Na sn. 74 je má zase otevřená (jako na sn. 70) a na sn. 75–77 je zavírá znovu (`k219b-169-oblicej-sn70-77.png`). Obraz je pod koncem slova o 4 snímky pozadu.
   - **Skok obrazu:** rozdíl snímků 73→74 v oblasti obličeje je 9,6, kolem je 3,0–5,8 (16:9). Ve 9:16 je to 13,7 a v 1:1 12,2.
   - **Posun výřezu:** zopakovaný kus je samostatný klip s vlastním výřezem. Ve 9:16 obraz poskočí o **+23 px**, v 1:1 o +14 px, v d 1:1 o +8 px. V 16:9 o 0 px (`posun.py`, `k219b-916-oblicej-sn70-77.png`).
   - Je to 0,16 s na posledním slově. Je to výrazně méně rušivé než 4 snímky celku v S3, ale pozorné oko vidí „cuknutí hlavy“ a ve smyčce Reels je to poslední obraz.
   - Proč ne prodloužení: za „pryč.“ je na 1265,10–1265,40 nádech/„a“ (−40 dB, Whisper p 0,48) a od 1265,40 „já jsem“, takže `quietHead` správně odmítl.
   - Stejně skončí regresní d a e (5 snímků 184,76–184,96). `zabery.py` už nehlásí krátký záběr (d, e, e1080 XDCAM, d MXF).
3. **Zbytek 6–12 snímků na konci, pod kterým se dál mluví, zůstane (2).**
   - Případ: `s4-k30` (#30, 199,12–200,78) má střih kamery 200,48 a Out 200,80. Výsledkem je **8 snímků celku** na konci (`k30-169-sn30-41.png`, `zabery.txt`).
   - Za slovem pauza není: druhý mluvčí hned opakuje „Ty umělecké.“ (200,79–201,51, `hranice-zdroj.txt`).
   - Prodloužení tedy správně nejde. Zopakování snímků se ale dělá jen do 5 snímků, takže na 6–12 snímků nemíří nic. Je to stejný typ vady jako v S1–S3 (konec d/e), jen delší zbytek.

## Nálezy
| # | výstup | čas | vada | naměřeno | záv. | důkaz |
|---|---|---|---|---|---|---|
| 1 | L1dlg916, L1post916 (dialog / Text v obraze) | celé | 15 titulků < 0,7 s | min 0,20 s „dlouho“ (5 sn.) | 3 | titulky-delky.txt, L1dlg916-titulek-dlouho-*.png |
| 2 | L1api916, L1api916b (`addCaptions lines:1`) | celé | 10 titulků < 0,7 s, časy slov −0,3 s, slova v sousedním titulku | min 0,32 s „Ale my“ | 2 | l1-api.json, titulky-vs-whisper.txt |
| 3 | L1post916 | 29,46–29,90 | „prostě.“ 0,10 s přes střih | střih 29,80 | 1 | titulky-delky.txt |
| 4 | k219b 9:16 / 1:1, d 1:1 | posl. 4–5 sn. | zopakované snímky: ústa se znovu otevřou, výřez poskočí | +23 / +14 / +8 px, skok 13,7 vs 3,9 | 2 | k219b-916-*.png, posun.py |
| 5 | k219a/b 16:9, e, e1080 | posl. 4–5 sn. | zopakované snímky, cuknutí rtů (bez posunu) | skok 9,6 vs 3,0 | 1 | k219b-169-oblicej-*.png |
| 6 | k30 | 1,36–1,68 | 8 snímků celku na konci (řeč pokračuje, > 5 sn.) | střih 200,48, Out 200,80 | 2 | k30-169-sn30-41.png |
| 7 | L1api169 (`charsPerLine 30`) | 27,50 | řádek končí předložkou „…chytne vás za“ | – | 1 | l1-api.json |
| 8 | sítě (AAC) | konec | zvuk kratší o 80 ms. Nezměněno ze S2/S3 | d 27,58/27,64, sim916 45,84/45,92, k219b 3,04/3,12 | 1 | delka-zvuku.txt |
| 9 | k219a (1,52 s) | – | −16,4 LUFS (cíl −14). Klip je kratší než 3 s, nereálné | ebur128 | 1 | hlasitost-ffprobe.txt |
| – | vedlejší (UI) | – | AI panel ukazuje „Aktivní sekvence S4-L1POST169TMP“, i když je otevřená s4-L1dlg916 (naposledy vytvořená přes API). Pro roli AI tok | – | ? | 11-dialog-titulky-1radek-916.png |

## PŘED (S3) / PO (S4)
| oblast | S3 | S4 |
|---|---|---|
| probliknutí uprostřed | 0 | **0**: a, b, c, d, e, sim, sim916, sim11, a1080 XDCAM, d MXF |
| konec sekvence (řeč pod zbytkem, ≤ 5 sn.) | 5 sn. celku d, e, e1080. Upoutávka 4 sn. | **0 sn. cizího záběru.** Zopakované snímky detailu = cuknutí (nález 2) |
| konec sekvence s pauzou za slovem | – | **prodlouženo**: k138 Out 753,32 → 753,68, poslední záběr 15 sn. (0,60 s), ticho −63 až −69 dB, zavřená ústa (`k138-169-sn86-103.png`). Ve 9:16 stejně |
| konec, zbytek 6–12 sn. + řeč | (nebylo testováno) | **8 sn. celku** (nález 3) |
| titulek ze sousedního úseku | žádný | **žádný** (a, b, c, d, e, sim, sim916, sim11, k219b, k138) |
| titulek < 0,7 s (2 řádky) | 0,34 s „prostě. Ale my“ (sim916), 0,39 s po přeskládání | **žádný** ve 12 sekvencích. sim916: „něco. prostě.“ 29,00–29,80, „Ale my / nepotřebujeme“ od 29,99. Přeskládaná kopie bez krátkého titulku |
| titulek < 0,7 s (1 řádek) | – | **9:16: 15× (dialog), 10× (API)**. 16:9 0× (nález 1) |
| za střihem chybí titulek | 1,25 s (sim916) | **nic**. Chybí jen výplně „jako, vlastně, že, jak“ (záměrně) |
| `add_captions lines:1` | ignorováno, „cues 12“ × 10 | **1 řádek**, počet hlášen správně (46 = 46, 27 = 27). Platí i u sekvence se stylem 2 řádky |
| přetečení textu | – | **žádné** (20,8–79,1 % ve 9:16) |
| úlomky slov na střizích | „Tak“ #22, „Že“ d | **beze změny** (stejné ruční hranice). d 0,00 „Že“ (Whisper „Děkujeme“). Jinak čisté |
| A/V sync | 0 sn., 0,0 ms | **0 sn.** po klipech (a, a1080 XDCAM, e, e1080 XDCAM, včetně zopakovaného klipu), **zvuk 0,0 ms r = 1,00** (7 exportů) |
| hlasitost | sítě −13,9 až −14,0, TV −22,9 až −23,4 | **sítě −13,9 až −14,0 (TP −1,5)**, **TV −22,9 / −23,4 / −23,4 / −23,0** |
| MXF snímky | 400/400, 245/245, 691/691 | **400/400 (XDCAM i DNxHR), 245/245, 691/691** |
| cvaknutí na střihu | 0 | **0** (a, sim, k219b) |

Důkazy a skripty: `team\v2\s4\vystup\`. Data: `sekvence.json`, `whisper.json`/`.txt`, `zabery.txt`, `sync.txt`, `pretek.txt`, `titulky-delky.txt`, `titulky-vs-whisper.txt`, `l1-*.json`, `hlasitost-ffprobe.txt`. Snímky: `10`–`14`, `k219b-*`, `k138-*`, `k30-*`, `L1dlg916-*`, `zdroj-*`.
Exporty: `web\test-out\vystup-s4-*.mp4|.mxf`.
Pozor: `s3/vystup` nemá vlastní dlaždicový skript. V S4 jsem zjistil, že `select='gte(n\,N)'` předaný z Pythonu vracel snímky od 0, proto `dlazdice.py` a `usta.py` dekódují celý soubor a pak řežou.
