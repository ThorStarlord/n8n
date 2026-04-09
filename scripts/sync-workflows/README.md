# n8n Workflow Sync CLI

Sync local `.json` workflow files into your n8n instance (and back), using the n8n Public API.

## Setup

### 1. Get an API key

In your n8n instance: **Settings → API → Create API Key**

### 2. Create a `.env` file

```bash
cp scripts/sync-workflows/.env.example .env
# Then edit .env with your values:
#   N8N_BASE_URL=http://your-n8n-instance:5678
#   N8N_API_KEY=your-api-key
```

The `.env` file can live in the repo root **or** in `scripts/sync-workflows/`.

### 3. Install dependencies

```bash
cd scripts/sync-workflows && pnpm install
```

Or from the repo root:
```bash
pnpm install
```

---

## Usage

Run from the repo root:

```bash
# Preview what would be pushed (no changes made)
pnpm sync:push --dry-run

# Push local workflows → n8n
pnpm sync:push

# Push including the archive folder (excluded by default)
pnpm sync:push --include-archive

# Pull n8n workflows → local files
pnpm sync:pull

# Show what would change (push dry-run)
pnpm sync:diff
```

---

## Folder Mapping

Edit `scripts/sync-workflows/folder-map.json` to map your local folder names to n8n folder display names:

```json
{
  "shared-workers": "00 - Shared Workers",
  "01-factory-marketing-proactive": "01 - Fábrica de Marketing Proativo",
  "02-factory-viral": "02 - Fabrica de Conteudo Viral",
  "4-utilities": "4-utilities",
  "archive": "99 - Archive"
}
```

- **Key** = local subdirectory name inside `n8n_workflows/`
- **Value** = n8n folder display name (will be created if it doesn't exist)

---

## Push Behaviour

| Situation | Action |
|---|---|
| Workflow JSON has an `id` that exists in n8n | **Update** existing workflow |
| Workflow JSON has no `id`, name matches n8n | **Update** existing workflow |
| No match found | **Create** new workflow |
| n8n folder doesn't exist | **Create** folder (upsert) |
| Archive folder | **Skipped** unless `--include-archive` |

---

## Pull Behaviour

| Situation | Action |
|---|---|
| Workflow exists locally, same content | **Skip** |
| Workflow exists locally, different content | **Overwrite** |
| Workflow doesn't exist locally | **Save** new file |
| n8n folder has no mapping in folder-map.json | **Skip** |

---

## Workflow File Format

Files should be standard n8n workflow JSON exports. The simplest valid file:

```json
{
  "name": "My Workflow",
  "nodes": [],
  "connections": {},
  "settings": {}
}
```

Exported workflows from n8n already include all required fields.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `N8N_BASE_URL` | ✅ | Base URL of your n8n instance, e.g. `http://localhost:5678` |
| `N8N_API_KEY` | ✅ | API key from n8n Settings → API |
| `N8N_PROJECT_ID` | Optional | Scope to a specific project (leave blank for personal project) |
