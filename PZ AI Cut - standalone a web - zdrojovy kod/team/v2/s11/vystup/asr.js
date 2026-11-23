const P = TN.app.project; const t0 = Date.now();
while (Date.now() - t0 < 300000) { const st = P.media.filter((m) => m.width).map((m) => { const t = window.__pzASR.get(m); return t && t.words && t.words.length ? 1 : 0; }); if (st.every(Boolean)) break; await new Promise((r) => setTimeout(r, 2000)); }
return JSON.stringify(P.media.map((m) => [m.name.slice(0, 12), JSON.stringify(window.__pzASR.status(m)).slice(0, 100), ((window.__pzASR.get(m) || {}).words || []).length, ((Date.now() - t0) / 1000).toFixed(0)]));
