# Kolo 8 – Kontrolor výstupu: „Je hotové MP4 bezchybné pro diváka?“

**Obraz skoro ano, zvuk a titulky na krajích klipů zatím ne.** Verze `app.js?v=mws68wvn`. Znovu jsem postavil a)–d) přesně jako
v kole 7 (stejné věty, formáty i nadpisy, `__pzDev.tools.*`, výřez importovaný jako `vyrez-r8.mp4`). Exporty jsou
`web/test-out/vystup-r8-{a,b,c,d}.mp4` a k tomu nový výstup **e** (1:1, 41 s, 3 úseky z celého 28min rozhovoru, přepis v prohlížeči
trval asi 13 min). Měřil jsem stejnými skripty jako v kole 7, upravené verze jsou v `team/v2/r8/vystup/`.

## Tři nejdůležitější nálezy
1. **Zvukové kraje klipů se nezměnily, protože audio stopa je do milisekundy stejná jako v kole 7.** Pořád slyšíme útržky
   cizích vět a useknutá slova:
   - c 18,84 s: „nikdo jsme ne-“, RMS posledních 10 ms −17,6 dB,
   - a/b začínají útržkem „(tak) dále.“, Whisper slyší „tak dále.“ v 0,02–0,46 s,
   - a/b 12,84 s: ťuk „T“, −26,7 dB,
   - a/b konec: „životě“ je useknuté 20 ms před koncem slova.

   Stejný vzor je i v novém **e**:
   - 7,32 s: náběh „A“ z další věty zdroje („A my jsme…“, 687,34 s) se utne. Obálka stoupá z −42 na −24 dB a na střihu spadne.
   - konec 41,16 s: Out 942,64 je 20 ms před koncem slova „pozici“.

   Titulky se zlepšily: „Nikdo“ ani „To“ už v nich nejsou.
2. **Nová regrese v titulcích: v (d) chybí první slovo „Nebyla“.** Zazní v 0,33–0,60 s (−9 dB, Whisper ho slyší jako „Nebyla“),
   ale první titulek začíná až v 0,81 s textem „možnost se připravit…“. V kole 7 začínal v 0,10 s slovem „Nebyla“. Divák tak první
   slovo háku slyší, ale nevidí ho, a titulek se ukáže o 0,7 s později. Chybí ve verzi 16:9 `vystup-r8-d` i v 1:1.
   Pravděpodobně to způsobila oprava kraje přes `pauseBoundary` / `dropEdgeFragments` z kola 7. → `b-11-2.5-d0.3.png` (vpravo,
   0,3 s bez titulku)
3. **Obraz je opravený.** Žádný rozpad do kostiček, žádné probliknutí cizího záběru a všechny střihy kamer ve výřezech sedí na snímek.
   Chyba snímku proti zdroji nikde nepřekročí 1,4× medián (v kole 7 to bylo 9,3 proti 3,4). Ve 4 exportech je 11 ze 11 střihů kamer
   ve výřezu přesně na snímek (v kole 7 bylo 6 z 9 o snímek pozdě). Rozsah jasu odpovídá zdroji (sklon 0,98, v kole 7 1,16).

   Vedlejší efekt opravy zbytků záběru: v a/b 3,20–3,60 s pokračuje obraz minulého klipu (zdroj 107,44–107,84) pod novým zvukem
   „Takže“ (115,2 s). Je to detail s pohybem úst, takže 0,27 s řeči nesedí na rty. → `a-snimky-3.12-3.68.png`

