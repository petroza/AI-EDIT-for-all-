# Kolo S15 – AI tok (standalone + MCP MY Premiere MCP + AI panel, jen Hermes) – regrese proti S12 (HEAD cb50867)

**Verdikt:** S15 **lze pustit**. Všechny 4 ověřované změny drží: přepis z izolované instance jede bez 401, fronta ukazuje
správné počítadlo a je vidět při 1366×768, „Nestihli jsme se s mámou rozloučit“ už filtr nevyřadí, výpis píše „plánování trvalo X s“.
Hranice čisté **44/44**, titulky z přepisu 174/174 slov. Zbývá **obsah upoutávek** (vytržené odkazy, beze změny proti S12)
a nová past v panelu: **druhý klik na „20 s“ po kartě Upoutávka délku zruší → vznikne 14min „upoutávka“**.

**Jak jsem testoval:** `standalone.js start 9374 %TEMP%\pz-s15-ai --size 1366x768 --lang cs --ai` (14:03:44), most 7880 = renderer
PID 70936, rodič 40216 = moje instance (`--remote-debugging-port=9374`); jiná instance PZ neběžela. Worker PID 42648 (start 13:58:35,
codeStamp 13:53), **nerestartován**. MCP přes `s15/ai/mcp.js` (PMCP_PORT=7880), hranice `scripts/check-cuts.mjs`, Whisper `hranice.py`,
ffmpeg. Panel ovládán přes CDP (`element.click()`), agent `#agent = hermes`; Claude ani Codex nespuštěny, 👍/👎 ani Export ve výpisu
neklikány. Na konci `stop 9374` – porty 9374/7880 volné, kopie `token.txt` z profilu smazána. Nic neopraveno, necommitováno.

## 3 nejdůležitější nálezy

