# Report – kolo 3: tester (střihač/redaktor TN)
(Uloženo vývojářem z textu agenta; zkráceno, všechny nálezy a čísla zachovány.)

2026-11-22, localhost:8791, prohlížeč Claude (1440×900, kontroly 1366×768 a 1040×1100), Šimková 28 min, bez AI, čistý projekt.
Vývojové nástroje: `__pzDevImport`, `__pzDevExport`, `build_sequence` (jen 86–100 s pro bod 7), čtení get_sequence/get_captions/get_transcript, JS měření.
Vlastní chyba: zpočátku psal hledaná slova do osy (špatné souřadnice) – ověřeno, že nic nezměnil; nález „Enter nehledá“ zahodil.

## Hlavní zjištění: testovací prohlížeč NEMĚL přesný přepis
Po importu „401 vět · standardní přepis“, i když menu ≡ mělo ✓ Přesné. IndexedDB jen whisper-small, Cache Storage jen whisper-small (252 MB),
localStorage stará `pzAsrQuality=standard`, `pzAsrQuality2` neexistuje. Tvrzení logu neplatí. (Díky tomu změřil skutečné první stažení.)

## Bod 1 – Reference a WER
Poslech nahrazen dvěma nezávislými lokálními modely mimo aplikaci (faster-whisper large-v3 celý vzorek i úseky kolem [?], NVIDIA Parakeet TDT 0.6B v3),
počtem slabik ze špiček hlasitosti a RMS. Soubory nepřepisoval.

Upravená `sample-1800.ref.txt`:
```
A ty jsi to zvládla a zvládáš to dál, i když si myslím, že ta ztráta a ta bolest a ta rána se nikdy vlastně nezahojí. Tady si myslím, že je strašně důležitý říct, když ty říkáš, ty jsi to zvládla a zvládáš to. Tady není jiná možnost. Ty nemáš v tu chvíli jako vlastně jinou možnost. Ty musíš to zvládnout. Co ti vlastně jako jinýho jako[?] zbývá? Jako co uděláš? Ty se z toho zhroutíš, ty se zabiješ, nebo jako co uděláš, prostě když přijde takováhle jako ztráta. Prostě to nejde. Ty musíš vlastně pokračovat dál, jako v tom svým životě. A hlavně furt vlastně myslíš jako na to, že přece ta máma by nechtěla, abych já jako skončila ten život. Aby jako tím, že ona už tady není, abych já jako přestala myslet na sebe. Prostě to období bylo strašně nečekaný, protože my jsme nikdo nevěděli, že ona je nemocná. Jí boleli záda dlouhou dobu, mysleli jsme si, že si to nějakým způsobem udělala jako mechanicky, že spadla, prostě že jí jako[?] boleli záda. Ona chodila na fyzioterapie, chodila na nejrůznější kontroly. Nikdo nic, prostě furt jako říkali, že ne, to přebolí, to přebolí. A vlastně po strašně dlouhé době a po strašně moc vyšetření, až když ona už vlastně opravdu jako nemohla ani chodit bolestí, zjistili teprve, že ona měla vzácnou formu rakoviny, jmenuje se to mnohočetný myelom, což je prostě věc, o který já jsem doposavad jako nikdy neslyšela. Nikdo jsme nevěděli, co to je, odkud to přišlo, proč to přišlo. Ale je to nemoc, kdy vlastně odumírají červené krvinky a množí se bílé krvinky a vlastně ti jako praskají kosti. A proto jí bolely ty[?] záda, protože ona už měla naprasklý žebra a tak dále. A zjistilo se to strašně, strašně pozdě. A vlastně jí hospitalizovali v nemocnici a za tři týdny vlastně byl konec. Za tři týdny. Takže to přišlo úplně, jak[?] my jsme se to dozvěděli, že je nemocná, a za tři týdny byla pryč.
```
Upravená `sample-2551.ref.txt`:
```
Tak neříkat tyhle fádní jako věci, čas[?] to zahojí. Je jí[?] teď líp, tak to mělo být. Tohle fakt nepomáhá. Prostě my ani nepotřebujeme nic slyšet. My potřebujeme jenom toho člověka, aby s náma byl. Aby, když se třeba dlouho neozýváme, aby zavolal a řekl: „Já jedu za tebou, já ti vezu jídlo, nebo prostě pojď“
```
Změny (výběr): „jsi“ (Parakeet + large-v3), „Co ti vlastně jako jinýho jako[?] zbývá?“, nová slova „prostě věc“, „vlastně odumírají“, „vlastně byl konec“,
„bolely ty[?] záda“; 2551: „Tak **neříkat**“ (3 modely, 16 slabik), „jako věci, čas[?] to zahojí“, „Je jí[?] teď líp“.

