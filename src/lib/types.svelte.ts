type diceExpression = string;

type RenderedStat = {
	name: string;
	stat: NumberStat;
	children: string[];
};

type LogType = 'critical-hit' | 'critical-miss' | 'roll' | 'error' | 'miss';
type LogEntry = {
	message: string;
	type: LogType;
	timestamp?: Date;
	key: number;
};

type SelectingAttack = { attacker: Character; attack: Feature };

type AttackResult = { damageDealt: number; damageType: string };

// Type definitions
type NumberStat = {
	name: string;
	parentName: string;
	baseValue: string;
	modifiers: StatModifier[];
	value: number;
	row?: number;
};

type StatModifier = {
	source: Feature;
	modifier: string;
};

type Trait = {
	name: string;
	description: string;
	stats: string[];
};

type Feature = {
	name: string;
	description: string;
	roll: string;
	roll_against: string;
	hit: string;
	miss: string;
	hit_effect: string;
	miss_effect: string;
	stats: string[];
	chips: string[];
};

type Character = {
	index: number;
	originalText: string;
	name: string;
	numbers: Record<string, NumberStat>;
	features: Record<string, Feature[]>;
};

type TooltipContent = {
	name: string;
	description: string;
	type: 'feature' | 'skill' | 'item' | 'attack' | 'info';
	chips: string[];
};
