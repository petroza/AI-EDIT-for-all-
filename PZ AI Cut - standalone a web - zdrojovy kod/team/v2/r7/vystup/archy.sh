#!/bin/bash
# Kontaktni archy (bez popisku): <prefix>-arch-<t>.png = kazdych 0,2 s od t-2 do t+2 (7x3, po radcich zleva),
# <prefix>-snimky-<t>.png = snimky n-3 .. n+3 kolem t (n = t*25), 7x1.
# Pouziti: bash archy.sh <export.mp4> <prefix> <casy strihu...>
EXP=$1; P=$2; shift 2
for t in "$@"; do
  s=$(awk "BEGIN{print ($t-2<0)?0:$t-2}")
  ffmpeg -v error -y -ss $s -i "$EXP" -t 4.2 -vf "fps=5,scale=180:-2,tile=7x3:padding=4:color=red" -frames:v 1 "$P-arch-$t.png"
  f0=$(awk "BEGIN{printf \"%d\", $t*25-3}"); [ $f0 -lt 0 ] && f0=0
  ffmpeg -v error -y -i "$EXP" -vf "select='between(n\,$f0\,$((f0+6)))',scale=200:-2,tile=7x1:padding=4:color=red" -fps_mode passthrough -frames:v 1 "$P-snimky-$t.png"
done
