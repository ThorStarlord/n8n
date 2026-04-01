import { FolderRepository, ProjectRepository, WorkflowRepository } from '@n8n/db';
import { Container } from '@n8n/di';

import { FolderService } from '@/services/folder.service';
import { WorkflowService } from '@/workflows/workflow.service';
import type { ListQuery } from '@/requests';
import type { User } from '@n8n/db';

export async function getFolders(userId: string, options: ListQuery.Options) {
	const personalProject =
		await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(userId);
	return await Container.get(FolderService).getManyAndCount(personalProject.id, options);
}

export async function createFolder(userId: string, name: string, parentFolderId?: string) {
	const personalProject =
		await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(userId);
	return await Container.get(FolderService).createFolder(
		{ name, parentFolderId },
		personalProject.id,
	);
}

export async function getFolder(userId: string, folderId: string) {
	const personalProject =
		await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(userId);
	return await Container.get(FolderService).findFolderInProjectOrFail(folderId, personalProject.id);
}

export async function updateFolder(
	userId: string,
	folderId: string,
	name?: string,
	parentFolderId?: string,
) {
	const personalProject =
		await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(userId);
	return await Container.get(FolderService).updateFolder(folderId, personalProject.id, {
		name,
		parentFolderId,
	});
}

export async function deleteFolder(user: User, folderId: string, forceDelete: boolean = false) {
	const personalProject = await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(
		user.id,
	);
	const folderRepo = Container.get(FolderRepository);
	// Ensure folder exists
	await folderRepo.findOneOrFailFolderInProject(folderId, personalProject.id);

	if (forceDelete) {
		const workflowIds = await Container.get(WorkflowRepository).getAllWorkflowIdsInHierarchy(
			folderId,
			personalProject.id,
		);
		const workflowService = Container.get(WorkflowService);
		for (const wId of workflowIds) {
			await workflowService.delete(user, wId, true); // true = publicApi
		}
	}

	// Using default delete behavior from FolderService (which moves contents to root and archives if not already deleted)
	return await Container.get(FolderService).deleteFolder(user, folderId, personalProject.id, {});
}
