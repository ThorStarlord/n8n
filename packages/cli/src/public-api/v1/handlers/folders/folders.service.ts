import { FolderRepository, ProjectRepository } from '@n8n/db';
import { Container } from '@n8n/di';

import { FolderService } from '@/services/folder.service';
import type { ListQuery } from '@/requests';

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

export async function deleteFolder(userId: string, folderId: string) {
	const personalProject =
		await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(userId);
	const folderRepo = Container.get(FolderRepository);
	const folder = await folderRepo.findOneOrFailFolderInProject(folderId, personalProject.id);
	// Using default delete behavior from FolderService (which moves contents to root and archives)
	return await Container.get(FolderService).deleteFolder(
		{ id: userId } as any,
		folderId,
		personalProject.id,
		{},
	);
}
