import type express from 'express';

import { validCursor } from '../../shared/middlewares/global.middleware';
import { encodeNextCursor } from '../../shared/services/pagination.service';
import type { FolderRequest } from '../../../types';
import * as foldersService from './folders.service';

export = {
	getFolders: [
		validCursor,
		async (req: FolderRequest.GetAll, res: express.Response) => {
			const { offset = 0, limit = 100 } = req.query;

			const [folders, count] = await foldersService.getFolders(req.user.id, {
				skip: offset,
				take: limit,
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
		async (req: any, res: express.Response) => {
			const { name, parentFolderId } = req.body;

			if (!name) {
				return res.status(400).json({ message: 'Name is required' });
			}

			const folder = await foldersService.createFolder(req.user.id, name, parentFolderId);
			return res.status(201).json(folder);
		},
	],

	getFolder: [
		async (req: any, res: express.Response) => {
			const { id } = req.params;

			try {
				const folder = await foldersService.getFolder(req.user.id, id);
				return res.json(folder);
			} catch (error) {
				return res.status(404).json({ message: 'Folder not found' });
			}
		},
	],

	updateFolder: [
		async (req: any, res: express.Response) => {
			const { id } = req.params;
			const { name, parentFolderId } = req.body;

			try {
				await foldersService.updateFolder(req.user.id, id, name, parentFolderId);
				const folder = await foldersService.getFolder(req.user.id, id);
				return res.json(folder);
			} catch (error) {
				return res.status(404).json({ message: 'Folder not found' });
			}
		},
	],

	deleteFolder: [
		async (req: any, res: express.Response) => {
			const { id } = req.params;
			const forceDelete = req.query.forceDelete === 'true';

			try {
				await foldersService.deleteFolder(req.user, id, forceDelete);
				return res.status(204).send();
			} catch (error) {
				return res.status(404).json({ message: 'Folder not found' });
			}
		},
	],
};
