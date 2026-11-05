#!/usr/bin/env bash
# Runs a command in one of three render slots shared by every agent of this session (a check or a render opens
# Chrome: more than three at once on this 4-core machine starves them all). Waits for a free slot, then runs.
# Usage: scripts/models/render-slot.sh node scripts/skill-render.mts --piece …
dir="${TMPDIR:-/tmp}/render-slots"; mkdir -p "$dir"
while true; do
  for k in 1 2 3; do
    exec 9>"$dir/slot-$k.lock"
    if flock -n 9; then
      CONCURRENCY="${CONCURRENCY:-2}" "$@"
      status=$?
      flock -u 9
      exit $status
    fi
  done
  sleep 4
done
