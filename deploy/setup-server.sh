#!/usr/bin/env bash
# =============================================================================
# setup-server.sh — Sri Diagnostics Server Bootstrap
# Ubuntu 24.04 LTS, Docker 27+, PostgreSQL 16 in Docker
# Run once after VM provisioning. Idempotent — safe to re-run.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
log()     { echo -e "${BLUE}[setup]${NC} $*"; }
success() { echo -e "${GREEN}[✔]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }

if [[ $EUID -ne 0 ]]; then exec sudo bash "$0" "$@"; fi

DEPLOY_DIR="/opt/sri-diagnostics"
DB_NAME="sri_diagnostics"
DB_USER="sri_user"

# Generate password if not existing
if [[ -f "$DEPLOY_DIR/.env" ]]; then
  DB_PASS=$(grep "^DB_PASSWORD=" "$DEPLOY_DIR/.env" | cut -d= -f2 || true)
fi
DB_PASS="${DB_PASS:-$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)}"
JWT_SECRET="$(openssl rand -base64 48)"
PAYMENT_WEBHOOK_SECRET="$(openssl rand -base64 32)"

# ── 1. System update ──────────────────────────────────────────────────────────
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
systemctl stop unattended-upgrades 2>/dev/null || true
systemctl stop apt-daily.service 2>/dev/null || true
systemctl stop apt-daily-upgrade.service 2>/dev/null || true
for i in $(seq 1 12); do
  flock -n /var/lib/dpkg/lock-frontend -c true 2>/dev/null && break
  sleep 5
done

apt-get update -qq
apt-get upgrade -y -qq
add-apt-repository universe -y
apt-get update -qq
apt-get install -y -qq \
  curl wget gnupg2 lsb-release ca-certificates \
  apt-transport-https software-properties-common \
  unzip zip rsync jq htop iotop ncdu \
  ufw logrotate cron git

# fail2ban (optional)
apt-get install -y -qq fail2ban || warn "fail2ban not available"

success "System packages ready"

# ── 2. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  for i in $(seq 1 12); do
    flock -n /var/lib/dpkg/lock-frontend -c true 2>/dev/null && break
    sleep 5
  done
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu
  systemctl enable docker
  systemctl start docker
  success "Docker installed ($(docker --version))"
else
  success "Docker already installed ($(docker --version))"
fi

# Docker log rotation
cat > /etc/docker/daemon.json << 'DOCKER'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "7"
  }
}
DOCKER
systemctl restart docker
success "Docker log rotation configured"

# ── 3. /data directory structure ───────────────────────────────────────────────
log "Creating /data directory structure..."
mkdir -p \
  /data/postgres \
  /data/uploads \
  /data/logs/nginx \
  /data/logs/backend \
  /data/backups/db \
  /data/backups/full \
  /data/monitoring \
  /data/certbot/conf \
  /data/certbot/www

chown -R ubuntu:ubuntu /data
chmod 750 /data/postgres
chmod 755 /data/uploads /data/logs /data/backups /data/monitoring /data/certbot
success "/data directories created"

# ── 4. Application directories ─────────────────────────────────────────────────
log "Creating application directories..."
mkdir -p \
  "$DEPLOY_DIR" \
  "$DEPLOY_DIR/releases" \
  "$DEPLOY_DIR/scripts" \
  "$DEPLOY_DIR/nginx/conf.d"

chown -R ubuntu:ubuntu "$DEPLOY_DIR"
success "Application directories created"

# ── 5. Write .env ─────────────────────────────────────────────────────────────
if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
  log "Writing .env..."
  cat > "$DEPLOY_DIR/.env" << ENV
# ── Database ───────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}
DB_HOST=postgres
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}

# ── Auth ────────────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── Storage ─────────────────────────────────────────────────────────────────────
FILE_STORAGE_BACKEND=local
FILE_STORAGE_PATH=/app/file_storage

# ── Payments ────────────────────────────────────────────────────────────────────
PAYMENT_WEBHOOK_SECRET=${PAYMENT_WEBHOOK_SECRET}

# ── Email ────────────────────────────────────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=change-me

# ── SMS ──────────────────────────────────────────────────────────────────────────
SMS_PROVIDER=msg91
SMS_API_KEY=change-me

# ── App ──────────────────────────────────────────────────────────────────────────
LOG_LEVEL=INFO
GST_RATE=0.18
ENV_PROFILE=production
ENV
  chown ubuntu:ubuntu "$DEPLOY_DIR/.env"
  chmod 600 "$DEPLOY_DIR/.env"
  success ".env written"
else
  success ".env already exists — skipped"
fi

# ── 6. UFW Firewall ────────────────────────────────────────────────────────────
log "Configuring UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
success "UFW configured (22, 80, 443 only)"

