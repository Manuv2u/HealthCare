#!/usr/bin/env bash
# =============================================================================
# rollback.sh — Revert to the previous Docker images
#
# Run on VM:       /opt/sri-diagnostics/scripts/rollback.sh
# Run remotely:    ssh -i ./keys/oci_vm_key ubuntu@<IP> /opt/sri-diagnostics/scripts/rollback.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/sri-diagnostics"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

log()     { echo -e "[$(date -u +%H:%M:%SZ)] $*"; }
success() { echo -e "${GREEN}[✔]${NC} $*"; }
error()   { echo -e "${RED}[✘]${NC} $*" >&2; }

cd "$DEPLOY_DIR"

# ── Check previous images exist ───────────────────────────────────────────────
if ! docker image inspect sri-healthcare-backend:previous &>/dev/null; then
  error "No previous backend image found. Cannot rollback."
  exit 1
fi
if ! docker image inspect sri-healthcare-frontend:previous &>/dev/null; then
  error "No previous frontend image found. Cannot rollback."
  exit 1
fi

log "Previous images found — proceeding with rollback"

# ── Tag current as 'failed' for post-mortem ───────────────────────────────────
docker tag sri-healthcare-backend:latest  sri-healthcare-backend:failed  2>/dev/null || true
docker tag sri-healthcare-frontend:latest sri-healthcare-frontend:failed 2>/dev/null || true

# ── Promote previous → latest ─────────────────────────────────────────────────
log "Promoting previous images to latest…"
docker tag sri-healthcare-backend:previous  sri-healthcare-backend:latest
docker tag sri-healthcare-frontend:previous sri-healthcare-frontend:latest

# ── Restart containers ────────────────────────────────────────────────────────
log "Restarting containers with previous images…"
docker compose up -d --force-recreate --no-deps backend frontend nginx

# ── Health check via nginx proxy ──────────────────────────────────────────────
log "Waiting for health check (nginx → backend)…"
RETRIES=24
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost/health > /dev/null 2>&1 && \
     curl -sf http://localhost/api/v1/health > /dev/null 2>&1; then
    success "All services healthy after rollback (attempt $i)"
    break
  fi
  if [[ $i -eq $RETRIES ]]; then
    error "Health check failed after rollback — manual intervention required"
    docker compose logs --tail=30 nginx backend
    exit 1
  fi
  log "Not ready yet ($i/$RETRIES)… retrying in 5s"
  sleep 5
done

echo ""
echo -e "${BOLD}${GREEN}Rollback successful ✔${NC}"
echo ""
echo "  Containers now running the previous image."
echo "  Failed image tagged as sri-healthcare-*:failed for inspection."
echo ""
echo "  Inspect failed image:  docker run --rm -it sri-healthcare-backend:failed sh"
echo "  Discard after review:  docker rmi sri-healthcare-backend:failed sri-healthcare-frontend:failed"
echo ""
