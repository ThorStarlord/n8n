/**
 * pull.ts — Pull workflows from n8n and save them as local .json files,
 * using folder-map.json to map n8n folder names back to local folder names.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pc from 'picocolors';

import { N8nApiClient } from './api.ts';
import type {
	FolderMap,
	N8nFolder,
	N8nWorkflow,
	PullOptions,
	SyncConfig,
	SyncResult,
} from './types.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok(msg: string): void    { console.log(`${pc.green('✓')} ${msg}`); }
function skip(msg: string): void  { console.log(`${pc.yellow('–')} ${msg}`); }
function info(msg: string): void  { console.log(`${pc.cyan('·')} ${msg}`); }
function error(msg: string): void { console.log(`${pc.red('✗')} ${msg}`); }
function dry(msg: string): void   { console.log(`${pc.magenta('[dry]')} ${msg}`); }

/** Convert a workflow name to a safe filename */
function toFileName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\-_\s]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

// ─── Core pull logic ─────────────────────────────────────────────────────────

export async function pull(
	config: SyncConfig,
	folderMap: FolderMap,
	options: PullOptions,
): Promise<SyncResult> {
	const api = new N8nApiClient(config);
	const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

	// Build reverse map: n8n name (lowercase) → local folder name
	const reverseMap = new Map<string, string>(
		Object.entries(folderMap).map(([local, n8nName]) => [n8nName.toLowerCase(), local]),
	);

	// Fetch all n8n folders
	console.log(pc.bold('\n→ Fetching n8n folders...'));
	const allFolders = await api.listFolders();
	console.log(`  Found ${pc.cyan(String(allFolders.length))} folders\n`);

	for (const folder of allFolders) {
		const localName = reverseMap.get(folder.name.toLowerCase());

		if (!localName) {
			skip(`No local mapping for folder: ${folder.name} — skipping`);
			continue;
		}

		if (!options.includeArchive && localName === 'archive') {
			skip(`Skipping archive folder (use --include-archive to include it)`);
			continue;
		}

		const localFolderPath = join(options.workflowsDir, localName);

		console.log(pc.bold(`\n📁 ${pc.white(folder.name)} → ${pc.white(localName)}/`));

		// Fetch all workflows in this folder
		const workflows = await api.listWorkflows({
			parentFolderId: folder.id,
			recursive: false,
		});

		if (workflows.length === 0) {
			skip(`No workflows in ${folder.name}`);
			continue;
		}

		info(`Found ${workflows.length} workflow(s)`);

		// Ensure local directory exists
		if (!options.dryRun) {
			await mkdir(localFolderPath, { recursive: true });
		}

		for (const workflow of workflows) {
			const fileName = `${toFileName(workflow.name)}.json`;
			const filePath = join(localFolderPath, fileName);

			if (options.dryRun) {
				dry(`Would save: ${localName}/${fileName}`);
				result.created++;
				continue;
			}

			// Check if the file already exists locally
			let existingContent: string | null = null;
			try {
				existingContent = await readFile(filePath, 'utf-8');
			} catch {
				// File doesn't exist yet — that's fine
			}

			const newContent = JSON.stringify(workflow, null, 2);

			if (existingContent === newContent) {
				skip(`Unchanged: ${localName}/${fileName}`);
				result.skipped++;
				continue;
			}

			await writeFile(filePath, newContent, 'utf-8');

			if (existingContent !== null) {
				ok(`Updated: ${localName}/${fileName}`);
				result.updated++;
			} else {
				ok(`Saved: ${localName}/${fileName}`);
				result.created++;
			}
		}
	}

	return result;
}
