# Návrh UX – kolo 1: Přepis bez AI, panel Přepis, titulky z přepisu (+ úkol 4)
(Uloženo vývojářem z textu agenta – UX designér, 2026-11-21. Podklady: tasks-1, report-1, redaktor-1, shots, knowledge.md, kód.)

## 0. Shrnutí
Panel **Přepis = záložka vedle Projekt** ve stejném rámu (rozvržení beze změny). Text klipu ze Zdroje: **klik na větu = In/Out,
Shift+klik přidá věty, dole „Vložit do sekvence“**. Stav přepisu (%, zbývá, Zastavit) na 3 místech: dlaždice klipu, záložka
Přepis, její nadpis. Titulky jedním dialogem ze Sekvence → Titulky, z okna Text v obraze i z AI panelu. Nic nepotřebuje AI.
Zásady: H1 stav tam, kam se díváš · H6 postup vidět (tip v patičce) · H5 prevence (celé věty, upozornění na Out uprostřed věty).

## 1. Kde bydlí
- Hlavička `#projectPanel .panel-head.ptab`: `[ Projekt: Bez názvu ] [ Přepis 45 % ] ≡` – záložky `<button>` 28 px, styl `.seq-tab`;
  neaktivní `#9a9a9a`, aktivní `#e8e8e8` + spodní okraj 2 px `#d6d6d6`; „Projekt: …“ max-width 60 %, ellipsis.
- Stav v nadpisu (běžící přepis): `Přepis 45 %` (#c4b5fd, 11 px/600, tabular-nums) · model `Přepis …` · zastaveno `Přepis ‖` (#fcd34d)
  · chyba `Přepis !` (#fca5a5) · jinak `Přepis`.
- Samo se přepne jen jednou za projekt – při prvním dvojkliku na klip s přepisem; pak pamatuje volbu (localStorage `pzProjTab`).
- Ctrl+F: klip s přepisem ve Zdroji/vybraný → záložka Přepis + fokus do hledání; jinak hledání v projektu.
- ≡ v záložce Přepis: `✓ Automaticky přepisovat nová videa`, `Přepsat znovu`.
- Panel ukazuje klip ve Zdroji, jinak vybraný v Projektu, jinak prázdný stav. Klik na větu klipu mimo Zdroj ho do Zdroje otevře.

## 2. Panel Přepis (shora dolů)
a) řádek klipu 26 px: název (#cfcfcf, ellipsis) · vpravo dim `412 vět`
b) hledání 36 px (pole 28 px, #161616, okraj #757575, rohy 3 px, fokus #a78bfa), placeholder „Hledat v přepisu (Ctrl+F)“,
   počítadlo `3 / 12` (· `zatím do 12:40` během přepisu; `Nenalezeno`), ▲▼ 24×24 (Shift+Enter / Enter).
   Bez ohledu na velikost a diakritiku, fráze i přes hranici vět, debounce 150 ms. **Nefiltruje** – zvýrazní `<mark>` #fcd34d/#1b1b1b,
   aktuální + outline 2px #fff, odroluje. Esc = vymazat, ↓ = fokus na řádek nálezu.
c) stavový pruh (#1f1e26, padding 8/10, text 12 px tučná část #ecebf3 + dim #a19fb3, tlačítko 26 px, průběh 3 px #8b5cf6 na #2b2b2b):
   - příprava: **Připravuji rozpoznávání řeči… 35 %** · jen poprvé, pak už to jde hned [Zastavit]
   - fronta: **Čeká na přepis** · nejdřív se dopíše „X“ [Zastavit]
   - běží: **Přepisuji řeč… 45 %** · zbývá asi 6 min [Zastavit]
   - zastaveno: **Přepis zastaven u 12:40** (45 %) · hotovou část můžeš používat [Pokračovat]
   - chyba: levý okraj 3 px #f87171, **Přepis se nepodařil.** + důvod [Zkusit znovu]
   - hotovo: pruh zmizí.
   Odhad: prvních ~20 s „odhaduji čas…“, < 1 min „zbývá méně než minuta“, 1–10 „zbývá asi N min“, > 10 po 5 min, > 60 „1 h 10 min“;
   mění se max. 1× za 5 s, vyhlazeně. Zastavit → toast „Přepis zastaven. Hotovou část můžeš používat.“
   Chyby: bez zvuku / stažení („Zkontroluj připojení k internetu – stahuje se jen poprvé.“) / paměť / formát / jiné.
d) řádek věty: grid `40px 1fr` (≥1 h 52px), gap 8, padding 4/10/4/7, levý okraj 3 px, min-height 26 px; čas 11 px #8e8e8e,
   text 12,5 px/1,45 #d6d6d6, zalamuje se. Hover #262626. **Vybraný**: #372c51, okraj #8b5cf6, text #ecebf3, čas #c4b5fd.
   Hraje: okraj #8e8e8e, text #fff. In/Out uprostřed věty: okraj #f59e0b. Dopisovaná poslední věta: #8e8e8e, neklikací.
   Fokus: outline 2px #a78bfa. Během přepisu zástupný řádek „Přepisuji dál… (hotovo do 12:40)“ s pulzující tečkou #fbbf24.
   Při přehrávání drží hrající větu viditelnou (pauza 3 s po ručním rolování a když je vyplněné hledání).
e) výběr: klik = 1 věta (In/Out přes cutBounds, pauza, hlava na In); Shift+klik = souvisle od kotvy; dvojklik = totéž + přehrát In→Out.
   Klávesy ↑↓ fokus, Enter = klik, Shift+↑↓ rozšíří, mezerník přehrát, Ctrl+C text. Ruční In/Out zruší fialový výběr.
