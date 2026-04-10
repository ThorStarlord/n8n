import { z } from 'zod';

const FileTypeSchema = z.enum([
	'credential',
	'workflow',
	'tags',
	'variables',
	'file',
	'folders',
	'project',
	'datatable',
]);
export const SOURCE_CONTROL_FILE_TYPE = FileTypeSchema.Values;

const FileStatusSchema = z.enum([
	'new',
	'modified',
	'deleted',
	'created',
	'renamed',
	'conflicted',
	'ignored',
	'staged',
	'unknown',
]);
export const SOURCE_CONTROL_FILE_STATUS = FileStatusSchema.Values;

export type SourceControlledFileStatus = z.infer<typeof FileStatusSchema>;

export function isSourceControlledFileStatus(value: unknown): value is SourceControlledFileStatus {
	return FileStatusSchema.safeParse(value).success;
}

const FileLocationSchema = z.enum(['local', 'remote']);
export const SOURCE_CONTROL_FILE_LOCATION = FileLocationSchema.Values;

const ResourceOwnerSchema = z.object({
	type: z.enum(['personal', 'team']),
	projectId: z.string(),
	projectName: z.string(),
});

const CredentialResolutionWarningSchema = z.object({
	nodeName: z.string(),
	credentialType: z.string(),
	attemptedId: z.string().nullable().optional(),
	attemptedName: z.string().nullable().optional(),
	reason: z.enum(['not_found', 'ambiguous_name']),
});

export const SourceControlledFileSchema = z.object({
	file: z.string(),
	id: z.string(),
	name: z.string(),
	type: FileTypeSchema,
	status: FileStatusSchema,
	location: FileLocationSchema,
	conflict: z.boolean(),
	updatedAt: z.string(),
	pushed: z.boolean().optional(),
	isLocalPublished: z.boolean().optional(),
	isRemoteArchived: z.boolean().optional(),
	parentFolderId: z.string().nullable().optional(),
	folderPath: z.array(z.string()).optional(),
	owner: ResourceOwnerSchema.optional(), // Resource owner can be a personal email or team information
	publishingError: z.string().optional(),
	credentialResolutionWarnings: z.array(CredentialResolutionWarningSchema).optional(),
});

export type SourceControlledFile = z.infer<typeof SourceControlledFileSchema>;
