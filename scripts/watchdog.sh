#!/usr/bin/env bash
# Taiz Now — self-healing watchdog.
# Periodically verifies PostgreSQL and the Next.js server are healthy and
# restarts whatever is missing. Survives sandbox resets: if core system
# dependencies are gone it re-runs the full bootstrap.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-12000}"
LOG_DIR="$ROOT/.run"
mkdir -p "$LOG_DIR"
INTERVAL="${WATCHDOG_INTERVAL:-20}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

healthy_http() {
  curl -fsS -m 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1
}

ensure_postgres() {
  if pg_isready -q -h 127.0.0.1 -p 5432 2>/dev/null; then return 0; fi
  log "PostgreSQL down — restarting"
  sudo pg_ctlcluster 17 main start 2>/dev/null || sudo service postgresql start 2>/dev/null || true
  for _ in $(seq 1 20); do pg_isready -q -h 127.0.0.1 -p 5432 && return 0; sleep 1; done
  log "PostgreSQL still down"
  return 1
}

ensure_app() {
  if healthy_http; then return 0; fi
  # Give an in-flight server time to finish booting before we intervene.
  for _ in $(seq 1 8); do
    sleep 1
    healthy_http && return 0
  done
  # If the port is listening but unhealthy, kill the stale process first.
  if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
    log "Port ${PORT} bound but unhealthy — recycling"
    local pids
    pids="$(ss -ltnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' | sort -u)"
    for p in $pids; do kill "$p" 2>/dev/null || true; done
    sleep 2
  fi
  log "Starting Next.js on port ${PORT}"
  PORT="$PORT" nohup env -u NEXTAUTH_URL -u NEXTAUTH_URL_INTERNAL -u PLATFORM_URL -u OPENAI_API_KEY npx next start -p "$PORT" > "$LOG_DIR/app.log" 2>&1 &
  echo $! > "$LOG_DIR/app.pid"
}

# If apt/dpkg holds the lock, wait so we never fight an in-progress install.
apt_busy() { fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; }

while true; do
  if ! command -v psql >/dev/null 2>&1 || ! ls /usr/lib/postgresql >/dev/null 2>&1; then
    if ! apt_busy; then
      log "Core system deps missing — running full bootstrap"
      bash "$ROOT/scripts/bootstrap_env.sh" >> "$LOG_DIR/bootstrap-watchdog.log" 2>&1
    fi
  else
    ensure_postgres || true
    ensure_app || true
  fi
  sleep "$INTERVAL"
done
