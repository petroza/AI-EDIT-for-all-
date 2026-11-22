'use strict';
/* Titulky: styl a skládání podle skutečné šířky textu v cílovém obraze – jedno místo pro náhled (src/ui/player.js),
 * webový export (web/export-web.js), okno Styl titulků (src/ui/captionstyle.js) a nástroje AI (web/ai/tools.js).
 *
 * Styl sekvence (seq.captionStyle):
 *   lines 1–3 · maxChars znaků na řádek · size násobek velikosti písma · pos výška spodního okraje titulku v % výšky
 *   color barva písma · box podklad pod textem (true/false)
 * Přeskládání (reflow) vychází z textu hotových titulků – ruční opravy se zachovají; časy slov uvnitř titulku se
 * odhadnou podle pozice znaků. */

const FONT = '"Segoe UI", Arial, sans-serif';
const WIDTH = 0.88; // titulek smí zabrat nejvýš tuto část šířky obrazu
// 9:16: sloupec tlačítek Reels/TikTok vpravo (16 % šířky, 42–78 % výšky) – titulek na středu nejvýš 68 % šířky (16–84 %)
const WIDTH_TALL = 0.68;
function capWidth(W, H) { return shapeOf(W, H) === 'tall' ? WIDTH_TALL : WIDTH; }

/* Výchozí hodnoty podle tvaru obrazu. 9:16 (Reels, TikTok, Shorts): dolní ~22 % a pravý sloupec zakrývá rozhraní
 * aplikace (jméno, popisek, ikony) → titulky výš, ve 30 % výšky, a větší písmo pro telefon. 4:5 a 1:1 ve feedu
 * rozhraní obraz nepřekrývá → níž. frac = velikost písma jako podíl výšky obrazu. */
const SHAPES = {
  tall: { pos: 30, maxChars: 20, frac: 0.040 },     // 9:16 (kolo 7: užší kvůli sloupci tlačítek)
  portrait: { pos: 10, maxChars: 28, frac: 0.036 }, // 4:5
  square: { pos: 7, maxChars: 30, frac: 0.042 },    // 1:1
  wide: { pos: 5, maxChars: 40, frac: 0.042 },      // 16:9
};
function shapeOf(W, H) { const r = W / H; return r < 0.7 ? 'tall' : r < 0.95 ? 'portrait' : r < 1.06 ? 'square' : 'wide'; }
function defaultStyle(seq) {
  const shape = seq ? shapeOf(seq.width, seq.height) : 'wide';
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('pzCapStyle.' + shape) || 'null'); } catch (e) { /* bez úložiště */ }
  const d = SHAPES[shape];
  return Object.assign({ lines: 2, maxChars: d.maxChars, size: 1, pos: d.pos, color: '#ffffff', box: false }, saved || {});
}
function styleOf(seq) { return Object.assign(defaultStyle(seq), (seq && seq.captionStyle) || {}); }
/** Zapamatuje si styl jako výchozí pro další titulky stejného tvaru obrazu (9:16, 4:5, 1:1, 16:9). */
function rememberStyle(seq, st) {
  try { localStorage.setItem('pzCapStyle.' + shapeOf(seq.width, seq.height), JSON.stringify(st)); } catch (e) { /* bez úložiště */ }
}
/** Výchozí styl tvaru bez uložených úprav (tlačítko Výchozí). */
function factoryStyle(seq) {
  const d = SHAPES[shapeOf(seq.width, seq.height)];
  return { lines: 2, maxChars: d.maxChars, size: 1, pos: d.pos, color: '#ffffff', box: false };
}

/** Velikost písma jako podíl výšky obrazu. */
function fontFrac(W, H, st) { return SHAPES[shapeOf(W, H)].frac * ((st && st.size) || 1); }