| Model | 18:00–20:00 stará ref. | **nová** | 25:51–26:10 stará | **nová** |
|---|---|---|---|---|
| Přesné (vzorek) | 6,4 % | **7,8 %** | 10,5 % | **7,1 %** |
| Přesné GPU | 11,0 % | 10,5 % | – | – |
| Standardní | 19,0 % | **20,2 %** | 26,3 % | **23,2 %** |
| **Přesné v aplikaci (celý 28min soubor)** | 8,0 % | **9,1 %** | 14,0 % | **10,7 %** |
Většina zbytku = vynechané výplně („jako“, „vlastně“). Viditelné chyby 18:00–20:00: „spráta“, „stráta“, „že ji povádala. Polizáda“, „doposávat“,
„rakovin“, „bolaly“, **chybí „pozdě“**. Výrok 18:16 v titulcích: **1 viditelná chyba** z ~48 („stráta“; dřív 6/48).
Titulky jako překážka: u 18:16 už ne (oprava 14 s); u 25:51 trochu. Hlavní překážka teď: **čas, než přesný přepis je**, a **slova vypadávající na krajích výroku**.

## Bod 2 – Přesný přepis
- První stažení (Přepsat přesněji… → „asi 13 min … Poprvé se stáhne asi 1 GB“): **1037 MB za 117 s**, „Stahuji… 507 z 1037 MB · jen jednou“ ✔,
  příprava 4 s, přepis 28:07 za **646 s = 10,8 min**, celkem **12,8 min** (odhad „13 min“ ✔); „Přepisuji přesněji… 22 % · zbývá asi 9 min · zatím platí dosavadní přepis“ ✔; hledání ve starém během přepisu ✔.
