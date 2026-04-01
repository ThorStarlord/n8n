<script setup lang="ts">
import Modal from '@/app/components/Modal.vue';
import { ref, computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useUIStore } from '@/app/stores/ui.store';
import { nodeViewEventBus } from '@/app/event-bus';
import { VALID_WORKFLOW_IMPORT_URL_REGEX, IMPORT_WORKFLOW_URL_MODAL_KEY } from '@/app/constants';
import MoveToFolderDropdown from '@/features/core/folders/components/MoveToFolderDropdown.vue';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import type { ChangeLocationSearchResult } from '@/features/core/folders/folders.types';

import { N8nButton, N8nInput, N8nText } from '@n8n/design-system';
const i18n = useI18n();
const uiStore = useUIStore();
const projectsStore = useProjectsStore();

const url = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const selectedFolder = ref<ChangeLocationSearchResult | null>(null);

const isValid = computed(() => {
	return url.value ? VALID_WORKFLOW_IMPORT_URL_REGEX.test(url.value) : true;
});

const closeModal = () => {
	uiStore.closeModal(IMPORT_WORKFLOW_URL_MODAL_KEY);
};

const confirm = () => {
	nodeViewEventBus.emit('importWorkflowUrl', {
		url: url.value,
		parentFolderId: selectedFolder.value?.id,
	});
	closeModal();
};

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
					:selected-location="selectedFolder"
					:selected-project-id="projectsStore.currentProjectId"
					@location:selected="selectedFolder = $event"
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
