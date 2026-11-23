# Kolo S10 – Kontrolor výstupu: ověření oprav po S9 (HEAD b47efd0)

**Verdikt: NEPOUŠTĚT bez opravy titulků (nález 1).** Opravy z 32dd765 fungují:
- b-roll v 9:16 je čistý (S9 #1 opraveno),
- zvuk rozříznutý žiletkou nebo výřezem se exportuje vzorek po vzorku stejně jako vcelku (0 cvaknutí, sync 0),
- exporty se proti S9 změnily jen tam, kde se to čekalo.

Rozříznutí zvuku na střizích kamery ale rozbije **titulky vytvořené až po výřezu**, což je doporučený postup (Auto Reframe → Titulky z přepisu). Divák pak vidí:
- zdvojené slovo,
- titulek bliknout na 0,30 s,
- mezeru bez titulku uprostřed věty.

## Nálezy

| # | záv. | nález | důkaz | S9 → S10 |
|---|---|---|---|---|
| 1 | **3** | **Titulky po výřezu se lámou na neviditelných řezech zvuku.** Generátor bere každý kus A1 jako samostatný úsek („7 úseků z klipu“). Na řezu uprostřed souvislé řeči proto titulek utne.<br>**Auto Reframe z menu → dialog Titulky z přepisu** (kopie `s10-multi916-cc`):<br>• „moderátorku / v rádiu.“ 48,20–49,18 a hned **„rádiu.“ 49,18–49,48 (0,30 s)** – slovo leží přes řez 49,48, takže je v titulcích dvakrát,<br>• „A pak jsem / začala dělat“ jen 45,92–46,48 (0,56 s). Řeč trvá do 48,20, takže **46,48–48,20 je bez titulku**,<br>• „takový ty / chlácholivý věci.“ 32,71–**33,56**, ale slova trvají do 34,55 (z 16:9 bylo správně 32,71–34,55).<br>**Vložení z Přepisu do 9:16** (`s10-v916`, stejné jako S9):<br>• „takový ty chlácholivý věci.“ 2,91–**3,76** (S9 do 4,70),<br>• „Takže to přišlo úplně,“ 45,95–**46,60 (0,65 s)**, další titulek až 47,33 – **0,73 s řeči bez titulku**.<br>**16:9 po úklidu krajů** (`s10-a`, `a916`, `a11`, `a1080`): „Všechno, …“ začíná až v **7,52** místo 7,36 (slovo začíná 7,36). V `s10-a` se tím dva titulky spojily v jeden na 5,01 s (6 → 5 titulků, .srt MXF také). | `titulky-multi916-po-reframu.txt`, `titulky-v916-rez.txt`, `words.log` (časy slov)<br>Snímky:<br>• `shots-vystup/03` (export 46,2 / 47,2 / 48,6 / **49,3 s „rádiu.“**),<br>• `02` (4,20 s a 47,00 s: S9 titulek, S10 nic) | **regrese** (S9: zvuk v celku, titulky v pořádku) |
| 2 | 2 | **Sekvence z `api.reframeSequence` (MCP `reframe_sequence`, záložní cesta Auto Reframe bez MediaPipe) zůstávají rozpojené.**<br>• Kusy obrazu V1 po řezu kamery mají `linkId null` a zvuk se nerozřízne („osiřelý“). `relinkAV` je jen v `web/ai/reframe.js`, ne v `src/core/pmcp-api.js`.<br>• Shift+Delete kusu 33,56–45,92 v `s10-sim916` smaže **jen obraz, zvuk zůstane 33,56–45,92** (pod černou).<br>• Sekvence z menu Auto Reframe (`s10-multi916`) jsou propojené správně a Shift+Delete tam smaže obraz i zvuk. | `linkcheck.txt` (a916, a11, sim916, sim11, razor916), `ripple916.log` | = S9 (oprava nepokryla tuto cestu) |
| 3 | 1 | **Úklid krajů „lead“ v 16:9 nechá osiřelý kousek zvuku.** `s10-a`: V1 2,76–7,52 je propojený se zvukem 2,76–7,24 (L-střih −7 sn., v pořádku). Kus **A1 7,24–7,52** (začátek slova „Všechno“) má ale `linkId` obrazu, který neexistuje – nepohne se s ničím. Rozříznutí zároveň způsobuje posun titulku v #1. | `linkcheck.txt` (s10-a, s10-a1080) | nové |

## Ověřeno OK

**(1) S9 #1 – b-roll na V2 v 9:16** (`v916d.js`, `undo916.js`): opraveno.
- V2/A2 20,28–23,00, obojí propojené. Hláška „Na kraji klipu bylo opraveno pár snímků jiného záběru kamery (Ctrl+Z vrátí)“. Kroky „Overwrite“ a „Clean up camera-cut leftovers“.
- 1× Zpět vrátí stav po výřezu (0,28 s celku, už propojené), 2× Zpět stav před vložením, Znovu stav po úklidu.
- **Export** `v916`: střihy 3,76 / 20,28 / 45,88 / 46,60, **0 krátkých záběrů** (S9: 7 sn. na 20,00). Proti S9 se liší jen snímky 500–506 (20,00–20,24, prům. chyba 70,5; ostatní max 0,49). Snímek `shots-vystup/01`.
- Zvuk v916 proti S9 se liší jen v 20,0–20,28 (zvuk b-rollu odstřižený s obrazem). Normalizace +0,04 dB, −14,1 LUFS.
- 16:9 (`s10-a`, V2): beze změny, hláška jako v S9.
- Drop na **konec V1** (`dropv1.log`) dál nechá 7 sn. celku v 9:16 i v 16:9. Úklid V1 bez souseda neumí, stejně jako v S8/S9 – nejde o regresi.

**(2) Zvuk rozříznutý na kusy** (`razor.js`, Ctrl+K uprostřed slov):
- **Exporty se shodují s nerozříznutými:**
  - PCM `razor-pcm` = `sim-pcm`, `razor916-pcm` = `sim916-pcm`, `razormulti-pcm` = `pcm-mix` (A1–A3) – vše **bitově shodné**,
  - H.264 zvuková stopa: 0 odlišných paketů,
  - obraz se liší jen kódováním (prům. chyba 0,07–0,44, 0 snímků > 3).
- **Cvaknutí:** 0,04–0,37 na všech řezech (limit 1,5) – razor, razor916, razormulti, a/a916 (7,52), v916 (3,76 / 45,88 / 46,60) (`cvak2.txt`, `cvak.txt`).
- **Sync obraz/zvuk:**
  - `razor` 16:9: 6 klipů obraz +0 sn., zvuk 0,0 ms,
  - `a` +0 sn. / 0,0 ms,
  - v916 a razor916 zvuk 0,0 ms (`sync.txt`).
- **Záložní cesta bez čtení vcelku** (`razor-g`: kus −0,01 dB, čte se zvlášť): posun 0 vzorků, reziduum −98 až −100 dBFS (`pcmrez.txt`). Na těchto řezech by tedy necvakalo ani bez nové opravy.

**(3) Regrese exportů proti S9** (`md5-vs-s9.txt`, `framemd5-vs-s9.txt`, `obraz-vs-s9.txt`):
- **Bitově shodné (20):** sim/sim916/sim11/k219×3/multi×4/pcm×4, sim-bez, sim916-bez, In/Out, ProRes HQ + .srt sim1080 a multi1080.
- **MXF** (a1080, sim1080, multi1080 XDCAM, DNxHR): všechny proudy framemd5 = S9. Liší se jen kontejner, stejně jako v S9.
- **`a`, `a11`, `a916`:** zvuk shodný. Obraz se liší jen v titulcích 7,04–12,68 s (spodní pás `a`; horní 75 % prům. 0,05) – příčina je v #1.
- **`a1080-xdcam.srt`:** 5 titulků místo 6 (#1).
- **`v916`, `v916-bez`:** zlepšení (bod 1). `v916` má navíc jiné titulky (#1).
- **Hlasitost:** −13,9 / −14,1 LUFS, peak −1,4/−1,5, jako v S9.

**(4) Propojení** (`links.js` → `linkcheck.txt`): OK u v916, multi916/11, drop916b, razor, razormulti. `rep` (k219×3) je bez propojení, V1 0–1,36 je propojený se zvukem 0–1,52 (+4 sn., zopakované snímky konce). Výjimky viz #2 a #3.

## Jak jsem testoval
- **Instance:** `node test/standalone.js start 9372 %TEMP%\pz-s10-vystup --size 1366x768 --lang cs --ai`. Přepisy byly hotové z cache Workeru.
- **AI panel:** Claude, Codex ani Hermes jsem nespustil.
- **Konec:** `stop 9372`, port volný (jen TIME_WAIT). Instanci 9371 jsem nepoužil.
- **Stavba:** stejné skripty jako v S9 (s9→s10): `build`, `caps` (dialog), `b1080`, `build-multi`, `rf` (menu `__pzReframe`), `v916a–d`, `v916f`, `drop916`, `drop916c`.
- **Nové skripty:** `dropv1.js`, `undo916.js`, `razor.js` (cmd addEdit), `ripple916.js` (cmd rippleDelete), `capcopy.js`, `links.js`, `linkcheck.py`, `cvak2.py`, `pcmrez.py`, `words.js`.
- **Exporty:** pomůckou `exporter.exportSequence` **místo dialogu** (dialog jsem tentokrát neotevíral). 41 souborů `web/test-out/vystup-s10-*`.

## Neověřeno
- Předvybrané MXF = −23 LUFS v dialogu Export.
- Shift+Delete v `s10-multi916`: obraz i zvuk zmizely, ale **mezera 33,56–45,92 zůstala** (mezitím je b-roll V2 40,28–43). Jestli je to záměr pravidla z S6, jsem nehodnotil.
- MCP `add_captions` po `reframe_sequence` (cesta #2 zvuk nedělí, nález 1 by se jí neměl týkat – nezkoušeno).
- Whisper na střizích (zvuk je mimo v916 20,0–20,28 bitově shodný s S9).
