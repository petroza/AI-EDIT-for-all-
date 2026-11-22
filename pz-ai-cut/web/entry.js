'use strict';
// Vstup webové verze: kontrola prohlížeče, menu (HTML místo nativního), okno aplikace (sdílené s desktopem), napojení.
const support = window.VideoDecoder && window.VideoEncoder && window.showSaveFilePicker;
if (!support) {
  document.body.insertAdjacentHTML('afterbegin', '<div class="web-unsupported">PZ AI Cut Web needs <b>Google Chrome</b> (or Microsoft Edge) on a computer – this browser cannot edit video files. / Potřebuje <b>Google Chrome</b> na počítači.</div>');
}
require('./menubar');
require('../src/renderer.js');
require('./web-glue');
require('./ai/bridge'); // AI: spojení s Claude Desktop přes konektor na tomto počítači
