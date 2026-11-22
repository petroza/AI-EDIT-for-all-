'use strict';
// Cesty k souborům přetaženým z Průzkumníka / plochy Windows. Electron 32+ už nemá File.path – cesta jde jen
// přes webUtils.getPathForFile (bezpečnostní změna Electronu).
function droppedPaths(dt) {
  let webUtils = null;
  try { ({ webUtils } = require('electron')); } catch (e) { /* mimo Electron */ }
  return [...((dt && dt.files) || [])].map((f) => {
    try { return (webUtils && webUtils.getPathForFile(f)) || f.path || ''; } catch (e) { return f.path || ''; }
  }).filter(Boolean);
}
module.exports = { droppedPaths };
