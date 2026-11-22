# Report testera – kolo 4 (PZ AI Cut, 127.0.0.1:8791, app.js?v=mwr84vf5)
(Uloženo vývojářem z textu agenta.)

Testoval jsem ve vlastním headless Chrome (CDP port 9361, vlastní profil v %TEMP%). Vestavěný prohlížeč jsem nepoužil, kód jsem neupravoval. Pracoval jsem s regress.js (8 i 4 CPU), edges.js (4 nové sady), s vlastním skriptem na nabídku „Přepsat přesněji“ (čistý profil, afinita 8 a 4 CPU) a s faster-whisper large-v3 + RMS na ručně vybraných krajích.

**Zkratky, které přiznávám:**
- Přesný přepis rozhovoru (`web/test-out/prepis-presny-po.json`) jsem do IndexedDB svého profilu vložil skriptem pod otiskem obsahu videu. Ušetřil jsem tím asi 11 min přepisu. Aplikace ho načetla jako uložený přepis a při načtení sama vyhodila halucinace: 450 vět, „vynecháno 2“.
- Dvě hraniční sekvence pro export jsem postavil přes `__pzDev.tools.build_sequence`, ne ručně.
- Všechno ostatní šlo cestou redaktora: klik, Shift+klik, „Vložit do nové sekvence“, „Titulky z přepisu“, klávesy v seznamu titulků.

**Přepsané soubory ve `web/test-out`:**
- `regress-4-8cpu.mp4`: přepsal ho můj průchod regress.js. Kopie vývojáře je v `regress-4-8cpu-vyvojar.mp4`.
- `vyrez-5min-standard.json`: znovu vytvořen, je bajtově shodný s původním. Záloha je v `-vyvojar4.json`.
- Kopie `nb-*-vyvojar4.json` jsou zbytečné, notebook.js jsem nespouštěl.

---

## Co se mi líbilo
- **Redaktorův výrok 23:20 je konečně čistý.** Klik na #363 a Shift+klik na #369 dají In 1399,76 s bez varování a 9 titulků. První je „Ale jako to uvědomění nekončí,“, poslední „A to se děje furt. Furt.“. V2 začíná „tak neříkat tyhle fádní věci,“ a V5 končí „…zvládnout to.“. Na zvuku jsem to ověřil: In leží v propadu −31 dB, rozhodčí slyší „ale“.
- **Nabídka „Přepsat přesněji“ je srozumitelná.** Je v jednom řádku s odhadem času a dialog říká „Poprvé se stáhne asi 1 GB – jen jednou“. Během přepisu svítí „zatím platí dosavadní přepis“, na konci přijde toast. Přesný přepis výřezu je znatelně lepší („takovou ránu“ místo „takovou eránu“, „před tímhle vším“ místo „levším“).
- **Odhad času přesného přepisu sedí.** Číslo ETA se od skutečnosti liší o ±5 % mezi 15 a 90 %.
- **Seznam titulků funguje.**
  - Delete smaže titulek a patička ukáže „Smazán titulek … [Vrátit]“.
  - Ctrl+Z i Ctrl+Y fungují pro smazání i pro opravu textu.
  - Enter uloží opravu a otevře další titulek, nápověda „Enter uloží a další · Esc zruší“ je vidět.
  - Oprava se propíše i do přepisu („opravy platí i v přepisu klipu“).
