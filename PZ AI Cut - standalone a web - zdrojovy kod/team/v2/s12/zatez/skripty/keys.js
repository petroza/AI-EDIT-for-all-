// node keys.js <code> <mods Ctrl|Ctrl+Shift> <count> [port] – opakovaný stisk klávesy přes CDP, měří čas
const http=require('http');
const [code, mods, countS, portS]=process.argv.slice(2); const PORT=Number(portS||9377), count=Number(countS);
const getJson=(p)=>new Promise((res,rej)=>http.get({host:'127.0.0.1',port:PORT,path:p},(r)=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res(JSON.parse(b)))}).on('error',rej));
(async()=>{const list=await getJson('/json');const page=list.find(t=>t.type==='page'&&/index\.html/.test(t.url)&&!/\/ai\//.test(t.url));
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let id=0;const pend=new Map();ws.onmessage=(ev)=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
await send('Runtime.evaluate',{expression:'document.activeElement && document.activeElement.blur && document.activeElement.blur(), TN.app.focusPanel("timeline")'});
const ms=(mods||'').split('+'); const m=(ms.includes('Ctrl')?2:0)|(ms.includes('Shift')?8:0)|(ms.includes('Alt')?1:0);
const key=code.replace(/^Key/,'').toLowerCase(); const vk=key.toUpperCase().charCodeAt(0);
const t0=Date.now();
for(let i=0;i<count;i++){ for(const type of ['rawKeyDown','keyUp']) await send('Input.dispatchKeyEvent',{type,code,key:ms.includes('Shift')?key.toUpperCase():key,windowsVirtualKeyCode:vk,modifiers:m}); }
// počkat, až okno dožene frontu
await send('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});
console.log(JSON.stringify({count, ms:Date.now()-t0}));ws.close();process.exit(0);})().catch(e=>{console.error(e);process.exit(1)});
