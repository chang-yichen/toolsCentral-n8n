<template>
	<div class="placeholder-page">
		<h1>Custom Placeholder Page</h1>
		<p>This is a custom development page added to n8n.</p>
		<router-link to="/">Back to Home</router-link>
	</div>
</template>

<script>
export default {
	name: 'PlaceholderPage',
};
</script>

<style lang="scss">
.placeholder-page {
	padding: 2em;
	max-width: 800px;
	margin: 0 auto;
	text-align: center;
}
</style>
