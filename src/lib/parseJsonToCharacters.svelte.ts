// This file parses input JSONish into Character objects
export { parseSlashName, parseCharacters };

import { prettyStringProcessDiceExpression, rollDiceExpression } from './dice.svelte';
import { getKeyLineNumbers, parseFlexibleJSON } from './jsonParser.svelte';

function parseSlashName(originalName: string): { parent: string; name: string } {
	const splitName = originalName.split('/');
	if (splitName.length === 1) return { parent: '', name: originalName.trim() };
	return { parent: splitName[0].trim(), name: splitName[1].trim() };
}

// Parse JSON input into characters
function parseCharacters(characterStrings: string[]): Character[] {
	const parsedCharacters: Character[] = [];

	for (let i = 0; i < characterStrings.length; i++) {
		const characterDefinition = characterStrings[i].trim();
		if (!characterDefinition) continue;

		const character = processCharacter(characterDefinition, i);
		if (character) {
			parsedCharacters.push(character);
		}
	}

	return parsedCharacters;
}

// Process individual character object
function processCharacter(characterDefinition: string, index: number): Character | undefined {
	let obj: any;

	try {
		const parseString = `{ ${characterDefinition} }`;
		obj = parseFlexibleJSON(parseString);
		if (!obj.name) return undefined;
	} catch (e: any) {
		console.error(`Parsing error: ${e.message} in character ${characterDefinition}`);
		return undefined;
	}

	const character: Character = {
		name: obj.name,
		index,
		originalText: characterDefinition,
		numbers: {},
		features: {}
	};

	// Process each key-value pair
	for (const [key, value] of Object.entries(obj)) {
		if (key === 'name') continue;
		const normalizedKey = normalizeKey(key);
		let valStr = value!.toString();

		if (isNumberValue(value)) {
			// Handle numeric stats
			createNumberStat(character, normalizedKey, valStr);
		} else if (typeof value === 'object' && value !== null) {
			parseAndAddFeature(character, key, value);
		}
	}

	// Guarantee at least a couple properties
	if (!character.numbers.hasOwnProperty('max_hp')) return undefined;
	if (!character.numbers.hasOwnProperty('damage')) return undefined;

	// Process stat modifiers and calculate final values
	processStatModifiers(character);
	calculateFinalValues(character);

	addAttackChips(character);
	// Add line number information
	let lineNumbers = getKeyLineNumbers(`{${character.originalText}}`);
	for (const [key, row] of Object.entries(lineNumbers)) {
		let { name } = parseSlashName(key);
		name = normalizeKey(name);
		if (character.numbers[name] !== undefined) {
			character.numbers[name].row = row;
		}
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
function createNumberStat(
	character: Character,
	originalName: string,
	baseValue: string
): undefined {
	let numValue = Number(baseValue);
	const { parent, name } = parseSlashName(originalName);
	character.numbers[name] = {
		name: name,
		parentName: parent,
		baseValue: baseValue,
		modifiers: [],
		value: numValue
	};
}

// A feature contains a name, but all other values are optional.
// A feature's description is its highest priority auto-key, but the description always comes last
// Then, in standard order [roll, hit] are populated also
// You can populate {miss: , hit_effect: , or miss_effect: } values also
// roll: controls a die expression to be rolled, but if it starts with '+' it is treated as a 5e d20 attack that can critical hit
// The feature is an attack if it rolls against a target, which is indicated by putting " vs TARGET" at the end of roll:
// Right clicking or not having a target causes roll:, hit:, and miss: to all be rolled if able
// miss: can be "half" to always do exactly half of what a hit does
// Finally, stats:[ ] list controls stat changes the feature causes, such as adding a point of strength
//
// Examples:
// [group / ] feature name: { roll, hit, miss: , stats:[ stat += expression ], description comes last}
// items / Longsword +1: { d20 + 1 + str + pb vs ac , d10 slashing , "Sap - Your hit enemy has disadvantage on their next attack this round." }
// spells / Fireball: { d20 + int + pb - 14 vs dex_save , 8d6 fire , miss: half , "Range: 150 feet." }
// Firebolt: { +pb+int vs ac , cantrip_dice d10 fire , "You hurl a mote of flame up to 120 feet at your foe."},
// items / Chainmail: { stats: [ac += 6 - dex] , "The wearer has disadvantage on Dexterity (Stealth) checks." }
// items / Healing Potion: { 0 vs 0, -2d4-2 , "This small potion heals the most mortal of wounds, but little else?" }
// Trance: { "As an elf, you need rest only 4 hours in quiet meditation to gain the benefits of long rest." }
function parseAndAddFeature(character: Character, originalName: string, feature: any): undefined {
	const { parent, name } = parseSlashName(originalName);
	// iterate up to the last numeric value, which is description
	let num_features = 0;
	for (num_features = 0; feature[num_features]; num_features++) {}
	if (feature.description === undefined) {
		feature.description = feature[--num_features] || '';
	}
	// Now populate other numeric values to missing values in this array
	let otherValuesToParse = ['hit', 'roll'];
	for (let i = 0; i < num_features; i++) {
		// Pop otherValuesToParse until we need one
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
	let f: Feature = {
		name: name,
		description: feature.description || '',
		roll: rollFormula,
		roll_against: against,
		hit: feature.hit || '',
		miss: feature.miss || '',
		hit_effect: feature.hitEffect || '',
		miss_effect: feature.missEffect || '',
		stats: Array.isArray(feature.stats) ? feature.stats : [],
		chips: Array.isArray(feature.chips) ? feature.chips : []
	};

	character.features[parent] || (character.features[parent] = []);
	character.features[parent].push(f);
}

function addAttackChips(character: Character) {
	for (const featureGroup of Object.values(character.features)) {
		for (const feature of featureGroup) {
			if (feature.roll && feature.roll !== '0') {
				if ('' !== feature.roll_against) {
					let bonus = rollDiceExpression(character, feature.roll, { noDice: true });
					feature.chips.push(`${bonus >= 0 ? '+' : ''}${bonus} vs ${feature.roll_against}`);
				} else {
					feature.chips.push(`${feature.roll}`);
				}
			}
			if (feature.hit) {
				feature.chips.push(prettyStringProcessDiceExpression(character, feature.hit));
			}
			if (feature.miss === 'half') {
				feature.chips.push('save half');
			} else if (feature.miss) {
				feature.chips.push(
					`(${prettyStringProcessDiceExpression(character, feature.miss)} on save)`
				);
			}
		}
	}
}

// Extract the "against" part from a roll string
function extractAgainst(roll: string): [string, string] {
	let split = roll.split(' vs ');
	return [split[0], split[1] || ''];
}

// Process stat modifiers from traits
function processStatModifiers(character: Character): void {
	for (const featureGroup of Object.values(character.features)) {
		for (const feature of featureGroup) {
			if (feature.stats) {
				for (const modifier of feature.stats) {
					applyStatModifier(character, feature, modifier);
				}
			}
		}
	}
}

function splitModifier(modifier: string): {
	parent: string;
	stat: string;
	operator: '+' | '-' | '*' | '/';
	expression: string;
	prefix: string;
} {
	const splitModifier = modifier.split('=');
	if (splitModifier.length !== 2) {
		console.log(
			`cannot apply modifier "${modifier}" - should have single = existing - must be of the form STAT [+-*/]= EXPRESSION`
		);
		return { parent: '', stat: '', operator: '+', expression: '', prefix: '' };
	}
	const [prefix, expression] = splitModifier;
	const operator = prefix.substring(prefix.length - 1);
	if (!['+', '-', '*', '/'].includes(operator)) {
		console.log(
			`cannot apply modifier "${modifier}" - wrong operator - must be of the form STAT [+-*/]= EXPRESSION`
		);
		return { parent: '', stat: '', operator: '+', expression: '', prefix: '' };
	}
	const stat = prefix.substring(0, prefix.length - 1);

	const normalizedStatName = normalizeKey(stat);
	const { parent, name } = parseSlashName(normalizedStatName);
	return { parent, stat: name, operator: operator as any, expression, prefix: normalizedStatName };
}

// Apply a stat modifier to the appropriate number stat
function applyStatModifier(character: Character, source: Feature, modifier: string): void {
	let { stat, prefix } = splitModifier(modifier);
	// Ensure the stat exists
	if (!character.numbers[stat]) {
		createNumberStat(character, prefix, '0');
	}

	// Add the modifier
	character.numbers[stat].modifiers.push({
		source,
		modifier
	});
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
		}

		if (!changed) break;
		pass++;
	}
}

// Calculate the final value for a single stat
function calculateStatValue(
	numberStat: NumberStat,
	allNumbers: Record<string, NumberStat>
): number {
	let baseValue = numberStat.baseValue;
	let result = evaluateExpression(baseValue, allNumbers);
	if (isNaN(result)) return NaN;

	// Apply modifiers
	for (const { modifier } of numberStat.modifiers) {
		let { operator, expression } = splitModifier(modifier);

		const evaluatedValue = evaluateExpression(expression, allNumbers);

		if (isNaN(evaluatedValue)) return NaN;

		if (operator === '+') result += evaluatedValue;
		if (operator === '-') result -= evaluatedValue;
		if (operator === '*') result *= evaluatedValue;
		if (operator === '/') result /= evaluatedValue;
	}

	return result;
}

// Evaluate mathematical expressions with stat references
function evaluateExpression(expr: string, numbers: Record<string, NumberStat>): number {
	if (typeof expr === 'number') return expr;

	let expression = expr.toString();

	// Replace stat references with their values
	for (const [statName, numberStat] of Object.entries(numbers)) {
		const regex = new RegExp(`\\b${statName}\\b`, 'g');
		expression = expression.replace(regex, Math.floor(numberStat.value).toString());
	}

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
