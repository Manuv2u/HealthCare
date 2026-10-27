#!/usr/bin/env bash
# =============================================================================
# backup-db.sh — Daily PostgreSQL backup via docker exec
# Cron: 0 2 * * * ubuntu /opt/sri-diagnostics/scripts/backup-db.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/sri-diagnostics"
BACKUP_DIR="/data/backups/db"
DATE=$(date +%Y-%m-%d)
FILE="$BACKUP_DIR/sri_diagnostics_${DATE}.sql.gz"
RETAIN_DAYS=7

# Load env for DB credentials
if [[ -f "$DEPLOY_DIR/.env" ]]; then
  set -o allexport
  source <(grep -v '^#' "$DEPLOY_DIR/.env" | grep -v '^$')
  set +o allexport
fi

: "${DB_NAME:=sri_diagnostics}"
: "${DB_USER:=sri_user}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [backup] $*"; }

mkdir -p "$BACKUP_DIR"
log "Starting backup → $FILE"

# PostgreSQL is in Docker — use docker exec
docker exec sri-diagnostics-postgres-1 \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$FILE"

SIZE=$(du -sh "$FILE" | cut -f1)
log "Backup written: $FILE ($SIZE)"

# Verify integrity
if gzip -t "$FILE" 2>/dev/null; then
  log "Integrity check passed"
else
  log "ERROR: Backup file is corrupted!"
  exit 1
fi

# Retention cleanup
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETAIN_DAYS" -print -delete | wc -l)
log "Removed $DELETED old backup(s) (retained last ${RETAIN_DAYS} days)"
log "Done"
