export let textareaInitialState = $state({
	value: `
name: "Luke, Elf Fighter",
str 15, dex 14, con 13, int 10, wis 12, cha 8,
ac 16, max_hp 25, damage 0, pb 2,
longsword {roll str vs ac, hit 1d8 + str, description: "A sharp elven blade"},
fireball {roll int vs dex, hit 8d6 fire, miss half, description: "A devastating magical explosion"},
healing_potion {roll 0 vs 0, hit -2d4-2, description: "Restores health when consumed"}
---
name: "Sylas, Human Rogue",
str 10, dex 16, con 12, int 13, wis 11, cha 9,
ac 13, max_hp 20, damage 0, pb 2,
shortsword {roll dex vs ac, hit 1d6 + dex, description: "A nimble finesse weapon"},
sneak_attack {roll dex vs ac, hit 1d6 + dex + 2d6, description: "Extra damage when conditions are met"},
dagger {roll dex vs ac, hit 1d4 + dex, description: "Light throwing weapon"}
---
name: "Mook 1", str 12, dex 10, con 11, int 8, wis 9, cha 7, ac 12, max_hp 15, damage 0
---
name: "Mook 2", str 12, dex 10, con 11, int 8, wis 9, cha 7, ac 12, max_hp 15, damage 0
---
name: "Mook 3", str 12, dex 10, con 11, int 8, wis 9, cha 7, ac 12, max_hp 15, damage 0
`
});
