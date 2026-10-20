#!/usr/bin/env bash
# Taiz Now — snapshot capture.
#
# CHANGE LOG
#   2026-10-12  Created. Takes a point-in-time backup of the whole project so we
#               can always roll back after an unwanted change. Each snapshot is a
#               compressed archive of the source tree plus a manifest recording
#               the git branch/commit, the changed files, and a checksum. A
#               database dump is included when PostgreSQL is reachable.
#
# Usage:
#   scripts/snapshot.sh [label]      # take a snapshot now
#   scripts/snapshot.sh --list       # list existing snapshots
#   scripts/snapshot.sh --restore <id>   # restore the source tree from a snapshot
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SNAP_DIR="${SNAP_DIR:-$ROOT/.snapshots}"
KEEP="${SNAP_KEEP:-60}"
PGURL="${DATABASE_URL:-postgresql://taiznow:taiznow_secret@127.0.0.1:5432/taiznow}"

# Paths excluded from every snapshot (regeneratable or machine-specific).
EXCLUDES=(
  --exclude=./node_modules
  --exclude=./.next
  --exclude=./.git
  --exclude=./.snapshots
  --exclude=./.run
  --exclude=./.openhands
  --exclude=./coverage
  --exclude=./.vercel
)

log() { echo "[snapshot] $*"; }

list_snapshots() {
  if [ ! -d "$SNAP_DIR" ]; then echo "لا توجد نسخ بعد."; return 0; fi
  for d in "$SNAP_DIR"/*/; do
    [ -d "$d" ] || continue
    local name; name="$(basename "$d")"
    [ "$name" = "latest" ] && continue
    printf '%s\t%s\n' "$name" "$(du -sh "$d" 2>/dev/null | cut -f1)"
  done | sort
}

restore_snapshot() {
  local id="$1"
  local dir="$SNAP_DIR/$id"
  local archive="$dir/source.tar.gz"
  if [ ! -f "$archive" ]; then log "النسخة غير موجودة: $id"; exit 1; fi
  log "استعادة النسخة $id ..."
  # Keep a safety snapshot of the current state before overwriting it.
  bash "$ROOT/scripts/snapshot.sh" "pre-restore" >/dev/null 2>&1 || true
  tar -xzf "$archive" -C "$ROOT"
  log "تمت الاستعادة. أعد تشغيل السيرفر: bash scripts/start.sh"
}

case "${1:-}" in
  --list) list_snapshots; exit 0 ;;
  --restore) restore_snapshot "${2:?رقم النسخة مطلوب}"; exit 0 ;;
esac

LABEL="${1:-auto}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo nogit)"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9_-' '-')"
ID="${STAMP}-${SHA}-${SAFE_LABEL}"

DEST="$SNAP_DIR/$ID"
mkdir -p "$DEST"

# 1. Source archive ------------------------------------------------------------
tar -czf "$DEST/source.tar.gz" "${EXCLUDES[@]}" -C "$ROOT" . 2>/dev/null

# 2. Manifest ------------------------------------------------------------------
{
  echo "id:        $ID"
  echo "date_utc:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "label:     $LABEL"
  echo "branch:    $BRANCH"
  echo "commit:    $(git rev-parse HEAD 2>/dev/null || echo none)"
  echo "commit_msg:$(git log -1 --pretty=%s 2>/dev/null || echo none)"
  echo "archive_sha256: $(sha256sum "$DEST/source.tar.gz" | cut -d' ' -f1)"
  echo "archive_bytes:  $(stat -c%s "$DEST/source.tar.gz" 2>/dev/null || echo '?')"
  echo ""
  echo "--- changed files (git status --porcelain) ---"
  git status --porcelain 2>/dev/null || echo "(git unavailable)"
  echo ""
  echo "--- untracked file list ---"
  git ls-files --others --exclude-standard 2>/dev/null | head -200
} > "$DEST/manifest.txt"

# 3. Database dump (best effort) ----------------------------------------------
if command -v pg_dump >/dev/null 2>&1 && pg_isready -q -h 127.0.0.1 -p 5432 2>/dev/null; then
  if pg_dump "$PGURL" --no-owner --no-privileges -f "$DEST/db.sql" 2>/dev/null; then
    gzip -f "$DEST/db.sql" 2>/dev/null || true
    echo "db_dump: db.sql.gz ($(stat -c%s "$DEST/db.sql.gz" 2>/dev/null || echo '?') bytes)" >> "$DEST/manifest.txt"
  else
    echo "db_dump: failed" >> "$DEST/manifest.txt"
  fi
else
  echo "db_dump: skipped (postgres unavailable)" >> "$DEST/manifest.txt"
fi

# 4. Point "latest" at this snapshot ------------------------------------------
ln -sfn "$ID" "$SNAP_DIR/latest"

# 5. Append to the human-readable log -----------------------------------------
printf '%s  %s  [%s]  %s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ID" "$BRANCH" \
  "$(git log -1 --pretty=%s 2>/dev/null || echo '')" >> "$SNAP_DIR/LOG.txt"

# 6. Retention ----------------------------------------------------------------
COUNT="$(find "$SNAP_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l)"
if [ "$COUNT" -gt "$KEEP" ]; then
  # Remove oldest snapshots beyond the retention limit.
  find "$SNAP_DIR" -maxdepth 1 -mindepth 1 -type d -printf '%T@ %p\n' \
    | sort -n | head -n "$((COUNT - KEEP))" | cut -d' ' -f2- \
    | while read -r old; do rm -rf "$old"; done
fi

log "أُنشئت النسخة: $ID  ($(du -sh "$DEST" 2>/dev/null | cut -f1))"
