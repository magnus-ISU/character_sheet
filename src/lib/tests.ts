#!/usr/bin/env bun

// Test runner for character sheet JSON parser
import { parseFlexibleJSON } from './jsonParser.svelte';
import { parseCharacters } from './parseJsonToCharacters.svelte';

// Test the new parsing requirements with the provided example
const newFormatExample = `# Globals
str.defense str.save+14, dex.defense dex.save+14, con.defense con.save+14, int.defense int.save+14, wis.defense wis.save+14, cha.defense cha.save+14
---
name Luke, hit die: 10, level 4
str 3, dex 0, con 2, int 2, wis -1, cha 1
level.used_healing_surges 0, damage 0

pb 1 + (level+3)/4, health level * (hit_die/2 + 1 + con) + hit_die/2 - 1
ac 10 + dex

# Advantage on charisma saves
Impervious Sanctity of Mind: { stats: [ { stat cha.defense, roll 2d20kh1 } ] } You have an iron will.
# trained in strength and dexterity saves
Fighter saves: { stats: [ { stat str.save, bonus pb }, { stat dex.save, bonus pb } ] } Trained in strength and dexterity saves.
# Chain Mail Armor: AC set to 16
Chainmail { stats: [ { stat ac, bonus 6-dex } ] } "A thousand metal rings, stamped together in a shirt."

# Attacks
longsword {roll str vs ac, hit 1d10 + str slashing} A sharp blade of steel.
fireball {roll int vs dex, hit 8d6 fire} A great explosion of flame.
---
name Goblin, damage 0, str 1, dex 2, con 0, int -2, wis 0, cha -3
spear {roll +4 vs ac, hit 1d6+1 slashing}
taunt {roll +0 vs cha, hit_effect Your target must spend all their movement running towards you} A screeching ugly sound.`;

// Helper function to format test results
function formatTestResult(testName: string, success: boolean, error?: string): string {
	const status = success ? '✓ PASS' : '✗ FAIL';
	const errorMsg = error ? `\n    Error: ${error}` : '';
	return `${testName}: ${status}${errorMsg}`;
}

function printObject(obj: object): string {
	// Helper to deep clone an object, preserving cycles
	function deepCloneWithRefs(value: any, seen = new Map()): any {
		if (typeof value !== 'object' || value === null) return value;
		if (seen.has(value)) return seen.get(value);
		const clone: any = Array.isArray(value) ? [] : {};
		seen.set(value, clone);
		for (const key of Object.keys(value)) {
			clone[key] = deepCloneWithRefs(value[key], seen);
		}
		return clone;
	}

	// Helper to find all self-references and replace them with '-> pointer'
	function replaceSelfReferences(orig: any, clone: any, seen = new Map()) {
		if (typeof orig !== 'object' || orig === null) return;
		seen.set(orig, clone);
		for (const key of Object.keys(orig)) {
			const origVal = orig[key];
			const cloneVal = clone[key];
			if (typeof origVal === 'object' && origVal !== null) {
				if (seen.has(origVal)) {
					clone[key] = '-> pointer';
				} else {
					replaceSelfReferences(origVal, cloneVal, seen);
				}
			}
		}
	}

	const cloned = deepCloneWithRefs(obj);
	replaceSelfReferences(obj, cloned);

	const result = JSON.stringify(cloned, null, 2);
	console.log(result);
	return result;
}

