# Návrh UX – kolo 3: smazání titulku, uvozovky, stálý dialog, texty k přesnému přepisu
(Uloženo vývojářem z textu agenta – UX designér, 2026-11-22; aplikace otevřená na 127.0.0.1:8791 při 1366×768.)

## 0. Naměřeno v aplikaci
- „stalo.“ jde pořád jako první titulek; na ose blok 13×19 px → hlavní cesta ke smazání je seznam.
- Dialog Titulky z přepisu: 0 ms 441×179, „Vytvořit“ x 789 / y 433; po 1 s 458×223, 798 / 455 (+9 / +22 px) – `#cfMsg` při otevření prázdný.
- Patička Titulků 1366×768 = 78 px (tip na 3 řádky), seznam 204 px.
- Přepis 1366×768 se stahováním a výběrem: stav 52 + patička 120 px → seznam 74 px = 1 řádek. U „≥ 8 řádků“ uvádět stav.
- Neověřeno: po importu klipu s hotovým přesným přepisem začalo stahování 930/1037 MB (designér zastavil); stránka se 2× sama znovu načetla.

## 1. Úkol 3 – seznam titulků
### 1.1 Smazání (vše jeden krok Zpět „Smazat titulek“)
| Kde | Jak | Pozn. |
|---|---|---|
| Řádek (fokus, bez psaní) | Delete i Backspace | `ev.repeat` ignorovat |
| Psaní v řádku | prázdné + Enter | pod polem „Prázdný titulek – Enter ho smaže, Esc vrátí text“; prázdné + ↑/↓, klik mimo, Esc = vrátit text |
| Pravý klik na řádek | `Upravit text Enter` · `Přehrát titulek Mezerník` · ― · `Smazat titulek Del` | nejdřív fokus na řádek |
| Titulek na ose | pravý klik → `Upravit text titulku` · ― · `Smazat titulek` | levý klik beze změny |
| Psaní v Programu | prázdné + Enter | zástupný text „Enter smaže titulek · Esc vrátí“; klik mimo/Esc s prázdným = vrátit |
Maže jen titulek (obraz, zvuk, přepis beze změny); sousedé se neposouvají. lang: „Smazat titulek“; menu „Smazat titulky“ → „Smazat všechny titulky“.
### 1.2 Potvrzení a Zpět
Žádný dialog. Seznam: řádek zmizí, patička `Smazán titulek „stalo.“` + [Vrátit] (28 px, „Vrátit smazání (Ctrl+Z)“), bez toastu. Z osy/Programu toast
„Titulek smazán: „stalo.“ · Vrátíš Ctrl+Z“. Ctrl+Z: titulek zpět, seznam na něj odroluje, fokus, 1 s blikne; Ctrl+Y znovu smaže. Smazání se do „Opraveno“ nepočítá; počet z historie.
### 1.3 Fokus po smazání
Delete: fokus na řádek, který zaujal místo (u posledního předchozí), hlava na jeho začátek, bez přehrání, scrollTop beze změny. Prázdný Enter: smaže a otevře psaní
v následujícím. Poslední titulek smazán → prázdný stav s fokusem na [Vytvořit titulky z přepisu]. Z osy/Programu fokus zůstane, seznam se překreslí na stejném scrollTop.
### 1.4 Tip v patičce (≤ 2 řádky)
„Klikni do titulku a oprav ho. Enter uloží a další, Esc zruší, Delete smaže titulek.“
### 1.5 Uvozovky
Text titulků (z přepisu, Nahradit, opravy v seznamu i obraze; pojistka i v .srt): `"` i `“ ” „` → „ na začátku / za mezerou, `(`, `[`, pomlčkou; jinak “.
Podle okolí, ne párování; mezera za „ a před “ pryč; apostrofy beze změny; v opravě převádět až při uložení.
### 1.6 Dialog „Titulky z přepisu“
`#cfMsg` pevně `width: 420px`, `min-height: 54px`; jméno klipu ≤ 40 znaků; hned při otevření šedě „Zjišťuji, která slova v sekvenci zazní…“; popisek tlačítka správný hned
(Vytvořit/Nahradit), `min-width: 180px`, zarovnání vpravo, může být neaktivní; kontrola `#cfOk` 0 ms = 1000 ms.

## 2. Úkol 1 – texty
### 2.1 Po Standardním přepisu na pomalejším počítači (slot `#trStatus`, 52 px)
Řádek 1 (11,5 px #8e8e8e): „Přesný přepis má asi o polovinu méně chyb.“ + × („Skrýt – Přepsat přesněji najdeš i v menu ≡“); řádek 2: tlačítko přes šířku 24 px
**„Přepsat přesněji (asi 12 min, můžeš dál pracovat)“** (úzké: „Přepsat přesněji (asi 12 min)“ + title). Jen když přepis hotový a standardní, přesný jde a Standardní byl
zvolen kvůli odhadu > 14 min. X min = naměřená rychlost × délka + příprava (+ stažení); zaokrouhlení jako etaText. Klik: bez stahování rovnou, se stahováním dialog 2.2.
Zmizí po ×, spuštění, přepnutí na Přesné. Slabý počítač: šedý řádek s × „Na tomto počítači jde jen standardní přepis – přesný by tu trval příliš dlouho.“
### 2.2 Dialog „Přepsat přesněji?“
„Přesný přepis dělá méně chyb, ale trvá déle – u tohoto klipu asi 12 min. Můžeš mezitím normálně pracovat.“ (vč. přípravy a stažení); šedý odstavec beze změny;
3. řádek: nestaženo „Poprvé se stáhne asi 1 GB – jen jednou.“ / staženo „Nic se nestahuje. Než přepis začne, chvíli se připravuje – pár sekund až 2 minuty.“
(se změřenou minulou přípravou `pzAsrPrepSec`: „…minule to trvalo asi 2 min“; < 20 s „pár sekund“, 20–90 s „asi minutu“). Řádek existuje vždy (min-height 18 px), jen se doplní.
### 2.3 Během přípravy
Stahování: „Stahuji rozpoznávání řeči… 507 z 1037 MB · jen jednou“ (bez „příště to jde hned“). Příprava: „**Připravuji přesný přepis… 0:45** · minule asi 2 min ·
zatím platí dosavadní přepis“ [Zastavit], čas po sekundách, neurčitý pruh (úsek 30 %, #8b5cf6); bez měření „· obvykle pár sekund až 2 min“; > 60 s a > 2× obvyklé
„· trvá déle než obvykle“. Standardní: „Připravuji přepis… 0:12“. Pak „Přepisuji přesněji… 3 % · odhaduji čas…“.

## 3. Zásady: H1, H3 + H5 (Zpět místo potvrzování), H4, H6, stálá poloha cílů. Barvy a rozměry z aplikace.
## 4. Otevřené body: 1) Přepis 1366×768 se stavem a výběrem = 1 řádek (kratší varování v patičce); 2) stahování po importu klipu s hotovým přesným přepisem.
