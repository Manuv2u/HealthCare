# Sri Diagnostics — Deployment Guide

Production deployment on **Oracle Cloud Always Free Ubuntu VM** using Docker + PostgreSQL-on-host.

---

## Architecture

```
OCI VM (Ubuntu 24.04) — <VM_IP>
├── nginx (host, not Docker)  ← TLS termination, 80/443 — srihealthplus.com
│   └── proxies to 127.0.0.1:8081
├── Docker
│   ├── postgres           ← port 5432, internal only
│   ├── backend             ← FastAPI — 127.0.0.1:8000 (loopback only)
│   └── frontend            ← Angular/nginx — 127.0.0.1:8081 (loopback only)
│         └── proxies /api/ internally to backend:8000 over the docker network
└── Cron jobs               ← backup, archive, cleanup
```

Public traffic hits host nginx first (TLS termination), which forwards everything to the frontend container; the frontend container's own nginx (`frontend/nginx.conf`) then internally proxies `/api/` to the backend container. Postgres runs as a Docker container (not directly on the VM as this diagram previously said), reachable from the backend over the `sri_net` docker network.

---

## Prerequisites

### On your local machine

- Docker Desktop (or Docker Engine) — to build images
- `rsync` and `ssh` — standard on macOS/Linux; Windows users need WSL or Git Bash
- Your OCI private key file (e.g. `~/.ssh/oci_key`)

### On OCI Console (one-time)

In **Networking → Virtual Cloud Networks → Your VCN → Security Lists**, add ingress rules:

| Source CIDR | Protocol | Port | Description |
|---|---|---|---|
| 0.0.0.0/0 | TCP | 22 | SSH |
| 0.0.0.0/0 | TCP | 80 | HTTP (frontend) |
| 0.0.0.0/0 | TCP | 443 | HTTPS (future) |
| 0.0.0.0/0 | TCP | 8080 | Backend API |

---

## First-Time Setup

### Step 1 — Bootstrap the server

```bash
# Upload and run the setup script
scp -i ~/.ssh/oci_key deploy/setup-server.sh ubuntu@<YOUR_VM_IP>:~/
ssh -i ~/.ssh/oci_key ubuntu@<YOUR_VM_IP> 'bash ~/setup-server.sh'
```

This installs Docker, PostgreSQL 15, creates the database and user, sets up directories, configures the firewall, and installs cron jobs. **Takes ~5 minutes on first run.**

At the end, the script prints the generated DB password. The full `.env` is also saved to `/opt/sri-diagnostics/.env`.

### Step 2 — Copy the generated `.env` back locally

```bash
scp -i ~/.ssh/oci_key ubuntu@<YOUR_VM_IP>:/opt/sri-diagnostics/.env deploy/.env.production
```

Review it and fill in any remaining placeholders (SMTP, SMS, payment keys).

### Step 3 — Create your local deploy config

```bash
cp deploy/.deploy.conf.example deploy/.deploy.conf
# Edit it with your VM's IP and SSH key path
```

`deploy/.deploy.conf`:
```bash
VM_HOST=<YOUR_VM_IP>
VM_USER=ubuntu
VM_KEY=~/.ssh/oci_key
DEPLOY_DIR=/opt/sri-diagnostics
```

### Step 4 — First deploy

```bash
./deploy.sh
```

That's it. The script builds images, uploads them, deploys, and shows the URLs.

---

## Ongoing Deployment

After any code change, from your local machine:

```bash
./deploy.sh
```

### Flags

| Flag | Effect |
|---|---|
| `./deploy.sh` | Full build + deploy |
| `./deploy.sh --skip-build` | Upload and deploy existing local images (no rebuild) |
| `./deploy.sh --no-rollback` | Don't auto-rollback if health check fails |

---

## Directory Layout (on VM)

