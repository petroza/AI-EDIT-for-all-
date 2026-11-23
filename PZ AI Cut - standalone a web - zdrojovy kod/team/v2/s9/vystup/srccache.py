# S6: mezipamet snimku zdroju pro vrstvy.py / sync_off.py / prolnutiV2.py (stejny klic jako vrstvy.py: pz-s5-src-<media8>-<a>-<n>.npy,
# 320x180 sede). Jeden pruchod dekoderu na soubor od zacatku (select podle indexu snimku n = jako vystupni -ss), ne seek.
# python srccache.py <sekvence> [<sekvence> ...]
import sys, os, json, subprocess, numpy as np
here = os.path.dirname(os.path.abspath(__file__))
SRC = {'tncz': 'C:/Users/Petr/Downloads/tncz-TIT_2026-11-20_TALK-TALK_S_BARBOROU_SIMKOVOU-B240845.mp4.mp4',
       'vyrez-5min.mp4': os.path.join(here, '..', '..', '..', '..', 'test', 'media', 'vyrez-5min.mp4')}
S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8-sig'))
need = {}
for name in sys.argv[1:]:
    for t in S[name]['video']:
        for c in t:
            a = max(0, int(round(c['in'] * 25)) - 25); n = int(round((c['out'] - c['in']) * 25)) + 50
            fn = os.path.join(os.environ['TEMP'], 'pz-s5-src-%s-%d-%d.npy' % (c['media'][:8], a, n))
            if not os.path.exists(fn): need.setdefault(c['media'], set()).add((a, n, fn))
for m, rs in need.items():
    p = SRC['tncz'] if m.startswith('tncz') else SRC[m]
    idx = sorted(set(k for a, n, fn in rs for k in range(a, a + n)))
    expr = '+'.join('between(n\,%d\,%d)' % (a, a + n - 1) for a, n, fn in sorted(rs))
    last = max(a + n for a, n, fn in rs)
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-t', '%.3f' % (last / 25 + 0.5), '-an', '-vf', "select=%s,scale=320:180:flags=area,format=gray" % expr, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], capture_output=True); print(b.stderr.decode()[-500:]); b = b.stdout
    F = np.frombuffer(b, np.uint8).reshape(-1, 180, 320)
    pos = {k: i for i, k in enumerate(idx)}
    print(m, len(rs), 'useku,', len(F), 'snimku (ocekavano', len(idx), ')')
    for a, n, fn in rs:
        np.save(fn, np.stack([F[pos[k]] for k in range(a, a + n) if k in pos and pos[k] < len(F)]))