let mctx = null;
function measurer(seq, st) {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  const fs = Math.round(seq.height * fontFrac(seq.width, seq.height, st));
  const font = `700 ${fs}px ${FONT}`;
  // rezerva 6 %: okraj podkladu a zaokrouhlení písma v malém náhledu (jinak by se tam řádek zalomil navíc)
  const maxW = seq.width * capWidth(seq.width, seq.height) * 0.94 - (st.box ? fs * 0.6 : 0);
  return (t) => { mctx.font = font; return mctx.measureText(t).width <= maxW; };
}

/* Kde se dobře láme (řádek i titulek): po interpunkci ano, za předložkou / spojkou / jednopísmenným slovem ne
 * (česká typografie: „v / Praze“ ne). Vrací přirážku k ceně zlomu za slovem w. */
const WEAK = new Set(['a', 'i', 'o', 'u', 'v', 'z', 's', 'k', 've', 'ze', 'se', 'na', 'do', 'od', 'po', 'za', 'pro', 'při', 'bez', 'nad', 'pod', 'před', 'mezi', 'přes',
  'ke', 'ku', 'že', 'aby', 'ale', 'nebo', 'ani', 'jak', 'když', 'který', 'která', 'které', 'což', 'to', 'ta', 'ten', 'tak', 'jako', 'by', 'si', 'mi', 'mu',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'with', 'by', 'from']);
function breakCost(w) {
  const x = String(w || '');
  if (/[.?!…]$/.test(x)) return -14;
  if (/[,;:–—)]$/.test(x)) return -9;
  const bare = x.toLowerCase().replace(/[^\p{L}]/gu, '');
  if (bare.length === 1) return 14;         // v, k, s, z, o, u, a, i – na konci řádku nikdy
  if (WEAK.has(bare)) return 5;
  return 0;
}

/** Rozdělí slova do nejvýš L vyvážených řádků; null = nevejde se. */
function wrapper(seq, st) {
  const fitsW = measurer(seq, st);
  const L = Math.max(1, Math.min(3, st.lines || 2)), maxC = st.maxChars || 40;
  const ok = (t) => t.length <= maxC && fitsW(t);
  return function wrap(words) {
    const text = words.join(' ');
    if (ok(text) && (L === 1 || text.length <= maxC * 0.7)) return [text];
    if (L === 1) return null;
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      if (ok(a) && ok(b)) { const sc = Math.abs(a.length - b.length) + breakCost(words[i - 1]) + (Math.min(a.length, b.length) < 0.4 * Math.max(a.length, b.length) ? 8 : 0); if (!best || sc < best.sc) best = { sc, lines: [a, b] }; }
      if (L >= 3 && ok(a)) {
        for (let j = i + 1; j < words.length; j++) {
          const c = words.slice(i, j).join(' '), d = words.slice(j).join(' ');
          if (ok(c) && ok(d)) { const ls = [a, c, d].map((x) => x.length); const sc = Math.max(...ls) - Math.min(...ls) + 100 + breakCost(words[i - 1]) + breakCost(words[j - 1]); if (!best || sc < best.sc) best = { sc, lines: [a, c, d] }; }
        }
      }
    }
    return best ? best.lines : (ok(text) ? [text] : null);
  };
}
/** Volné zalomení (text, který se do L řádků nevejde – raději víc řádků než text přes okraj). */
function wrapLoose(seq, st, words) {
  const fitsW = measurer(seq, st), maxC = st.maxChars || 40, out = [];
  let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (line && !(t.length <= maxC && fitsW(t))) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out;
}