# ── 7. SSH Hardening ──────────────────────────────────────────────────────────
log "Hardening SSH..."
SSHD_CONF="/etc/ssh/sshd_config"
grep -q "^PermitRootLogin" "$SSHD_CONF" && \
  sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONF" || \
  echo "PermitRootLogin no" >> "$SSHD_CONF"
grep -q "^PasswordAuthentication" "$SSHD_CONF" && \
  sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONF" || \
  echo "PasswordAuthentication no" >> "$SSHD_CONF"
grep -q "^X11Forwarding" "$SSHD_CONF" && \
  sed -i 's/^X11Forwarding.*/X11Forwarding no/' "$SSHD_CONF" || \
  echo "X11Forwarding no" >> "$SSHD_CONF"
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
success "SSH hardened (no root login, no password auth)"

# ── 8. Fail2ban ───────────────────────────────────────────────────────────────
if command -v fail2ban-server &>/dev/null; then
  cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
[sshd]
enabled  = true
port     = ssh
maxretry = 5
bantime  = 3600
findtime = 600
FAIL2BAN
  systemctl enable fail2ban
  systemctl restart fail2ban
  success "fail2ban configured"
fi

# ── 9. Automatic security updates ─────────────────────────────────────────────
log "Enabling automatic security updates..."
apt-get install -y -qq unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
success "Automatic security updates enabled"

# ── 10. Logrotate ─────────────────────────────────────────────────────────────
log "Configuring logrotate..."
cat > /etc/logrotate.d/sri-diagnostics << 'LOGROTATE'
/data/logs/nginx/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        docker exec sri-diagnostics-nginx-1 nginx -s reopen 2>/dev/null || true
    endscript
}

/data/logs/backend/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
LOGROTATE
success "Logrotate configured"

# ── 11. Cron jobs ─────────────────────────────────────────────────────────────
log "Installing cron jobs..."
cat > /etc/cron.d/sri-diagnostics << 'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Daily DB backup — 02:00 UTC
0 2 * * * ubuntu /opt/sri-diagnostics/scripts/backup-db.sh >> /data/logs/backup.log 2>&1

# Weekly full backup — Sunday 03:00 UTC
0 3 * * 0 ubuntu /opt/sri-diagnostics/scripts/backup-full.sh >> /data/logs/backup.log 2>&1

# Daily Docker cleanup — 04:00 UTC
0 4 * * * ubuntu /opt/sri-diagnostics/scripts/cleanup.sh >> /data/logs/cleanup.log 2>&1

# Disk space check — every 6 hours
0 */6 * * * ubuntu /opt/sri-diagnostics/scripts/disk-check.sh >> /data/logs/disk-check.log 2>&1

# Certificate renewal check — twice daily
0 */12 * * * root certbot renew --quiet --deploy-hook "docker exec sri-diagnostics-nginx-1 nginx -s reload" >> /data/logs/certbot.log 2>&1
CRON
chmod 644 /etc/cron.d/sri-diagnostics
success "Cron jobs installed"

# ── 12. Install Netdata ────────────────────────────────────────────────────────
if ! command -v netdata &>/dev/null; then
  log "Installing Netdata monitoring..."
  curl -fsSL https://get.netdata.cloud/kickstart.sh | bash -s -- --nightly-channel --dont-start-it --disable-telemetry || warn "Netdata install failed (non-critical)"
  # Bind only to localhost — access via SSH tunnel
  if [[ -f /etc/netdata/netdata.conf ]]; then
    sed -i 's/# bind to = .*/bind to = 127.0.0.1/' /etc/netdata/netdata.conf
    systemctl enable netdata && systemctl start netdata || true
  fi
  success "Netdata installed (access via: ssh -L 19999:localhost:19999 ubuntu@<VM_IP>)"
fi

# ── 13. Install Certbot ────────────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
  log "Installing Certbot..."
  apt-get install -y -qq certbot || warn "Certbot install failed (add domain later)"
  success "Certbot installed"
fi

# ── 14. Scaffold maintenance scripts ───────────────────────────────────────────
log "Installing maintenance scripts..."

cat > "$DEPLOY_DIR/scripts/backup-db.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
source /opt/sri-diagnostics/.env 2>/dev/null || true
DATE=$(date +%Y-%m-%d)
FILE="/data/backups/db/sri_diagnostics_${DATE}.sql.gz"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting DB backup..."
docker exec sri-diagnostics-postgres-1 \
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup written: $FILE ($SIZE)"
find /data/backups/db -name "*.sql.gz" -mtime +7 -delete
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Old backups cleaned (kept last 7 days)"
SCRIPT

cat > "$DEPLOY_DIR/scripts/backup-full.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
DEPLOY_DIR="/opt/sri-diagnostics"
DATE=$(date +%Y-%m-%d)
FILE="/data/backups/full/full_${DATE}.tar.gz"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting full backup..."
docker exec sri-diagnostics-postgres-1 \
  pg_dump -U "$DB_USER" "$DB_NAME" > /tmp/db_dump_${DATE}.sql 2>/dev/null || true
