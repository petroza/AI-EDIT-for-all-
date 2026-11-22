# Zacatky/konce titulku proti reci podle obalky RMS (10 ms): rec = nad prahem (median reci - 14 dB).
# Pro zacatek titulku: nejblizsi nastup reci (>=120 ms ticha pred) v okne +-0,8 s; pro konec: nejblizsi doznení (>=120 ms ticha po).
# Kladne = titulek pozdeji nez rec. "-" = v okne zadny nastup/doznení (souvisla rec, titulek deli vetu uprostred).
import sys, os, json, subprocess, numpy as np
SR = 16000; here = os.path.dirname(os.path.abspath(__file__))
for f, name in zip(sys.argv[1::2], sys.argv[2::2]):
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).astype(np.float64)
    n = SR // 100; env = np.array([20 * np.log10(max(1e-9, np.sqrt(np.mean(x[i:i + n] ** 2)))) for i in range(0, len(x) - n, n)])
    sp = np.median(env[env > np.percentile(env, 40)]); on = env > sp - 14
    ons = [i for i in range(12, len(on)) if on[i] and not on[i - 12:i].any()]
    offs = [i + 1 for i in range(0, len(on) - 12) if on[i] and not on[i + 1:i + 13].any()]
    S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8'))[name]
    print('=====', os.path.basename(f), name, 'prah %.1f dB' % (sp - 14))
    ds, de = [], []
    for c in S['captions']:
        a = [o / 100 for o in ons if abs(o / 100 - c['start']) <= 0.8]; b = [o / 100 for o in offs if abs(o / 100 - c['end']) <= 0.8]
        da = min((c['start'] - t for t in a), key=abs) if a else None; db = min((c['end'] - t for t in b), key=abs) if b else None
        if da is not None: ds.append(da)
        if db is not None: de.append(db)
        print('  [%6.2f-%6.2f] %-48s zacatek %s  konec %s' % (c['start'], c['end'], c['text'].replace('\n', ' / ')[:48], '%+.2f' % da if da is not None else '  - ', '%+.2f' % db if db is not None else '  - '))
    print('  median zacatek %+.2f s (max |%.2f|), konec %+.2f s (max |%.2f|)' % (np.median(ds), max(map(abs, ds)), np.median(de), max(map(abs, de))))
