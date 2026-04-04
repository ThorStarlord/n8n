import { useWorkflowInitialization } from './useWorkflowInitialization';
import type { WorkflowState } from './useWorkflowState';

const mockRoute = vi.hoisted(() => ({
	name: 'workflow',
	params: { name: 'new-workflow' },
	query: {
		new: 'true',
		parentFolderId: 'missing-folder-id',
		projectId: 'project-1',
	},
	meta: { nodeView: true },
}));

const mockRouter = vi.hoisted(() => ({
	replace: vi.fn().mockResolvedValue(undefined),
	push: vi.fn().mockResolvedValue(undefined),
}));

const mockResetWorkspace = vi.hoisted(() => vi.fn());
const mockFitView = vi.hoisted(() => vi.fn());
const mockFetchParentFolder = vi.hoisted(() => vi.fn());
const mockRefreshCurrentProject = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockWorkflowDocumentStore = vi.hoisted(() => ({
	workflowId: 'new-workflow',
	workflowVersion: undefined,
	setHomeProject: vi.fn(),
	setScopes: vi.fn(),
	setParentFolder: vi.fn(),
}));

const mockWorkflowsStore = vi.hoisted(() => ({
	workflowId: 'new-workflow',
	isInDebugMode: false,
	workflowName: '',
	fetchLastSuccessfulExecution: vi.fn(),
}));

const mockWorkflowsListStore = vi.hoisted(() => ({
	fetchActiveWorkflows: vi.fn(),
	checkWorkflowExists: vi.fn().mockResolvedValue(false),
	fetchWorkflow: vi.fn(),
}));

const mockUiStore = vi.hoisted(() => ({
	nodeViewInitialized: false,
	isBlankRedirect: false,
}));

const mockNodeTypesStore = vi.hoisted(() => ({
	allNodeTypes: [],
	getNodeTypes: vi.fn(),
	fetchCommunityNodePreviews: vi.fn(),
}));

const mockCredentialsStore = vi.hoisted(() => ({
	fetchCredentialTypes: vi.fn(),
	fetchAllCredentialsForWorkflow: vi.fn(),
}));

const mockEnvironmentsStore = vi.hoisted(() => ({
	fetchAllVariables: vi.fn(),
}));

const mockSettingsStore = vi.hoisted(() => ({
	isPreviewMode: false,
	isEnterpriseFeatureEnabled: {},
}));

const mockProjectsStore = vi.hoisted(() => ({
	currentProjectId: 'project-1',
	currentProject: {
		id: 'project-1',
		scopes: ['workflow:create'],
	},
	personalProject: null,
	refreshCurrentProject: mockRefreshCurrentProject,
	setProjectNavActiveIdByWorkflowHomeProject: vi.fn(),
}));

const mockHistoryStore = vi.hoisted(() => ({
	reset: vi.fn(),
}));

const mockBuilderStore = vi.hoisted(() => ({
	streaming: false,
}));

const mockAiTemplatesStarterCollectionStore = vi.hoisted(() => ({
	trackUserOpenedWorkflow: vi.fn(),
}));

const mockReadyToRunWorkflowsStore = vi.hoisted(() => ({
	trackOpenWorkflow: vi.fn(),
}));

vi.mock('vue-router', async (importOriginal) => {
	const actual = (await importOriginal()) as object;
	return {
		...actual,
		useRoute: () => mockRoute,
		useRouter: () => mockRouter,
	};
});

vi.mock('@n8n/i18n', () => ({
	useI18n: () => ({
		baseText: (key: string) => key,
	}),
}));

vi.mock('@/app/composables/useToast', () => ({
	useToast: () => ({
		showError: vi.fn(),
	}),
}));

vi.mock('@/app/composables/useDocumentTitle', () => ({
	useDocumentTitle: () => ({
		setDocumentTitle: vi.fn(),
	}),
}));

vi.mock('@/app/composables/useExternalHooks', () => ({
	useExternalHooks: () => ({
		run: vi.fn(),
	}),
}));

vi.mock('@/app/composables/useCanvasOperations', () => ({
	useCanvasOperations: () => ({
		resetWorkspace: mockResetWorkspace,
		initializeWorkspace: vi.fn(),
		fitView: mockFitView,
		openWorkflowTemplate: vi.fn(),
		openWorkflowTemplateFromJSON: vi.fn(),
	}),
}));

