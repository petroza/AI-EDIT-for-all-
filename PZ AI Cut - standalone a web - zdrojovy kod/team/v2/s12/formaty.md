# S12 – Formáty a fps (PZ AI Cut Standalone, instance 9379, 1366×768, cs, --ai)

**Verdikt:** běžné zdroje (25/50/30p, 9:16, 1:1, rotace z mobilu, 4K HEVC 10 bit, ProRes, MXF, mono/stereo/5.1, 44,1/96 kHz,
WAV/M4A) se importují, stříhají a exportují **bez ztráty i zdvojení snímku, A/V sync ≤ 1 ms, hlasitost přesně −14,0 / −23,0 LUFS**,
10 min klip bez driftu. Pro TV workflow ale tři vážné díry: **anamorfní 1440×1080 se exportuje 4:3 (zmáčknuté)**, **druhá mono
stopa (MXF z kamery, 2× mono v MP4) zmizí** a **obrázek se exportuje jako 1 snímek (PNG) nebo export spadne (JPG)**.

## Tři nejdůležitější nálezy
1. **Neštvercové pixely ignorovány (3).** `anam.mp4` 1440×1080 SAR 4:3 (DAR 16:9) → sekvence 1440×1080, náhled i export
   1440×1080 **SAR 1:1 DAR 4:3**; referenční čtverec má po exportu poměr **0,750** (zdroj 1,000), H.264 i ProRes.
   Archiv XDCAM HD 35 / HDV / DVCPRO HD je přesně tenhle formát. Snímek `shots-formaty/anam.png` (čtverec je obdélník na výšku).
2. **Druhá samostatná mono stopa se ztratí (3).** `mxf_xdcam.mxf` (XDCAM 1080i25, ch1 = 300 Hz, ch2 = 1700 Hz) i `a_2mono.mp4`:
   v Projektu `audioChannels: 1`, na ose jen A1, v exportu oba kanály = **jen 300 Hz (−13,6 dB), 1700 Hz chybí (< −60 dB)**.
   Kamera s mikrofonem reportéra na ch2 = ztracený zvuk. (Premiere dá A1 + A2.) Snímek `shots-formaty/mxf_xdcam.png` (A2 prázdná).
3. **Obrázky (3).** PNG i JPG se naimportují (přes „Všechny soubory“), náhled ukazuje obraz, klip 3 s na ose. Export PNG:
   exportér hlásí `duration 3`, ale soubor má **1 snímek / 0,04 s** (H.264 i MXF). Export JPG **spadne** surovou chybou
   `ffmpeg exited with code 3199971767 … Invalid data found … video.txt` (H.264, XDCAM), ProRes `Failed to set value '0:v' for option 'map'`.