const r3 = (x) => Math.round(x * 1000) / 1000;
/** Titulky ze slov s časy timeline [{w, s, e}]; limitEnd = konec obsahu sekvence (titulky za něj nesahají). */
function layout(words, seq, st, limitEnd) {
  st = st || styleOf(seq);
  const wrap = wrapper(seq, st);
  const L = st.lines || 2, cap = (st.maxChars || 40) * L;
  const maxDur = L === 1 ? 3.5 : 5;
  const txt = (ws) => ws.map((w) => w.w).join(' ');
  const fits = (ws) => !!wrap(ws.map((w) => w.w)) && (ws.length < 2 || ws[ws.length - 1].e - ws[0].s <= maxDur);
  // 1) věty (a úseky oddělené pauzou > 0,7 s) – titulek nikdy nespojí konec jedné věty se začátkem další,
  //    leda by šlo o velmi krátké věty („Jo.“, „Ahoj, Báro.“), které se vejdou do jednoho titulku spolu
  const sents = [];
  let cur = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i], prev = words[i - 1];
    if (cur.length && prev && w.s - prev.e > 0.7) { sents.push(cur); cur = []; }
    cur.push(w);
    if (/[.?!…]$/.test(w.w)) { sents.push(cur); cur = []; }
  }
  if (cur.length) sents.push(cur);
  // 2) každá věta do nejmenšího počtu titulků s vyrovnanou délkou (žádný osiřelý konec věty)
  const chunks = [];
  for (const S of sents) {
    const n = S.length;
    const memo = new Map();
    const fitsAt = (b, e) => { const key = b * 1000 + e; if (!memo.has(key)) memo.set(key, fits(S.slice(b, e))); return memo.get(key); };
    let done = false;
    for (let k = 1; k <= n && !done; k++) {
      // DP: rozdělit S na k souvislých kusů, které se vejdou, s nejmenší nejdelší délkou kusu
      const best = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(null));
      best[0][0] = { cost: 0, prev: -1 };
      for (let j = 1; j <= k; j++) {
        for (let e = j; e <= n; e++) {
          for (let b = j - 1; b < e; b++) {
            const p = best[j - 1][b];
            if (!p) continue;
            if (!fitsAt(b, e)) continue;
            // vyrovnané délky (součet čtverců) + zlom po čárce ano, za předložkou ne
            const len = txt(S.slice(b, e)).length;
            const bc = e < n ? breakCost(S[e - 1].w) : 0;
            const cost = p.cost + len * len / 20 + (bc > 0 ? bc * 9 : bc * 4);
            if (!best[j][e] || cost < best[j][e].cost) best[j][e] = { cost, prev: b };
          }
        }
      }
      if (best[k][n]) {
        const cuts = [];
        for (let j = k, e = n; j > 0; e = best[j][e].prev, j--) cuts.unshift([best[j][e].prev, e]);
        for (const [b, e] of cuts) chunks.push({ ws: S.slice(b, e), whole: k === 1 });
        done = true;
      }
    }
    if (!done) for (const w of S) chunks.push({ ws: [w], whole: false }); // jediné slovo přes šířku – nechat
  }
  // 3) krátké celé věty spojit se sousední, když se vejdou spolu a navazují
  const merged = [];
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    if (last && last.whole && c.whole && txt(last.ws.concat(c.ws)).length <= cap * 0.75 && c.ws[0].s - last.ws[last.ws.length - 1].e < 0.5
      && (txt(last.ws).length < cap * 0.35 || txt(c.ws).length < cap * 0.35) && fits(last.ws.concat(c.ws))) {
      last.ws = last.ws.concat(c.ws);
    } else merged.push({ ws: c.ws.slice(), whole: c.whole });
  }
  // 4) titulek kratší než 0,7 s (krátká věta „prostě.“) by jen bleskl – připojit k předchozímu, když se vejdou a navazují;
  //    k následujícímu jen při souvislé řeči (mezera < 0,25 s – jinak bývá mezi nimi střih). Redaktorka S2: „prostě.“ na 8 snímků.
  const span = (c) => c.ws[c.ws.length - 1].e - c.ws[0].s;
  for (let i = 0; i < merged.length && merged.length > 1; i++) {
    const c = merged[i];
    if (span(c) >= 0.7) continue;
    const prev = merged[i - 1], next = merged[i + 1];
    if (prev && c.ws[0].s - prev.ws[prev.ws.length - 1].e < 0.7 && fits(prev.ws.concat(c.ws))) { prev.ws = prev.ws.concat(c.ws); merged.splice(i, 1); i--; }
    else if (next && next.ws[0].s - c.ws[c.ws.length - 1].e < 0.25 && fits(c.ws.concat(next.ws))) { next.ws = c.ws.concat(next.ws); merged.splice(i, 1); i--; }
  }
  const caps = merged.map((c) => {
    const ws = c.ws.map((w) => w.w);
    // ws = začátky slov (pro zvýraznění vyslovovaného slova); text má stejná slova ve stejném pořadí
    return { start: r3(c.ws[0].s), end: r3(c.ws[c.ws.length - 1].e + 0.15), text: (wrap(ws) || wrapLoose(seq, st, ws)).join('\n'), ws: c.ws.map((w) => r3(w.s)) };
  });
  for (let i = 0; i < caps.length - 1; i++) if (caps[i].end > caps[i + 1].start) caps[i].end = caps[i + 1].start;
  if (limitEnd) for (const c of caps) { c.end = r3(Math.min(c.end, limitEnd)); c.start = r3(Math.min(c.start, c.end - 0.1)); }
  return caps;
}

