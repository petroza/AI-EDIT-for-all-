// S6: dialog Export (Soubor > Exportovat = TN.app.cmd('export')) na s6-multi1080: MP4 -> MXF XDCAM -> zpet MP4, stav zaskrtavatek titulku a hlasitosti
const P = TN.app.project, s = P.sequences.find((x) => x.name === 's6-multi1080');
TN.app.openSequence(s.id); await new Promise((r) => setTimeout(r, 500));
TN.app.cmd('export'); await new Promise((r) => setTimeout(r, 600));
const b = document.querySelector('#modalBox'), f = b.querySelector('#exFmt');
const st = (k) => ({ k, fmt: f.value, burn: b.querySelector('#exBurn').checked, srt: b.querySelector('#exSrt').checked, loud: b.querySelector('#exLoud').value, out: b.querySelector('#exOut').value.split(/[\/]/).pop() });
const o = [st('otevreno')];
f.value = 'xdcam'; f.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 300)); o.push(st('xdcam'));
return JSON.stringify(o);