- **Hledání funguje.** „mama“ najde „máma“ (12×), vyhozená halucinace se nenajde, ukazuje „1 / 1“ a šipky.
- **Slabý počítač** dostane jasnou větu: „Na tomto počítači jde jen standardní přepis – přesný by tu trval příliš dlouho.“
- **Úvodní karta v Programu se při 1366×768 nikde neořízne**, celá i s tlačítkem „Panel AI“.
- **Klávesa `** (maximalizace panelu jako v Premiere) zvětší Přepis na 24 celých vět. Snímek t12.
- **Angličtina** neprosakuje do češtiny ani naopak (EN: „⚠ The start is in continuous speech…“, „2 omitted“).

## Co se mi nelíbilo / zdrželo (váha 1–3)
1. **(3) Druhý výrok vložený po titulcích rozbije sekvenci.** Podrobně v chybě B1. Tohle je přesně, co redaktor udělá („ještě přidám jednu odpověď“).
2. **(2) Kraje výroků nejsou hotové.** Na nových náhodných výrocích sedí v přesném přepisu jen 64 % začátků. Varování chytí polovinu špatných začátků a jen 3 ze 13 špatných konců. Navíc 8× varuje u začátku, který je v pořádku.
3. **(2) Přepis na notebooku po výběru ukáže 4 celé věty (1366×768)**, cíl je 8. Při psaní titulku mám před očima jen 4–5 vět kontextu.
4. **(2) „vynecháno 2“ je vidět jen v bublině nad polem hledání.** První „vynechaný“ úsek přitom obsahuje skutečnou řeč (chyba B6).
5. **(1) Text odhadu je pesimistický.** Píše „zbývá asi 3 min“, když zbývá 100 s, a „asi 2 min“, když zbývá 30–46 s. Nabídka na 4 CPU slibuje „asi 6 min“, skutečnost poprvé byla 7,2 min.
6. **(1) Po dokončení přepisu zůstane seznam odscrollovaný dole** (3:32–3:54), ne na začátku (rr-04-hotovo).
7. **(1) Shift+klik vystředí konec výběru**, takže začátek výběru (23:20) je mimo obrazovku (t02).
8. **(1) Tlačítko v dialogu „Přepsat přesněji?“ je modré**, všude jinde je hlavní tlačítko fialové.

## Chyby s kroky k zopakování

**B1 (3) – Vložení dalšího výroku po „Titulky z přepisu“ rozřízne první klip a nechá cizí titulek**
1. Přepis rozhovoru: klik na #317, Shift+klik na #320, Vložit do nové sekvence → OK.
2. Titulky z přepisu → Vytvořit titulky. Přehrávací hlava skočí na 0,20 s (jinde 0,04 nebo 0,32 s).
3. Klik na #412, Shift+klik na #415. Tlačítko se teď jmenuje **„Vložit do sekvence“** (vloží úsek na místo hlavy), klik.
4. Výsledek (t13):
   - Klipy: 0,00 s V5 1199,70–1199,90 (**0,20s útržek „My“**), 0,20 s V2 (19,88 s), 20,08 s zbytek V5.
   - Titulky: **první titulek V5 „My jsme vůbec neměli“ zůstal na 0,15–1,84 s, přes řeč V2**. Ostatní titulky V5 se posunuly o +19,88 s, V2 nemá žádné titulky.
5. Totéž se stalo s R + V2 + V5: útržky 0,32 s a 0,04 s na začátku (t05-*.png ukazují tuto rozbitou sekvenci „T4 R 23-20“).

Pro redaktora z toho plyne: novou sekvenci pro druhý výrok tlačítkem neudělá, nejdřív musí zavřít aktuální (Ctrl+W), a nic mu to neřekne.

**B2 (2) – Titulek vynechá první slovo vybrané věty, které v klipu celé zazní (bez varování)**
- Přesný přepis, věty #4–#6 („sedívává na tom místě…“) → In 21,30 s.
  - RMS: 150 ms ticho (−65 dBFS), pak slovo.
  - faster-whisper na [21,30–22,8]: „se dívává na tom místu“.
  - První titulek je ale „na tom místě, kde jsem teď já.“ (t16).
- Standardní výřez, věta „My jsme vlastně…“ (seed 31337 N14, In 119,71): zvuk „My jsme…“, titulek začíná „jsme“.

**B3 (2) – In o slovo dřív, v klipu zazní konec předchozí věty, titulek ho nemá a varování chybí**
- Přesný přepis, #131 sám („Protože ty opravdu píšeš 8 minutů…“) → In 500,18.
  - RMS: 60 ms −64 dBFS, pak řeč.
  - faster-whisper na [500,18–501,4]: „práce, protože ty opravdu…“.
  - Klip tedy začíná slovem „práce,“ z předchozí věty, titulek začíná „Protože“, varování žádné.
- Standardní výřez (seed 555 N14, In 81,55): navíc 0,6 s „což je prostě“, bez varování.

**B4 (2) – U varovaných začátků titulky obsahují slova, která v klipu nejsou**
- #14–#16 → In 50,10.
  - Široké okno: „Já se taky moc těším.“ 49,41–50,33.
  - RMS na In −31/−24 dB, uvnitř slova.
  - V klipu zazní jen „-ším“, první titulek je ale celé „Já se taky moc těším.“.
  - Varování se ukáže, titulky ale mají 4 cizí slova.
- Stejný typ: „obrečela,“ (In 928,52), „krásná.“ (In 16,51), konec „přesně,“ (Out 97,82, v klipu jen „p-“).

**B5 (2) – Varování na konci skoro nefunguje**
- Ze 13 konců, kde titulek nesedí se zvukem, se varování ukázalo jen u 3.
- Příklad: Out 404,23 je vprostřed tichší repliky „To je za mě | nic nebylo?“, varování žádné.

**B6 (2) – Vynechaná halucinace „www.hradeckralove.cz“ přikrývala skutečnou řeč**
- Úsek 0:00–0:08,6 je hudba a pod ní skutečný pozdrav moderátorky 6,1–9,2 s: „Přeji vám krásný den a jsem velmi ráda, že sledujete pořád Talk.“
- faster-whisper to slyší ve 3 různých oknech shodně, p ≥ 0,95.
- V přepisu zbylo jen „Talk.“ (0:09). Ten je tedy skutečný, ale 10 slov chybí a „vynecháno 2“ (jen v bublině) neříká, že tam může být řeč.
- Konec videa je v pořádku: 28:01–28:06 je opravdu hudba bez řeči.

**B7 (1)** – Standardní přepis výřezu nemá poslední slova „vlastně věci.“ (299,50–299,86 s). Přesný je má.

**B8 (1)** – Všechny exporty mají zvuk Opus o 20 ms delší než obraz (např. 16,000 / 16,020 s). Nejspíš neškodné, uvádím pro úplnost.

**Pro vývojáře (nástroj, ne aplikace):**
- regress.js ukládá stav „02-pripravuji“ ve chvíli „Stahuji … 1 z 1 MB / 3 z 3 MB“. Je to jiné stahování, ne příprava.
- CPU % v notebook.js i v mém skriptu vychází 107–124 %. Měřicí okno je delší než děleno 3 s, ve skutečnosti jde o 100 % povolených jader. Afinita platí (255 / 15).

## 1. Notebook (čistý profil, `__pzAsrSlow`, 5min výřez, první stažení)
| | 8 CPU | 4 CPU |
|---|---|---|
| stažení standardního modelu 240 MB | 32 s | 32 s |
| standardní přepis od importu | **141 s** (regress 140 s) | **164 s** (regress 163 s) |
| odhad během standardu | od 55 % „méně než minuta“, skutečnost 43 s ✔ | při 55 % „asi 2 min“, skutečnost 47 s (pesimistický) |
| nabídka | „Přepsat přesněji · asi 5 min“ | „· asi 6 min“ |
| skutečně klik → přesný hotov | **325 s = 5,4 min** (z toho 1 GB stahování ~125 s) | **434 s = 7,2 min** (stahování ~123 s) |
| import → přesný přepis celkem | **7,8 min** | **10,0 min** |
| číslo ETA přesného vs. skutečnost | 15–90 %: 0 až +8 % | 15–90 %: −4 až +10 % |
| CPU | plně vytížená povolená jádra | totéž |
| RAM (všechny procesy Chrome) | standard 1,9 GB, přesný 3,4–4,7 GB | 1,9 / 3,5–5,0 GB |

Přesný přepis výřezu má 69 vět. První věta „a ty jsi to zvládla…“ i poslední „…strašně moc vlastně věci,“ sedí se zvukem a nic se nevynechalo. Snímky jsou v `offer-8cpu/`, `offer-4cpu/` (01 nabídka, 02 dialog, 03 běží, 04 hotovo), data v `offer.json`.

## 2. Kraje výroků – nezávislé ověření
**Nové sady (edges.js, cache sdílená):**
- přesný přepis, seed 4242 a 9090, každý 6 pojmenovaných + 14 náhodných,
- standardní výřez, seed 31337 a 555, každý V1 + 14 náhodných.

Z náhodných výroků vývojář neměřil 28 začátků a 24 konců u přesného přepisu. U standardního je výřez krátký (66 vět), takže se části překrývají; vývojářovy 3 sady neznám, srovnával jsem s jedinou uloženou.

| sada | začátky ✔ (náhodné) | konce ✔ (náhodné) | po odečtení chyb rozhodčího |
|---|---|---|---|
| přesný 4242 | 10/14 | 12/14 | stejné |
| přesný 9090 | 8/14 | 9/14 | konce 11/14 |
| **přesný celkem** | **18/28 = 64 %** | **21/28 = 75 %** | **18/28, 23/28 (82 %)** |
| std 31337 | 12/14 | 9/14 | konce 12/14 |
| std 555 | 10/14 | 13/14 | začátky 11/14 |
| **std celkem** | **22/28 = 79 %** | **22/28 = 79 %** | **23/28, 25/28 (82 / 89 %)** |

Všech 6 pojmenovaných výroků je ✔✔ v obou sadách. Výsledky jsou v `web/test-out/edges-tester4-{presny-4242,presny-9090,std-31337,std-555}.txt/.json`.

**Skutečné chyby po odečtení omylů rozhodčího:**
- 10× titulek obsahuje slovo, které v klipu není,
- 12× chybí slyšitelné slovo,
- 1× jen útržek ve zvuku bez varování („-vat“ z „chovat“, In 1534,05).

**Klame rozhodčí? Ručně jsem prošel 8 krajů** (široké a úzké okno faster-whisper + RMS po 20–30 ms):
- **Řeči většinou neklame.**
  - R 23:20: propad −31 dB přesně na In, „ale“ ✔.
  - 50,10, 500,18, 21,30 a 97,82: rozhodčí měl pravdu. Útržek „-ším“ přepíše jako „Těším“, což chybu správně odhalí.
- **Falešná ✘ dělá ve 3 případech:**
  - (a) Pravopisné varianty proti standardnímu přepisu: „jinám/jinam“, „krvenky/krvinky“, „Ríkáš/Říkáš“, „tři pravid/to připravit“ a „šokující/šokovat“. Porovnání prvních 4 písmen s diakritikou → navrhuji normalizovat diakritiku a povolit editační vzdálenost ≤ 2.
  - (b) Nezachytí tichou druhou repliku na kraji. Out 404,23: v úzkém okně slyší „To je za mě nic…“ při ~−25 dBFS, v klipu ne.
  - (c) Na hudbě sám halucinuje: 1681–1685 s „www.hradeckralove.org“.

**Případ redaktora v aplikaci:** 23:20 ✔, V2 „tak“ ✔, V5 „to.“ ✔ (t03, t04-*).

## 3. Halucinace
- **Přesný přepis** (450 vět, `removed` = www… 0–8,56 s a „Titulky vytvořil JohnyX.“ 1681,6–1686,8 s):
  - První 3 věty: „Talk.“ / „Pozvání dnes totiž přijala…“ / „Je velmi šikovná…“.
  - Poslední 3: „Děkuji moc za pozvání, Kristýnko.“ / „No a vám přeji…“ (předposlední a poslední).
  - Konec je čistý. Na začátku ale vypadla skutečná řeč (B6).
- **Standardní výřez:** začátek čistý („a ty jsi to zvládla“ od 0,76 s, žádné vynechání), na konci chybí „vlastně věci.“ (B7).
- **Přesný výřez:** začátek i konec v pořádku.

## 4. Rozvržení (regress, standardní přepis, celé věty / výška seznamu)
| stav | 1366×768 (8 i 4 CPU) | 1040×1100 |
|---|---|---|
| 04 hotovo + nabídka | 5 / 242 px | 7 / 332 |
| 05 hledání | 6 | 7 |
| **06 nabídka + výběr + varování** | **4 / 211 px** | **7 / 302 px** |
| 09 titulky / 11 smazání | 5 / 6 | 7 / 6 |
| 13 slabý počítač | 4 | 7 |

U přesného přepisu (krátké věty, bez nabídky a varování) je při 1366×768 s výběrem 9 vět (t02).

**Co by pomohlo, aniž by se zhoršilo čtení:**
- **1040×1100:** Zdrojový monitor má nad a pod videem 16:9 asi 150 px černé. Kdyby výška monitorů odpovídala poměru videa, Přepis získá ~150 px, tedy ~+3 věty (asi 10), a video se nezmenší.
- **1366×768:** Ve stavu 06 není otevřená žádná sekvence a časová osa (~900×330 px) je prázdná. Když v té chvíli Přepis zabere i místo osy, věty se vejdou na 1 řádek, takže 8+ vět bez zkracování.
- Řádek nabídky (~28 px) po prvním výběru schovat (je i v menu ≡). Varování dát do řádku patičky jako ⚠ s bublinou místo samostatného řádku (~28 px). Obojí dohromady ≈ +1–2 věty.
- Klávesa ` už dnes dá 24 vět – stačí ji ukázat: ikona ⤢ v hlavičce panelu nebo nápověda v patičce.