- Počítač: CPU **96 %** (~24 z 32 jader), stránka **4,8–5,4 GB RAM**, **RTX 4070 Ti nečinná** (3 %), `device: wasm`. Odhad notebook 4 vlákna / 8 GB ~1 h (neměřeno). **[3]**
- **Přesný přepis ztratil úvod**: „#1 [0.00–25.28] Krasný den, Kristi.“ místo úvodu moderátorky (standardní měl 7 vět). Jediná taková díra. **[2]**
- **Dlouhé věty** (#359 15,7 s) – výrok 25:51 nejde vybrat kliknutím na větu. **[2]**
- Druhé „Přepsat přesněji…“ (20s klip, model stažený): dialog slibuje „stáhne 1 GB“ a „asi 1 min“, skutečně **124 s „Příprava…“** + 11 s. **[2]**
- Slabý počítač (`__pzAsrWeak`): menu klipu bez „Přepsat přesněji…“, přepis Standardní, menu ≡ „Přesné – na tomto počítači nejde“ ✔; v panelu Přepis chybí věta proč. **[1]**

## Bod 3 – Seznam titulků (5 oprav klávesnicí: Titulky → Tab → ↓ → Enter → úprava → Enter)
„stráta“→„ztráta“ ~14 s; opravy 2–5 ~34 s; „Nevejde se… rozdělí se na 2 titulky“ ✔. Ctrl+F: „ztráta“ 1/1, „stráta“ Nenalezeno ✔; žádné „Tak Tak“ ✔;
v Přepisu velké písmeno uprostřed („…stalo, Tak neříkat…“) **[1]**. **Nahradit titulky**: opravy zůstaly ✔, ale **„Tak“ znovu vypadlo** **[2]**.
Ctrl+Z/Y ✔; po Ctrl+Z zůstane „Opraveno: 4 titulky“ **[1]**. Oprava přesunula „pojď,“ do další věty Přepisu **[1–2]**. AI nástroje čtou přepis bez oprav (info).

## Bod 4 – Hák, karaoke (5 výroků, −14 LUFS, RMS 30 ms, snímky po 0,1 s, kontrola exportu large-v3)
| Výrok | Ticho před | Doznění | Karaoke | Kraje / chybí |
|---|---|---|---|---|
| V1 18:16 | 0,15–0,18 ✔ | 0,26 ✔ | ✔ | ✔ |
| V2 25:51 (ruční In) | 0,13 ✔ | 0,08 ✔ | ✔ | ✘ **„Tak“ zazní 0,13–0,22 s, titulky „neříkat“** (i po Nahradit) |
| V3 20:58 | **0,00 – řeč hned** | 0,08 | ✔ | ✘ **hák začíná úlomkem „…vůbec“**, titulek „vůbec. My jsme“, bez varování |
| V4 23:23 | 0,18 ✔ | 0,24 ✔ | ✔ ±0,03 | ✔ |
| V5 19:59 | 0,18 ✔ | 0,25 ✔ | ✔ | ✘ **chybí poslední „to.“** (zazní 16,06 s, −28 dB) |
Karaoke všude ±0,1 s. Ticho/doznění 4/5.

## Bod 5 – Rozvržení
1366×768: osa 69 %, 14s sekvence 82 % osy, Přepis 202 px (při stahování 150 px), patička 739/768, export s Textem v obraze 0/10 překryto ✔.
1040×1100: seznam 309–330 px, patička 1071/1100, osa 60 % ✔; po zmenšení okna zůstane osa přiblížená **[1]**. Štítek „✓ Přepis“ otevře Přepis ✔. Tlačítko na kartě neověřeno.

## Bod 6 – Regrese z report-2
Text v obraze po Novém projektu ✔; stavový řádek a zadání AI ✔ (zůstala hláška „zadání počká“ **[1]**); „,“ tlačítkem ✔ (klávesu automat neumí);
Auto Reframe na 9:16 ✔ hláška; Enter ✔; „Bez názvu“ ✔; typy souborů ✔ (popis „PZ AI Cut project“ anglicky **[1]**); výchozí název sekvence „**Sequence**“ anglicky **[1]**.

## Bod 7 – Auto Reframe přes střih kamery 7,64 s
Rozříznuto 1,64 / 7,64 / 9,08 / 10,20 s (ffmpeg 1,60 / 7,64 / 9,04 / 10,16) ✔; obličej ve středové třetině 7,5/7,7/8,0 s ✔ (shots-3/r7_reframe_cuts_contact.jpg).

## Navíc
Opus v MP4 nemusí přijmout každá síť [1, info]; klik na větu nepřepne rám z Textu v obraze na Zdroj [1]; po prvním kliku se objeví patička a řádek pro
Shift+klik zmizí pod ni [1]; časový kód Zdroje nejde přepsat [1]; „Přichytit na začátek věty“ u slepené věty vede na 25:43 – špatná rada [1]; `__pzDevExport` bez přípony.

## Chyby (seřazeno)
1. [3] Přesný přepis jen na procesoru (10,8 min, 96 % CPU, 5 GB RAM, GPU nečinná).
2. [2] Vyslovené první slovo vypadne (V2 „Tak“), i po Nahradit titulky.
3. [2] Poslední vyslovené slovo vypadne (V5 „to.“).
4. [2] Hák začíná úlomkem předchozí věty bez varování (V3).
5. [2] Přesný přepis vynechal prvních 25 s.
6. [2] Druhé spuštění přesného na 20s klipu 2 min „Příprava…“, dialog slibuje 1 min a „stáhne 1 GB“.
7. [2] Testovací prohlížeč neměl přesný přepis ani model.
8. [1–2] Oprava přesunula „pojď,“ do sousední věty.
9. [1] Anglicky: „Sequence“, „PZ AI Cut project“.
10. [1] „Opraveno: 4“ po Ctrl+Z; hláška „zadání počká“ po Novém projektu; velká písmena uprostřed věty po opravě.

## Nápady
Přesný na grafice nebo Standardní hned + Přesný na pozadí s odhadem; na krajích výroku podle zvuku (zvuk zní → slovo nechat), varování „začíná bez pauzy“;
kontrola děr v přepisu; dělení dlouhých vět na čárkách/pauzách; přepisovatelný časový kód, klik na slovo = In/Out; název sekvence „<klip> 9x16“ česky.

## Soubory
shots-3: r2_* (import, dialog, průběh, slabý PC), r3_titulky_seznam_V1, r4_V1–V5 karaoke, r5 rozvržení, r6 regrese, r7_reframe_cuts_contact.
web/test-out (bez přípony): tester3-V1-18-16 … tester3-V5-19-59, tester3-reframe-86-100-9x16. V projektu zůstaly testovací sekvence T3 V1–V5.

## Shrnutí
Přesný model pomáhá (18:16: 1 chyba místo 6), opravy titulků rychlé (5 do 1 min), karaoke a hranice poprvé přesné, regrese opravené.
Největší problém: přesný přepis jen na procesoru (12,8 min s 1 GB stažením, GPU nečinná) a testovací prohlížeč ho neměl. Dál: slova na krajích vypadávají
(„Tak“, „to“), přesný přepis ztratil úvod a slepuje dlouhé věty.
