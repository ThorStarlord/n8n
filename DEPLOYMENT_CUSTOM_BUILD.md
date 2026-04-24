# N8N 2.14.0 Custom Build Deployment Guide

This guide deploys your custom n8n 2.14.0 (with credential resolution warnings, strict mode, and API enhancements) to the production VPS running Docker Swarm.

## Overview

- **Current VPS**: n8nio/n8n:latest (official, ~1.40)
- **Target**: Your custom build (2.14.0) with your features
- **Method**: Build image on VPS, deploy via Swarm stack
- **Risk**: Low (you have rollback + data is on PostgreSQL, not lost)

## Pre-Deployment Checklist

```bash
# 1. SSH to VPS
ssh root@76.13.230.200

# 2. Backup existing workflows & database
cd ~/n8n

# Export workflows
# Open n8n UI → Settings → Export All → save JSON

# Backup volume
docker volume ls | grep n8n
docker run --rm \
  -v n8n_n8n_data:/data \
  -v /tmp:/backup \
  busybox tar czf /backup/n8n-data-backup-$(date +%F).tar.gz -C /data .

# Verify backup created
ls -lh /tmp/n8n-data-backup-*.tar.gz
```

## Step 1: Update Your Code on VPS

```bash
cd ~/n8n

# Ensure you're on master (your custom branch)
git status
git checkout master
git pull origin master

# Verify the Dockerfile and compose file exist
ls -la Dockerfile.custom docker-compose.swarm.yml
```

## Step 2: Build the Custom Docker Image

This compiles your n8n 2.14.0 from source (takes 10-15 minutes first time).

```bash
# On the VPS, build the image
cd ~/n8n

docker build \
  -f Dockerfile.custom \
  -t n8n-custom:2.14.0 \
  --build-arg NODE_OPTIONS="--max-old-space-size=6144" \
  .

# Monitor build progress
# You'll see: npm install → pnpm build → TypeScript compilation

# Verify image was created
docker images | grep n8n-custom
# Should show: n8n-custom  2.14.0  <image-id>  <size>
```

**If build fails:**
- Check disk space: `df -h` (need at least 10GB free)
- Check RAM: `free -h` (build needs ~6GB, available to containers)
- Check logs: `docker buildx build` or rebuild with `--progress=plain`

## Step 3: Verify the Image Works (Optional but Recommended)

Before deploying to production, test the image locally:

```bash
# Quick test: run the image and check it boots
docker run --rm -e N8N_ENCRYPTION_KEY=test123 n8n-custom:2.14.0 start &

# Wait 30 seconds for startup
sleep 30

# Should see: "Editor is now accessible via"
# Stop the test
docker kill $(docker ps -q --filter "ancestor=n8n-custom:2.14.0")
```

## Step 4: Scale Down Current Stack (Zero-Downtime Deploy)

The Swarm deployment will replace the services one by one (rolling update).

```bash
# Check current stack
docker stack ps n8n

# The stack will automatically be updated in the next step
# Swarm handles graceful shutdown of old replicas as new ones start
```

## Step 5: Deploy the Custom Stack

This updates the Swarm stack with your custom image:

```bash
# Deploy the new Swarm stack
cd ~/n8n
docker stack deploy -c docker-compose.swarm.yml n8n

# Monitor the rollout
watch -n 2 'docker stack ps n8n'
# Press Ctrl+C to exit

# Expected sequence:
# 1. Services show "Preparing"
# 2. New replicas start and show "Running"
# 3. Old replicas show "Shutdown"
# 4. After ~60 seconds, all should be "Running" with new replicas

# Or one-time check
docker stack ps n8n --no-trunc
```

## Step 6: Verify Deployment Health

### Check services are running

```bash
docker stack services n8n
# All services should show 1/1 replicas: n8n_editor, n8n_webhook, n8n_worker

# Get detailed status
docker stack ps n8n --no-trunc
# All should show CURRENT STATE: Running
```

### Check logs

```bash
# Editor logs (watch for "Editor is now accessible")
docker service logs n8n_editor -f --tail 50

# Webhook logs
docker service logs n8n_webhook -f --tail 50

# Worker logs
docker service logs n8n_worker -f --tail 50

# Stop watching: Ctrl+C
```

