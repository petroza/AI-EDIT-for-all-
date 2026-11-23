# S10 (4): kazdy kus obrazu V1 ma propojeny zvuk (stejne linkId) se stejnymi kraji (+-3 snimky), rep bez propojeni; osirele zvuky
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
D = json.load(open('links.json', encoding='utf-8'))
for name, s in D.items():
    if name.startswith('x-old'): continue
    vids = [c for t in s['V'] for c in t]; auds = [c for t in s['A'] for c in t]
    vl = {c[3] for c in vids if c[3]}
    bad = []
    for ti, t in enumerate(s['V']):
        for c in t:
            st, en, i, l, rep, m = c
            if rep:
                if l: bad.append('V%d %.2f rep S propojenim' % (ti + 1, st))
                continue
            if not l:
                bad.append('V%d %.2f-%.2f bez propojeni' % (ti + 1, st, en)); continue
            a = [x for x in auds if x[3] == l]
            if not a: bad.append('V%d %.2f-%.2f link bez zvuku' % (ti + 1, st, en)); continue
            for x in a:
                d1, d2 = round((x[0] - st) * 25), round((x[1] - en) * 25)
                if d1 or d2: bad.append('V%d %.2f-%.2f zvuk %.2f-%.2f (kraje %+d/%+d sn.)' % (ti + 1, st, en, x[0], x[1], d1, d2))
    orph = ['A%d %.2f-%.2f' % (ti + 1, c[0], c[1]) for ti, t in enumerate(s['A']) for c in t if c[3] and c[3] not in vl]
    nol = ['A%d %.2f-%.2f' % (ti + 1, c[0], c[1]) for ti, t in enumerate(s['A']) for c in t if not c[3] and c[5] != 'mus_s']
    nV1 = len(s['V'][0]); nrep = sum(1 for c in s['V'][0] if c[4])
    print('%-16s V1 %d kusu (rep %d) | %s | osirele zvuky: %s | zvuk bez propojeni: %s' % (name, nV1, nrep, '; '.join(bad) or 'OK', orph or '-', nol or '-'))
