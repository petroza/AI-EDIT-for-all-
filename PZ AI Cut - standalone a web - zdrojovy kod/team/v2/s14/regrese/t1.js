const M = 'C:/Users/Petr/AppData/Local/Temp/claude/e8748af4ca7f4462/9b93f9a2-8c9d-4cd4-96a5-b0bc52e46c70/scratchpad/s14/media/';
await TN.app.importPaths(['O:/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod/test/media/vyrez-5min.mp4', M+'anam.mp4', M+'a_2mono.mp4', M+'img.png', M+'au.mp3', M+'v2997.mp4', M+'i25.mp4', M+'bezzvuku.mp4']);
await new Promise(r=>setTimeout(r,3000));
return TN.app.project.media.map(m=>({id:m.id,name:m.name,w:m.width,h:m.height,fps:m.fps,dur:m.duration,hasV:m.hasVideo,hasA:m.hasAudio,keys:Object.keys(m).join(',')}));
