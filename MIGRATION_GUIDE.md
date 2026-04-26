# Migration Guide — Old n8n → New n8n

Use this document as context when updating any repository or integration that
previously connected to the old n8n instance.

---

## Quick Reference

| | Old (decommissioned) | New (active) |
|---|---|---|
| **Editor UI** | `https://teste.agentedenegocios.shop/` | `https://n8n.lsgagentesinteligentes.shop/` |
| **Webhooks base** | `https://teste.agentedenegocios.shop/webhook/` | `https://hooks.lsgagentesinteligentes.shop/webhook/` |
| **VPS IP** | `31.97.16.118` | `76.13.230.200` |
| **n8n version** | (previous) | `2.14.0` (custom build) |
| **Execution mode** | (previous) | `queue` (Redis + workers) |

---

## What Changed

- The n8n instance moved to a new VPS (`76.13.230.200`) running Docker Swarm.
- The editor and webhooks now run on separate subdomains:
  - **Editor**: `n8n.lsgagentesinteligentes.shop` — for accessing the UI, API, and credentials.
  - **Webhooks**: `hooks.lsgagentesinteligentes.shop` — for all inbound webhook calls from external services.
- DNS is proxied through Cloudflare (orange cloud). Actual origin is `76.13.230.200`.
- TLS is handled by Traefik (Let's Encrypt).
- Backend database is PostgreSQL (not SQLite).
- Queue mode is active: jobs are processed by dedicated worker containers.

---

## Migration Checklist

### 1 — Update hardcoded URLs in your codebase

Search your repository for the old domain and replace:

```bash
# Find all occurrences (Linux/macOS)
grep -r "teste.agentedenegocios.shop" .

# Windows PowerShell
Get-ChildItem -Recurse -File | Select-String "teste.agentedenegocios.shop"
```

Replace every occurrence:

| Old value | New value |
|---|---|
| `https://teste.agentedenegocios.shop` | `https://n8n.lsgagentesinteligentes.shop` |
| `https://teste.agentedenegocios.shop/webhook/` | `https://hooks.lsgagentesinteligentes.shop/webhook/` |

---

### 2 — Update environment variables / `.env` files

Look for variables like `N8N_BASE_URL`, `N8N_URL`, `WEBHOOK_URL`,
`N8N_HOST`, or any custom variable that holds the n8n address.

```env
# Old
N8N_BASE_URL=https://teste.agentedenegocios.shop
WEBHOOK_URL=https://teste.agentedenegocios.shop/webhook/

# New
N8N_BASE_URL=https://n8n.lsgagentesinteligentes.shop
WEBHOOK_URL=https://hooks.lsgagentesinteligentes.shop/webhook/
```

---

### 3 — Update API calls

If your code calls the n8n REST API directly:

```js
// Old
const N8N_API = 'https://teste.agentedenegocios.shop/api/v1';

// New
const N8N_API = 'https://n8n.lsgagentesinteligentes.shop/api/v1';
```

API key / auth token may also have changed — generate a new one from:
**n8n UI → Settings → API → Create new API key**

---

### 4 — Update webhook URLs in external services

Any external platform (WhatsApp Business, Evolution API, Chatwoot, Typebot,
Make, Zapier, etc.) that sends requests to the old webhook URL must be updated.

The webhook path stays the same — only the base domain changes:

```
# Old pattern
https://teste.agentedenegocios.shop/webhook/<your-webhook-id>

# New pattern
https://hooks.lsgagentesinteligentes.shop/webhook/<your-webhook-id>
```

To find the exact new webhook URL for each workflow:
1. Open `https://n8n.lsgagentesinteligentes.shop`
2. Open the workflow → click the Webhook node
3. Copy the **Production URL** shown in the node panel

---

### 5 — Re-test all active workflows

After updating URLs:

1. Trigger a test call to each webhook endpoint and confirm `200 OK`.
2. Check the n8n execution log: **n8n UI → Executions** — look for successes.
3. For scheduled workflows, verify the next scheduled run fires correctly.

---

## API Authentication

If you use n8n's REST API with an API key:

1. Log into `https://n8n.lsgagentesinteligentes.shop`
2. Go to **Settings → n8n API**
3. Create a new API key (old keys from the previous instance are not valid)
4. Update the key in your `.env` or secrets manager

Example header:

```http
X-N8N-API-KEY: <your-new-api-key>
```

---

## Verifying Connectivity

```bash
# Editor is up
curl -I https://n8n.lsgagentesinteligentes.shop/
# Expected: HTTP/1.1 200 OK

# Webhooks are up (root 404 is normal — use a real webhook path to test)
curl -I https://hooks.lsgagentesinteligentes.shop/
# Expected: HTTP/1.1 404 (correct — no route at root)

# Test a specific webhook
curl -X POST https://hooks.lsgagentesinteligentes.shop/webhook/<your-webhook-id> \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## SSH Access to New VPS

```bash
ssh root@76.13.230.200
```

Check stack health after connecting:

```bash
docker stack services n8n
# Expected: editor, webhook, worker, redis all at 1/1
```

---

## Architecture Overview (New Stack)

```
Internet
   │
   ▼
Cloudflare (proxy)
   │
   ▼
VPS 76.13.230.200
   │
Traefik (TLS termination, Let's Encrypt)
   ├── n8n.lsgagentesinteligentes.shop  → n8n_editor:5678
   └── hooks.lsgagentesinteligentes.shop → n8n_webhook:5678

Docker Swarm services:
  n8n_editor   — serves the UI and REST API
  n8n_webhook  — handles inbound webhook requests
  n8n_worker   — processes queued executions (concurrency=2)
  n8n_redis    — job queue (Bull)

External:
  PostgreSQL   — persistent workflow/credential storage (postgres_postgres stack)
```
