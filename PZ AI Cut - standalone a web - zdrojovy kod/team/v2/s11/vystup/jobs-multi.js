// S9 (z S8 bez rd/rx): vicestopa s11-multi (prolinacky V1 + Ctrl+D do stopy pod klipem, b-roll V2, hudba A3)
const O = 'vystup-s11-';
window.__S11JOBS = [
  ['s11-multi', 'h264', 'social', O + 'multi.mp4'], ['s11-multi', 'h264', 'social', O + 'multi-bez.mp4', false],
  ['s11-multi916', 'h264', 'social', O + 'multi916.mp4'], ['s11-multi11', 'h264', 'social', O + 'multi11.mp4'],
  ['s11-multi1080', 'xdcam', 'tv', O + 'multi1080-xdcam.mxf', false, null, { srtSidecar: true }],
  ['s11-multi', 'prores', 'off', O + 'pcm-mix.mov', false], ['s11-multi', 'prores', 'off', O + 'pcm-a1.mov', false, 0], ['s11-multi', 'prores', 'off', O + 'pcm-a2.mov', false, 1], ['s11-multi', 'prores', 'off', O + 'pcm-a3.mov', false, 2]];
return 'ok';
