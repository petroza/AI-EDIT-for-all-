# S8: souhrn titulku po sekvencich: pocet, < 0,7 s, titulek pres strih zvuku, slova titulku neslysena (+-0,3 s), slysena slova bez titulku
import json, re, unicodedata, sys, os
sys.stdout.reconfigure(encoding='utf-8')
S = json.load(open('sekvence.json', encoding='utf-8')); W = json.load(open(os.environ.get('WOUT', 'whisper.json'), encoding='utf-8'))
N = lambda s: re.sub(r'[^\w]', '', unicodedata.normalize('NFC', s.lower()))
jobs = json.loads(sys.argv[1])
for key, name in jobs:
    s = S[name]; caps = s['captions']; ws = W[key]['full']
    cuts = sorted(set(round(c['start'], 3) for c in s['audio'][0][1:]))
    short = [('%.2f-%.2f' % (c['start'], c['end']), round(c['end'] - c['start'], 2), c['text'].replace('\n', ' / ')) for c in caps if c['end'] - c['start'] < 0.7]
    over = [('%.2f-%.2f' % (c['start'], c['end']), t) for c in caps for t in cuts if c['start'] + 0.04 < t < c['end'] - 0.04]
    notheard = []
    for c in caps:
        hw = [N(w['w']) for w in ws if w['e'] > c['start'] - 0.3 and w['s'] < c['end'] + 0.3]
        notheard += [(round(c['start'], 2), x) for x in (N(y) for y in c['text'].split()) if x and x not in hw]
    allc = ' '.join(N(y) for c in caps for y in c['text'].split())
    missing = [(w['w'], w['s']) for w in ws if not any(c['start'] - 0.3 <= (w['s'] + w['e']) / 2 <= c['end'] + 0.3 and N(w['w']) in [N(y) for y in c['text'].split()] for c in caps)]
    print('%-12s %2d titulku | <0,7 s: %d %s | pres strih: %s | v titulku neslyseno: %s | slyseno bez titulku: %s' % (name, len(caps), len(short), short, over or 'zadny', notheard or 'nic', missing or 'nic'))
