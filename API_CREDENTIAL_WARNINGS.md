# API Credential Resolution Warnings

## Purpose

This document covers two related n8n features added in the same session as the
folder-aware import work described in `API_IMPORT_TO_FOLDER.md`.  Together,
these two documents contain everything a new LLM session needs to write CI
scripts that import workflows reliably.

1. **Credential resolution warnings** — the API now reports when a workflow
   references credentials that cannot be matched to a known credential in the
   target instance, rather than silently saving broken data.
2. **Strict mode** — an optional query flag that makes the API reject the import
   entirely (HTTP 422) when unresolvable credentials are found, instead of
   saving and warning.

---

## Affected Endpoints

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/v1/workflows` | Now accepts `?strict=true/false`; 200 body may include warnings; 422 possible |
| `PUT`  | `/api/v1/workflows/{id}` | Same as above |
| `PATCH` | `/rest/workflows/{id}` | Same (internal API) |
| `POST` | `/rest/workflows` | Same (internal API) |

Source-control pull (`/rest/source-control/pull`) now also resolves credentials
during import and returns warnings per workflow in its result array.

---

## Query Parameter: `strict`

```
?strict=true   →  return HTTP 422 if any credential reference cannot be resolved
?strict=false  →  (default) save the workflow and return warnings in the 200 body
```

`strict` is evaluated before the workflow is persisted.  When `strict=true` and
any warning would have been generated, the workflow is **not** saved.

---

## Successful Import Response (HTTP 200)

The response body extends the normal workflow object with an optional
`credentialResolutionWarnings` field.

```json
{
  "id": "abc123",
  "name": "My Workflow",
  "nodes": [...],
  "connections": {...},
  "settings": {},
  "credentialResolutionWarnings": [
    {
      "nodeName": "HTTP Request",
      "credentialType": "httpBasicAuth",
      "attemptedId": "old-id-456",
      "attemptedName": "Prod HTTP Auth",
      "reason": "not_found"
    }
  ]
}
```

`credentialResolutionWarnings` is omitted entirely when all credentials resolved
successfully.

---

## Warning Object Schema

| Field | Type | Always present | Description |
|-------|------|----------------|-------------|
| `nodeName` | string | yes | Display name of the node with the broken reference |
| `credentialType` | string | yes | Credential type string, e.g. `httpBasicAuth` |
| `attemptedId` | string \| null | no | Credential ID from the imported JSON (may be null) |
| `attemptedName` | string \| null | no | Credential name from the imported JSON (may be null) |
| `reason` | enum | yes | `not_found` or `ambiguous_name` |

### Reasons

- **`not_found`** — no credential with that ID or name exists in the target
  project.
- **`ambiguous_name`** — multiple credentials share the same name and type;
  name-based resolution is not attempted when this ambiguity exists.

---

## Strict Mode Error Response (HTTP 422)

```json
{
  "message": "Workflow contains credential references that could not be resolved.",
  "credentialResolutionWarnings": [
    {
      "nodeName": "HTTP Request",
      "credentialType": "httpBasicAuth",
      "attemptedId": "old-id-456",
      "attemptedName": "Prod HTTP Auth",
      "reason": "not_found"
    }
  ]
}
```

The workflow is **not** saved when a 422 is returned.

---

## How Credentials Are Resolved

Resolution is attempted in this order for each credential reference in each
node:

1. **By ID** — look up the credential by the `id` field in the project.
2. **By name + type** — if the ID lookup fails, search for credentials in the
   project matching both `name` and `type`.  This succeeds only when exactly
   one match exists.

If both lookups fail, a warning is generated with `reason: not_found`.
If the name lookup returns more than one match, a warning is generated with
`reason: ambiguous_name` and the original (non-matching) ID is left in place.

---

## CI Script Recommendations

### Soft mode — import and audit, never block the pipeline

Use the default (`strict` omitted) and inspect the response.  Log any warnings
to the CI output for human review, but do not fail the step.

```powershell
$headers = @{
    "X-N8N-API-KEY" = $env:N8N_API_KEY
    "Content-Type"  = "application/json"
}

$payload = @{
    name             = $wf.name
    nodes            = $wf.nodes
    connections      = $wf.connections
    settings         = $(if ($null -ne $wf.settings) { $wf.settings } else { @{} })
    parentFolderPath = $env:TARGET_FOLDER_PATH
} | ConvertTo-Json -Depth 100

$response = Invoke-RestMethod `
    -Uri "https://$env:N8N_HOST/api/v1/workflows" `
    -Method Post `
    -Headers $headers `
    -Body $payload

if ($response.credentialResolutionWarnings) {
    Write-Warning "[$($response.name)] Imported with unresolved credentials:"
    foreach ($w in $response.credentialResolutionWarnings) {
        Write-Warning "  Node '$($w.nodeName)' ($($w.credentialType)): $($w.reason)"
    }
}
```

### Strict mode — fail the pipeline on any unresolved credential

Pass `?strict=true` and treat a 422 as a pipeline failure.

```powershell
try {
    $response = Invoke-RestMethod `
        -Uri "https://$env:N8N_HOST/api/v1/workflows?strict=true" `
        -Method Post `
        -Headers $headers `
        -Body $payload
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    if ($status -eq 422) {
        $body = $_ | ConvertFrom-Json -ErrorAction SilentlyContinue
        Write-Error "Import failed: unresolved credentials in '$($wf.name)'"
        foreach ($w in $body.credentialResolutionWarnings) {
            Write-Error "  Node '$($w.nodeName)' ($($w.credentialType)): $($w.reason)"
        }
        exit 1
    }
    throw
}
```

### Batch import with per-file warning aggregation

```powershell
$failedWorkflows = [System.Collections.Generic.List[string]]::new()

