# Hodnocení – kolo 4 (ředitel, 2026-11-22)
(Uloženo vývojářem z textu agenta.)

Podklady: report-4, redaktor-4, tasks-4, design-4, log.md (Kolo 4 – vývojář, Kolo 5 – vývojář), review-3, developer-rules.md, shots-dev-5 (b1-*, nb/, u4/, rr-nb8/, rr-stanice/), web/test-out/ew-nb-*.txt, edges-*.txt.
Repozitář má pořád **0 commitů** (`git log`: „branch 'master' does not have any commits yet“), je to 5. kolo.

## Co jsem ověřil sám
- ✔ **Verze:** 127.0.0.1:8791 i pz-ai-cut.pages.dev vrací `app.js?v=mwrc8zdt`, stejnou verzi jako log.
- ✔ **Testy:** `node test/run-tests.js` 36 prošlo / 0 selhalo, `node --check web/dist/app.js` bez chyby.
- ✔ **B1, varianta konec** (`node test/b1.js <scratchpad> --variant end`, vlastní headless Chrome, klik + Shift+klik na řádky Přepisu, tlačítko Vložit):
  - Klipy po vložení jsou [0–16,32] celý V5 a [16,32–36,2] V2. Žádný útržek.
  - Titulky V5 mají stejné časy jako před vložením (0,15 „My jsme vůbec neměli“ … 14,01–16,32 „…zvládnout to.“).
  - Doplnit titulky: celkem 7 → 16 titulků, V2 je dostal od 16,32 s, V5 zůstal beze změny.
  - Ctrl+Z vrátí titulky (16 → 7) a dalším Ctrl+Z vložení (1 klip). Ctrl+Y vložení obnoví.
  - Všech 9 kontrol skriptu je ✔. Tlačítko po vrácení říká „Přidat na konec sekvence“.
- ✔ **Vestavěný prohlížeč:** řádek nabídky „Přepsat přesněji · asi …“ v Přepisu už není. Záložka „Text v obraze“ je při otevřené sekvenci v hlavičce Zdroje. Snímek u4-gap-radek ukazuje řádek „0:00–0:08 nepřepsáno (hudba / možná řeč) ▶“.
- ✔/⚠ **Data notebooku, nb8.json / nb4.json:**
  - Časy: standardní přepis hotový za 149 / 193 s. Titulky z přesného úseku trvaly 16,7 / 27,7 s. Celý běh skriptu od importu po MP4: 177 / 231 s.
  - Redaktorův výrok 1:44–2:03 má první titulek „A zjistilo se to…“, tedy bez „dále.“.
  - ⚠ V titulcích dál zůstávají „jí hospitalizovali“ a „rozvěděli“. To jsou **2 opravy slov**, cíl kola je nejvýš 1.
  - ⚠ Na 4 CPU zůstaly 2 intervaly přes 10 s bez měnícího se čísla. Oprava je nasazená, ale znovu se neměřila.
- ⚠ **Srovnání 2:57 / 9:46 v logu je zavádějící.** 2:57 je čas skriptu bez lidské práce, 9:46 změřil člověk. Reálný odhad pro redaktora: 2:30 čekání + asi 3:20 jeho práce (hledání 47 s, vložení 27 s, nadpis 50 s, opravy 46 s) = **asi 5,5–6 min**. Je to na hraně cíle ≤ 6 min a potvrdí to až redaktor-5.
- ✘ **Rozhodčí je nekonzistentní:** v ew-nb-555 má stejný In 15,79 s se stejným nesouladem („Tady“ / „to.“) jednou ✘ (V1) a jednou ✔ (N12). Je to hraniční pravděpodobnost p 0,44 / 0,57. Výsledky krajů tedy berte s tolerancí ±1–2.

