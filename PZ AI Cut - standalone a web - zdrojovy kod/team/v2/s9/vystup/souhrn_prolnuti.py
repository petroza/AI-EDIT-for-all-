# S6: souhrn prolnutiV2 vystupu: snimky s 0<alfa<1, krok min/max, max zbytek, min jas v useku, skok jasu mezi snimky
import sys, re, glob
for f in sys.argv[1:]:
    L = open(f, encoding='utf-8', errors='replace').read().splitlines()
    rows = []
    for l in L[1:]:
        m = re.search(r'sn (\d+) ([\d.]+) s: (?:alfa V2 ([-\d.]+) zbytek ([\d.]+).*jas (\d+)|jen (\S+), chyba ([\d.]+), jas (\d+))', l)
        if not m: continue
        k = int(m.group(1)); 
        if m.group(3): rows.append((k, float(m.group(3)), float(m.group(4)), int(m.group(5))))
        else: rows.append((k, None, float(m.group(7)), int(m.group(8))))
    tr = [r for r in rows if r[1] is not None and 0.02 < r[1] < 0.98]
    al = [r[1] for r in rows if r[1] is not None]
    steps = [b[1] - a[1] for a, b in zip(rows, rows[1:]) if a[1] is not None and b[1] is not None and (0.02 < a[1] < 0.98 or 0.02 < b[1] < 0.98)]
    lum = [r[3] for r in rows]; dl = max(abs(b - a) for a, b in zip(lum, lum[1:]))
    print('%-34s prechod sn %s-%s (%d sn) | krok %.3f..%.3f | max zbytek %.1f | jas %d-%d, max skok jasu %d' % (f.replace('prolnuti-v2-', ''), tr[0][0] if tr else '-', tr[-1][0] if tr else '-', len(tr), min(map(abs, steps)) if steps else 0, max(map(abs, steps)) if steps else 0, max(r[2] for r in rows), min(lum), max(lum), dl))
