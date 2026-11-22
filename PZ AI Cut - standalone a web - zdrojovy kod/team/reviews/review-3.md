# Hodnocení – kolo 3 (ředitel, 2026-11-22)
(Uloženo vývojářem z textu agenta.)

Podklady: report-3, redaktor-3, tasks-3, design-3, log.md (Kolo 3), developer-rules.md, review-2, shots-dev-3 (9 snímků), web/test-out/nb-*.json.
`node test/run-tests.js` **28/28**. Repozitář pořád **0 commitů** (3. kolo).

Ověřeno v aplikaci (127.0.0.1:8791, app.js?v=mwr61fv9, 1366×768, nový projekt, rozhovor Šimková, přesný přepis 451 vět):
- ✔ Smazání titulku: Delete → „9 titulků“, patička „Smazán titulek „stalo.“ [Vrátit]“.
- ✔ Dialog Titulky z přepisu: „Vytvořit titulky“ 0 ms i 1,2 s stejně (713/468).
- ✔ České uvozovky: „Máma tady není. … zavolat.“
- ✔ Výrok 25:51 klikem (#413–416): In 1550,92 s, „tak“ od 1551,03 s → ±0,3 s ✔ (v logu chybělo).
- ✘ **Redaktorův výrok 23:20–23:37 (klik + Shift+klik, 7 vět) pořád dává první titulek „stalo.“** – RMS po 30 ms: řeč do 1399,72 s, propad −64 dB
  v 1399,75 s, „Ale“ od 1399,78 s, klip začíná 1399,76 s → „stalo.“ v klipu **nezazní**, ale je v titulcích (časy slov posunuté ~0,3 s; #363 končí 1400,02).
  Aplikace místo toho radí „Začátek je v souvislé řeči – přidej předchozí větu“ – tj. přidat 6s větu, kterou redaktor nechce.
- ✘ **Halucinace v přesném přepisu:** první věta „www.hradeckralove.cz Talk.“ (0:00–9:64), poslední „Titulky vytvořil JohnyX.“ (28:01). Kontrola děr hledá
  jen chybějící slova, ne vymyšlená. Vývojář první halucinaci viděl a nasadil.
- ⚠ **Přepis 1366×768 s výběrem a varováním: seznam 125 px = 4 celé řádky** (pravidlo 8: ≥ 8). Vývojář měřil jen bez výběru (202 px). Nabídka
  „Přepsat přesněji“ zabírá dalších ~84 px; na notebooku (výchozí cesta) vychází seznam po výběru na 1–2 řádky (výpočet). UX to hlásil v design-3.

## Hodnocení
| Člen | Známka | Proč |
|---|---|---|
| Tester | 5 | Skutečná příčina „neměl přesný přepis“, první stažení 1037 MB/117 s, přepis 10,8 min, CPU 96 %, GPU nečinná; reference opravená dvěma modely + RMS; kraje 5 výroků s čísly; vlastní chybu přiznal. |
| Redaktor TN | 4 | Poprvé **ANO bez „těsně“** s časy; jedna blokující věc („stalo.“) → úkol 3 funguje. Mínus: video potřetí nevzniklo, zvuk a hrany neověřil. |
| Vlastník | 4 | Správné pořadí, měřitelná kritéria, tabulka profilů, NEDĚLAT, cíl kola 4. Mínus: 4 velké úkoly; „6/6 bez cizího slova“ bez cesty při časech ±0,3 s; kontrola děr jen na chybějící slova; ×1,5 bez zdůvodnění. |
| UX designér | 5 | Měřil v aplikaci (dialog +9/+22 px, patička 78 px, seznam 74 px při stahování); návrh mazání postavený bez dotazů a funguje; správně varoval před 1 řádkem Přepisu. |
| Vývojář | 3 | Plus: localhost × 127.0.0.1, úkol 1 výborně (5 profilů, ETA −18 až +7 %, příprava 124 → 8,3 s), úkol 3 výborně, poctivé ✘. Mínus: úkol 2 jen 2/6, redaktorův výrok s cizím titulkem; 10+10 krajů lokálním modelem a snímek V3 „předal testerovi“; regresní průchod bez hledání/výběru/exportu, Přepis neměřen s výběrem a nabídkou; chybějící kritéria v logu; halucinaci v první větě viděl a nasadil. |

## Výměny
**Vývojář – druhá 3 po sobě → výměna způsobu práce:** `team/developer-rules.md` nahrazen celý (12 bodů). Kolo 4 začne potvrzením přečtení v logu;
další ≤ 3 = ředitel navrhne Petrovi jiný postup (např. menší kola). Ostatní beze změny.

## Stav vůči cíli
Redaktor ANO bez „těsně“; přesný model a seznam titulků s mazáním fungují. Na notebooku výchozí Standardní + nabídka (8 CPU: 8,9 / 16,8 min, 4 CPU: 11,1 / 26,3 min;
×1,5 = odhad, skutečný notebook neměřen). Zbývá: cizí/chybějící slova na krajích (2/6 čisté), halucinace na začátku/konci přepisu, málo řádků Přepisu po výběru.
**Doporučení pro Petra:** potřetí povolit první commit; jednou změřit skutečný notebook TN podle README.

## Zaměření kola 4
1. **Redaktor na notebooku s novým klipem: ANO pod 10 min včetně čekání na přepis** (simulace 8 CPU, 5min výřez, jiný výrok) + Přepis se seznamem ≥ 8 řádků
   ve stavu „nabídka + výběr + varování“ při 1366×768.
2. **Titulky = přesně to, co v klipu zazní** (rozhoduje zvuk): skript na 6 výrocích + 10 začátcích + 10 koncích; 23:20 bez „stalo.“, V2 s „Tak“, V5 s „to.“;
   halucinace na začátku a konci přepisu odstranit nebo označit. Žádné nové funkce.
