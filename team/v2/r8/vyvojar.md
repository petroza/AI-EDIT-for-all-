# Kolo 8 – vývojář (nasazeno app.js?v=mws68wvn, 2026-11-22)

Výsledek: kraje klipů – konce o 1 lepší na seedu A, bez zhoršení na nezávislém seedu B. Zbylé chyby jsou souvislá řeč bez ticha na hranici (aplikace varuje).

## Kraje klipů (`transcripts.js edgeIn/edgeOut`, `EW.noOverreach`)
Příčina (seed A, 20 výroků, `node test/edges.js web/test-out/prepis-presny-po.json <TALK> --random 14 --seed 70811`):
když v úzkém okně u hranice věty není ve zvuku pauza, hledání šlo až 0,75 s ven a vzalo pauzu za celými slovy sousední věty
(N6 konec „…život. **Aby**“, N2 konec „musíš… **Musí ho někdo**“, N7 „nebylo? **Já jsem**“, N2/N12 začátek „nasbírala, ne?“).
Oprava: když by vybraná pauza přeskočila celé sousední slovo (podle přepisu, tolerance 0,12 s), střih se přesune do nejtiššího
místa mezery mezi slovy na hranici – **jen když je tam opravdu ticho** (první verze bez této podmínky: konce 19/20, ale R 23:20 a
N12 se zhoršily – časy přepisu jsou posunuté a „nejtišší místo“ leželo v řeči).

| sada | PŘED (začátky / konce) | PO | změny |
|---|---|---|---|
| A seed 70811 (20) | 17/20 · 16/20 | 17/20 · **17/20** | N6 konec ✘→✔ (bez „Aby“) |
| B seed 90233 (26) | 20/26 · 24/26 | 20/26 · 24/26 | 3 začátky blíž větě (N7 +0,26 s, N13 +0,17 s, N20 +0,65 s), verdikty beze změny |
Výstupy: `edges-pred.*`, `edges-po.*`, `edges2-pred.*`, `edges2-po.*` (PŘED = `PZ_EW='{"noOverreach":false}'`, stejný kód a rozhodčí).
Zbývá (souvislá řeč, varování „začátek/konec“ se ukáže): N2, N7, N9, N12 na seedu A.

Testy 37/37, B1 9/9, connector-pin 5/5.
