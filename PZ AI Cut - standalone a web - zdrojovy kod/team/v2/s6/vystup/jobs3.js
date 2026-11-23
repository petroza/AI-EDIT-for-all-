// S5: exporty BEZ vypalenych titulku (cesta -c:v copy) - MXF pro TV casto bez titulku
const P = TN.app.project, U = require('O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/src/core/util');
// 9:16 kopie v 1920x1080? ne - XDCAM jen 16:9; 9:16 do DNxHR (libovolna velikost) a H.265
window.__S6JOBS = [
  ['s6-multi916', 'dnxhr', 'tv', 'vystup-s6-multi916-bez-dnxhr.mxf', false],
  ['s6-multi916', 'h265', 'social', 'vystup-s6-multi916-bez-h265.mp4', false],
  ['s6-multi916', 'prores', 'off', 'vystup-s6-multi916-bez-prores.mov', false],
  ['s6-multi1080', 'xdcam', 'tv', 'vystup-s6-multi1080-bez-xdcam.mxf', false],
  ['s6-multi1080', 'dnxhr', 'tv', 'vystup-s6-multi1080-bez-dnxhr.mxf', false],
  ['s6-multi11', 'h264', 'off', 'vystup-s6-multi11-bez.mp4', false],
];
return window.__S6JOBS.length;
