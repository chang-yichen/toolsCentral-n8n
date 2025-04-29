<script setup lang="ts">
import type { FrontendSettings } from '@n8n/api-types';
import { computed, useCssModule, onMounted } from 'vue';
import { useUIStore } from '@/stores/ui.store';

// Import both logo versions with the correct filenames - using require for direct URL
// Use direct asset imports instead of module imports for SVGs
const ToolsCentralLogoLight = new URL(
	'@/assets/images/tools-central-logo-light.svg',
	import.meta.url,
).href;
const ToolsCentralLogoDark = new URL('@/assets/images/tools-central-logo-dark.svg', import.meta.url)
	.href;

const props = defineProps<
	(
		| {
				location: 'authView';
		  }
		| {
				location: 'sidebar';
				collapsed: boolean;
		  }
	) & {
		releaseChannel: FrontendSettings['releaseChannel'];
	}
>();

const { location } = props;
const uiStore = useUIStore();

// Determine which logo to use based on current theme
const logoSrc = computed(() => {
	return uiStore.appliedTheme === 'dark' ? ToolsCentralLogoDark : ToolsCentralLogoLight;
});

// Add console log to debug the logo source
onMounted(() => {
	console.log('Logo source:', logoSrc.value);
	console.log('Dark logo URL:', ToolsCentralLogoDark);
	console.log('Light logo URL:', ToolsCentralLogoLight);
});

const $style = useCssModule();
const containerClasses = computed(() => {
	if (location === 'authView') {
		return [$style.logoContainer, $style.authView];
	}
	return [
		$style.logoContainer,
		$style.sidebar,
		props.collapsed ? $style.sidebarCollapsed : $style.sidebarExpanded,
	];
});
</script>

<template>
	<div :class="containerClasses" data-test-id="n8n-logo">
		<img :src="logoSrc" alt="Tools Central Logo" :class="$style.logoImage" />
		<slot />
	</div>
</template>

<style lang="scss" module>
.logoContainer {
	display: flex;
	justify-content: center;
	align-items: center;
}

.authView {
	transform: scale(1.5);
	margin-bottom: var(--spacing-xl);
}

.logoImage {
	display: block;
	max-width: 100%;
	height: auto;
}

// Optional: Apply a filter to make the logo work better in dark mode
// Uncomment and adjust as needed
.darkMode {
	/* filter: brightness(0.8) invert(0.8); */
}

.sidebarExpanded .logoImage {
	height: 28px;
	width: auto;
	margin-left: var(--spacing-2xs);
}

.sidebarCollapsed .logoImage {
	height: 24px;
	width: auto;
	padding: 0 var(--spacing-4xs);
}
</style>
