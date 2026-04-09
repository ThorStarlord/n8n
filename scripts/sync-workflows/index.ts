/**
 * index.ts — CLI entry point for the n8n workflow sync tool.
 *
 * Commands:
 *   node index.ts push [--dry-run] [--include-archive] [--dir <path>]
 *   node index.ts pull [--dry-run] [--include-archive] [--dir <path>]
 *   node index.ts diff                (alias for push --dry-run + pull --dry-run)
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

import { push } from './push.ts';
import { pull } from './pull.ts';
import type { FolderMap, SyncConfig } from './types.ts';

// ─── Config ──────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load environment variables from a .env file if present (simple parser, no deps) */
async function loadDotEnv(envPath: string): Promise<void> {
	try {
		const content = await readFile(envPath, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
			if (key && !(key in process.env)) {
				process.env[key] = value;
			}
		}
	} catch {
		// .env file is optional
	}
}

function getConfig(): SyncConfig {
	const baseUrl = process.env.N8N_BASE_URL;
	const apiKey = process.env.N8N_API_KEY;

	if (!baseUrl) {
		console.error(pc.red('✗ N8N_BASE_URL is not set. Create a .env file (see .env.example).'));
		process.exit(1);
	}
	if (!apiKey) {
		console.error(pc.red('✗ N8N_API_KEY is not set. Create a .env file (see .env.example).'));
		process.exit(1);
	}

	return {
		baseUrl,
		apiKey,
		projectId: process.env.N8N_PROJECT_ID || undefined,
	};
}

async function loadFolderMap(): Promise<FolderMap> {
	const mapPath = resolve(__dirname, 'folder-map.json');
	try {
		const raw = await readFile(mapPath, 'utf-8');
		return JSON.parse(raw) as FolderMap;
	} catch {
		console.error(pc.red(`✗ Could not read folder-map.json at ${mapPath}`));
		process.exit(1);
	}
}

// ─── CLI arg parsing ─────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
	command: string;
	dryRun: boolean;
	includeArchive: boolean;
	workflowsDir: string;
} {
	const args = argv.slice(2); // strip node + script path
	const command = args[0] ?? 'help';
	const dryRun = args.includes('--dry-run') || command === 'diff';
	const includeArchive = args.includes('--include-archive');

	const dirIdx = args.indexOf('--dir');
	const workflowsDir =
		dirIdx !== -1 && args[dirIdx + 1]
			? resolve(args[dirIdx + 1])
			: resolve(__dirname, '../../n8n_workflows');

	return { command, dryRun, includeArchive, workflowsDir };
}

function printHelp(): void {
	console.log(`
${pc.bold('n8n Workflow Sync CLI')}

${pc.bold('Usage:')}
  ${pc.cyan('pnpm sync:push')}              Push local workflows → n8n
  ${pc.cyan('pnpm sync:pull')}              Pull n8n workflows → local files
  ${pc.cyan('pnpm sync:diff')}              Preview changes (dry run, no writes)

${pc.bold('Options:')}
  ${pc.yellow('--dry-run')}                  Preview actions without making changes
  ${pc.yellow('--include-archive')}          Include the archive folder (excluded by default)
  ${pc.yellow('--dir <path>')}               Override the path to n8n_workflows/ directory

${pc.bold('Examples:')}
  pnpm sync:push --dry-run
  pnpm sync:push --include-archive
  pnpm sync:pull --dir /custom/path/to/workflows
`);
}

function printSummary(
	command: string,
	result: { created: number; updated: number; skipped: number; errors: string[] },
	dryRun: boolean,
): void {
	const prefix = dryRun ? pc.magenta('[dry run] ') : '';
	console.log(pc.bold(`\n${prefix}${command.toUpperCase()} SUMMARY`));
	console.log(`  ${pc.green('Created')} : ${result.created}`);
	console.log(`  ${pc.blue('Updated')} : ${result.updated}`);
	console.log(`  ${pc.yellow('Skipped')} : ${result.skipped}`);
	if (result.errors.length > 0) {
		console.log(`  ${pc.red('Errors')}  : ${result.errors.length}`);
		for (const err of result.errors) {
			console.log(pc.red(`    • ${err}`));
		}
	}
	console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	// Load .env from the script directory or repo root
	await loadDotEnv(resolve(__dirname, '.env'));
	await loadDotEnv(resolve(__dirname, '../../.env'));

	const { command, dryRun, includeArchive, workflowsDir } = parseArgs(process.argv);

	console.log(pc.bold(pc.white('\n🔄 n8n Workflow Sync')));
	console.log(`  Workflows dir : ${pc.cyan(workflowsDir)}`);
	if (dryRun) console.log(`  Mode          : ${pc.magenta('dry run (no changes will be made)')}`);

	switch (command) {
		case 'push': {
			const config = getConfig();
			const folderMap = await loadFolderMap();
			const result = await push(config, folderMap, { dryRun, includeArchive, workflowsDir });
			printSummary('push', result, dryRun);
			if (result.errors.length > 0) process.exit(1);
			break;
		}

		case 'pull': {
			const config = getConfig();
			const folderMap = await loadFolderMap();
			const result = await pull(config, folderMap, { dryRun, includeArchive, workflowsDir });
			printSummary('pull', result, dryRun);
			if (result.errors.length > 0) process.exit(1);
			break;
		}

		case 'diff': {
			// diff = push --dry-run
			console.log(pc.bold('\n[push diff]'));
			const config = getConfig();
			const folderMap = await loadFolderMap();
			const result = await push(config, folderMap, {
				dryRun: true,
				includeArchive,
				workflowsDir,
			});
			printSummary('diff (push)', result, true);
			break;
		}

		case 'help':
		default:
			printHelp();
			break;
	}
}

main().catch((err: unknown) => {
	console.error(pc.red(`\nFatal error: ${String(err)}`));
	process.exit(1);
});
