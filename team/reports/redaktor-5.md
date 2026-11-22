# Redaktor, kolo 5: nový 5min rozhovor, notebook, prázdné úložiště, Reels 20–30 s ze dvou odpovědí, druhá přidaná až po titulcích, bez AI
(Uloženo vývojářem z textu agenta. Testovaná verze app.js?v=mwrc8zdt.)

**Zvládl bych to sám? ANO, s jednou potíží.** Od importu po uložené MP4 to trvalo **6:44** (import 05:36:20, MP4 05:43:04). Čekání bylo **asi 2:33**. Zhruba minutu jsem ztratil na tlačítku „Titulky z přepisu…“, které nic nedělá (viz chyba 1). Bez té chyby bych byl kolem 5:45.

## Výrok
- **Odpověď 1** (2:25–2:43, 0:17): „Všechno, naprosto všechno, protože moje máma byla tmel naší rodiny. To byl někdo, kdo držel celou rodinu pohromadě a kdo svolával nás všechny na obědy, svátky, narozeniny. Ona všechno organizovala.“
- **Odpověď 2**, přidaná až po titulcích (4:17–4:26, 0:09): „Jako musím říct, že v tomhle období mě taky hodně tady v práci vycházeli vstříc. Vlastně mi hodně říkali, nemusíš chodit, my to nějak zvládneme, dej si volno, dej si čas. A já jsem vlastně nechtěla.“
- **Nadpis:** „Šimková o mámě: Byla tmel naší rodiny“. Výsledek má 26,7 s.

## 1. Co aplikace říkala během čekání
- Po importu se přepis **spustil sám**, v kole 4 se to nedělo. Souběžně se stahoval přesný model.
- Hlášky: „Připravuji přesné titulky: stahuji 0 / 1 035 MB“ + „Přepisuji řeč… 0 % · odhaduji čas…“ → „15 % · zbývá asi 2 min“ (stálo na místě od 15 do 55 %) → „63 % · zbývá asi 60 s“, pak „50 s“ → „86 % · zbývá asi 30 s / 20 s“ (skákalo) a „Přepisuji dál… (hotovo do 3:59)“ → hotovo a „✓ Staženo – titulky z přepisu budou přesné“.
- Nápověda „Jen poprvé, asi 1 GB. Počítač to nezdržuje, můžeš pracovat…“ mě uklidnila.
- **Rozuměl jsem všemu.** Stahování ukazovalo megabajty. Velké zlepšení proti 2:40 „Připravuji…“ bez průběhu v kole 4.
- Přepis hotový za **2:00**, model stažený za **2:05**. Věty přibývaly už během přepisu.
- **Dialog titulků:** „Titulky se přepíšou přesně – asi 20 s. Přesně se přepíše jen 0:17 použitých úseků… Přepis v záložce Přepis zůstane standardní.“ Pak „Přepisuji titulky přesně… 7 %“ a „Skrýt – dokončí se samo“. Trvalo to 15 s, srozumitelné.

## 2. Časy po krocích
| čas | krok | trvání |
|---|---|---|
| 05:36:20 | Nový projekt + import | ~20 s |
| 05:38:19 | standardní přepis hotový, čekání | 2:00 |
| 05:38:45–52 | nalezení výroku a výběr („2 věty · 0:17“) | ~30 s |
| 05:39:08 | Vložit do nové sekvence, 9:16 předvybrané, OK | 16 s |
| 05:39:10–05:39:58 | „Titulky z přepisu…“ nereaguje (3×), pak Sekvence → Titulky → Vytvořit titulky z přepisu… | ~50 s ztráta |
| 05:40:02–17 | přesné titulky, čekání | 15 s |
| 05:40:39–58 | 2 opravy (Ctrl+A, napsat, Enter) | ~20 s |
| 05:41:00–17 | druhá odpověď: výběr 3 vět, „Přidat na konec sekvence“ | ~17 s |
| 05:41:20–35 | „Doplnit titulky…“ zase nereaguje, znovu přes menu | ~15 s |
| 05:41:35–50 | doplnění titulků, čekání | 15 s |
| 05:42:00–25 | nadpis (Sekvence → Titulky → Nadpis nahoře…) | ~25 s |
| 05:42:34–05:43:04 | Soubor → Exportovat média… → Exportovat → systémové okno → Esc → `__pzDevExport` | 30 s |
- **Celkem 6:44** (cíl ≤ 6 min nesplněn, část času přidává ovládání automatem). **Čekání asi 2:33** (cíl ≤ 3 min splněn).

