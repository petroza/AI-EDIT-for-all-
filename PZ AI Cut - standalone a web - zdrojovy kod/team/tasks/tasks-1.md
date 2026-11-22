# Zadání – kolo 1 (vlastník → vývojář)
(Uloženo vývojářem z textu agenta.)

Datum: 2026-11-21. Podklady: team/reports/report-1.md, team/reports/redaktor-1.md, team/design/knowledge.md (část C), team/log.md, web/README.md.

## Verdikt kola 0
Redaktor: „Zvládl bych to sám?“ → **NE**. Zasekly ho dvě věci:
- **titulky bez AI nejdou**, a bez titulků Reels nikdo nepošle,
- **výrok nejde najít jinak než posloucháním 28 minut.**

Přepis řeči v prohlížeči už máme (Whisper, `web/ai/transcripts.js`), jen ho bez AI nikdo nemá jak použít. Kolo 1 otevře hotový přepis redaktorovi. Nic nového nevymýšlíme.

Připravené drobnosti nasaď v tomhle kole spolu s úkoly: lišta Nenalezená média, limiter −1 dBFS, české předvolby a štítek zón, Průzkumník na webu, hláška u Poslat AI.

Pro úkoly 1–3 udělá UX designér **jeden společný návrh** (`team/design/design-1.md`). Úkol 4 jako krátká poznámka v témže návrhu.

---

## Úkol 1 – Přepis řeči bez AI: spustit, vidět, zastavit, nepřepisovat dvakrát (UX: ano)
**Proč:** tester [3] přepis nejde spustit (jen volba v AI panelu → Připojení); tester [2] nápověda slibuje „Řeč se sama přepíše“ a nic; tester [2] druhý import téhož souboru se přepisuje znovu ~12 min a nejde zastavit; redaktor č. 1 tři odporující si tvrzení. Bez přepisu nefungují úkoly 2 a 3.

**Co chci:**
- Kontextové menu klipu v projektu i na časové ose: **„Přepsat řeč“** (když přepis existuje: „Přepsat znovu“).
- Přepis nových videí se spustí **sám po importu, i bez AI**; volba „Automaticky přepisovat nová videa“ výchozí zapnutá a zobrazená tam, kde ji redaktor najde.
- Stav **u klipu v projektu** (ikona / proužek s %) a **v panelu Přepis** („Přepisuji řeč… 45 % · zbývá asi 6 min“) s tlačítkem **Zastavit**. Ne jen v AI panelu.
- Stejný soubor (stejný obsah, ne jen jméno) se podruhé **nepřepisuje** – hotový přepis z úložiště prohlížeče.
- Texty o přepisu všude stejné a pravdivé (nápověda, úvodní karta, AI panel), česky, bez technických pojmů.

**Hotovo, když:**
1. 28min rozhovor: do 5 s po importu u klipu i v panelu Přepis průběh v % s odhadem času, bez AI.
2. „Přepsat řeč“ z kontextového menu spustí přepis klipu importovaného s vypnutým auto přepisem.
3. Zastavit ukončí přepis do 2 s, CPU spadne; klip ukáže „Přepis zastaven – [Pokračovat]“; dosavadní část zůstane, pokud to jde.
4. Druhý import téhož souboru (i pod jiným jménem) má přepis do 3 s bez přepisovacího procesu.
5. V nápovědě, úvodní kartě ani AI panelu žádné neplatné tvrzení; vypsat texty do logu.
6. Žádný nový síťový požadavek kromě jednorázového stažení modelu.

## Úkol 2 – Panel Přepis: najdu výrok textem, kliknu na větu = In/Out (UX: ano)
**Proč:** redaktor č. 2 „Nemám jak najít výrok“ (+15–20 min poslechu); jeho „jedna věc“. Tester: titulek „Víš,“ = Out uprostřed věty. Pravidlo č. 1: nikdy useknuté slovo.

**Co chci:**
- Panel **„Přepis“** pro klip ve zdroji (nebo vybraný v projektu): věty s časem, hledání (Ctrl+F) se zvýrazněním, průběžné doplňování během přepisu (`partialForMedia`).
- **Klik na větu** = In/Out zdroje na hranice věty v pauze (`cutBounds`), hlava skočí na začátek. **Shift+klik** rozšíří na víc vět; vybrané zřetelně označené. Pak stávající Vložit / Vložit s posunem.
- Ruční In/Out uprostřed věty (při existujícím přepisu) → nenápadné „Konec je uprostřed věty – [Přichytit na konec věty]“.

**Hotovo, když:**
1. 28min rozhovor: najdu výrok hledáním a nastavím In/Out na 1–3 věty do 1 min bez poslechu (změřit).
2. 10 náhodných vět (klik i Shift+klik): hranice není uvnitř slova – RMS ±40 ms pod prahem pauzy; tabulka.
3. Úsek vložený z věty je ve výsledku celý, bez useknutého slova – poslechem exportu.
4. Upozornění na Out uprostřed věty se objeví, „Přichytit“ opraví; bez přepisu nic.
5. Česky, kontrast ≥ 4,5 : 1, cíle ≥ 24 px.

## Úkol 3 – Titulky z přepisu jedním klikem (UX: ano)
**Proč:** tester [3] a redaktor č. 1 – bez AI nejdou titulky; tester chyba 3 – rychlé opravy titulků, jedna se tiše neuložila.

