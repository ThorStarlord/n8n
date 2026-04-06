import { Container } from '@n8n/di';
import { FolderRepository, ProjectRepository, WorkflowRepository } from '@n8n/db';
import { FolderService } from '@/services/folder.service';
import { WorkflowService } from '@/workflows/workflow.service';
import type { ListQuery } from '@/requests';
import type { User } from '@n8n/db';
import { UserError } from 'n8n-workflow';
import type { WorkflowSharingRole } from '@n8n/permissions';

export interface FolderImportTree {
	name: string;
	workflows?: any[];
	children?: FolderImportTree[];
}

async function resolveProjectId(userId: string, projectId?: string): Promise<string> {
	const projectRepo = Container.get(ProjectRepository);
	if (projectId) {
		const project = await projectRepo.findOne({
			where: [
				{ id: projectId, type: 'personal', creatorId: userId },
				{ id: projectId, projectRelations: { userId } },
			],
		});
		if (!project) {
			throw new UserError(`Project with ID "${projectId}" not found or no access.`);
		}
		return project.id;
	}
	const personalProject = await projectRepo.getPersonalProjectForUserOrFail(userId);
	return personalProject.id;
}

export async function getFolders(
	userId: string,
	options: ListQuery.Options & { projectId?: string; name?: string; tags?: string[] },
) {
	const projectId = await resolveProjectId(userId, options.projectId);
	const { name, tags, ...rest } = options;
	rest.filter = { ...rest.filter, name, tags };
	return await Container.get(FolderService).getManyAndCount(projectId, rest);
}

export async function createFolder(
	userId: string,
	name: string,
	parentFolderId?: string,
	projectId?: string,
	upsert = false,
) {
	const resolvedProjectId = await resolveProjectId(userId, projectId);
	return await Container.get(FolderService).createFolder(
		{ name, parentFolderId },
		resolvedProjectId,
		upsert,
	);
}

export async function getFolder(userId: string, folderId: string, projectId?: string) {
	const resolvedProjectId = await resolveProjectId(userId, projectId);
	return await Container.get(FolderService).findFolderInProjectOrFail(folderId, resolvedProjectId);
}

export async function updateFolder(
	userId: string,
	folderId: string,
	name?: string,
	parentFolderId?: string,
	projectId?: string,
) {
	const resolvedProjectId = await resolveProjectId(userId, projectId);
	return await Container.get(FolderService).updateFolder(folderId, resolvedProjectId, {
		name,
		parentFolderId,
	});
}

export async function deleteFolder(
	user: User,
	folderId: string,
	forceDelete: boolean = false,
	projectId?: string,
) {
	const resolvedProjectId = await resolveProjectId(user.id, projectId);
	const folderRepo = Container.get(FolderRepository);
	// Ensure folder exists
	await folderRepo.findOneOrFailFolderInProject(folderId, resolvedProjectId);

	if (forceDelete) {
		const workflowIds = await Container.get(WorkflowRepository).getAllWorkflowIdsInHierarchy(
			folderId,
			resolvedProjectId,
		);
		const workflowService = Container.get(WorkflowService);
		for (const wId of workflowIds) {
			await workflowService.delete(user, wId, true); // true = publicApi
		}
	}

	// Using default delete behavior from FolderService (which moves contents to root and archives if not already deleted)
	return await Container.get(FolderService).deleteFolder(user, folderId, resolvedProjectId, {});
}

export async function importFolder(
	user: User,
	tree: FolderImportTree,
	projectId?: string,
	parentId?: string,
) {
	const resolvedProjectId = await resolveProjectId(user.id, projectId);

	// Create root folder of the tree
	const rootFolder = await createFolder(
		user.id,
		tree.name,
		parentId,
		resolvedProjectId,
		true, // Use upsert to avoid duplicates if re-imported
	);

	// Import workflows into this folder
	if (tree.workflows && Array.isArray(tree.workflows)) {
		const projectRepo = Container.get(ProjectRepository);
		const project = await projectRepo.findOneOrFail({ where: { id: resolvedProjectId } });

		// Use dynamic import to avoid circular dependency
		const { createWorkflow } = await import('../workflows/workflows.service');

		for (const workflowData of tree.workflows) {
			await createWorkflow(
				workflowData,
				user,
				project,
				'workflow:owner' as WorkflowSharingRole,
				rootFolder.id,
			);
		}
	}

	// Recurse into children
	if (tree.children && Array.isArray(tree.children)) {
		for (const child of tree.children) {
			await importFolder(user, child, resolvedProjectId, rootFolder.id);
		}
	}

	return rootFolder;
}

export async function resolveFolderPath(
	userId: string,
	path: string,
	projectId?: string,
): Promise<string> {
	const resolvedProjectId = await resolveProjectId(userId, projectId);
	const segments = path.split('/').filter(Boolean);
	let parentFolderId: string | undefined = undefined;

	for (const segment of segments) {
		const folder = await createFolder(userId, segment, parentFolderId, resolvedProjectId, true);
		parentFolderId = folder.id;
	}

	if (!parentFolderId) {
		throw new UserError('Invalid folder path');
	}

	return parentFolderId;
}
