// This file allows characters to roll dice like `d20 + 4 + pb + (str + dex)/2
export { rollDiceExpression, processAttack, prettyStringProcessDiceExpression };

function rollDiceExpression(
	character: Character,
	expression: string,
	args?: { noDice?: boolean }
): number {
	// Replace character stats with their floored values
	let processedExpression = expression;

	// Handle variable dice (like cantrip_dice d8) BEFORE replacing individual stats
	processedExpression = processedExpression.replace(/(\w+)\s+d(\d+)/g, (_, variable, dieSize) => {
		const num_object = character.numbers[variable];
		const multiplier = num_object ? Math.floor(num_object.value) : 1;
		const size = parseInt(dieSize);
		let total = 0;
		for (let i = 0; i < multiplier; i++) {
			total += Math.floor(Math.random() * size) + 1;
		}
		return total.toString();
	});

	// Now replace individual character stats with their floored values
	for (const [key, value] of Object.entries(character.numbers)) {
		const flooredValue = Math.floor(value.value);
		// Use word boundaries to avoid partial matches
		processedExpression = processedExpression.replace(
			new RegExp(`\\b${key}\\b`, 'g'),
			flooredValue.toString()
		);
	}

	// Handle dice notation (XdY, XdYkh/klZ, etc.)
	processedExpression = processedExpression.replace(
		/(\d+)d(\d+)(?:k([hl])(\d+))?/g,
		(_, numDice, dieSize, keepType, keepCount) => {
			if (args?.noDice) return '0';
			const num = parseInt(numDice);
			const size = parseInt(dieSize);
			const keep = keepCount ? parseInt(keepCount) : num;

			// Roll all dice
			const rolls = [];
			for (let i = 0; i < num; i++) {
				rolls.push(Math.floor(Math.random() * size) + 1);
			}

			// Sort and keep appropriate dice
			if (keepType === 'h') {
				// Keep highest
				rolls.sort((a, b) => b - a);
				return rolls
					.slice(0, keep)
					.reduce((sum, roll) => sum + roll, 0)
					.toString();
			} else if (keepType === 'l') {
				// Keep lowest
				rolls.sort((a, b) => a - b);
				return rolls
					.slice(0, keep)
					.reduce((sum, roll) => sum + roll, 0)
					.toString();
			} else {
				// Keep all (standard dice roll)
				return rolls.reduce((sum, roll) => sum + roll, 0).toString();
			}
		}
	);

	// Handle single die notation (dX)
	processedExpression = processedExpression.replace(/\bd(\d+)\b/g, (_, dieSize) => {
		if (args?.noDice) return '0';
		const size = parseInt(dieSize);
		const roll = Math.floor(Math.random() * size) + 1;
		return roll.toString();
	});

	// Evaluate the final mathematical expression
	try {
		// Remove any remaining non-numeric characters except operators and parentheses
		if (/[a-zA-Z_]/.test(processedExpression)) {
			console.warn(`Unresolved variables in expression: ${processedExpression}`);
			return NaN;
		}

		const result = Function(`"use strict"; return (${processedExpression})`)();
		return Math.floor(result);
	} catch (error) {
		console.error(
			`Failed to evaluate dice expression: ${expression} -> ${processedExpression}`,
			error
		);
		return NaN;
	}
}