## 5. Export (ffprobe)
| soubor | sekvence | obraz | zvuk | čas exportu |
|---|---|---|---|---|
| tester4-V2-19s.mp4 (titulky, social) | 19,88 s, 1080×1920 | 19,880 s / 497 sn. | 19,900 s, −14,0 LUFS ✔ | 2,3 s |
| tester4-dva-vyroky.mp4 | 33,64 s | 33,640 s / 841 | 33,660 s | 3,0 s |
| tester4-hrana-16s.mp4 (dev nástroj) | 16,000 s | 16,000 / 400 | 16,020 | 1,8 s |
| tester4-hrana-3useky.mp4 (16:9, 3 úseky) | 4,40 s | 4,400 / 110 | 4,420 | 1,2 s |
| regress-4-8cpu.mp4 / regress-4-4cpu.mp4 (16,000 000 000 004 s) | | 16,000 / 400 | 16,020 | 1,4 / 1,6 s |

Žádný export nespadl. Titulky jsou v obraze vypálené správně (t11). Dev nástroj přichytí časy na snímky, takže vstup „16,0000000039“ se zaokrouhlí na čistých 16,00 s – tenhle případ ale pokrývají regress exporty.

## 6. Regrese
| věc | výsledek |
|---|---|
| Delete, Ctrl+Z, Ctrl+Y (smazání) | ✔ 9 → 8 → 9 → 8 → 9 |
| oprava Enter, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z (oprava) | ✔ |
| hledání | ✔ |
| `__pzAsrWeak` | ✔ věta o standardním přepisu (rr-13) |
| úvodní karta 1366×768 | ✔ neořízne se |

