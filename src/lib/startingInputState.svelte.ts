export let textareaInitialState = $state({
	value: `
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
spells / Fireball: { d20 + int + pb - 14 vs dex_save , 8d6 fire , miss: half , "Range: 150 feet.", chips: [30🏹]},
cantrips / Firebolt: { +pb+int vs ac , cantrip_dice d10 fire , "You hurl a mote of flame up to 120 feet at your foe.", chips: [24🏹] },

items / Chainmail: { stats: [ac += 6 - dex], "The wearer has disadvantage on Dexterity (Stealth) checks." },
items / Healing Potion: { 0 vs 0, -2d4-2 , "This small potion heals the most mortal of wounds, but little else?" },
---
name: "Sylas, Human Rogue",

level: 3, ac: 10+dex, hit_die: 8,
level/pb: (level + 3) / 4 + 1, level/used_hit_dice: 0, level/cantrip_dice: 1+(level+1)/6, str: 0, dex: 3, con: 1, int: 1, wis: 1, cha: 0,

max hp: level * (hit_die/2 + 1 + con) + hit_die/2 - 1, damage: 0, str/str save: str, dex/dex save: dex + pb, con/con save: con, int/int save: int, wis/wis save: wis, cha/cha save: cha, dex/acrobatics: dex + pb, dex/stealth: dex + pb, int/investigation: int + pb, wis/perception: wis + pb,

features / Human: { "Versatile and ambitious, you gain proficiency in one skill of your choice.", stats: [dex/stealth += pb] },
features / Sneak Attack: { +dex+pb vs ac, d6+dex + 2d6 piercing, "Once per turn, you deal an extra 2d6 damage when you hit with a finesse or ranged weapon and have advantage or an ally within 5 feet of the target." }, features / Assassinate: { "You have advantage on attack rolls against any creature that hasn’t taken a turn in combat yet. Any hit you score against a surprised creature is a critical hit." },

items / Shortsword: { +dex+pb vs ac, d6+dex piercing, "Finesse weapon, eligible for Sneak Attack." },
items / Dagger: { +dex+pb vs ac, d4+dex piercing, "Finesse, light, thrown (range 20/60)." },
items / Leather Armor: { stats: [ac += 1], "Light armor, allows full Dexterity bonus to AC." },
items / Thieves' Tools: { +dex+pb, "Used for picking locks and disarming traps." },

cantrips / Minor Illusion: { +int+pb-14 vs int_save, 0 illusion, "You create a sound or image of an object within 30 feet that lasts for 1 minute." },
---
--- name: mook 1, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 2, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 3, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 4, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 5, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 6, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 7, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 8, max hp: 100, damage: 3, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 9, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
--- name: mook 10, max hp: 100, damage: 0, ac: 12, ac/str_save: 2, ac/dex_save: 0, ac/con_save: 0, ac/int_save: -1, ac/wis_save: 0, ac/cha_save: 0
`
});
