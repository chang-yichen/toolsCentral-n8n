<template>
	<PageViewLayout>
		<div class="marketplace-page">
			<h1>Workflow Marketplace</h1>
			<p>Discover and share workflows with the community.</p>

			<div class="marketplace-actions">
				<n8n-button label="Browse Workflows" type="primary" size="large" @click="fetchWorkflows" />
				<n8n-button
					label="Publish Workflow"
					type="secondary"
					size="large"
					@click="openPublishForm"
				/>
			</div>

			<!-- Publish Form -->
			<div v-if="showPublishForm" class="publish-form">
				<h2>Publish a Workflow</h2>
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
							required
						/>
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

			<div v-if="loading" class="marketplace-content">
				<n8n-loading :rows="3" :loading="loading" />
			</div>
			<div v-else-if="error" class="marketplace-content error">
				<p>{{ error }}</p>
				<n8n-button @click="fetchWorkflows" label="Try Again" type="primary" size="medium" />
			</div>
			<div
				v-else-if="workflowsLoaded && marketplaceWorkflows.length === 0"
				class="marketplace-content"
			>
				<p>No workflows found in the marketplace.</p>
			</div>
			<div v-else-if="workflowsLoaded" class="marketplace-workflows">
				<div class="workflow-cards">
					<div
						v-for="workflow in marketplaceWorkflows"
						:key="workflow.id"
						class="workflow-card"
						@click="viewWorkflowDetails(workflow)"
					>
						<h3>{{ workflow.name }}</h3>
						<p>{{ workflow.description }}</p>
						<div class="workflow-meta">
							<span>By: {{ workflow.author }}</span>
							<span>Downloads: {{ workflow.downloads }}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Workflow Details Modal -->
			<div v-if="selectedWorkflow" class="workflow-modal-overlay" @click="selectedWorkflow = null">
				<div class="workflow-modal" @click.stop>
					<h2>{{ selectedWorkflow.name }}</h2>
					<p class="description">{{ selectedWorkflow.description }}</p>

					<div class="details-meta">
						<div class="meta-item"><strong>Author:</strong> {{ selectedWorkflow.author }}</div>
						<div class="meta-item">
							<strong>Downloads:</strong> {{ selectedWorkflow.downloads }}
						</div>
						<div class="meta-item">
							<strong>Published:</strong> {{ formatDate(selectedWorkflow.createdAt) }}
						</div>
					</div>

					<div class="action-buttons">
						<n8n-button
							label="Copy to My Workflows"
							type="primary"
							@click="importWorkflow(selectedWorkflow)"
						/>
					</div>
				</div>
			</div>

			<router-link to="/">Back to Home</router-link>
		</div>
	</PageViewLayout>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PageViewLayout } from '@/components/layouts';
import { useRootStore } from '@/stores/root.store';
import {
	getMarketplaceWorkflows,
	publishToMarketplace,
	getUserWorkflows,
	importMarketplaceWorkflow,
} from '@/api/marketplace';

