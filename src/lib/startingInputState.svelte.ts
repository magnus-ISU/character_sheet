export let textareaInitialState = $state({
	value: `name Luke, max_hp 10, damage 0, ac 10, str 0, sword +1 {roll str + 1 vs ac, hit 1d10 + str + 1} a four-pound blade of death, str.attack {baseValue: 0, roll: 2d20kh1}
---
name Alice, max_hp 15, damage 0, ac 12, dex 2, bow {roll dex vs ac, hit 1d8 + dex} a trusty longbow
---
name Bob, max_hp 8, damage 0, ac 11, int 3, fireball {roll int vs dex, hit 3d6 fire} magical flames`,
});
