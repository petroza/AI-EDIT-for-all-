// Kontrolní snímky z AE projektu YouTuber verze (yt_stills): otevře projekt, uloží PNG v zadaných časech.
(function () {
    function rd(p) { var f = new File(p); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return s; }
    var J = eval("(" + rd(YT_JOB) + ")");
    var LOG = new File(J.log); LOG.encoding = "UTF-8";
    function w(s) { try { LOG.open("a"); LOG.writeln(s); LOG.close(); } catch (e) {} }
    function done(s) { try { var f = new File(J.done); f.encoding = "UTF-8"; f.open("w"); f.write(s); f.close(); } catch (e) {} }
    LOG.open("w"); LOG.write(""); LOG.close();
    try {
        app.beginSuppressDialogs();
        var proj = app.project;
        var cur = (proj && proj.file) ? proj.file.fsName.toLowerCase().replace(/\\/g, "/") : "";
        if (cur != String(J.aep).toLowerCase().replace(/\\/g, "/")) {
            try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e) {}
            app.open(new File(J.aep));
            proj = app.project;
        }
        var comp = null;
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof CompItem && it.name == J.comp) comp = it; }
        if (!comp) throw new Error("kompozice nenalezena: " + J.comp);
        for (var k = 0; k < J.times.length; k++) {
            var f = new File(J.dir + "/still_" + k + ".png");
            try { comp.saveFrameToPng(J.times[k], f); w("ok " + J.times[k]); } catch (e) { w("ERR " + J.times[k] + " " + e); }
        }
        done("HOTOVO");
    } catch (err) { w("FATAL " + err + " " + err.line); done("FATAL " + err); }
})();
