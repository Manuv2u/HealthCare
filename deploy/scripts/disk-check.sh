#!/usr/bin/env bash
# =============================================================================
# disk-check.sh — Monitor disk usage, auto-clean at threshold
# Cron: 0 */6 * * * ubuntu /opt/sri-diagnostics/scripts/disk-check.sh
# =============================================================================
set -euo pipefail

THRESHOLD=85
CRITICAL=95

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [disk] $*"; }

USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
log "Disk usage: ${USAGE}%"

if [[ $USAGE -ge $CRITICAL ]]; then
  log "CRITICAL: Disk at ${USAGE}% — emergency cleanup"
  docker image prune -af
  docker builder prune -af
  find /data/backups/db   -name "*.sql.gz"  -mtime +3 -delete 2>/dev/null || true
  find /data/backups/full -name "*.tar.gz"  -mtime +7 -delete 2>/dev/null || true
  find /data/logs         -name "*.log.gz"  -mtime +3 -delete 2>/dev/null || true
  AFTER=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
  log "After emergency cleanup: ${AFTER}%"

elif [[ $USAGE -ge $THRESHOLD ]]; then
  log "WARNING: Disk at ${USAGE}% — standard cleanup"
  docker image prune -af --filter "until=168h"
  docker builder prune -af --keep-storage 500MB
  find /data/backups/db   -name "*.sql.gz"  -mtime +5 -delete 2>/dev/null || true
  AFTER=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
  log "After cleanup: ${AFTER}%"

else
  log "OK — no action needed"
fi