## 3. Přidání druhé odpovědi po titulcích
- **Nic se nerozbilo.** 2 klipy (V1 i A1) bez útržků, 11 titulků: 6 starých (s oběma opravami) + 5 nových. Žádný titulek přes cizí řeč.
- Tlačítko Vložit: „Přidat na konec sekvence“, nápověda „Přidá úsek za poslední klip. Nic se nerozřízne…“. Pak „✓ Na konci · 0:17–0:26“ a hlavní tlačítko „Doplnit titulky…“, které nefunguje (chyba 1).
- Dialog (přes menu): „Doplní se titulky úseku bez titulků (1) – přepíše se přesně, asi 10 s. Přesně se přepíše jen 0:09 použitých úseků (2 úseky z klipu …). Hotové titulky (6) i tvoje opravy zůstanou.“ – „(1)“ a „(2 úseky)“ si protiřečí. Průběh „1 %“ celou dobu, pak hotovo (15 s).

## 4. Chyby v titulcích
- 11 titulků, **2 špatně, obě chyby slova**: „zvolával“ → „svolával“, „narozenina“ → „narozeniny“. **Cizí slovo 0, chybějící 0.** Přesné titulky slyšely i „pohromadě“, které standardní přepis vynechal.
- Cíl 0 cizích ✔, ≤ 1 oprava slova ✘ (2).

## 5. Export
- Bez obcházení to nešlo (systémové okno „Uložit jako“ automat neovládne). Po Esc Export zůstal otevřený s hláškou „Ukládání zrušeno – klikni na Exportovat…“ (v kole 4 se zavřel). Pak `__pzDevExport` (2,5 s).
- Technické hlášky dál: „Opus 160 kb/s – počítač nemá kodér AAC…“, „LUFS“, „.srt“.
- MP4: 1080×1920, 25 fps, 26,7 s, H.264 + Opus, 31,8 MB, −14,0 LUFS. Titulky 2 řádky, čitelné, nadpis nahoře, obličej nezakrývá.
- **Vada obrazu:** druhá odpověď začíná ~1,2 s prázdného stolu (střih kamery ve zdroji), výřez 9:16 bez obličeje.
- Zvuk na hranách (podle hlasitosti): začátek čistý, spoj 17,07 s bez useknutí, konec těsný (~100 ms).

## 6. Verdikt
**ANO na mém notebooku.** Bez úprav ne (2 chyby slov), po opravách ano – radši bych vyměnil začátek druhé odpovědi s prázdným stolem. **Nejvíc zdrželo** mrtvé hlavní tlačítko „Titulky z přepisu…“ / „Doplnit titulky…“.

## Co se mi líbilo
- Přepis se spustil sám, stahování v MB, čekání 2 min a srozumitelné. Přesné titulky z úseků za 15 s, výrazně lepší než standardní.
- Druhá odpověď po titulcích je bezpečná, opravy zůstaly, dialog to předem řekne. Klik + Shift+klik, 9:16 předvybrané, nadpis s kurzorem v poli, opravy Ctrl+A / Enter, Export po Esc nezmizí.

## Co mě zdrželo (váha 1–3)
- **3** mrtvé hlavní tlačítko (chyba 1). **2** prázdný stůl na začátku druhé odpovědi v 9:16. **2** 2 opravy slov. **1** systémové okno uložení. **1** odhady (2 min od 15 do 55 %, skákání), doplňování „1 %“. **1** „(1)“ × „(2 úseky)“, technické hlášky v exportu.

## Chyby s kroky
1. **Hlavní tlačítko v Přepisu nereaguje:** výběr → Vložit do nové sekvence → „Titulky z přepisu…“ → klik nic (3×); totéž „Doplnit titulky…“. Příčina: dvě tlačítka `id="trNext"` (šipka ▼ hledání ř. 181 a hlavní tlačítko ř. 572), `$('trNext').onclick` najde šipku → hlavní tlačítko mrtvé a **šipka ▼ ve vyhledávání otevře dialog titulků** (i „Nahradit titulky“). Snímek 15.
2. **Prázdný stůl v 9:16:** druhá odpověď (4:17) → ~1,2 s celku se stolem (export-t17.5.png, w-17-19.png).
3. **Chyby slov v přesném přepisu:** „zvolával“, „narozenina“.
4. **Doplnit titulky:** průběh „1 %“ až do konce (~15 s).

## Nápady
- Opravit duplicitní `id`. Při vložení do 9:16 přeskočit/zvýraznit první vteřiny bez obličeje. Průběžný odhad přepisu. V doplnění „1 úsek bez titulků (0:09)“. V exportu AAC/Opus a LUFS do „Podrobností“.

## Snímky a export
`web/test-out/redaktor-5.mp4`; `team/reports/shots-redaktor-5/` (01–09c, 11–15, 10-export-systemove-okno-ulozit-jako.png, export-t*.png, export-prehled.png, w-17-19.png, w-konec.png).
