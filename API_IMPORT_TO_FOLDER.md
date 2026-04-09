# API Import To Folder

## Purpose

This guide exists to help a human engineer or a new LLM chat in a different
repository use the recently added n8n folder-aware import features through the
public API.

It is intentionally written as a handoff document. A new chat session does not
remember earlier conversations, and a chat running in another repository cannot
discover this repo's implementation unless you give it the right context.

## Source Of Truth

These files define the behavior described below:

- `packages/cli/src/public-api/v1/openapi.yml`
- `packages/cli/src/public-api/v1/handlers/workflows/spec/schemas/workflow.yml`
- `packages/cli/src/commands/import/workflow.ts`

## Public API Behavior

- Public API base path: `/api/v1`
- Supported folder routes include:
  - `GET /api/v1/folders`
  - `POST /api/v1/folders`
  - `POST /api/v1/folders/import`
- Workflow creation route:
  - `POST /api/v1/workflows`
- The workflow create payload supports both:
  - `parentFolderId`
  - `parentFolderPath`
- `parentFolderPath` is a slash-delimited folder path such as `/Finance` or
  `/Finance/2026/Q1`
- `parentFolderPath` takes precedence over `parentFolderId`
- Missing intermediate folders are created automatically when
  `parentFolderPath` is used

## Important Caveats

- Public API workflow creation is tied to the API key owner's personal project
  in the current implementation
- For another repository that only needs to send workflows into a folder, the
  recommended path is `POST /api/v1/workflows` with `parentFolderPath`
- If you have server-side access and need a fallback, the CLI import command
  also supports folder targeting with:
  - `n8n import:workflow --parentFolderId`
- If the target folder is in a team project rather than the API key owner's
  personal project, do not assume `POST /api/v1/workflows` alone is enough;
  prefer the project-aware folder flows or the CLI fallback

## Payload Normalization

Do not blindly post raw exported workflow JSON to `POST /api/v1/workflows`.

Exported workflows often contain extra fields that are read-only, internal, or
not part of the create payload. Normalize each workflow first.

Send only these fields:

- `name`
- `nodes`
- `connections`
- `settings`
- optional `staticData`
- optional `pinData`
- `parentFolderPath`

Typical fields to strip before calling the API include:

- `id`
- `active`
- `versionId`
- `createdAt`
- `updatedAt`
- `isArchived`
- `triggerCount`
- `tags`
- `shared`
- `meta`
- `activeVersion`

If `settings` is missing in the export, default it to `{}` before sending the
request.

## Verification Before Use

Before relying on this feature in a live instance, verify that the deployment
actually exposes the current public API shape.

1. Call `GET /api/v1/openapi.yml`
2. Confirm the returned spec contains `/folders`
3. Confirm the workflow schema or spec text contains `parentFolderPath`
4. If either is missing, treat the deployment as outdated

If `/folders` or `parentFolderPath` is missing from the live OpenAPI spec, the
instance has not been rebuilt or redeployed from the repo version that contains
this feature.

PowerShell verification example:

```powershell
$spec = (Invoke-WebRequest -Uri "https://MY_N8N_HOST/api/v1/openapi.yml" -Method Get).Content

if ($spec -notmatch "/folders" -or $spec -notmatch "parentFolderPath") {
	throw "Live instance is missing the folder-aware import API surface. Rebuild/redeploy the target n8n instance first."
}
```

## Usage Examples

### Minimal JSON Payload

```json
{
  "name": "Imported Workflow",
  "nodes": [],
  "connections": {},
  "settings": {},
  "parentFolderPath": "/Finance"
}
```

### Single Workflow Import From PowerShell

Use placeholders only:

- `MY_N8N_HOST`
- `N8N_API_KEY`
- `TARGET_FOLDER_PATH`

```powershell
$headers = @{
	"X-N8N-API-KEY" = $env:N8N_API_KEY
	"Content-Type" = "application/json"
}

$targetFolderPath = "TARGET_FOLDER_PATH" # Recommended default: /Finance

$body = @{
	name = "Imported Workflow"
	nodes = @()
	connections = @{}
	settings = @{}
	parentFolderPath = $targetFolderPath
} | ConvertTo-Json -Depth 100

Invoke-RestMethod `
	-Uri "https://MY_N8N_HOST/api/v1/workflows" `
	-Method Post `
	-Headers $headers `
	-Body $body
```

