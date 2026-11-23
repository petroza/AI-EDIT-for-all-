// node ev.js soubor.js [port] – vyhodnotí obsah souboru (výraz) v okně aplikace přes CDP
const http=require('http'),fs=require('fs');
const code=fs.readFileSync(process.argv[2],'utf8'); const PORT=Number(process.argv[3]||process.env.CDP_PORT||9377);
const getJson=(p)=>new Promise((res,rej)=>http.get({host:'127.0.0.1',port:PORT,path:p},(r)=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res(JSON.parse(b)))}).on('error',rej));
(async()=>{const list=await getJson('/json');const page=list.find(t=>t.type==='page'&&/index\.html/.test(t.url)&&!/\/ai\//.test(t.url));
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
ws.onmessage=(ev)=>{const m=JSON.parse(ev.data);if(m.id===1){const r=m.result;if(r.exceptionDetails)console.log('CHYBA:',(r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||JSON.stringify(r.exceptionDetails));else{const v=r.result.value;console.log(typeof v==='string'?v:JSON.stringify(v,null,1));}ws.close();process.exit(0);}};
ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:code,awaitPromise:true,returnByValue:true}}));})().catch(e=>{console.error('CDP:',e.message);process.exit(1)});
