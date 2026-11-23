# S5: nepravidelne casy snimku (pts krok != 1/fps) v exportech; python ptsdiff.py soubor...
import sys, subprocess
for f in sys.argv[1:]:
    pts = [float(x.strip(',')) for x in subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.split() if x.strip()]
    d = [round(b - a, 3) for a, b in zip(pts, pts[1:])]
    odd = [(i + 1, round(pts[i + 1], 3), x) for i, x in enumerate(d) if abs(x - 0.04) > 0.002]
    exp_last = (len(pts) - 1) * 0.04
    print('%s: %d snimku, prvni pts %.3f, posledni %.3f (pravidelne %.3f), nepravidelnych kroku %d %s' % (f.replace('\\', '/').split('/')[-1], len(pts), pts[0], pts[-1], pts[0] + exp_last, len(odd), odd[:8]))

