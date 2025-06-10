<script lang="ts">
	import CharacterCard from './CharacterCard.svelte';
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import PersistentTextArea from './PersistentTextArea.svelte';
	import GlobalTooltip from './GlobalTooltip.svelte';
	import { parseCharacters } from './parseJsonToCharacters.svelte';
	import { textareaInitialState } from './startingInputState.svelte';
	import { processAttack } from './dice.svelte';
	import { LLMinstructions } from './llmInstructions.svelte';
	import { groupby } from './util.svelte';

	let logEntries = $state<LogEntry[]>([]);
	let logEntriesReversed = $derived([...logEntries].reverse());
	let characterStrings = $derived(textareaInitialState.value.split('---'));
	let characters = $derived<Character[]>(parseCharacters(characterStrings));

	// State for selection mode
	let selectedAttack: SelectingAttack | undefined = $state(undefined);
	let selectedAttackTargets: Record<number, { character: Character; timesAttacked: number }> =
		$state({}); // Updated type

	// Track which character is currently under the mouse
	let hoveredCharacter: Character | undefined = $state(undefined);

	// Keyboard event handler for attack multipliers - now targets hovered character
	function selectAttackKeyboard(event: KeyboardEvent) {
		const key = event.key;
		if (hoveredCharacter) {
			if (key >= '1' && key <= '9') {
				const multiplier = parseInt(key);
				selectedAttackTargets[hoveredCharacter.index] = {
					character: hoveredCharacter,
					timesAttacked: multiplier
				};
			} else if (key == '0') {
				if (hoveredCharacter) {
					delete selectedAttackTargets[hoveredCharacter.index];
				}
			} else if (event.key === 'Enter') {
				executeAttack();
			}
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (selectedAttack !== undefined) return selectAttackKeyboard(event);
	}

	// Function to handle character hover state
	function onCharacterHover(character: Character | undefined) {
		hoveredCharacter = character;
	}

	// Update JSON input after health changes
	function updateCharacterHealth(character: Character, newDamage: number) {
		newDamage = Math.max(0, Math.min(character.numbers.max_hp.value, newDamage));

		let unmodified = characterStrings[character.index!];
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
		characterStrings[character.index!] = modified;
		textareaInitialState.value = characterStrings.join('---');
	}

	// Handle dice rolls
	function logMessage(message: string, type: LogType) {
		let previousLog = logEntriesReversed[0];
		let timestamp = new Date();

		if (previousLog?.timestamp && timestamp.getTime() - previousLog.timestamp.getTime() > 2000) {
			logEntries.push({ message: '', type: 'roll', timestamp: undefined, key: logEntries.length });
		}

		logEntries.push({ message, type, timestamp, key: logEntries.length });
	}

	// Group characters by template for rendering
	let groupedCharacters = $derived(groupby(characters));

	// Handle target selection
	function executeAttack() {
		if (selectedAttack === undefined) return;
		for (const [_, targetData] of Object.entries(selectedAttackTargets)) {
			// Execute attack multiple times based on timesAttacked
			let totalDamage = 0;
			for (let i = 0; i < targetData.timesAttacked; i++) {
				let attackResult = processAttack(
					selectedAttack.attacker,
					targetData.character,
					selectedAttack.attack,
					logMessage
				);
				totalDamage += attackResult.damageDealt;
			}
			updateCharacterHealth(
				targetData.character,
				targetData.character.numbers.damage.value + totalDamage
			);
		}
		selectedAttack = undefined;
		selectedAttackTargets = {};
		tooltip?.hide();
	}

	function onAttackTargetSelected(target: Character, shiftKey: boolean) {
		if (selectedAttack === undefined) return;

		if (shiftKey) {
			if (selectedAttackTargets.hasOwnProperty(target.index)) {
				delete selectedAttackTargets[target.index];
			} else {
				selectedAttackTargets[target.index] = { character: target, timesAttacked: 1 };
			}
		} else {
			if (!selectedAttackTargets.hasOwnProperty(target.index)) {
				selectedAttackTargets[target.index] = { character: target, timesAttacked: 1 };
			}
			executeAttack();
		}
	}

	let tooltip: GlobalTooltip | undefined = $state(undefined);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<main>
	<div class="textarea-always">
		<div class="textarea-container">
			<PersistentTextArea
				bind:value={textareaInitialState.value}
				placeholder="Enter character JSON here..."
			/>
			<span
				class="help-icon"
				onmouseenter={() =>
					tooltip?.show({
						name: 'Help',
						description:
							'Click to copy llm instructions on how to create your character sheet. Take any format, copy paste it into claude.ai, and click this icon and copy paste the contents to her also.',
						type: 'info',
						chips: []
					})}
				onmouseleave={() => tooltip?.hide()}
				onclick={() => navigator.clipboard.writeText(LLMinstructions)}>?</span
			>
		</div>
	</div>

	<div class="characters-container">
		<div id="charactersDisplay">
			{#each groupedCharacters as group}
				<div class="template-row">
					{#each group as character (character.index)}
						<CharacterCard
							{character}
							{tooltip}
							{logMessage}
							{updateCharacterHealth}
							{onAttackTargetSelected}
							{onCharacterHover}
							bind:selectedAttack
							bind:selectedAttackTargets
						/>
					{/each}
				</div>
			{/each}
			<div class="last-padding"></div>
		</div>
	</div>

	<div class="log-container">
		<div id="logDisplay">
			{#each logEntriesReversed as entry (entry.key)}
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
	}

	:root {
		--log-container-height: 18vh;
	}

	.textarea-always {
		height: 50px;
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
	.characters-container {
		background: #2d2d2d;
		background-color: #111;
		overflow: auto;
		height: calc(100vh - var(--log-container-height) - 50px);
		padding: 1rem;
	}
	.textarea-container {
		position: fixed;
		padding-left: 1rem;
		padding-right: 1rem;
		padding-top: 0.5rem;
		top: 0;
		left: 0;
		width: 100vw;
		height: calc(100vh - var(--log-container-height));
		z-index: 1000;
		background: #000;
		overflow-y: auto;
		max-height: 50px;
		transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: auto;
	}

	.textarea-container:hover {
		max-height: 90vh;
		z-index: 1001;
	}

	.template-row {
		display: flex;
		margin-bottom: 4px;
	}

	.last-padding {
		margin-bottom: 100vh;
	}

	.log-entry {
		font-family: 'Courier New', monospace;
		font-size: 13px;
		margin-bottom: 2px;
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

	.help-icon {
		position: absolute;
		bottom: 10px;
		right: 10px;
		font-size: 20px;
		cursor: pointer;
		color: #fff;
		background: #333;
		border-radius: 50%;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
	}

	.textarea-container:hover .help-icon {
		opacity: 1;
	}
</style>
