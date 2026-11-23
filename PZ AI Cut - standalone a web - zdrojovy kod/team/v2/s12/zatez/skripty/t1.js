(async()=>{
const M = process.env.TEMP.replace(/\\/g,'/') + '/pz-s12-media/';
const fs=require('fs');
const long = fs.readdirSync(M).find(n=>n.startsWith('dlouha_cesta_'));
const lp = M+long+'/'+'b'.repeat(60)+'/'+'c'.repeat(50)+'/soubor s dlouhou cestou ěš.mp4';
const paths = ['sync60.mp4','diakritika ěščřžýáíéůúň ĚŠČŘ.mp4','mezery   a emoji 🎬😀.mp4',"hash#procento%20amp&apo's.mp4",'zavorky [x] (y) {z} ;,=+!.mp4','tone30.wav','bezzvuku20.mp4','jedensnimek.mp4','hodina.mp4','smazat.mp4','prejmenovat.mp4','zamceny.mp4'].map(n=>M+n);
paths.push(lp, '//neexistujici-server-pz/sdileni/video.mp4', M+'neexistuje.mp4');
const toasts=[]; const ot=TN.app.toast; TN.app.toast=(m,e)=>{toasts.push(m); return ot.call(TN.app,m,e)};
const t0=performance.now();
const r = await TN.app.importPaths(paths);
TN.app.toast=ot;
return {ms:Math.round(performance.now()-t0), lpLen: lp.length, res: r.map(x=>x.error? {err:x.error.slice(0,160)} : {name:x.name, d:x.duration, v:x.hasVideo, a:x.hasAudio, playable:x.playable}), toasts};
})()
