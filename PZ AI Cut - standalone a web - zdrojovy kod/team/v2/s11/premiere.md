# S11 – Střihač z Premiere (10 let TV zpravodajství v Premiere Pro)

Instance `node test/standalone.js start 9375 %TEMP%\pz-s11-premiere --size 1920x1080 --lang cs --ai` (AI panel ani agent
nespuštěn), média `test/media/vyrez-5min.mp4` přes `TN.app.importPaths` (systémový dialog automat neumí). Klávesy přes
`test/cdp.js key`, výsledky přes `TN.app.seq()` (výpis klipů `id@start[in-out]Llink`) a snímky v `s11/shots-premiere/`.
Exporty pro měření zvuku přes `exporter.exportSequence` (místo dialogu) → `web/test-out/premiere-s11-*.mp4`.
Referenční výchozí zkratky Premiere: `Adobe Premiere Pro Defaults.kys` (výpis z dřívějšího kola).

## Verdikt
**Doma se tu cítím zhruba z 85 %.** Základ střihu je překvapivě věrný Premiere: J/K/L, I/O, `,` `.`, Q/W, Ctrl+K /
Ctrl+Shift+K, `;` `'`, X, šipky mezi střihy, ripple/roll/trim tažením včetně Ctrl (ripple) a Alt (jen jedna strana),
source patching, track targeting, S, `\` `=` `-`, F, G, M/S, timecode `1015` / `+10` / `-1.` – vše se chová jako v Premiere.
Ruce mě ale zradí ve třech věcech, které dělám denně: **Ctrl+tažení klipu (insert) tu klip přepíše a smaže**,
**Ctrl+Shift+D udělá na střihu propad zvuku místo prolnutí (a sáhne i na jiné střihy)** a **solo stopy se do exportu nepromítne**.

## Tři nejdůležitější nálezy

| # | Záv. | Kroky | Premiere Pro | PZ AI Cut (důkaz) | Jak moc vadí |
|---|---|---|---|---|---|
| 1 | **3** | V1: …`x1pc@4[60-62]`, `2wq8@6[15-20.04]`, `8dm6@11.04[30-40]`. Ctrl+tažení těla `8dm6` doleva, start na střih 6,00 (`drag "1300,776,1088,776" Ctrl`) | Ctrl+drag = **insert**: klip se vloží na 6,00, `2wq8` se posune za něj, nic se nesmaže (Ctrl+Alt = rearrange, zavře i mezeru po klipu) | Chová se jako **overwrite**: `V1: … x1pc@4 8dm6@6[30-40]` – **klip `2wq8` (5 s řeči) zmizel**, bez varování. Stejný výsledek jako bez Ctrl. Větší tah (`drag "1300,776,870,776" Ctrl`) smazal 3 klipy a zkrátil 4. (`wv63@0[10-11.04] 8dm6@1.04`). Snímky `18a-pred-ctrl-drag.png` → `18b-po-ctrl-drag.png`, `18-ctrl-drag.png`. V kódu `timeline.js` move = jen `E.moveClips` (Ctrl jen přepne výběr). Ctrl+Z vrátí. | Přeskládání výroků Ctrl+tažením je v zpravodajství denní chleba; ruka to udělá automaticky a obsah zmizí. Kdo si nevšimne hned, má díru ve stories. |
| 2 | **2** | Playhead na střih 11,04 (bez výběru) → Ctrl+Shift+D. Export s/bez přechodu, RMS po 40 ms | Default audio transition = Constant Power **crossfade 1 s jen na tom jednom střihu** (přes handles, bez propadu) | Nastaví `fadeIn=fadeOut=0.24` (6 snímků) **na obou koncích** obou klipů u playheadu: `j83a@6 0.24/0.24`, `zg17@11.04 0.24/0.24` → zvuk na střihu klesne k nule a **přibude fade i na nedotčeném střihu 6,00 a na konci sekvence 21,04**. Měření (`premiere-s11-fades.mp4` vs `-nofades.mp4`): okno 6,00–6,16 s −51/−45/−36/−34 dB místo −29/−32/−29/−29; okno 11,04 −53 dB místo −35. Shift+D na vybraném klipu dělá totéž (obě strany zvuku). Snímek `12-ctrl-shift-d.png`. | Zvukovou prolínačku dávám na každý střih ve výpovědi, aby necvakl – tady naopak vznikne slyšitelné „zalknutí“ a navíc na místě, kde jsem nic nechtěl. |
| 3 | **2** | A2 (prázdná) → S (solo). Náhled vs export | Co slyším s mute/solo, to se vyexportuje (nejisté pro solo v exportu, mute jistě) | Náhled: `audioAt(seq,8)` = `[]` (A1 ztlumená solem A2). Export `premiere-s11-solo-a2.mp4`: `mean_volume −32.5 dB, max −12.6 dB` – A1 v exportu zní. Exporter zná jen `muted`, `solo` ne. Snímek `15-solo-a2.png`. Mute A1 se do náhledu i exportu promítá správně (`14-mute-a1.png`). | Solo používám na kontrolu jedné stopy a zapomenu ho vypnout – v náhledu ticho, v exportu plný zvuk (nebo naopak čekám ticho a nedostanu ho). Nesoulad náhled ≠ export je horší než chybějící funkce. |

## Další odchylky

| # | Záv. | Kroky | Premiere Pro | PZ AI Cut (důkaz) | Jak moc vadí |
|---|---|---|---|---|---|
| 4 | 2 | Ve zdroji zůstaly značky 60–65 z dřívějšího vložení. Playhead 15,0 na klipu `8dm6[30-40]` → F | Match Frame otevře zdroj na snímku **a nastaví In/Out zdroje podle klipu** (30–40) | Zdroj na 33,96 s (správný snímek), ale `srcIn 60, srcOut 65` – staré značky; monitor ukazuje délku 00:00:05:00. Snímek `09-match-frame.png`. | Po F hned mačkám `,` / `.` na znovuvložení nebo prodloužení – tady vloží úplně jiný úsek. |
| 5 | 2 | Klik na `8dm6` (nevybraný) → Alt+tažení nahoru na V2 | Alt+drag = **kopie** klipu (originál zůstane) | Klip se **přesune** (jen video část), nic se nezkopíruje: `V1: …2wq8`, `V2: 8dm6@11.04`, zvuk `zg17` zůstal na A1. Kopie tažením neexistuje (`timeline.js` – Alt jen vybere jednu stranu). | Duplikace b-rollu Alt+tažením je běžná; tady místo kopie vznikne díra ve V1. (Zda Premiere kopíruje i propojený zvuk – nejisté.) |
| 6 | 1–2 | Vybrat klip `x1pc` → Shift+D; pak Ctrl+Z | Apply Default Transitions to Selection = video i audio přechod na **všech střizích** výběru, jeden krok Zpět | Video prolínačka jen na **jednom** kraji (nejbližším k playheadu: `x1pc:cross` na 4,00), zvuk fade na obou koncích; **Zpět potřebuje 2× Ctrl+Z** (1. vrátí „Použít zvukový přechod“, 2. „Prolínačka“). Snímek `11-shift-d.png`. | Zmate, ale je to vidět na ose. |
| 7 | 1 | Klávesy R, U, P, T, Shift+L, Shift+J | R Rate Stretch, U Slide, P Pen, T Text; Shift+L/J pomalý shuttle | `TN.app.tool` se nezmění (R→ zůstal rolling, U→ slip, T/P→ zoom); nástroj Text v panelu „zatím není“. Shift+L: čas zdroje 3,6709 → 3,6709 (nic). | Rate Stretch občas na dorovnání b-rollu pod komentář; ostatní zřídka. |

## Co funguje jako v Premiere (ověřeno)
- **J/K/L** ve zdroji: L ≈1×, L L ≈2× (2,2 s za 1 s), J zpět ≈1×, K stop. **I/O**: Out je včetně snímku (O na 20,00 → 20,04, délka 00:00:10:01).
- **`,` insert / `.` overwrite** ze zdroje podle source patchingu; přesun patche na V2 vloží video na V2 + zvuk na A1, vypnutý patch A1 = jen video (`16-patch-v2-overwrite.png`). `,` bez sekvence sekvenci sám založí (Premiere by nic neudělal – příjemnější).
- **Q/W** (ripple trim k playheadu, i s propojeným zvukem), **Ctrl+K** jen na cílových stopách (A1 vypnutý → řez jen V1, `02-ctrlk-a1-necileny.png`), **Ctrl+Shift+K** přes všechny stopy i necílené.
- **Lift `;` / Extract `'`** podle In/Out (`03-lift.png`), **X** = In/Out kolem klipu, výběr mezery kliknutím + Delete = ripple delete mezery.
- **Šipky ↑/↓** mezi střihy (0 → 5 → 10 → 15,04 → 25,04, na krajích stojí), **\\ `=` `-` / Numpad +** zoom.
- **Alt+klik** = výběr jen videa; **Shift+Delete** na samotném videu nechá mezeru a vysvětlí proč (`05-alt-klik-shift-delete.png`); **Ctrl+L** rozpojí i znovu spojí (Shift+klik video+zvuk).
- **Trim tažením**: V = trim s mezerou, Ctrl+tažení kraje = ripple, Alt+tažení kraje = jen video (L-cut, `08-alt-trim.png`), **B** ripple (`06`), **N** rolling. **S** snapping (s ním 5,52 = playhead, bez 5,60).
- **A/Shift+A/B/N/C/V/Y/H/Z** nástroje, **Ctrl+D** prolínačka 1 s na nejbližším střihu, vidět v náhledu i na ose (`10-ctrl-d.png`).
- **G** dialog Nastavit na / Změnit o (−6 dB i při výběru jen videa → propojený zvuk), **M** mute (náhled i export).
- **Timecode** v monitoru: `1015` → 10,60 s, `+10` → +10 snímků, `-1.` → −1 s. **Ctrl+Z / Ctrl+Shift+Z** fungují, stav „Zpět: …/Znovu: …“.
- **Propojení po Auto Reframe 9:16** (`reframe916`, `17-reframe-916.png`): všech 5 videí má po 1 zvuku se stejným startem (posun 0); Ctrl+K i Shift+Delete v 9:16 řežou/mažou obojí.

## Poznámka pro tým
`test/cdp.js key Enter|Escape` posílá `key` malými písmeny (`enter`, `escape`), takže dialogy (G, timecode) testem Enterem/Escem
nepotvrdíš – to je vada pomůcky, ne aplikace (použil jsem `KeyboardEvent` s `key:'Enter'` / klik na OK).