1. **(2) Karta Upoutávka sama zvolí 20 s; klik na „20 s“ délku vypne → panel postaví 13:57 min dlouhou „upoutávku“ z 39 úseků.**
   - Kroky: AI panel → karta **Upoutávka** (šablona má `data-len="20"`, čip 20 s se rozsvítí) → klik na **20 s** (redaktor si délku
     „potvrdí“) → čip zhasne (přepínač `targetSec = targetSec === s ? 0 : s`, `src/ai/main.js:170`) → Spustit/„+“.
   - Výsledek: ve frontě „[Hermes · AI-S15 Bara cela]“ bez délky, výpis „✔ vybráno 134 vět, odhad 812 s“, sekvence
     **„STRIH HERMES 14:07:02“ 00:13:57**, 39 úseků, **14× ⚠ zvuk na hranici** (−10,8 až +6,5 dB), 1× souvětí utnuté (#209→#210),
     „plánování trvalo 90 s“. Slovo „upoutávka“ v zadání bez délky nevede na režim upoutávky.
   - Důkaz: `shots-ai/p01-upoutavka-20-pred.png` (žádný čip nesvítí), `p07-upoutavka-bez-delky-14min.png`, `ai/p-out-fronta.txt`,
     `ai/p-upoutavka-bez-delky-seq.txt`.
2. **(2) Upoutávky dál skládají vytržené věty → falešné souvislosti (beze změny proti S12 #1).**
   - **MCP rozhovor.mp4 20 s** [23–24, 219, 228 w4–10, 255]: „…A proto jsem se dostala na Novu jako reportérka.“ → „My jsme
     vlastně vůbec neměli možnost se **na to** připravit.“ (ve zdroji = smrt mámy, #217–218) → „Není věc, kterou já bych **ji** neřekla.“
     → „Já **ji** nemůžu zavolat…“ – máma ani úmrtí v upoutávce nezazní, „na to“ zní jako nástup na Novu, „ji“ bez antecedentu.
   - **Panel 15 s** (zadání „Upoutávka na 15 sekund…“, Bára) [hák 234,72 s, 195–196, 207]: „Jsem na Novo, ale v tom životopise nic
     nebylo.“ (hák uprostřed souvětí, jako S12) → „Prostě to období bylo… strašně nečekaný, protože… **ona** je nemocná.“ = kariéra → nemoc.
   - **Nekonzistentní kontrola kontextu:** „Často rozhodně nezahojí.“ (#265, odpověď na moderátorku #262/#264) je v panelu 15 s ve
     „vyřazeno – vytržené by zkreslilo význam“, Hermes ji v Výroku rozhovoru sám nazval „bez kontextu působí matoucně“ – a přesto je
     **závěrečným úderem MCP 30 s i panelu 30 s**. Ten úder (1,64 s) navíc začíná ~0,4 s celkem (wide) a pak skočí na detail:
     panel to hlásí „🎞 ⚠ 00:25:41.04 … obraz jen bleskne“, MCP `built.warnings` je prázdné.
   - Důkaz: `ai/r1.log`, `ai/rozhovor-vety.txt`, `ai/p-out-vse.txt` (ř. 115–135), `ai/b30.log`, `ai/p-upoutavka15-seq.txt`,
     `shots-ai/b30-posledni-uder-snimky.png`, `ai/w-casto.txt`.
3. **(1) Drobnosti výpisu / filtru zdvořilostí.**
   - Jeden střih obrazu ohlášen dvakrát: „00:25:41.04: 0.38 s po začátku klipu“ + „00:25:42.67: 1.25 s před koncem klipu“ = tentýž
     střih v 1541,42 s (klip 1541,04–1542,68) – `p-out-vse.txt` ř. 117–118.
   - `_SMALLTALK` (worker/analysis.py:1506) hledá fráze jen na **začátku věty** → Bářino „Krásný den, Kristýnku, tak moc děkuji za tenhle
     krásný úvod.“ (#7) i moderátorčino „No a vám přeji krásný zbytek dne…“ (#295) projdou. V upoutávkách S15 se to neprojevilo
     (moderátorka se vyřazuje zvlášť, #7 Hermes nevybral) – jen riziko. Silné výroky („Nestihli jsme se s mámou rozloučit.“, „Děkujeme
     všem hasičům…“, „…díky nim…“, „děkuji za to, že se to stalo“) správně ponechány. Důkaz `ai/zdvorilosti.txt`.
   - Hlavička panelu „Claude připojen“ i při Hermes (S11/S12 #7 beze změny, `p03`, `p06`).

## Tabulka nálezů
| # | tok | nález | důkaz | záv. |
|---|---|---|---|---|
| 1 | 3 | Karta Upoutávka + klik na 20 s = bez délky → 13:57 min, 39 úseků, 14 ⚠ hranic | `p01`, `p07`, `p-out-fronta.txt` | **2** |
| 2 | 1, 3 | Vytržené odkazy (rozhovor 20 s „na to“/„ji“, panel 15 s kariéra → nemoc); věta „vyřazená“ v jednom běhu je závěrem 30 s; v 30 s záběr bleskne 0,4 s | `r1.log`, `p-out-vse.txt`, `b30.log`, snímky | **2** |
| 3 | 3 | Střih obrazu ohlášen 2× (od začátku i od konce klipu) | `p-out-vse.txt` | 1 |
| 4 | 1 | Filtr zdvořilostí jen na začátku věty (#7 „Krásný den… děkuji za úvod“ projde) – zatím bez dopadu | `zdvorilosti.txt` | 1 |
| 5 | 1 | **Délky** MCP Bára 15→16,40 (109 %), 20→17,28 (86 %), 30→25,36 (85 %); panel 15→13,52 (90 %), 20→17,28, 30→25,36; rozhovor MCP 20→18,44 (92 %), výřez 5 min 20→20,56 (103 %); Výrok 30 s: výřez panel 31,68 / 75s klip 31,84, rozhovor MCP **33,28 (111 %, stejně jako S12)**; 10 s → 11,08 / 9,84 | `b*.log`, `r1.log`, `p-*-seq.txt` | 1 |
| 6 | 1 | Panelový Výrok 30 s z `vyrez-5min` (bez mluvčích) obsahuje otázku moderátorky #21 (8,96 s z 31,68 = 28 %) přes „bez moderátora“; `reason` chválí P3 za „úvodní ‚Absolutně‘“, výběr ale začíná #18 | `p-vyrok-seq.txt`, `v-transcript.txt`, `p-out-fronta.txt` | 1 |
| 7 | 3 | „Claude připojen“ při Hermes (beze změny) | `p03`, `p06` | 1 |
| ok | – | **Token Workeru (změna 1):** nový 75s záznam přepsán z izolované instance za 15,9 s (vč. načtení Whisperu), 18 vět v panelu; MCP `transcribe_media` (skutečný profil) tentýž přepis z cache → oba klíče přijaty; worker.log od startu 0× 401/chyba, 0× CUDA error, 16× plan_edit | `a02-prepis-novy.png`, `n0.log`, `worker.log` | – |
| ok | – | Přepis `vyrez-5min` (67 vět) a Bára 28 min (409 vět v aplikaci / 295 v MCP s mluvčími) z cache | `a01`, `v-transcript.txt` | – |
| ok | 2 | **Titulky z přepisu** (Sekvence → Titulky → Vytvořit titulky z přepisu, dialog → Vytvořit): 25 titulků, **174/174 slov shodně** s přepisem, max řádek 38 zn., nejkratší 1,09 s; MCP `add_captions` na upoutávce 30 s: 9 titulků = celý text všech 5 úderů | `n-captions.txt`, `b30-captions*.{log,txt}` | – |
| ok | 3 | **Fronta (změna 2):** 2 zadání → štítek „Fronta 1“ = „1 čeká“, seznam 301×67 px; 3 zadání → „Fronta 2“ / „2 čeká“, 301×88 px, všechny řádky vidět; počítadlo klesá 2→1→0 v pořadí; každá úloha se zdrojem z aktivní sekvence při zařazení (Bára / vyrez5 / 75s) | `p03`, `p05`, `p06` | – |
| ok | 1 | **Zdvořilosti (změna 3):** „Nestihli jsme se s mámou rozloučit“, „Děkujeme všem hasičům…“, „Na závěr…“, „Příště…“ ponechány, „Děkuji moc za pozvání“, „Ahoj, Bára“, „Máme ještě dvě minuty“ vyřazeny; v upoutávkách 0× pozdrav/poděkování | `zdvorilosti.txt` | – |
| ok | 3 | „plánování trvalo X s“ místo „plán 9 s“ (21 / 29 / 12 / 15 / 6 / 8 / 3 / 90 s) | `p-out-vse.txt` | – |
| ok | 1 | `reason` bez rozporné „původní úvahy modelu“ – začíná „Údery (výběr upravila kontrola bez modelu): …“ se skutečnými údery; MCP 15 s má úvahu modelu, která sedí na vybrané U4/U5/U3 | `b15/b20/b30.log` | – |
| ok | 1 | Moderátorka v upoutávkách Bára 0 % (90 vět vyřazeno), odpověď bez otázky 0×, „To nepotřebujeme slyšet.“ už nevybráno (S12 ano) | `b*.log`, `p-out-vse.txt` | – |
| ok | 1, 4 | **Hranice:** check-cuts **44/44 čistých** (8 sekvencí: MCP 15/20/30, rozhovor 20 + Výrok 30, výřez 20, panel 20 s, panel Výrok 30), řezy −20 až −44 dB; `edges`/`retriedForEdges` prázdné | `cc-vse.log` | – |

**Neověřeno:** 👍/👎 a „⬇ Export MP4“ ve výpisu (zapisují skutečná data / míří mimo test-out), Stop během běhu, 9:16 z panelu (v S12 OK).
Konzole: jen 2 známá varování Electronu (webSecurity, insecureContent) jako v S12, 0 chyb/výjimek.

## Srovnání s S12
| oblast | S12 | S15 |
|---|---|---|
| přepis z izolované instance | OK (token kopií) | OK, nový záznam 15,9 s, 0× 401; token z `PZ_WORKER_APPDATA` |
| fronta – štítek / seznam | „Fronta 0“ při „1 čeká“, seznam 10 px | **opraveno**: Fronta 1/2 = N čeká, 67–88 px, vše vidět |
| délka MCP 15/20/30 | 14,56 / 21,00 / 24,60 | 16,40 / 17,28 / 25,36 |
| délka panel 20 s | 17,28 | 17,28 (+ 15 s → 13,52, 30 s → 25,36) |
| Výrok 30 s rozhovor | 33,28 (111 %) | 33,28 (111 %) beze změny |
| `reason` | skutečné údery + rozporná původní úvaha | jen skutečné údery (opraveno) |
| výpis času | „plán 9 s“ | „plánování trvalo X s“ (opraveno) |
| „To nepotřebujeme slyšet.“ | použito i „vyřazeno“ zároveň | už jen ve „vyřazeno“ |
| falešné souvislosti | 4 případy | 2 případy (rozhovor 20 s, panel 15 s) + „Často rozhodně nezahojí“ vyřazeno/použito |
| zdvořilosti | – | silné výroky ponechány (změna ověřena) |
| hranice | 32/32 | 44/44 |
| nové | – | past karta + čip 20 s → 14min sestřih |
| Hermes | 11 úloh, 0× CUDA | 16 úloh, 0× CUDA |

**Soubory:** logy `team\v2\s15\ai\` (`a0`, `a1`, `n0`, `n-captions.txt`, `b15/20/30.log`, `b30-captions*`, `r1.log`, `p-out-fronta.txt`,
`p-out-vse.txt`, `p-*-seq.txt`, `cc-vse.log`, `w-casto.txt`, `zdvorilosti.txt`, `bara-vety.txt`, `rozhovor-vety.txt`, `v-transcript.txt`,
`worker.log`, `console-panel.jsonl`, pomůcky `mcp.js`, `seq.sh`, `listen.js`, `hranice.py`). **Snímky** `team\v2\s15\shots-ai\`
(`a01–a03`, `p01–p07`, `b30-posledni-uder-snimky.png`). Testovací médium `%TEMP%\pz-s15-ai-media\s15-novy-75s.mp4` (výřez 1180–1255 s z Báry).
