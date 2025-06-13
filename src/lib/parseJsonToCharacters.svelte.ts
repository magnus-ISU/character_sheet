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
			// Handle numeric stats - create enhanced NumberStat
			createEnhancedNumberStat(character, normalizedKey, valStr);
		} else if (typeof value === 'object' && value !== null) {
			parseAndAddFeature(character, key, value);
		}
	}

	// Guarantee at least a couple properties
	if (!character.numbers.hasOwnProperty('max_hp')) return undefined;
	if (!character.numbers.hasOwnProperty('damage')) return undefined;

	// Auto-initialize stat properties and calculate final values
	initializeStatProperties(character);
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

// Create an enhanced NumberStat object with subfields
function createEnhancedNumberStat(
	character: Character,
	originalName: string,
	baseValue: string
): undefined {
	let numValue = Number(baseValue);
	const { parent, name } = parseSlashName(originalName);

	// Handle subfield definitions (e.g., "str.attack 5")
	const subfieldMatch = name.match(/^(\w+)\.(\w+)$/);
	if (subfieldMatch) {
		const [, statName, subfieldName] = subfieldMatch;

		// Ensure parent stat exists
		if (!character.numbers[statName]) {
			createEnhancedNumberStat(character, statName, '0');
		}

		// Set the subfield
		const stat = character.numbers[statName];
		if (subfieldName === 'attack') {
			stat.attack = numValue;
		} else if (subfieldName === 'defense') {
			stat.defense = numValue;
		} else if (subfieldName === 'roll') {
			stat.roll = baseValue; // Keep as string for dice expressions
		} else if (subfieldName === 'canCrit') {
			stat.canCrit = Boolean(numValue);
		} else if (subfieldName === 'renderSubfields') {
			stat.renderSubfields = Boolean(numValue);
		}
		return;
	}

	// Handle object-style stat definitions (e.g., "ac {baseValue: 20, canCrit: true}")
	if (typeof baseValue === 'object') {
		const statObj = baseValue as any;
		numValue = Number(statObj.baseValue || statObj.value || 0);

		const stat: NumberStat = {
			name: name,
			parentName: parent,
			baseValue: String(numValue),
			modifiers: [],
			value: numValue,
			attack: numValue,
			defense: numValue,
			roll: 'd20',
			canCrit: name === 'ac' ? true : statObj.canCrit || false,
			renderSubfields: statObj.renderSubfields !== false
		};

		// Override with specific values if provided
		if (statObj.attack !== undefined) stat.attack = Number(statObj.attack);
		if (statObj.defense !== undefined) stat.defense = Number(statObj.defense);
		if (statObj.roll !== undefined) stat.roll = String(statObj.roll);
		if (statObj.canCrit !== undefined) stat.canCrit = Boolean(statObj.canCrit);

		character.numbers[name] = stat;
		return;
	}

	// Standard stat creation
	character.numbers[name] = {
		name: name,
		parentName: parent,
		baseValue: baseValue,
		modifiers: [],
		value: numValue,
		attack: numValue, // Auto-initialized to stat value
		defense: numValue, // Auto-initialized to stat value
		roll: 'd20', // Default roll
		canCrit: name === 'ac', // AC can crit by default for 5e
		renderSubfields: true
	};
}

// Initialize stat properties after all stats are created
function initializeStatProperties(character: Character): void {
	for (const [name, stat] of Object.entries(character.numbers)) {
		// Auto-initialize attack and defense to stat value if not explicitly set
		if (stat.attack === undefined) stat.attack = stat.value;
		if (stat.defense === undefined) stat.defense = stat.value;
		if (stat.roll === undefined) stat.roll = 'd20';
		if (stat.canCrit === undefined) stat.canCrit = name === 'ac';
		if (stat.renderSubfields === undefined) stat.renderSubfields = true;
	}
}

// Enhanced feature parsing with attack info extraction
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

	// Parse attack information if this is an attack
	if (rollFormula && against) {
		f.attackInfo = parseAttackInfo(
			rollFormula,
			against,
			f.hit,
			f.miss,
			f.hit_effect,
			f.miss_effect
		);
	}

	character.features[parent] || (character.features[parent] = []);
	character.features[parent].push(f);
}

// Parse attack information into structured AttackInfo
function parseAttackInfo(
	roll: string,
	rollAgainst: string,
	hit: string,
	miss: string,
	hitEffect: string,
	missEffect: string
): AttackInfo {
	// Handle shorthand like "int vs dex" -> "int.attack vs dex.defense"
	let processedRoll = roll;
	let processedRollAgainst = rollAgainst;

	// If roll doesn't contain operators, assume it's a stat name and add .attack
	if (!/[+\-*/()]/.test(roll) && !/\./.test(roll)) {
		processedRoll = `${roll}.attack`;
	}

	// If rollAgainst doesn't contain operators, assume it's a stat name and add .defense
	if (!/[+\-*/()]/.test(rollAgainst) && !/\./.test(rollAgainst)) {
		processedRollAgainst = `${rollAgainst}.defense`;
	}

	// Parse roll into main roll and modifier
	// The main roll uses the stat's default roll, modifier is everything else
	const rollParts = processedRoll.split(/([+\-])/);
	const mainRoll = rollParts[0].trim();
	const modifier = rollParts.length > 1 ? rollParts.slice(1).join('').trim() : '';

	return {
		roll: processedRoll,
		rollAgainst: processedRollAgainst,
		mainRoll: mainRoll,
		modifier: modifier,
		hit: hit,
		miss: miss,
		hitEffect: hitEffect,
		missEffect: missEffect
	};
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
		createEnhancedNumberStat(character, prefix, '0');
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
				// Update attack and defense if they were auto-initialized
				if (numberStat.attack === oldValue) numberStat.attack = newValue;
				if (numberStat.defense === oldValue) numberStat.defense = newValue;
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
