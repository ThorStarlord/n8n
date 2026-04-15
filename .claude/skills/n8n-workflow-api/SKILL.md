---
name: n8n-workflow-api
description: >-
  Interact with the n8n public REST API to create, import, list, or manage
  workflows programmatically. Use when writing scripts or tools that call
  /api/v1/workflows, /api/v1/folders, or handle credential IDs across
  instances. Also use when the user says /api or /import-workflows.
---

# n8n Public REST API

Base URL: `https://<instance>/api/v1/`  
Auth header: `X-N8N-API-KEY: <key>`

Keys are generated in n8n UI → Settings → API.

---

## Workflows

### List

```
GET /api/v1/workflows?limit=10&cursor=<nextCursor>
```

Response shape:
```json
{ "data": [...], "nextCursor": "eyJsaW1pdC..." }
```

Paginate by passing `nextCursor` as the `cursor` query param. When `nextCursor`
is `null` you have reached the end.

### Get one

```
GET /api/v1/workflows/:id
```

### Create

```
POST /api/v1/workflows
Content-Type: application/json

{
  "name": "My Workflow",
  "nodes": [...],
  "connections": {...},
  "settings": { "executionOrder": "v1" },
  "staticData": null
}
```

Returns the saved workflow with its assigned `id`.

### Create in a folder (Enterprise)

Add `"parentFolderId": "<folderId>"` to the request body, **or** use the
folder-scoped import endpoint:

```
POST /api/v1/folders/:folderId/workflows/import
```

### Import (bulk, preserves IDs)

```
POST /api/v1/workflows/import
```

Body: a workflow export JSON object (same shape as `GET /api/v1/workflows/:id`).

---

## Folders

### List

```
GET /api/v1/folders?projectId=<id>
```

### Get sub-folders

```
GET /api/v1/folders/:folderId/sub-folders
```

---

## Credential IDs — the key caveat

Credential IDs (`"id": "YBYz8b7uRC6gZf8M"`) are **instance-local**.  
Importing a workflow to a different instance will silently keep the old ID,
which won't match anything — the node will show "credential not found".

Handling options (in order of preference):

1. **`replaceInvalidCredentials: true`** on `POST /api/v1/workflows` — the
   server strips broken credential references instead of erroring.
2. Strip `credentials` from all nodes before importing:
   ```js
   node.credentials = {};
   ```
3. Map old IDs → new IDs using `GET /api/v1/credentials` on the target
   instance before importing.

---

## Minimal script pattern (Node.js)

```js
const BASE = 'https://my-instance.example.com/api/v1';
const KEY  = process.env.N8N_API_KEY;

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json',
                ...opts.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

// Create a workflow
const created = await apiFetch('/workflows', {
  method: 'POST',
  body: JSON.stringify(workflowObject),
});
console.log(`Created: ${created.id}`);
```

---

## Warnings endpoint (strict mode)

`POST /api/v1/workflows` and `PUT /api/v1/workflows/:id` can return a
`warnings` array alongside the saved workflow when credentials are invalid:

```json
{
  "id": "abc123",
  "name": "...",
  "warnings": [
    { "type": "CREDENTIAL_NOT_FOUND", "node": "HTTP Request", "credentialId": "xyz" }
  ]
}
```

Check for `warnings` in scripts so callers know which nodes need re-credentialing.