// Helper function to roll critical damage (double dice, not bonuses)
function rollCriticalDamage(character: Character, damageExpression: string): number {
	// Handle variable dice (like cantrip_dice d8) BEFORE replacing individual stats
	let processedExpression = damageExpression;
	processedExpression = processedExpression.replace(/(\w+)\s+d(\d+)/g, (_, variable, dieSize) => {
		const num_object = character.numbers[variable];
		const multiplier = num_object ? Math.floor(num_object.value) : 1;
		const size = parseInt(dieSize);
		let diceTotal = 0;
		// Roll twice the normal amount for crits
		for (let i = 0; i < multiplier * 2; i++) {
			diceTotal += Math.floor(Math.random() * size) + 1;
		}
		return diceTotal.toString();
	});

	// Replace character stats with their floored values
	for (const [key, value] of Object.entries(character.numbers)) {
		const flooredValue = Math.floor(value.value);
		processedExpression = processedExpression.replace(
			new RegExp(`\\b${key}\\b`, 'g'),
			flooredValue.toString()
		);
	}

	// Track bonuses separately from dice
	let totalDiceRolls = 0;
	let bonusExpression = processedExpression;

	// Handle standard dice notation (XdY) - roll twice for crits
	bonusExpression = bonusExpression.replace(
		/(\d+)d(\d+)(?:k([hl])(\d+))?/g,
		(_, numDice, dieSize, keepType, keepCount) => {
			const num = parseInt(numDice);
			const size = parseInt(dieSize);
			const keep = keepCount ? parseInt(keepCount) : num;

			// Roll dice twice for critical hit
			const allRolls = [];
			for (let i = 0; i < num * 2; i++) {
				allRolls.push(Math.floor(Math.random() * size) + 1);
			}

			let diceTotal = 0;
			if (keepType === 'h') {
				// Keep highest, but from double the dice
				allRolls.sort((a, b) => b - a);
				diceTotal = allRolls.slice(0, keep * 2).reduce((sum, roll) => sum + roll, 0);
			} else if (keepType === 'l') {
				// Keep lowest, but from double the dice
				allRolls.sort((a, b) => a - b);
				diceTotal = allRolls.slice(0, keep * 2).reduce((sum, roll) => sum + roll, 0);
			} else {
				// Keep all dice (doubled)
				diceTotal = allRolls.reduce((sum, roll) => sum + roll, 0);
			}

			totalDiceRolls += diceTotal;
			return '0'; // Replace with 0 so bonuses aren't doubled
		}
	);

	// Handle single die notation (dX) - roll twice for crits
	bonusExpression = bonusExpression.replace(/\bd(\d+)\b/g, (_, dieSize) => {
		const size = parseInt(dieSize);
		const roll1 = Math.floor(Math.random() * size) + 1;
		const roll2 = Math.floor(Math.random() * size) + 1;
		totalDiceRolls += roll1 + roll2;
		return '0'; // Replace with 0 so bonuses aren't doubled
	});

	// Calculate bonuses (everything that's not dice)
	let bonusTotal = 0;
	try {
		if (/[a-zA-Z_]/.test(bonusExpression)) {
			console.warn(`Unresolved variables in critical damage expression: ${bonusExpression}`);
		} else {
			bonusTotal = Function(`"use strict"; return (${bonusExpression})`)();
		}
	} catch (error) {
		console.error(`Failed to evaluate bonus expression: ${bonusExpression}`, error);
	}

	return Math.floor(totalDiceRolls + bonusTotal);
}

function parseDamageExpression(expression: string, attacker: Character): AttackResult {
	if (!expression) return { damageDealt: 0, damageType: 'damage' };

	// Split by spaces to find potential damage type at the end
	let damageExpression = expression.trim();
	const parts = damageExpression.split(/\s+/);
	let damageType = 'damage';

	const operators = ['+', '-', '*', '/', '(', ')'];
	const knownVars = Object.keys(attacker.numbers);

	// Find the last sequence of words that are not operators, numbers, dice, or variables
	let damageTypeStartIndex = parts.length;

	for (let i = parts.length - 1; i >= 0; i--) {
		const part = parts[i];

		// If this part is an operator, number, dice notation, or known variable, stop here
		if (
			operators.includes(part) ||
			!isNaN(Number(part)) ||
			/\d*d\d+/.test(part) ||
			knownVars.includes(part)
		) {
			break;
		}

		// If we get here, this part could be part of a damage type
		damageTypeStartIndex = i;
	}

	// If we found potential damage type words at the end
	if (damageTypeStartIndex < parts.length) {
		// Make sure there's actually a mathematical expression before the damage type
		if (damageTypeStartIndex > 0) {
			damageType = parts.slice(damageTypeStartIndex).join(' ');
			damageExpression = parts.slice(0, damageTypeStartIndex).join(' ');
		}
	}

	// If we removed everything, restore the original expression
	if (!damageExpression.trim()) {
		damageExpression = expression;
		damageType = 'damage';
	}

	const damage = rollDiceExpression(attacker, damageExpression);
	return { damageDealt: damage, damageType };
}

