<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import GlobalTooltip from './GlobalTooltip.svelte';
	import { globalState, initializeGlobalState } from './global_state.svelte';
	import { textareaInitialState } from './startingInputState.svelte';
	import { processAttack } from './dice.svelte';
	import FocusedCharacter from './FocusedCharacter.svelte';
	import CharacterList from './CharacterList.svelte';

	// Initialize global state with initial character strings
	let allCharactersText = $state(textareaInitialState.value);
	$effect(() => {
		const characterStrings = allCharactersText.split('---');
		globalState.updateCharacterStrings(characterStrings);
	});

	// Initialize on mount
	$effect(() => {
		initializeGlobalState(textareaInitialState.value.split('---'));
	});

	// Keyboard event handler for attack multipliers - now targets hovered character
	function selectAttackKeyboard(event: KeyboardEvent) {
		const key = event.key;
		if (globalState.hoveredCharacter) {
			if (key >= '1' && key <= '9') {
				const multiplier = parseInt(key);
				globalState.selectedAttackTargets[globalState.hoveredCharacter.index] = {
					character: globalState.hoveredCharacter,
					timesAttacked: multiplier
				};
			} else if (key == '0') {
				if (globalState.hoveredCharacter) {
					delete globalState.selectedAttackTargets[globalState.hoveredCharacter.index];
				}
			} else if (event.key === 'Enter') {
				executeAttack();
			}
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (globalState.selectedAttack !== undefined) return selectAttackKeyboard(event);
	}

	// Update JSON input after health changes
	function updateCharacterHealth(character: Character, newDamage: number) {
		newDamage = Math.max(0, Math.min(character.numbers.max_hp.value, newDamage));

		let unmodified = globalState.characterStrings[character.index!];
		let searchStr = 'damage:';
		let damageIndex = unmodified.indexOf(searchStr);
		if (damageIndex === -1) {
			searchStr = '"damage":';
			damageIndex = unmodified.indexOf(searchStr);
		}
		if (damageIndex === -1) return;
		// Search ahead for the first sequence of numeric digits, and get their start and end index
		let afterDamage = unmodified.slice(damageIndex + searchStr.length);
		let match = afterDamage.match(/-?\d+(\.\d+)?/);
		if (!match) return;
		let numStart = damageIndex + searchStr.length + match.index!;
		let numEnd = numStart + match[0].length;
		let modified = unmodified.slice(0, numStart) + newDamage.toString() + unmodified.slice(numEnd);

		const newStrings = [...globalState.characterStrings];
		newStrings[character.index!] = modified;
		globalState.updateCharacterStrings(newStrings);
		allCharactersText = newStrings.join('---');
	}

	// Handle target selection and attack execution
	function executeAttack() {
		if (globalState.selectedAttack === undefined) return;
		for (const [_, targetData] of Object.entries(globalState.selectedAttackTargets)) {
			// Execute attack multiple times based on timesAttacked
			let totalDamage = 0;
			for (let i = 0; i < targetData.timesAttacked; i++) {
				let attackResult = processAttack(
					globalState.selectedAttack.attacker,
					targetData.character,
					globalState.selectedAttack.attack,
					globalState.logMessage.bind(globalState)
				);
				totalDamage += attackResult.damageDealt;
			}
			updateCharacterHealth(
				targetData.character,
				targetData.character.numbers.damage.value + totalDamage
			);
		}
		globalState.clearAttackSelection();
		tooltip?.hide();
	}

	function onAttackTargetSelected(target: Character, shiftKey: boolean) {
		if (globalState.selectedAttack === undefined) return;

		if (shiftKey) {
			if (globalState.selectedAttackTargets.hasOwnProperty(target.index)) {
				delete globalState.selectedAttackTargets[target.index];
			} else {
				globalState.selectedAttackTargets[target.index] = { character: target, timesAttacked: 1 };
			}
		} else {
			if (!globalState.selectedAttackTargets.hasOwnProperty(target.index)) {
				globalState.selectedAttackTargets[target.index] = { character: target, timesAttacked: 1 };
			}
			executeAttack();
		}
	}

	let tooltip: GlobalTooltip | undefined = $state(undefined);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window on:keydown={handleKeyDown} />

<main>
	<div class="app-container">
		{#if globalState.focusedCharacter}
			<!-- Two-column layout: Focused character on left, character list on right -->
			<div class="focused-layout">
				<div class="focused-column">
					<FocusedCharacter {tooltip} {updateCharacterHealth} />
				</div>
				<div class="list-column">
					<CharacterList {tooltip} {updateCharacterHealth} bind:allCharactersText />
				</div>
			</div>
		{:else}
			<!-- Full-width character list when no focus -->
			<div class="full-layout">
				<CharacterList {tooltip} {updateCharacterHealth} bind:allCharactersText />
			</div>
		{/if}
	</div>

	<div class="log-container">
		<div id="logDisplay">
			{#each globalState.logEntriesReversed as entry (entry.key)}
				<div
					class="log-entry {entry.type}"
					style="white-space: pre;"
					in:fly={{ y: -24, duration: 250 }}
					out:fly={{ y: 24, duration: 250 }}
					animate:flip={{ duration: 100 }}
				>
					{`${entry.timestamp ? entry.timestamp.toLocaleTimeString() : ''}     ${entry.message}`}
				</div>
			{/each}
		</div>
	</div>

	<GlobalTooltip bind:this={tooltip} />
</main>

<style>
	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	main {
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		min-height: 100vh;
		color: #e0e0e0;
		background: #111;
	}

	:root {
		--log-container-height: 18vh;
	}

	.app-container {
		height: calc(100vh - var(--log-container-height));
		overflow: hidden;
	}

	.focused-layout {
		display: flex;
		height: 100%;
	}

	.focused-column {
		width: 50%;
		overflow-y: auto;
		border-right: 1px solid rgba(255, 255, 255, 0.1);
	}

	.list-column {
		width: 50%;
		overflow-y: auto;
	}

	.full-layout {
		height: 100%;
		overflow-y: auto;
	}

	.log-container {
		background: #2b2b3d;
		overflow-y: auto;
		height: var(--log-container-height);
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100vw;
		z-index: 1002;
		border-top: 2px solid #000;
	}

	.log-entry {
		font-family: 'Courier New', monospace;
		font-size: 13px;
		margin-bottom: 2px;
		padding: 2px 8px;
	}

	.error {
		color: white;
	}
	.roll {
		color: white;
	}

	.critical-hit {
		background: #1b1b2d;
		color: #c4f;
	}

	.critical-miss {
		background: #1b1b2d;
		color: #ee1b1b;
	}

	.miss {
		color: #ee8b8b;
	}
</style>