Get-ChildItem $env:WORKFLOW_DIRECTORY -Filter *.json | ForEach-Object {
    $raw = Get-Content $_.FullName -Raw | ConvertFrom-Json
    $items = @($raw)   # handle single object or array

    foreach ($wf in $items) {
        $payload = @{
            name             = $wf.name
            nodes            = $wf.nodes
            connections      = $wf.connections
            settings         = $(if ($null -ne $wf.settings) { $wf.settings } else { @{} })
            parentFolderPath = $env:TARGET_FOLDER_PATH
        }
        if ($null -ne $wf.staticData) { $payload.staticData = $wf.staticData }
        if ($null -ne $wf.pinData)    { $payload.pinData    = $wf.pinData    }

        try {
            $response = Invoke-RestMethod `
                -Uri "https://$env:N8N_HOST/api/v1/workflows" `
                -Method Post `
                -Headers $headers `
                -Body ($payload | ConvertTo-Json -Depth 100)

            if ($response.credentialResolutionWarnings) {
                Write-Warning "[$($wf.name)] $($response.credentialResolutionWarnings.Count) unresolved credential(s)"
                $failedWorkflows.Add($wf.name)
            } else {
                Write-Host "[$($wf.name)] imported OK"
            }
        } catch {
            Write-Error "[$($wf.name)] HTTP error: $($_.Exception.Message)"
            $failedWorkflows.Add($wf.name)
        }
    }
}

if ($failedWorkflows.Count -gt 0) {
    Write-Warning "Workflows with credential issues: $($failedWorkflows -join ', ')"
    # Set exit code to non-zero if you want to fail the pipeline:
    # exit 1
}
```

---

## Environment Variables Expected By Scripts Above

| Variable | Description | Example |
|----------|-------------|---------|
| `N8N_API_KEY` | API key for the target instance | `n8n_api_...` |
| `N8N_HOST` | Hostname (no trailing slash, no `/api` prefix) | `n8n.mycompany.com` |
| `TARGET_FOLDER_PATH` | Destination folder path in n8n | `/CI/Production` |
| `WORKFLOW_DIRECTORY` | Local directory containing `.json` export files | `./workflows` |

---

## Feature Detection

Before running a CI import against a live instance, confirm it supports this
feature:

```powershell
$spec = (Invoke-WebRequest -Uri "https://$env:N8N_HOST/api/v1/openapi.yml").Content

if ($spec -notmatch "credentialResolutionWarnings") {
    Write-Warning "Live instance does not expose credential resolution warnings. Rebuild/redeploy first."
}
if ($spec -notmatch "strict") {
    Write-Warning "Live instance does not support strict mode. Rebuild/redeploy first."
}
```

---

## Interaction With Source-Control Pull

When workflows are pulled via source-control, the same credential resolution
runs automatically.  The pull response body includes a `workflows` array where
each item may have a `credentialResolutionWarnings` field using the same schema
as the API responses above.

```json
{
  "workflows": [
    {
      "id": "abc123",
      "name": "My Workflow",
      "credentialResolutionWarnings": [
        {
          "nodeName": "Postgres",
          "credentialType": "postgres",
          "attemptedId": null,
          "attemptedName": "Prod DB",
          "reason": "ambiguous_name"
        }
      ]
    }
  ]
}
```

There is no `strict` parameter for source-control pull — it always saves and
warns.

---

## Combined Handoff Block

Paste the following into a new chat in another repository when you need it to
write CI workflow-import scripts:

```text
I need to write CI scripts that import n8n workflow JSON files into a running
n8n instance using the public API.

## Folder-aware import
- Public API base path: /api/v1
- POST /api/v1/workflows creates a workflow
- The payload supports `parentFolderPath` (slash-delimited, e.g. /CI/Production)
  which takes precedence over `parentFolderId`
- Missing intermediate folders are created automatically
- Exported workflow JSON must be normalized before posting — send only:
  name, nodes, connections, settings, optional staticData, optional pinData,
  and parentFolderPath
- Strip: id, active, versionId, createdAt, updatedAt, isArchived, triggerCount,
  tags, shared, meta, activeVersion

## Credential resolution warnings
- POST /api/v1/workflows and PUT /api/v1/workflows/{id} both support ?strict=
- ?strict=true  → HTTP 422 if any credential reference cannot be resolved; workflow is NOT saved
- ?strict=false → (default) workflow is saved; unresolved credentials reported in response body
- 200 response body adds `credentialResolutionWarnings` array (omitted when everything resolved)
- 422 response body: { message: string, credentialResolutionWarnings: [...] }
- Each warning: { nodeName, credentialType, attemptedId, attemptedName, reason }
- reason values: "not_found" | "ambiguous_name"

## CI patterns
- Soft mode: import with default strict, log warnings, do not fail the pipeline
- Strict mode: import with ?strict=true, treat 422 as pipeline failure with diagnostic output
- Batch: iterate JSON files, normalize each, post, aggregate warnings

## Feature detection
- GET /api/v1/openapi.yml and check for "credentialResolutionWarnings" and "strict"
  to confirm the deployment is current before running imports

## Authentication
- Header: X-N8N-API-KEY: <api key>

Help me implement a PowerShell CI script that imports all .json files from a
workflows directory into the /CI/Production folder, fails on strict credential
errors, and prints a summary of any warnings.
```
