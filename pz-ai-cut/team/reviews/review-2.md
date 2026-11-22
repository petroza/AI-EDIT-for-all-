# Hodnocení – kolo 2 (ředitel, 2026-11-22)
(Uloženo vývojářem z textu agenta.)

Podklady: report-2, redaktor-2, tasks-2, design-2, log.md (Kolo 2, obě části vývojáře), developer-rules.md, review-1,
shots-dev-2, test/asr-ref. `node test/run-tests.js` **23/23**. `node test/asr-wer.js`: Přesné 6,4 % / 10,5 %, Standardní 19,0 % / 26,3 %.

Ověřeno v aplikaci (localhost:8791, emulace 1366×768 a 1040×1100, čistý projekt, výrok 25:51–26:10):
- ✔ Hledání „fádní“, klik + Shift+klik: „6 vět · 0:20“; Vložit do nové sekvence → Enter → 9:16, 19,88 s.
- ✔ Záložka Titulky: 12 titulků, fokus v seznamu; 2 opravy jen klávesnicí, patička „Opraveno: 2 titulky · opravy platí i v přepisu klipu“; Ctrl+Z vrátí poslední opravu v titulku i v přepisu.
- ✔ Pruh AI 36 px; osa 949 px = 69 % okna; vložený 20s klip 707 px = 75 % osy.
- ✘ **REGRESE: v záložce Přepis se zobrazuje i panel Titulků** (CSS `#projectPanel.show-tr .tr-pane` platí i pro `#capPane`).
  Při 1366×768 má seznam vět po výběru **17 px**, při 1040×1100 97 px. Hlavní krok aplikace je tím skoro nepoužitelný. Snímek by to odhalil.
- ✘ **První slovo zmizí z titulků a oprava ho v přepisu zdvojí.** Věta #361 „Tak neříká se…“ – titulek začíná „neříká se“
  (`speechAlign` zahodil „Tak“ jako „slovo v tichu“, ale „Tak“ zazní 1551,07–1551,19 s, −31 dB). Redaktor „Tak“ dopíše → v přepisu „Tak Tak neříkejte…“.
- ⚠ **Testovací prohlížeč má pořád Standardní přepis** (`localStorage.pzAsrQuality = "standard"`, v IndexedDB jen whisper-small).
  Tester i redaktor by v kole 3 testovali starý model. Stejně u každého uživatele s dřívější uloženou volbou.
- Repozitář pořád 0 commitů.

## Hodnocení
| Člen | Známka | Proč |
|---|---|---|
| Tester | 5 | Celá cesta bez AI podle zadání; skutečné nálezy s kroky a čísly (Text v obraze přenesl „STARY NADPIS“, karaoke předbíhá, 0,9 s ticha, 6/48 slov, −1,7 dBTP, hranice přes RMS); skoro vše kolo 2 opravilo; falešné nálezy žádné. |
| Redaktor TN | 4 | Jasný verdikt „ANO, ale těsně“ a jedna věc (seznam titulků) – z ní úkol 2, funguje. Mínus: video nevzniklo, hranice neposlouchal, čas dělal automat, „7 titulků“ bylo 6. |
| Vlastník | 4 | Správná priorita, měřitelné pravidlo pro model, pevný vzorek, „nedělat“. Mínus: 4 velké úkoly; „na tomto PC“ = Petrova stanice, ne redakční notebook; reference bez poslechu zvýhodňuje modely; kritéria úkolu 4 nepočítala se souvislou řečí. |
| UX designér | 4 | Návrh šel postavit bez dotazů a funguje (Titulky, Enter → další, pruh AI, Text v obraze u Zdroje). Mínus: aplikaci neotevřel, přespecifikováno; kontrolu, že se záložky v jednom rámu nepřekrývají, nepožadoval. |
| Vývojář | 3 | Hodně práce s čísly (WER, 28 min za 10,9 min, OPFS, seznam titulků s opravou do přepisu, poctivé ✘ u úkolu 4). Ale **rozbil hlavní krok** (Přepis 17 px), snímky chyběly, „slovo v tichu“ zahazuje vyslovená slova a oprava je pak zdvojí, testovací prohlížeč zůstal na Standardním modelu. |

## Výměny
Nikdo. Vývojář má 3 poprvé (kolo 1: 4), **další 3 znamená výměnu**. developer-rules.md doplněna o body 7–10.

## Stav vůči cíli
Opravu titulků jde poprvé udělat rychle a propíše se do přepisu. Přesný model 19 % → 6,4 % (výrok 18:16: 8/52 → 3/52).
Redaktor to ale s přesným modelem ještě nezkoušel. Kolo 2 rozbilo hlavní krok a přidalo tichou chybu v titulcích.
Neznámé riziko: přesný model stáhne 1 GB a na Petrově stanici přepíše 28 min za 10,9 min – na redakčním notebooku nezměřeno.
**Doporučení pro Petra:** povolit první commit (stav kola 2) před dalšími úpravami.

## Zaměření kola 3
1. **Nejdřív opravit, co kolo 2 rozbilo, a pak ověřit skutečným použitím.** Seznam Přepisu v plné výšce; žádné vyslovené slovo
   nesmí vypadnout z titulků a oprava nesmí slova zdvojit; tester a redaktor **s přesným modelem**. Rozhoduje redaktorovo ANO
   bez „těsně“: výrok 15–20 s, před opravou ≤ 2 chybná slova, oprava pod 1 min, celkem pod 6 min.
2. **Přesný přepis na redakčním počítači:** změřit stažení a přepis 28 min na typickém notebooku TN, nebo věrně simulovat 4 vlákna / 8 GB;
   podle čísel rozhodnout o výchozím modelu a o tom, co uživatel uvidí, když to trvá dlouho (např. rychlý přepis k hledání,
   přesný doběhne na pozadí). Žádné nové funkce navíc.
