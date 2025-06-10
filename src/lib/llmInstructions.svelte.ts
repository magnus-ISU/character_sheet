export let LLMinstructions = `
You must convert the above into a character sheet of the following format:
\`\`\`
---
name: "Luke, Elf Fighter",

level: 3, ac: 10+dex, hit_die: 10, level/pb: (level + 3) / 4 + 1, level/used_hit_dice: 0, level/cantrip_dice: 1+(level+1)/6,
str: 2, dex: 2, con: 1.5, int: -1, wis: 0, cha: 0,

max hp: level * (hit_die/2 + 1 + con) + hit_die/2 - 1, damage: 0,
str/str save: str, dex/dex save: dex, con/con save: con, int/int save: int, wis/wis save: wis, cha/cha save: cha,
int/history: int, wis/perception: wis, cha/persuasion: cha,

features / Elf: { You have advantage against charm effects, stats: [int += 0.5, dex += 1, wis/perception += pb] },
features / Trance: { "As an elf, you need rest only 4 hours in quiet meditation to gain the benefits of long rest." },
features / Position of Privilege: { "Thanks to your noble birth, people are inclined to think the best of you. You are welcome in high society, and people assume you have the right to be wherever you are. The common folk make every effort to accommodate you and avoid your displeasure, and other people of high birth treat you as a member of the same social sphere. You can secure an audience with a local noble if you need to.", stats: [int/history += pb, cha/persuasion += pb] },

items / Longsword +1: { +1+str+pb vs ac , d10+1+str slashing , "Sap - Your hit enemy has disadvantage on their next attack this round." },
spells / Fireball: { d20 + int + pb - 14 vs dex_save , 8d6 fire , miss: half , "Range: 150 feet." },
cantrips / Firebolt: { +pb+int vs ac , cantrip_dice d10 fire , "You hurl a mote of flame up to 120 feet at your foe." },

items / Chainmail: { stats: [ac += 6 - dex], "The wearer has disadvantage on Dexterity (Stealth) checks." },
items / Healing Potion: { 0 vs 0, -2d4-2 , "This small potion heals the most mortal of wounds, but little else?" },
---
\`\`\`
The entire expression is surrounded by braces and parsed as a json object, where quotes are not mandatory.
Variables are defined by simply adding a key and a simple expression which can contain other variables. For example, any character's hit points in D&D can be expressed as "level * (hit_die/2 + 1 + con) + hit_die/2 - 1".
However, if a player rolled hit points, this will not be an accurate number. Use your best judgement for different cases you may encounter.

In addition, character features can be provided, which can be attacks or generic features. Special rendering is done for groups of "items", "skills", "features", so those should be preferred choices.
A feature is a
[group name /] feature name: {
	name: string;
	description: string;
	roll: string;
	hit: string;
	miss: string;
	hit_effect: string;
	miss_effect: string;
	stats: string[];
	chips: string[];
}

A feature may modify stats, for example being an elf gives +1 dex and +0.5 to another stat. A feat gives +0.5 to some stat. Use this instead of modifying the base value, so that the source of changes can be determined.

Attacks have a roll: and must be of the form "(expression) vs (stat)"
For 5e D&D, (stat) should be one of [ac, str_save, dex_save, con_save, int_save, wis_save, cha_save]
When an attack targets a save, you can convert between a save DC and an attack bonus by subtracting 22 and targeting the targets saving throw bonus.
This means that a save attack could use (d20+save_dc-22) or (d20+pb+stat-14) as its bonus
For an attack that cannot score a critical hit - anything targeting saves, (expression) is "d20 + BONUS"
For an attack that can score a critical hit, (expression) is "+BONUS". Spells that make attack rolls, or most weapons, use this.
For an attack that automatically hits, use "0 vs 0" for the roll. For an attack that has a 40% percent chance to work, "d20 vs 8" works.
BONUS is a calculation containing numbers (like a +1 magic weapon) and stats (like a proficiency bonus, pb, and relevant stats)

hit and miss are the amounts of damage to deal on a hit or missed attack. They are not run together.
miss may be "half" which just means to halve the damage a hit would deal.
Some examples follow:
items / Longbow: {roll: +pb+dex vs ac, hit: 1d8+dex piercing, chips: [🏹30/120], description: "A longbow is a large, hand-drawn bow, typically made of wood, with long, nearly straight limbs that form an arc when strung."}
spells / Scorching Rays: {roll: +pb+int vs ac, hit: 2d6 fire, chips: [🏹24], description: "You create three rays of fire and hurl them at targets within range. You can hurl them at one target or several."}
spells / Fireball: {roll: d20+pb+int-14 vs dex_save, hit: 8d6 fire, miss: half, chips: [🏹30, 4◎] description: "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one. The fire spreads around corners. It ignites flammable objects in the area that aren’t being worn or carried."}
spells / Finger of Death (2e conversion): {roll: d20+pb+int vs con_save, hit_effect: Killed instantly, miss: 2d8+1 necrotic, description: "The caster utters the finger of death spell incantation, points his index finger at the creature to be slain, and unless the victim succeeds in a saving throw vs. spell, death occurs. A creature successfully saving still receives 2d8+1 points of damage. If the subject dies of damage, no internal changes occur and the victim can then be revived normally."}
spells / Charm Person: {roll: d20+pb+int vs wis_save, hit_effect: Charmed, chips: [🅒 1🕯, 🏹6], description: "You attempt to charm a humanoid you can see within range. It must make a Wisdom saving throw, and does so with advantage if you or your companions are fighting it. If it fails the saving throw, it is charmed by you until the spell ends or until you or your companions do anything harmful to it. The charmed creature regards you as a friendly acquaintance. When the spell ends, the creature knows it was charmed by you."}
spells / Shield: {chips: [⤵], description: "When you are hit by an attack or targeted by magic missile, an invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile."}
spells / Misty Step: {chips: [◆, 🏹6], description: "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see."}
spells / Magic Missile: {roll: 0 vs 0, chips: [🏹24], hit: 1d4+1, description: "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4+1 force damage to its target. The darts all strike simultaneously and you can direct them to hit one creature or several."}
	
For spells that allow you to make multiple attacks, such as scorching ray or magic missile, just write the effects of one attack.
	
You may add chips to features. These should be used to indicate an action's action cost, range, duration, etc
Full action: ◆◆
Bonus action: ◆
Reaction: ⤵
Duration: 100⌛
Range: 🏹
Radius: ◎
Concentration: 🅒
Cast Time: (if longer than one action) "10 minute casting"

You should set the base scores to their modifiers. For example, an Intelligence of 12 means int: 2, and a Constitution of 17 means con: 3.5
	
Helpful shorthand notation:
◆◆           This spell costs a bonus action to cast
◆            This spell costs a bonus action to cast
◇            This spell costs a free action to cast
⤵            This spell costs a reaction to cast
1🧊           5 foot cube
4◎            20 foot radius
3┅            15 foot line
8🏹            40 foot range
🅒             Concentration spell, roll CON save. Taking more than that much damage or ◇ ends spell
1⌛            1 round
1🕯            1 hour
🏕              Long rest
Circle         Spell level
`;