function processAttack(
	attacker: Character,
	target: Character | undefined,
	attack: Feature,
	logMessage: Function
): AttackResult {
	// Check if this is a 5e attack (starts with +)
	const is5eAttack = attack.roll.startsWith('+');
	let toHitRoll = 0;
	let d20Result = 0;
	let modifierValue = 0;

	if (is5eAttack) {
		// Roll d20 separately for 5e attacks
		d20Result = Math.floor(Math.random() * 20) + 1;
		// Remove the + and just pass the modifiers to the dice roller
		const modifiers = attack.roll.substring(1);
		modifierValue = rollDiceExpression(attacker, modifiers);
		console.log(attacker, modifiers, modifierValue);
		toHitRoll = d20Result + modifierValue;
	} else {
		// Non-5e systems: roll the full expression
		toHitRoll = rollDiceExpression(attacker, attack.roll);
	}

	// Determine if this is a critical hit or miss (only for 5e attacks)
	let logType = 'roll';
	let isCriticalHit = false;
	let isCriticalMiss = false;
	let isHit = false;

	let targetValue: undefined | number;
	if (target && attack.roll_against !== undefined) {
		targetValue = isNaN(Number(attack.roll_against))
			? target.numbers[attack.roll_against]?.value || 0
			: Number(attack.roll_against);
	}

	if (is5eAttack) {
		if (d20Result === 20) {
			isCriticalHit = true;
			isHit = true; // Criticals always hit
		} else if (d20Result === 1) {
			isCriticalMiss = true;
			isHit = false; // Critical misses always miss
		} else {
			// Normal 5e hit determination
			if (target && targetValue) {
				isHit = toHitRoll >= targetValue;
			} else {
				isHit = true; // No target or targetValue specified, assume hit
			}
		}
	} else {
		// Non-5e systems: compare roll result to target
		if (target && targetValue) {
			isHit = toHitRoll >= targetValue;
		} else {
			isHit = true; // No target or targetValue specified, assume hit
		}
	}

	// Parse damage and damage types
	let hitDamageResult = { damageDealt: 0, damageType: 'damage' };
	let missDamageResult = { damageDealt: 0, damageType: 'damage' };

	if (isCriticalHit) {
		// For critical hits, we need to handle damage type parsing specially
		const parsed = parseDamageExpression(attack.hit, attacker);
		hitDamageResult.damageType = parsed.damageType;
		// Roll critical damage on the dice expression only
		hitDamageResult.damageDealt = rollCriticalDamage(
			attacker,
			attack.hit.replace(parsed.damageType, '').trim()
		);
	} else {
		// Normal hit
		hitDamageResult = parseDamageExpression(attack.hit, attacker);
	}

	if (attack.miss === 'half') {
		missDamageResult = {
			damageDealt: Math.floor(hitDamageResult.damageDealt / 2),
			damageType: hitDamageResult.damageType
		};
	} else {
		missDamageResult = parseDamageExpression(attack.miss, attacker);
	}

	// Build the message
	let message = `${attacker.name} ${attack.name.toLowerCase()}${attack.name[attack.name.length - 1] === 's' ? 'es' : 's'}${target !== undefined ? ` ${target.name}` : ''}:`;
	if (is5eAttack) {
		message += ` ${d20Result} ${modifierValue >= 0 ? '+' : '-'} ${Math.abs(modifierValue)}`;
	} else {
		message += ` ${toHitRoll}`;
	}
	let messageEnd = attack.roll;

	if (attack.roll_against) {
		message += ` vs ${targetValue ?? attack.roll_against}`;
		messageEnd += ` vs ${attack.roll_against}`;
	}

	// Add hit/miss result with damage type
	if (attack.roll_against) {
		if (isCriticalHit) {
			logType = 'critical-hit';
			message += ` | ${hitDamageResult.damageDealt} ${hitDamageResult.damageType}`;
			messageEnd += ` | CRITICAL 2x ${attack.hit}`;
		} else if (isHit) {
			message += ` | ${hitDamageResult.damageDealt} ${hitDamageResult.damageType}`;
			messageEnd += ` | ${attack.hit}`;
		} else {
			message += ` | ${missDamageResult.damageDealt} ${missDamageResult.damageType}`;
			messageEnd += ` | ${attack.miss}`;
			logType = isCriticalMiss ? 'critical-miss' : 'miss';
		}
	} else {
		// No target: show both hit and miss damage
		message += ` | Hit: ${hitDamageResult.damageDealt} ${hitDamageResult.damageType} | Miss: ${missDamageResult.damageDealt} ${missDamageResult.damageType}`;
		messageEnd += ` | Hit: ${attack.hit}, Miss: ${attack.miss}`;
	}

	logMessage(message + '           ' + messageEnd, logType);

	if (isHit) {
		return hitDamageResult;
	} else {
		return missDamageResult;
	}
}

