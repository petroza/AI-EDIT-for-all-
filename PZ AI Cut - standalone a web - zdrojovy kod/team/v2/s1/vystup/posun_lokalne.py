# Kde se export B (napr. MXF) rozejde s A (MP4 stejne sekvence) o snimek: pro kazdy snimek B nejlepsi posun -2..+2 proti A.
# python posun_lokalne.py A B
import subprocess, sys, numpy as np
def fr(p, w=96, h=54):
    b = subprocess.run(['ffmpeg','-v','error','-i',p,'-an','-vf','scale=%d:%d,format=gray'%(w,h),'-f','rawvideo','-'],capture_output=True,check=True).stdout
    return np.frombuffer(b,np.uint8).reshape(-1,h,w)[:, :int(h*0.7)].astype(np.int16)
A, B = fr(sys.argv[1]), fr(sys.argv[2])
prev = None; runs = []
for k in range(len(B)):
    best = min(((abs(o) * 0.01 + np.abs(B[k] - A[k + o]).mean(), o) for o in range(-2, 3) if 0 <= k + o < len(A)))
    if best[1] != prev: runs.append([k, best[1], round(best[0], 2)]); prev = best[1]
print('A', len(A), 'B', len(B)); print('useky [snimek B, posun proti A, MAD]:', runs)
