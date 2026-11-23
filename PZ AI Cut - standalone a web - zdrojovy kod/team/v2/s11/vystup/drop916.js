// S9 NOVE (a): siroky zaber vlozeny pres TN.app.dropMedia do sekvence 1080x1920 (dialog Nova sekvence) -> vyrez podle obliceje
// (oprava testu: sekvence se po Zpet/Znovu nahrazuje novym objektem -> vzdy hledat podle id)
// a jedno TN.app.cmd('undo') vrati vlozeni i vyrez. Kroky: 1) prvni vlozeni do prazdne (celek 1596,00-1599,76), Zpet, Znovu;
// 2) vlozeni na konec za detail (V1, overwrite), Zpet; 3) vlozeni celku na V2 nad detail, Zpet.
const app = TN.app, P = app.project;
const L = P.media.find((m) => m.name.startsWith('tncz'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.cmd('newSequence'); await wait(500);
const sel = document.querySelector('#sqPreset'); const o = [...sel.options].find((x) => /1080\s*[×x]\s*1920/.test(x.textContent));
sel.value = o.value; sel.dispatchEvent(new Event('change')); document.querySelector('#sqName').value = 's11-drop916b';
document.querySelector('#sqOk').click(); await wait(800);
const sid = app.seq().id; const S = () => P.sequences.find((x) => x.id === sid);
const key = () => JSON.stringify({ tracks: S().tracks, captions: S().captions, markers: S().markers });
const stat = () => ((document.querySelector('.statusbar,#status') || {}).innerText || '').trim();
const toast = () => { const t = document.getElementById('toast'); return t && /show/.test(t.className) ? t.textContent : ''; };
const settle = async () => { const seen = []; let q = null; const t0 = Date.now(); while (Date.now() - t0 < 30000) { await wait(250); const st = stat(), tt = toast(); if (st && !seen.includes(st)) seen.push(st); if (tt && !seen.includes('TOAST: ' + tt)) seen.push('TOAST: ' + tt); if (!/obli[cč]ej|face|hled|Výřez/i.test(st)) { q = q || Date.now(); if (Date.now() - q > 2500) break; } else q = null; } return { seen, ms: Date.now() - t0 }; };
const clips = () => ({ V: S().tracks.video.map((t) => t.clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), c.fit, +(c.posX || 0).toFixed(3), c.linkId ? 'L' : '-'])), A: S().tracks.audio.map((t) => t.clips.map((c) => [+c.start.toFixed(2), +(c.start + c.out - c.in).toFixed(2), +c.in.toFixed(2), c.linkId ? 'L' : '-'])) });
const step = async (label, fn) => {
  const k0 = key(), h0 = P.history.length; app.sel = new Set(); fn(); const imm = clips(); const st = await settle(); const after = clips(), k1 = key(), h1 = P.history.length, labs = P.history.slice(h0).map((h) => h.label);
  app.cmd('undo'); await wait(300); const undoOk = key() === k0, hU = P.history.length;
  app.cmd('redo'); await wait(300); const redoOk = key() === k1;
  return { label, hned: imm, po: after, stav: st, historie: labs, zpet1x_vrati_puvodni: undoOk, hist_po_zpet: [h0, hU], znovu_vrati_po: redoOk };
};
const out = [];
out.push(await step('1 prvni vlozeni do prazdne 9:16: celek 1596,00-1599,76 na 0', () => app.dropMedia(L, 1596.0, 1599.76, 0, false, {})));
out.push(await step('2 overwrite na konec V1: detail 1599,76-1605', () => app.dropMedia(L, 1599.76, 1605.0, 3.76, false, {})));
out.push(await step('3 overwrite na konec V1: celek 1596,00-1599,76 za detail', () => app.dropMedia(L, 1596.0, 1599.76, 9.0, false, {})));
out.push(await step('4 celek na V2/A2 nad detail (b-roll prestazenim)', () => app.dropMedia(L, 1596.0, 1599.76, 4.0, false, { video: 1, audio: 1 })));
return JSON.stringify(out, null, 1);
