# Report – kolo 1: krátké video na Instagram Reels (9:16) z rozhovoru

Tester: kolega z redakce, aplikaci vidí poprvé. Datum: 2026-11-21. Zdroj: Talk s Barborou Šimkovou (28 min, 1280×720),
importovaný přes `__pzDevImport` jako `rozhovor.mp4`. Výsledek: sekvence „Reels test 1 9x16“ (18 s, 1080×1920),
export `O:\TN_strihatoko\web\test-out\tester1-reels-final.mp4`. (Uloženo vývojářem z textu agenta.)

## Co se mi líbilo
- Ruční střih jako v Premiere: dvojklik → zdroj, I/O, šipky po snímku, Shift+šipka po 5, tlačítko Vložit s posunem – tři úseky za pár minut.
- Auto Reframe 9:16 rychlý (~10 s), nová sekvence, původní zůstane; obličej v detailech na středu; střihy kamery uvnitř úseku sám rozřízl (5,76 s, 16,0 s).
- Bezpečné zóny se po reframe zapnou samy.
- Okno „Text v obraze“ přehledné, změny hned vidět; skvělé varování na zónu popisku.
- Karaoke vypadá profesionálně, sedí s řečí, přežije ruční opravu.
- Oprava titulku kliknutím (časová osa i obraz) rychlá: Ctrl+A, psát, Enter.
- Undo/redo ukazuje, co vrací. Export 18 s za ~3,5 s, −14,0 LUFS. Dialog vysvětlí Opus (Windows N).
- CZ/EN přepnutí přeloží vše včetně AI panelu.

## Co se mi nelíbilo / zdrželo (váha 1–3)
1. [3] Titulky do hotové sekvence bez AI nejdou – Sekvence → Titulky nemá „Přidat titulky z přepisu“, okno Text v obraze taky ne.
2. [3] Přepis už naimportovaného videa nejde spustit (kontextové menu klipu ho nenabízí); jen volbou „Automaticky přepisovat nová videa“ v AI panelu → Připojení.
3. [2] Nápověda tvrdí „Řeč se sama přepíše“, ale volba byla vypnutá a nic se nestalo/neohlásilo; průběh přepisu je vidět jen v AI panelu (záložka Zadání), ne u klipu.
4. [2] Časový kód v monitoru nejde přepsat (skok na čas); posuvník na 28min klipu hrubý (1 px ≈ 3,5 s).
5. [2] Klávesa „,“ (Vložit s posunem) nereagovala (I/O ano) – ověřit (automat / rozložení klávesnice).
6. [1] Nová sekvence s vybraným klipem vloží celý 28min klip – chybí volba prázdné sekvence.
7. [1] Nadpis je přes celé video, na časové ose není vidět, nejde časovat (jen hák 0–3 s).
8. [2] Auto Reframe nerozřízl střih kamery v 7,64 s výstupu (detail moderátorky → široký) – 0,4 s špatně oříznutý široký záběr (shots-1\a_t7.8.jpg).
9. [1] Přepnutí jazyka přenačte AI panel a skočí na Připojení; první klik na vlajku po zavření Exportu nereagoval.
10. [2] Druhý import téhož souboru se přepisuje znovu od nuly, CPU „kritické“ ~12 min, nejde zastavit.

## Chyby
1. Lišta „Nenalezená média…“ překrývá rozbalené menu Nápověda – klik na „Jak na video pro sítě“ trefí lištu (2× zkoušeno).
2. Export: true peak +0,2 dBFS při −14 LUFS – pro sítě strop ≤ −1 dBTP.
3. Rychlé opravy titulků po sobě: jedna („psa la“ → „psala“) se neuložila bez upozornění; pomalu prošla. Prověřit, jestli písmena nešla jako zkratky.
4. AI panel → Poslat AI bez připojené AI: zadání se tiše zapíše do Průběhu, nic se neděje, chybí hláška.
5. Anglické texty v CZ: dialog Nová sekvence (předvolby „custom“, „1080×1920 (vertical 9:16 – Reels, TikTok, Shorts)“, „square 1:1“, „4:5 Instagram“), štítek „Reels / TikTok / Shorts UI“.
6. Kontextové menu klipu „Zobrazit v Průzkumníku“ ve webu nedává smysl.
7. AI panel: „Paměť karty (RAM)“ matoucí.
8. Soubor → Exportovat verze pro sítě… – nic viditelného (asi systémový výběr složky, automat nevidí) – neověřeno.
9. Konzole: stovky ERR_CONNECTION_REFUSED na 127.0.0.1:7895–7897/hello (jen info).

## Kvalita výsledku
1080×1920, 25 fps, H.264 + Opus, 18,1 s, −14,0 LUFS. Obličej na středu, nadpis nad hlavou, titulky ve 26 % výšky, karaoke
čitelné. Chyby rozpoznávání na 18 s: 5 oprav („dlou hudbu“, „hredství“, „účitě“, „vým“, „psa la“, „novu“). Poslední titulek
„Víš,“ – useknutá věta (chyba Out), aplikace by mohla upozornit.

## Nápady
1. Ruční „Přidat titulky“ (Sekvence → Titulky → Vytvořit z přepisu) + v kontextovém menu klipu „Přepsat řeč“ s průběhem na ikoně.
2. Přepisovatelný časový kód v monitorech, zoom posuvníku.
3. Out uprostřed věty (je-li přepis) → upozornit / přichytit na konec věty.
4. Nadpis jako klip na stopě titulků (časovat na 0–3 s).
5. V Text v obraze zvýraznit podezřelá slova z rozpoznávání.
6. Po Auto Reframe ohlásit krátké široké záběry („zkontroluj 7,6–8,0 s“).
7. Limiter −1 dBTP při exportu pro sítě.
8. Nepřepisovat stejný soubor podruhé; tlačítko Zastavit přepis.

## Soubory
Export: `web/test-out/tester1-reels-final.mp4`; snímky `team/reports/shots-1/` (a_contact, a_cmp, b_contact, b_cmp, a_t*, b_t*,
ui_00…ui_03). V projektu zůstaly sekvence „Reels test 1“, „Reels test 1 9x16“ a média rozhovor.mp4, rozhovor-prepis.mp4.
