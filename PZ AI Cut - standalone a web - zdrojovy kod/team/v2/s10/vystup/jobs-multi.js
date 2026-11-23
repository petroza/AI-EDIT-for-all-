// S9 (z S8 bez rd/rx): vicestopa s10-multi (prolinacky V1 + Ctrl+D do stopy pod klipem, b-roll V2, hudba A3)
const O = 'vystup-s10-';
window.__S10JOBS = [
  ['s10-multi', 'h264', 'social', O + 'multi.mp4'], ['s10-multi', 'h264', 'social', O + 'multi-bez.mp4', false],
  ['s10-multi916', 'h264', 'social', O + 'multi916.mp4'], ['s10-multi11', 'h264', 'social', O + 'multi11.mp4'],
  ['s10-multi1080', 'xdcam', 'tv', O + 'multi1080-xdcam.mxf', false, null, { srtSidecar: true }],
  ['s10-multi', 'prores', 'off', O + 'pcm-mix.mov', false], ['s10-multi', 'prores', 'off', O + 'pcm-a1.mov', false, 0], ['s10-multi', 'prores', 'off', O + 'pcm-a2.mov', false, 1], ['s10-multi', 'prores', 'off', O + 'pcm-a3.mov', false, 2]];
return 'ok';
