// Struktura obsahového střihu pro YouTuber verzi (yt_export_structure). Jen čte, nic nemění.
// Server před kód vloží: var YT_ARGS = {sequence, video, music, tags} (čísla stop od 1 = V1/A1).
// Výsledek (poslední výraz) = JSON: {seq, id, fps, end, v1:[{s,e,i,o,n,p}], a2:[{s,e,i,n,p,k:[[t,dB]]}], v2:[{s,e,t,h,l}]}
(function () {
  var A = (typeof YT_ARGS != 'undefined') ? YT_ARGS : {};
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\t]/g, ' '); }
  function J(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v == 'number') return isFinite(v) ? String(v) : 'null';
    if (typeof v == 'boolean') return v ? 'true' : 'false';
    if (typeof v == 'string') return '"' + esc(v) + '"';
    if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(J(v[i])); return '[' + a.join(',') + ']'; }
    var o = []; for (var k in v) if (v.hasOwnProperty(k)) o.push('"' + k + '":' + J(v[k])); return '{' + o.join(',') + '}';
  }
  var seq = null, p = app.project;
  if (A.sequence) {
    for (var i = 0; i < p.sequences.numSequences; i++) {
      var s = p.sequences[i];
      if (s.name == A.sequence || s.sequenceID == A.sequence) { seq = s; break; }
    }
    if (!seq) return J({ error: 'Sekvence nenalezena: ' + A.sequence });
  } else seq = p.activeSequence;
  if (!seq) return J({ error: 'Žádná aktivní sekvence' });
  var TICKS = 254016000000;
  var st = seq.getSettings();
  var out = { seq: seq.name, id: seq.sequenceID, fps: r3(1 / st.videoFrameRate.seconds), end: r3(Number(seq.end) / TICKS), v1: [], a2: [], v2: [] };
  function mp(c) { try { return c.projectItem ? (c.projectItem.getMediaPath() || '') : ''; } catch (e) { return ''; } }
  function base(c) { return { s: r3(c.start.seconds), e: r3(c.end.seconds), i: r3(c.inPoint.seconds), o: r3(c.outPoint.seconds), n: c.name, p: mp(c) }; }

  var vt = seq.videoTracks[(A.video || 1) - 1];
  if (vt) for (var j = 0; j < vt.clips.numItems; j++) out.v1.push(base(vt.clips[j]));

  // hudba: klíče hlasitosti (Volume > Level) převedené na dB; hodnota Premiere = 10^((dB-15)/20)
  var at = seq.audioTracks[(A.music || 2) - 1];
  if (at) for (var j = 0; j < at.clips.numItems; j++) {
    var c = at.clips[j], b = base(c); b.k = [];
    try {
      for (var k = 0; k < c.components.numItems; k++) {
        var co = c.components[k];
        if (co.matchName != 'Audio Levels' && co.displayName != 'Volume' && co.displayName != 'Hlasitost') continue;
        var lv = null;
        for (var q = 0; q < co.properties.numItems; q++) { var pr = co.properties[q]; if (pr.displayName == 'Level' || pr.displayName == 'Úroveň') lv = pr; }
        if (!lv) lv = co.properties[1];
        function db(v) { return v > 0 ? r3(20 * Math.log(v) / Math.LN10 + 15) : -96; }
        if (lv.isTimeVarying()) {
          var keys = lv.getKeys();
          // časy klíčů jsou relativní k začátku zdroje klipu → převod na timeline
          for (var q = 0; q < keys.length; q++) b.k.push([r3(b.s + keys[q].seconds - b.i), db(lv.getValueAtKey(keys[q]))]);
        } else b.k.push([b.s, db(lv.getValue())]);
        break;
      }
    } catch (e) { b.kerr = String(e); }
    out.a2.push(b);
  }

  // lišty (MOGRT): text z Graphic Parameters (JSON s textEditValue)
  var gt = seq.videoTracks[(A.tags || 2) - 1];
  if (gt) for (var j = 0; j < gt.clips.numItems; j++) {
    var c = gt.clips[j], txt = '';
    try {
      for (var k = 0; k < c.components.numItems && !txt; k++) {
        var co = c.components[k];
        for (var q = 0; q < co.properties.numItems; q++) {
          var v = ''; try { v = String(co.properties[q].getValue()); } catch (e) {}
          var m = v.match(/"textEditValue"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (m) { txt = m[1].replace(/\\r|\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); break; }
        }
      }
    } catch (e) {}
    out.v2.push({ s: r3(c.start.seconds), e: r3(c.end.seconds), t: txt, n: c.name, h: c.name.indexOf('HEADLINE') >= 0, l: c.name.indexOf('VLEVO') >= 0 });
  }
  return J(out);
})();
