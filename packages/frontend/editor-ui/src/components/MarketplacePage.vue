<template>
	<div class="marketplace-page">
		<!-- Publishing Banner at the top -->
		<div class="publish-banner">
			<div class="publish-banner-content">
				<div class="banner-text">
					<h2>Publish Your Workflow</h2>
					<p>Share your automation workflows with the n8n community</p>
				</div>
				<n8n-button label="Publish Workflow" type="primary" size="large" @click="openPublishForm" />
			</div>
		</div>

		<h1>Workflow Marketplace</h1>
		<p class="marketplace-description">
			Discover and share workflows with the community. Browse the available workflows below.
		</p>

		<!-- Filter options -->
		<div class="marketplace-filters">
			<div class="search-container">
				<n8n-input v-model="searchTerm" placeholder="Search workflows..." @input="filterWorkflows">
					<template #prefix>
						<n8n-icon icon="search" />
					</template>
				</n8n-input>
			</div>
			<div class="category-filter">
				<n8n-select
					v-model="selectedCategory"
					placeholder="All Categories"
					@change="filterWorkflows"
				>
					<n8n-option value="">All Categories</n8n-option>
					<n8n-option value="automation">Automation</n8n-option>
					<n8n-option value="data-processing">Data Processing</n8n-option>
					<n8n-option value="integration">Integration</n8n-option>
					<n8n-option value="utility">Utility</n8n-option>
				</n8n-select>
			</div>
			<div class="sort-by">
				<n8n-select v-model="sortBy" placeholder="Sort by" @change="filterWorkflows">
					<n8n-option value="recent">Most Recent</n8n-option>
					<n8n-option value="popular">Most Popular</n8n-option>
					<n8n-option value="name">Name (A-Z)</n8n-option>
				</n8n-select>
			</div>
		</div>

		<!-- Publish Form Modal -->
		<div v-if="showPublishForm" class="modal-overlay" @click="showPublishForm = false">
			<div class="publish-form-modal" @click.stop>
				<div class="modal-header">
					<h2>Publish a Workflow</h2>
					<button class="close-button" @click="showPublishForm = false">×</button>
				</div>
				<form @submit.prevent="publishWorkflow">
					<!-- Workflow Selection -->
					<div class="form-group">
						<label for="workflowSelect">Select a Workflow</label>
						<n8n-select
							id="workflowSelect"
							v-model="selectedWorkflowId"
							placeholder="Select workflow to publish"
							@change="onWorkflowSelected"
						>
							<n8n-option v-for="workflow in userWorkflows" :key="workflow.id" :value="workflow.id">
								{{ workflow.name }}
							</n8n-option>
						</n8n-select>
					</div>

					<div class="form-group">
						<label for="name">Workflow Name</label>
						<n8n-input
							id="name"
							v-model="publishForm.name"
							placeholder="Enter workflow name"
							required
						/>
					</div>
					<div class="form-group">
						<label for="description">Description</label>
						<n8n-input
							id="description"
							v-model="publishForm.description"
							type="textarea"
							placeholder="Enter description"
							:required="!publishForm.useAutoDescription"
							:disabled="publishForm.useAutoDescription"
						/>
					</div>
					<div class="form-group checkbox">
						<n8n-checkbox
							v-model="publishForm.useAutoDescription"
							@change="handleAutoDescriptionChange"
						>
							Generate description automatically (max 30 words)
						</n8n-checkbox>
						<small
							v-if="
								publishForm.useAutoDescription &&
								!publishForm.previewDescription &&
								!loadingPreview &&
								!previewError
							"
							class="help-text"
						>
							We'll analyze your workflow and create a concise description automatically.
						</small>
						<div
							v-if="
								publishForm.useAutoDescription &&
								(publishForm.previewDescription || loadingPreview || previewError)
							"
							class="preview-description"
						>
							<div class="preview-header">
								<span>Preview:</span>
								<n8n-button
									v-if="!loadingPreview"
									size="small"
									type="tertiary"
									@click="generateDescriptionPreview"
								>
									Refresh
								</n8n-button>
							</div>
							<div class="preview-content">
								<n8n-loading v-if="loadingPreview" :loading="loadingPreview" :rows="2" />
								<div v-else-if="previewError" class="preview-error">
									<p>{{ previewError }}</p>
									<small
										>You can still continue with this auto-generated description or turn off
										auto-description and write your own.</small
									>
								</div>
								<p v-else>{{ publishForm.previewDescription }}</p>
							</div>
						</div>
					</div>
					<div class="form-group">
						<label for="category">Category</label>
						<n8n-select id="category" v-model="publishForm.category" placeholder="Select category">
							<n8n-option value="automation">Automation</n8n-option>
							<n8n-option value="data-processing">Data Processing</n8n-option>
							<n8n-option value="integration">Integration</n8n-option>
							<n8n-option value="utility">Utility</n8n-option>
						</n8n-select>
					</div>
					<div class="form-group checkbox">
						<n8n-checkbox v-model="publishForm.isPublic">Make workflow public</n8n-checkbox>
					</div>
					<div class="form-actions">
						<n8n-button type="secondary" @click="showPublishForm = false">Cancel</n8n-button>
						<n8n-button type="primary" :loading="publishing" native-type="submit"
							>Publish</n8n-button
						>
					</div>
				</form>
			</div>
		</div>

		<div v-if="loading" class="marketplace-content">
			<n8n-loading :rows="3" :loading="loading" />
		</div>
		<div v-else-if="error" class="marketplace-content error">
			<p>{{ error }}</p>
			<n8n-button @click="fetchWorkflows" label="Try Again" type="primary" size="medium" />
		</div>
		<div
			v-else-if="workflowsLoaded && filteredWorkflows.length === 0"
			class="marketplace-content empty"
		>
			<n8n-icon icon="box-open" size="xlarge" />
			<p>No workflows found in the marketplace.</p>
			<n8n-button @click="resetFilters" label="Reset Filters" type="tertiary" size="medium" />
		</div>
		<div v-else-if="workflowsLoaded" class="marketplace-workflows">
			<div class="workflow-cards">
				<div
					v-for="workflow in filteredWorkflows"
					:key="workflow.id"
					class="workflow-card"
					@click="viewWorkflowDetails(workflow)"
				>
					<div class="card-header">
						<h3>{{ workflow.name }}</h3>
						<div class="category-tag">{{ workflow.category }}</div>
					</div>
					<p class="card-description" :title="workflow.description">
						{{
							workflow.description !== 'No description available'
								? workflow.description
								: 'No description available'
						}}
					</p>
					<div class="card-footer">
						<div class="author">
							<n8n-avatar :first-name="workflow.author" size="small" />
							<span>{{ workflow.author }}</span>
						</div>
						<div class="stats">
							<div class="stat-item">
								<n8n-icon icon="download" size="small" />
								<span>{{ workflow.downloads }}</span>
							</div>
							<div class="stat-item">
								<n8n-icon icon="calendar" size="small" />
								<span>{{ formatDate(workflow.createdAt) }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Workflow Details Modal -->
		<div v-if="selectedWorkflow" class="modal-overlay" @click="selectedWorkflow = null">
			<div class="workflow-modal" @click.stop>
				<div class="modal-header">
					<h2>{{ selectedWorkflow.name }}</h2>
					<button class="close-button" @click="selectedWorkflow = null">×</button>
				</div>
				<div class="modal-content">
					<div class="description-section">
						<h3>Description</h3>
						<p
							class="description"
							v-if="
								selectedWorkflow.description &&
								selectedWorkflow.description !== 'No description available'
							"
						>
							{{ selectedWorkflow.description }}
						</p>
						<p class="description description-empty" v-else>
							No description available for this workflow.
						</p>
					</div>

					<div class="details-meta">
						<div class="meta-item">
							<n8n-icon icon="user" />
							<span><strong>Author:</strong> {{ selectedWorkflow.author }}</span>
						</div>
						<div class="meta-item">
							<n8n-icon icon="download" />
							<span><strong>Downloads:</strong> {{ selectedWorkflow.downloads }}</span>
						</div>
						<div class="meta-item">
							<n8n-icon icon="tag" />
							<span><strong>Category:</strong> {{ selectedWorkflow.category }}</span>
						</div>
						<div class="meta-item">
							<n8n-icon icon="calendar" />
							<span><strong>Published:</strong> {{ formatDate(selectedWorkflow.createdAt) }}</span>
						</div>
					</div>

					<div class="action-buttons">
						<n8n-button
							label="Copy to My Workflows"
							type="primary"
							@click="importWorkflow(selectedWorkflow)"
						>
							<template #icon>
								<n8n-icon icon="plus" />
							</template>
						</n8n-button>
						<n8n-button
							v-if="isAdmin || isAuthorOfSelectedWorkflow"
							label="Delete Workflow"
							type="danger"
							@click.stop="deleteWorkflow(selectedWorkflow)"
							class="delete-button"
						>
							<template #icon>
								<n8n-icon icon="trash" />
							</template>
						</n8n-button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRootStore } from '@/stores/root.store';
