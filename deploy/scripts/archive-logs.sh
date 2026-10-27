#!/usr/bin/env bash
# =============================================================================
# archive-logs.sh — Daily log archival
# Cron: 0 3 * * * ubuntu /opt/sri-diagnostics/scripts/archive-logs.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/sri-diagnostics"
LOG_DIR="$DEPLOY_DIR/logs"
ARCHIVE_DIR="$LOG_DIR/archive"
DATE=$(date +%Y-%m-%d)
ARCHIVE_FILE="$ARCHIVE_DIR/logs_${DATE}.zip"
RETAIN_DAYS=7

log() { echo "[$(date '+%H:%M:%S')] [archive] $*"; }

mkdir -p "$ARCHIVE_DIR"

# ── Export Docker container logs ──────────────────────────────────────────────
log "Collecting Docker container logs…"
docker logs sri-healthcare-backend-1  > "$LOG_DIR/backend.log"  2>&1 || true
docker logs sri-healthcare-frontend-1 > "$LOG_DIR/frontend.log" 2>&1 || true

# ── Create ZIP archive ────────────────────────────────────────────────────────
log "Creating archive → $ARCHIVE_FILE"
cd "$LOG_DIR"

ZIP_FILES=()
for f in backend.log frontend.log backup.log cleanup.log deployment.log; do
  [[ -f "$f" && -s "$f" ]] && ZIP_FILES+=("$f")
done

if [[ ${#ZIP_FILES[@]} -gt 0 ]]; then
  zip -q "$ARCHIVE_FILE" "${ZIP_FILES[@]}"
  SIZE=$(du -sh "$ARCHIVE_FILE" | cut -f1)
  log "Archive created: $ARCHIVE_FILE ($SIZE)"
else
  log "No log files to archive"
fi

# ── Rotate live logs (keep last 1000 lines) ───────────────────────────────────
for f in backend.log frontend.log; do
  if [[ -f "$LOG_DIR/$f" ]]; then
    tail -1000 "$LOG_DIR/$f" > "$LOG_DIR/${f}.tmp" && mv "$LOG_DIR/${f}.tmp" "$LOG_DIR/$f"
  fi
done
log "Live logs rotated (kept last 1000 lines each)"

# ── Cleanup old archives ──────────────────────────────────────────────────────
log "Removing archives older than ${RETAIN_DAYS} days…"
DELETED=$(find "$ARCHIVE_DIR" -name "*.zip" -mtime +"$RETAIN_DAYS" -print -delete | wc -l)
log "Removed $DELETED old archive(s)"

log "Done"
