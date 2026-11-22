# whisper.json -> whisper-citelne.txt (stejny format jako kolo 7)
import json
W = json.load(open('whisper.json', encoding='utf-8'))
f = lambda ws: ' '.join('%s(%.2f-%.2f,%.2f)' % (w['w'], w['s'], w['e'], w['p']) for w in ws)
o = []
for k, r in W.items():
    o.append('===== ' + k); o.append('FULL ' + f(r['full']))
    for c in r['cuts']:
        o.append('-- cut %s in %s prev_out %s' % (c['t'], c.get('in'), c.get('prev_out')))
        o.append('  EXP ' + f(c['words']))
        if 'src_around_prev_out' in c: o.append('  SRC@out ' + f([w for w in c['src_around_prev_out'] if w['s'] >= c['prev_out'] - 1.0]))
        if 'src_around_in' in c: o.append('  SRC@in  ' + f(c['src_around_in']))
open('whisper-citelne.txt', 'w', encoding='utf-8').write('\n'.join(o))
