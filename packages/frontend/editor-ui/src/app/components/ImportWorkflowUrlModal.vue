<script setup lang="ts">
import Modal from '@/app/components/Modal.vue';
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@n8n/i18n';
import { useUIStore } from '@/app/stores/ui.store';
import { nodeViewEventBus } from '@/app/event-bus';
import { VALID_WORKFLOW_IMPORT_URL_REGEX, IMPORT_WORKFLOW_URL_MODAL_KEY } from '@/app/constants';
import MoveToFolderDropdown from '@/features/core/folders/components/MoveToFolderDropdown.vue';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import { useFoldersStore } from '@/features/core/folders/folders.store';
import { useParentFolder } from '@/features/core/folders/composables/useParentFolder';
import type {
	ChangeLocationSearchResult,
	ResourceParentFolder,
} from '@/features/core/folders/folders.types';

import { N8nButton, N8nInput, N8nText } from '@n8n/design-system';
const i18n = useI18n();
const route = useRoute();
const uiStore = useUIStore();
const projectsStore = useProjectsStore();
const foldersStore = useFoldersStore();
const { fetchParentFolder } = useParentFolder();

const url = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const selectedLocation = ref<ChangeLocationSearchResult | null>(null);

const isValid = computed(() => {
	return url.value ? VALID_WORKFLOW_IMPORT_URL_REGEX.test(url.value) : true;
});

const currentFolderId = computed(() => {
	if (typeof route.query.parentFolderId === 'string') {
		return route.query.parentFolderId;
	}

	if (typeof route.params.folderId === 'string') {
		return route.params.folderId;
	}

	return undefined;
});

const createFolderLocation = (folder: ResourceParentFolder): ChangeLocationSearchResult => ({
	id: folder.id,
	name: folder.name,
	resource: 'folder',
	createdAt: '',
	updatedAt: '',
	workflowCount: 0,
	subFolderCount: 0,
	path: [],
});

const getSelectedParentFolderId = () => {
	return selectedLocation.value?.resource === 'folder' ? selectedLocation.value.id : undefined;
};

const closeModal = () => {
	uiStore.closeModal(IMPORT_WORKFLOW_URL_MODAL_KEY);
};

const confirm = () => {
	const parentFolderId = getSelectedParentFolderId();

	nodeViewEventBus.emit(
		'importWorkflowUrl',
		parentFolderId ? { url: url.value, parentFolderId } : { url: url.value },
	);
	closeModal();
};

const syncSelectedLocationFromRoute = async () => {
	if (!projectsStore.currentProjectId || !currentFolderId.value) {
		return;
	}

	const cachedFolder = foldersStore.getCachedFolder(currentFolderId.value);
	if (cachedFolder) {
		selectedLocation.value = createFolderLocation({
			id: cachedFolder.id,
			name: cachedFolder.name,
			parentFolderId: cachedFolder.parentFolder ?? null,
		});
		return;
	}

	const parentFolder = await fetchParentFolder(currentFolderId.value);
	if (!parentFolder) {
		return;
	}

	selectedLocation.value = createFolderLocation(parentFolder);
};

watch(
	() => [projectsStore.currentProjectId, currentFolderId.value],
	() => {
		selectedLocation.value = null;

		if (!projectsStore.currentProjectId || !currentFolderId.value) {
			return;
		}

		void syncSelectedLocationFromRoute();
	},
	{ immediate: true },
);

const focusInput = async () => {
	if (inputRef.value) {
		inputRef.value.focus();
	}
};
</script>

<template>
	<Modal
		:name="IMPORT_WORKFLOW_URL_MODAL_KEY"
		:title="i18n.baseText('mainSidebar.prompt.importWorkflowFromUrl')"
		:show-close="true"
		:center="true"
		width="420px"
		@opened="focusInput"
	>
		<template #content>
			<div :class="$style.noScrollbar">
				<N8nInput
					ref="inputRef"
					v-model="url"
					:placeholder="i18n.baseText('mainSidebar.prompt.workflowUrl')"
					:state="isValid ? 'default' : 'error'"
					data-test-id="workflow-url-import-input"
					@keyup.enter="confirm"
				/>
				<p :class="$style['error-text']" :style="{ visibility: isValid ? 'hidden' : 'visible' }">
					{{ i18n.baseText('mainSidebar.prompt.invalidUrl') }}
				</p>
				<N8nText v-if="projectsStore.currentProjectId" size="small" :class="$style['folder-label']">
					{{ i18n.baseText('mainSidebar.prompt.saveToFolder') }}
				</N8nText>
				<MoveToFolderDropdown
					v-if="projectsStore.currentProjectId"
					:selected-location="selectedLocation"
					:selected-project-id="projectsStore.currentProjectId"
					@location:selected="selectedLocation = $event"
				/>
			</div>
		</template>
		<template #footer>
			<div :class="$style.footer">
				<N8nButton
					variant="solid"
					float="right"
					:disabled="!url || !isValid"
					data-test-id="confirm-workflow-import-url-button"
					@click="confirm"
				>
					{{ i18n.baseText('mainSidebar.prompt.import') }}
				</N8nButton>
				<N8nButton
					variant="subtle"
					float="right"
					data-test-id="cancel-workflow-import-url-button"
					@click="closeModal"
				>
					{{ i18n.baseText('mainSidebar.prompt.cancel') }}
				</N8nButton>
			</div>
		</template>
	</Modal>
</template>

<style lang="scss" module>
.error-text {
	color: var(--color--danger);
	font-size: var(--font-size--2xs);
	margin-top: var(--spacing--2xs);
	height: var(--spacing--sm);
	visibility: hidden;
}
.folder-label {
	display: block;
	margin-top: var(--spacing--sm);
	margin-bottom: var(--spacing--3xs);
	color: var(--color--text--tint-1);
}
.footer {
	display: flex;
	justify-content: flex-end;
	gap: var(--spacing--2xs);
}
.noScrollbar {
	overflow: hidden;
}
</style>