// Test the new parsing format
function testNewFormat(): void {
	console.log('=== New Format Parsing Test ===\n');

	try {
		const characters = parseCharacters([newFormatExample]);
		printObject(characters);

		// Verify we got 2 characters
		if (characters.length !== 2) {
			throw new Error(`Expected 2 characters, got ${characters.length}`);
		}

		const luke = characters[0];
		const goblin = characters[1];

		// Test Luke
		console.log(formatTestResult('Luke character parsed', luke.name === 'Luke'));

		// Test health property (was max_hp)
		console.log(formatTestResult('Luke has health property', luke.numbers.health !== undefined));
		console.log(
			formatTestResult('Luke health render is false', luke.numbers.health?.render === false)
		);

		// Test damage property
		console.log(formatTestResult('Luke has damage property', luke.numbers.damage !== undefined));
		console.log(
			formatTestResult('Luke damage render is false', luke.numbers.damage?.render === false)
		);

		// Test child stats with dots
		console.log(
			formatTestResult(
				'Luke level has used_healing_surges child',
				luke.numbers.level?.children?.used_healing_surges !== undefined
			)
		);

		// Test stat calculations
		const expectedHealth = 4 * (10 / 2 + 1 + 2) + 10 / 2 - 1; // level * (hit_die/2 + 1 + con) + hit_die/2 - 1
		console.log(
			formatTestResult(
				`Luke health calculated correctly (expected ${expectedHealth})`,
				Math.abs(luke.numbers.health.value - expectedHealth) < 0.01
			)
		);

		// Test pb calculation
		const expectedPb = 1 + Math.floor((4 + 3) / 4); // 1 + (level+3)/4
		console.log(
			formatTestResult(
				`Luke pb calculated correctly (expected ${expectedPb})`,
				luke.numbers.pb.value === expectedPb
			)
		);

		// Test features
		console.log(
			formatTestResult(
				'Luke has Impervious Sanctity of Mind feature',
				luke.features['']?.some((f) => f.name === 'Impervious Sanctity of Mind')
			)
		);

		console.log(
			formatTestResult(
				'Luke has longsword attack',
				luke.features['']?.some((f) => f.name === 'longsword')
			)
		);

		// Test Goblin
		console.log(formatTestResult('Goblin character parsed', goblin.name === 'Goblin'));
		console.log(
			formatTestResult(
				'Goblin has spear attack',
				goblin.features['']?.some((f) => f.name === 'spear')
			)
		);

		// Display character structure for verification
		console.log('\n=== Luke Structure ===');
		console.log('Numbers:', Object.keys(luke.numbers));
		console.log('Health value:', luke.numbers.health?.value);
		console.log('PB value:', luke.numbers.pb?.value);
		console.log('Level children:', Object.keys(luke.numbers.level?.children || {}));
		console.log('Features:', Object.keys(luke.features));

		console.log('\n=== Goblin Structure ===');
		console.log('Numbers:', Object.keys(goblin.numbers));
		console.log('Features:', Object.keys(goblin.features));
	} catch (error) {
		console.log(formatTestResult('New Format Parsing', false, String(error)));
	}
}

// Test comment parsing
function testCommentParsing(): void {
	console.log('\n=== Comment Parsing Test ===\n');

	const testWithComments = `name Test # This is a comment
str 5 # Another comment
health 10`;

	try {
		const characters = parseCharacters([testWithComments]);
		console.log(
			formatTestResult(
				'Comments ignored during parsing',
				characters.length === 1 && characters[0].name === 'Test'
			)
		);
	} catch (error) {
		console.log(formatTestResult('Comment Parsing', false, String(error)));
	}
}

// Test newlines as commas
function testNewlinesAsCommas(): void {
	console.log('\n=== Newlines as Commas Test ===\n');

	const testWithNewlines = `name Test
str 5
health 10
damage 0`;

	try {
		const characters = parseCharacters([testWithNewlines]);
		console.log(
			formatTestResult(
				'Newlines treated as commas',
				characters.length === 1 &&
					characters[0].numbers.str?.value === 5 &&
					characters[0].numbers.health?.value === 10
			)
		);
	} catch (error) {
		console.log(formatTestResult('Newlines as Commas', false, String(error)));
	}
}

// Main execution
function main(): void {
	console.log('Enhanced Character Sheet Parser Test Suite');
	console.log('==========================================\n');

	testNewFormat();
	testCommentParsing();
	testNewlinesAsCommas();

	console.log('\nTest run complete!');
}

// Run tests immediately
main();
