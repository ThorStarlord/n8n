import { createComponentRenderer } from '@/__tests__/render';
import { waitAllPromises } from '@/__tests__/utils';
import ImportWorkflowUrlModal from './ImportWorkflowUrlModal.vue';
import { createTestingPinia } from '@pinia/testing';
import { useUIStore } from '@/app/stores/ui.store';
import { nodeViewEventBus } from '@/app/event-bus';
import { IMPORT_WORKFLOW_URL_MODAL_KEY } from '@/app/constants';
import userEvent from '@testing-library/user-event';
import { useRoute } from 'vue-router';
import type { Mock } from 'vitest';

const mockFetchParentFolder = vi.hoisted(() => vi.fn());

vi.mock('@/features/core/folders/composables/useParentFolder', () => ({
	useParentFolder: () => ({
		fetchParentFolder: mockFetchParentFolder,
	}),
}));

vi.mock('vue-router', async (importOriginal) => ({
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports
	...(await importOriginal<typeof import('vue-router')>()),
	useRoute: vi.fn().mockReturnValue({
		params: {},
		query: {},
		path: '/',
	}),
}));

const ModalStub = {
	template: `
        <div>
            <slot name="header" />
            <slot name="title" />
            <slot name="content" />
            <slot name="footer" />
        </div>
    `,
};

const initialState = {
	modalsById: {
		[IMPORT_WORKFLOW_URL_MODAL_KEY]: {
			open: true,
		},
	},
	modalStack: [IMPORT_WORKFLOW_URL_MODAL_KEY],
};

const global = {
	stubs: {
		Modal: ModalStub,
		MoveToFolderDropdown: {
			props: ['selectedLocation'],
			template: `
				<div>
					<div data-test-id="selected-location-id">{{ selectedLocation?.id }}</div>
					<button
						data-test-id="folder-select"
						@click="$emit('location:selected', { id: 'folder-123', name: 'Folder 123', resource: 'folder', createdAt: '', updatedAt: '', workflowCount: 0, subFolderCount: 0, path: [] })"
					/>
					<button
						data-test-id="project-root-select"
						@click="$emit('location:selected', { id: 'project-123', name: 'Project Root', resource: 'project', createdAt: '', updatedAt: '', workflowCount: 0, subFolderCount: 0, path: [] })"
					/>
				</div>
			`,
		},
	},
};

const renderModal = createComponentRenderer(ImportWorkflowUrlModal);
let pinia: ReturnType<typeof createTestingPinia>;

describe('ImportWorkflowUrlModal', () => {
	beforeEach(() => {
		(useRoute as Mock).mockReturnValue({
			params: {},
			query: {},
			path: '/',
		});
		mockFetchParentFolder.mockResolvedValue(null);
		pinia = createTestingPinia({ initialState });
	});

	it('should close the modal on cancel', async () => {
		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const uiStore = useUIStore();

		await userEvent.click(getByTestId('cancel-workflow-import-url-button'));

		expect(uiStore.closeModal).toHaveBeenCalledWith(IMPORT_WORKFLOW_URL_MODAL_KEY);
	});

	it('should emit importWorkflowUrl event on confirm', async () => {
		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const urlInput = getByTestId('workflow-url-import-input');
		const confirmButton = getByTestId('confirm-workflow-import-url-button');

		await userEvent.type(urlInput, 'https://valid-url.com/workflow.json');
		expect(confirmButton).toBeEnabled();

		const emitSpy = vi.spyOn(nodeViewEventBus, 'emit');
		await userEvent.click(confirmButton);

		expect(emitSpy).toHaveBeenCalledWith('importWorkflowUrl', {
			url: 'https://valid-url.com/workflow.json',
		});
	});

	it('should emit selected folder id on confirm when a folder is chosen', async () => {
		(useRoute as Mock).mockReturnValue({
			params: {},
			query: { projectId: 'project-123' },
			path: '/',
		});

		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const emitSpy = vi.spyOn(nodeViewEventBus, 'emit');

		await userEvent.type(
			getByTestId('workflow-url-import-input'),
			'https://valid-url.com/workflow',
		);
		await userEvent.click(getByTestId('folder-select'));
		await userEvent.click(getByTestId('confirm-workflow-import-url-button'));

		expect(emitSpy).toHaveBeenCalledWith('importWorkflowUrl', {
			url: 'https://valid-url.com/workflow',
			parentFolderId: 'folder-123',
		});
	});

	it('should omit parentFolderId when project root is selected', async () => {
		(useRoute as Mock).mockReturnValue({
			params: {},
			query: { projectId: 'project-123' },
			path: '/',
		});

		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const emitSpy = vi.spyOn(nodeViewEventBus, 'emit');

		await userEvent.type(
			getByTestId('workflow-url-import-input'),
			'https://valid-url.com/workflow',
		);
		await userEvent.click(getByTestId('project-root-select'));
		await userEvent.click(getByTestId('confirm-workflow-import-url-button'));

		expect(emitSpy).toHaveBeenCalledWith('importWorkflowUrl', {
			url: 'https://valid-url.com/workflow',
		});
	});

	it('should initialize the selected folder from the route context', async () => {
		(useRoute as Mock).mockReturnValue({
			params: {},
			query: { projectId: 'project-123', parentFolderId: 'folder-456' },
			path: '/workflow/new',
		});
		mockFetchParentFolder.mockResolvedValue({
			id: 'folder-456',
			name: 'Folder 456',
			parentFolderId: null,
		});

		const { getByTestId } = renderModal({
			global,
			pinia,
		});
		await waitAllPromises();

		expect(getByTestId('selected-location-id')).toHaveTextContent('folder-456');
	});

	it('should disable confirm button for invalid URL', async () => {
		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const urlInput = getByTestId('workflow-url-import-input');
		const confirmButton = getByTestId('confirm-workflow-import-url-button');

		await userEvent.type(urlInput, 'invalid-url');
		expect(confirmButton).toBeDisabled();
	});

	it('should accept URLs without .json extension', async () => {
		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const urlInput = getByTestId('workflow-url-import-input');
		const confirmButton = getByTestId('confirm-workflow-import-url-button');

		await userEvent.type(urlInput, 'https://example.com/workflow');
		expect(confirmButton).toBeEnabled();
	});

	it('should accept GitHub raw URLs', async () => {
		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const urlInput = getByTestId('workflow-url-import-input');
		const confirmButton = getByTestId('confirm-workflow-import-url-button');

		await userEvent.type(urlInput, 'https://raw.githubusercontent.com/user/repo/main/workflow');
		expect(confirmButton).toBeEnabled();
	});

	it('should accept URLs with query parameters', async () => {
		const { getByTestId } = renderModal({
			global,
			pinia,
		});

		const urlInput = getByTestId('workflow-url-import-input');
		const confirmButton = getByTestId('confirm-workflow-import-url-button');

		await userEvent.type(urlInput, 'https://example.com/api/workflow?id=123');
		expect(confirmButton).toBeEnabled();
	});
});
