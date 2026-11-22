# Nespojitost zvuku na strizich: max skok vzorku +-3 vzorky kolem strihu / p99,5 skoku v okoli +-0,5 s (>1,5 = slysitelne cvaknuti)
import sys, os, json, subprocess, numpy as np
SR = 48000
here = os.path.dirname(os.path.abspath(__file__))
for f, name in zip(sys.argv[1::2], sys.argv[2::2]):
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    S = json.load(open(os.path.join(here, 'sekvence.json'), encoding='utf-8'))[name]
    r = []
    for c in S['audio'][0][1:]:
        n = int(round(c['start'] * SR)); seg = x[n - SR // 2:n + SR // 2]
        p = float(np.percentile(np.abs(np.diff(seg)), 99.5)); j = float(np.max(np.abs(np.diff(x[n - 3:n + 4]))))
        r.append('%.2f:%.2f' % (c['start'], j / max(p, 1e-9)))
    print(os.path.basename(f), ' '.join(r))
