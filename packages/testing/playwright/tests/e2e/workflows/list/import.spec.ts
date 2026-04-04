import { test, expect } from '../../../../fixtures/base';
import onboardingWorkflow from '../../../../workflows/Onboarding_workflow.json';
import { resolveFromRoot } from '../../../../utils/path-helper';

test.describe(
	'Import workflow',
	{
		annotation: [{ type: 'owner', description: 'Adore' }],
	},
	() => {
		test.describe('From URL', () => {
			test.beforeEach(async ({ n8n }) => {
				await n8n.page.route('**/rest/workflows/from-url*', async (route) => {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ data: onboardingWorkflow }),
					});
				});
			});

			test('should import workflow', async ({ n8n }) => {
				await n8n.navigate.toWorkflow('new');
				await n8n.page.waitForLoadState('load');

				await n8n.canvas.clickWorkflowMenu();
				await n8n.canvas.clickImportFromURL();

				await expect(n8n.canvas.getImportURLInput()).toBeVisible();

				await n8n.canvas.fillImportURLInput('https://fakepage.com/workflow.json');
				await n8n.canvas.clickConfirmImportURL();

				await n8n.canvas.clickZoomToFitButton();

				await expect(n8n.canvas.getCanvasNodes()).toHaveCount(4);

				await expect(n8n.notifications.getErrorNotifications()).toHaveCount(0);
				await expect(n8n.notifications.getSuccessNotifications()).toHaveCount(0);
			});

			test('clicking outside modal should not show error toast', async ({ n8n }) => {
				await n8n.navigate.toWorkflow('new');
				await n8n.page.waitForLoadState('load');

				await n8n.canvas.clickWorkflowMenu();
				await n8n.canvas.clickImportFromURL();

				await n8n.canvas.clickOutsideModal();

				await expect(n8n.notifications.getErrorNotifications()).toHaveCount(0);
			});

			test('canceling modal should not show error toast', async ({ n8n }) => {
				await n8n.navigate.toWorkflow('new');
				await n8n.page.waitForLoadState('load');

				await n8n.canvas.clickWorkflowMenu();
				await n8n.canvas.clickImportFromURL();

				await n8n.canvas.clickCancelImportURL();

				await expect(n8n.notifications.getErrorNotifications()).toHaveCount(0);
			});

			test('should import workflow from URL without .json extension', async ({ n8n }) => {
				await n8n.navigate.toWorkflow('new');
				await n8n.page.waitForLoadState('load');

				await n8n.canvas.clickWorkflowMenu();
				await n8n.canvas.clickImportFromURL();

				await expect(n8n.canvas.getImportURLInput()).toBeVisible();

				await n8n.canvas.fillImportURLInput('https://example.com/api/workflow');
				await n8n.canvas.clickConfirmImportURL();

				await n8n.canvas.clickZoomToFitButton();

				await expect(n8n.canvas.getCanvasNodes()).toHaveCount(4);

				await expect(n8n.notifications.getErrorNotifications()).toHaveCount(0);
				await expect(n8n.notifications.getSuccessNotifications()).toHaveCount(0);
			});

			test('should save a URL-imported workflow into the folder it was imported from', async ({
				n8n,
			}) => {
				const project = await n8n.api.projects.createProject('URL Import Target Project');
				const folder = await n8n.api.projects.createFolder(project.id, 'URL Imported Workflows');
				const workflowName = `URL Imported Workflow ${Date.now()}`;

				await n8n.navigate.toFolder(folder.id, project.id);
				await expect(n8n.workflows.getFolderBreadcrumbsActions()).toBeVisible();

				await n8n.workflows.getFolderBreadcrumbsActionToggle().click();
				await n8n.workflows.getFolderBreadcrumbsAction('import_from_url').click();

				await expect(n8n.canvas.getImportURLInput()).toBeVisible();
				await n8n.canvas.fillImportURLInput('https://fakepage.com/workflow.json');
				await n8n.canvas.clickConfirmImportURL();
				await expect(n8n.canvas.getCanvasNodes()).toHaveCount(4);

				const createResponsePromise = n8n.page.waitForResponse(
					(response) =>
						response.url().includes('/rest/workflows') && response.request().method() === 'POST',
				);

				await n8n.page.getByTestId('inline-edit-preview').click();
				await n8n.page.getByTestId('inline-edit-input').fill(workflowName);
				await n8n.page.getByTestId('inline-edit-input').press('Enter');
				await createResponsePromise;

				await n8n.navigate.toFolder(folder.id, project.id);
				await expect(n8n.workflows.cards.getWorkflow(workflowName)).toBeVisible();
			});
		});

		test.describe('From File', () => {
			test('should import workflow', async ({ n8n }) => {
				await n8n.navigate.toWorkflow('new');
				await n8n.page.waitForLoadState('load');

				await n8n.canvas.importWorkflow(
					'Test_workflow-actions_paste-data.json',
					'Import Test Workflow',
				);

				await n8n.page.waitForLoadState('load');

				await n8n.canvas.clickZoomToFitButton();

				await expect(n8n.canvas.getCanvasNodes()).toHaveCount(5);

				await expect(n8n.canvas.nodeConnections()).toHaveCount(5);
			});

			test('should save an imported workflow into the folder it was imported from', async ({
				n8n,
			}) => {
				const project = await n8n.api.projects.createProject('Import Target Project');
				const folder = await n8n.api.projects.createFolder(project.id, 'Imported Workflows');
				const workflowName = `Imported Workflow ${Date.now()}`;

				await n8n.navigate.toFolder(folder.id, project.id);
				await expect(n8n.workflows.getFolderBreadcrumbsActions()).toBeVisible();

				await n8n.workflows.getFolderBreadcrumbsActionToggle().click();
				const [fileChooser] = await Promise.all([
					n8n.page.waitForEvent('filechooser'),
					n8n.workflows.getFolderBreadcrumbsAction('import_from_file').click(),
				]);

				await fileChooser.setFiles(
					resolveFromRoot('workflows', 'Test_workflow-actions_paste-data.json'),
				);
				await expect(n8n.canvas.getCanvasNodes()).toHaveCount(5);

				const createResponsePromise = n8n.page.waitForResponse(
					(response) =>
						response.url().includes('/rest/workflows') && response.request().method() === 'POST',
				);

				await n8n.page.getByTestId('inline-edit-preview').click();
				await n8n.page.getByTestId('inline-edit-input').fill(workflowName);
				await n8n.page.getByTestId('inline-edit-input').press('Enter');
				await createResponsePromise;

				await n8n.navigate.toFolder(folder.id, project.id);
				await expect(n8n.workflows.cards.getWorkflow(workflowName)).toBeVisible();
			});
		});
	},
);
