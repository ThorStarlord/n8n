export const ILLEGAL_FOLDER_CHARACTERS = [
	'[',
	']',
	'^',
	'\\',
	'/',
	':',
	'*',
	'?',
	'"',
	'<',
	'>',
	'|',
];
export const FOLDER_NAME_ILLEGAL_CHARACTERS_REGEX = new RegExp(
	`[${ILLEGAL_FOLDER_CHARACTERS.map((char) => {
		return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}).join('')}]`,
);

export const FOLDER_NAME_ONLY_DOTS_REGEX = /^\.+$/;
export const FOLDER_NAME_MAX_LENGTH = 128;

export const DELETE_FOLDER_MODAL_KEY = 'deleteFolder';
export const MOVE_FOLDER_MODAL_KEY = 'moveFolder';

export const FOLDER_LIST_ITEM_ACTIONS = {
	OPEN: 'open',
	CREATE: 'create',
	CREATE_WORKFLOW: 'create_workflow',
	IMPORT_FROM_FILE: 'import_from_file',
	IMPORT_FROM_URL: 'import_from_url',
	RENAME: 'rename',
	MOVE: 'move',
	CHOWN: 'change_owner',
	TAGS: 'manage_tags',
	DELETE: 'delete',
};
