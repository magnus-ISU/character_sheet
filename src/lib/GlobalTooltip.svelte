<script lang="ts">
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	// Exported state - minimal interface
	let {
		visible = $bindable(false),
		content = $bindable<TooltipContent>({ name: '', description: '', type: 'feature', chips: [] })
	} = $props();

	// Internal state
	let tooltipElement: HTMLDivElement | undefined = $state(undefined);
	let showTimeout: null | number = $state(null);
	let isShaking = $state(false);

	const SHOW_DELAY = 0;

	// Public methods exposed via $bindable
	export function show(tooltip: TooltipContent) {
		// Clear any pending timeout
		if (showTimeout) {
			clearTimeout(showTimeout);
		}

		showTimeout = setTimeout(() => {
			content = tooltip;
			visible = true;
		}, SHOW_DELAY);

		isShaking = false;
	}

	export function hide() {
		visible = false;
		if (showTimeout) {
			clearTimeout(showTimeout);
			showTimeout = null;
		}
	}

	export function setShaking(shaking: boolean) {
		isShaking = shaking;
	}

	// Dynamic gradient based on tooltip type
	function getGradientClass(type: 'feature' | 'character' | 'skill' | 'item') {
		switch (type) {
			case 'feature':
				return 'gradient-feature';
			case 'character':
				return 'gradient-character';
			case 'skill':
				return 'gradient-skill';
			case 'item':
				return 'gradient-item';
			default:
				return 'gradient-default';
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
{#if visible}
	<div
		bind:this={tooltipElement}
		class="global-tooltip {getGradientClass(content.type)} {isShaking ? 'shaking' : ''}"
		in:scale={{ duration: 300, easing: quintOut, start: 0.8 }}
		role="tooltip"
		aria-live="polite"
	>
		<div class="tooltip-glow"></div>
		<div class="tooltip-content">
			<h3 class="tooltip-title">{content.name}</h3>
			<p class="tooltip-description">{content.description}</p>
			<div class="tooltip-chips">
				{#if content.type !== 'attack'}
					<div class="tooltip-type-badge">{content.type}</div>
				{/if}
				{#each content.chips as chip}
					<span class="tooltip-type-badge">{chip}</span>
				{/each}
			</div>
		</div>
		<div class="tooltip-border"></div>
	</div>
{/if}

<style>
	/* Base positioning - always at bottom */
	.global-tooltip {
		position: fixed;
		top: 82vh;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(600px, calc(100vw - 40px));
		z-index: 9999;
		border-radius: 16px;
		padding: 2px;
		backdrop-filter: blur(20px);
		pointer-events: none;
	}

	/* Shaking animation */
	.global-tooltip.shaking {
		animation:
			tooltipShake 0.3s ease-in-out infinite,
			tooltipWarp 0.5s ease-in-out infinite alternate;
	}

	.tooltip-content {
		background: rgba(0, 0, 0, 0.85);
		border-radius: 14px;
		padding: 16px 24px;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.tooltip-glow {
		position: absolute;
		inset: -20px;
		border-radius: 20px;
		opacity: 0.3;
		filter: blur(20px);
		z-index: -1;
		animation: glowPulse 3s ease-in-out infinite alternate;
		background: inherit;
	}

	.shaking .tooltip-glow {
		animation:
			glowPulse 3s ease-in-out infinite alternate,
			glowShake 1.5s ease-in-out infinite;
	}

	.tooltip-border {
		position: absolute;
		inset: 0;
		border-radius: 16px;
		padding: 1px;
		background: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.2),
			transparent,
			rgba(255, 255, 255, 0.1)
		);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: exclude;
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask-composite: exclude;
	}

	.tooltip-title {
		margin: 0 0 8px 0;
		font-size: 20px;
		font-weight: 700;
		background: linear-gradient(135deg, #fff, #e0e0e0);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
	}

	.tooltip-description {
		margin: 0 0 12px 0;
		font-size: 15px;
		line-height: 1.4;
		color: rgba(255, 255, 255, 0.9);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		white-space: pre-line;
	}

	.tooltip-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
	}

	.tooltip-chip {
		display: inline-block;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 500;
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(5px);
	}

	.tooltip-type-badge {
		display: inline-block;
		padding: 6px 16px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(10px);
		align-self: flex-start;
	}

	/* Gradient variants */
	.gradient-feature {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}
	.gradient-feature .tooltip-glow {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}

	.gradient-character {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
	}
	.gradient-character .tooltip-glow {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
	}

	.gradient-skill {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
	}
	.gradient-skill .tooltip-glow {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
	}

	.gradient-item {
		background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
	}
	.gradient-item .tooltip-glow {
		background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
	}

	.gradient-default {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
	}
	.gradient-default .tooltip-glow {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
	}

	/* Animations */
	@keyframes glowPulse {
		0% {
			opacity: 0.2;
			transform: scale(1);
		}
		100% {
			opacity: 0.4;
			transform: scale(1.02);
		}
	}

	@keyframes glowShake {
		0%,
		100% {
			filter: blur(20px) hue-rotate(0deg);
		}
		50% {
			filter: blur(25px) hue-rotate(10deg);
		}
	}

	@keyframes tooltipShake {
		0%,
		100% {
			transform: translate(-50%, -50%) translateX(0px) rotateZ(0deg);
		}
		25% {
			transform: translate(-50%, -50%) translateX(-2px) rotateZ(-0.5deg);
		}
		75% {
			transform: translate(-50%, -50%) translateX(2px) rotateZ(0.5deg);
		}
	}

	@keyframes tooltipWarp {
		0% {
			border-radius: 16px;
			transform: translate(-50%, -50%) scale(1) skewX(0deg);
		}
		100% {
			border-radius: 12px 20px 14px 18px;
			transform: translate(-50%, -50%) scale(1.02) skewX(0.5deg);
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.global-tooltip {
			width: calc(100vw - 20px);
		}

		.tooltip-content {
			padding: 12px 20px;
		}

		.tooltip-title {
			font-size: 18px;
		}

		.tooltip-chip {
			font-size: 10px;
			padding: 3px 8px;
		}
	}
</style>
