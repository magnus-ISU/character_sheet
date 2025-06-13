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

// Enhanced NumberStat with subfields and configurable rolls
type NumberStat = {
	name: string;
	parentName: string;
	baseValue: string;
	modifiers: StatModifier[];
	value: number;
	row?: number;

	// Subfields for enhanced stat system
	attack: number; // Auto-initialized to stat value, used for attack rolls
	defense: number; // Auto-initialized to stat value, used for defense
	roll: string; // Default roll (defaults to 'd20', configurable like '2d20kh1' for advantage)
	canCrit: boolean; // Whether attacks against this stat can crit (auto-set for ac)
	renderSubfields: boolean; // Whether to render subfields in UI (default true)
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

// Enhanced attack information stored as sub-object
type AttackInfo = {
	roll: string; // The to-hit roll (parsed into main roll + modifier)
	rollAgainst: string; // What the roll is against (e.g., 'ac', 'dex.defense')
	mainRoll: string; // The main roll part (uses stat's default roll)
	modifier: string; // The modifier part (expression)
	hit: string; // Hit effect/damage
	miss: string; // Miss effect/damage
	hitEffect: string; // Additional hit effects
	missEffect: string; // Additional miss effects
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

	// Enhanced attack information
	attackInfo?: AttackInfo; // Present if this is an attack feature
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
