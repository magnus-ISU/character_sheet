type diceExpression = string;

type LogType = 'critical-hit' | 'critical-miss' | 'roll' | 'error' | 'miss';
type LogEntry = {
	message: string;
	type: LogType;
	timestamp?: Date;
	key: number;
};

type SelectingAttack = { attacker: Character; attack: Feature };

type AttackResult = { damageDealt: number; damageType: string };

type NumberStat = {
	name: string;
	base: string;
	modifiers: StatModifier[];
	value: number;
	row?: number;

	parent?: NumberStat;
	children: Record<string, NumberStat>;
	render: boolean; // Whether to render in UI (default true)

	roll: string; // Default roll (defaults to 'd20', configurable like '2d20kh1' for advantage)
};

type StatModifier = {
	stat: string;

	bonus: string;
	roll: string;

	source: Feature;
};

type Feature = {
	name: string;
	description: string;
	stats: StatModifier[];
	attack: AttackInfo | undefined;
};

// Enhanced attack information stored as sub-object
type AttackInfo = {
	roll: string; // The to-hit roll (parsed into main roll + modifier)
	rollAgainst: string; // What the roll is against (e.g., 'ac', 'dex.defense')
	mainRoll: string; // The main roll stat (uses stat's default roll)
	modifier: string; // The modifier part (expression)
	hit: string; // Hit effect/damage
	miss: string; // Miss effect/damage
	hitEffect: string; // Additional hit effects
	missEffect: string; // Additional miss effects
};

type Character = {
	index: number;
	originalText: string;
	name: string;
	numbers: { health: NumberStat; damage: NumberStat } & Record<string, NumberStat>;
	features: Record<string, Feature[]>;
};

type TooltipContent = {
	name: string;
	description: string;
	type: 'feature' | 'skill' | 'item' | 'attack' | 'info';
	chips: string[];
};
