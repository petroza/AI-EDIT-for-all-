# Tým v2 – ladění webové verze PZ AI Cut (od 2026-11-22)

Starý tým (vlastník, tester, redaktor, UX, ředitel) dělal hodně papírování a málo nálezů na kolo. Nový tým je menší,
každý má jednu otázku, na kterou odpovídá důkazem, a nikdo nečeká na jiného. Vývojář (hlavní relace Claude) třídí,
opravuje, nasazuje a ověřuje; agenti nic neopravují a nenasazují.

## Role – každá odpovídá na jednu otázku

| Role | Otázka | Jak | Výstup |
|---|---|---|---|
| **Redaktorka** (uživatel) | Udělám v tom za 10 minut video na sítě, aniž bych se zasekla? | Skutečný úkol od zadání po MP4, jen klikáním (žádný kód aplikace), měří čas a zaseknutí | `r<N>/redaktorka.md` |
| **Kontrolor výstupu** | Je hotové MP4 bezchybné pro diváka? | Exporty měří stroji: useknutá slova na střizích (lokální Whisper + RMS), probliknutí/černé snímky, A/V sync, hlasitost, titulky = řeč, výřez 9:16 bez prázdného záběru | `r<N>/vystup.md` |
| **Vzhled a jazyk** | Vypadá to profesionálně v obou jazycích a na běžných obrazovkách? | Snímky CZ/EN při 1366×768 a 1920×1080, nepřeložené texty (sken DOM), přetečení, chyby v konzoli, první spuštění | `r<N>/vzhled.md` |
| **AI tok** | Zvládne Claude/Codex přes konektor udělat zadání bez zbytečných kroků a s dobrým výsledkem? | Volá nástroje konektoru jako agent (`test/mcp-client.js`), hodnotí odpovědi nástrojů, chybové hlášky, okrajové případy | `r<N>/ai.md` |
| **Vývojář** (hlavní relace) | Co z toho opravit teď a je to opravdu opravené? | Seřadí nálezy (dopad × četnost), opraví, otestuje stejnou cestou, nasadí, zapíše PŘED/PO | `r<N>/vyvojar.md` + `team/log.md` |

## Pravidla (krátká)
1. **Každý nález = důkaz** (snímek, číslo, čas ve videu, přesný text) + **kroky k zopakování** + **závažnost**:
   3 = divák/uživatel uvidí chybu nebo se zasekne, 2 = zdrží / vypadá neprofesionálně, 1 = drobnost.
2. **Nic neopravuj, nic nenasazuj, necommituj.** Zápis jen do `team/v2/r<N>/` a `web/test-out/<role>-*`.
3. **Vlastní prohlížeč:** Chrome s vlastním profilem a ladicím portem (níže). Nikdy uživatelův Chrome ani panel prohlížeče aplikace Claude.
4. **Adresa vždy http://127.0.0.1:8791/** (server běží; jiný origin = jiné úložiště, chyběl by model a přepis).
5. **Ne opakovat staré** – co je v `team/log.md` jako známé a odložené, hlásit jen když se to zhoršilo.
6. Report začíná **třemi nejdůležitějšími nálezy**, pak zbytek. Max ~1 strana + tabulka; žádné úvahy navíc.

## Prostředí pro agenty
- Server: `node web/serve.js 8791` (běží), verze v `<script src="app.js?v=…">`.
- Prohlížeč (každá role svůj profil a port – profil už má stažený model přepisu a přepis 5min výřezu):
  `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=<port> --user-data-dir=%TEMP%\pz-r7-<role> --window-size=1440,900 http://127.0.0.1:8791/`
  porty: redaktorka 9371, výstup 9372, vzhled 9373, AI 9374. Na konci Chrome se svým profilem zavři.
- Ovládání: `CDP_PORT=<port> node O:\TN_strihatko\test\shot.js <šířka> <výška> <soubor.png|-> "<JS, await funguje, return …>"`
  (vyhodnotí v aplikaci, uloží snímek). Kliky/klávesy: přes JS (`element.click()`, `dispatchEvent(new KeyboardEvent…)`)
  nebo CDP `Input.dispatchMouseEvent` – redaktorka jen přes ovládací prvky UI (tlačítka, menu, zkratky), ne přes vnitřní API.
- Média: `O:/TN_strihatko/test/media/vyrez-5min.mp4` (5 min z rozhovoru TALK, **přepis už v profilu**),
  `C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4` (celý 28min rozhovor, v prohlížeči nepřepsaný – přepis trvá ~10–15 min).
  Import (systémový dialog automat neumí): `await __pzDevImport('/devfile?p=' + encodeURIComponent(CESTA), 'nazev.mp4')`.
- Export: `await __pzDevExport({ name: '<role>-…', burn: true, loudness: 'social' })` → `O:\TN_strihatko\web\test-out\`.
- Nástroje na PC: `ffmpeg`/`ffprobe` v PATH; Python s faster-whisper: `O:\ADOBEPREMIERESTRIH\.venv\Scripts\python.exe`
  (model `O:\ADOBEPREMIERESTRIH\models\whisper-large-v3`, device cuda – GPU sdílí i Hermes, buď střídmý: krátké úseky, `compute_type int8_float16`).
- **AI tok běží sám** (po ostatních): konektor posílá úkoly do karty, se kterou se naposledy pracovalo – s otevřenými
  stránkami ostatních rolí by mohl stříhat v cizím prohlížeči.
- Konektor: `node O:\TN_strihatko\test\mcp-client.js '[{"name":"editor_status"}, …]'` (stránka musí být otevřená v Chrome AI role;
  konektor mluví se stránkou přes 127.0.0.1:7895–7897).
- Kód a dokumentace: `O:\TN_strihatko` (README, `web/README.md`, `src/`, `web/`), historie `team/log.md`.