import { useUsersStore } from '@/stores/users.store';
import {
	getMarketplaceWorkflows,
	publishToMarketplace,
	getUserWorkflows,
	importMarketplaceWorkflow,
	getAutoDescriptionPreview,
	deleteMarketplaceWorkflow,
} from '@/api/marketplace';

export default {
	name: 'MarketplacePage',
	components: {},
	setup() {
		const route = useRoute();
		const router = useRouter();
		const rootStore = useRootStore();
		const usersStore = useUsersStore();
		const restApiContext = computed(() => rootStore.restApiContext);

		const marketplaceWorkflows = ref([]);
		const filteredWorkflows = ref([]);
		const userWorkflows = ref([]);
		const loading = ref(false);
		const error = ref(null);
		const workflowsLoaded = ref(false);
		const showPublishForm = ref(false);
		const publishing = ref(false);
		const loadingUserWorkflows = ref(false);
		const loadingPreview = ref(false);
		const previewError = ref('');
		const selectedWorkflowId = ref(null);
		const selectedWorkflow = ref(null);
		const searchTerm = ref('');
		const selectedCategory = ref('');
		const sortBy = ref('recent');
		const publishForm = ref({
			name: '',
			description: '',
			workflowId: '',
			category: 'automation',
			isPublic: true,
			useAutoDescription: false,
			previewDescription: '',
		});
		let refreshInterval = null;

		// Check if current user is an admin
		const isAdmin = computed(() => {
			const user = usersStore?.currentUser;
			return user && (user.role === 'global:admin' || user.role === 'global:owner');
		});

		// Add a computed property for checking if user is author
		const isAuthorOfSelectedWorkflow = computed(() => {
			if (!selectedWorkflow.value || !usersStore?.currentUser) return false;

			console.log('Comparing workflowId:', selectedWorkflow.value.id);
			console.log('Workflow authorId:', selectedWorkflow.value.authorId);
			console.log('Current user ID:', usersStore.currentUser.id);

			// Check the string representation to account for type mismatches
			const authorIdStr = String(selectedWorkflow.value.authorId);
			const userIdStr = String(usersStore.currentUser.id);

			console.log('String comparison:', authorIdStr === userIdStr);

			return authorIdStr === userIdStr;
		});

		const fetchWorkflows = async () => {
			console.log('Fetching marketplace workflows...');
			loading.value = true;
			error.value = null;
			try {
				const workflows = await getMarketplaceWorkflows(restApiContext.value);
				console.log('Retrieved workflows count:', workflows.length);
				console.log('First workflow:', workflows[0]);

				// Ensure we have the latest data
				marketplaceWorkflows.value = workflows;

				// Apply any active filters
				if (searchTerm.value || selectedCategory.value) {
					filterWorkflows();
				} else {
					// Reset filtered workflows to show all workflows
					filteredWorkflows.value = [...marketplaceWorkflows.value];
				}

				workflowsLoaded.value = true;
				console.log('Workflows loaded, filtered count:', filteredWorkflows.value.length);
			} catch (err) {
				console.error('Error in fetchWorkflows:', err);
				error.value = err.message || 'Failed to load marketplace workflows. Please try again.';
			} finally {
				loading.value = false;
			}
		};

		const filterWorkflows = () => {
			console.log('Filtering workflows...');
			console.log('Search term:', searchTerm.value);
			console.log('Selected category:', selectedCategory.value);
			console.log('Sort by:', sortBy.value);
			console.log('Total workflows to filter:', marketplaceWorkflows.value.length);

			let filtered = [...marketplaceWorkflows.value];

			// Filter by search term
			if (searchTerm.value) {
				const term = searchTerm.value.toLowerCase();
				filtered = filtered.filter(
					(wf) =>
						wf.name.toLowerCase().includes(term) ||
						wf.description.toLowerCase().includes(term) ||
						wf.author.toLowerCase().includes(term),
				);
				console.log('After search filter, count:', filtered.length);
			}

			// Filter by category
			if (selectedCategory.value) {
				filtered = filtered.filter((wf) => wf.category === selectedCategory.value);
				console.log('After category filter, count:', filtered.length);
			}

			// Sort results
			switch (sortBy.value) {
				case 'recent':
					filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
					break;
				case 'popular':
					filtered.sort((a, b) => b.downloads - a.downloads);
					break;
				case 'name':
					filtered.sort((a, b) => a.name.localeCompare(b.name));
					break;
			}

			// Update the filtered workflows with a new array to ensure reactivity
			filteredWorkflows.value = [...filtered];
			console.log('Final filtered count:', filteredWorkflows.value.length);
			if (filteredWorkflows.value.length > 0) {
				console.log('First filtered workflow:', filteredWorkflows.value[0].name);
			}
		};

		const resetFilters = () => {
			searchTerm.value = '';
			selectedCategory.value = '';
			sortBy.value = 'recent';
			filteredWorkflows.value = [...marketplaceWorkflows.value];
		};

		const openPublishForm = async () => {
			showPublishForm.value = true;
			loadingUserWorkflows.value = true;
			try {
				userWorkflows.value = await getUserWorkflows(restApiContext.value);
			} catch (err) {
				console.error('Error fetching user workflows:', err);
				alert('Failed to load your workflows. Please try again.');
			} finally {
				loadingUserWorkflows.value = false;
			}
		};

		const onWorkflowSelected = () => {
			if (selectedWorkflowId.value) {
				const workflow = userWorkflows.value.find((w) => w.id === selectedWorkflowId.value);
				if (workflow) {
					publishForm.value.name = workflow.name;
					publishForm.value.workflowId = workflow.id;

					// If auto-description is enabled, generate a preview
					if (publishForm.value.useAutoDescription) {
						generateDescriptionPreview();
					}
				}
			}
		};

		const publishWorkflow = async () => {
			if (
				!publishForm.value.name ||
				(!publishForm.value.description && !publishForm.value.useAutoDescription) ||
				!selectedWorkflowId.value
			) {
				alert('Please fill in all required fields and select a workflow');
				return;
			}

			publishForm.value.workflowId = selectedWorkflowId.value;
			console.log('Publishing workflow:', publishForm.value);

			// If using auto-description and we have a preview, use it
			if (publishForm.value.useAutoDescription && publishForm.value.previewDescription) {
				publishForm.value.description = publishForm.value.previewDescription;
			}

			publishing.value = true;
			try {
				const result = await publishToMarketplace(restApiContext.value, publishForm.value);
				console.log('Publish result:', result);
				alert(`Successfully published "${result.name}" to the marketplace.`);
				showPublishForm.value = false;
				publishForm.value = {
					name: '',
					description: '',
					workflowId: '',
					category: 'automation',
					isPublic: true,
					useAutoDescription: false,
					previewDescription: '',
				};
				selectedWorkflowId.value = null;

				// Update both arrays
				console.log(
					'Before update - marketplaceWorkflows count:',
					marketplaceWorkflows.value.length,
				);
				console.log('Before update - filteredWorkflows count:', filteredWorkflows.value.length);

				// Make a new array instead of modifying the existing one to ensure reactivity
				marketplaceWorkflows.value = [result, ...marketplaceWorkflows.value];
				console.log(
					'After adding - marketplaceWorkflows count:',
					marketplaceWorkflows.value.length,
				);

				// Reset to original values and re-apply current filters
				if (searchTerm.value || selectedCategory.value) {
					console.log('Applying filters after publish');
					filterWorkflows();
				} else {
					// If no filters, just copy the data
					console.log('No filters, copying all data to filtered view');
					filteredWorkflows.value = [...marketplaceWorkflows.value];
				}

				console.log('After update - filteredWorkflows count:', filteredWorkflows.value.length);
				console.log('First workflow in filtered list:', filteredWorkflows.value[0]?.name);

				// Force re-render the component
				setTimeout(() => {
					fetchWorkflows();
				}, 500);
			} catch (err) {
				console.error('Error publishing workflow:', err);
				alert('Failed to publish workflow: ' + (err.message || 'Unknown error'));
			} finally {
				publishing.value = false;
			}
		};

		const viewWorkflowDetails = (workflow) => {
			console.log('Opening workflow details:', workflow);
			console.log('Workflow authorId:', workflow.authorId);
			console.log('Current user ID:', usersStore?.currentUser?.id);
			console.log('Is owner check:', workflow.authorId === usersStore?.currentUser?.id);
			console.log('Is admin check:', isAdmin.value);
			selectedWorkflow.value = { ...workflow }; // Create a fresh copy to ensure reactivity
		};

		const importWorkflow = async (workflowToImport) => {
			try {
				// Ensure we have a valid ID object
				if (!workflowToImport || !workflowToImport.id) {
					throw new Error('Invalid workflow selected for import');
				}

				// Log the workflow ID for debugging
				console.log('Importing workflow with ID:', workflowToImport.id);

				const response = await importMarketplaceWorkflow(restApiContext.value, workflowToImport.id);

				// Update the download count in the UI without waiting for a refresh
				const { workflow: importedWf, marketplaceWorkflow } = response;

				// Update the selected workflow's download count
				if (selectedWorkflow.value && selectedWorkflow.value.id === marketplaceWorkflow.id) {
					selectedWorkflow.value.downloads = marketplaceWorkflow.downloads;
				}

				// Update the workflow in both arrays to reflect new download count
				marketplaceWorkflows.value = marketplaceWorkflows.value.map((wf) =>
					wf.id === marketplaceWorkflow.id
						? { ...wf, downloads: marketplaceWorkflow.downloads }
						: wf,
				);

				filteredWorkflows.value = filteredWorkflows.value.map((wf) =>
					wf.id === marketplaceWorkflow.id
						? { ...wf, downloads: marketplaceWorkflow.downloads }
						: wf,
				);

				alert(`Workflow "${importedWf.name}" has been copied to your workflows.`);

				// Don't close the modal so user can see updated download count
				// selectedWorkflow.value = null;
			} catch (err) {
				console.error('Error importing workflow:', err);

				// Provide more specific error messages based on the error type
				if (err.message && err.message.includes('circular references')) {
					alert(
						'This workflow contains complex HTTP connections that cannot be automatically imported. ' +
							'Please contact the administrator or try importing a different workflow.',
					);
				} else if (err.message && err.message.includes('not found')) {
					alert('This workflow is no longer available in the marketplace.');
				} else if (err.response && err.response.status === 404) {
					alert('This workflow is no longer available in the marketplace.');
				} else if (err.response && err.response.status === 403) {
					alert('You do not have permission to import this workflow.');
				} else {
					alert('Failed to import workflow: ' + (err.message || 'Unknown error'));
				}
			}
		};

		const formatDate = (dateString) => {
			if (!dateString) return '';
			const date = new Date(dateString);
			return new Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			}).format(date);
		};

		const truncateDescription = (description) => {
			if (!description || description.trim() === '') return 'No description available';
			return description.length > 150 ? description.substring(0, 150) + '...' : description;
		};

		const handleAutoDescriptionChange = () => {
			if (publishForm.value.useAutoDescription) {
				// Save current description in case user toggles back
				publishForm.value._savedDescription = publishForm.value.description;
				publishForm.value.description = '';
				previewError.value = ''; // Clear any previous errors

				// Generate a preview if a workflow is selected
				if (selectedWorkflowId.value) {
					generateDescriptionPreview();
				}
			} else if (publishForm.value._savedDescription) {
				// Restore saved description if it exists
				publishForm.value.description = publishForm.value._savedDescription;
				delete publishForm.value._savedDescription;
				publishForm.value.previewDescription = '';
				previewError.value = '';
			}
		};

		const generateDescriptionPreview = async () => {
			if (!selectedWorkflowId.value) {
				alert('Please select a workflow first');
				return;
			}

			loadingPreview.value = true;
			previewError.value = '';

			try {
				const preview = await getAutoDescriptionPreview(
					restApiContext.value,
					selectedWorkflowId.value,
				);
				publishForm.value.previewDescription = preview;
				// If the preview looks like a fallback (it contains node count), show a warning
				if (preview.includes('nodes total)')) {
					previewError.value = 'Using simplified description due to AI service unavailability.';
				}
			} catch (err) {
				console.error('Error generating description preview:', err);
				previewError.value = err.message || 'Failed to generate description preview';

				// Generate a basic description as fallback
				publishForm.value.previewDescription = `Workflow "${publishForm.value.name}" - select to see more details`;
			} finally {
				loadingPreview.value = false;
			}
		};

		const startRefreshInterval = () => {
			// Clear any existing interval
			if (refreshInterval) {
				clearInterval(refreshInterval);
			}

			// Set up a new refresh interval (every 30 seconds)
			refreshInterval = setInterval(() => {
				console.log('Auto-refreshing marketplace workflows...');
				fetchWorkflows();
			}, 30000); // 30 seconds
		};

		const stopRefreshInterval = () => {
			if (refreshInterval) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}
		};

		const deleteWorkflow = async (workflowToDelete) => {
			if (!workflowToDelete || !workflowToDelete.id) {
				alert('Invalid workflow selected for deletion');
				return;
			}

			const confirmDelete = confirm(
				`Are you sure you want to delete the workflow "${workflowToDelete.name}" from the marketplace? This action cannot be undone.`,
			);

			if (!confirmDelete) return;

			try {
				await deleteMarketplaceWorkflow(restApiContext.value, workflowToDelete.id);
				alert(`Workflow "${workflowToDelete.name}" has been deleted from the marketplace.`);

				// Remove the workflow from the lists
				marketplaceWorkflows.value = marketplaceWorkflows.value.filter(
					(wf) => wf.id !== workflowToDelete.id,
				);
				filteredWorkflows.value = filteredWorkflows.value.filter(
					(wf) => wf.id !== workflowToDelete.id,
				);

				selectedWorkflow.value = null; // Close the modal
			} catch (err) {
				console.error('Error deleting workflow:', err);
				alert('Failed to delete workflow: ' + (err.message || 'Unknown error'));
			}
		};

		onMounted(() => {
			fetchWorkflows();
			startRefreshInterval();

			const { publish, workflowId, workflowName } = route.query;
			if (publish === 'true' && workflowId) {
				selectedWorkflowId.value = workflowId;
				publishForm.value.name = workflowName || '';
				publishForm.value.workflowId = workflowId;
				openPublishForm();
			}
		});

		// Clean up the interval when the component is unmounted
		onUnmounted(() => {
			stopRefreshInterval();
		});

		return {
			marketplaceWorkflows,
			filteredWorkflows,
			userWorkflows,
			loading,
			error,
			workflowsLoaded,
			showPublishForm,
			publishing,
			loadingUserWorkflows,
			loadingPreview,
			previewError,
			selectedWorkflowId,
			selectedWorkflow,
			publishForm,
			searchTerm,
			selectedCategory,
			sortBy,
			isAdmin,
			isAuthorOfSelectedWorkflow,
			fetchWorkflows,
			filterWorkflows,
			resetFilters,
			openPublishForm,
			onWorkflowSelected,
			publishWorkflow,
			viewWorkflowDetails,
			importWorkflow,
			deleteWorkflow,
			formatDate,
			truncateDescription,
			handleAutoDescriptionChange,
			generateDescriptionPreview,
			startRefreshInterval,
			stopRefreshInterval,
		};
	},
};
</script>

