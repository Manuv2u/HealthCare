#!/usr/bin/env bash
# =============================================================================
# backup-full.sh — Weekly full backup (uploads, env, config, DB dump)
# Cron: 0 3 * * 0 ubuntu /opt/sri-diagnostics/scripts/backup-full.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/sri-diagnostics"
BACKUP_DIR="/data/backups/full"
DATE=$(date +%Y-%m-%d)
FILE="$BACKUP_DIR/full_${DATE}.tar.gz"
RETAIN_DAYS=30

if [[ -f "$DEPLOY_DIR/.env" ]]; then
  set -o allexport
  source <(grep -v '^#' "$DEPLOY_DIR/.env" | grep -v '^$')
  set +o allexport
fi

: "${DB_NAME:=sri_diagnostics}"
: "${DB_USER:=sri_user}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [backup-full] $*"; }

mkdir -p "$BACKUP_DIR"
log "Starting full backup → $FILE"

# DB dump to temp file
DB_DUMP="/tmp/db_dump_${DATE}.sql"
docker exec sri-diagnostics-postgres-1 \
  pg_dump -U "$DB_USER" "$DB_NAME" > "$DB_DUMP" 2>/dev/null || true

# Bundle uploads, env, config, and DB dump
tar -czf "$FILE" \
  --exclude="/data/postgres" \
  --exclude="/data/backups" \
  -C / \
  data/uploads \
  opt/sri-diagnostics/.env \
  opt/sri-diagnostics/docker-compose.yml \
  opt/sri-diagnostics/nginx \
  2>/dev/null \
  --append "$DB_DUMP" 2>/dev/null || \
tar -czf "$FILE" \
  data/uploads \
  opt/sri-diagnostics/.env \
  opt/sri-diagnostics/docker-compose.yml \
  -C / 2>/dev/null || true

rm -f "$DB_DUMP"

SIZE=$(du -sh "$FILE" | cut -f1)
log "Full backup written: $FILE ($SIZE)"

DELETED=$(find "$BACKUP_DIR" -name "*.tar.gz" -mtime +"$RETAIN_DAYS" -print -delete | wc -l)
log "Removed $DELETED old full backup(s) (retained last ${RETAIN_DAYS} days)"
log "Done"
