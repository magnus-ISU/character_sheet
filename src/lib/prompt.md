# Prompts

```prompt
Redesign the app.

1. The Sheet should be simple and contain two new UI elements: a FocusedCharacter and a CharacterList. The FocusedCharacter always renders in the foreground. It has a dropdown textarea to edit only itself. That textarea doesn't hide while the keyboard cursor is inside it. The CharacterList renders all characters, except the FocusedCharacter. Right clicking one sets it as the FocusedCharacter. Right clicking the FocusedCharacter area goes back to not having any, which shows a textarea on the left with all the characters as now.
2. All global state should be moved to a global_state.svelte.ts, which is imported by Sheet and other things that need it
3. The types are redesigned so all numeric stats are numbers with much more information. A variable tracks the default roll for the stat. This roll defaults to d20, but can be configured, such as changed to 2d20kh1 for advantage or 2d6 for dungeon world.
4. In addition, numbers can have lists of subfields, which are other . They are accessed via, for example: `roll: int.atk vs dex.defense`. They can also be configured to not render.
5. In addition, in an attack roll, the attack information (roll, roll_against, hit, miss, hit_effect, miss_effect) is stored as its seperate sub object on the Feature object. This object parses the `roll` (to hit) into a main roll and a modifier. The modifier works similar to now as an expression, but the main roll just rolls the default roll of the stat given. Furthermore, giving a stat with no subproperty automatically rolls `stat.atk vs stat.defense`. This means that an attack for a fireball can be written as just `int vs dex`.
6. Remove persistence features for now, we'll add them back later.
7. The json parser parses values differently again: If a key doesn't have a value before ending (eg. by hitting a ] or } or , in the parser) then it is split by spaces. The first part is the key name and the second is the value. So for example: `str 2, dex 1, con 3, int 1, wis 0, cha 0, greatsword {roll str vs ac, hit 2d6 + str}, great axe: {roll str vs ac, hit 1d12 + str}, str.attack str + pb, pb 2, max hp: 20, damage 0`
   Also json objects are infered to have colons: `great axe: {...}` can be `great axe {...}`. This replaces the existing parsing of keys without values. However, an object also can get it's description populated after the object, for example: `greatsword {roll str vs ac, hit 2d6 + str, description: The mightiest blade wielded with 2 hands}, other keys...` can also be written as `greatsword {roll str vs ac, hit 2d6 + str} The mightiest blade wielded with 2 hands, other keys...`
8. stat attack and defense properties are automatically initialized to the stat's value; roll is automatically initialized to 'd20'.
9. Whether attacks can crit is now determined by the defending stat, which only ever needs to be ac for 5e. This is automatically set by ac, but could also be set by a numberstat being defined like `ac {baseValue: 20, canCrit: true}`.

Write tests ensuring that the json parser works as expected, the character parser works to produce a Character object with all the necessary fields in all the NumberStats and Features, the output contains the expected values, and the dice roller works as expected with its changed. Ensure these pass
```

````prompt
Make the following changes:
- Newlines count as commas for determining if key/value expressions have ended.
- types.svelte.ts has been updated, the parseJsonToCharacters.svelte.ts must be updated
- attacks should use the defenses roll if it is not 'd20', or else their roll unless they are both '2d20kh1', in which case they use 'd20'
- max_hp should be replaced with health
- There should be a globals section at the start of a file, before the first ---. The globals are added to each character before they are parsed.
- Parse comments, ignoring to the end of the line after #
- Child stats are marked with . and not /
- damage and health automatically have render set to false
- don't automatically create a stat child for attack or defense, but if a child is accessed which doesn't exist, use the parent's value for it. When evaluating children that don't exist in the parent, don't create them unless nothing else changed
- The following file should parse
```
# Globals
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
Chainmail { stats: [ { stat ac, bonus 6-dex } ] } A thousand metal rings, stamped together in a shirt.

# Attacks
longsword {roll str vs ac, hit 1d10 + str slashing} A sharp blade of steel.
fireball {roll int vs dex, hit 8d6 fire} A great explosion of flame.
---
name Goblin, damage 0, str 1, dex 2, con 0, int -2, wis 0, cha -3
spear {roll +4 vs ac, hit 1d6+1 slashing}
taunt {roll +0 vs cha, hit_effect Your target must spend all their movement running towards you} A screeching ugly sound.
```
into
```
[
   {
      index: 1,
      originalText: ...,
      name: "Luke",
      numbers: {
         health: {name: 'health', base: 'level * (hit_die/2 + 1 + con) + hit_die/2 - 1', modifiers: [], value: 36, row: 4, children: [], render: false, roll: 'd20'},
         pb: {name: 'pb', base: '1 + (level+3)/4', modifiers: [], value: 2, row: 4, children: [], render: true, roll: 'd20'},
         level: {name: 'level', base: '4', modifiers: [], value: 4, row: 0, children: {
            used_healing_surges: {name: 'used_healing_surges', base: '0', modifiers: [], value: 0, row: 2},
         }, render: true, roll: 'd20'},
         damage: {name: 'damage', base: '0', modifiers: [], value: 0, row: 2, children: [], render: false, roll: 'd20'},
         ac: {name: 'ac', base: '10 + dex', modifiers: [
            {stat: 'ac', bonus: '6-dex', roll: '', source: -> Chainmail},
         ], value: 0, row: 5, children: [], render: true, roll: 'd20'},
         ...etc
      },
      features: {
         "Impervious Sanctity of Mind": {
            name: "Impervious Sanctity of Mind", description: "You have an iron will.", attack: undefined, stats: [
               {stat: "cha.defense", roll: "2d20kh1", bonus: '', source: -> pointer}
            ]
         },
         ...etc
      }
   },
   {index: 2, ...etc},
]

Make sure with a unit test that this passes
```


````

type Character = {
index: number;
originalText: string;
name: string;
numbers: { health: NumberStat; damage: NumberStat } & Record<string, NumberStat>;
features: Record<string, Feature[]>;
};

type NumberStat = {
name: string;
base: string;
modifiers: StatModifier[];
value: number;
row?: number;

parent: NumberStat | undefined;
children: Record<string, NumberStat>;
renderSubfields: boolean; // Whether to render subfields in UI (default true)

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

type TooltipContent = {
name: string;
description: string;
type: 'feature' | 'skill' | 'item' | 'attack' | 'info';
chips: string[];
};
