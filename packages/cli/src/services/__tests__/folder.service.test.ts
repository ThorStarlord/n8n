import { mockInstance } from '@n8n/backend-test-utils';
import { FolderRepository, FolderTagMappingRepository, WorkflowRepository } from '@n8n/db';
import { UserError, PROJECT_ROOT } from 'n8n-workflow';

import { FolderNotFoundError } from '@/errors/folder-not-found.error';
import { FolderService } from '@/services/folder.service';
import { WorkflowService } from '@/workflows/workflow.service';

describe('FolderService', () => {
	const folderRepository = mockInstance(FolderRepository);
	const folderTagMappingRepository = mockInstance(FolderTagMappingRepository);
	const workflowRepository = mockInstance(WorkflowRepository);
	const workflowService = mockInstance(WorkflowService);

	const service = new FolderService(
		folderRepository,
		folderTagMappingRepository,
		workflowRepository,
		workflowService,
	);

	const projectId = 'project-id';

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('createFolder', () => {
		it('should create a folder at root when parentFolderId is not provided', async () => {
			folderRepository.create.mockReturnValue({ id: 'new-id' } as any);
			folderRepository.save.mockResolvedValue({
				id: 'new-id',
				homeProject: { id: projectId },
			} as any);

			const result = await service.createFolder({ name: 'test' }, projectId);

			expect(result.id).toBe('new-id');
			expect(folderRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					parentFolder: null,
				}),
			);
		});

		it('should return existing folder if upsert is true and name exists in same parent', async () => {
			const existing = { id: 'existing-id', name: 'test' };
			folderRepository.findOne.mockResolvedValue(existing as any);

			const result = await service.createFolder({ name: 'test' }, projectId, true);

			expect(result.id).toBe('existing-id');
			expect(folderRepository.create).not.toHaveBeenCalled();
		});

		it('should throw if depth limit is reached', async () => {
			// Mocking the internal checkFolderDepth to throw UserError
			// This avoids complex QueryBuilder mocks for recursive CTEs
			jest
				.spyOn(service as any, 'checkFolderDepth')
				.mockRejectedValue(new UserError('Maximum folder nesting depth of 10 exceeded'));

			await expect(
				service.createFolder({ name: 'test', parentFolderId: 'p-id' }, projectId),
			).rejects.toThrow(UserError);
		});
	});

	describe('updateFolder', () => {
		it('should move folder to root when parentFolderId is null', async () => {
			folderRepository.findOneOrFailFolderInProject.mockResolvedValue({ id: 'f-id' } as any);

			await service.updateFolder('f-id', projectId, { parentFolderId: null });

			expect(folderRepository.update).toHaveBeenCalledWith(
				{ id: 'f-id' },
				expect.objectContaining({ parentFolder: null }),
			);
		});

		it('should move folder to root when parentFolderId is PROJECT_ROOT', async () => {
			folderRepository.findOneOrFailFolderInProject.mockResolvedValue({ id: 'f-id' } as any);

			await service.updateFolder('f-id', projectId, { parentFolderId: PROJECT_ROOT });

			expect(folderRepository.update).toHaveBeenCalledWith(
				{ id: 'f-id' },
				expect.objectContaining({ parentFolder: null }),
			);
		});

		it('should throw if moving to self', async () => {
			folderRepository.findOneOrFailFolderInProject.mockResolvedValue({ id: 'f-id' } as any);

			await expect(
				service.updateFolder('f-id', projectId, { parentFolderId: 'f-id' }),
			).rejects.toThrow('Cannot set a folder as its own parent');
		});
	});
});
