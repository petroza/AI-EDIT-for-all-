// S9 (z S8 bez rd/rx): vicestopa s9-multi (prolinacky V1 + Ctrl+D do stopy pod klipem, b-roll V2, hudba A3)
const O = 'vystup-s9-';
window.__S9JOBS = [
  ['s9-multi', 'h264', 'social', O + 'multi.mp4'], ['s9-multi', 'h264', 'social', O + 'multi-bez.mp4', false],
  ['s9-multi916', 'h264', 'social', O + 'multi916.mp4'], ['s9-multi11', 'h264', 'social', O + 'multi11.mp4'],
  ['s9-multi1080', 'xdcam', 'tv', O + 'multi1080-xdcam.mxf', false, null, { srtSidecar: true }],
  ['s9-multi', 'prores', 'off', O + 'pcm-mix.mov', false], ['s9-multi', 'prores', 'off', O + 'pcm-a1.mov', false, 0], ['s9-multi', 'prores', 'off', O + 'pcm-a2.mov', false, 1], ['s9-multi', 'prores', 'off', O + 'pcm-a3.mov', false, 2]];
return 'ok';