function prettyStringProcessDiceExpression(character: Character, expression: string): string {
	let prefix = '';
	if (expression[0] === '-') {
		prefix = '-';
		expression = expression.substring(1);
	}
	// Create a map of stat names to their values for easier lookup
	const statValues: Record<string, number> = {};
	for (const [key, stat] of Object.entries(character.numbers)) {
		statValues[key] = Math.floor(stat.value);
		// Also add the stat name if it's different from the key
		if (stat.name !== key) {
			statValues[stat.name.toLowerCase()] = Math.floor(stat.value);
		}
	}

	// Step 1: Parse tokens and operators/whitespace
	// Split on both whitespace and operators while capturing them
	const parts = expression.split(/(\s+|[+\-])/);

	const tokens: string[] = [];
	const separators: string[] = []; // Store both whitespace and operators

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part && !part.match(/^\s+$/) && !part.match(/^[+\-]$/)) {
			// This is a token (not whitespace or operator)
			tokens.push(part);
		} else if (part) {
			// This is whitespace or an operator
			separators.push(part);
		}
	}

	// Step 2: Replace variables with their values
	const replacedTokens = tokens.map((token) => {
		const lowerToken = token.toLowerCase();
		if (statValues.hasOwnProperty(lowerToken)) {
			return statValues[lowerToken].toString();
		}
		return token;
	});

	// Step 3: Do simple arithmetic - combine consecutive numbers
	const processedTokens: string[] = [];
	const processedSeparators: string[] = [];
	let i = 0;
	let sepIndex = 0;

	while (i < replacedTokens.length) {
		const token = replacedTokens[i];

		if (/^\d+$/.test(token)) {
			// This is a number - collect consecutive numbers and do arithmetic
			let sum = parseInt(token, 10);
			let j = i + 1;
			let currentSepIndex = sepIndex;

			// Look ahead for more numbers, handling operators between them
			while (j < replacedTokens.length && /^\d+$/.test(replacedTokens[j])) {
				const nextNum = parseInt(replacedTokens[j], 10);

				// Find the operator between current and next number
				// Skip whitespace to find the actual operator
				let foundOperator = '+'; // default to addition
				while (currentSepIndex < separators.length) {
					const sep = separators[currentSepIndex];
					if (sep.match(/^[+\-]$/)) {
						foundOperator = sep;
						currentSepIndex++;
						break;
					}
					currentSepIndex++;
				}

				if (foundOperator === '-') {
					sum -= nextNum;
				} else {
					sum += nextNum;
				}

				j++;
			}

			processedTokens.push(sum.toString());

			// Skip past the separators we consumed during arithmetic
			while (sepIndex < separators.length && sepIndex < currentSepIndex) {
				sepIndex++;
			}

			i = j;
		} else {
			// Keep non-numeric tokens as-is
			processedTokens.push(token);

			// Add the separator that comes after this token
			if (sepIndex < separators.length) {
				processedSeparators.push(separators[sepIndex]);
				sepIndex++;
			}

			i++;
		}
	}

	// Step 4: Reconstruct with saved separators
	let result = processedTokens[0] || '';

	for (let i = 1; i < processedTokens.length; i++) {
		if (i - 1 < processedSeparators.length) {
			result += processedSeparators[i - 1];
		}
		result += processedTokens[i];
	}

	return `${prefix}${result}`;
}
