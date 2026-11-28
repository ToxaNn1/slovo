#!/bin/bash
cd /home/user/slovo
for k in ${CHUNKS:-0 1 2 3 4 5}; do
  python3 .short-1128/run.py $((k*500)) 500 $k; rc=$?
  git add .short-1128/log-$k.txt && git commit -q -m "chore: Short Definitions log $k for #2147"
  [ $rc -ne 0 ] && { echo "DRIVE STOP rc=$rc chunk $k"; exit $rc; }
done
echo DRIVE OK
