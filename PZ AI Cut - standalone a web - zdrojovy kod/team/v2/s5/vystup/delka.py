# S5: delka obrazu (pocet snimku / fps) a dekodovaneho zvuku (vzorky / 48000) v exportech; python delka.py soubor...
import sys, subprocess, numpy as np
for f in sys.argv[1:]:
    n = len(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.split())
    a = len(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'], capture_output=True).stdout) // 2
    print('%-34s obraz %d sn. = %.3f s | zvuk %.3f s | rozdil %+.0f ms' % (f.replace('\\', '/').split('/')[-1], n, n / 25, a / 48000, (a / 48000 - n / 25) * 1000))
