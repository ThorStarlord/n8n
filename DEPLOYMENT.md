# VPS Deployment & Update Guide (Portainer)

This guide covers how to SSH into your VPS, clone/pull the latest code, and
update the n8n stack running in Portainer.

---

# Bottom line for your setup:

Every update = 3 commands total:

```bash
ssh username@VPS_IP
cd ~/n8n && git pull
docker compose -f docker-compose.custom.yml up -d --build
```
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

### Normal case — repo already exists on the VPS (use this for updates)

```bash
# Find the repo if you forgot where it is
find ~/ /opt /srv -maxdepth 3 -name "docker-compose.yml" 2>/dev/null

# Navigate to the repo directory (adjust path to match your setup)
cd ~/n8n    # common locations: ~/n8n  /opt/n8n  /srv/n8n

# Fetch and pull latest changes
git fetch origin
git checkout main   # replace with your branch name if different
git pull
```

### First time only — fresh VPS clone

```bash
cd ~
git clone --branch main https://github.com/ThorStarlord/n8n.git n8n
cd n8n
```

> If you get `fatal: destination path 'n8n' already exists` — the repo is
> already cloned. Use the "already exists" path above instead.

Replace `main` with your feature branch name if you are deploying a specific
branch.

---

## Step 4 — Review the Compose File

### Updating (already deployed before) — quick check

Check if `git pull` changed anything in the compose file:

```bash
git diff HEAD~1 HEAD -- docker-compose.yml
```

- **No output** → nothing changed. Skip to Step 5.
- **Output shown** → review the diff. Common things that require action:
  - New `environment:` variables added → add them in Portainer stack settings too.
  - `image:` tag changed → confirm you want that version.
  - New volume mounts → ensure the volumes exist on the host.

### First time / verifying from scratch

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

## Step 5 — Rebuild and Restart the Container

This repo uses a **custom Docker image built from source** (`docker-compose.custom.yml`).
That means after `git pull`, you must rebuild the image so the new code is
included. The `docker-compose.custom.yml` file itself rarely needs editing
during a normal update.

### Updating (already deployed before) — one command

```bash
cd ~/n8n   # adjust to your repo path
docker compose -f docker-compose.custom.yml up -d --build
```

`--build` rebuilds the image from the updated repo code, then restarts the
container. That's all that's needed.

### What each part does

```
git pull          → updates source code on disk
docker build      → bakes source code into a new Docker image  (--build does this)
docker compose up → starts container using the new image       (-d runs in background)
```

The running container is not affected by `git pull` alone — it still uses the
old image until you rebuild.

### When to edit docker-compose.custom.yml

Almost never during a normal update. Only if you need to change:
- A port mapping
- An environment variable (e.g. timezone, encryption key)
- The database configuration

### First time only — creating the stack from scratch

```bash
cd ~/n8n
docker compose -f docker-compose.custom.yml up -d --build
```

Same command — Docker builds the image and starts the container for the first
time.

### Portainer UI (if you prefer not to use SSH)

1. Stacks → select your n8n stack → **Editor** tab.
2. Only update the compose content if `docker-compose.custom.yml` changed in
   Step 4, otherwise leave it as-is.
3. Click **Update the stack**.

> Note: Portainer's "Pull and redeploy" only re-pulls images from Docker Hub.
> Since this setup builds a custom image, you must rebuild via SSH
> (`--build`) for code changes to take effect.

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
