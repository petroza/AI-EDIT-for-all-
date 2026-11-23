# Kolo S12 – role „Formáty a fps“: testovací zdroje s čárovým kódem čísla snímku (16 bitů), časovým kódem a pípnutím
# 1 kHz 40 ms v každé celé sekundě (+ podkladový tón 220 Hz). Výstup do %TEMP%\pz-s12-formaty-media\.
import os, subprocess, sys
OUT = os.path.join(os.environ['TEMP'], 'pz-s12-formaty-media')
os.makedirs(OUT, exist_ok=True)
FONT = 'C\\:/Windows/Fonts/arial.ttf'
only = set(sys.argv[1:])

def ff(args):
    r = subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + args, capture_output=True, text=True)
    if r.returncode:
        print('CHYBA', r.stderr[-800:]); raise SystemExit(1)

def vsrc(W, H, R, D):
    """Obraz W×H (zobrazovací), R = fps výraz, D = délka. Pruh 16 bitů ve výšce 0,45–0,55 H, x 0,1–0,9 W; čtverec 0,2 H."""
    cw = W * 0.8 / 16
    f = [f'color=c=0x404040:s={W}x{H}:r={R}:d={D}']
    for i in range(16):
        f.append(f"drawbox=x={int(W*0.1+i*cw+cw*0.1)}:y={int(H*0.45)}:w={int(cw*0.8)}:h={int(H*0.1)}:color=white:t=fill:enable='mod(floor(n/{2**i}),2)'")
    s = int(H * 0.2)
    f.append(f'drawbox=x={(W-s)//2}:y={int(H*0.78-s/2)}:w={s}:h={s}:color=white:t=fill')
    fs = max(16, H // 14)
    f.append(f"drawtext=fontfile='{FONT}':text='%{{pts\\:hms}}  f%{{frame_num}}':x=W*0.05:y=H*0.06:fontsize={fs}:fontcolor=white")
    f.append(f"drawtext=fontfile='{FONT}':text='TOP':x=(W-tw)/2:y=H*0.2:fontsize={fs}:fontcolor=yellow")
    return ','.join(f)

BEEP = '0.3*sin(2*PI*1000*t)*lt(mod(t,1),0.04)'
def asrc(D, sr=48000, layout='stereo', exprs=None):
    if exprs is None:
        e = f'0.2*sin(2*PI*220*t)+{BEEP}'
        n = {'mono': 1, 'stereo': 2}[layout]
        exprs = [e] * n
    return f"aevalsrc='{'|'.join(exprs)}':s={sr}:d={D}:c={layout}"

X264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p']
AAC = ['-c:a', 'aac', '-b:a', '256k']

def video(name, W, H, R, D=10, audio=True, venc=X264, aenc=AAC, ext='mp4', alay='stereo', sr=48000, aexprs=None, vpost='', extra=None):
    if only and name not in only: return
    vf = vsrc(W, H, R, D) + (',' + vpost if vpost else '')
    args = ['-f', 'lavfi', '-i', vf]
    if audio: args += ['-f', 'lavfi', '-i', asrc(D, sr, alay, aexprs)]
    args += venc + (aenc if audio else ['-an'])
    args += (extra or [])
    args += [os.path.join(OUT, f'{name}.{ext}')]
    ff(args); print('ok', name)

G = ['-g', '50']
video('v25p', 1920, 1080, 25)
video('v2997p', 1920, 1080, '30000/1001')
video('v23976p', 1920, 1080, '24000/1001')
video('v50p', 1920, 1080, 50)
video('v5994p', 1280, 720, '60000/1001')
video('v30p', 1920, 1080, 30)
# 1080i25 tff: obsah 50p, pole nahoře = sudý snímek 50p
video('i25', 1920, 1080, 50, vpost='tinterlace=mode=interleave_top,setfield=tff',
      venc=['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-flags', '+ildct+ilme', '-x264-params', 'tff=1', '-field_order', 'tt'])
# VFR jako z mobilu: průměr ~29,64 fps, nepravidelné rozestupy
video('vfr', 1280, 720, 30, vpost="setpts='(N/30*1.012+0.011*mod(N\\,3))/TB'",
      extra=['-fps_mode', 'vfr', '-video_track_timescale', '90000'])
video('hevc4k10', 3840, 2160, 25, D=6, venc=['-c:v', 'libx265', '-preset', 'ultrafast', '-crf', '22', '-pix_fmt', 'yuv420p10le', '-tag:v', 'hvc1', '-x265-params', 'log-level=error'])
video('v916', 1080, 1920, 25)
video('v11', 1080, 1080, 25)
# neštvercové pixely: kresleno 1920×1080, uloženo 1440×1080 SAR 4:3
video('anam', 1920, 1080, 25, vpost='scale=1440:1080,setsar=4/3')
# rotace 90°: obsah na výšku 1080×1920, uložen naležato (transpose) + metadata rotace
if not only or 'rot90' in only:
    tmp = os.path.join(OUT, '_rot_tmp.mp4')
    ff(['-f', 'lavfi', '-i', vsrc(1080, 1920, 25, 10) + ',transpose=clock', '-f', 'lavfi', '-i', asrc(10)] + X264 + AAC + [tmp])
    ff(['-display_rotation', '90', '-i', tmp, '-c', 'copy', os.path.join(OUT, 'rot90.mp4')])
    os.remove(tmp); print('ok rot90')
# zvuk
video('a_mono', 1280, 720, 25, alay='mono')
video('a_51', 1280, 720, 25, alay='5.1', aexprs=['0.15*sin(2*PI*300*t)', '0.15*sin(2*PI*500*t)', f'0.15*sin(2*PI*700*t)+{BEEP}',
      '0.15*sin(2*PI*60*t)', '0.15*sin(2*PI*1300*t)', '0.15*sin(2*PI*1700*t)'])
if not only or 'a_2mono' in only:
    ff(['-f', 'lavfi', '-i', vsrc(1280, 720, 25, 10), '-f', 'lavfi', '-i', asrc(10, layout='mono', exprs=[f'0.2*sin(2*PI*300*t)+{BEEP}']),
        '-f', 'lavfi', '-i', asrc(10, layout='mono', exprs=[f'0.2*sin(2*PI*1700*t)+{BEEP}']),
        '-map', '0', '-map', '1', '-map', '2'] + X264 + AAC + [os.path.join(OUT, 'a_2mono.mp4')]); print('ok a_2mono')
video('a_441', 1280, 720, 25, sr=44100)
video('a_96', 1280, 720, 25, sr=96000, aenc=['-c:a', 'pcm_s24le'], ext='mov')
video('a_none', 1280, 720, 25, audio=False)
# čistý zvuk
def audio(name, ext, enc, sr=48000):
    if only and name not in only: return
    ff(['-f', 'lavfi', '-i', asrc(10, sr)] + enc + [os.path.join(OUT, f'{name}.{ext}')]); print('ok', name)
audio('au_wav', 'wav', ['-c:a', 'pcm_s24le'])
audio('au_mp3', 'mp3', ['-c:a', 'libmp3lame', '-b:a', '192k'], 44100)
audio('au_aac', 'aac', ['-c:a', 'aac', '-b:a', '192k'])
audio('au_m4a', 'm4a', ['-c:a', 'aac', '-b:a', '192k'])
# obrázky
for nm, ext in (('img_png', 'png'), ('img_jpg', 'jpg')):
    if only and nm not in only: continue
    ff(['-f', 'lavfi', '-i', vsrc(1920, 1080, 25, 1), '-frames:v', '1', '-update', '1', os.path.join(OUT, f'{nm}.{ext}')]); print('ok', nm)
# MXF XDCAM HD422 1080i25 tff, 2 mono stopy (ch1 300 Hz + pípnutí, ch2 1700 Hz + pípnutí)
if not only or 'mxf_xdcam' in only:
    ff(['-f', 'lavfi', '-i', vsrc(1920, 1080, 50, 10) + ',tinterlace=mode=interleave_top,setfield=tff',
        '-f', 'lavfi', '-i', asrc(10, layout='mono', exprs=[f'0.2*sin(2*PI*300*t)+{BEEP}']),
        '-f', 'lavfi', '-i', asrc(10, layout='mono', exprs=[f'0.2*sin(2*PI*1700*t)+{BEEP}']),
        '-map', '0', '-map', '1', '-map', '2',
        '-c:v', 'mpeg2video', '-pix_fmt', 'yuv422p', '-b:v', '50M', '-minrate', '50M', '-maxrate', '50M', '-bufsize', '17825792',
        '-g', '12', '-bf', '2', '-flags', '+ildct+ilme', '-alternate_scan', '1', '-field_order', 'tt', '-c:a', 'pcm_s24le', '-ar', '48000', '-f', 'mxf',
        os.path.join(OUT, 'mxf_xdcam.mxf')]); print('ok mxf_xdcam')
video('prores_mov', 1920, 1080, 25, venc=['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le'], aenc=['-c:a', 'pcm_s24le'], ext='mov')
# poškozený: MP4 bez faststart (moov na konci) useknutý na polovinu
if not only or 'corrupt' in only:
    tmp = os.path.join(OUT, '_c.mp4')
    ff(['-f', 'lavfi', '-i', vsrc(1280, 720, 25, 10), '-f', 'lavfi', '-i', asrc(10)] + X264 + AAC + [tmp])
    b = open(tmp, 'rb').read(); open(os.path.join(OUT, 'corrupt.mp4'), 'wb').write(b[:len(b)//2]); os.remove(tmp); print('ok corrupt')
# dlouhý 29,97 na drift (10 min, malé rozlišení)
video('long2997', 640, 360, '30000/1001', D=600, venc=['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p'])
