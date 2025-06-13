<script lang="ts">
	import { globalState } from './global_state.svelte';
	import CharacterCard from './CharacterCard.svelte';
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
	{#if globalState.focusedCharacterIndex !== undefined}
		<!-- Show character list when a character is focused -->
		<div class="characters-grid">
			<div class="list-header">
				<h3>Other Characters</h3>
				<button class="show-all-button" onclick={() => globalState.setFocusedCharacter(undefined)}>
					Show All Characters
				</button>
			</div>

			{#each groupedCharacters as group}
				<div class="template-row">
					{#each group as character (character.index)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							class="character-wrapper"
							oncontextmenu={(e) => onCharacterRightClick(character, e)}
						>
							<CharacterCard
								{character}
								{tooltip}
								logMessage={globalState.logMessage.bind(globalState)}
								{updateCharacterHealth}
								onAttackTargetSelected={(target: Character, shiftKey: boolean) => {
									if (globalState.selectedAttack === undefined) return;

									if (shiftKey) {
										if (globalState.selectedAttackTargets.hasOwnProperty(target.index)) {
											delete globalState.selectedAttackTargets[target.index];
										} else {
											globalState.selectedAttackTargets[target.index] = {
												character: target,
												timesAttacked: 1
											};
										}
									} else {
										if (!globalState.selectedAttackTargets.hasOwnProperty(target.index)) {
											globalState.selectedAttackTargets[target.index] = {
												character: target,
												timesAttacked: 1
											};
										}
										// Execute attack - handled by parent
									}
								}}
								onCharacterHover={(character: Character | undefined) => {
									globalState.hoveredCharacter = character;
								}}
								bind:selectedAttack={globalState.selectedAttack}
								bind:selectedAttackTargets={globalState.selectedAttackTargets}
							/>
							<div class="right-click-hint">Right-click to focus</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{:else}
		<!-- Show message when no character is focused -->
		<div class="no-focus-message">
			<h3>All Characters View</h3>
			<p>Right-click any character to focus on it and see other characters here.</p>
		</div>
	{/if}
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

	.no-focus-message {
		text-align: center;
		color: rgba(255, 255, 255, 0.7);
		padding: 2rem;
	}

	.no-focus-message h3 {
		color: #4fc3f7;
		margin-bottom: 1rem;
	}
</style>
