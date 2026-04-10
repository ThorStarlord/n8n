import type { TagEntity, WorkflowTagMapping } from '@n8n/db';
import type { CredentialResolutionWarning } from '@n8n/api-types';

export interface WorkflowImportResult {
	id: string;
	name: string;
	publishingError?: string;
	credentialResolutionWarnings?: CredentialResolutionWarning[];
}

export interface ImportResult {
	workflows: WorkflowImportResult[];
	credentials: Array<{ id: string; name: string; type: string }>;
	variables: { imported: string[] };
	tags: { tags: TagEntity[]; mappings: WorkflowTagMapping[] };
	removedFiles?: string[];
}
