const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const r = {};
const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); r.csp = meta ? meta.content.slice(0, 200) : null;
r.open = String(window.open('https://example.com/'));
const before = location.href; location.href = 'https://example.com/'; await sleep(1500); r.navBlocked = location.href === before;
// vlozeny skript (CSP bez inline)
window.__s14x = 0; const sc = document.createElement('script'); sc.textContent = 'window.__s14x = 1'; document.body.appendChild(sc); await sleep(200); r.inlineScriptRan = window.__s14x === 1; sc.remove();
const im = document.createElement('img'); im.setAttribute('onerror', 'window.__s14x = 2'); im.src = 'x:y'; document.body.appendChild(im); await sleep(300); r.inlineHandlerRan = window.__s14x === 2; im.remove();
try { r.bridgeCtor = await TN.evalScript('PMCP.call("constructor", "{}")'); } catch (e) { r.bridgeCtor = 'ERR ' + e.message; }
return r;