tar -czf "$FILE" \
  -C / \
  --exclude="/data/postgres" \
  --exclude="/data/backups" \
  data/uploads \
  opt/sri-diagnostics/.env \
  opt/sri-diagnostics/docker-compose.yml \
  opt/sri-diagnostics/nginx \
  tmp/db_dump_${DATE}.sql \
  2>/dev/null || true
rm -f /tmp/db_dump_${DATE}.sql
SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Full backup written: $FILE ($SIZE)"
find /data/backups/full -name "*.tar.gz" -mtime +30 -delete
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Old full backups cleaned (kept last 30 days)"
SCRIPT

cat > "$DEPLOY_DIR/scripts/cleanup.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting Docker cleanup..."
docker image prune -af --filter "until=168h"
docker builder prune -af --keep-storage 1GB
docker network prune -f
# Keep only last 3 releases
cd /opt/sri-diagnostics/releases 2>/dev/null || exit 0
ls -dt */ 2>/dev/null | tail -n +4 | xargs -r rm -rf
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Docker cleanup complete"
SCRIPT

cat > "$DEPLOY_DIR/scripts/disk-check.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
THRESHOLD=85
USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Disk usage: ${USAGE}%"
if [[ $USAGE -ge $THRESHOLD ]]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARNING: Disk ${USAGE}% — running emergency cleanup"
  docker image prune -af
  docker builder prune -af
  find /data/backups/db -name "*.sql.gz" -mtime +3 -delete
  find /data/backups/full -name "*.tar.gz" -mtime +7 -delete
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Emergency cleanup done"
fi
SCRIPT

cat > "$DEPLOY_DIR/scripts/rollback.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
DEPLOY_DIR="/opt/sri-diagnostics"
cd "$DEPLOY_DIR"

echo "=== Available releases ==="
ls -dt releases/*/ 2>/dev/null | head -10 || { echo "No releases found"; exit 1; }

CURRENT=$(readlink -f releases/current 2>/dev/null || echo "")
PREVIOUS=$(ls -dt releases/*/ 2>/dev/null | sed -n '2p')

if [[ -z "$PREVIOUS" ]]; then
  echo "No previous release to roll back to."
  exit 1
fi

echo ""
echo "Current : $CURRENT"
echo "Rollback: $PREVIOUS"
echo ""
read -r -p "Confirm rollback? [yes/N]: " CONFIRM
[[ "$CONFIRM" != "yes" ]] && { echo "Aborted."; exit 0; }

# Tag previous images as current
TAG=$(basename "$PREVIOUS")
docker load < "$PREVIOUS/sri-backend.tar.gz" 2>/dev/null || true
docker load < "$PREVIOUS/sri-frontend.tar.gz" 2>/dev/null || true
docker compose up -d --force-recreate --no-deps backend frontend
echo "Rollback complete — running: $TAG"
SCRIPT

cat > "$DEPLOY_DIR/scripts/setup-ssl.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${1:-}"
EMAIL="${2:-}"
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <domain> <email>"
  echo "Example: $0 diagnostics.example.com admin@example.com"
  exit 1
fi

echo "Obtaining Let's Encrypt certificate for $DOMAIN..."
certbot certonly --webroot -w /data/certbot/www -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" --agree-tos --non-interactive

# Deploy SSL nginx config
cat > /opt/sri-diagnostics/nginx/conf.d/app.conf << NGINX
upstream frontend_upstream { server frontend:80; keepalive 32; }
upstream backend_upstream { server backend:8000; keepalive 32; }

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location = /health { return 200 "healthy\n"; add_header Content-Type text/plain; }
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://backend_upstream;
        proxy_read_timeout 120s;
    }
    location /api/v1/auth/login {
        limit_req zone=auth burst=3 nodelay;
        proxy_pass http://backend_upstream;
    }
    location / { proxy_pass http://frontend_upstream; }
}
NGINX

docker exec sri-diagnostics-nginx-1 nginx -t && \
  docker exec sri-diagnostics-nginx-1 nginx -s reload
echo "SSL configured for $DOMAIN"
SCRIPT

chmod +x "$DEPLOY_DIR/scripts/"*.sh
chown -R ubuntu:ubuntu "$DEPLOY_DIR/scripts"
success "Maintenance scripts installed"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}  Server bootstrap complete ✔${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  DB password : $DB_PASS"
echo "  Deploy dir  : $DEPLOY_DIR"
echo "  Data dir    : /data"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "    1. Edit $DEPLOY_DIR/.env — fill in SMTP, SMS, payment keys"
echo "    2. Run: ./deploy.sh from your local machine"
echo "    3. (Optional) Add SSL: /opt/sri-diagnostics/scripts/setup-ssl.sh yourdomain.com you@email.com"
echo ""
