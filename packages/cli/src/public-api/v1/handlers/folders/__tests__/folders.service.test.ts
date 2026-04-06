import { Container } from '@n8n/di';
import { ProjectRepository, FolderRepository, WorkflowRepository } from '@n8n/db';
import { FolderService } from '@/services/folder.service';
import * as foldersService from '../folders.service';
import { UserError } from 'n8n-workflow';

jest.mock('@/services/folder.service');
jest.mock('@/workflows/workflow.service');
jest.mock('../workflows/workflows.service');

describe('Public API Folders Service', () => {
	let folderServiceCore: jest.Mocked<FolderService>;
	let projectRepository: jest.Mocked<ProjectRepository>;
	let folderRepository: jest.Mocked<FolderRepository>;
	let workflowRepository: jest.Mocked<WorkflowRepository>;

	beforeEach(() => {
		jest.clearAllMocks();
		folderServiceCore = {
			createFolder: jest.fn(),
		} as any;
		projectRepository = {
			findOne: jest.fn(),
			getPersonalProjectForUserOrFail: jest.fn(),
			findOneOrFail: jest.fn(),
		} as any;
		folderRepository = {
			findOneOrFailFolderInProject: jest.fn(),
		} as any;
		workflowRepository = {
			findOne: jest.fn(),
		} as any;

		Container.set(FolderService, folderServiceCore);
		Container.set(ProjectRepository, projectRepository);
		Container.set(FolderRepository, folderRepository);
		Container.set(WorkflowRepository, workflowRepository);
	});

	describe('resolveFolderPath', () => {
		it('should resolve a single level path', async () => {
			const userId = 'user-1';
			const project = { id: 'project-1' };
			projectRepository.getPersonalProjectForUserOrFail.mockResolvedValue(project as any);
			folderServiceCore.createFolder.mockResolvedValue({ id: 'folder-1' } as any);

			const result = await foldersService.resolveFolderPath(userId, '/Finance');

			expect(result).toBe('folder-1');
			expect(folderServiceCore.createFolder).toHaveBeenCalledWith(
				{ name: 'Finance', parentFolderId: undefined },
				'project-1',
				true,
			);
		});

		it('should resolve a multi-level path', async () => {
			const userId = 'user-1';
			const project = { id: 'project-1' };
			projectRepository.getPersonalProjectForUserOrFail.mockResolvedValue(project as any);

			folderServiceCore.createFolder
				.mockResolvedValueOnce({ id: 'folder-1' } as any)
				.mockResolvedValueOnce({ id: 'folder-2' } as any);

			const result = await foldersService.resolveFolderPath(userId, '/Finance/2026');

			expect(result).toBe('folder-2');
			expect(folderServiceCore.createFolder).toHaveBeenCalledTimes(2);
			expect(folderServiceCore.createFolder).toHaveBeenNthCalledWith(
				2,
				{ name: '2026', parentFolderId: 'folder-1' },
				'project-1',
				true,
			);
		});

		it('should throw error for empty path', async () => {
			const userId = 'user-1';
			const project = { id: 'project-1' };
			projectRepository.getPersonalProjectForUserOrFail.mockResolvedValue(project as any);

			await expect(foldersService.resolveFolderPath(userId, '/')).rejects.toThrow(UserError);
		});
	});

	describe('importFolder', () => {
		it('should call createWorkflow for each workflow in the tree', async () => {
			const user = { id: 'user-1' } as any;
			const project = { id: 'project-1' };
			projectRepository.getPersonalProjectForUserOrFail.mockResolvedValue(project as any);
			projectRepository.findOneOrFail.mockResolvedValue(project as any);

			folderServiceCore.createFolder.mockResolvedValue({ id: 'root-id' } as any);

			const { createWorkflow } = require('../workflows/workflows.service');

			const tree = {
				name: 'Finance',
				workflows: [{ name: 'WF 1' }],
				children: [
					{
						name: 'Q1',
						workflows: [{ name: 'WF 2' }],
					},
				],
			};

			await foldersService.importFolder(user, tree);

			expect(folderServiceCore.createFolder).toHaveBeenCalledTimes(2);
			expect(createWorkflow).toHaveBeenCalledTimes(2);
		});
	});
});
