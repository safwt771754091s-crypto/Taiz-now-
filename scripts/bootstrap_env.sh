#!/usr/bin/env bash
# Taiz Now — one-shot environment bootstrap.
# Installs PostgreSQL + Node deps, creates the DB, migrates, seeds, then starts
# the app and the self-healing watchdog. Safe to re-run.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { echo "[bootstrap] $*"; }

# --- 1. System dependencies ---------------------------------------------------
if ! command -v psql >/dev/null 2>&1 || ! ls /usr/lib/postgresql >/dev/null 2>&1; then
  log "Installing PostgreSQL..."
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

# --- 2. Start PostgreSQL and (re)create role + database -----------------------
if ! pg_isready -q -h 127.0.0.1 -p 5432 2>/dev/null; then
  log "Starting PostgreSQL cluster..."
  sudo pg_ctlcluster 17 main start 2>/dev/null || sudo service postgresql start 2>/dev/null || true
  for _ in $(seq 1 20); do pg_isready -q -h 127.0.0.1 -p 5432 && break; sleep 1; done
fi

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='taiznow'" 2>/dev/null | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE taiznow LOGIN PASSWORD 'taiznow_secret';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='taiznow'" 2>/dev/null | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE taiznow OWNER taiznow;"

# --- 3. Node dependencies -----------------------------------------------------
if [ ! -d node_modules ] || [ ! -f node_modules/.bin/next ]; then
  log "Installing npm dependencies..."
  npm install
fi

# --- 4. Env file --------------------------------------------------------------
if [ ! -f .env ]; then
  log "Creating .env from .env.example..."
  cp .env.example .env
fi

# --- 5. Prisma migrate + seed (idempotent) ------------------------------------
log "Generating Prisma client, applying migrations and seeding..."
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts || log "Seed skipped or already applied."

# --- 6. Start the app and the watchdog ---------------------------------------
bash "$ROOT/scripts/start.sh"

log "Bootstrap complete. App should be reachable on port ${PORT:-12000}."
