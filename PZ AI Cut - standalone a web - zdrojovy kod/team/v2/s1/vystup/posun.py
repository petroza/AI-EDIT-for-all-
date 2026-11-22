# Porovna dva exporty snimek po snimku (seda 64x36, horni 60 % bez titulku) a najde posun snimku (chybejici prvni/posledni snimek).
# python posun.py A B
import subprocess, sys, numpy as np
def fr(p, w=64, h=36):
    b = subprocess.run(['ffmpeg','-v','error','-i',p,'-an','-vf','scale=%d:%d,format=gray'%(w,h),'-f','rawvideo','-'],capture_output=True,check=True).stdout
    return np.frombuffer(b,np.uint8).reshape(-1,h,w)[:, :int(h*0.6)].astype(np.int16)
A, B = fr(sys.argv[1]), fr(sys.argv[2])
print('frames', len(A), len(B))
for off in range(-3, 4):
    n = min(len(A), len(B) - off) if off >= 0 else min(len(A) + off, len(B))
    a = A[max(0, -off):max(0, -off) + n]; b = B[max(0, off):max(0, off) + n]
    print('offset B vs A %+d: MAD %.2f' % (off, np.abs(a - b).mean()))
