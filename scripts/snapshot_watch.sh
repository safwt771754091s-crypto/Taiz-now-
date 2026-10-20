#!/usr/bin/env bash
# Taiz Now — automatic snapshot watcher.
#
# CHANGE LOG
#   2026-10-12  Created. Polls the project every SNAP_INTERVAL seconds; whenever
#               the source tree changes it takes a snapshot via snapshot.sh, so a
#               recent restore point always exists. Change detection hashes the
#               tracked file list + working-tree diff + untracked files, which is
#               stable regardless of mtimes.
#
# Usage: scripts/snapshot_watch.sh   (runs in the foreground; start it detached)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/.run"
mkdir -p "$LOG_DIR"
INTERVAL="${SNAP_INTERVAL:-30}"
LOG="$LOG_DIR/snapshot_watch.log"

log() { echo "[$(date -u +%H:%M:%S)] $*" >> "$LOG"; }

# A cheap fingerprint of the whole working tree (content-based, not mtime-based).
fingerprint() {
  {
    git status --porcelain 2>/dev/null
    git diff HEAD 2>/dev/null | sha256sum
    git ls-files --others --exclude-standard 2>/dev/null | sort | sha256sum
  } | sha256sum | cut -d' ' -f1
}

log "بدء مراقبة التغييرات (كل ${INTERVAL}s)"
PREV="$(fingerprint)"

# Take an initial snapshot on startup so there is always a baseline.
bash "$ROOT/scripts/snapshot.sh" "startup" >> "$LOG" 2>&1
PREV="$(fingerprint)"

while true; do
  sleep "$INTERVAL"
  CUR="$(fingerprint)"
  if [ "$CUR" != "$PREV" ]; then
    log "تغيّر مكتشف ($PREV -> $CUR) — أخذ نسخة"
    bash "$ROOT/scripts/snapshot.sh" "auto" >> "$LOG" 2>&1
    PREV="$(fingerprint)"
  fi
done
