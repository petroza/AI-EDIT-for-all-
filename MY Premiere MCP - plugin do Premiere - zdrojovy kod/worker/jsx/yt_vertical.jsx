// YouTuber verze 9:16 v After Effects podle ae_plan.json (yt_build_ae, format 9x16). Vznikl z build_vertical.jsx 1. dílu Detail.
(function () {
    function rd(p) { var f = new File(p); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return s; }
    // YT_JOB = cesta k souboru úlohy (vloží worker/aerun.py před tento skript); vše specifické pro díl je v něm
    var J = eval("(" + rd(YT_JOB) + ")");
    var FONT = J.font || "OrganicaM-Bold";
    var LOG = new File(J.log); LOG.encoding = "UTF-8";
    function log(s) { for (var tries = 0; tries < 8; tries++) { try { if (LOG.open("a")) { LOG.writeln(s); LOG.close(); return; } } catch (e) { try { LOG.close(); } catch (e2) {} $.sleep(100); } } }
    function done(s) { try { var f = new File(J.done); f.encoding = "UTF-8"; f.open("w"); f.write(s); f.close(); } catch (e) {} }
    LOG.open("w"); LOG.write(""); LOG.close();
    var errCount = 0;
    function tryit(label, fn) { try { fn(); } catch (e) { errCount++; if (errCount < 40) log("CHYBA " + label + ": " + e + (e.line ? " @" + e.line : "")); } }
    try {
        var P = eval("(" + rd(J.plan) + ")");
        log("plán: cam " + P.cam.length + " gfx " + P.gfx.length + " hudba " + P.music.length + " tagy " + P.tags.length + " titulky " + P.caps.length);
        app.beginSuppressDialogs();
        try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e) { log("close: " + e); }
        app.newProject();
        var proj = app.project;
        function importProj(path) { var o = new ImportOptions(new File(path)); o.importAs = ImportAsType.PROJECT; proj.importFile(o); }
        for (var ip = 0; ip < (J.importProjects || []).length; ip++) tryit("import " + J.importProjects[ip], function () { importProj(J.importProjects[ip]); });
        function findComp(name) { for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof CompItem && it.name == name) return it; } return null; }
        var miss = 0; for (var i = 1; i <= proj.numItems; i++) { try { if (proj.item(i) instanceof FootageItem && proj.item(i).footageMissing) miss++; } catch (e) {} }
        log("chybějící zdroje po importu: " + miss);
        var cache = {};
        function imp(path) { if (cache[path]) return cache[path]; var o = new ImportOptions(new File(path)); var it = proj.importFile(o); cache[path] = it; return it; }
        var comp = proj.items.addComp("VERTIKAL 9x16", 1080, 1920, 1, P.dur, 25);
        comp.bgColor = [0, 0, 0];
        var SRCITEM = imp(J.source);
        var S0 = 177.78, SFIT = 56.25;
        var easeOut = null; tryit("ease", function () { easeOut = new KeyframeEase(0, 80); });

        function clamp(v, lo, hi) { return Math.max(Math.min(v, hi), lo); }
        function placeFor(S, cx, cy, ty) {
            var px = 540 - (cx - 960) * S / 100, py = ty - (cy - 540) * S / 100;
            px = clamp(px, 1080 - 960 * S / 100, 960 * S / 100);
            var h = 540 * S / 100, lo = Math.min(h, 1920 - h), hi = Math.max(h, 1920 - h);
            return [px, clamp(py, lo, hi)];
        }
        function setEase(prop, key, dims) {
            if (!easeOut) return;
            tryit("setEase", function () { var a = []; for (var i = 0; i < dims; i++) a.push(easeOut); prop.setTemporalEaseAtKey(key, a, a); });
        }
        function freezeLayer(L, tf, t0, t1) {
            tryit("freeze", function () {
                L.timeRemapEnabled = true;
                var tr = L.property("ADBE Time Remapping");
                for (var q = tr.numKeys; q >= 1; q--) tr.removeKey(q);
                tr.setValueAtTime(t0, tf); tr.setValueAtTime(t1, tf);
                L.audioEnabled = false;
            });
        }

        // ---------- kamera / B-roll / obrazovky / zmrazené snímky
        var nCam = 0, prevScr = null;
        for (var i = 0; i < P.cam.length; i++) {
            (function (it) {
                var layers = [];
                var d = it.tl1 - it.tl0;
                var VS = SRCITEM, VST = it.tl0 - it.a;
                if (it.freezePng) { VS = imp(it.freezePng.replace(/\\/g, "/")); VST = it.tl0; }
                if (it.kind == "screen") {
                    var B = comp.layers.add(VS);
                    B.startTime = VST; B.inPoint = it.tl0; B.outPoint = it.tl1; B.audioEnabled = false;
                    B.transform.scale.setValue([S0, S0]); B.transform.position.setValue([540, 960]); B.transform.opacity.setValue(38);
                    tryit("blur", function () { var bl = B.property("Effects").addProperty("ADBE Gaussian Blur 2"); bl.property("Blurriness").setValue(60); });
                    B.name = "bg"; layers.push(B);
                    var L = comp.layers.add(VS);
                    L.startTime = VST; L.inPoint = it.tl0; L.outPoint = it.tl1;
                    if (it.fit) {
                        L.transform.scale.setValueAtTime(it.tl0, [SFIT, SFIT]); L.transform.scale.setValueAtTime(it.tl1, [SFIT * 1.07, SFIT * 1.07]);
                        L.transform.position.setValue([540, 800]);
                        prevScr = null; L.name = "celek";
                    } else {
                        var roi = it.roi || [960, 540, 125], Z = roi[2], Z2 = Z * 1.04;
                        var pr = placeFor(Z, roi[0], roi[1], 806), pr2 = placeFor(Z2, roi[0], roi[1], 806);
                        var sA, pA, tz;
                        if (it.first || !prevScr) { sA = SFIT; pA = [540, 800]; tz = Math.min(0.9, d * 0.5); }
                        else { sA = prevScr.Z; pA = prevScr.P; tz = Math.min(0.55, d * 0.4); }
                        L.transform.scale.setValueAtTime(it.tl0, [sA, sA]); L.transform.scale.setValueAtTime(it.tl0 + tz, [Z, Z]); L.transform.scale.setValueAtTime(it.tl1, [Z2, Z2]);
                        L.transform.position.setValueAtTime(it.tl0, pA); L.transform.position.setValueAtTime(it.tl0 + tz, pr); L.transform.position.setValueAtTime(it.tl1, pr2);
                        setEase(L.transform.scale, 2, 3);
                        tryit("easepos", function () { L.transform.position.setTemporalEaseAtKey(2, [easeOut], [easeOut]); });
                        prevScr = { Z: Z2, P: pr2 };
                        L.name = "scr";
                    }
                    layers.push(L);
                } else {
                    prevScr = null;
                    var L = comp.layers.add(VS);
                    L.startTime = VST; L.inPoint = it.tl0; L.outPoint = it.tl1;
                    var S = (it.typ == "wide") ? (it.variant ? S0 * 1.30 : S0) : (it.variant ? S0 * 1.15 : S0);
                    var tw = Math.min(0.28, d * 0.5);
                    var s1 = S * (it.jump ? 1.14 : (it.punch ? 1.07 : 1.03)), s3 = S * 1.035;
                    var ty = 1920 * 0.40, fy = it.fy || 540, cx = it.cx || 960;
                    L.transform.scale.setValueAtTime(it.tl0, [s1, s1]); L.transform.scale.setValueAtTime(it.tl0 + tw, [S, S]); L.transform.scale.setValueAtTime(it.tl1, [s3, s3]);
                    if (it.track && it.track.length > 1) {
                        // postava se hýbe: hlava stále na středu (poloha sleduje ruční/automatickou dráhu)
                        var tyb = 840;
                        for (var tq = 0; tq < it.track.length; tq++) {
                            var tk = it.track[tq]; var tt = it.tl0 + (tk[0] - it.a);
                            var sc2 = (tt <= it.tl0 + tw) ? S + (s1 - S) * (1 - (tt - it.tl0) / tw) : S + (s3 - S) * ((tt - it.tl0 - tw) / Math.max(0.01, it.tl1 - it.tl0 - tw));
                            L.transform.position.setValueAtTime(Math.min(Math.max(tt, it.tl0), it.tl1), placeFor(sc2, tk[1], tk[2], tyb));
                        }
                        setEase(L.transform.scale, 2, 3);
                    } else {
                    L.transform.position.setValueAtTime(it.tl0, placeFor(s1, cx, fy, ty));
                    L.transform.position.setValueAtTime(it.tl0 + tw, placeFor(S, cx, fy, ty));
                    L.transform.position.setValueAtTime(it.tl1, placeFor(s3, cx, fy, ty));
                    setEase(L.transform.scale, 2, 3);
                    tryit("easepos", function () { L.transform.position.setTemporalEaseAtKey(2, [easeOut], [easeOut]); });
                    }
                    if (it.shake || it.jump) L.transform.position.expression = "var d=time-inPoint; d<0.3 ? wiggle(13, 24*(1-d/0.3)) : value;";
                    L.name = it.typ + (it.spk ? " " + it.spk : "");
                    layers.push(L);
                }
                if (it.freezeAt !== undefined && it.freezeAt !== null) {
                    var A = comp.layers.add(SRCITEM);
                    A.startTime = it.tl0 - it.a; A.inPoint = it.tl0; A.outPoint = it.tl1; A.enabled = false; A.name = "zvuk-drzeni";
                    A.moveToEnd();
                }
                nCam++;
            })(P.cam[i]);
        }
        log("kamerové vrstvy: " + nCam);

        // ---------- grafika: znělka M13, předěly, copyright ve svislé verzi
        var NAVY = [0, 0, 0.184];
        tryit("navy", function () { if (!J.navyFrom) return; var s = findComp(J.navyFrom.komp); for (var q = 1; q <= s.numLayers; q++) { if (s.layer(q).name == J.navyFrom.vrstva) { var c = s.layer(q).source.mainSource.color; NAVY = [c[0], c[1], c[2]]; } } });
        log("navy " + NAVY.join(","));


        function feather(L, w, h) {
            tryit("feather", function () {
                var m = L.property("Masks").addProperty("ADBE Mask Atom"); var sh = new Shape();
                sh.vertices = [[0, 130], [w, 130], [w, h - 130], [0, h - 130]]; sh.closed = true;
                m.property("ADBE Mask Shape").setValue(sh); m.property("ADBE Mask Feather").setValue([0, 120]);
            });
        }
        function addCompGfx(cmp, g, vscale) {
            var bg = comp.layers.addSolid(NAVY, "navy " + g.name, 1080, 1920, 1);
            bg.startTime = g.tl0; bg.inPoint = g.tl0; bg.outPoint = g.tl1;
            var L = comp.layers.add(cmp);
            L.startTime = g.tl0 - g["in"]; L.inPoint = g.tl0; L.outPoint = g.tl1;
            L.transform.scale.setValue([vscale, vscale]); L.transform.position.setValue([540 + 35 * vscale / 100, 960]);   // logo je v původním záběru o 35 px vlevo od středu
            L.audioEnabled = false;
            L.name = cmp.name;
            if (vscale < 100) feather(L, 1920, 1080);
            return L;
        }
        var GMAP = J.gfxVertical || {};
        for (var i = 0; i < P.gfx.length; i++) {
            (function (g) {
                tryit("gfx " + g.name, function () {
                    var mp = GMAP[g.name];
                    if (J.jingle && J.jingle.vertical && g.name.indexOf(J.jingle.match) == 0) {
                        // vybraná svislá znělka (hotový render 1080x1920 se zvukem)
                        var zn = imp(J.jingle.vertical);
                        var ZL = comp.layers.add(zn);
                        ZL.startTime = g.tl0 - g["in"]; ZL.inPoint = g.tl0; ZL.outPoint = g.tl1; ZL.name = "ZNELKA " + zn.name;
                        log("gfx: znělka " + zn.name);
                        return;
                    }
                    var item = imp(g.path.replace(/\\/g, "/"));
                    var cmp = null;
                    if (mp) cmp = findComp(mp[0]);
                    if (cmp) {
                        var CL = addCompGfx(cmp, g, mp[1]);
                        var A = comp.layers.add(item);   // zvuk původního exportu
                        A.startTime = g.tl0 - g["in"]; A.inPoint = g.tl0; A.outPoint = g.tl1; A.enabled = false; A.name = "zvuk " + g.name;
                        log("gfx svisle: " + g.name + " -> " + cmp.name);
                    } else {
                        var B = comp.layers.add(item);
                        B.startTime = g.tl0 - g["in"]; B.inPoint = g.tl0; B.outPoint = g.tl1; B.audioEnabled = false;
                        var sc = 100 * 1920 / item.height; B.transform.scale.setValue([sc, sc]); B.transform.position.setValue([540, 960]); B.transform.opacity.setValue(40);
                        B.property("Effects").addProperty("ADBE Gaussian Blur 2").property("Blurriness").setValue(55);
                        var L = comp.layers.add(item);
                        L.startTime = g.tl0 - g["in"]; L.inPoint = g.tl0; L.outPoint = g.tl1;
                        var f = 100 * 1080 / item.width; L.transform.scale.setValue([f, f]); L.transform.position.setValue([540, 960]);
                        log("gfx FALLBACK (na šířku): " + g.name);
                    }
                });
            })(P.gfx[i]);
        }

        // ---------- fotky podle kontextu (celoplošné vložky / karty v rohu)
        var cornerN = 0;
        for (var i = 0; i < (P.photos || []).length; i++) {
            (function (ph) {
                tryit("foto " + ph.id, function () {
                    var item = imp(ph.path.replace(/\\/g, "/"));
                    var t0 = ph.tl0, t1 = ph.tl0 + ph.dur;
                    if (ph.mode == "crown") {
                        var S = ph.S, pp0 = placeFor(S, ph.cx, ph.fy, 768);
                        var hx = pp0[0] + (ph.cx - 960) * S / 100, hy = pp0[1] + (ph.fy - 540) * S / 100;
                        var cw = 215 * S / 100;                           // šířka koruny ~ šířka hlavy
                        var ch = cw * item.height / item.width;
                        var Cc = comp.layers.add(item); Cc.name = "KORUNA";
                        Cc.startTime = t0; Cc.inPoint = t0; Cc.outPoint = t1;
                        Cc.transform.anchorPoint.setValue([item.width / 2, item.height]);          // kotva = spodní okraj koruny
                        var cs0 = cw / item.width * 100;
                        var by = hy - 150 * S / 100;                      // čelo / temeno
                        Cc.transform.position.setValue([hx, by]);
                        var sk = Cc.transform.scale;
                        sk.setValueAtTime(t0, [cs0 * 0.2, cs0 * 0.2]); sk.setValueAtTime(t0 + 0.16, [cs0 * 1.18, cs0 * 1.18]); sk.setValueAtTime(t0 + 0.32, [cs0, cs0]);
                        sk.setValueAtTime(t1 - 0.2, [cs0, cs0]); sk.setValueAtTime(t1, [0, 0]);
                        setEase(sk, 1, 3); setEase(sk, 2, 3);
                        var pk = Cc.transform.position;
                        pk.setValueAtTime(t0, [hx, by - 260]); pk.setValueAtTime(t0 + 0.2, [hx, by + 14]); pk.setValueAtTime(t0 + 0.34, [hx, by]);
                        Cc.transform.rotation.expression = "var d=time-inPoint; -7+Math.sin(d*6)*Math.max(0,3.2-d*3)+Math.sin(d*2.2)*1.2";
                        tryit("koruna-stin", function () { var ds = Cc.property("Effects").addProperty("ADBE Drop Shadow"); ds.property("ADBE Drop Shadow-0002").setValue(60); ds.property("ADBE Drop Shadow-0004").setValue(8); ds.property("ADBE Drop Shadow-0005").setValue(16); });
                        log("koruna @" + t0 + " hlava " + Math.round(hx) + "," + Math.round(hy));
                        return;
                    }
                    if (ph.mode == "full") {
                        var B = comp.layers.add(item); B.name = "foto-bg " + ph.id;
                        B.startTime = t0; B.inPoint = t0; B.outPoint = t1;
                        var cs = Math.max(1920 / item.height, 1080 / item.width) * 100;
                        B.transform.scale.setValue([cs, cs]); B.transform.position.setValue([540, 960]); B.transform.opacity.setValue(40);
                        B.property("Effects").addProperty("ADBE Gaussian Blur 2").property("Blurriness").setValue(60);
                        var L = comp.layers.add(item); L.name = "foto " + ph.id;
                        L.startTime = t0; L.inPoint = t0; L.outPoint = t1;
                        var fs = 1080 / item.width * 100;
                        L.transform.position.setValue([540, 800]);
                        L.transform.scale.setValueAtTime(t0, [fs * 0.86, fs * 0.86]); L.transform.scale.setValueAtTime(t0 + 0.16, [fs * 1.0, fs * 1.0]); L.transform.scale.setValueAtTime(t1, [fs * 1.08, fs * 1.08]);
                        setEase(L.transform.scale, 2, 3);
                        L.transform.opacity.setValueAtTime(t0, 0); L.transform.opacity.setValueAtTime(t0 + 0.08, 100); L.transform.opacity.setValueAtTime(t1 - 0.12, 100); L.transform.opacity.setValueAtTime(t1, 0);
                        B.transform.opacity.setValueAtTime(t0, 0); B.transform.opacity.setValueAtTime(t0 + 0.08, 40); B.transform.opacity.setValueAtTime(t1 - 0.12, 40); B.transform.opacity.setValueAtTime(t1, 0);
                    } else {
                        cornerN++;
                        var W = Math.min(440, Math.round(320 * item.width / item.height)), H = Math.round(W * item.height / item.width);
                        var ctrl = comp.layers.addNull(); ctrl.name = "FOTOCTRL " + ph.id; ctrl.inPoint = t0; ctrl.outPoint = t1;
                        var R = comp.layers.addShape(); R.name = "ramecek " + ph.id; R.inPoint = t0; R.outPoint = t1;
                        var g = R.property("Contents").addProperty("ADBE Vector Group");
                        var rc = g.property("Contents").addProperty("ADBE Vector Shape - Rect");
                        rc.property("ADBE Vector Rect Size").setValue([W + 26, H + 26]); rc.property("ADBE Vector Rect Roundness").setValue(14);
                        var fl = g.property("Contents").addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue([1, 1, 1]);
                        tryit("stin", function () { var ds = R.property("Effects").addProperty("ADBE Drop Shadow"); ds.property("ADBE Drop Shadow-0002").setValue(65); ds.property("ADBE Drop Shadow-0004").setValue(12); ds.property("ADBE Drop Shadow-0005").setValue(26); });
                        var L = comp.layers.add(item); L.name = "foto " + ph.id;
                        L.startTime = t0; L.inPoint = t0; L.outPoint = t1;
                        var s0 = W / item.width * 100; L.transform.scale.setValue([s0, s0]);
                        L.transform.position.setValue([0, 0]);
                        L.parent = ctrl; R.parent = ctrl;
                        L.transform.position.setValue([0, 0]); R.transform.position.setValue([0, 0]);   // po přiřazení rodiče (jinak se poloha přepočítá)
                        var scp = ctrl.transform.scale;
                        scp.setValueAtTime(t0, [0, 0]); scp.setValueAtTime(t0 + 0.14, [118, 118]); scp.setValueAtTime(t0 + 0.28, [100, 100]);
                        scp.setValueAtTime(t1 - 0.2, [100, 100]); scp.setValueAtTime(t1, [0, 0]);
                        setEase(scp, 1, 3); setEase(scp, 2, 3);
                        ctrl.transform.position.setValue([785, 150 + 20 + H / 2 + 52]);
                        var sign = (cornerN % 2) ? 1 : -1;
                        ctrl.transform.rotation.setValue(4.5 * sign);
                        ctrl.transform.rotation.expression = "var d=time-inPoint; var n=0; if(d<0.4){ n=wiggle(13,6*(1-d/0.4))-value; } value+Math.sin(d*2.4)*1.1+n;";
                        ctrl.transform.position.expression = "value+[0,Math.sin((time-inPoint)*1.9)*6]";
                    }
                    log("foto " + ph.id + " " + ph.mode + " @" + t0);
                });
            })(P.photos[i]);
        }

        // ---------- hudba
        for (var i = 0; i < P.music.length; i++) {
            (function (m) {
                tryit("hudba " + m.name, function () {
                    var item = imp(m.path.replace(/\\/g, "/"));
                    var L = comp.layers.add(item);
                    L.startTime = m.tl0 - m["in"]; L.inPoint = m.tl0; L.outPoint = m.tl1;
                    for (var k = 0; k < m.keys.length; k++) L.audioLevels.setValueAtTime(m.keys[k][0], [m.keys[k][1], m.keys[k][1]]);
                    L.name = "HUDBA " + m.name;
                });
            })(P.music[i]);
        }
        var WH = imp(J.whoosh);
        for (var i = 0; i < P.jumps.length; i++) {
            (function (j) { tryit("whoosh", function () { var L = comp.layers.add(WH); L.startTime = j - 0.22; L.audioLevels.setValue([J.whooshDb, J.whooshDb]); L.name = "SVIST"; }); })(P.jumps[i]);
        }

        // ---------- záblesk
        var fl = comp.layers.addSolid([1, 1, 1], "FLASH", 1080, 1920, 1);
        fl.transform.opacity.expression = "var J=[" + P.jumps.join(",") + "]; var o=0; for(var i=0;i<J.length;i++){var d=time-J[i]; if(d>-0.03&&d<0.14){ o=Math.max(o,50*(1-Math.abs(d-0.03)/0.11)); }} Math.max(o,0)";

        // ---------- titulky
        var cd = [];
        for (var i = 0; i < P.caps.length; i++) { var c = P.caps[i]; cd.push("[" + c[0] + "," + c[1] + ",\"" + c[2].replace(/\\/g, "").replace(/"/g, "'") + "\"," + c[3] + "]"); }
        var capData = comp.layers.addText("x"); capData.name = "CAPDATA";
        tryit("capdata", function () { var tp = capData.property("Source Text"); var td = tp.value; td.text = "[" + cd.join(",") + "]"; tp.setValue(td); capData.enabled = false; });
        var cap = comp.layers.addText("x"); cap.name = "TITULKY";
        tryit("titulky", function () {
            var tp = cap.property("Source Text"); var td = tp.value;
            td.font = FONT; td.fontSize = 88; td.fillColor = [1, 1, 1]; td.strokeColor = [0, 0, 0]; td.strokeWidth = 14; td.applyStroke = true; td.applyFill = true; td.strokeOverFill = false;
            td.justification = ParagraphJustification.CENTER_JUSTIFY; td.text = "X"; tp.setValue(td);
            cap.transform.position.setValue([540, 1400]);
            var look = "var C=eval('('+String(thisComp.layer('CAPDATA').text.sourceText)+')'); var t=time,lo=0,hi=C.length-1,r=-1; while(lo<=hi){var m=(lo+hi)>>1; if(C[m][1]<=t)lo=m+1; else if(C[m][0]>t)hi=m-1; else {r=m;break;}} ";
            tp.expression = look + "var s=thisProperty.style; r<0 ? s.setText('') : s.setText(C[r][2]).setFillColor(C[r][3]?[1,0.82,0]:[1,1,1]);";
            cap.transform.scale.expression = look + "var p=1; if(r>=0){var d=t-C[r][0]; p = d<0.08 ? 0.8+0.35*(d/0.08) : (d<0.18 ? 1.15-0.15*((d-0.08)/0.10) : 1);} value*p;";
        });

        // ---------- jmenovky styl 2: samolepka u osoby + žlutý zvýrazňovač u textových lišt
        function makeText(txt, size, fill, t0, t1, name) {
            var T = comp.layers.addText("x"); T.name = name;
            var tp = T.property("Source Text"); var td = tp.value;
            td.font = FONT; td.fontSize = size; td.fillColor = fill; td.applyFill = true; td.applyStroke = false;
            td.justification = ParagraphJustification.LEFT_JUSTIFY; td.text = txt; tp.setValue(td);
            T.inPoint = t0; T.outPoint = t1;
            return T;
        }
        function popKeys(ctrl, t0, t1) {
            var sc = ctrl.transform.scale;
            sc.setValueAtTime(t0, [0, 0]); sc.setValueAtTime(t0 + 0.14, [118, 118]); sc.setValueAtTime(t0 + 0.28, [100, 100]);
            sc.setValueAtTime(t1 - 0.2, [100, 100]); sc.setValueAtTime(t1, [0, 0]);
            for (var k = 1; k <= 2; k++) { setEase(sc, k, 3); }
        }
        function stickerTag(tg, idx) {
            var d = tg.dur || 3.4, t0 = tg.tl0, t1 = t0 + d;
            var ctrl = comp.layers.addNull(); ctrl.name = "TAGCTRL " + tg.text; ctrl.inPoint = t0; ctrl.outPoint = t1;
            var tn = "TXT" + idx;
            var W = "var r=thisComp.layer('" + tn + "').sourceRectAtTime(time,false); var W=96+36+r.width;";
            // hlavní bílá plocha
            var R = comp.layers.addShape(); R.name = "plocha " + tg.text; R.inPoint = t0; R.outPoint = t1;
            var g = R.property("Contents").addProperty("ADBE Vector Group");
            var rc = g.property("Contents").addProperty("ADBE Vector Shape - Rect");
            rc.property("ADBE Vector Rect Size").expression = W + " [W,88]";
            rc.property("ADBE Vector Rect Roundness").setValue(18);
            var fl = g.property("Contents").addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue([1, 1, 1]);
            var sk = g.property("Contents").addProperty("ADBE Vector Graphic - Stroke"); sk.property("ADBE Vector Stroke Color").setValue([0.05, 0.05, 0.08]); sk.property("ADBE Vector Stroke Width").setValue(6);
            tryit("stin", function () { var ds = R.property("Effects").addProperty("ADBE Drop Shadow"); ds.property("ADBE Drop Shadow-0002").setValue(60); ds.property("ADBE Drop Shadow-0004").setValue(10); ds.property("ADBE Drop Shadow-0005").setValue(22); });
            // červený štítek AI
            var B = comp.layers.addShape(); B.name = "stitek " + tg.text; B.inPoint = t0; B.outPoint = t1;
            var g2 = B.property("Contents").addProperty("ADBE Vector Group");
            var rc2 = g2.property("Contents").addProperty("ADBE Vector Shape - Rect");
            rc2.property("ADBE Vector Rect Size").setValue([96, 88]); rc2.property("ADBE Vector Rect Roundness").setValue(18);
            rc2.property("ADBE Vector Rect Position").expression = W + " [-W/2+48,0]";
            var fl2 = g2.property("Contents").addProperty("ADBE Vector Graphic - Fill"); fl2.property("ADBE Vector Fill Color").setValue([0.89, 0, 0.1]);
            var sk2 = g2.property("Contents").addProperty("ADBE Vector Graphic - Stroke"); sk2.property("ADBE Vector Stroke Color").setValue([0.05, 0.05, 0.08]); sk2.property("ADBE Vector Stroke Width").setValue(6);
            // texty
            var T = makeText(tg.text, 58, [0.05, 0.05, 0.1], t0, t1, tn);
            T.transform.position.expression = W + " [-W/2+96+18-r.left, -(r.top+r.height/2)]";
            var A = makeText("AI", 50, [1, 1, 1], t0, t1, "AI" + idx);
            A.transform.position.expression = W + " var a=thisLayer.sourceRectAtTime(time,false); [-W/2+48-(a.left+a.width/2), -(a.top+a.height/2)]";
            var kids = [R, B, T, A];
            for (var q = 0; q < kids.length; q++) kids[q].parent = ctrl;
            popKeys(ctrl, t0, t1);
            ctrl.transform.position.setValue([540, 1085]);
            ctrl.transform.rotation.setValue(-3);
            ctrl.transform.rotation.expression = "var d=time-inPoint; var n=0; if(d<0.45){ n=wiggle(14,5*(1-d/0.45))-value; } value+Math.sin(d*2.2)*1.3+n;";
            ctrl.transform.position.expression = "value+[0,Math.sin((time-inPoint)*1.7)*7]";
        }
        function markerTag(tg, idx) {
            var big = tg.big, t0 = tg.tl0, t1 = t0 + (tg.dur || 3.6);
            var size = big ? 150 : 66;
            var ctrl = comp.layers.addNull(); ctrl.name = "TAGCTRL " + tg.text; ctrl.inPoint = t0; ctrl.outPoint = t1;
            var tn = "TXT" + idx;
            var FIT = "var r=thisComp.layer('" + tn + "').sourceRectAtTime(time,false); var s=Math.min(100,980/r.width*100)/100;";
            var M = comp.layers.addShape(); M.name = "zvyraznovac " + tg.text; M.inPoint = t0; M.outPoint = t1;
            var g = M.property("Contents").addProperty("ADBE Vector Group");
            var rc = g.property("Contents").addProperty("ADBE Vector Shape - Rect");
            rc.property("ADBE Vector Rect Size").expression = FIT + " var p=Math.min(Math.max((time-inPoint-0.12)/0.28,0),1); p=1-Math.pow(1-p,3); [(r.width+44)*s*p, r.height*0.44*s]";
            rc.property("ADBE Vector Rect Position").expression = FIT + " var p=Math.min(Math.max((time-inPoint-0.12)/0.28,0),1); p=1-Math.pow(1-p,3); [-(r.width+44)*s/2+(r.width+44)*s*p/2, r.height*0.2*s]";
            rc.property("ADBE Vector Rect Roundness").setValue(10);
            var fl = g.property("Contents").addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue([1, 0.82, 0]);
            var T = comp.layers.addText("x"); T.name = tn;
            var tp = T.property("Source Text"); var td = tp.value;
            td.font = FONT; td.fontSize = size; td.fillColor = [1, 1, 1]; td.strokeColor = [0, 0, 0]; td.strokeWidth = 14; td.applyStroke = true; td.applyFill = true; td.strokeOverFill = false;
            td.justification = ParagraphJustification.LEFT_JUSTIFY; td.text = tg.text; tp.setValue(td);
            T.inPoint = t0; T.outPoint = t1;
            T.transform.scale.expression = FIT + " [s*100,s*100]";
            T.transform.position.expression = FIT + " [-(r.left+r.width/2)*s, -(r.top+r.height/2)*s]";
            M.parent = ctrl; T.parent = ctrl;
            popKeys(ctrl, t0, t1);
            ctrl.transform.position.setValue([540, big ? 520 : 1210]);
            ctrl.transform.rotation.setValue(big ? -4 : -2);
            ctrl.transform.rotation.expression = "var d=time-inPoint; var n=0; if(d<0.4){ n=wiggle(13,4*(1-d/0.4))-value; } value+Math.sin(d*2)*1.0+n;";
            ctrl.transform.position.expression = "value+[0,Math.sin((time-inPoint)*1.5)*6]";
        }
        var NAVYC = [0.02, 0.02, 0.2], REDC = [0.89, 0, 0.1];
        function rectLayer(name, t0, t1, sizeExpr, posExpr, round, fill, opac, strokeW, strokeCol) {
            var R = comp.layers.addShape(); R.name = name; R.inPoint = t0; R.outPoint = t1;
            var g = R.property("Contents").addProperty("ADBE Vector Group");
            var rc = g.property("Contents").addProperty("ADBE Vector Shape - Rect");
            if (typeof sizeExpr == "string") rc.property("ADBE Vector Rect Size").expression = sizeExpr; else rc.property("ADBE Vector Rect Size").setValue(sizeExpr);
            if (posExpr) { if (typeof posExpr == "string") rc.property("ADBE Vector Rect Position").expression = posExpr; else rc.property("ADBE Vector Rect Position").setValue(posExpr); }
            rc.property("ADBE Vector Rect Roundness").setValue(round);
            var fl = g.property("Contents").addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(fill); fl.property("ADBE Vector Fill Opacity").setValue(opac || 100);
            if (strokeW) { var sk = g.property("Contents").addProperty("ADBE Vector Graphic - Stroke"); sk.property("ADBE Vector Stroke Color").setValue(strokeCol || [1, 1, 1]); sk.property("ADBE Vector Stroke Width").setValue(strokeW); }
            return R;
        }
        function pathLayer(name, t0, t1, verts, posExpr, fill) {
            var R = comp.layers.addShape(); R.name = name; R.inPoint = t0; R.outPoint = t1;
            var g = R.property("Contents").addProperty("ADBE Vector Group");
            var pth = g.property("Contents").addProperty("ADBE Vector Shape - Group");
            var sh = new Shape(); sh.vertices = verts; sh.closed = true; pth.property("ADBE Vector Shape").setValue(sh);
            g.property("Contents").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(fill);
            if (posExpr) g.property("Transform").property("Position").expression = posExpr;
            return R;
        }
        function textL(txt, size, fill, t0, t1, name, stroke) {
            var T = comp.layers.addText("x"); T.name = name;
            var tp = T.property("Source Text"); var td = tp.value;
            td.font = FONT; td.fontSize = size; td.fillColor = fill; td.applyFill = true;
            if (stroke) { td.applyStroke = true; td.strokeColor = [0, 0, 0]; td.strokeWidth = stroke; td.strokeOverFill = false; } else td.applyStroke = false;
            td.justification = ParagraphJustification.LEFT_JUSTIFY; td.text = txt; tp.setValue(td);
            T.inPoint = t0; T.outPoint = t1;
            return T;
        }
        function slideIn(ctrl, base, rot) {
            ctrl.transform.position.setValue(base);
            ctrl.transform.rotation.setValue(rot);
            ctrl.transform.position.expression = "var d=time-inPoint, o=outPoint-time; var e=Math.min(d/0.32,1); e=1-Math.pow(1-e,3); var x=(1-e)*-260; var f=Math.min(o/0.25,1); f=1-Math.pow(1-f,2); x+= (1-f)*260; value+[x, Math.sin(d*1.6)*6]";
            ctrl.transform.rotation.expression = "var d=time-inPoint; var n=0; if(d<0.45){ n=wiggle(14,4*(1-d/0.45))-value; } value+Math.sin(d*2)*0.9+n;";
            ctrl.transform.opacity.expression = "var d=time-inPoint, o=outPoint-time; 100*Math.min(1,d/0.12)*Math.min(1,o/0.18)";
        }
        // kapitola: tmavě modrý panel, červené číslo, nadpis + kicker „KAPITOLA · KDO“
        function chapterTag(tg, idx) {
            var t0 = tg.tl0, t1 = t0 + (tg.dur || 2.8);
            var ctrl = comp.layers.addNull(); ctrl.name = "KAPITOLA " + tg.num; ctrl.inPoint = t0; ctrl.outPoint = t1;
            var tn = "KTIT" + idx, kn = "KKIC" + idx;
            var W = "var r=thisComp.layer('" + tn + "').sourceRectAtTime(time,false), k=thisComp.layer('" + kn + "').sourceRectAtTime(time,false); var W=190+Math.max(r.width,k.width)+56;";
            var P1 = rectLayer("kapitola panel " + tg.num, t0, t1, W + " [W,176]", null, 26, NAVYC, 94, 5, [1, 1, 1]);
            tryit("kstin", function () { var ds = P1.property("Effects").addProperty("ADBE Drop Shadow"); ds.property("ADBE Drop Shadow-0002").setValue(70); ds.property("ADBE Drop Shadow-0004").setValue(12); ds.property("ADBE Drop Shadow-0005").setValue(28); });
            var Q = rectLayer("kapitola cislo " + tg.num, t0, t1, [136, 136], W + " [-W/2+20+68,0]", 20, REDC, 100, 0);
            var N = textL(tg.num, 78, [1, 1, 1], t0, t1, "KNUM" + idx);
            N.transform.position.expression = W + " var a=thisLayer.sourceRectAtTime(time,false); [-W/2+20+68-(a.left+a.width/2), -(a.top+a.height/2)]";
            var K = textL(("KAPITOLA · " + tg.who).toUpperCase(), 34, [1, 0.82, 0], t0, t1, kn);
            K.transform.position.expression = W + " var a=thisLayer.sourceRectAtTime(time,false); [-W/2+190-a.left, -34-(a.top+a.height/2)]";
            var T = textL(tg.text, 64, [1, 1, 1], t0, t1, tn);
            T.transform.position.expression = W + " var a=thisLayer.sourceRectAtTime(time,false); [-W/2+190-a.left, 30-(a.top+a.height/2)]";
            var kids = [P1, Q, N, K, T];
            for (var q = 0; q < kids.length; q++) kids[q].parent = ctrl;
            popKeys(ctrl, t0, t1);
            slideIn(ctrl, [540, 1175], -2);
        }
        // výzva: bílá bublina, červené kolečko s ikonou (bublina komentáře / šipka dolů), případně velké slovo s psacím efektem
        function ctaTag(tg, idx) {
            var t0 = tg.tl0, t1 = t0 + (tg.dur || 3.4);
            var big = tg.big2 || "";
            var H = big ? 210 : 116;
            var ctrl = comp.layers.addNull(); ctrl.name = "CTA " + tg.text; ctrl.inPoint = t0; ctrl.outPoint = t1;
            var tn = "CTXT" + idx, bn = "CBIG" + idx;
            var W = "var r=thisComp.layer('" + tn + "').sourceRectAtTime(time,false); var bw=" + (big ? "thisComp.layer('" + bn + "').sourceRectAtTime(outPoint-0.3,false).width" : "0") + "; var W=150+Math.max(r.width,bw)+50;";
            var P1 = rectLayer("cta plocha", t0, t1, W + " [W," + H + "]", null, 30, [1, 1, 1], 100, 6, [0.05, 0.05, 0.08]);
            tryit("cstin", function () { var ds = P1.property("Effects").addProperty("ADBE Drop Shadow"); ds.property("ADBE Drop Shadow-0002").setValue(60); ds.property("ADBE Drop Shadow-0004").setValue(10); ds.property("ADBE Drop Shadow-0005").setValue(24); });
            var C = comp.layers.addShape(); C.name = "cta kolecko"; C.inPoint = t0; C.outPoint = t1;
            var g = C.property("Contents").addProperty("ADBE Vector Group");
            var el = g.property("Contents").addProperty("ADBE Vector Shape - Ellipse"); el.property("ADBE Vector Ellipse Size").setValue([92, 92]);
            el.property("ADBE Vector Ellipse Position").expression = W + " [-W/2+24+46,0]";
            g.property("Contents").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(REDC);
            var icons = [];
            if (big) {
                icons.push(rectLayer("ikona bublina", t0, t1, [50, 36], W + " [-W/2+24+46,-4]", 9, [1, 1, 1], 100, 0));
                icons.push(pathLayer("ikona ocasek", t0, t1, [[-12, 10], [2, 10], [-14, 24]], W + " [-W/2+24+46,0]", [1, 1, 1]));
            } else {
                icons.push(rectLayer("ikona sipka telo", t0, t1, [14, 30], W + " [-W/2+24+46,-12]", 3, [1, 1, 1], 100, 0));
                icons.push(pathLayer("ikona sipka hrot", t0, t1, [[-20, 0], [20, 0], [0, 22]], W + " [-W/2+24+46,2]", [1, 1, 1]));
            }
            var T = textL(tg.text, big ? 46 : 52, [0.05, 0.05, 0.1], t0, t1, tn);
            T.transform.position.expression = W + " var a=thisLayer.sourceRectAtTime(time,false); [-W/2+150-a.left, " + (big ? "-44" : "0") + "-(a.top+a.height/2)]";
            var kids = [P1, C, T].concat(icons);
            if (big) {
                var B = textL(big, 96, REDC, t0, t1, bn);
                B.property("Source Text").expression = "var s='" + big + "'; var d=time-inPoint-0.35; s.substr(0, Math.max(0, Math.min(s.length, Math.floor(d/0.09)+1)))";
                B.transform.position.expression = W + " var a=thisLayer.sourceRectAtTime(outPoint-0.3,false); [-W/2+150-a.left, 40-(a.top+a.height/2)]";
                kids.push(B);
            }
            for (var q = 0; q < kids.length; q++) kids[q].parent = ctrl;
            popKeys(ctrl, t0, t1);
            slideIn(ctrl, [540, 1185], -2.5);
        }
        for (var i = P.tags.length - 1; i >= 0; i--) {
            (function (tg, idx) {
                tryit("tag3 " + tg.text, function () {
                    var k = tg.kind || (tg.person ? "person" : "marker");
                    if (k == "person") stickerTag(tg, idx);
                    else if (k == "chapter") chapterTag(tg, idx);
                    else if (k == "cta") ctaTag(tg, idx);
                    else markerTag(tg, idx);
                });
            })(P.tags[i], i);
        }

        // ---------- ukazatel průběhu
        var pb = comp.layers.addSolid([0.89, 0, 0.1], "PROGRESS", 1080, 10, 1);
        pb.transform.anchorPoint.setValue([0, 5]); pb.transform.position.setValue([0, 6]);
        pb.transform.scale.expression = "[100*time/thisComp.duration,100]";

        // ---------- vodoznak: znak DetAI v levém horním rohu po celou dobu
        tryit("vodoznak", function () {
            var wm = comp.layers.add(imp(J.watermark));
            wm.name = "VODOZNAK DetAI";
            wm.startTime = 0; wm.inPoint = 0; wm.outPoint = P.dur;
            wm.transform.anchorPoint.setValue([540, 540]);
            wm.transform.scale.setValue([11, 11]);
            wm.transform.position.setValue([78, 140]);
            wm.transform.opacity.setValue(88);
            wm.moveToBeginning();
            try { var ds = wm.property("Effects").addProperty("ADBE Drop Shadow"); ds.property("ADBE Drop Shadow-0002").setValue(55); ds.property("ADBE Drop Shadow-0004").setValue(4); ds.property("ADBE Drop Shadow-0005").setValue(10); } catch (e) {}
        });

        comp.openInViewer();
        proj.save(new File(J.outAep));
        log("HOTOVO vrstev " + comp.numLayers + " chyb " + errCount);
        done("HOTOVO");
    } catch (err) {
        log("FATAL " + err + " řádek " + err.line);
        done("FATAL " + err);
    }
})();
