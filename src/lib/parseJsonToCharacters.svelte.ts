// This file parses input JSONish into Character objects
export { parseSlashName, parseCharacters };

import { prettyStringProcessDiceExpression, rollDiceExpression } from './dice.svelte';
import { getKeyLineNumbers, parseFlexibleJSON } from './jsonParser.svelte';

function parseSlashName(originalName: string): { parent: string; name: string } {
	const splitName = originalName.split('/');
	if (splitName.length === 1) return { parent: '', name: originalName.trim() };
	return { parent: splitName[0].trim(), name: splitName[1].trim() };
}

// Parse input text into characters
function parseCharacters(input: string[]): Character[] {
	// Join all input and process as one document
	const fullText = input.join('\n');

	// Parse globals and character sections
	const { globals, characterSections } = parseDocument(fullText);

	const parsedCharacters: Character[] = [];

	for (let i = 0; i < characterSections.length; i++) {
		const characterDefinition = characterSections[i].trim();
		if (!characterDefinition) continue;

		const character = processCharacter(characterDefinition, i, globals);
		if (character) {
			parsedCharacters.push(character);
		}
	}

	return parsedCharacters;
}

// Parse the full document into globals and character sections
function parseDocument(text: string): {
	globals: Record<string, any>;
	characterSections: string[];
} {
	// Remove comments (everything after # to end of line)
	const textWithoutComments = text.replace(/#[^\n]*/g, '');

	// Split by --- to separate sections
	const sections = textWithoutComments.split('---');

	let globals: Record<string, any> = {};
	let characterSections: string[] = [];

	if (sections.length === 1) {
		// No --- found, treat entire text as character sections
		characterSections = [sections[0]];
	} else {
		// First section is globals
		const globalsText = sections[0].trim();
		if (globalsText) {
			globals = parseGlobals(globalsText);
		}

		// Rest are character sections
		characterSections = sections.slice(1);
	}

	return { globals, characterSections };
}

// Parse globals section
function parseGlobals(globalsText: string): Record<string, any> {
	try {
		// Convert newlines to commas for parsing and clean up
		const normalizedText = cleanupForParsing(globalsText);
		const parseString = `{ ${normalizedText} }`;
		return parseFlexibleJSON(parseString);
	} catch (e: any) {
		console.error(`Error parsing globals: ${e.message}`);
		return {};
	}
}

// Clean up text for JSON parsing
function cleanupForParsing(text: string): string {
	// Convert newlines to commas (they act as delimiters)
	let normalized = text.replace(/\n/g, ', ');

	// Remove commas that directly follow a closing brace '}' when the next non-space
	// character starts a word (description). Keep commas inside arrays or object lists.
	normalized = normalized.replace(/}\s*,\s*(?=[A-Za-z])/g, '} ');

	// Remove multiple consecutive commas that can be introduced in previous steps
	normalized = normalized.replace(/,\s*,+/g, ','); // collapse duplicate commas
	// Trim leading/trailing commas
	normalized = normalized.replace(/^\s*,/g, '');
	normalized = normalized.replace(/,\s*$/g, '');

	// Collapse multiple spaces
	normalized = normalized.replace(/\s+/g, ' ');

	return normalized.trim();
}

// Process individual character object
function processCharacter(
	characterDefinition: string,
	index: number,
	globals: Record<string, any>,
): Character | undefined {
	let obj: any;

	try {
		// Clean up and normalize the definition
		const normalizedDefinition = cleanupForParsing(characterDefinition);
		const parseString = `{ ${normalizedDefinition} }`;
		obj = parseFlexibleJSON(parseString);

		// Apply globals first
		obj = { ...globals, ...obj };

		if (!obj.name) return undefined;
	} catch (e: any) {
		console.error(`Parsing error: ${e.message} in character ${characterDefinition}`);
		return undefined;
	}

	const character: Character = {
		name: obj.name,
		index,
		originalText: characterDefinition,
		numbers: {} as any,
		features: {},
	};

	// Process each key-value pair
	for (const [key, value] of Object.entries(obj)) {
		if (key === 'name') continue;
		const normalizedKey = normalizeKey(key);
		let valStr = value!.toString();

		if (isNumberValue(value)) {
			// Handle numeric stats - create enhanced NumberStat
			createNumberStat(character, normalizedKey, valStr);
		} else if (typeof value === 'object' && value !== null) {
			parseAndAddFeature(character, key, value);
		} else if (typeof value === 'string' && value.includes('{')) {
			// Handle inline feature definitions like "sword {roll str vs ac, hit 1d10}"
			parseInlineFeature(character, key, value);
		}
	}

	// Ensure required properties exist
	if (!character.numbers.hasOwnProperty('health')) {
		// Create a default health if it doesn't exist
		createNumberStat(character, 'health', '1');
	}
	if (!character.numbers.hasOwnProperty('damage')) {
		createNumberStat(character, 'damage', '0');
	}

	// Calculate final values
	calculateFinalValues(character);

	// Add line number information
	try {
		let lineNumbers = getKeyLineNumbers(`{${cleanupForParsing(characterDefinition)}}`);
		for (const [key, row] of Object.entries(lineNumbers)) {
			let { name } = parseSlashName(key);
			name = normalizeKey(name);
			if (character.numbers[name] !== undefined) {
				character.numbers[name].row = row;
			}
		}
	} catch (e) {
		// Ignore line number errors
	}

	return character;
}

