# Hodnocení – kolo 1 (ředitel, 2026-11-21)
(Uloženo vývojářem z textu agenta.)

Podklady: report-1 (tester), redaktor-1, tasks-1, design-1, log.md (Kolo 1), shots-dev-1. Ověřeno v aplikaci
(localhost:8791): přepis rozhovoru (401 vět) je hned po importu vidět v záložce Přepis. Hledání bez diakritiky funguje.
Klik a Shift+klik nastaví úsek: patička „2 věty · 0:19 · Vložit do sekvence“. `node test/run-tests.js` 15/15 prošlo.

## Hodnocení
| Člen | Známka | Proč |
|---|---|---|
| Tester | 4 | Našel dvě skutečné překážky (titulky bez AI, přepis nejde spustit), změřil true peak +0,2 dBFS, ukázal snímek se střihem kamery v 7,64 s. Kroky se dají zopakovat. Mínus: dva nálezy byly artefakty automatu nebo zůstaly neověřené (klávesa „,“, Export verzí). Chyby přepisu (5–6 na 18 s) dal jen do kvality, ne mezi překážky, i když rozhodují o tom, jestli se video dá poslat. |
| Redaktor TN | 5 | Jasný verdikt NE, dvě skutečné příčiny, „jedna věc“ formulovaná přesně – z ní vzniklo celé kolo. Změřil čas a kroky, našel neviditelný text ze starého projektu (riziko cizího nadpisu v exportu), vypsal anglické a technické texty. |
| Vlastník | 4 | Správná priorita (přepis → najít výrok → titulky), ověřitelné „hotovo, když“, seznam „nedělat“, zadání testů na kolo 2. Mínus: 4 velké úkoly nejsou „30–60 min“. Některá kritéria vývojář sám ověřit nemůže (poslech). Zákaz měnit rozpoznávání řeči nechal bez řešení hlavní důvod, proč výsledek nejde rovnou poslat (titulky plné chyb). |
| UX designér | 4 | Kompletní návrh: umístění, všechny stavy, přesné hodnoty, jednotné české texty. Vývojář podle něj postavil vše bez dotazů. Mínus: přespecifikované (odhad času v 5 pásmech, záložka se sama přepne „jednou za projekt“), neověřené na uživateli. Chybí, jak se opravují chybná slova přepisu. |
| Vývojář | 4 | Všechny 4 úkoly hotové s čísly (zastavení 0,1 s, druhý import 0,4 s, hranice „ve slově“ 2 → 0, −14 LUFS / −1,1 dBTP), poctivě uvedl, co neověřil, nasadil. Mínus: několik kritérií tiše vynechal: titulky 10 míst ±0,2 s a „nic z vystřižených úseků“ (3/1); rychlé opravy 3× (udělal 2×); čistý stav „i po F5“ (4/1); kontrast ≥ 4,5 : 1 (2/5); celá cesta bez výzvy k AI (3/6). Projekt nemá ani jeden commit v gitu. Ukázkový export má v titulku „dosnidaně snovu“ (zmíněno jen v otevřených bodech). |

## Výměny
Nikdo (žádné hodnocení ≤ 2, první kolo). Vývojáři pravidla práce v `team/developer-rules.md`.

## Stav vůči cíli
Hlavní překážky z kola 0 jsou technicky odstraněné: přepis bez AI, nalezení výroku textem, titulky jedním klikem.
Nikdo z uživatelů to ale zatím nevyzkoušel a nikdo neposlouchal hranice střihu. Další překážka je už vidět: **přepis je
nepřesný** – v ukázce prvních vět asi 18 % chybných slov (hrubý ruční počet), v exportu 9:16 „dosnidaně snovu“,
„spáring partiák“. Titulky s takovými chybami redaktor na sítě TN nepošle; opravovat 5–6 slov na 15 s je víc než
10 minut práce. Desktopová verze záložku Přepis nemá.

## Zaměření kola 2
1. **Ověření kola 1 skutečným použitím:** tester a redaktor podle zadání v tasks-1 (časy, poslech hranic). Rozhoduje
   redaktorovo ANO.
2. **Titulky, které jdou poslat:** změřit chybovost přepisu na pevném 2min vzorku proti ručně opravenému textu. Nad 5 % →
   přesnější rozpoznávání řeči (volitelné, offline), nebo oprava slova na jednom místě (v přepisu → propíše se do titulků),
   nejlépe obojí. Potom Auto Reframe u střihu kamery 7,64 s, jak bylo slíbeno.
Vlastník smí v kole 2 povolit změnu modelu rozpoznávání (zákaz z kola 1 ruším).
