#!/usr/bin/env bun

// Test runner for character sheet JSON parser
import { parseFlexibleJSON } from './jsonParser.svelte';
import { parseCharacters } from './parseJsonToCharacters.svelte';

// Test cases as specified by the user
const testCases = [
	// Test 1: Simple case
	'name Luke, max_hp 10, damage 0',

	// Test 2: With AC
	'name Luke, max_hp 10, damage 0, ac 10',

	// Test 3: With stats
	'name Luke, max_hp 10, damage 0, ac 10, str 0',

	// Test 4: With simple weapon
	'name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1',

	// Test 5: With weapon object
	'name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1 {roll str vs ac}',

	// Test 6: With weapon object and hit
	'name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1 {roll str vs ac, hit 1d10}',

	// Test 7: With weapon object, hit, and modifier
	'name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1 {roll str vs ac, hit 1d10 + str}',

	// Test 8: With weapon object, hit, modifier, and bonus
	'name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1 {roll str vs ac, hit 1d10 + str + 1}',

	// Test 9: With weapon description
	'name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1 {roll str vs ac, hit 1d10 + str + 1} a four-pound blade of death',

	// Test 10: Complete complex case with stat subfield
	'name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1 {roll str + 1 vs ac, hit 1d10 + str + 1} a four-pound blade of death, str.attack {baseValue: 0, roll: 2d20kh1}'
];

// Helper function to format test results
function formatTestResult(
	testNum: number,
	input: string,
	success: boolean,
	error?: string
): string {
	const status = success ? '✓ PASS' : '✗ FAIL';
	const errorMsg = error ? `\n    Error: ${error}` : '';
	return `Test ${testNum}: ${status}
    Input: "${input}"${errorMsg}`;
}

// Run JSON parser tests
function runJsonParserTests(): void {
	console.log('=== JSON Parser Tests ===\n');

	testCases.forEach((testCase, index) => {
		try {
			const result = parseFlexibleJSON(`{${testCase}}`);
			console.log(formatTestResult(index + 1, testCase, true));
			console.log(`    Parsed: ${JSON.stringify(result, null, 2)}\n`);
		} catch (error) {
			console.log(formatTestResult(index + 1, testCase, false, String(error)));
			console.log('');
		}
	});
}

// Run character parser tests
function runCharacterParserTests(): void {
	console.log('=== Character Parser Tests ===\n');

	testCases.forEach((testCase, index) => {
		try {
			const characters = parseCharacters([testCase]);
			if (characters.length === 0) {
				throw new Error('No characters parsed');
			}
			const character = characters[0];
			console.log(formatTestResult(index + 1, testCase, true));
			console.log(`    Character: ${character.name}`);
			console.log(
				`    Stats: str=${character.numbers.str?.value}, ac=${character.numbers.ac?.value}`
			);
			console.log(`    Features: ${Object.keys(character.features).join(', ')}\n`);
		} catch (error) {
			console.log(formatTestResult(index + 1, testCase, false, String(error)));
			console.log('');
		}
	});
}

// Main execution
function main(): void {
	console.log('Character Sheet Parser Test Suite');
	console.log('=================================\n');

	runJsonParserTests();
	runCharacterParserTests();

	console.log('Test run complete!');
}

// Run tests immediately
main();