```
/opt/sri-diagnostics/
├── docker-compose.yml      ← uploaded by deploy.sh
├── .env                    ← production secrets
├── file_storage/           ← uploaded reports (persists across deploys)
├── backups/                ← daily DB backups  sri_diagnostics_YYYY-MM-DD.sql.gz
├── logs/                   ← container logs
│   ├── backend.log
│   ├── frontend.log
│   └── archive/            ← zipped log archives  logs_YYYY-MM-DD.zip
├── releases/               ← image tarballs (last 3 kept)
│   └── 20260120_143022/
│       ├── sri-backend.tar.gz
│       └── sri-frontend.tar.gz
└── scripts/
    ├── backup-db.sh
    ├── archive-logs.sh
    ├── cleanup.sh
    ├── health-check.sh
    └── rollback.sh
```

---

## Manual Operations

### SSH into the server

```bash
ssh -i ~/.ssh/oci_key ubuntu@<VM_IP>
```

### View live container logs

```bash
docker logs -f sri-healthcare-backend-1
docker logs -f sri-healthcare-frontend-1
```

### Run health check

```bash
/opt/sri-diagnostics/scripts/health-check.sh
```

### Manual rollback

If a deployment is broken, revert to the previous images:

```bash
/opt/sri-diagnostics/scripts/rollback.sh
```

Or remotely, without SSH-ing in:

```bash
ssh -i ~/.ssh/oci_key ubuntu@<VM_IP> '/opt/sri-diagnostics/scripts/rollback.sh'
```

### Manual DB backup

```bash
/opt/sri-diagnostics/scripts/backup-db.sh
```

### Restore a backup

```bash
# List available backups
ls -lh /opt/sri-diagnostics/backups/

# Restore (replaces existing data)
source /opt/sri-diagnostics/.env
PGPASSWORD="$DB_PASSWORD" gunzip -c /opt/sri-diagnostics/backups/sri_diagnostics_2026-01-20.sql.gz \
  | psql -h localhost -U "$DB_USER" "$DB_NAME"
```

---

## Scheduled Jobs (Cron)

| Time | Script | Purpose |
|---|---|---|
| 02:00 daily | `backup-db.sh` | PostgreSQL dump → gzipped SQL, 7-day retention |
| 03:00 daily | `archive-logs.sh` | Zip container logs, 7-day retention |
| 04:00 daily | `cleanup.sh` | Prune Docker images, old releases, temp files |

Cron output is logged to:
- `/opt/sri-diagnostics/logs/backup.log`
- `/opt/sri-diagnostics/logs/archive.log`
- `/opt/sri-diagnostics/logs/cleanup.log`

---

## Application URLs

| Service | URL |
|---|---|
| Frontend | `https://srihealthplus.com` (falls back to `http://` until DNS + cert are live — see below) |
| Backend API | `https://srihealthplus.com/api/v1` (same origin — proxied by the frontend container internally, see `frontend/nginx.conf`) |
| API Docs (Swagger) | `https://srihealthplus.com/api/v1/docs` |
| Direct VM IP | `http://<VM_IP>` |

`frontend` and `backend` containers are **not** publicly exposed anymore — both are bound to `127.0.0.1` only (`8081` and `8000` respectively) and sit behind host nginx, which does TLS termination and reverse-proxying.

---

## Domain & HTTPS — srihealthplus.com

Live setup: host nginx (not dockerized — nginx and certbot run directly on the VM, installed via `setup-server.sh`) terminates TLS on 80/443 and reverse-proxies everything to the frontend container on `127.0.0.1:8081`.

