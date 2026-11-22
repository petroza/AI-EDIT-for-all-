# Prumerny rozdil B proti A pro posuny -2..+2 po usecich (hranice klipu v snimcich): python posun_useky.py A B 0 69 181 318 377 399
import subprocess, sys, numpy as np
def fr(p, w=160, h=90):
    b = subprocess.run(['ffmpeg','-v','error','-i',p,'-an','-vf','scale=%d:%d,format=gray'%(w,h),'-f','rawvideo','-'],capture_output=True,check=True).stdout
    return np.frombuffer(b,np.uint8).reshape(-1,h,w)[:, :int(h*0.7)].astype(np.int16)
A, B = fr(sys.argv[1]), fr(sys.argv[2]); bs = list(map(int, sys.argv[3:]))
for a, b in zip(bs[:-1], bs[1:]):
    r = {}
    for o in range(-2, 3):
        ks = [k for k in range(a, min(b, len(B))) if 0 <= k + o < len(A)]
        r[o] = round(float(np.mean([np.abs(B[k] - A[k + o]).mean() for k in ks])), 3)
    print('snimky B %d-%d: %s -> nejlepsi posun %+d' % (a, b, r, min(r, key=r.get)))