<style lang="scss" scoped>
.marketplace-page {
	padding: 20px;
	width: 100%;
	margin: 0 auto;
	text-align: center;
	overflow-y: auto;
	height: 100%;

	h1 {
		margin: 1em 0 0.5em;
		font-size: 28px;
	}

	.marketplace-description {
		margin-bottom: 2em;
		font-size: 16px;
		color: var(--color-text-base);
	}

	.publish-banner {
		background: linear-gradient(to right, var(--color-primary-tint-1), var(--color-primary));
		padding: 2em;
		color: white;
		border-radius: 8px;
		margin-bottom: 1em;

		.publish-banner-content {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin: 0 auto;
		}

		.banner-text {
			text-align: left;

			h2 {
				font-size: 24px;
				margin: 0 0 0.5em;
				color: white;
			}

			p {
				margin: 0;
				font-size: 16px;
				opacity: 0.9;
			}
		}
	}

	.marketplace-filters {
		display: flex;
		gap: 1em;
		margin-bottom: 2em;
		justify-content: center;

		.search-container {
			flex: 1;
			max-width: 400px;
		}

		.category-filter,
		.sort-by {
			width: 180px;
		}
	}

	.marketplace-content {
		margin: 2em 0;
		min-height: 300px;
		border-radius: 8px;
		padding: 2em;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: var(--color-background-light);

		&.error {
			border: 1px solid var(--color-danger);
			color: var(--color-danger);
		}

		&.empty {
			color: var(--color-text-light);

			svg {
				margin-bottom: 1em;
				opacity: 0.5;
			}
		}
	}

	.marketplace-workflows {
		margin: 2em 0;
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.workflow-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5em;
		text-align: left;
		max-width: 1200px;
		width: 100%;
	}

	.workflow-card {
		background-color: var(--color-background-light);
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		padding: 1.5em;
		transition: all 0.2s ease;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		height: 100%;
		border: 1px solid var(--color-foreground-base);

		&:hover {
			transform: translateY(-3px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
			border-color: var(--color-primary-tint-2);
		}

		.card-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			margin-bottom: 1em;

			h3 {
				margin: 0;
				font-size: 18px;
				color: var(--color-text-dark);
			}

			.category-tag {
				font-size: 12px;
				padding: 4px 8px;
				border-radius: 12px;
				background-color: var(--color-foreground-base);
				color: var(--color-text-light);
				white-space: nowrap;
			}
		}

		.card-description {
			color: var(--color-text-base);
			margin-bottom: 1.5em;
			flex-grow: 1;
			font-size: 14px;
			line-height: 1.5;
			overflow: hidden;
			display: -webkit-box;
			-webkit-line-clamp: 4;
			-webkit-box-orient: vertical;
			min-height: 4.5em; /* Ensures consistent height even with short or no description */
		}

		.card-footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 12px;
			color: var(--color-text-light);

			.author {
				display: flex;
				align-items: center;
				gap: 0.5em;
			}

			.stats {
				display: flex;
				gap: 1em;

				.stat-item {
					display: flex;
					align-items: center;
					gap: 4px;
				}
			}
		}
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.workflow-modal,
	.publish-form-modal {
		background-color: var(--color-background-xlight);
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		text-align: left;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		overflow: hidden;

		.modal-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 1.5em;
			border-bottom: 1px solid var(--color-foreground-base);

			h2 {
				margin: 0;
				font-size: 20px;
			}

			.close-button {
				background: none;
				border: none;
				font-size: 24px;
				cursor: pointer;
				color: var(--color-text-light);
				padding: 0;
				line-height: 1;

				&:hover {
					color: var(--color-text-dark);
				}
			}
		}

		.modal-content {
			padding: 1.5em;

			.description-section {
				margin-bottom: 2em;

				h3 {
					margin-top: 0;
					margin-bottom: 0.5em;
					font-size: 16px;
					color: var(--color-text-dark);
				}

				.description {
					margin-bottom: 0;
					line-height: 1.6;
					color: var(--color-text-base);
					white-space: pre-line;
				}
			}

			.details-meta {
				margin-bottom: 2em;
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 1em;

				.meta-item {
					display: flex;
					align-items: center;
					gap: 0.5em;
					margin-bottom: 0.5em;
					color: var(--color-text-base);

					svg {
						color: var(--color-text-light);
					}
				}
			}

			.action-buttons {
				display: flex;
				justify-content: center;
				margin-top: 1.5em;
				gap: 15px;
			}
		}
	}

	.publish-form-modal {
		form {
			padding: 1.5em;

			.form-group {
				margin-bottom: 1.5em;

				label {
					display: block;
					margin-bottom: 0.5em;
					font-weight: 600;
					color: var(--color-text-dark);
				}

				&.checkbox {
					display: flex;
					align-items: center;
				}
			}

			.form-actions {
				display: flex;
				justify-content: flex-end;
				gap: 1em;
				margin-top: 2em;
			}
		}
	}

	.preview-description {
		margin-top: 0.5em;
		padding: 0.8em;
		background-color: var(--color-background-light);
		border-radius: 4px;
		border: 1px solid var(--color-foreground-base);

		.preview-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 0.5em;
			font-weight: bold;
			font-size: 12px;
			color: var(--color-text-base);
		}

		.preview-content {
			min-height: 60px;

			p {
				margin: 0;
				font-size: 14px;
				color: var(--color-text-dark);
				line-height: 1.5;
			}

			.preview-error {
				padding: 0.5em;
				background-color: var(--color-warning-tint-2);
				border-radius: 3px;

				p {
					color: var(--color-warning);
					font-weight: 600;
					margin-bottom: 0.5em;
				}

				small {
					color: var(--color-text-dark);
					font-size: 12px;
				}
			}
		}
	}

	.help-text {
		display: block;
		margin-top: 0.5em;
		font-size: 12px;
		color: var(--color-text-light);
	}
}
</style>