f) patička 40 px (#1b1b1b): bez výběru tip „Klikni na větu = začátek a konec úseku. Shift+klik přidá další věty.“;
   s výběrem `2 věty · 0:19` + [▶ Přehrát] + **[Vložit do sekvence]** (#7c3aed, hover #6d28d9) = příkaz insert („,“), výběr zůstane.
   Bez sekvence „Vložit do nové sekvence“ → dialog Nová sekvence se zaškrtnutým „Vložit vybraný klip“.
g) prázdné stavy (nadpis 13/600 #e8e8e8, popis #8e8e8e, max 260 px):
   - bez médií: „Tady uvidíš, co se ve videu říká“ / „Importuj video – řeč se přepíše sama, v tomto počítači a bez AI.“ [Importovat video…]
   - nic vybraného: totéž / „Dvojklikem otevři klip v záložce Projekt.“
   - bez přepisu: „Řeč v klipu ještě není přepsaná“ / „Přepis běží v tomto počítači, bez AI. Mezitím můžeš normálně pracovat.“ [Přepsat řeč]
   - bez zvuku: „Klip nemá zvuk“ / „Není co přepsat.“ · bez řeči: „V klipu jsme nenašli žádnou řeč“ · chybí soubor: „Soubor klipu chybí“.
   Pod tlačítkem checkbox **Automaticky přepisovat nová videa** (synchronní s AI panelem).

## 3. Indikátor u klipu v Projektu
Dlaždice: štítek vlevo nahoře 18 px, 600 11 px, rgba(0,0,0,.78), rohy 2 px: `Příprava…` / `Čeká na přepis` / `Přepis 45 %` /
`Přepis zastaven` (#fcd34d) / `Přepis selhal` (#fca5a5) / `✓ Přepis` (rgba .6, #e8e8e8); úzká dlaždice zkratky. Průběh dole 3 px #8b5cf6.
Title s plnou větou. Seznam: `· přepis 45 %` / `· přepis zastaven` / `· přepis ✓`, pruh `.prog` fialový.

## 4. Kontextová menu
Klip v projektu i na ose: „Zobrazit přepis“ (když existuje část) + dynamická položka „Přepsat řeč“ / „Zastavit přepis“ /
„Pokračovat v přepisu“ / „Přepsat znovu…“ (potvrzení: „Přepsat řeč znovu?“ – stávající přepis zůstane, dokud nebude nový; titulky se nezmění).
⚠ Nikdy samotné „Přepsat“ (= Overwrite).

## 5. Upozornění „uprostřed věty“
V `.mon-bar` Zdroje místo `.spacer`. Když existuje přepis, In/Out nastavený ručně, bod uvnitř věty dál než 0,25 s od kraje.
Štítek 26 px #372c1b, okraj 2 px #f59e0b, text #fcd34d 11,5/600; tlačítko 24 px obrys #fcd34d.
„⚠ Konec je uprostřed věty [Přichytit na konec věty]“ / „⚠ Začátek je uprostřed věty [Přichytit na začátek věty]“ /
„⚠ Začátek i konec jsou uprostřed věty [Přichytit na celé věty]“; úzká lišta „⚠ Uprostřed věty [Přichytit]“.
Přichytit vždy **rozšiřuje** na celou větu (cutBounds), krok Zpět „Přichytit na větu“.

## 6. Titulky z přepisu
Vstupy: Sekvence → Titulky → **Vytvořit titulky z přepisu…** (první položka); okno Text v obraze (bez titulků velké tlačítko
+ „Jen slova, která v sekvenci zazní.“; s titulky „Vytvořit znovu z přepisu…“); AI panel bez AI „Titulky (bez AI)“; hláška
„Pod přehrávací hlavou není titulek“ → „Sekvence zatím nemá titulky. [Vytvořit z přepisu]“.
Dialog 440 px: „Titulky z přepisu“, podtitul sekvence · délka · formát; „Titulky vzniknou jen ze slov, která v sekvenci zazní (N úseky z klipu X).“;
[✓] Zvýrazňovat vyslovované slovo (napoprvé zapnuté u 9:16/4:5/1:1, vypnuté u 16:9; pak poslední volba); „Vzhled podle formátu: 2 řádky,
30 % od spodu. Změníš ho v okně Text v obraze.“; [Zrušit] [Vytvořit titulky]. Toast „Titulky hotové (14). Zpět vrátíš Ctrl+Z.“ Jeden krok Zpět „Titulky z přepisu“.
Stavy: už má titulky → varování + [Nahradit titulky]; přepis úseků hotový (i když klip ne) → hned; chybí přepis → „Čekám na přepis: X – 40 % · zbývá…“
[Vytvořit, až bude přepis] – zavře se, vytvoří se po dokončení (toast), bez modálu; bez řeči → „V použitých úsecích jsme nenašli žádnou řeč“.
Oprava titulku po Enteru se musí uložit vždy; když ne, toast, nikdy ticho.

## 7. Jednotné texty
- Nápověda: „**Řeč se přepíše sama hned po importu** – v tomto počítači, bez AI. Průběh vidíš u klipu a v záložce **Přepis** vedle panelu Projekt.
  Tam výrok najdeš hledáním (Ctrl+F) a kliknutím na větu nastavíš začátek a konec.“ (auto vypnuté: „Přepis spustíš pravým klikem na klip → Přepsat řeč.“)
- Úvodní karta: „Řeč se přepíše sama. Výrok najdeš v záložce **Přepis**: klikni na větu a vlož ji do sekvence.“
- AI panel soukromí: „Video, zvuk i projekty zůstávají na tomto počítači. Řeč se přepisuje tady, i bez AI; AI dostane jen text přepisu.“
- Nápověda titulky: „Sekvence → Titulky → Vytvořit titulky z přepisu (nebo tlačítko v okně Text v obraze). Bez AI.“
- Toast: „Přepis hotový: rozhovor.mp4“. Bez slov Whisper, model, bridge, MCP, IndexedDB.

## 8. Úkol 4
Nový projekt = jako první spuštění (žádná lišta, toast, Přepis prázdný, karta „Začni tady“); přepisy v úložišti prohlížeče zůstávají.
Ctrl+N: předvolba **9:16 Reels, TikTok, Shorts (1080×1920)** první a vybraná; „Vložit vybraný klip“ vypnuté; po zaškrtnutí „Vloží se úsek 12:07–12:26 (0:19)“,
bez In–Out a > 2 min varování „Vloží se celý klip (28:14). Pro krátké video nejdřív označ úsek – třeba kliknutím na větu v záložce Přepis.“
Přeložit předvolby. Po prvním vložení přiblížit osu. „,“ „.“ podle e.code.

## 9. Hodnoty
Barvy viz výše (vše v aplikaci): primární #7c3aed/#6d28d9, akcent #8b5cf6, varování #372c1b/#f59e0b/#fcd34d, chyba #f87171/#fca5a5,
fokus #a78bfa. Rozměry: záložka 28, řádek klipu 26, hledání 36/28, ▲▼ 24, věta ≥ 26, patička 40 (tlačítka 28), Přichytit 24,
štítek 18, průběh 3. Rohy 2–3 px. Písmo Segoe UI 12,5/12/11–11,5, čísla tabular-nums. Cíle ≥ 24 px.

## 11. Otevřené body
1. Pokračovat po Zastavit – jinak texty „Spustit znovu / Začne od začátku“. 2. Odhad času vyhlazený, nikdy „0 min“.
3. Hledání NFD bez \p{M}. 4. Ctrl+F vs. hledání v projektu. 5. „✓ Přepis“ na hotových dlaždicích – ověřit u redaktora v kole 2.