/** Slova hotových titulků s odhadnutými časy (podle pozice znaků uvnitř titulku). */
function wordsOfCaptions(caps) {
  const out = [];
  for (const c of caps) {
    const ws = String(c.text).split(/\s+/).filter(Boolean);
    const st = wordStarts(c);
    for (let i = 0; i < ws.length; i++) out.push({ w: ws[i], s: st[i], e: i + 1 < ws.length ? st[i + 1] : Math.max(st[i] + 0.05, c.end - 0.1) });
  }
  return out;
}
/** Začátky slov titulku: uložené časy (c.ws, když sedí počet slov), jinak odhad podle pozice znaků. */
function wordStarts(c) {
  const ws = String(c.text).split(/\s+/).filter(Boolean);
  if (Array.isArray(c.ws) && c.ws.length === ws.length) return c.ws;
  const total = ws.reduce((a, w) => a + w.length + 1, 0) || 1;
  const span = Math.max(0.1, (c.end - c.start) - 0.1);
  const out = [];
  let pos = 0;
  for (const w of ws) { out.push(c.start + span * pos / total); pos += w.length + 1; }
  return out;
}
/** Index slova titulku, které se v čase t vyslovuje (-1 = žádné). */
function activeWord(c, t) {
  const st = wordStarts(c);
  let k = -1;
  for (let i = 0; i < st.length; i++) if (st[i] <= t + 1e-3) k = i;
  return k;
}
/** Konec obsahu sekvence (poslední klip). */
function contentEnd(seq) {
  let end = 0;
  for (const kind of ['video', 'audio']) for (const tr of (seq.tracks[kind] || [])) for (const c of tr.clips) end = Math.max(end, c.start + (c.out - c.in));
  return end;
}
/** Přeskládá hotové titulky sekvence podle stylu (zachová text). Vrací nové pole titulků. */
function reflow(seq, st) {
  const last = (seq.captions || []).reduce((a, c) => Math.max(a, c.end), 0);
  return layout(wordsOfCaptions(seq.captions || []), seq, st || styleOf(seq), contentEnd(seq) || last);
}
/** Zalomení jednoho upraveného textu do řádků podle stylu a šířky obrazu. */
function rewrap(seq, text) {
  const st = styleOf(seq);
  const words = String(text).split(/\s+/).filter(Boolean);
  return (wrapper(seq, st)(words) || wrapLoose(seq, st, words)).join('\n');
}
/**
 * Nový text titulku cap: vejde-li se do nastaveného počtu řádků, zůstane jeden titulek; jinak se rozdělí na víc
 * titulků ve stejném čase (podle délky textu), raději než řádek se samotným slovem navíc. Vrací pole titulků.
 */
function retext(seq, cap, text) {
  const st = styleOf(seq);
  const words = String(text).split(/\s+/).filter(Boolean);
  const one = wrapper(seq, st)(words);
  if (one) { const c1 = Object.assign({}, cap, { text: one.join('\n') }); delete c1.ws; return [c1]; }
  const ws = wordsOfCaptions([{ start: cap.start, end: cap.end, text: words.join(' ') }]);
  const parts = layout(ws, seq, st, cap.end);
  if (parts.length) { parts[0].start = cap.start; parts[parts.length - 1].end = cap.end; }
  return parts;
}