### Test the public URLs

```bash
# From local machine (not VPS)
nslookup n8n.lsgagentesinteligentes.shop

curl -I https://n8n.lsgagentesinteligentes.shop/
# Expected: HTTP/1.1 200 OK or 302 redirect

curl -I https://hooks.lsgagentesinteligentes.shop/
# Expected: HTTP/1.1 200 OK
```

### Test in browser

1. Open `https://n8n.lsgagentesinteligentes.shop` in your browser
2. Workflows should load (same data as before)
3. Credentials should be intact
4. Try running a simple test execution

## Step 7: Monitor for Issues (Next 24 Hours)

Watch for any errors:

```bash
# Check for ERROR in logs (every 10 minutes)
docker service logs n8n_editor | grep ERROR | tail -5
docker service logs n8n_worker | grep ERROR | tail -5

# Check disk usage
df -h
docker system df

# If you see issues, check the full log
docker service logs n8n_editor -f --tail 100
```

## Rollback Plan (If Issues Occur)

### Quick rollback to official image

```bash
# Option 1: Revert to official n8nio/n8n:latest
cd ~/n8n
git checkout HEAD -- docker-compose.swarm.yml  # or edit manually

# Edit the compose file: change all image: lines to n8nio/n8n:latest
nano docker-compose.swarm.yml
# Find: image: n8n-custom:2.14.0
# Replace: image: n8nio/n8n:latest

# Redeploy
docker stack deploy -c docker-compose.swarm.yml n8n

# Monitor rollback
docker stack ps n8n --no-trunc
```

### Or: Restore from volume backup

```bash
# Stop services (scales to 0 replicas)
docker service scale n8n_editor=0 n8n_webhook=0 n8n_worker=0

# Wait 15 seconds for graceful shutdown
sleep 15

# Restore volume
docker run --rm \
  -v n8n_n8n_data:/data \
  -v /tmp:/backup \
  busybox tar xzf /backup/n8n-data-backup-YYYY-MM-DD.tar.gz -C /data

# Restart services
docker service scale n8n_editor=1 n8n_webhook=1 n8n_worker=1
```

## Verification Checklist

After deployment, confirm:

- [ ] All 3 services (editor, webhook, worker) show `1/1` replicas
- [ ] Services show `CURRENT STATE: Running`
- [ ] Browser loads `https://n8n.lsgagentesinteligentes.shop`
- [ ] Workflows and credentials are intact
- [ ] Test a simple execution (manual trigger)
- [ ] No ERROR entries in logs after 2 minutes
- [ ] Disk space is healthy (`df -h` shows >20% free)

## Troubleshooting

### Service stuck in "Preparing"

```bash
# Check why it's not starting
docker service inspect n8n_editor

# Check node status
docker node ls

# If a node is down, the service may not be able to start
# Swarm requires the placement constraint (node.role == manager)
```

### Out of disk space

```bash
# See what's using disk
docker system df

# Clean up old images
docker image prune -a -f

# Check disk again
df -h
```

### Connection refused to Traefik

```bash
# Verify Traefik is running
docker stack ps traefik

# Check Traefik logs
docker service logs traefik -f --tail 50

# Verify the DNS labels in the compose file are correct
docker service inspect n8n_editor | grep -A 20 "Labels"
```

### Database connection error

```bash
# Check if postgres_postgres stack is running
docker stack ps postgres_postgres

# Verify the connection string in n8n logs
docker service logs n8n_editor | grep -i "postgre\|database\|connection"

# Test connection from VPS
docker run --rm \
  -e PGPASSWORD=vX&3X50Cbzc\`Ps2 \
  postgres:14 \
  psql -h postgres_postgres -U postgres -d n8n -c "SELECT 1;"
```

## Next Steps

1. **Monitor for 24 hours** — watch for any errors or unexpected behavior
2. **Keep backups** — maintain at least 3 days of volume backups
3. **Document your setup** — update this guide as you make changes
4. **Test new features** — now that you're on 2.14.0, test your credential resolution warnings and strict mode
5. **Plan updates** — set a schedule for rebuilding the image when you push new code to master
