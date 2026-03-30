<script lang="ts">
	import { globalState } from './global_state.svelte';
	import CharacterListCard from './CharacterListCard.svelte';
	import GlobalTooltip from './GlobalTooltip.svelte';
	import { groupby } from './util.svelte';

	let {
		tooltip,
		updateCharacterHealth
	}: {
		tooltip: GlobalTooltip | undefined;
		updateCharacterHealth: Function;
	} = $props();

	// Get character list and grouped characters
	let characterList = $derived(globalState.characterList);
	let groupedCharacters = $derived(groupby(characterList));

	function onCharacterRightClick(character: Character, e: MouseEvent) {
		e.preventDefault();
		// Right clicking a character sets it as focused
		globalState.setFocusedCharacter(character.index);
		globalState.clearAttackSelection();
		tooltip?.hide();
	}
</script>

<div class="character-list-container">
	<!-- Always show character list -->
	<div class="characters-grid">
		<div class="list-header">
			{#if globalState.focusedCharacterIndex !== undefined}
				<h3>Other Characters</h3>
				<button class="show-all-button" onclick={() => globalState.setFocusedCharacter(undefined)}>
					Show All Characters
				</button>
			{:else}
				<h3>All Characters</h3>
				<div class="instruction-text">Right-click any character to focus on it</div>
			{/if}
		</div>

		{#each groupedCharacters as group}
			<div class="template-row">
				{#each group as character (character.index)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="character-wrapper" oncontextmenu={(e) => onCharacterRightClick(character, e)}>
						<CharacterListCard {character} {updateCharacterHealth} />
						<div class="right-click-hint">Right-click to focus</div>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.character-list-container {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
	}

	.characters-grid {
		height: 100%;
		overflow-y: auto;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.list-header h3 {
		color: #4fc3f7;
		font-size: 18px;
		font-weight: 600;
		margin: 0;
		text-shadow: 0 2px 8px rgba(79, 195, 247, 0.3);
	}

	.show-all-button {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.1) 0%,
			rgba(255, 255, 255, 0.05) 100%
		);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		color: #ffffff;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.show-all-button:hover {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.15) 0%,
			rgba(255, 255, 255, 0.1) 100%
		);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.instruction-text {
		color: rgba(255, 255, 255, 0.6);
		font-size: 14px;
		font-style: italic;
	}

	.template-row {
		display: flex;
		margin-bottom: 1rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.character-wrapper {
		position: relative;
		flex: 1;
		min-width: 200px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.character-wrapper:hover {
		transform: translateY(-2px);
	}

	.character-wrapper:hover .right-click-hint {
		opacity: 1;
		transform: translateY(0);
	}

	.right-click-hint {
		position: absolute;
		top: -8px;
		right: 8px;
		background: rgba(76, 195, 247, 0.9);
		color: #000;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		opacity: 0;
		transform: translateY(-4px);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: none;
		z-index: 10;
	}

	.right-click-hint::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: rgba(76, 195, 247, 0.9);
	}
</style>