/* ---------- nadpis nahoře (seq.title = { text, size }) ----------
 * Pro sítě: krátký nadpis přes celé video, bílé tučné písmo na tmavém podkladu. U 9:16 pod horní lištou aplikace
 * (Sledování / Pro tebe), jinak kousek od horního okraje. top = horní okraj v % výšky, frac = písmo / výška obrazu. */
const TITLE = { tall: { top: 12, frac: 0.042 }, portrait: { top: 6, frac: 0.044 }, square: { top: 6, frac: 0.05 }, wide: { top: 6, frac: 0.055 } };
const TITLE_WIDTH = 0.84;
function titleOf(seq) {
  const t = seq && seq.title;
  if (!t || !String(t.text || '').trim()) return null;
  const d = TITLE[shapeOf(seq.width, seq.height)];
  return { text: String(t.text).replace(/\s+/g, ' ').trim(), top: t.top != null ? t.top : d.top, frac: d.frac * (t.size || 1) };
}
/** Řádky nadpisu (nejvýš 3, vyvážené podle skutečné šířky) a velikost písma v px obrazu. */
function titleLines(seq) {
  const t = titleOf(seq);
  if (!t) return null;
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  const words = t.text.split(' ');
  // nejvýš 2 řádky: když se nevejdou, písmo se zmenší (až na 75 %), teprve pak 3 a víc řádků
  // (raději lehce menší písmo a zlom po dvojtečce/čárce než zlom za předložkou – cena = zlom + zmenšení)
  let res = null, bestCost = Infinity;
  // kolo 7: 4 řádky nadpisu přes obličej v 9:16 → zmenšovat dál (až 62 %), než se připustí 3. řádek
  for (const k of [1, 0.9, 0.82, 0.75, 0.68, 0.62]) {
    const fs = Math.round(seq.height * t.frac * k);
    const font = `800 ${fs}px ${FONT}`;
    const maxW = seq.width * TITLE_WIDTH - fs * 0.8; // okraj podkladu
    const ok = (x) => { mctx.font = font; return mctx.measureText(x).width <= maxW; };
    let lines = null, sc = 0;
    if (ok(t.text)) lines = [t.text];
    else {
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        if (ok(a) && ok(b)) { const c = Math.abs(a.length - b.length) + breakCost(words[i - 1]); if (!best || c < best.sc) best = { sc: c, lines: [a, b] }; }
      }
      lines = best ? best.lines : wrapLooseW(words, ok);
      sc = best ? best.sc : 1000;
    }
    const cost = sc + (1 - k) * 60 + (lines.length > 2 ? 1000 : 0);
    if (cost < bestCost) { bestCost = cost; res = { lines, fs, top: t.top, font }; }
    if (lines.length === 1) break; // jeden řádek v plné velikosti – lepší už nebude
  }
  return res;
}
function wrapLooseW(words, ok) {
  const out = []; let line = '';
  for (const w of words) { const x = line ? line + ' ' + w : w; if (line && !ok(x)) { out.push(line); line = w; } else line = x; }
  if (line) out.push(line);
  return out;
}

/** Rovné uvozovky "…" → české „…“ (apostrofy zůstanou). Otevírací = na začátku slova, zavírací = na konci. */
function czQuotes(text) {
  return String(text).replace(/(^|[\s(\[–—-])"(?=\S)/g, '$1„').replace(/(\S)"(?=$|[\s.,;:!?…)\]–—-])/g, '$1“').replace(/"/g, '“');
}
module.exports = { czQuotes, wordStarts, activeWord, FONT, WIDTH, capWidth, SHAPES, shapeOf, fontFrac, defaultStyle, factoryStyle, styleOf, rememberStyle, layout, reflow, rewrap, retext, wordsOfCaptions, contentEnd, titleOf, titleLines, TITLE_WIDTH };
