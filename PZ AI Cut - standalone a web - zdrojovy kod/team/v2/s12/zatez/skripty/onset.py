import sys,subprocess,numpy as np
a=subprocess.run(['ffmpeg','-v','error']+sys.argv[1:]+['-vn','-ac','1','-ar','48000','-af','highpass=f=700,lowpass=f=1400','-f','s16le','-'],capture_output=True).stdout
s=np.frombuffer(a[:len(a)//2*2],dtype='<i2').astype(float); W=48; m=len(s)//W; e=np.sqrt((s[:m*W].reshape(m,W)**2).mean(1))
on=[i for i in range(1,len(e)) if e[i]>3000 and e[i-1]<=3000]; print(sys.argv[1:4], on[:3])