## Kolo 7 → kolo 8 (stejné výstupy, stejná měření)
| # r7 | nález | r7 | r8 | stav |
|---|---|---|---|---|
| 1 | rozpad obrazu po střihu (b 15,04 s) | chyba 9,3 / medián 3,4; I-snímek jen po 2 s | max 4,8 / medián 3,46 (b), žádný snímek > 1,6× medián (a–e); I-snímek na každém střihu kromě c 18,84 (I v 18,80, P-snímek bez viditelné chyby: 2,45) | **opraveno** |
| 2 | rozpad obrazu v 16:9 (a 7,60 s) | 6,4 / 3,0 | max 3,10 / 2,77 | **opraveno** |
| 3 | 2 snímky moderátorky v 16:9 (a 7,52 s) | 0,08 s cizího záběru | klip začíná ve 7,60 (In 145,96), krátké záběry: 0 | **opraveno** (vedlejší efekt viz nález 3 výš) |
| 4 | c 18,84: useknuté „nikdo jsme ne-“ | RMS −17,6 dB | −17,6 dB, Out 85,88 beze změny | stejné (ve zvuku); titulek už „Nikdo“ nemá |
| 5 | a/b: útržek „(tak) dále.“ na začátku | In 104,24 | In 104,24, titulek „dále.“ | stejné |
| 6 | a/b 12,84: ťuk „T“ + titulek „To“ | −26,7 dB | −26,7 dB; titulek „A byla to…“ (12,91 s) | **lepší** (titulek opraven, zvuk stejný) |
| 7 | a/b konec „životě“ useknuté | Out 20 ms před koncem | stejné | stejné |
| 8 | řez Reframe o 1 snímek pozdě | 6 z 9 +40 ms | 0 z 7 (b 1,72 / 15,00; c 6,84 / 10,80 / 28,28 / 34,00; d 26,00) | **opraveno** |
| 9 | zbytky záběru 0,36–0,40 s | b 3,20–3,60; d 26,04–26,40 | b zmizel; **d 26,00–26,40 = 10 snímků celku na konci videu zůstává** | lepší (1 ze 2) |
| 10 | rozsah jasu | exp = 1,16·zdroj − 18,5; Y p1/p99 24/223 vs 37/208 | exp = 0,98·zdroj + 4,2; 38/210 vs 36/208; odchylka 5,5 → 2,5 | **opraveno** (značka `color_range` pořád `unknown`) |
| 11 | titulek o 0,63 s později („protože“) | a, b, d | a +0,63, d +0,63; b „moje máma“ ~+0,6 | stejné |
| 12 | slova v titulku, která nezazní celá | „Nikdo“, „To“ | odstraněna | **opraveno** |
| 13 | true peak > −1 dBTP | c −0,9 | a −1,1 · b −1,1 · **c −0,9** · d −1,0 · e −1,0; všechny −14,0 LUFS | stejné |
| 14 | 9:16 titulky ve sloupci tlačítek / dolních 35 % | x do 950, spodek 1345 px | x 199–878 (**mimo sloupec**), spodek 1327–1345 px (70 %) = 2. řádek stále v dolních 35 % | lepší |
| – | 9:16 nadpis ≤ 2 řádky | – | 2 řádky, y 248–431 px | splněno |
| 15 | chybějící slyšená slova v titulcích | té, už, já, to | té, už, já, to (beze změny) + **„Nebyla“ (d)** | horší (nález 2) |
| 16 | d 25,12: skok ruchu −28 → −51 dB | – | −28 → −51 dB | stejné |

V pořádku (měřeno): A/V sync zvuku 0,0 ms ve všech 16 klipech (korelace 0,999–1,0). Obraz 16:9 sedí se zdrojem (352/396 posun 0,
zbytek jsou statické snímky s rozdílem ≤ 0,29). Černé snímky 0. Cvaknutí 0 (skok vzorku 0,00–0,01× p99,5). Prázdný výřez s člověkem
ve zdroji 0× v 705 kontrolovaných snímcích (c 31,28 s je falešný poplach, profil). Překryv titulků s obličejem 0×.

