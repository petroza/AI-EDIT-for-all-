# Smíšená sekvence 25p: pro každý klip pořadí snímků, obraz proti časové ose (ms) a pípnutí proti časové ose (ms).
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ana
M = os.path.join(os.environ['TEMP'], 'pz-s12-formaty-media')
D = os.path.dirname(os.path.abspath(__file__))
seq = json.load(open(os.path.join(D, 'mixed-seq.json'), encoding='utf8'))
clips = [(c['st'], c['in'], c['out'], seq['media'][i]['name']) for i, c in enumerate(seq['seq']['v'])]
f = sys.argv[1]; t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0   # začátek exportu v sekvenci
tabs = {}
for (_, _, _, n) in clips:
    st = ana.src_time_table(os.path.join(M, n), False)
    tabs[n] = st
c, info = ana.codes(f)
x, ch = ana.audio(f)
bl = [b for b in ana.beeps(x[:, 0])]
out = {'file': os.path.basename(f), 'probe': ana.summary_probe(f), 'ebur128': ana.ebur_mix(f, len(ana.summary_probe(f).get('a', []))), 'clips': []}
for (st, i0, o0, n) in clips:
    a, b = st, st + (o0 - i0)
    fr = [(tm + t0, code, u) for (tm, code, u) in c if a - 1e-6 <= tm + t0 < b - 1e-6]
    if not fr: continue
    tab = tabs[n]
    off = [((tab.get(code, np.nan)) - i0) - (tm - st) for (tm, code, u) in fr]   # zdrojový čas snímku − čas od začátku klipu
    off = np.array(off) * 1000
    codes_ = [code for (_, code, _) in fr]
    steps = {}
    for k in range(1, len(codes_)):
        d = codes_[k] - codes_[k - 1]; steps[d] = steps.get(d, 0) + 1
    beeps = [bb + t0 for bb in bl if a <= bb + t0 < b - 0.01]
    aoff = [round((bb - (st + round(bb - st + i0) - i0)) * 1000, 1) for bb in beeps]
    # obraz v okamžiku pípnutí: snímek zobrazený v čase pípnutí → jeho zdrojový čas vs zdrojový čas pípnutí
    voff = []
    for bb in beeps:
        k = round(bb - st + i0)
        j = max([q for q in range(len(fr)) if fr[q][0] <= st + (k - i0) + 1e-6] or [0])
        voff.append(round((tab.get(fr[j][1], np.nan) - k) * 1000, 1))
    out['clips'].append({'clip': n, 'od': a, 'do': b, 'snimku': len(fr), 'nejiste': sum(1 for q in fr if q[2]), 'kroky': {str(k): v for k, v in sorted(steps.items())},
        'obraz_minus_osa_ms': {'min': round(float(np.nanmin(off)), 1), 'max': round(float(np.nanmax(off)), 1), 'prvni': round(float(off[0]), 1), 'posledni': round(float(off[-1]), 1)},
        'pipnuti_vs_osa_ms': (aoff[:3] + ['…'] + aoff[-3:]) if len(aoff) > 6 else aoff,
        'pipnuti_max_abs_ms': max([abs(v) for v in aoff], default=None),
        'obraz_pri_pipnuti_ms': (voff[:3] + ['…'] + voff[-3:]) if len(voff) > 6 else voff})
print(json.dumps(out, ensure_ascii=False, indent=1))
