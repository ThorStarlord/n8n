# VPS Deployment & Update Guide (Portainer)

This guide covers how to SSH into your VPS, clone/pull the latest code, and
update the n8n stack running in Portainer.

---

## Prerequisites

- SSH access to your VPS (key-based preferred)
- Portainer running on the VPS with an n8n stack already deployed
- The n8n Docker image managed via a `docker-compose.yml` file in this repo
- `git`, `docker`, and `docker compose` installed on the VPS

---

## Step 1 — Back Up Before Updating

**Never skip this.** A backup takes 2 minutes; a recovery without one can take
hours.

### Export workflows from the n8n UI
1. Open n8n → Settings → Workflows → Export All.
2. Save the JSON file locally.

### Backup the n8n data volume on the VPS

```bash
# Find the volume name (usually 'n8n' or 'n8n_data')
docker volume ls | grep n8n

# Create an archive of the volume (replace <volume-name> with the real name)
docker run --rm \
  -v <volume-name>:/data \
  -v /tmp:/backup \
  busybox sh -c "tar czf /backup/n8n-backup-$(date +%F).tar.gz -C /data ."

# Confirm the backup was created
ls -lh /tmp/n8n-backup-*.tar.gz
```

### (Optional) Copy backup to your local machine
From your local machine (not the VPS):

```bash
scp username@VPS_IP:/tmp/n8n-backup-YYYY-MM-DD.tar.gz .
```

### (Optional) Backup Postgres if you use it
```bash
docker exec -t <postgres-container-name> \
  pg_dump -U <pg-user> -Fc <db-name> > /tmp/pg-n8n-backup-$(date +%F).dump
```

---

## Step 2 — SSH Into the VPS

From your local machine (Windows PowerShell, Git Bash, or WSL):

```bash
ssh username@VPS_IP
```

If you need to add your SSH key first (run once from your local machine):

```powershell
# Windows PowerShell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | ssh username@VPS_IP `
  "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

---

## Step 3 — Pull the Latest Code on the VPS

### If the repo is already cloned on the VPS

```bash
# Navigate to the repo directory (adjust path if different)
cd /opt/n8n    # or wherever you cloned it

# Switch to the correct branch and pull latest changes
git fetch origin
git checkout main   # replace with your branch name if different
git pull
```

### If this is the first time / fresh VPS

```bash
cd /opt
sudo git clone --branch main https://github.com/YOUR_USERNAME/n8n.git n8n
cd n8n
```

Replace `main` with your feature branch name if you are deploying a specific
branch.

---

## Step 4 — Review the Compose File

Confirm the `docker-compose.yml` in the repo looks correct before deploying:

```bash
cat docker-compose.yml
```

Key things to verify:
- `image:` tag is correct (e.g. `n8nio/n8n:latest` or a pinned version)
- Volume mounts and environment variables match your Portainer stack settings
- Any new environment variables your feature branch requires are present

If you need to pin a specific version:

```bash
nano docker-compose.yml
# Change:  image: n8nio/n8n:latest
# To:      image: n8nio/n8n:1.XX.X
```

---

## Step 5 — Update the Portainer Stack

You have two options. **Option A (Portainer UI)** is simpler.

### Option A — Portainer Web UI

1. Open Portainer in your browser.
2. Go to **Stacks** → select your n8n stack.
3. Click **Editor** (or the pencil/edit icon).
4. Paste the updated `docker-compose.yml` content (or change the image tag
   inline).
5. Click **Deploy the stack** (Portainer pulls the image and recreates the
   container).

If the stack is linked to a **Git repository**:
1. Stacks → select stack → **Git** tab.
2. Click **Pull and redeploy**.
3. Portainer fetches the latest commit from the repo branch and redeploys.

### Option B — SSH / docker compose directly

```bash
# From the repo directory on the VPS
cd /opt/n8n

# Pull the new image(s)
docker compose pull

# Recreate only the n8n service (replace 'n8n' with your service name)
docker compose up -d --no-deps --force-recreate n8n

# Or bring the full stack up
docker compose up -d
```

---

## Step 6 — Monitor the Deployment

Watch the logs to confirm n8n started cleanly and any database migrations
completed:

```bash
# Tail logs for the n8n container (replace <container-name> if different)
docker logs -f $(docker ps --filter "name=n8n" --format "{{.Names}}" | head -1)

# Or via docker compose
docker compose logs -f n8n
```

Healthy startup indicators in the logs:
- `Migrations: XX migrations already applied`
- `Editor is now accessible via`
- No `ERROR` lines after startup

---

## Step 7 — Verify the App

```bash
# Quick HTTP check (adjust port if you changed it)
curl -I http://localhost:5678/
# Expected: HTTP/1.1 200 OK  (or 302 redirect to /home)
```

Then open the n8n web UI in your browser and confirm:
- Workflows load
- A simple manual-trigger test execution runs successfully
- Credentials are intact

---

## Rollback Plan

If something is wrong after the update:

```bash
# Option 1 — revert the image tag in docker-compose.yml and redeploy
nano docker-compose.yml
# Set image back to the previous tag, e.g. n8nio/n8n:1.XX.X
docker compose up -d --no-deps --force-recreate n8n

# Option 2 — revert the git commit and redeploy
git log --oneline -5          # find the previous commit hash
git checkout <commit-hash>    # check out previous state
docker compose up -d --no-deps --force-recreate n8n
```

To restore from a volume backup:

```bash
# Stop n8n first
docker stop <n8n-container-name>

# Restore the volume
docker run --rm \
  -v <volume-name>:/data \
  -v /tmp:/backup \
  busybox sh -c "tar xzf /backup/n8n-backup-YYYY-MM-DD.tar.gz -C /data"

# Start n8n again
docker start <n8n-container-name>
```

---

## Post-Update Cleanup

```bash
# Remove dangling images to free disk space
docker image prune -f

# Check disk usage
df -h
docker system df
```

---

## Quick-Reference Cheatsheet

| Task | Command |
|------|---------|
| SSH into VPS | `ssh username@VPS_IP` |
| Pull latest code | `git pull` |
| View n8n logs | `docker logs -f $(docker ps --filter name=n8n --format "{{.Names}}" \| head -1)` |
| Restart n8n only | `docker compose up -d --no-deps --force-recreate n8n` |
| Pull new images | `docker compose pull` |
| Backup volume | `docker run --rm -v <vol>:/data -v /tmp:/backup busybox tar czf /backup/n8n-backup-$(date +%F).tar.gz -C /data .` |
| Check disk | `df -h && docker system df` |
| Prune old images | `docker image prune -f` |