## Varianty (střih = 2 kusy `in 1–4 s` a `6–9 s` za sebou; sync = pípnutí 1 kHz proti číslu snímku, metoda ±1 ms)
| Varianta | Import / náhled | Sekvence z klipu | Export (H.264 + MXF/ProRes) | Snímky | A/V sync | LUFS |
|---|---|---|---|---|---|---|
| 25p 1080 | OK | 1920×1080 25 | OK + XDCAM | 150/150, bez ztrát | 0 ms | −14,0 / −23,0 |
| 29,97p 1080 | OK | 29.97 | H.264 OK; **XDCAM 178/180** (viz #4) | H.264 180/180 | ≤ 6 ms (pod snímek) | OK; **konec zvuku −94 ms** (#5) |
| 23,976p 1080 | OK | 23.976 | OK + ProRes (rate `2997/125`, #12); XDCAM správně zakázán | 144/144 | ≤ 6 ms | OK; konec −94 ms |
| 50p 1080 | OK | 50 | OK + XDCAM | 300/300 | 0 ms | OK |
| 59,94p 720 | OK | 59.94 | H.264 OK; **XDCAM 355/360** | H.264 360/360 | ≤ 6 ms | OK; konec −94 ms |
| 30p 1080 | OK | 30 | OK + ProRes; XDCAM zakázán | 180/180 | 0 ms | OK |
| 1080i25 tff | OK, **náhled s hřebenem** | 25 (bez prokladu) | pole zachována (pořadí 0…449 správně), ale **označeno progressive** (#6) | 150, pole bez ztráty | 0 ms | OK |
| VFR (Ø 29,6) | OK | **1280×720 29.605** (#7) | OK + ProRes; XDCAM zakázán | 178: 2× zdvojený, 2× vynechaný (převod VFR→CFR) | −13…+7 ms | OK; konec −87 ms |
| 4K HEVC 10 bit | OK (proxy) | 3840×2160 25 | OK + ProRes 4K | 100/100 | +20 ms (in 0,5 s mimo snímek, #10) | OK |
| rotace 90° | OK, na výšku správně | 1080×1920 | OK, čtverec 1,000 | 150/150 | 0 ms | OK |
| 9:16 / 1:1 | OK | 1080×1920 / 1080×1080 | OK, čtverec 1,000 | 150/150 | 0 ms | OK |
| SAR 4:3 anamorf | OK, **náhled 4:3** | **1440×1080** | **DAR 4:3, čtverec 0,750** (#1) | 150/150 | 0 ms | OK |
| mono | OK | – | stereo L=R (220 Hz −13,5 dB) | OK | 0 ms | OK |
| 5.1 | OK | – | downmix: L = FL + FC/BL −3 dB, R = FR + FC/BR −3 dB, LFE vypuštěno | OK | 0 ms | OK |
| 2× mono stopa | OK, **ch=1** | – | **2. stopa chybí** (#2) | OK | 0 ms | OK |
| 44,1 / 96 kHz | OK | – | 48 kHz | OK | 0 ms | OK |
| bez zvuku | OK | – | OK, bez zvukové stopy | 150/150 | – | – |
| WAV / M4A | OK | 1920×1080 25 (černá) | OK + XDCAM | – | WAV 0 ms; M4A −3,5 / −16 ms (#11) | OK |
| MP3 | OK | 1920×1080 25 | OK, ale **díra ~15 ms na každém střihu** (#8) | – | +17/+30 ms na začátku kusu | OK |
| AAC (ADTS) | OK | 1920×1080 25 | OK | – | celé +21,3 ms (priming, #11) | OK |
| PNG / JPG | OK, náhled OK | 1920×1080 25 | **PNG 1 snímek, JPG chyba** (#3) | 1 | – | – |
| MXF XDCAM zdroj | OK (proxy), **náhled s hřebenem** | 1920×1080 25 | OK + XDCAM; 2. kanál chybí | pole OK | 0 ms | OK |
| ProRes MOV zdroj | OK (proxy) | 1920×1080 25 | OK + XDCAM | 150/150 | 0 ms | OK |
| useknutý MP4 | toast „Nejde importovat: corrupt.mp4 (poškozený nebo nepodporovaný soubor)“ – čitelné | – | – | – | – | – |
| **Smíšená 25p** (25 + 29,97 + 50 + 23,976 + VFR + 10 min 29,97) | OK | 25p z 1. klipu | H.264 614 s, XDCAM 2–14 s a 594–614 s | 29,97→25: kroky 1×59 / 2×15; 50→25 každý 2.; 23,976→25 3 zdvojené – reálná rychlost, žádný konform (jako Premiere) | obraz vs osa −13…+20 ms po celých 600 s, **bez driftu**; zvuk 10min klipu −21,3 ms konst. (#9) | −14,0 / −23,0 |

## Nálezy
| # | Záv. | Nález | Důkaz / zopakování |
|---|---|---|---|
| 1 | 3 | Anamorf (SAR ≠ 1) se exportuje zmáčknutý 4:3 | `anam-h264.mp4`, `anam-prores_hq.mov`: 1440×1080 SAR 1:1 DAR 4:3, čtverec 162×216 px; `src/core/media.js probe()` bere `width` bez SAR |
| 2 | 3 | Z víc zvukových stop se čte jen první | `mxf_xdcam-*`, `a_2mono-*`: 1700 Hz chybí v obou exportech; probe bere `streams.find(audio)` |
| 3 | 3 | Obrázek: export PNG = 1 snímek, JPG = pád s chybou ffmpeg | `img_png-h264.mp4` nb_frames 1, 0,04 s; `results.json` img_jpg (3 chyby) |
| 4 | 2 | XDCAM 29,97p/59,94p ztrácí poslední snímky a má vadný index | `v2997p-xdcam.mxf` 178 sn./5,939 s (chybí sn. 267, 268), `v5994p-xdcam.mxf` 355/360; ffprobe: `index entry 177 + TemporalOffset 1 = 178, which is out of bounds`; H.264 stejné sekvence 180/180 |
| 5 | 2 | Sekvence 29,97/23,976/59,94/VFR + hlasitost Sítě/TV: zvuk končí dřív než obraz | 6,006 s sekvence: zvuk do 5,912 s (−94 ms) H.264 i ProRes; VFR −87 ms; 8,008 s 23,976 −92 ms; 30 s 29,97 −3 ms; 120 s −13 ms. S `loudness: off` 0 ms; 25p (6,00–6,20 s, 9 délek) vždy 0 ms |
| 6 | 2 | Prokládaný zdroj: náhled i export bez odstranění prokladu, export označen progressive | `shots-formaty/i25-zoom.png`, `mxf-zoom.png` (zdvojené číslo „f126/f127“); `i25-xdcam.mxf` field_order progressive, horní pole = sudý 50p snímek – obsah 1080i ve značce 1080p |
| 7 | 2 | VFR z mobilu → sekvence 29,605 fps (nestandard) | `fpsOf()` bere avg_frame_rate 1125/38; export H.264 `r_frame_rate 355/12`, ProRes `5921/200`; dialog Export „1280×720 · 29.605 fps“ a XDCAM „ne pro tuhle velikost obrazu“ (`shots-formaty/export-dialog-vfr.png`) |
| 8 | 2 | MP3: ~15–20 ms ticha na začátku každého kusu (lupnutí na střihu) | `au_mp3-h264.mp4`: RMS 2,995–3,010 s = −87/−94 dB, 0–0,015 s = −140 dB; pípnutí na začátku kusů +29,6 / +17,3 ms |
| 9 | 1 | Klip od začátku souboru (in = 0) u MP4 s AAC a videem bez B‑snímků: zvuk o 1024 vzorků (21,3 ms) napřed | `mix25-h264.mp4` 10min klip −21,3 ms konst., `t3-long-only.mp4` totéž; čistým ffmpeg `-ss 0.0000 -i long2997.mp4` ověřeno; `v25p` (s B‑snímky) in = 0 → 0 ms |
| 10 | 1 | In-point mimo hranici snímku (typicky časy slov z přepisu/AI) → obraz zaokrouhlen nahoru, předbíhá zvuk o 0–40 ms | v25p in 1,01 → první snímek 26 (1,04 s), obraz −30 ms; in 1,03 → −10 ms; hevc in 0,5 → 20 ms |
| 11 | 1 | Čistý AAC (ADTS) +21,3 ms celý (priming), M4A po střihu −16 ms | `au_aac-*`, `au_m4a-*` (sync sloupec) |
| 12 | 1 | ProRes 23,976 zapsán jako `2997/125` místo `24000/1001`; XDCAM zakázán s textem „ne pro tuhle velikost obrazu“, i když vadí jen fps | `v23976p-prores_hq.mov`; dialog u 1280×720 29,605 |
| 13 | 1 | Název výstupu s tečkou bez přípony se ořízne | API `output: …/formaty-s12-len-6.04-social` → `formaty-s12-len-6.mp4` (dvakrát přepsán) |

Bez nálezu: rotace, 9:16/1:1, 4K HEVC 10 bit (proxy), 44,1/96 kHz, mono → L=R, 5.1 downmix, bez zvuku, ProRes/MXF jako zdroj,
čitelná chyba poškozeného MP4, hlasitost všech exportů se zvukem −14,0 / −23,0 LUFS (TP ≤ −4,8 dBFS), smíšené fps bez driftu za 600 s.

Pomůcky místo nativních dialogů: import `TN.app.importPaths`, vložení `TN.app.dropMedia` (sekvence z klipu), export
`exporter.exportSequence` (h264 social, MXF/ProRes tv); dialog Export otevřen a prohlédnut (snímek výše). Zdroje: `gen.py` →
`%TEMP%\pz-s12-formaty-media\` (čárový kód čísla snímku + časový kód + pípnutí 1 kHz/1 s). Data: `s12/formaty/` (`results.json`,
`ana.json`, `mix-*.json`, `tabulka.txt`, skripty `ana.py`, `mixana.py`, `run.js`, `drv.js`), exporty `web/test-out/formaty-s12-*` (79 souborů).
