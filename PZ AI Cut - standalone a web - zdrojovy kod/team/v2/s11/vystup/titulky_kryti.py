# S11: pro kazdou sekvenci s titulky: titulky < 0,7 s, rec bez titulku (slovo, jehoz stred nelezi v zadnem titulku), slovo zdvojene (stejne slovo ve dvou po sobe jdoucich titulcich na stejnem miste),
# konec titulku pred koncem posledniho slova titulku (> 0,1 s) = titulek zmizi uprostred vety. Slova = seqWords S11 (zvuk S10 a S11 je bitove shodny).
import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
W = json.load(open('seqwords.json', encoding='utf-8')); S11 = json.load(open('sekvence.json', encoding='utf-8-sig')); S10 = json.load(open('../../s10/vystup/sekvence.json', encoding='utf-8-sig'))
N = lambda x: re.sub(r'[^\w]', '', x.lower())
def rep(caps, ws):
    short = ['%.2f-%.2f' % (c['start'], c['end']) for c in caps if c['end'] - c['start'] < 0.7]
    miss = [w for w in ws if not any(c['start'] - 0.02 <= (w[1] + w[2]) / 2 <= c['end'] + 0.02 for c in caps)]
    gaps = []
    for w in miss:
        if gaps and w[1] - gaps[-1][2] < 0.4: gaps[-1][2] = w[2]; gaps[-1][0] += ' ' + w[0]
        else: gaps.append([w[0], w[1], w[2]])
    dup = []
    for a, b in zip(caps, caps[1:]):
        la, fb = a['text'].split()[-1], b['text'].split()[0]
        if N(la) == N(fb) and abs(a['end'] - b['start']) < 0.05: dup.append('%s @%.2f' % (fb, b['start']))
    early = []
    for c in caps:
        t = c['text'].split(); inw = [w for w in ws if c['start'] - 0.02 <= (w[1] + w[2]) / 2 <= c['end'] + 0.3]
        lw = [w for w in inw if N(w[0]) == N(t[-1])]
        if lw and lw[-1][2] - c['end'] > 0.1: early.append('%.2f-%.2f „%s" slovo do %.2f' % (c['start'], c['end'], t[-1], lw[-1][2]))
    return short, ['%s %.2f-%.2f (%.2f s)' % (g[0], g[1], g[2], g[2] - g[1]) for g in gaps], dup, early
for n in sorted(W):
    caps = S11[n]['captions']
    if not caps: continue
    m = n.replace('s11-', 's10-')
    for tag, cc in (('S10', S10[m]['captions'] if m in S10 else None), ('S11', caps)):
        if cc is None: continue
        sh, ga, du, ea = rep(cc, W[n])
        print('%-16s %s %2d tit | <0,7 s: %s | rec bez titulku: %s | zdvojene: %s | titulek konci pred slovem: %s' % (n, tag, len(cc), sh or '-', ga or '-', du or '-', ea or '-'))
