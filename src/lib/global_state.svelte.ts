// Global state management for the character sheet app
import { parseCharacters } from './parseJsonToCharacters.svelte';

// Global state
export const globalState = $state({
	// Character management
	characterStrings: [] as string[],
	characters: [] as Character[],
	focusedCharacterIndex: undefined as number | undefined,

	// UI state
	logEntries: [] as LogEntry[],
	selectedAttack: undefined as SelectingAttack | undefined,
	selectedAttackTargets: {} as Record<number, { character: Character; timesAttacked: number }>,
	hoveredCharacter: undefined as Character | undefined,

	// Derived state
	get focusedCharacter(): Character | undefined {
		return this.focusedCharacterIndex !== undefined
			? this.characters[this.focusedCharacterIndex]
			: undefined;
	},

	get characterList(): Character[] {
		if (this.focusedCharacterIndex === undefined) return this.characters;
		return this.characters.filter((_, index) => index !== this.focusedCharacterIndex);
	},

	get logEntriesReversed(): LogEntry[] {
		return [...this.logEntries].reverse();
	},

	// Methods
	updateCharacterStrings(newStrings: string[]) {
		this.characterStrings = newStrings;
		this.characters = parseCharacters(newStrings);

		// Validate focused character index
		if (
			this.focusedCharacterIndex !== undefined &&
			this.focusedCharacterIndex >= this.characters.length
		) {
			this.focusedCharacterIndex = undefined;
		}
	},

	setFocusedCharacter(index: number | undefined) {
		this.focusedCharacterIndex = index;
	},

	logMessage(message: string, type: LogType) {
		const previousLog = this.logEntriesReversed[0];
		const timestamp = new Date();

		if (previousLog?.timestamp && timestamp.getTime() - previousLog.timestamp.getTime() > 2000) {
			this.logEntries.push({
				message: '',
				type: 'roll',
				timestamp: undefined,
				key: this.logEntries.length
			});
		}

		this.logEntries.push({ message, type, timestamp, key: this.logEntries.length });
	},

	clearAttackSelection() {
		this.selectedAttack = undefined;
		this.selectedAttackTargets = {};
	}
});

// Initial state setup
export function initializeGlobalState(initialCharacterStrings: string[]) {
	globalState.updateCharacterStrings(initialCharacterStrings);
}