## Nápady
1. Po „Vložit do sekvence“ dát úsek **na konec sekvence**, pokud hlava stojí uvnitř klipu (nebo hlavu po vytvoření titulků vrátit na konec). Vedle tlačítka nabídnout „do nové sekvence“.
2. Kraj v souvislé řeči: titulek začít až prvním celým slovem v klipu a útržek („-ším“) do titulku nedávat. Případně nabídnout „posunout In na nejbližší pauzu“ jedním klikem.
3. Místo „vynecháno 2“ ukázat v přepisu řádek „0:00–0:08 nepřepsáno (hudba / možná řeč) · Přepsat úsek“.
4. Odhad nabídky dělit na „stažení ~2 min (jen poprvé) + přepis ~4 min“. Na 4 CPU by to sedělo líp než „asi 6 min“.
5. Rozhodčí v edges.js: porovnávat bez diakritiky a s tolerancí, jinak 4 z 8 falešných ✘ jdou na vrub pravopisu standardního přepisu.
6. Upozornit i na zjevnou chybu přepisu v textu: v titulku V2 je „často zahojí“, v řeči nejspíš „čas to zahojí“ (t11, 2. titulek). Rozhodčí slyší totéž, takže jde jen o můj úsudek z kontextu.

## Ověření tvrzení vývojáře
| tvrzení | moje měření | souhlasí? |
|---|---|---|
| 6 pojmenovaných výroků čistých na obou krajích | edges seed 4242 i 9090: 6/6 ✔✔ | ✔ |
| 23:20 klikem: In 1399,76, bez varování, 9 titulků, „Ale jako…“ / „…furt. Furt.“ | totéž (t02, t03) | ✔ |
| V2 „tak neříkat…“, V5 „…zvládnout to.“ | totéž v aplikaci | ✔ |
| přesný přepis náhodně 7/10 začátků, 8/10 konců; větší sady 72–81 % | nové výroky: začátky 18/28 (64 %), konce 21/28 (75 %; 82 % bez omylů rozhodčího) | ≈ konce ano, **začátky hůř** |
| standardní přepis 60/78 (77 %) | 44/56 (79 %), bez omylů rozhodčího 48/56 | ✔ |
| „rozhodčí sám chybuje“ | ano: pravopis (4×), tichá replika (1×), hudba; v řeči na 8 ručně ověřených krajích mluví pravdu | ✔ (upřesněno) |
| varování jen podle zvuku, rada nevede mimo výběr | text ✔; varování chytí 8/16 špatných začátků a 3/13 konců, 9 planých | text ✔, **pokrytí ✘** |
| www… a „Titulky vytvořil…“ pryč, 450 vět, „vynecháno 2“ | ✔ (bublina pole hledání) | ✔ |
| „skutečná řeč zůstane“, „Talk.“ nejspíš zazní | „Talk.“ zazní ✔; **pod www… je 10 slov skutečné řeči 6,1–9,2 s, v přepisu chybí** | ✘ |
| Přepis 4 věty (1366×768) / 7 (1040×1100) ve stavu 06 | 4 / 211 px, 7 / 302 px (8 i 4 CPU) | ✔ (cíl 8 nesplněn) |
| standardní přepis výřezu 137 s (8 CPU) | 140 s regress, 141 s můj skript; 4 CPU 163–164 s | ✔ |
| výchozí na notebooku Standardní + nabídka | 8 i 4 CPU: ✔, „asi 5 min“ / „asi 6 min“ | ✔; skutečně 5,4 / 7,2 min |
| export opraven (16,000…004 s) | 400 snímků, 16,00 s; 4 další exporty OK | ✔ |
| úvodní karta se neořízne | ✔ 1366×768 | ✔ |

