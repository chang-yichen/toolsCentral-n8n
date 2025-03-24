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
					@click="showPublishForm = !showPublishForm"
				/>
			</div>

			<!-- Publish Form -->
			<div v-if="showPublishForm" class="publish-form">
				<h2>Publish a Workflow</h2>
				<form @submit.prevent="publishWorkflow">
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
						<label for="workflowId">Workflow ID</label>
						<n8n-input
							id="workflowId"
							v-model="publishForm.workflowId"
							placeholder="Enter ID of workflow to publish"
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
					<div v-for="workflow in marketplaceWorkflows" :key="workflow.id" class="workflow-card">
						<h3>{{ workflow.name }}</h3>
						<p>{{ workflow.description }}</p>
						<div class="workflow-meta">
							<span>By: {{ workflow.author }}</span>
							<span>Downloads: {{ workflow.downloads }}</span>
						</div>
					</div>
				</div>
			</div>

			<router-link to="/">Back to Home</router-link>
		</div>
	</PageViewLayout>
</template>

<script>
import { PageViewLayout } from '@/components/layouts';
import { getMarketplaceWorkflows, publishToMarketplace } from '@/api/marketplace';

export default {
	name: 'PlaceholderPage',
	components: {
		PageViewLayout,
	},
	data() {
		return {
			marketplaceWorkflows: [],
			loading: false,
			error: null,
			workflowsLoaded: false,
			showPublishForm: false,
			publishing: false,
			publishForm: {
				name: '',
				description: '',
				workflowId: '',
				category: 'automation',
				isPublic: true,
			},
		};
	},
	methods: {
		async fetchWorkflows() {
			this.loading = true;
			this.error = null;

			try {
				// Call our API function
				const workflows = await getMarketplaceWorkflows();

				this.marketplaceWorkflows = workflows;
				this.workflowsLoaded = true;
			} catch (err) {
				console.error('Error in fetchWorkflows:', err);
				this.error = 'Failed to load marketplace workflows. Please try again.';
			} finally {
				this.loading = false;
			}
		},

		async publishWorkflow() {
			if (!this.publishForm.name || !this.publishForm.description || !this.publishForm.workflowId) {
				// Simple validation - in real app you'd use proper form validation
				alert('Please fill in all required fields');
				return;
			}

			this.publishing = true;

			try {
				// Call the publish API
				const result = await publishToMarketplace(this.publishForm);

				// Show success message
				alert(`Successfully published "${result.name}" to the marketplace.`);

				// Reset form and close it
				this.showPublishForm = false;
				this.publishForm = {
					name: '',
					description: '',
					workflowId: '',
					category: 'automation',
					isPublic: true,
				};

				// Add the new workflow to the list
				this.marketplaceWorkflows = [result, ...this.marketplaceWorkflows];
			} catch (err) {
				console.error('Error publishing workflow:', err);
				alert('Failed to publish workflow: ' + (err.message || 'Unknown error'));
			} finally {
				this.publishing = false;
			}
		},
	},
	mounted() {
		this.fetchWorkflows();
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
}
</style>
