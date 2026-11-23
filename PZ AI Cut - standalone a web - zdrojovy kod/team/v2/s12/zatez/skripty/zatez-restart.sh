#!/bin/bash
# restart instance 9377 a načtení projektu ze zálohy
A="/o/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod"; cd "$A"
node test/standalone.js stop 9377 >/dev/null; sleep 2
node test/standalone.js start 9377 "$TEMP/pz-s12-zatez" --size 1366x768 --lang cs --ai
CDP_PORT=9377 node test/cdp.js eval "(TN.app.project.load(JSON.parse(require('fs').readFileSync(process.env.TEMP+'/pz-s12-zatez/zatez-projekt.json','utf8'))), TN.app.project.sequences.length + ' ' + TN.lang)"
