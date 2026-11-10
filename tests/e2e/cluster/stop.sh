#!/usr/bin/env bash
# Stops the host processes started by start.sh (found by their listening ports). The
# postgres/kafka containers and all data are kept. Never deletes data.
set -uo pipefail
STATE="${E2E_STATE_DIR:-/tmp/learnup-e2e}"
for f in "$STATE"/pids/*.port; do
  [[ -f "$f" ]] || continue
  port="$(cat "$f")"
  pids="$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill $pids && echo "stopped $(basename "$f" .port) (port $port)"
  rm -f "$f"
done
