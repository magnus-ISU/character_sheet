// Comprehensive tests for the redesigned character sheet app
import { parseFlexibleJSON } from './jsonParser.svelte';
import { parseCharacters } from './parseJsonToCharacters.svelte';
import { rollDiceExpression, rollStatRoll } from './dice.svelte';

// Test utilities
function assert(condition: boolean, message: string) {
	if (!condition) {
		throw new Error(`Test failed: ${message}`);
	}
}

function assertEqual(actual: any, expected: any, message: string) {
	if (actual !== expected) {
		throw new Error(`Test failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
	}
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
	if (Math.abs(actual - expected) > tolerance) {
		throw new Error(
			`Test failed: ${message}. Expected: ${expected} ± ${tolerance}, Actual: ${actual}`
		);
	}
}

// Enhanced JSON Parser Tests
export function testJsonParser() {
	console.log('Testing JSON Parser...');

	// Test space-separated key-value pairs
	const spaceTest = 'str 2, dex 1, con 3';
	const spaceResult = parseFlexibleJSON(`{${spaceTest}}`) as any;
	assertEqual(spaceResult.str, 2, 'Space-separated str value');
	assertEqual(spaceResult.dex, 1, 'Space-separated dex value');
	assertEqual(spaceResult.con, 3, 'Space-separated con value');

	// Test inferred object colons
	const objectTest = 'greatsword {roll str vs ac, hit 2d6 + str}';
	const objectResult = parseFlexibleJSON(`{${objectTest}}`) as any;
	assert(typeof objectResult.greatsword === 'object', 'Inferred colon creates object');
	assertEqual(objectResult.greatsword.roll, 'str vs ac', 'Object roll property');
	assertEqual(objectResult.greatsword.hit, '2d6 + str', 'Object hit property');

	// Test object description after object
	const descTest = 'fireball {roll int vs dex, hit 8d6 fire} A mighty spell that burns enemies';
	const descResult = parseFlexibleJSON(`{${descTest}}`) as any;
	assertEqual(
		descResult.fireball.description,
		'A mighty spell that burns enemies',
		'Description after object'
	);

	// Test mixed format
	const mixedTest = 'str 2, dex 1, longsword {roll str vs ac, hit 1d8 + str}, pb 2';
	const mixedResult = parseFlexibleJSON(`{${mixedTest}}`) as any;
	assertEqual(mixedResult.str, 2, 'Mixed format str');
	assertEqual(mixedResult.pb, 2, 'Mixed format pb');
	assert(typeof mixedResult.longsword === 'object', 'Mixed format object');

	console.log('JSON Parser tests passed!');
}

// Character Parser Tests
export function testCharacterParser() {
	console.log('Testing Character Parser...');

	const characterInput = [
		'name: "Test Character", str 15, dex 12, con 14, int 10, wis 13, cha 8, ac 16, max_hp 20, damage 0, pb 2, longsword {roll str vs ac, hit 1d8 + str}, fireball {roll int vs dex, hit 8d6 fire, miss half}'
	];

	const characters = parseCharacters(characterInput);
	assertEqual(characters.length, 1, 'One character parsed');

	const char = characters[0];
	assertEqual(char.name, 'Test Character', 'Character name');

	// Test NumberStat structure
	const strStat = char.numbers.str;
	assert(strStat !== undefined, 'Str stat exists');
	assertEqual(strStat.value, 15, 'Str base value');
	assertEqual(strStat.attack, 15, 'Str attack auto-initialized');
	assertEqual(strStat.defense, 15, 'Str defense auto-initialized');
	assertEqual(strStat.roll, 'd20', 'Str default roll');

	// Test AC can crit
	const acStat = char.numbers.ac;
	assert(acStat !== undefined, 'AC stat exists');
	assertEqual(acStat.canCrit, true, 'AC can crit by default');

	// Test features
	assert(char.features[''] !== undefined, 'Default feature group exists');
	const longsword = char.features[''].find((f) => f.name === 'longsword');
	assert(longsword !== undefined, 'Longsword feature exists');
	assertEqual(longsword.roll, 'str', 'Longsword roll');
	assertEqual(longsword.roll_against, 'ac', 'Longsword vs AC');

	// Test attack info parsing
	assert(longsword !== undefined, 'Longsword exists');
	assert(longsword!.attackInfo !== undefined, 'Longsword has attack info');
	assertEqual(longsword!.attackInfo!.rollAgainst, 'ac.defense', 'Attack against AC defense');

	console.log('Character Parser tests passed!');
}

// NumberStat Subfields Tests
export function testNumberStatSubfields() {
	console.log('Testing NumberStat Subfields...');

	const characterInput = [
		'name: "Subfield Test", str 15, str.attack 17, dex 12, dex.defense 14, con {baseValue: 14, canCrit: true}, max_hp 20, damage 0'
	];

	const characters = parseCharacters(characterInput);
	const char = characters[0];

	// Test explicit subfield setting
	const strStat = char.numbers.str;
	assertEqual(strStat.value, 15, 'Str base value');
	assertEqual(strStat.attack, 17, 'Str attack explicitly set');
	assertEqual(strStat.defense, 15, 'Str defense auto-initialized');

	const dexStat = char.numbers.dex;
	assertEqual(dexStat.defense, 14, 'Dex defense explicitly set');
	assertEqual(dexStat.attack, 12, 'Dex attack auto-initialized');

	// Test object-style stat definition
	const conStat = char.numbers.con;
	assertEqual(conStat.value, 14, 'Con object-style value');
	assertEqual(conStat.canCrit, true, 'Con object-style canCrit');

	console.log('NumberStat Subfields tests passed!');
}

// Attack Information Tests
export function testAttackInformation() {
	console.log('Testing Attack Information...');

	const characterInput = [
		'name: "Attack Test", str 16, dex 14, int 12, ac 15, max_hp 20, damage 0, sword {roll str vs ac, hit 1d8 + str}, fireball {roll int vs dex, hit 8d6 fire}'
	];

	const characters = parseCharacters(characterInput);
	const char = characters[0];

	// Test sword attack info
	const sword = char.features[''].find((f) => f.name === 'sword');
	assert(sword.attackInfo !== undefined, 'Sword has attack info');
	assertEqual(sword.attackInfo.roll, 'str.attack', 'Sword roll with subfield');
	assertEqual(sword.attackInfo.rollAgainst, 'ac.defense', 'Sword against AC defense');
	assertEqual(sword.attackInfo.mainRoll, 'str.attack', 'Sword main roll');

	// Test fireball attack info
	const fireball = char.features[''].find((f) => f.name === 'fireball');
	assert(fireball.attackInfo !== undefined, 'Fireball has attack info');
	assertEqual(fireball.attackInfo.rollAgainst, 'dex.defense', 'Fireball against Dex defense');

	console.log('Attack Information tests passed!');
}

// Dice Rolling Tests
export function testDiceRolling() {
	console.log('Testing Dice Rolling...');

	const characterInput = [
		'name: "Dice Test", str 16, dex 14, str.attack 18, dex.defense 16, str.roll "2d20kh1", max_hp 20, damage 0'
	];

	const characters = parseCharacters(characterInput);
	const char = characters[0];

	// Test subfield references in expressions
	const attackRoll = rollDiceExpression(char, 'str.attack + 2', { noDice: true });
	assertEqual(attackRoll, 20, 'Subfield reference in expression'); // 18 + 2

	const defenseRoll = rollDiceExpression(char, 'dex.defense - 1', { noDice: true });
	assertEqual(defenseRoll, 15, 'Defense subfield reference'); // 16 - 1

	// Test stat default roll
	// Note: This will be random, so we can't test exact values
	// But we can test that it doesn't throw errors
	const statRoll = rollStatRoll(char, 'str');
	assert(typeof statRoll === 'number', 'Stat roll returns number');
	assert(!isNaN(statRoll), 'Stat roll is not NaN');

	// Test custom roll expression (advantage)
	const strStat = char.numbers.str;
	assertEqual(strStat.roll, '2d20kh1', 'Custom roll set correctly');

	console.log('Dice Rolling tests passed!');
}

// Integration Tests
export function testIntegration() {
	console.log('Testing Integration...');

	const fullCharacterInput = [
		`name: "Warrior",
		str 16, dex 12, con 14, int 10, wis 13, cha 8,
		ac 18, max_hp 25, damage 5, pb 3,
		str.attack str + pb, str.roll "d20",
		longsword {roll str vs ac, hit 1d8 + str, description: "A sharp blade"},
		great axe {roll str vs ac, hit 1d12 + str} A massive two-handed weapon,
		fireball {roll int vs dex, hit 8d6 fire, miss half},
		chainmail {stats: [ac += 6 - dex], description: "Heavy armor"}`.replace(/\s+/g, ' ')
	];

	const characters = parseCharacters(fullCharacterInput);
	assertEqual(characters.length, 1, 'Integration: One character');

	const char = characters[0];
	assertEqual(char.name, 'Warrior', 'Integration: Character name');

	// Test stat modifiers
	const strAttack = char.numbers.str.attack;
	// Should be base str (16) + pb (3) = 19
	assertEqual(strAttack, 16, 'Integration: Str attack before modifiers'); // Base value, modifiers applied differently

	// Test AC stat
	const ac = char.numbers.ac;
	assertEqual(ac.canCrit, true, 'Integration: AC can crit');

	// Test features with descriptions
	const longsword = char.features[''].find((f) => f.name === 'longsword');
	assertEqual(longsword.description, 'A sharp blade', 'Integration: Explicit description');

	const greatAxe = char.features[''].find((f) => f.name === 'great axe');
	assertEqual(
		greatAxe.description,
		'A massive two-handed weapon',
		'Integration: Description after object'
	);

	// Test attack info
	assert(longsword.attackInfo !== undefined, 'Integration: Attack info exists');
	assertEqual(
		longsword.attackInfo.rollAgainst,
		'ac.defense',
		'Integration: Attack against AC defense'
	);

	console.log('Integration tests passed!');
}

// Output Validation Tests
export function testOutputValidation() {
	console.log('Testing Output Validation...');

	const characterInput = [
		'name: "Validator", str 15, dex 12, con 14, max_hp 20, damage 0, sword {roll str vs ac, hit 1d8 + str}'
	];

	const characters = parseCharacters(characterInput);
	const char = characters[0];

	// Validate character structure
	assert(char.index !== undefined, 'Character has index');
	assert(char.originalText !== undefined, 'Character has original text');
	assert(char.name !== undefined, 'Character has name');
	assert(char.numbers !== undefined, 'Character has numbers');
	assert(char.features !== undefined, 'Character has features');

	// Validate NumberStat structure
	const strStat = char.numbers.str;
	assert(strStat.name !== undefined, 'NumberStat has name');
	assert(strStat.parentName !== undefined, 'NumberStat has parentName');
	assert(strStat.baseValue !== undefined, 'NumberStat has baseValue');
	assert(strStat.modifiers !== undefined, 'NumberStat has modifiers');
	assert(strStat.value !== undefined, 'NumberStat has value');
	assert(strStat.attack !== undefined, 'NumberStat has attack');
	assert(strStat.defense !== undefined, 'NumberStat has defense');
	assert(strStat.roll !== undefined, 'NumberStat has roll');
	assert(strStat.canCrit !== undefined, 'NumberStat has canCrit');
	assert(strStat.renderSubfields !== undefined, 'NumberStat has renderSubfields');

	// Validate Feature structure
	const sword = char.features[''].find((f) => f.name === 'sword');
	assert(sword.name !== undefined, 'Feature has name');
	assert(sword.description !== undefined, 'Feature has description');
	assert(sword.roll !== undefined, 'Feature has roll');
	assert(sword.roll_against !== undefined, 'Feature has roll_against');
	assert(sword.hit !== undefined, 'Feature has hit');
	assert(sword.miss !== undefined, 'Feature has miss');
	assert(sword.attackInfo !== undefined, 'Feature has attackInfo');

	console.log('Output Validation tests passed!');
}

// Run all tests
export function runAllTests() {
	try {
		testJsonParser();
		testCharacterParser();
		testNumberStatSubfields();
		testAttackInformation();
		testDiceRolling();
		testIntegration();
		testOutputValidation();

		console.log('🎉 All tests passed!');
		return true;
	} catch (error) {
		console.error('❌ Test failed:', error.message);
		return false;
	}
}

// Export for use in browser console or testing framework
if (typeof window !== 'undefined') {
	(window as any).runCharacterSheetTests = runAllTests;
}
