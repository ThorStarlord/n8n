import type express from 'express';

import { apiKeyHasScope, validCursor } from '../../shared/middlewares/global.middleware';
import { encodeNextCursor } from '../../shared/services/pagination.service';
import type { FolderRequest } from '../../../types';
import * as foldersService from './folders.service';

export = {
	getFolders: [
		apiKeyHasScope('folder:list'),
		validCursor,
		async (req: FolderRequest.GetAll, res: express.Response) => {
			const offset =
				typeof req.query.offset === 'string'
					? parseInt(req.query.offset, 10)
					: (req.query.offset ?? 0);
			const limit =
				typeof req.query.limit === 'string'
					? parseInt(req.query.limit, 10)
					: (req.query.limit ?? 100);
			const { projectId, name, tags } = req.query;

			const [folders, count] = await foldersService.getFolders(req.user.id, {
				skip: offset,
				take: limit,
				projectId,
				name,
				tags: typeof tags === 'string' ? tags.split(',') : undefined,
			});

			return res.json({
				data: folders,
				nextCursor: encodeNextCursor({
					offset,
					limit,
					numberOfTotalRecords: count as number,
				}),
			});
		},
	],

	createFolder: [
		apiKeyHasScope('folder:create'),
		async (req: FolderRequest.Create, res: express.Response) => {
			const { name, parentFolderId, projectId } = req.body;
			const upsert = req.query.upsert === 'true';

			if (!name) {
				return res.status(400).json({ message: 'Name is required' });
			}

			const folder = await foldersService.createFolder(
				req.user.id,
				name,
				parentFolderId,
				projectId,
				upsert,
			);
			return res.status(201).json(folder);
		},
	],

	getFolder: [
		apiKeyHasScope('folder:read'),
		async (req: FolderRequest.Get, res: express.Response) => {
			const { id } = req.params;
			const { projectId } = req.query;

			try {
				const folder = await foldersService.getFolder(req.user.id, id, projectId);
				return res.json(folder);
			} catch (error) {
				return res.status(404).json({ message: 'Folder not found' });
			}
		},
	],

	updateFolder: [
		apiKeyHasScope('folder:update'),
		async (req: FolderRequest.Update, res: express.Response) => {
			const { id } = req.params;
			const { name, parentFolderId, projectId } = req.body;

			try {
				await foldersService.updateFolder(req.user.id, id, name, parentFolderId, projectId);
				const folder = await foldersService.getFolder(req.user.id, id, projectId);
				return res.json(folder);
			} catch (error) {
				return res.status(404).json({ message: 'Folder not found' });
			}
		},
	],

	deleteFolder: [
		apiKeyHasScope('folder:delete'),
		async (req: FolderRequest.Delete, res: express.Response) => {
			const { id } = req.params;
			const { projectId } = req.query;
			const forceDelete = req.query.forceDelete === 'true';

			try {
				await foldersService.deleteFolder(req.user, id, forceDelete, projectId);
				return res.status(204).send();
			} catch (error) {
				return res.status(404).json({ message: 'Folder not found' });
			}
		},
	],

	importFolder: [
		apiKeyHasScope('folder:create'),
		apiKeyHasScope('workflow:create'),
		async (req: FolderRequest.Import, res: express.Response) => {
			const { projectId, parentId, ...tree } = req.body;
			const rootFolder = await foldersService.importFolder(
				req.user,
				tree as any,
				projectId,
				parentId,
			);
			return res.status(201).json(rootFolder);
		},
	],
};
