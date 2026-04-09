/**
 * Typed HTTP client for the n8n Public API v1.
 * Wraps fetch with auth headers and base URL handling.
 */

import type {
	N8nFolder,
	N8nListResponse,
	N8nWorkflow,
	SyncConfig,
} from './types.ts';

export class N8nApiClient {
	private readonly baseUrl: string;
	private readonly headers: Record<string, string>;
	private readonly projectId: string | undefined;

	constructor(config: SyncConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, '');
		this.projectId = config.projectId;
		this.headers = {
			'X-N8N-API-KEY': config.apiKey,
			'Content-Type': 'application/json',
		};
	}

	private url(path: string, params: Record<string, string> = {}): string {
		const url = new URL(`${this.baseUrl}/api/v1${path}`);
		for (const [k, v] of Object.entries(params)) {
			if (v) url.searchParams.set(k, v);
		}
		return url.toString();
	}

	private async request<T>(
		method: string,
		path: string,
		params: Record<string, string> = {},
		body?: unknown,
	): Promise<T> {
		const response = await fetch(this.url(path, params), {
			method,
			headers: this.headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			throw new Error(`n8n API ${method} ${path} failed (${response.status}): ${text}`);
		}

		if (response.status === 204) return undefined as T;
		return (await response.json()) as T;
	}

	// ─── Folders ────────────────────────────────────────────────────────────────

	async listFolders(params: { projectId?: string; name?: string } = {}): Promise<N8nFolder[]> {
		const queryParams: Record<string, string> = { limit: '250' };
		if (params.projectId ?? this.projectId) {
			queryParams.projectId = (params.projectId ?? this.projectId)!;
		}
		if (params.name) queryParams.name = params.name;

		const folders: N8nFolder[] = [];
		let cursor: string | null = null;

		do {
			if (cursor) queryParams.cursor = cursor;
			const page = await this.request<N8nListResponse<N8nFolder>>(
				'GET',
				'/folders',
				queryParams,
			);
			folders.push(...page.data);
			cursor = page.nextCursor;
		} while (cursor);

		return folders;
	}

	async createFolder(
		name: string,
		parentFolderId?: string,
	): Promise<N8nFolder> {
		const body: Record<string, unknown> = { name };
		if (parentFolderId) body.parentFolderId = parentFolderId;
		if (this.projectId) body.projectId = this.projectId;

		return this.request<N8nFolder>('POST', '/folders', { upsert: 'true' }, body);
	}

	async getFolder(id: string): Promise<N8nFolder> {
		const params: Record<string, string> = {};
		if (this.projectId) params.projectId = this.projectId;
		return this.request<N8nFolder>('GET', `/folders/${id}`, params);
	}

	// ─── Workflows ───────────────────────────────────────────────────────────────

	async listWorkflows(params: {
		parentFolderId?: string;
		projectId?: string;
		name?: string;
		recursive?: boolean;
	} = {}): Promise<N8nWorkflow[]> {
		const queryParams: Record<string, string> = { limit: '250' };
		if (params.projectId ?? this.projectId) {
			queryParams.projectId = (params.projectId ?? this.projectId)!;
		}
		if (params.parentFolderId) queryParams.parentFolderId = params.parentFolderId;
		if (params.name) queryParams.name = params.name;
		if (params.recursive !== undefined) queryParams.recursive = String(params.recursive);

		const workflows: N8nWorkflow[] = [];
		let cursor: string | null = null;

		do {
			if (cursor) queryParams.cursor = cursor;
			const page = await this.request<N8nListResponse<N8nWorkflow>>(
				'GET',
				'/workflows',
				queryParams,
			);
			workflows.push(...page.data);
			cursor = page.nextCursor;
		} while (cursor);

		return workflows;
	}

	async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
		return this.request<N8nWorkflow>('POST', '/workflows', {}, workflow);
	}

	async updateWorkflow(id: string, workflow: N8nWorkflow): Promise<N8nWorkflow> {
		return this.request<N8nWorkflow>('PUT', `/workflows/${id}`, {}, workflow);
	}

	async getWorkflow(id: string): Promise<N8nWorkflow> {
		return this.request<N8nWorkflow>('GET', `/workflows/${id}`);
	}
}
