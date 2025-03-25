<template>
	<n8n-tooltip :disabled="!disabled" placement="top" :content="tooltipContent">
		<div class="publish-button-container">
			<n8n-button
				:label="label"
				:disabled="disabled"
				:size="size"
				:type="type"
				@click="openPublishDialog"
			/>
		</div>
	</n8n-tooltip>
</template>

<script>
export default {
	name: 'PublishToMarketplaceButton',
	props: {
		workflowId: {
			type: String,
			required: true,
		},
		workflowName: {
			type: String,
			required: true,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		label: {
			type: String,
			default: 'Publish to Marketplace',
		},
		size: {
			type: String,
			default: 'medium',
		},
		type: {
			type: String,
			default: 'tertiary',
		},
		tooltipContent: {
			type: String,
			default: 'You need permissions to publish this workflow',
		},
	},
	methods: {
		openPublishDialog() {
			// Navigate to the marketplace page with query params
			this.$router.push({
				path: '/marketplace',
				query: {
					publish: 'true',
					workflowId: this.workflowId,
					workflowName: this.workflowName,
				},
			});
		},
	},
};
</script>

<style lang="scss" scoped>
.publish-button-container {
	display: inline-block;
}
</style>
