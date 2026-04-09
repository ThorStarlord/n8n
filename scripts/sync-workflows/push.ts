/**
 * push.ts — Push local workflow JSON files into n8n, mapping local folder
 * names to n8n folder names via folder-map.json.
 *
 * Strategy:
 *  - For each local folder in folder-map.json:
 *      1. Upsert the n8n folder (create if missing, reuse if exists)
 *      2. For each *.json file in the local folder:
 *          - If the JSON has an `id` → try to find it in n8n and update it
 *          - Otherwise → match by name; update if found, create if not
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import pc from 'picocolors';

import { N8nApiClient } from './api.ts';
import type {
	FolderMap,
	N8nFolder,
	N8nWorkflow,
	PushOptions,
	SyncConfig,
	SyncResult,
} from './types.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(symbol: string, message: string): void {
	console.log(`${symbol} ${message}`);
}

function ok(msg: string): void    { log(pc.green('✓'), msg); }
function skip(msg: string): void  { log(pc.yellow('–'), msg); }
function info(msg: string): void  { log(pc.cyan('·'), msg); }
function error(msg: string): void { log(pc.red('✗'), msg); }
function dry(msg: string): void   { log(pc.magenta('[dry]'), msg); }

async function readWorkflowFile(filePath: string): Promise<N8nWorkflow | null> {
	try {
		const raw = await readFile(filePath, 'utf-8');
		return JSON.parse(raw) as N8nWorkflow;
	} catch (err) {
		error(`Failed to parse ${filePath}: ${String(err)}`);
		return null;
	}
}

// ─── Core push logic ─────────────────────────────────────────────────────────

export async function push(
	config: SyncConfig,
	folderMap: FolderMap,
	options: PushOptions,
): Promise<SyncResult> {
	const api = new N8nApiClient(config);
	const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

	// Pre-fetch all existing n8n folders once (avoid repeated API calls)
	console.log(pc.bold('\n→ Fetching existing n8n folders...'));
	const existingFolders = await api.listFolders();
	const folderByName = new Map<string, N8nFolder>(
		existingFolders.map((f) => [f.name.toLowerCase(), f]),
	);
	const folderById = new Map<string, N8nFolder>(
		existingFolders.map((f) => [f.id, f]),
	);

	// Pre-fetch all existing n8n workflows once
	console.log(pc.bold('→ Fetching existing n8n workflows...'));
	const existingWorkflows = await api.listWorkflows({ recursive: true });
	const workflowById = new Map<string, N8nWorkflow>(
		existingWorkflows.filter((w) => w.id).map((w) => [w.id!, w]),
	);
	const workflowByName = new Map<string, N8nWorkflow>(
		existingWorkflows.map((w) => [w.name.toLowerCase(), w]),
	);

	console.log(
		`  Found ${pc.cyan(String(existingFolders.length))} folders, ` +
		`${pc.cyan(String(existingWorkflows.length))} workflows in n8n\n`,
	);

	// ─── Process each entry in folder-map.json ────────────────────────────────
	for (const [localName, n8nName] of Object.entries(folderMap)) {
		if (!options.includeArchive && localName === 'archive') {
			skip(`Skipping archive folder (use --include-archive to include it)`);
			continue;
		}

		const localFolderPath = join(options.workflowsDir, localName);

		// List .json files in this local folder
		let files: string[];
		try {
			const entries = await readdir(localFolderPath, { withFileTypes: true });
			files = entries
				.filter((e) => e.isFile() && extname(e.name) === '.json')
				.map((e) => e.name);
		} catch {
			skip(`Local folder not found, skipping: ${localFolderPath}`);
			continue;
		}

		if (files.length === 0) {
			skip(`No .json files in ${localName}/`);
			continue;
		}

		console.log(pc.bold(`\n📁 ${pc.white(localName)} → ${pc.white(n8nName)} (${files.length} file${files.length === 1 ? '' : 's'})`));

		// ── Upsert n8n folder ─────────────────────────────────────────────────
		let n8nFolder: N8nFolder;
		const existingFolder = folderByName.get(n8nName.toLowerCase());

		if (existingFolder) {
			info(`Folder exists: ${n8nName} (id: ${existingFolder.id})`);
			n8nFolder = existingFolder;
		} else if (options.dryRun) {
			dry(`Would create folder: ${n8nName}`);
			// Use a placeholder so the rest of the dry-run can continue
			n8nFolder = { id: `<new:${n8nName}>`, name: n8nName, createdAt: '', updatedAt: '' };
		} else {
			info(`Creating folder: ${n8nName}`);
			n8nFolder = await api.createFolder(n8nName);
			folderByName.set(n8nName.toLowerCase(), n8nFolder);
			folderById.set(n8nFolder.id, n8nFolder);
			ok(`Created folder: ${n8nName} (id: ${n8nFolder.id})`);
		}

		// ── Process each workflow file ────────────────────────────────────────
		for (const fileName of files) {
			const filePath = join(localFolderPath, fileName);
			const workflow = await readWorkflowFile(filePath);

			if (!workflow) {
				result.errors.push(`Failed to read: ${filePath}`);
				continue;
			}

			const workflowName = workflow.name ?? basename(fileName, '.json');

			// Determine if this workflow already exists in n8n
			const existingById = workflow.id ? workflowById.get(workflow.id) : undefined;
			const existingByName = workflowByName.get(workflowName.toLowerCase());
			const existing = existingById ?? existingByName;

			// Build the payload: strip readOnly fields, set folder
			const payload: N8nWorkflow = {
				...workflow,
				name: workflowName,
				parentFolderId: n8nFolder.id.startsWith('<new:') ? undefined : n8nFolder.id,
			};
			// Remove read-only fields that the API rejects on write
			delete payload.active;
			delete payload.createdAt;
			delete payload.updatedAt;
			delete payload.versionId;
			delete payload.triggerCount;
			delete payload.isArchived;
			delete payload.meta;
			delete payload.tags;
			delete payload.shared;
			delete payload.activeVersion;

			if (existing?.id) {
				// ── Update existing workflow ────────────────────────────────────
				if (options.dryRun) {
					dry(`Would update: ${workflowName} (id: ${existing.id})`);
					result.updated++;
				} else {
					try {
						await api.updateWorkflow(existing.id, { ...payload, id: existing.id });
						ok(`Updated: ${workflowName} (id: ${existing.id})`);
						result.updated++;
					} catch (err) {
						const msg = `Failed to update ${workflowName}: ${String(err)}`;
						error(msg);
						result.errors.push(msg);
					}
				}
			} else {
				// ── Create new workflow ─────────────────────────────────────────
				if (options.dryRun) {
					dry(`Would create: ${workflowName}`);
					result.created++;
				} else {
					try {
						const created = await api.createWorkflow(payload);
						ok(`Created: ${workflowName} (id: ${created.id})`);
						result.created++;
						// Register in maps so subsequent files don't double-create
						if (created.id) {
							workflowById.set(created.id, created);
							workflowByName.set(workflowName.toLowerCase(), created);
						}
					} catch (err) {
						const msg = `Failed to create ${workflowName}: ${String(err)}`;
						error(msg);
						result.errors.push(msg);
					}
				}
			}
		}
	}

	return result;
}