**Co chci:**
- **Sekvence → Titulky → „Vytvořit titulky z přepisu“**, stejné tlačítko v okně Text v obraze; v AI panelu bez AI rychlá akce **„Titulky (bez AI)“**.
- Jen slova, která v sekvenci zazní (přepočet zdroj → timeline podle klipů).
- Styl podle tvaru (`captionlayout.js` / `SHAPES`, 9:16 = 30 %); volba „Zvýrazňovat vyslovované slovo“.
- Klip bez přepisu → spustí přepis a titulky se doplní („Čekám na přepis… 40 %“).
- Existující titulky → „Nahradit stávající titulky?“ (ruční opravy se ztratí).
- Celé vytvoření = **jeden** Ctrl+Z.
- Opravit ztracenou rychlou opravu titulku.

**Hotovo, když:**
1. Sekvence se 3 úseky (přepis hotový) → titulky do 5 s; 10 míst ±0,2 s; nic z vystřižených úseků.
2. 16:9 → titulky → Auto Reframe 9:16: titulky 30 %, mimo zóny, karaoke; 9:16 → titulky totéž.
3. Export 9:16 s vypálenými titulky, snímek do team/reports.
4. 5 rychlých oprav (Ctrl+A, psát, Enter) se uloží všech 5, 3×.
5. Ctrl+Z jedním krokem bez titulků, Ctrl+Y zpět.
6. Celá cesta bez AI: import → Přepis → In/Out → Vložit → Auto Reframe → titulky → nadpis → export, ani jednou výzva k AI.

## Úkol 4 – Čistý začátek nové verze (UX: lehká poznámka)
**Proč:** Ctrl+N vložil celý 28min klip; po Nový projekt zůstala hláška a **neviditelný text ze starého projektu** (riziko cizího nadpisu v exportu); osa zůstala oddálená na 28 min; „,“ nereagovala.

**Co chci:**
- **Nový projekt = úplně čistý stav** (sekvence, nadpisy, titulky, hlášky, chybějící média – ani v paměti, ani v záloze).
- **Nová sekvence: výchozí prázdná 9:16**; vybraný klip jen výslovnou volbou „Vložit vybraný klip“ (s In–Out, jinak celý s upozorněním na délku).
- Po prvním vložení do prázdné sekvence přiblížit osu na obsah.
- „,“ a „.“ na české klávesnici (`e.code`), nápověda zkratek pravdivá.

**Hotovo, když:**
1. Projekt s nadpisem a titulky → Nový projekt → nová sekvence → export 3 s: žádný text v obraze, žádná stará lišta; totéž po F5.
2. Ctrl+N s vybraným 28min klipem → prázdná 1080×1920.
3. Vložení 19s úseku do prázdné → úsek přes ≥ 70 % šířky osy.
4. „,“ vloží s posunem při skutečném stisku na české klávesnici.

## Co v tomhle kole NEDĚLAT
- Režim „Video pro sítě“ a krokový ukazatel; dialog Exportu, barvy, rohy, slovník – další kola.
- Auto Reframe u střihu kamery 7,64 s – **první úkol kola 2**.
- Přepisovatelný časový kód, zoom posuvníku – kolo 2.
- Měnit model rozpoznávání, jazyky, konektory, AI nástroje, `captionlayout.js` (jen použít).
- Označovat podezřelá slova – později.
- Nic mimo počítač, žádné jméno v aplikaci/adresách; neměnit sekvence uživatele; vše vratné přes Zpět.

Nasazení až po ověření; do `team/log.md` co prošlo s čísly, co neprošlo otevřeně.

## Zadání pro testera – kolo 2
Stejný materiál (Talk s Barborou Šimkovou, 28 min), **bez AI**, čistý projekt. Cíl: Reels 9:16, 15–20 s, výrok s titulky a nadpisem.
1. Import → průběh přepisu u klipu a v panelu Přepis; Zastavit / Pokračovat; druhý import téhož souboru (přepis hned). Časy.
2. Výrok **hledáním v přepisu**; klik / Shift+klik → Vložit; poslech hranic; ruční Out doprostřed věty.
3. Titulky z přepisu (menu, Text v obraze, AI panel bez AI) → Auto Reframe 9:16 → zóny, karaoke → 5 rychlých oprav → Ctrl+Z / Ctrl+Y.
4. Nový projekt po rozdělané práci, Ctrl+N s vybraným klipem, „,“ na české klávesnici.
5. Export: hlasitost, true peak ≤ −1 dBTP, titulky vypálené; drobnosti (lišta vs. Nápověda, předvolby, štítek zón, Poslat AI bez AI).
Váhy 1–3. Výstup `team/reports/report-2.md` + `shots-2/`.

## Zadání pro redaktora TN – kolo 2
**„Za 10 minut do porady: Reels 15–20 s se silným výrokem z rozhovoru, titulky, nadpis, bez AI.“** Import sám; přepis může běžet.
- Celkový čas import → soubor, zvlášť čas nalezení výroku.
- **ANO/NE: zvládl bych to sám?** Pokud NE, jediná věc, která chyběla.
- Každé zaváhání (kde hledal, co čekal, nejasné slovo).
- Poslal bys výsledek bez úprav na sítě TN?
Výstup `team/reports/redaktor-2.md` + `shots-redaktor-2/`.

Cíl kola 2: redaktor **ANO**, výrok do 2 min, celkem pod 10 min (bez čekání na přepis).