## Snímky a soubory
Všechny snímky jsou v `O:\TN_strihatoko\team\reports\shots-4\`.

**Moje cesta v aplikaci:** t01 import přesného přepisu · t02 výběr 23:20 · t03 titulky 23:20 · t04-V2 / t04-V5 výběr · t05-* rozbitá sekvence z B1 · t06 V2 v nové sekvenci · t07 dva výroky · t08 seznam titulků · t09 hledání · t10 slabý počítač · t11 snímek z exportu · t12 maximalizace panelu (`) · t13 **B1** · t14 snímky z exportu · t15 EN · t16 B2

**Ostatní:**
- Průchody regress.js: `regress-8cpu\`, `regress-4cpu\` (rr-*.png, regress.json) a logy `regress-8cpu.log`, `regress-4cpu.log`.
- Nabídka „Přepsat přesněji“: `offer-8cpu\`, `offer-4cpu\` (snímky + offer.json) a logy `offer-*.log`.
- Exporty: `O:\TN_strihatoko\web\test-out\tester4-V2-19s.mp4`, `tester4-dva-vyroky.mp4`, `tester4-hrana-16s.mp4`, `tester4-hrana-3useky.mp4`, `regress-4-4cpu.mp4`, `regress-4-8cpu.mp4`.
- Kraje: `O:\TN_strihatoko\web\test-out\edges-tester4-*.txt/.json`.

Testovací sekvence (T4 …) jsou jen v mém dočasném profilu Chrome a všechny mé procesy Chrome jsou ukončené.

## Shrnutí
- Pojmenované výroky včetně redaktorova 23:20 jsou cestou klik + Shift+klik čisté (In 1399,76, „Ale jako…“, bez varování). Na nových náhodných výrocích ale přesný přepis trefí jen 64 % začátků a 75–82 % konců. Standardní přepis je na 79–89 %, což odpovídá vývojáři.
- Rozhodčí v řeči neklame (8 krajů ručně). Falešná ✘ dělá kvůli pravopisu proti standardnímu přepisu, tichým replikám a hudbě.
- Nové chyby krajů: titulek vynechá celé první slovo věty („sedívává“, „My“), In padne o slovo dřív do pauzy („práce,“) a obojí bez varování. U varovaných začátků zůstávají v titulcích slova, která nezazní („Já se taky moc těším.“). Varování konce chytí 3 ze 13.
- Halucinace jsou z přepisu pryč, jenže pod „www…“ byla skutečná řeč (6,1–9,2 s), která teď v přepisu chybí.
- **Nejvážnější (3):** druhý výrok vložený po vytvoření titulků rozřízne první klip (útržek 0,2–0,3 s na začátku) a nechá cizí titulek přes nový výrok.
- Notebook: import → standardní přepis 2,4 / 2,7 min (8 / 4 CPU). „Přepsat přesněji“ slibuje 5 / 6 min, skutečně 5,4 / 7,2 min, celkem k přesnému přepisu 7,8 / 10,0 min. RAM 1,9 GB pro standardní přepis, 3,4–5,0 GB pro přesný.
- Přepis ve stavu nabídka + výběr + varování: 4 celé věty (1366×768) a 7 (1040×1100), cíl 8 nesplněn. Nejlevnější cesty: využít prázdnou časovou osu, monitor výšky videa a nabídku schovat po výběru.
- Export (5 sekvencí 4,4–33,6 s) bez pádu, délky sedí, zvuk +20 ms. Regrese seznamu titulků, hledání, slabého PC a úvodní karty v pořádku.