### Batch Import Pattern For Exported Workflow Files

This pattern assumes:

- The source repository contains standard n8n export JSON files
- A file may contain either one workflow object or an array of workflows
- Each workflow is normalized before it is posted

Placeholders used below:

- `WORKFLOW_DIRECTORY`
- `TARGET_FOLDER_PATH`
- `MY_N8N_HOST`
- `N8N_API_KEY`

```powershell
$headers = @{
	"X-N8N-API-KEY" = $env:N8N_API_KEY
	"Content-Type" = "application/json"
}

$workflowDirectory = "WORKFLOW_DIRECTORY"
$targetFolderPath = "TARGET_FOLDER_PATH" # Recommended default: /Finance
$uri = "https://MY_N8N_HOST/api/v1/workflows"

Get-ChildItem $workflowDirectory -Filter *.json | ForEach-Object {
	$raw = Get-Content $_.FullName -Raw | ConvertFrom-Json
	$items = @($raw)

	foreach ($wf in $items) {
		$payload = @{
			name = $wf.name
			nodes = $wf.nodes
			connections = $wf.connections
			settings = $(if ($null -ne $wf.settings) { $wf.settings } else { @{} })
			parentFolderPath = $targetFolderPath
		}

		if ($null -ne $wf.staticData) {
			$payload.staticData = $wf.staticData
		}

		if ($null -ne $wf.pinData) {
			$payload.pinData = $wf.pinData
		}

		Invoke-RestMethod `
			-Uri $uri `
			-Method Post `
			-Headers $headers `
			-Body ($payload | ConvertTo-Json -Depth 100)
	}
}
```

## Failure Modes And Troubleshooting

- `404` on `GET /api/v1/folders`
  - The live instance does not expose the route
  - Most likely cause: the deployment is running an older build or an image that
    was not rebuilt from this repo state
- `404` when creating a workflow with an invalid `parentFolderId`
  - The folder does not exist in the target project context
- Missing `parentFolderPath` in `GET /api/v1/openapi.yml`
  - The deployment is outdated relative to the repo
- Validation errors when posting exported workflows
  - The payload was not normalized
  - Remove read-only or export-only fields and send only the accepted
    workflow-create fields
- Workflows land in the wrong project
  - Remember that public API workflow creation currently resolves the API key
    owner's personal project in this implementation

## Recommended Default For Other Repositories

If another repository only needs to import workflows into a folder on an n8n
instance that already supports this feature, prefer this flow:

1. Verify `GET /api/v1/openapi.yml`
2. Normalize exported workflow JSON
3. Use `POST /api/v1/workflows`
4. Set `parentFolderPath` to the target path, such as `/Finance`

This avoids the need to discover folder IDs first and keeps the integration
simple.

## Copy/Paste Handoff

Paste the block below into a new chat in another repository:

```text
I need to use a recent n8n public API feature from another repository.

Assume the target n8n implementation supports:
- public API base path `/api/v1`
- `GET /api/v1/folders`
- `POST /api/v1/folders`
- `POST /api/v1/folders/import`
- `POST /api/v1/workflows` with `parentFolderId` and `parentFolderPath`

Important behavior:
- `parentFolderPath` takes precedence over `parentFolderId`
- `parentFolderPath` is slash-delimited, for example `/Finance` or `/Finance/2026/Q1`
- missing intermediate folders are created automatically when using `parentFolderPath`
- exported workflow JSON must be normalized before POSTing
- only send `name`, `nodes`, `connections`, `settings`, optional `staticData`, optional `pinData`, and `parentFolderPath`
- before using the feature against a live instance, verify `GET /api/v1/openapi.yml` contains `/folders` and `parentFolderPath`; otherwise the deployment is outdated

Help me build an importer in this repository that sends workflows to `/Finance`.
```