## Hodnocení
| Člen | Známka | Proč |
|---|---|---|
| Tester | 5 | Našel B1 (váha 3), nejdůležitější chybu kola, s přesnými časy klipů a titulků a stala se z ní úloha 1. Kraje přeměřil na nových seedech (64 / 75 %) a rozhodčího ověřil ručně na 8 krajích pomocí RMS, takže víme, kdy klame (pravopis, tichá replika, hudba). Odhalil B6 (pod „www…“ je skutečná řeč 6,1–9,2 s). Notebook změřil na 8 i 4 CPU s RAM. Zkratky přiznal. |
| Redaktor TN | 5 | Poprvé celá cesta až do MP4 (9:46 s časy po krocích). Našel 6 konkrétních, opakovatelných zdržení: „dále.“, Delete v otevřeném titulku, auto-přepis × „přepíše se sama“, skrytá záložka Text v obraze, Esc v uložení, rozpor Projekt × Přepis. Hrany změřil podle zvuku. Poctivě napsal, co neověřil poslechem („rozvěděli“). |
| Vlastník | 4 | Odvážné a správné rozhodnutí: na notebooku přesné titulky jen z úseků v sekvenci a model stahovat na pozadí. Tím přišlo hlavní zrychlení. Kritéria jsou měřitelná a rozvržení správně odloženo s design-5. Mínus: 4 velké úkoly; cíl „≥ 24/28“ u krajů bez ověření stropu metriky (rozhodčí je jiný model, strop asi 80 % = 22/28), takže úkol 3 byl předem nesplnitelný; kritérium „import → MP4 skriptem“ svádí ke srovnání s lidským časem. |
| UX designér | 5 | Měřil v aplikaci (metrika vět min/medián, px patičky). Při návrhu našel 3 chyby navíc: tlačítko Vložit se nepřekreslí po zavření nebo otevření sekvence, „(,)“ v popisku rozřízne klip, Text v obraze zůstane bez sekvence. Kompletní texty CZ/EN pro všechny stavy. design-5 má 3 varianty s px a větami a doporučení (a). Vývojář návrh převzal téměř 1:1. |
| Vývojář | **4** | Nová pravidla převážně dodržel. Výsledek je na prvním řádku, tabulky kritérií jsou u všech úkolů, poctivých ✘ je hodně (úkol 3: 5 ✘). PŘED na nasazené verzi kola 4 (PZ_DIST) a PO stejnou cestou klik + Shift+klik. Strojová měření dělal sám (b1.js, notebook5.js, edges-web.js, small5.js, WER 15,7 → 5,9 %). Commit navrhl v první větě. B1 výborně (ověřeno mnou, 9/9). Notebook skutečně zrychlil. Mínus: (1) „nové sady 2×14 bez ladění ✔“ je neplatné ✔, protože šlo o testerovy sady z kola 4, ne o nové seedy. (2) Kritérium 7 úkolu 3 (8 krajů RMS „Rozhodčí vs. titulky“) v tabulce chybí, takže podle pravidla 5 je to ✘. (3) Oprava „stuck“ na 4 CPU je nasazená bez nového měření. (4) WER proti přesnému přepisu celého klipu „neověřeno“, i když měl `vyrez-5min-accurate.json`. (5) Testy na „dále.“, „-ším“, „sedívává“, „práce,“ nejsou (pravidlo 8). (6) Zhoršení 07 při 1040×1100 (7 → 6 vět) bylo nasazeno, i když ho sám označil ✘. (7) Srovnání 2:57 × 9:46 míchá skript a člověka. Úkol 3 jako celek nesplněn. |

## Výměny
- **Nikdo** nemá ≤ 2 ani podruhé 3. Vývojář se po výměně způsobu práce zlepšil (3 → 4), pravidla zůstávají.
- **Do `team/developer-rules.md` doplnit 3 body (bez výměny):** 13. ✔ jen při doslovném splnění („nové seedy“ = vygenerované a zapsané do logu před měřením). 14. Oprava nasazená po měření musí být přeměřena stejným skriptem před předáním, jinak ✘ a nenasazovat. 15. PŘED/PO jen se stejnou metrikou (skript × skript, člověk × člověk); lidský čas = odhad.
- **Vlastník (product-owner.md):** před cílovým číslem ověřit strop měření (shodu rozhodčího se sebou samým nebo s ruční referencí). Nejvýš 3 úkoly na kolo.

## Stav vůči cíli (redaktor: Reels z notebooku rychle, titulky bez chyb)
- **Rychlost:** standardní přepis se na notebooku spustí sám (asi 2,5 min) a přesný model se mezitím stahuje na pozadí (1 GB, stejný text v Projektu i Přepisu). Titulky z přesných úseků mají 17–28 s. Odhad pro člověka: **asi 5,5–6 min** od importu po MP4, dříve 9:46. Cíl ≤ 6 min je na hraně a ověří ho redaktor-5.
- **Titulky:** redaktorův „dále.“ je pryč, žádná slovenština ani ruština, WER 15,7 → 5,9 %. Zbývají **2 chyby slov** („jí“, „rozvěděli“), cíl je ≤ 1.
- **Sekvence:** druhý výrok po titulcích už sekvenci nerozbije (B1 ověřen). Ctrl+Z/Y funguje.
- **Otevřené:** kraje na stanici (18/28, 21/28), varování konce (B5), B2–B4 jednotlivě neověřeny, Přepis při 1366×768 jen 5 celých vět.

## Zaměření kola 6
1. **Kraje titulků na obou cestách, s realistickým cílem.** Každý pojmenovaný případ (B2 ×2, B3 ×2, B4 ×4, B5, „dále.“, 23:20) ✔✔ cestou klik + Shift+klik a s testem. Varování konce funguje (B5). 0 titulků se slovem, které nezazní. Nové seedy zapsané předem: ≥ 22/28 začátků i konců (strop rozhodčího asi 80 %, vlastník ho nejdřív ověří).
2. **Přepis při 1366×768 ≥ 8 celých vět** podle design-5 (a) (Přepis zabere prázdnou osu, když není sekvence) + ⤢. Žádný stav nesmí být horší než kolo 5, včetně stavu 07 při 1040×1100.

## Doporučení pro Petra
- **Commit hned, popáté navrženo.** `.gitignore` už vylučuje `web/test-out/` (621 MB) a `web/dist/`. Do commitu by šlo `team/` (85 MB snímků) – zvaž přidání `team/reports/shots-*` do `.gitignore`.
- **Co vidět (5 min):** `team/reports/shots-dev-5/b1-end-02-v2-vlozeno.png`, `b1-end-03-titulky-doplneno.png`, `shots-dev-5/nb/nb8-*-dialog.png` a poslední `nb8-*-titulky.png`, `shots-dev-5/u4/u4-gap-radek.png`; pustit `web/test-out/nb5-8cpu.mp4` (začátek bez „dále.“, slova „jí“ / „rozvěděli“).
- Jednou změřit skutečný redakční notebook (tester i vývojář pracují jen se simulací afinitou).
