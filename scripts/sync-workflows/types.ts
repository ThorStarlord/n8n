/**
 * Shared types for the n8n workflow sync CLI.
 */

export interface N8nWorkflow {
	id?: string;
	name: string;
	active?: boolean;
	nodes: unknown[];
	connections: Record<string, unknown>;
	settings: Record<string, unknown>;
	staticData?: unknown;
	pinData?: Record<string, unknown>;
	tags?: Array<{ id?: string; name: string }>;
	parentFolderId?: string | null;
	parentFolderPath?: string | null;
	[key: string]: unknown;
}

export interface N8nFolder {
	id: string;
	name: string;
	parentFolderId?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface N8nListResponse<T> {
	data: T[];
	nextCursor: string | null;
}

export interface SyncConfig {
	baseUrl: string;
	apiKey: string;
	projectId?: string;
}

export interface FolderMap {
	[localFolderName: string]: string;
}

export interface SyncResult {
	created: number;
	updated: number;
	skipped: number;
	errors: string[];
}

export interface PushOptions {
	dryRun: boolean;
	includeArchive: boolean;
	workflowsDir: string;
}

export interface PullOptions {
	dryRun: boolean;
	includeArchive: boolean;
	workflowsDir: string;
}
