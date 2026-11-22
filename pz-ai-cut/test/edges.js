'use strict';
/* Kraje výroků podle zvuku (developer-rules 2, 3, 12): výběr vět jako klik + Shift+klik v Přepisu → cutBounds → slova titulků
 * (clipCaptionWords, stejný kód jako aplikace) a proti tomu, co v klipu opravdu zazní: lokální faster-whisper large-v3 na
 * vyříznutém zvuku [In, Out] + RMS na In/Out. Vypíše tabulku a počty; návratový kód 1, když titulky nesedí se zvukem.
 *   node test/edges.js <přepis.json> <video> [--py <python s faster_whisper>] [--json výstup.json]
 * Výroky: 6 pojmenovaných z reportů kol 3–4 (ID vět v přepisu prepis-presny-po.json) + 10 náhodných (pevné semínko) = 16 začátků a 16 konců. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
// --impl = jiná verze modulu (např. stará z nasazeného balíčku pro měření PŘED)
const T = require(opt('--impl') ? path.resolve(opt('--impl')) : '../web/ai/transcripts');
const [tjson, media] = argv.filter((x, i) => !x.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!tjson || !media) { console.log('použití: node test/edges.js <přepis.json> <video> [--py python] [--json out.json]'); process.exit(2); }
const PY = opt('--py', 'O:/ADOBEPREMIERESTRIH/.venv/Scripts/python.exe');

const t = JSON.parse(fs.readFileSync(tjson, 'utf8'));
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', media, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 2 ** 31 - 1 });
const pcm = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
t.duration = pcm.length / 16000;
t.sentences = T.sentences(t.words);
const S = t.sentences;
const file = { pcm16k: pcm, name: path.basename(media) };
const txt = (i) => t.words.slice(S[i].w0, S[i].w1 + 1).map((w) => w.w).join(' ');
const find = (re, from = 0) => { for (let i = from; i < S.length; i++) if (re.test(txt(i))) return i; return -1; };

// pojmenované výroky (hledané podle textu, ať sedí i na jiném přepisu stejného videa)
const named = [];
const add = (name, reA, reB) => { const a = find(reA); const b = a < 0 ? -1 : find(reB, a); if (a >= 0 && b >= 0) named.push({ name, a, b }); else console.log(`(výrok ${name} v přepisu nenalezen)`); };
add('V1 18:16', /^Tady není jiná možnost/, /pokračovat dál/);
add('V2 25:51', /^tak neříkat/i, /na film/);
add('V3 20:58', /^My jsme byli kamarádky/, /nejtěžší věc v mém životě/);
add('V4 23:23', /^Zrovna včera/, /^A to se děje furt/);
add('V5 19:59', /^My jsme vůbec neměli možnost/, /zvládnout to/);
add('R 23:20', /^Ale jako to uvědomění/, /^Furt\.$/);
// 10 náhodných výroků 1–4 věty (bez prvních/posledních 3 vět – tam jsou úvod a závěr)
let seed = Number(opt('--seed', 20261122));
const NR = Number(opt('--random', 10));
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rand = [];
for (let tries = 0; rand.length < NR && tries < 5000; tries++) { // krátký přepis: méně výroků, nezacyklit se
  const a = 3 + Math.floor(rnd() * (S.length - 8)), b = Math.min(S.length - 4, a + Math.floor(rnd() * 4));
  if (S[b].e - S[a].s < 3 || S[b].e - S[a].s > 60) continue;
  if (rand.some((r) => Math.abs(r.a - a) < 3)) continue;
  rand.push({ name: `N${rand.length + 1} ${Math.floor(S[a].s / 60)}:${String(Math.floor(S[a].s % 60)).padStart(2, '0')}`, a, b });
}
// --cases = pojmenované kraje z report-5 (tasks-5 úkol 1), indexy vět přesného přepisu rozhovoru (stejné jako u testera)
const CASES = [['B2a', 4, 6], ['B3a', 131, 131], ['B4a', 14, 16], ['B4b', 247, 247], ['B4c', 3, 3], ['B4d', 24, 24], ['B5', 103, 103],
  ['2718N4', 352, 353], ['2718N10', 85, 87], ['6174N2', 320, 321]].map(([name, a, b]) => ({ name, a, b }));
const all = argv.includes('--cases') ? CASES.filter((c) => c.b < S.length) : named.concat(rand);
if (argv.includes('--list')) { console.log(JSON.stringify(all)); process.exit(0); } // seznam výroků pro test/edges-web.js

const nz = (w) => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// stejné slovo (férový rozhodčí, kolo 5 – tasks-4 úkol 3.1): bez diakritiky a velikosti písmen; shoda, nebo u slov od 4 písmen
// editační vzdálenost ≤ 2 („jinám/jinam“, „krvenky/krvinky“, „novu/novou“) či stejný kmen 4 písmen („umělec/umělecké“); kratší jen přesně.
// --old-judge = rozhodčí kola 4 (pro srovnání).
const plain = (w) => nz(w).normalize('NFD').replace(/\p{M}/gu, '');
const lev = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } } return d[b.length]; };
const OLD_JUDGE = argv.includes('--old-judge');
const same = (x, y) => {
  if (OLD_JUDGE) { const p = nz(x), q = nz(y); if (!p || !q) return false; if (p === q) return true; const n = Math.min(p.length, q.length); return n >= 4 && p.slice(0, 4) === q.slice(0, 4); }
  const p = plain(x), q = plain(y);
  if (!p || !q) return false;
  if (p === q) return true;
  return Math.min(p.length, q.length) >= 4 && (lev(p, q) <= 2 || p.slice(0, 4) === q.slice(0, 4));
};
// první/poslední slyšené slovo: slovo s nízkou jistotou (p < 0,5) nebo nulovou délkou na kraji bývá úlomek/halucinace modelu → platí i soused
const okEdge = (cap, hw, end) => { const h = end ? hw.slice(-2).reverse() : hw.slice(0, 2); if (!cap || !h.length) return false;
  if (same(cap.w, h[0].w)) return true; return !!(h[1] && (h[0].p < 0.5 || h[0].e - h[0].s < 0.03) && same(cap.w, h[1].w)); };
const db = (v, ref) => (v > 0 && ref > 0 ? 20 * Math.log10(v / ref) : -99);
const rmsAt = (u, w = 0.03) => T.rmsWin(pcm, 0, u, w) || 0;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pz-edges-'));
  const rows = [];
  // --rows <json> = titulky spočítané v aplikaci (test/edges-web.js: skutečná cesta v prohlížeči) – tady jen rozhodčí
  const ext = opt('--rows') ? JSON.parse(fs.readFileSync(opt('--rows'), 'utf8')) : null;
  for (const st of all) {
    const x = ext && ext.find((r) => r.name === st.name);
    if (ext && !x) continue;
    const b = x ? { in: x.in, out: x.out, inOk: x.inOk, outOk: x.outOk } : await T.cutBounds(file, t, S[st.a].w0, S[st.b].w1);
    const c = { in: b.in, out: b.out, start: 0 };
    const cw = x ? x.cw : await T.clipCaptionWords(file, t, c);
    const wav = path.join(dir, rows.length + '.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', c.in.toFixed(3), '-to', c.out.toFixed(3), '-i', media, '-vn', '-ac', '1', '-ar', '16000', wav]);
    const lvl = T.levelOf(pcm.subarray(Math.round(c.in * 16000), Math.round(Math.min(c.out, c.in + 8) * 16000)));
    rows.push({ ...st, c, inOk: b.inOk, outOk: b.outOk, cw, wav, inDb: db(rmsAt(c.in), lvl), outDb: db(rmsAt(c.out), lvl),
      sel0: t.words[S[st.a].w0].w, sel1: t.words[S[st.b].w1].w });
  }
  // lokální přepis úseků (cache podle In/Out – při ladění parametrů titulků se úseky nemění)
  const cacheF = opt('--cache');
  const cache = cacheF && fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : {};
  const key = (r) => `${path.basename(media)}|${r.c.in.toFixed(3)}|${r.c.out.toFixed(3)}`;
  const todo = rows.filter((r) => !cache[key(r)]);
  if (todo.length) {
    const list = path.join(dir, 'list.json');
    fs.writeFileSync(list, JSON.stringify(todo.map((r) => r.wav)));
    const res = JSON.parse(execFileSync(PY, [path.join(__dirname, 'edges_asr.py'), list], { maxBuffer: 1 << 26, encoding: 'utf8' }));
    todo.forEach((r, i) => { cache[key(r)] = res[i].words; });
    if (cacheF) fs.writeFileSync(cacheF, JSON.stringify(cache));
  }
  const asr = rows.map((r) => ({ words: cache[key(r)] }));
  let badStart = 0, badEnd = 0;
  const lines = ['| výrok | In / Out (s) | 1. slovo titulku | 1. slovo ve zvuku | posl. titulku | posl. ve zvuku | RMS In / Out (dB pod řečí) | varování | začátek | konec |',
    '|---|---|---|---|---|---|---|---|---|---|'];
  for (const [i, r] of rows.entries()) {
    const hw = asr[i].words.filter((w) => nz(w.w));
    const h0 = hw[0], h1 = hw[hw.length - 1];
    const c0 = r.cw[0], c1 = r.cw[r.cw.length - 1];
    const okS = okEdge(c0, hw, false), okE = okEdge(c1, hw, true);
    if (!okS) badStart++;
    if (!okE) badEnd++;
    const warn = [r.inOk ? '' : 'začátek', r.outOk ? '' : 'konec'].filter(Boolean).join(', ') || '–';
    const hs = (w) => (w ? `${w.w} (${w.s.toFixed(2)}, p ${w.p})` : '–');
    lines.push(`| ${r.name} | ${r.c.in.toFixed(2)} / ${r.c.out.toFixed(2)} | ${c0 ? c0.w : '–'} | ${hs(h0)} | ${c1 ? c1.w : '–'} | ${h1 ? `${h1.w} (${h1.e.toFixed(2)}, p ${h1.p})` : '–'} | ${r.inDb.toFixed(0)} / ${r.outDb.toFixed(0)} | ${warn} | ${okS ? '✔' : '✘'} | ${okE ? '✔' : '✘'} |`);
    r.heard = hw;
  }
  console.log(lines.join('\n'));
  const n = rows.length;
  console.log(`\nzačátky v pořádku ${n - badStart}/${n}, konce ${n - badEnd}/${n} (pojmenované: ${named.length}, náhodné: ${rand.length})`);
  // první a poslední 3 věty přepisu (developer-rules 6)
  const hal = T.hallucinated ? (i) => (T.hallucinated(txt(i)) ? ' ⚠ halucinace' : '') : () => '';
  console.log('\nprvní/poslední 3 věty přepisu:');
  for (const i of [0, 1, 2, S.length - 3, S.length - 2, S.length - 1]) console.log(`  #${i} ${S[i].s.toFixed(1)}–${S[i].e.toFixed(1)} ${txt(i)}${hal(i)}`);
  const jo = opt('--json');
  if (jo) fs.writeFileSync(jo, JSON.stringify(rows.map(({ wav, ...r }) => r), null, 1));
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(badStart + badEnd ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(3); });
