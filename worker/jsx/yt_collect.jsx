// Collect Files (yt_collect): otevře projekt, nechá jen to, co používá kompozice, zkopíruje všechny zdroje do složky
// Footage (sdílené víc projekty, stejná jména z různých složek dostanou číslo) a projekt uloží vedle.
(function () {
    function rd(p) { var f = new File(p); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return s; }
    var C = eval("(" + rd(YT_JOB) + ")");
    var LOG = new File(C.log); LOG.encoding = "UTF-8"; LOG.open("w");
    function w(s) { LOG.writeln(s); }
    function done(s) { try { var f = new File(C.done); f.encoding = "UTF-8"; f.open("w"); f.write(s); f.close(); } catch (e) {} }
    try {
        app.beginSuppressDialogs();
        try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e) {}
        app.open(new File(C.src));
        var p = app.project, comp = null;
        for (var i = 1; i <= p.numItems; i++) { var it = p.item(i); if (it instanceof CompItem && it.name == C.comp) comp = it; }
        if (!comp) throw new Error("komp nenalezena " + C.comp);
        p.reduceProject([comp]);
        var fdir = new Folder(C.footage); if (!fdir.exists) fdir.create();
        var n = 0, bytes = 0, miss = 0, seen = {};
        for (var i = 1; i <= p.numItems; i++) {
            var it = p.item(i);
            if (!(it instanceof FootageItem)) continue;
            var src = it.mainSource;
            if (!(src instanceof FileSource) || !src.file) continue;
            var f = src.file;
            if (!f.exists) { miss++; w("CHYBÍ " + f.fsName); continue; }
            var name = f.name, target = new File(fdir.fsName + "/" + name);
            var key = f.fsName.toLowerCase();
            if (seen[key]) { it.replace(new File(seen[key])); continue; }
            var k = 1;
            while (target.exists && target.length != f.length) { target = new File(fdir.fsName + "/" + k + "_" + name); k++; }
            if (!target.exists) { if (!f.copy(target.fsName)) { w("KOPIE SELHALA " + f.fsName); continue; } bytes += f.length; }
            it.replace(target);
            seen[key] = target.fsName; n++;
        }
        p.save(new File(C.dst));
        w("zdrojů " + n + " zkopírováno MB " + Math.round(bytes / 1048576) + " chybí " + miss);
        w("HOTOVO");
        LOG.close();
        done("HOTOVO zdrojů " + n + " MB " + Math.round(bytes / 1048576) + " chybí " + miss);
    } catch (e) { w("FATAL " + e + " " + e.line); LOG.close(); done("FATAL " + e); }
})();