// Normalize key by replacing spaces with underscores
function normalizeKey(key: string): string {
	return key.trim().replace(/\s+/g, '_');
}

// Check if a value represents a number or numeric expression
function isNumberValue(value: any): boolean {
	return (
		typeof value === 'number' ||
		(typeof value === 'string' && /^[0-9\s+\-*\/().a-zA-Z_]+$/.test(value))
	);
}

// Create a NumberStat object
function createNumberStat(character: Character, originalName: string, baseValue: string): void {
	const { parent, name } = parseSlashName(originalName);

	// Handle child definitions (e.g., "str.defense", "level.used_healing_surges")
	const childMatch = name.match(/^(\w+)\.(\w+)$/);
	if (childMatch) {
		const [, statName, childName] = childMatch;

		// Ensure parent stat exists
		if (!character.numbers[statName]) {
			createNumberStat(character, statName, '0');
		}

		// Create child stat
		const childStat: NumberStat = {
			name: childName,
			base: baseValue,
			modifiers: [],
			value: evaluateExpression(baseValue, character.numbers),
			parent: character.numbers[statName],
			children: {},
			render: !(childName === 'damage' || childName === 'health'),
			roll: 'd20',
		};

		character.numbers[statName].children[childName] = childStat;
		return;
	}

	// Create main stat
	const stat: NumberStat = {
		name: name,
		base: baseValue,
		modifiers: [],
		value: evaluateExpression(baseValue, character.numbers),
		children: {},
		render: !(name === 'damage' || name === 'health'),
		roll: 'd20',
	};

	character.numbers[name] = stat;
}

// Enhanced feature parsing with attack info extraction
function parseAndAddFeature(character: Character, originalName: string, feature: any): void {
	const { parent, name } = parseSlashName(originalName);

	// Handle numbered feature properties
	let num_features = 0;
	for (num_features = 0; feature[num_features]; num_features++) {}
	if (feature.description === undefined) {
		feature.description = feature[--num_features] || '';
	}

	// Parse other values
	let otherValuesToParse = ['hit', 'roll'];
	for (let i = 0; i < num_features; i++) {
		while (
			otherValuesToParse.length > 0 &&
			feature[otherValuesToParse[otherValuesToParse.length - 1]] !== undefined
		) {
			otherValuesToParse.pop();
		}
		let valueToParse = otherValuesToParse.pop();
		if (valueToParse !== undefined) {
			feature[valueToParse] = feature[i];
		}
	}

	let [rollFormula, against] = extractAgainst(feature.roll || '');

	// Parse attack info
	let attackInfo: AttackInfo | undefined;
	if (rollFormula && against) {
		attackInfo = parseAttackInfo(
			character,
			rollFormula,
			against,
			feature.hit || '',
			feature.miss || '',
			feature.hit_effect || '',
			feature.miss_effect || '',
		);
	}

	const f: Feature = {
		name: name,
		description: feature.description || '',
		stats: Array.isArray(feature.stats) ? feature.stats.map((s: any) => parseStatModifier(s)) : [],
		attack: attackInfo,
	};

	if (!character.features[parent]) {
		character.features[parent] = [];
	}
	character.features[parent].push(f);
}

// Parse stat modifier from feature
function parseStatModifier(statDef: any): StatModifier {
	return {
		stat: statDef.stat || '',
		bonus: statDef.bonus || '',
		roll: statDef.roll || '',
		source: null as any, // Will be set later
	};
}

// Parse attack information into structured AttackInfo
function parseAttackInfo(
	character: Character,
	roll: string,
	rollAgainst: string,
	hit: string,
	miss: string,
	hitEffect: string,
	missEffect: string,
): AttackInfo {
	// Parse roll into main roll and modifier
	const rollParts = roll.split(/([+\-])/);
	const mainRoll = rollParts[0].trim();
	const modifier = rollParts.length > 1 ? rollParts.slice(1).join('').trim() : '';

	// Determine the roll to use based on the attack logic requirements
	let attackRoll = 'd20'; // default

	// Get the defense roll if it exists
	const defenseRoll: string = getStatRoll(character, rollAgainst + '.defense') || 'd20';
	const attackerRoll: string = getStatRoll(character, mainRoll + '.roll') || 'd20';

	// Apply the attack roll logic:
	// attacks should use the defenses roll if it is not 'd20',
	// or else their roll unless they are both '2d20kh1', in which case they use 'd20'
	if (defenseRoll !== 'd20') {
		attackRoll = defenseRoll;
	} else if (attackerRoll !== 'd20') {
		const advantageRoll = '2d20kh1';
		if (attackerRoll === advantageRoll && defenseRoll === advantageRoll) {
			attackRoll = 'd20';
		} else {
			attackRoll = attackerRoll;
		}
	}

	return {
		roll: roll,
		rollAgainst: rollAgainst,
		mainRoll: mainRoll,
		modifier: modifier,
		hit: hit,
		miss: miss,
		hitEffect: hitEffect,
		missEffect: missEffect,
	};
}