## Nové nálezy
| # | výstup | čas | vada | naměřeno | záv. | důkaz |
|---|---|---|---|---|---|---|
| N1 | d (16:9 i 1:1) | 0,00–0,81 | chybí první slovo „Nebyla“, první titulek až v 0,81 s (regrese) | řeč od 0,33 s, −9 dB; titulek 0 = „možnost se připravit“ | 2 | b-11-2.5-d0.3.png, titulky-vs-whisper.txt |
| N2 | e 1:1 | 7,14–7,32 | utnutý náběh „A“ z další věty na konci úseku | obálka −42 → −24 dB, na střihu −28/−41; zdroj „A“ 687,34–687,64, Out 687,52 | 2 | obalka-e.txt, whisper-e.json |
| N3 | a, b | 3,20–3,60 | obraz minulého klipu (detail, ústa v pohybu) pod novou větou „Takže“ | video Out 107,84 vs audio Out 107,44; 0,27 s řeči | 2 | a-snimky-3.12-3.68.png |
| N4 | e 1:1 | 41,12–41,16 | konec „pozici“ useknutý | Out 942,64, slovo do 942,66 | 1 | whisper-e.json |
| N5 | e 1:1 | 21,24 / 11,19 | chyba přepisu se vypálí do obrazu: „do **spravodajství**“, „najednou **zapravo**“ | Whisper large-v3: „spravodajství“, „Zapravo“ – nejasná výslovnost; hlášeno jako vypálený text, ne jako jistá chyba | 1 | titulky-vs-whisper-e.txt |
| N6 | b 9:16 | detaily (např. 11,0 s) | 2řádkový nadpis leží na vlasech/temeni hlavy v detailu | nadpis y 248–431, obličej YuNet od y 341 | 1 | b-11-2.5-d0.3.png |

**Nový výstup e** (1:1, 1080², 41,16 s, věty 183–185 / 193–195 / 246–250 z celého rozhovoru, nadpis „Ze snídaně rovnou do zpráv“):
- obraz: 4 ze 4 střihů kamer ve výřezu přesně na snímek (zdroj 680,84 / 685,52 / 720,72 / 922,56), chyba snímku medián 3,63 bez
  špiček, prázdný výřez 0 z 242 snímků, nejkratší záběr 0,64 s,
- jas: 0,975·zdroj + 4,6,
- zvuk: −14,0 LUFS, true peak −1,0 dBTP, sync 0,0 ms; vady N2 a N4,
- titulky: 15, výška 84–93 %, žádný překryv s obličejem.

**Pozor na měření (pro ostatní role):** celý 28min zdroj má klíčové snímky po 4–10 s a `ffmpeg -ss X -i` v něm skočí na **další**
klíčový snímek. Například 920,12 s dekóduje jako 922,56 s a ukáže jiný záběr. Proto byla moje první měření (e) falešně „špatný obraz,
chyba 41,8“. Skripty proto mají `PREROLL=12` (hledá 12 s předem a pak dekóduje). Aplikace sama dekóduje správně.

## Jak zopakovat
- Chrome `--remote-debugging-port=9372 --user-data-dir=%TEMP%\pz-r7-vystup`, import výřezu jako `vyrez-r8.mp4`, celého rozhovoru
  jako `talk-full-r8.mp4`.
- Stavba a)–d): stejné volání jako v kole 7, jen se jménem `vystup-r8-*`.
- Stavba e): `build_sequence_from_transcript({source:'talk-full-r8.mp4',picks:[183,184,185,193,194,195,246,247,248,249,250],name:'vystup-r8-e',format:'1:1',captions:true})`,
  pak `set_title(…'Ze snídaně rovnou do zpráv')`.
- Export: `__pzDevExport({name,burn:true,loudness:'social'})`. Stav sekvencí: `r8/vystup/sekvence.json`.
- Skripty v `r8/vystup/`:
  - `mereni.py`, `artefakty.py` (bez přepočtu rozsahu, export je teď TV rozsah), `whisper_cuts.py`, `titulky.py`, `obalka.py`,
    `zony.py`, `archy.sh`. Proměnné prostředí `SRC`, `PREROLL`, `JOBS`, `WOUT` slouží pro e.
  - nové: `luma.py` (rozsah jasu proti zdroji), `strihy_zdroj.py` (střihy kamer ve zdroji s náběhem), `citelne.py`.
