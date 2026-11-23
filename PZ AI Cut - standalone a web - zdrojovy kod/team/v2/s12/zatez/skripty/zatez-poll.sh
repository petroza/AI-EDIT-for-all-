#!/bin/bash
# zatez-poll.sh <počet> <interval s> – průběh exportu v dialogu
A="/o/AI STRIH ALL app/PZ AI Cut - standalone a web - zdrojovy kod"
for i in $(seq 1 $1); do sleep $2; CDP_PORT=9377 node "$A/test/cdp.js" eval "new Date().toTimeString().slice(0,8) + ' ' + (document.getElementById('exMsg')||{}).textContent + ' | ' + TN.lang + ' | ' + (window.__KRES||'')"; done
