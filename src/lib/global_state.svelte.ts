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
		// Filter out empty strings and ensure we have valid character data
		const validStrings = newStrings.filter((s) => s.trim());

		this.characterStrings = validStrings;
		this.characters = parseCharacters(validStrings);

		$inspect(this.characters);

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

// Initial state setup with fallback to default when empty
export function initializeGlobalState(initialCharacterStrings: string[], defaultValue?: string) {
	// If no valid character strings provided and we have a default, use the default
	const validStrings = initialCharacterStrings.filter((s) => s.trim());

	if (validStrings.length === 0 && defaultValue) {
		const defaultStrings = defaultValue
			.split('---')
			.map((s) => s.trim())
			.filter((s) => s);
		globalState.updateCharacterStrings(defaultStrings);
	} else {
		globalState.updateCharacterStrings(validStrings);
	}
}
