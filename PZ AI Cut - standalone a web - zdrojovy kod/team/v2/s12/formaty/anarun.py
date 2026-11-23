# Kolo S12 – analýza všech exportů z results.json → ana.json
import json, os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ana
D = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(os.environ['TEMP'], 'pz-s12-formaty-media')
res = json.load(open(os.path.join(D, 'results.json'), encoding='utf8'))
af = os.path.join(D, 'ana.json')
out = json.load(open(af, encoding='utf8')) if os.path.exists(af) else {}
names = sys.argv[1:] or list(res)
SRCF = {'i25', 'mxf_xdcam'}
for n in names:
    r = res[n]
    if not r.get('exports'): continue
    s = r['app']['seq']
    clips = s['v'] or s['a']
    pieces = [(c['st'], c['in'], c['out']) for c in clips]
    src = os.path.join(M, r['file'])
    out[n] = {}
    for f, e in r['exports'].items():
        if e.get('error'): out[n][f] = {'error': e['error']}; continue
        p = ana.summary_probe(e['output'])
        fields = p.get('v', {}).get('field_order') in ('tt', 'bb', 'tb', 'bt')
        hasv = r['app']['media']['hasVideo']
        R = ana.analyze(e['output'], fields, src if hasv else None, n in SRCF, pieces)
        out[n][f] = R
        print(n, f, json.dumps({k: R.get(k) for k in ('codes', 'sync', 'ebur128')})[:700])
    json.dump(out, open(af, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
