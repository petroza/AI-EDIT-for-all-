'use strict';
/* Přetažené soubory ve webové verzi: soubor dostane virtuální cestu hned a handle (pro příští otevření
 * projektu) se k ní doplní, jakmile ho Chrome vydá. getAsFileSystemHandle se musí zavolat hned v události drop. */
const vfs = require('./vfs');

function droppedPaths(dt) {
  const out = [];
  const items = [...((dt && dt.items) || [])].filter((it) => it.kind === 'file');
  if (items.length) {
    for (const it of items) {
      const f = it.getAsFile();
      if (!f) continue;
      const p = vfs.registerFile(f);
      out.push(p);
      if (it.getAsFileSystemHandle) it.getAsFileSystemHandle().then((h) => { if (h && h.kind === 'file') vfs.attachHandle(p, h); }).catch(() => {});
    }
    return out;
  }
  return [...((dt && dt.files) || [])].map((f) => vfs.registerFile(f));
}
module.exports = { droppedPaths };
