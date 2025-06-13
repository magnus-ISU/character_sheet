<script lang="ts">
	import { globalState } from './global_state.svelte';
	import CharacterCard from './CharacterCard.svelte';
	import GlobalTooltip from './GlobalTooltip.svelte';
	import PersistentTextArea from './PersistentTextArea.svelte';
	import { LLMinstructions } from './llmInstructions.svelte';

	let {
		tooltip,
		updateCharacterHealth,
		allCharactersText = $bindable('')
	}: {
		tooltip: GlobalTooltip | undefined;
		updateCharacterHealth: Function;
		allCharactersText: string;
	} = $props();

	let textareaRef: HTMLTextAreaElement | undefined = $state();
	let isTextareaFocused = $state(false);
	let showTextarea = $state(false);

	// Get focused character and its textarea content
	let focusedCharacter = $derived(globalState.focusedCharacter);
	let characterText = $derived(
		focusedCharacter ? globalState.characterStrings[focusedCharacter.index] : ''
	);

	function handleTextareaUpdate(newValue: string) {
		if (focusedCharacter) {
			const newStrings = [...globalState.characterStrings];
			newStrings[focusedCharacter.index] = newValue;
			globalState.updateCharacterStrings(newStrings);
		}
	}

	function handleAllCharactersTextUpdate(newValue: string) {
		allCharactersText = newValue;
	}

	function onRightClick(e: MouseEvent) {
		e.preventDefault();
		// Right clicking focused character area goes back to no focus
		globalState.setFocusedCharacter(undefined);
		globalState.clearAttackSelection();
		tooltip?.hide();
	}

	function toggleTextarea() {
		showTextarea = !showTextarea;
		if (showTextarea && textareaRef) {
			setTimeout(() => textareaRef?.focus(), 0);
		}
	}

	function handleTextareaFocus() {
		isTextareaFocused = true;
	}

	function handleTextareaBlur() {
		isTextareaFocused = false;
		// Don't hide textarea immediately when losing focus
		setTimeout(() => {
			if (!isTextareaFocused) {
				showTextarea = false;
			}
		}, 100);
	}

	function handleTextareaKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showTextarea = false;
			textareaRef?.blur();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
{#if focusedCharacter}
	<!-- Show focused character when one is selected -->
	<div class="focused-character-container" oncontextmenu={onRightClick}>
		<div class="focused-header">
			<button class="edit-button" onclick={toggleTextarea}>
				{showTextarea ? '📝 Hide Editor' : '✏️ Edit Character'}
			</button>
			<div class="character-indicator">Focused Character</div>
		</div>

		{#if showTextarea || isTextareaFocused}
			<div class="textarea-container" class:focused={isTextareaFocused}>
				<textarea
					bind:this={textareaRef}
					value={characterText}
					oninput={(e) => handleTextareaUpdate((e.target as HTMLTextAreaElement).value)}
					onfocus={handleTextareaFocus}
					onblur={handleTextareaBlur}
					onkeydown={handleTextareaKeydown}
					placeholder="Edit character definition..."
					class="character-textarea"
				></textarea>
				<div class="textarea-hint">
					Press Esc to close, or click outside (cursor must leave textarea)
				</div>
			</div>
		{/if}

		<div class="character-display">
			<CharacterCard
				character={focusedCharacter}
				{tooltip}
				logMessage={globalState.logMessage.bind(globalState)}
				{updateCharacterHealth}
				onAttackTargetSelected={(target: Character, shiftKey: boolean) => {
					// Handle attack target selection for focused character
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
						// Execute attack immediately
						// This will be handled by the parent component
					}
				}}
				onCharacterHover={(character: Character | undefined) => {
					globalState.hoveredCharacter = character;
				}}
				bind:selectedAttack={globalState.selectedAttack}
				bind:selectedAttackTargets={globalState.selectedAttackTargets}
			/>
		</div>
	</div>
{:else}
	<!-- Show all characters textarea when no character is focused -->
	<div class="all-characters-container">
		<div class="all-characters-header">
			<h2>Character Definitions</h2>
			<div class="header-subtitle">
				Edit all characters here, or right-click a character to focus on it
			</div>
		</div>

		<div class="all-characters-textarea">
			<div class="textarea-container-full">
				<PersistentTextArea
					bind:value={allCharactersText}
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
	</div>
{/if}

<style>
	.focused-character-container {
		background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3d 50%, #1a1a2a 100%);
		border: 2px solid rgba(76, 195, 247, 0.5);
		border-radius: 20px;
		padding: 20px;
		margin: 1rem;
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.5),
			0 4px 12px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(15px);
		position: relative;
		min-height: 300px;
	}

	.all-characters-container {
		background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 50%, #1a1a1a 100%);
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 20px;
		padding: 20px;
		margin: 1rem;
		height: calc(100vh - 22vh - 2rem);
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.5),
			0 4px 12px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(15px);
		display: flex;
		flex-direction: column;
	}

	.focused-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(76, 195, 247, 0.3);
	}

	.all-characters-header {
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.all-characters-header h2 {
		color: #ffffff;
		font-size: 24px;
		font-weight: 700;
		margin: 0;
		text-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);
	}

	.header-subtitle {
		color: rgba(255, 255, 255, 0.7);
		font-size: 14px;
		margin-top: 0.5rem;
	}

	.edit-button {
		background: linear-gradient(135deg, rgba(76, 195, 247, 0.2) 0%, rgba(76, 195, 247, 0.1) 100%);
		border: 1px solid rgba(76, 195, 247, 0.3);
		border-radius: 8px;
		color: #4fc3f7;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.edit-button:hover {
		background: linear-gradient(135deg, rgba(76, 195, 247, 0.3) 0%, rgba(76, 195, 247, 0.2) 100%);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(76, 195, 247, 0.2);
	}

	.character-indicator {
		color: #4fc3f7;
		font-size: 14px;
		font-weight: 600;
		text-shadow: 0 2px 8px rgba(79, 195, 247, 0.3);
		letter-spacing: 0.5px;
	}

	.textarea-container {
		margin-bottom: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.textarea-container.focused {
		border-color: rgba(76, 195, 247, 0.5);
		box-shadow: 0 0 20px rgba(76, 195, 247, 0.2);
	}

	.all-characters-textarea {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.textarea-container-full {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.character-textarea {
		width: 100%;
		min-height: 120px;
		background: transparent;
		border: none;
		color: #ffffff;
		font-family: 'Courier New', monospace;
		font-size: 14px;
		line-height: 1.5;
		resize: vertical;
		outline: none;
		padding: 0;
	}

	.character-textarea::placeholder {
		color: rgba(255, 255, 255, 0.5);
	}

	.textarea-hint {
		margin-top: 0.5rem;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
		font-style: italic;
	}

	.character-display {
		display: flex;
		justify-content: center;
	}

	.character-display :global(.character-card) {
		max-width: 400px;
		flex: none;
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
		opacity: 0.7;
		transition: opacity 0.3s ease;
	}

	.help-icon:hover {
		opacity: 1;
	}
</style>
