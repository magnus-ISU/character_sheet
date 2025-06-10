export function groupby(chars: Character[]): Character[][] {
	if (chars.length === 0) return [];
	let groups = [[chars[0]]];
	for (let i = 1; i < chars.length; i++) {
		let char = chars[i];
		let currentGroup = groups[groups.length - 1];
		function important(char: Character) {
			return Object.keys(char.features).length > 1;
		}
		let isImportant = important(char);
		let wasImportant = important(currentGroup[currentGroup.length - 1]);
		let newRow = false;
		newRow ||= isImportant && !wasImportant;
		newRow ||= !isImportant && wasImportant;
		newRow ||= isImportant && currentGroup.length > 1;
		if (newRow) {
			groups.push([chars[i]]);
		} else {
			groups[groups.length - 1].push(chars[i]);
		}
	}
	// split overlarge groups
	let retval: Character[][] = [];
	for (let i = 0; i < groups.length; i++) {
		if (groups[i].length > 5) {
			while (groups[i].length > 5) {
				let newGroupsCount = Math.ceil(groups[i].length / 5);
				let targetSize = Math.ceil(groups[i].length / newGroupsCount);
				retval.push(groups[i].splice(0, targetSize));
			}
		}
		if (groups[i].length !== 0) {
			retval.push(groups[i]);
		}
	}
	return retval;
}