export default {
	name: 'MarketplacePage',
	components: {
		PageViewLayout,
	},
	setup() {
		const route = useRoute();
		const router = useRouter();
		const rootStore = useRootStore();
		const restApiContext = computed(() => rootStore.restApiContext);

		const marketplaceWorkflows = ref([]);
		const userWorkflows = ref([]);
		const loading = ref(false);
		const error = ref(null);
		const workflowsLoaded = ref(false);
		const showPublishForm = ref(false);
		const publishing = ref(false);
		const loadingUserWorkflows = ref(false);
		const selectedWorkflowId = ref(null);
		const selectedWorkflow = ref(null);
		const publishForm = ref({
			name: '',
			description: '',
			workflowId: '',
			category: 'automation',
			isPublic: true,
		});

		const fetchWorkflows = async () => {
			loading.value = true;
			error.value = null;
			try {
				marketplaceWorkflows.value = await getMarketplaceWorkflows(restApiContext.value);
				workflowsLoaded.value = true;
			} catch (err) {
				console.error('Error in fetchWorkflows:', err);
				error.value = err.message || 'Failed to load marketplace workflows. Please try again.';
			} finally {
				loading.value = false;
			}
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
				}
			}
		};

		const publishWorkflow = async () => {
			if (!publishForm.value.name || !publishForm.value.description || !selectedWorkflowId.value) {
				alert('Please fill in all required fields and select a workflow');
				return;
			}

			publishForm.value.workflowId = selectedWorkflowId.value;
			publishing.value = true;
			try {
				const result = await publishToMarketplace(restApiContext.value, publishForm.value);
				alert(`Successfully published "${result.name}" to the marketplace.`);
				showPublishForm.value = false;
				publishForm.value = {
					name: '',
					description: '',
					workflowId: '',
					category: 'automation',
					isPublic: true,
				};
				selectedWorkflowId.value = null;
				marketplaceWorkflows.value = [result, ...marketplaceWorkflows.value];
			} catch (err) {
				console.error('Error publishing workflow:', err);
				alert('Failed to publish workflow: ' + (err.message || 'Unknown error'));
			} finally {
				publishing.value = false;
			}
		};

		const viewWorkflowDetails = (workflow) => {
			selectedWorkflow.value = workflow;
		};

		const importWorkflow = async (workflowToImport) => {
			try {
				const importedWf = await importMarketplaceWorkflow(
					restApiContext.value,
					workflowToImport.id,
				);
				alert(`Workflow "${importedWf.name}" has been copied to your workflows.`);
				selectedWorkflow.value = null;
			} catch (err) {
				console.error('Error importing workflow:', err);
				alert('Failed to import workflow: ' + (err.message || 'Unknown error'));
			}
		};

		const formatDate = (dateString) => {
			if (!dateString) return '';
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
		};

		onMounted(() => {
			fetchWorkflows();

			const { publish, workflowId, workflowName } = route.query;
			if (publish === 'true' && workflowId) {
				selectedWorkflowId.value = workflowId;
				publishForm.value.name = workflowName || '';
				publishForm.value.workflowId = workflowId;
				openPublishForm();
			}
		});

		return {
			marketplaceWorkflows,
			userWorkflows,
			loading,
			error,
			workflowsLoaded,
			showPublishForm,
			publishing,
			loadingUserWorkflows,
			selectedWorkflowId,
			selectedWorkflow,
			publishForm,
			fetchWorkflows,
			openPublishForm,
			onWorkflowSelected,
			publishWorkflow,
			viewWorkflowDetails,
			importWorkflow,
			formatDate,
		};
	},
};
</script>

<style lang="scss" scoped>
.marketplace-page {
	padding: 2em;
	max-width: 1200px;
	margin: 0 auto;
	text-align: center;

	h1 {
		margin-bottom: 0.5em;
	}

	.marketplace-actions {
		display: flex;
		justify-content: center;
		gap: 1em;
		margin: 2em 0;
	}

	.publish-form {
		margin: 2em auto;
		max-width: 600px;
		text-align: left;
		border: 1px solid #eee;
		border-radius: 8px;
		padding: 2em;
		background-color: #fafafa;

		h2 {
			text-align: center;
			margin-bottom: 1em;
		}

		.form-group {
			margin-bottom: 1.5em;

			label {
				display: block;
				margin-bottom: 0.5em;
				font-weight: bold;
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

	.marketplace-content {
		margin: 2em 0;
		min-height: 200px;
		border: 1px dashed #ccc;
		border-radius: 8px;
		padding: 2em;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		&.error {
			border-color: #f56c6c;
			color: #f56c6c;
		}
	}

	.marketplace-workflows {
		margin: 2em 0;
	}

	.workflow-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5em;
		text-align: left;
	}

	.workflow-card {
		border: 1px solid #eee;
		border-radius: 8px;
		padding: 1.5em;
		transition: box-shadow 0.3s ease;
		cursor: pointer;

		&:hover {
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		}

		h3 {
			margin-top: 0;
			margin-bottom: 0.5em;
		}

		p {
			color: #666;
			margin-bottom: 1em;
		}

		.workflow-meta {
			display: flex;
			justify-content: space-between;
			font-size: 0.9em;
			color: #999;
		}
	}

	// Modal styles
	.workflow-modal-overlay {
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

	.workflow-modal {
		background-color: white;
		border-radius: 8px;
		padding: 2em;
		max-width: 600px;
		width: 90%;
		text-align: left;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);

		h2 {
			margin-top: 0;
			margin-bottom: 1em;
		}

		.description {
			margin-bottom: 2em;
			line-height: 1.6;
		}

		.details-meta {
			margin-bottom: 2em;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1em;

			.meta-item {
				margin-bottom: 0.5em;
			}
		}

		.action-buttons {
			display: flex;
			justify-content: center;
			margin-top: 1em;
		}
	}

	.back-link {
		display: block;
		margin-top: 2em;
	}
}
</style>