// Get the roll value for a stat (including children)
function getStatRoll(character: Character, statPath: string): string | undefined {
	const parts = statPath.split('.');
	if (parts.length === 1) {
		return character.numbers[parts[0]]?.roll;
	} else if (parts.length === 2) {
		const [statName, childName] = parts;
		const stat = character.numbers[statName];
		if (!stat) return undefined;

		// Check if child exists
		if (stat.children[childName]) {
			return stat.children[childName].roll;
		}

		// Child doesn't exist, use parent's roll
		return stat.roll;
	}
	return undefined;
}

// Extract the "against" part from a roll string
function extractAgainst(roll: string): [string, string] {
	const split = roll.split(' vs ');
	return [split[0], split[1] || ''];
}

// Calculate final values for all number stats
function calculateFinalValues(character: Character): void {
	const maxPasses = 100;
	let pass = 0;

	while (pass < maxPasses) {
		let changed = false;

		for (const [_, numberStat] of Object.entries(character.numbers)) {
			const oldValue = numberStat.value;
			const newValue = calculateStatValue(numberStat, character.numbers);

			if (newValue !== oldValue && !isNaN(newValue)) {
				numberStat.value = newValue;
				changed = true;
			}

			// Also calculate child values
			for (const [childName, childStat] of Object.entries(numberStat.children)) {
				const oldChildValue = childStat.value;
				const newChildValue = calculateStatValue(childStat, character.numbers);

				if (newChildValue !== oldChildValue && !isNaN(newChildValue)) {
					childStat.value = newChildValue;
					changed = true;
				}
			}
		}

		if (!changed) break;
		pass++;
	}
}

// Calculate the final value for a single stat
function calculateStatValue(
	numberStat: NumberStat,
	allNumbers: Record<string, NumberStat>,
): number {
	let result = evaluateExpression(numberStat.base, allNumbers);
	if (isNaN(result)) return NaN;

	// Apply modifiers
	for (const modifier of numberStat.modifiers) {
		const evaluatedValue = evaluateExpression(modifier.bonus, allNumbers);

		if (isNaN(evaluatedValue)) return NaN;

		result += evaluatedValue; // For now, just add modifiers
	}

	// Round down to integer (typical for stats like proficiency bonus)
	result = Math.floor(result);

	return result;
}

// Evaluate mathematical expressions with stat references
function evaluateExpression(expr: string, numbers: Record<string, NumberStat>): number {
	if (typeof expr === 'number') return expr;

	let expression = expr.toString();

	// Replace stat references with their values (including child stats)
	for (const [statName, numberStat] of Object.entries(numbers)) {
		// Replace main stat references
		const regex = new RegExp(`\\b${statName}\\b`, 'g');
		expression = expression.replace(regex, Math.floor(numberStat.value).toString());

		// Replace child stat references
		for (const [childName, childStat] of Object.entries(numberStat.children)) {
			const childRegex = new RegExp(`\\b${statName}\\.${childName}\\b`, 'g');
			expression = expression.replace(childRegex, Math.floor(childStat.value).toString());
		}
	}

	// Handle virtual child access (accessing children that don't exist)
	// Replace pattern like "stat.child" where child doesn't exist with parent value
	expression = expression.replace(/\b(\w+)\.(\w+)\b/g, (match, statName, childName) => {
		const stat = numbers[statName];
		if (stat && !stat.children[childName]) {
			// Child doesn't exist, use parent value
			return Math.floor(stat.value).toString();
		}
		return match; // Keep original if not found
	});

	// If there are still letters, return NaN
	if (/[a-zA-Z]/.test(expression)) {
		return NaN;
	}

	try {
		return Function(`"use strict"; return (${expression})`)();
	} catch {
		return NaN;
	}
}

// Parse inline feature definitions
function parseInlineFeature(character: Character, key: string, value: string): void {
	// Extract the feature object and description
	const match = value.match(/^(.*?)\s*\{([^}]+)\}\s*(.*)$/);
	if (!match) return;

	const [, prefix, objContent, description] = match;

	try {
		// Parse the object content
		const featureObj = parseFlexibleJSON(`{${objContent}}`) as any;
		featureObj.description = description.trim();

		// Parse as a feature
		parseAndAddFeature(character, key, featureObj);
	} catch (e) {
		console.error(`Error parsing inline feature ${key}: ${e}`);
	}
}
