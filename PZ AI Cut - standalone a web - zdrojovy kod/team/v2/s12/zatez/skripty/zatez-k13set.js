(()=>{
window.__KSEQ='Z300'; window.__KNAME='k13-prvni-'+Date.now();
window.__KFN=()=>{
  require('electron').ipcRenderer.emit('cmd', {}, 'export'); // jako Soubor → Exportovat (Ctrl+M) z nativní nabídky
  setTimeout(()=>{ const b=document.getElementById('modalBox'); b.querySelector('#exOut').value=process.cwd().replace(/\\/g,'/')+'/web/test-out/zatez-s12-k13-druhy-'+Date.now()+'.mp4'; b.querySelector('#exLoud').value='off'; b.querySelector('#exGo').click(); window.__K13b=b.querySelector('#exOut').value; }, 700);
  return 'Ctrl+M '+new Date().toTimeString().slice(0,8);
};
return 1;
})()
