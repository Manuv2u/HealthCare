# SRI Diagnostic Laboratory & Health Care

Full-stack diagnostic lab management system — Angular 17 frontend, FastAPI backend, PostgreSQL database, deployed on OCI Always Free tier.

---

## Quick Start — Deploy to OCI

Two commands to get the app running on a cloud VM:

```bash
# 1. Create VM + deploy app (10–15 min first time)
./oracle-oci/vm-up.sh

# 2. Delete VM and all cloud resources
./vm-down.sh
```

---

## Prerequisites (one-time setup)

### 1. Install OCI CLI

```bash
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
# Installs to ~/bin/oci — accept all defaults
```

### 2. Configure OCI CLI

```bash
oci setup config
```

You will need:
- **User OCID** — OCI Console → Profile (top right) → User Settings → copy OCID
- **Tenancy OCID** — OCI Console → Profile → Tenancy → copy OCID
- **Region** — e.g. `ap-mumbai-1`

This creates `~/.oci/config` and generates an API key pair at `~/.oci/oci_api_key.pem`.

### 3. Upload API key to OCI Console

```bash
cat ~/.oci/oci_api_key_public.pem
```

Copy the output. In OCI Console:
1. Profile (top right) → **User Settings**
2. Left sidebar → **API Keys** → **Add API Key**
3. Select **Paste a public key** → paste the key → **Add**

Verify it works:
```bash
~/bin/oci iam region list --output table
```

### 4. Install Docker

Download **Docker Desktop** from [docker.com](https://www.docker.com/products/docker-desktop/) and start it.

### 5. Install jq

```bash
brew install jq
```

---

## vm-up.sh — Create VM and Deploy

```
./oracle-oci/vm-up.sh [--provision | --deploy]
```

| Flag | What it does |
|------|-------------|
| *(none)* | Full run: creates VM + deploys app |
| `--provision` | Creates/verifies VM only (skip deploy) |
| `--deploy` | Deploys app only (VM must already exist) |

**What happens on first run:**

1. **Provision** (`oracle-oci/provision-oci.sh`) — ~10 min
   - Creates VCN, subnet, internet gateway, security list
   - Launches Ubuntu 22.04 ARM VM (4 OCPU / 24 GB RAM — OCI Always Free)
   - Installs Docker, Docker Compose, PostgreSQL 15
   - Sets up firewall (UFW), fail2ban, daily DB backups
   - Saves VM IP and SSH key to `deploy/.deploy.conf`

2. **Deploy** (`deploy.sh`) — ~5 min
   - Builds backend (FastAPI) and frontend (Angular) Docker images
   - Uploads images to the VM via rsync
   - Starts containers with `docker compose`
   - Health-checks the backend; auto-rolls back if startup fails

**Output:**

```
  App      : http://<VM_IP>
  API Docs : http://<VM_IP>/api/v1/docs
  SSH      : ssh -i keys/oci_vm_key ubuntu@<VM_IP>
```

**Re-deploy after code changes:**

```bash
./oracle-oci/vm-up.sh --deploy
```

---

## vm-down.sh — Delete VM

```
./vm-down.sh
```

Permanently deletes:
- Compute instance (VM)
- All data on the VM (PostgreSQL database, file storage)
- VCN, subnet, internet gateway, security list

> **Back up your database first:**
> ```bash
> ssh -i keys/oci_vm_key ubuntu@<VM_IP> \
>   '/opt/sri-diagnostics/scripts/backup-db.sh'
> ```

You will be prompted to type `yes` to confirm. After destruction, run `./oracle-oci/vm-up.sh` anytime to create a fresh VM.

---

## SSH into the VM

```bash
ssh -i keys/oci_vm_key ubuntu@<VM_IP>
```

Useful commands on the VM:

```bash
# View running containers
docker compose -f /opt/sri-diagnostics/docker-compose.yml ps

# View backend logs
docker compose -f /opt/sri-diagnostics/docker-compose.yml logs -f backend

# Manual DB backup
/opt/sri-diagnostics/scripts/backup-db.sh

# Restart everything
cd /opt/sri-diagnostics && docker compose up -d --force-recreate
```

---

## Local Development

```bash
# Start all services locally (PostgreSQL + backend + frontend)
docker compose up --build

# Frontend : http://localhost:4200
# Backend  : http://localhost:8000
# API Docs : http://localhost:8000/docs
```

Default admin login:
- Email: `admin@sri.local`
- Password: `<ADMIN_PASSWORD>`

---

## File Structure

```
.
├── vm-up.sh              ← Create VM + deploy (start here)
├── vm-down.sh            ← Delete VM
├── provision-oci.sh      ← OCI infra provisioning
├── deploy.sh             ← Docker build + upload + deploy
├── docker-compose.yml    ← Local dev
├── backend/              ← FastAPI app
├── frontend/             ← Angular 17 app
└── deploy/
    ├── docker-compose.prod.yml   ← Production compose
    ├── setup-server.sh           ← Server bootstrap script
    ├── destroy-oci.sh            ← Tear down OCI resources
    └── scripts/                  ← DB backup, log archive, cleanup
```

---

## State Files (gitignored)

| File | Purpose |
|------|---------|
| `.oci-state.json` | OCI resource OCIDs — auto-created by `vm-up.sh` |
| `keys/oci_vm_key` | SSH private key for the VM |
| `keys/oci_vm_key.pub` | SSH public key |
| `deploy/.deploy.conf` | VM IP, user, key path |
| `deploy/.env.production` | Production secrets (DB password, JWT secret) |

> These files are in `.gitignore` — never commit them.

---

## Database Recovery

Daily backups are stored at `/opt/sri-diagnostics/backups/` on the VM.

### Restore from backup

```bash
# SSH into VM
ssh -i keys/oci_vm_key ubuntu@<VM_IP>

# List backups
ls -lt /opt/sri-diagnostics/backups/

# Restore
gunzip -c /opt/sri-diagnostics/backups/sri_diagnostics_<DATE>.sql.gz \
  | psql -h localhost -U sri_user sri_diagnostics
```

### Verify restore

```bash
psql -h localhost -U sri_user sri_diagnostics -c "
SELECT
  (SELECT COUNT(*) FROM users)    AS users,
  (SELECT COUNT(*) FROM bookings) AS bookings,
  (SELECT COUNT(*) FROM tests)    AS tests;
"
```
chmod 600 ./oracle-oci/keys/oci_vm_key

ssh -i ./oracle-oci/keys/oci_vm_key ubuntu@<VM_IP>

E2E Test Report

https://claude.ai/code/artifact/6f7851c9-4802-4e6f-85ee-aef9994fe886


docker compose up -d --build
## Oracle Cloud (OCI) files — local only

All OCI provisioning scripts, SSH keys, state and IPs live in `oracle-oci/`, which is **git-ignored**.
They are not part of the public repo. Run them from anywhere: `./oracle-oci/vm-up.sh`.
Production secrets go in `deploy/.env.production` (also git-ignored); see `deploy/.deploy.conf.example`.
