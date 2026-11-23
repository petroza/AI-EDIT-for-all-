# S9: obraz dvou exportu snimek po snimku (sede 320x180): prumerna abs. chyba v horni casti (0-75 % vysky, bez titulku) a ve spodnim pasu.
# python cmp_obraz.py <a> <b> [ss_b] (ss_b = posun zacatku b v s, vystupni -ss)
import sys, subprocess, numpy as np
W, H = 320, 180
def dec(p, ss=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', p] + (['-ss', str(ss)] if ss else []) + ['-an', '-vf', 'scale=%d:%d:flags=area,format=gray' % (W, H), '-f', 'rawvideo', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.uint8).reshape(-1, H, W).astype(np.int16)
a = dec(sys.argv[1]); b = dec(sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else None)
n = min(len(a), len(b)); a, b = a[:n], b[:n]
top = np.abs(a[:, :int(H * .75)] - b[:, :int(H * .75)]).mean((1, 2)); bot = np.abs(a[:, int(H * .75):] - b[:, int(H * .75):]).mean((1, 2))
print('%s vs %s: snimku %d/%d | horni 75 %%: prumer %.2f max %.2f (sn. %d) | spodni pas: prumer %.2f max %.2f, snimku s chybou >3: %d' % (sys.argv[1].split('/')[-1], sys.argv[2].split('/')[-1], len(a), len(b), top.mean(), top.max(), top.argmax(), bot.mean(), bot.max(), int((bot > 3).sum())))