1. **DNS** — A records for `srihealthplus.com` and `www.srihealthplus.com` → `<VM_IP>` (managed in the registrar's DNS zone, e.g. GoDaddy).

2. **Site config** — `deploy/nginx/srihealthplus.com.conf` in this repo is the source of truth. Deploy it with:
   ```bash
   scp -i keys/oci_vm_key deploy/nginx/srihealthplus.com.conf ubuntu@<VM_IP>:/tmp/
   ssh -i keys/oci_vm_key ubuntu@<VM_IP> '
     sudo mv /tmp/srihealthplus.com.conf /etc/nginx/sites-available/srihealthplus.com
     sudo ln -sf /etc/nginx/sites-available/srihealthplus.com /etc/nginx/sites-enabled/srihealthplus.com
     sudo rm -f /etc/nginx/sites-enabled/default
     sudo nginx -t && sudo systemctl restart nginx
   '
   ```
   It starts HTTP-only (also serves the ACME challenge at `/.well-known/acme-challenge/`) so the site is live and certbot can validate before a cert exists.

3. **Certificate** — once DNS has propagated (`dig +short srihealthplus.com` returns `<VM_IP>`), run on the VM:
   ```bash
   sudo certbot --nginx -d srihealthplus.com -d www.srihealthplus.com \
     --email <ADMIN_EMAIL> --agree-tos --non-interactive --redirect
   ```
   This rewrites `/etc/nginx/sites-available/srihealthplus.com` in place to add the 443/TLS server block, HSTS, and an HTTP→HTTPS redirect.

4. **Renewal** — `certbot.timer` (systemd) is already enabled and runs twice daily; no cron entry needed. Verify with:
   ```bash
   sudo certbot renew --dry-run
   ```

> ### ⚠️ Firewall gotcha — read before adding any new host-native service
> This VM also hosts another, unrelated project. Its setup left a **custom iptables `INPUT` chain rule** (persisted via `netfilter-persistent` in `/etc/iptables/rules.v4`) that only explicitly `ACCEPT`s that project's ports (+ established connections, ICMP, loopback) and then unconditionally `REJECT`s everything else — **before UFW's own chain is ever evaluated**. `ufw status` looks correct (80/443/8080 all show `ALLOW`) but that's misleading: UFW's rules never get reached.
>
> This is invisible for **Docker-published** ports (`docker run -p`/`ports:` in compose) because those are DNAT'd in the `nat` table and routed through `FORWARD`/`DOCKER-USER`, bypassing `INPUT` entirely — which is why the app worked fine over plain HTTP when the frontend container published `0.0.0.0:80` directly. It only bites when a **host-native** process (like nginx here) binds a port directly.
>
> Ports 80 and 443 were added explicitly:
> ```bash
> sudo iptables -I INPUT 8 -p tcp --dport 80 -j ACCEPT
> sudo iptables -I INPUT 9 -p tcp --dport 443 -j ACCEPT   # positions relative to the REJECT rule — check with: sudo iptables -L INPUT -n --line-numbers
> sudo netfilter-persistent save
> ```
> If you ever add another host-native service (not a Docker container), it needs the same treatment or it will silently get `REJECT`ed with `icmp-host-prohibited`, which curl/nc report as "Connection refused" — easy to mistake for "nginx isn't listening" when nginx is actually fine.

---

## Troubleshooting

### Backend won't start

```bash
docker logs sri-healthcare-backend-1 --tail 50
```

Most common causes:
- **Database connection refused** — check PostgreSQL is running: `systemctl status postgresql`
- **Alembic migration failed** — check migration logs, possibly run `alembic upgrade head` manually
- **Missing env var** — verify `/opt/sri-diagnostics/.env` has all required keys

### Frontend shows blank page

```bash
curl -v http://localhost:80
docker logs sri-healthcare-frontend-1
```

### PostgreSQL connection from backend

Test the connection the backend would use:

```bash
source /opt/sri-diagnostics/.env
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" "$DB_NAME" -c "SELECT version();"
```

### Out of disk space

```bash
df -h
docker system df
/opt/sri-diagnostics/scripts/cleanup.sh
```

### Port not accessible from outside

Verify both the OCI security list (console) AND UFW allow the port:

```bash
sudo ufw status
```

---

## Security Notes

- `deploy/.deploy.conf` and `deploy/.env.production` are gitignored — never commit them
- PostgreSQL listens only on localhost — no external access
- fail2ban blocks brute-force SSH attempts after 5 failures
- UFW blocks all ports except 22, 80, 443, 8080
- OCI security lists add a second layer of network filtering
- Rotate `JWT_SECRET` by updating `.env` and redeploying; existing sessions will be invalidated
