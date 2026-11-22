# Titulky (sekvence.json) proti Whisperu na exportu (whisper.json): casovy posun prvniho/posledniho slova kazdeho titulku
# a slova titulku, ktera Whisper v jeho case neslysel / slysena slova, ktera v titulku chybi.
import json, unicodedata, re
S = json.load(open('sekvence.json', encoding='utf-8')); W = json.load(open('whisper.json', encoding='utf-8'))
N = lambda s: re.sub(r'[^\w]', '', unicodedata.normalize('NFC', s.lower()))
for key, name in [('a', 'vystup-r7-a'), ('b', 'vystup-r7-a 9x16'), ('c', 'vystup-r7-c'), ('d', 'vystup-r7-d 1x1')]:
    caps = S[name]['captions']; ws = W[key]['full']
    print('=====', key, name, len(caps), 'titulku')
    for i, c in enumerate(caps):
        cw = [N(x) for x in c['text'].split() if N(x)]
        heard = [w for w in ws if w['e'] > c['start'] - 0.3 and w['s'] < c['end'] + 0.3]
        hw = [N(w['w']) for w in heard]
        miss = [x for x in cw if x not in hw]
        extra = [N(w['w']) for w in ws if c['start'] + 0.05 <= (w['s'] + w['e']) / 2 <= c['end'] - 0.05 and N(w['w']) not in cw]
        f = next((w for w in heard if N(w['w']) == cw[0]), None)
        l = next((w for w in reversed(heard) if N(w['w']) == cw[-1]), None)
        print('%2d [%6.2f-%6.2f] %-55s | start %s end %s | v titulku, neslyseno: %s | slyseno, chybi: %s' % (
            i, c['start'], c['end'], c['text'].replace('\n', ' / ')[:55],
            ('%+.2f' % (c['start'] - f['s'])) if f else '?', ('%+.2f' % (c['end'] - l['e'])) if l else '?', miss, extra))
