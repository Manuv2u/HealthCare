#!/usr/bin/env bash
# =============================================================================
# cleanup.sh — Daily housekeeping
# Cron: 0 4 * * * ubuntu /opt/sri-diagnostics/scripts/cleanup.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/sri-diagnostics"
RELEASES_DIR="$DEPLOY_DIR/releases"
KEEP_RELEASES=3

log() { echo "[$(date '+%H:%M:%S')] [cleanup] $*"; }

# ── Docker image / container cleanup ─────────────────────────────────────────
log "Pruning stopped containers…"
CONTAINERS=$(docker container prune -f --filter "until=24h" 2>&1)
log "$CONTAINERS"

log "Pruning dangling images (older than 7 days)…"
IMAGES=$(docker image prune -f --filter "until=168h" 2>&1)
log "$IMAGES"

log "Pruning unused networks…"
docker network prune -f > /dev/null 2>&1 || true

# ── Old release tarballs ──────────────────────────────────────────────────────
if [[ -d "$RELEASES_DIR" ]]; then
  log "Keeping last ${KEEP_RELEASES} releases…"
  DELETED=$(cd "$RELEASES_DIR" && ls -dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf --; echo $?)
  log "Old releases cleaned"
fi

# ── Temp files ────────────────────────────────────────────────────────────────
log "Removing stale tmp tarballs…"
find /tmp -name "sri-*.tar.gz" -mtime +1 -delete 2>/dev/null || true

# ── Disk usage summary ────────────────────────────────────────────────────────
log "Disk usage:"
df -h / | tail -1 | awk '{print "  Used: "$3" / "$2" ("$5" full)"}'
du -sh "$DEPLOY_DIR"/* 2>/dev/null | sort -h | awk '{print "  "$0}'

log "Done"