vi.mock('@/features/core/folders/composables/useParentFolder', () => ({
	useParentFolder: () => ({
		fetchParentFolder: mockFetchParentFolder,
	}),
}));

vi.mock('@/app/stores/workflows.store', () => ({
	useWorkflowsStore: () => mockWorkflowsStore,
}));

vi.mock('@/app/stores/workflowsList.store', () => ({
	useWorkflowsListStore: () => mockWorkflowsListStore,
}));

vi.mock('@/app/stores/ui.store', () => ({
	useUIStore: () => mockUiStore,
}));

vi.mock('@/app/stores/nodeTypes.store', () => ({
	useNodeTypesStore: () => mockNodeTypesStore,
}));

vi.mock('@/features/credentials/credentials.store', () => ({
	useCredentialsStore: () => mockCredentialsStore,
}));

vi.mock('@/features/settings/environments.ee/environments.store', () => ({
	useEnvironmentsStore: () => mockEnvironmentsStore,
}));

vi.mock('@/app/stores/settings.store', () => ({
	useSettingsStore: () => mockSettingsStore,
}));

vi.mock('@/features/collaboration/projects/projects.store', () => ({
	useProjectsStore: () => mockProjectsStore,
}));

vi.mock('@/app/stores/history.store', () => ({
	useHistoryStore: () => mockHistoryStore,
}));

vi.mock('@/features/ai/assistant/builder.store', () => ({
	useBuilderStore: () => mockBuilderStore,
}));

vi.mock(
	'@/experiments/aiTemplatesStarterCollection/stores/aiTemplatesStarterCollection.store',
	() => ({
		useAITemplatesStarterCollectionStore: () => mockAiTemplatesStarterCollectionStore,
	}),
);

vi.mock('@/experiments/readyToRunWorkflows/stores/readyToRunWorkflows.store', () => ({
	useReadyToRunWorkflowsStore: () => mockReadyToRunWorkflowsStore,
}));

vi.mock('@/app/composables/useTelemetry', () => ({
	useTelemetry: () => ({
		track: vi.fn(),
	}),
}));

vi.mock('@/features/execution/executions/composables/useExecutionDebugging', () => ({
	useExecutionDebugging: () => ({
		applyExecutionData: vi.fn(),
	}),
}));

vi.mock('@/features/workflows/templates/utils/workflowSamples', () => ({
	getSampleWorkflowByTemplateId: vi.fn(),
}));

vi.mock('@/app/stores/workflowDocument.store', () => ({
	useWorkflowDocumentStore: () => mockWorkflowDocumentStore,
	createWorkflowDocumentId: (workflowId: string) => workflowId,
	disposeWorkflowDocumentStore: vi.fn(),
}));

describe('useWorkflowInitialization', () => {
	const mockWorkflowState = {
		getNewWorkflowData: vi.fn().mockResolvedValue({ name: 'New Workflow', settings: {} }),
		setWorkflowId: vi.fn(),
	} as unknown as WorkflowState;

	beforeEach(() => {
		vi.clearAllMocks();

		mockRoute.name = 'workflow';
		mockRoute.params = { name: 'new-workflow' };
		mockRoute.query = {
			new: 'true',
			parentFolderId: 'missing-folder-id',
			projectId: 'project-1',
		};
		mockRoute.meta = { nodeView: true };

		mockProjectsStore.currentProjectId = 'project-1';
		mockProjectsStore.currentProject = {
			id: 'project-1',
			scopes: ['workflow:create'],
		};
		mockProjectsStore.personalProject = null;
		mockFetchParentFolder.mockResolvedValue(null);
		mockRefreshCurrentProject.mockResolvedValue(undefined);
	});

	it('should clear invalid parentFolderId query state during new workflow initialization', async () => {
		const { initializeWorkspaceForNewWorkflow } = useWorkflowInitialization(mockWorkflowState);

		await initializeWorkspaceForNewWorkflow();

		expect(mockFetchParentFolder).toHaveBeenCalledWith('missing-folder-id');
		expect(mockRouter.replace).toHaveBeenCalledWith({
			query: {
				new: 'true',
				parentFolderId: undefined,
				projectId: 'project-1',
			},
		});
		expect(mockWorkflowDocumentStore.setParentFolder).toHaveBeenCalledWith(null);
	});
});
