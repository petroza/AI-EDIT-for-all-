const b = document.querySelector('#modalBox'), f = b.querySelector('#exFmt');
const st = (k) => ({ k, fmt: f.value, burn: b.querySelector('#exBurn').checked, srt: b.querySelector('#exSrt').checked, loud: b.querySelector('#exLoud').value });
const o = [st('pred')];
f.value = 'h264'; f.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 300));
o.push(st('zpet h264'));
o.push([...b.querySelectorAll('button')].map((x) => x.innerText));
return JSON.stringify(o);
