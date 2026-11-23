# S11: framemd5 (-c copy) po proudech: S10 vs S11, pocet odlisnych paketu a jejich rozsah
import sys, subprocess, collections
T = 'O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/web/test-out/'
def fm(p):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-map', '0', '-c', 'copy', '-f', 'framemd5', '-'], capture_output=True, text=True).stdout
    d = collections.defaultdict(list)
    for l in out.splitlines():
        if l.startswith('#') or not l.strip(): continue
        f = [x.strip() for x in l.split(',')]; d[int(f[0])].append(f[-1])
    return d
for n in sys.argv[1:]:
    a, b = fm(T + 'vystup-s10-' + n), fm(T + 'vystup-s11-' + n)
    for s in sorted(set(a) | set(b)):
        x, y = a.get(s, []), b.get(s, [])
        diff = [i for i in range(max(len(x), len(y))) if i >= len(x) or i >= len(y) or x[i] != y[i]]
        print('%s stream %d : paketu S10 %d S11 %d , odlisnych %d %s' % (n, s, len(x), len(y), len(diff), '(paket %d-%d)' % (diff[0], diff[-1]) if diff else ''))
