# Titulky v obraze: export s titulky minus export bez titulku = maska textu. Pro kazdy titulek (stredni snimek) sirka textu,
# levy/pravy okraj (% sirky) a pocet radku (shluky radku masky). python pretek.py <klic> <sekvence>
import sys, os, json, subprocess, numpy as np
O = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'web', 'test-out')
key, name = sys.argv[1], sys.argv[2]
S = json.load(open('sekvence.json', encoding='utf-8'))[name]; W, H = S['w'], S['h']
def frame(f, t):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % t, '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(H, W).astype(np.int16)
res = []
for c in S['captions']:
    t = (c['start'] + c['end']) / 2
    m = np.abs(frame(os.path.join(O, 'vystup-s4-%s.mp4' % key), t) - frame(os.path.join(O, 'vystup-s4-%s-bez.mp4' % key), t)) > 40
    m[:int(H * 0.02)] = False
    ys, xs = np.where(m)
    if not len(xs): res.append((c['start'], c['text'], None)); continue
    rows = np.where(m.sum(1) > 2)[0]
    lines = 1 + int(np.sum(np.diff(rows) > H * 0.01)) if len(rows) else 0
    res.append((c['start'], c['text'].replace('\n', ' / '), (round(100 * xs.min() / W, 1), round(100 * xs.max() / W, 1), lines)))
bad = [r for r in res if r[2] and (r[2][0] < 2 or r[2][1] > 98 or r[2][2] > 1)]
xl = [r[2][0] for r in res if r[2]]; xr = [r[2][1] for r in res if r[2]]
print('%s (%s): %d titulku, text x %.1f-%.1f %% sirky, max radku %d, prazdne %d, pretek/vic radku: %s' % (key, name, len(res), min(xl), max(xr), max(r[2][2] for r in res if r[2]), sum(1 for r in res if not r[2]), bad or 'zadne'))
widest = sorted([r for r in res if r[2]], key=lambda r: r[2][0] - r[2][1])[:2]
print('   nejsirsi:', widest)
