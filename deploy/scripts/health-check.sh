#!/usr/bin/env bash
# =============================================================================
# health-check.sh — Verify all services are running correctly
# Usage: ./health-check.sh [--json]
# =============================================================================
set -euo pipefail

JSON_OUT=false
[[ "${1:-}" == "--json" ]] && JSON_OUT=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
BOLD='\033[1m'

pass() { echo -e "${GREEN}[✔]${NC} $*"; }
fail() { echo -e "${RED}[✘]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }

OVERALL=0
RESULTS=()

check() {
  local name="$1" cmd="$2" expect="${3:-}"
  local output status=0

  output=$(eval "$cmd" 2>&1) || status=$?

  if [[ $status -ne 0 ]]; then
    fail "$name"
    RESULTS+=("{\"check\":\"$name\",\"status\":\"fail\",\"detail\":\"exit $status\"}")
    OVERALL=1
    return
  fi

  if [[ -n "$expect" && "$output" != *"$expect"* ]]; then
    fail "$name (unexpected response: $output)"
    RESULTS+=("{\"check\":\"$name\",\"status\":\"fail\",\"detail\":\"unexpected: $output\"}")
    OVERALL=1
    return
  fi

  pass "$name"
  RESULTS+=("{\"check\":\"$name\",\"status\":\"ok\"}")
}

echo ""
echo -e "${BOLD}Sri Diagnostics — Health Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── PostgreSQL ────────────────────────────────────────────────────────────────
check "PostgreSQL systemd service" \
  "systemctl is-active --quiet postgresql"

check "PostgreSQL accepting connections" \
  "sudo -u postgres pg_isready -q"

check "Application database exists" \
  "sudo -u postgres psql -lqt | grep -q sri_diagnostics"

# ── Docker ────────────────────────────────────────────────────────────────────
check "Docker daemon running" \
  "systemctl is-active --quiet docker"

check "Backend container running" \
  "docker ps --filter name=backend --filter status=running --format '{{.Names}}' | grep -q backend"

check "Frontend container running" \
  "docker ps --filter name=frontend --filter status=running --format '{{.Names}}' | grep -q frontend"

# ── HTTP endpoints ─────────────────────────────────────────────────────────────
check "Backend /health endpoint" \
  "curl -sf --max-time 5 http://localhost:8080/health" \
  ""

check "Frontend HTTP (port 80)" \
  "curl -sf --max-time 5 http://localhost:80" \
  ""

check "API docs accessible" \
  "curl -sf --max-time 5 http://localhost:8080/docs" \
  ""

# ── Disk space ────────────────────────────────────────────────────────────────
DISK_USE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [[ $DISK_USE -ge 90 ]]; then
  fail "Disk usage critical: ${DISK_USE}%"
  RESULTS+=("{\"check\":\"disk_space\",\"status\":\"fail\",\"detail\":\"${DISK_USE}% used\"}")
  OVERALL=1
elif [[ $DISK_USE -ge 75 ]]; then
  warn "Disk usage high: ${DISK_USE}%"
  RESULTS+=("{\"check\":\"disk_space\",\"status\":\"warn\",\"detail\":\"${DISK_USE}% used\"}")
else
  pass "Disk usage: ${DISK_USE}%"
  RESULTS+=("{\"check\":\"disk_space\",\"status\":\"ok\",\"detail\":\"${DISK_USE}% used\"}")
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── JSON output ──────────────────────────────────────────────────────────────
if [[ "$JSON_OUT" == true ]]; then
  printf '{"timestamp":"%s","overall":"%s","checks":[%s]}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$([[ $OVERALL -eq 0 ]] && echo ok || echo fail)" \
    "$(IFS=,; echo "${RESULTS[*]}")"
fi

if [[ $OVERALL -eq 0 ]]; then
  echo -e "\n${GREEN}${BOLD}All checks passed ✔${NC}\n"
else
  echo -e "\n${RED}${BOLD}Some checks failed ✘${NC}\n"
fi

exit $OVERALL
