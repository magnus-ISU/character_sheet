<script lang="ts">
import { rollDiceExpression } from './dice.svelte';
import GlobalTooltip from './GlobalTooltip.svelte';

let {
	character,
	logMessage,
	updateCharacterHealth,
	tooltip,
	selectedAttack = $bindable(undefined),
	selectedAttackTargets = $bindable({}),
	onAttackTargetSelected,
	onCharacterHover,
}: {
	character: Character;
	logMessage: (m: string, t: LogType) => void;
	updateCharacterHealth: Function;
	tooltip: GlobalTooltip | undefined;
	selectedAttack: SelectingAttack | undefined;
	selectedAttackTargets: Record<number, { character: Character; timesAttacked: number }>;
	onAttackTargetSelected: Function;
	onCharacterHover: Function;
} = $props();

let max_hp = $derived(character.numbers.max_hp.value);
let damage = $derived(character.numbers.damage.value);
let currentHp = $derived(Math.max(0, max_hp - damage));
let percentage = $derived((currentHp / max_hp) * 100);
let timesSelectedForAttack: number = $derived(
	selectedAttackTargets[character.index]?.timesAttacked || 0,
);
let features = $derived(Object.entries(character.features));

function rollDie(diceSize: number, characterName: string, statName: string, modifier: number) {
	const roll = Math.floor(Math.random() * diceSize) + 1;
	const total = roll + (modifier || 0);
	let type: LogType = 'roll';
	if (roll === 20) type = 'critical-hit';
	else if (roll === 1) type = 'critical-miss';
	const message = `${characterName} rolled ${statName}: d20(${roll}) + ${modifier} = ${total}`;
	logMessage(message, type);
}

let statsToRender: RenderedStat[][] = $derived(
	(() => {
		// Parse the main stats to render
		let rowToStatsToRender: Record<number, RenderedStat[]> = {};
		let lastRowToRender: RenderedStat[] = [];
		let topLevelStats: Record<string, RenderedStat> = {};

		function addStat(stat: NumberStat) {
			if (stat.name === 'max_hp') return;
			if (stat.name === 'damage') return;
			let renderedStat: RenderedStat = { name: stat.name, stat: stat, children: [] };
			if ('' === stat.parentName) {
				topLevelStats[stat.name] = renderedStat;
			}
			if (stat.row !== undefined) {
				rowToStatsToRender[stat.row] || (rowToStatsToRender[stat.row] = []);
				rowToStatsToRender[stat.row].push(renderedStat);
			} else {
				lastRowToRender.push(renderedStat);
			}
		}

		for (const [_, numberStat] of Object.entries(character.numbers)) {
			addStat(numberStat);
		}

		function removeOrRenameChildren(row: RenderedStat[]) {
			for (let i = 0; i < row.length; i++) {
				let stat = row[i];
				if (stat.stat.parentName === '') continue;
				if (topLevelStats.hasOwnProperty(stat.stat.parentName)) {
					topLevelStats[stat.stat.parentName]!.children.push(stat.name);
					row.splice(i--, 1);
				} else {
					stat.name = stat.stat.parentName;
				}
			}
		}

		// Remove children stats to render that have parents. Otherwise, rename them to their parents name
		for (const [_, row] of Object.entries(rowToStatsToRender)) {
			removeOrRenameChildren(row);
		}
		removeOrRenameChildren(lastRowToRender);

		return [...Object.values(rowToStatsToRender), lastRowToRender];
	})(),
);

function handleHealthUpdate(event: any) {
	if (event.key === 'Enter') {
		const value = event.target.value.trim();
		if (!value) return;
		let newDamage;
		if (value.startsWith('+')) {
			const heal = parseFloat(value.substring(1));
			newDamage = damage - heal;
		} else if (value.startsWith('-')) {
			const damageAdd = parseFloat(value.substring(1));
			newDamage = damage + damageAdd;
		} else {
			const currentHpInput = parseFloat(value);
			newDamage = max_hp - currentHpInput;
		}
		updateCharacterHealth(character, newDamage);
		event.target.value = '';
	}
}

function onClickFeature(feature: Feature, e: MouseEvent) {
	e.preventDefault();
	e.stopImmediatePropagation();
	if (feature.roll_against !== '') {
		// Attack
		selectedAttack = { attacker: character, attack: feature };
		tooltip?.setShaking(true);
		return;
	}
	if (feature.roll) {
		// Check if this is a 5e attack (starts with +)
		const is5eAttack = feature.roll.startsWith('+');
		let rolledStr = '';
		let d20Result = 0;
		let modifierValue = 0;

		if (is5eAttack) {
			// Roll d20 separately for 5e attacks
			d20Result = Math.floor(Math.random() * 20) + 1;
			// Remove the + and just pass the modifiers to the dice roller
			const modifiers = feature.roll.substring(1);
			modifierValue = rollDiceExpression(character, modifiers);
			rolledStr = `${d20Result} + ${modifierValue} = ${d20Result + modifierValue}`;
		} else {
			// Non-5e systems: roll the full expression
			rolledStr = `${rollDiceExpression(character, feature.roll)}`;
		}
		let type: LogType = 'roll';
		if (d20Result === 20) type = 'critical-hit';
		if (d20Result === 1) type = 'critical-miss';

		logMessage(
			`${character.name} rolled ${feature.name}: ${rolledStr}           ${feature.roll}`,
			type,
		);
	}
}

function handleFeatureMouseOver(feature: Feature, type: string = 'feature') {
	if (tooltip === undefined) return;
	if (!['skill', 'feature', 'attack', 'item'].includes(type)) type = 'feature';
	tooltip.show({
		name: feature.name,
		description: feature.description,
		type: type as any,
		chips: feature.chips,
	});
}

function handleMouseLeave() {
	tooltip && tooltip.hide();
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
	class="character-card"
	class:selected-for-attack={timesSelectedForAttack !== 0}
	onmouseenter={() => onCharacterHover?.(character)}
	onmouseleave={() => onCharacterHover?.(undefined)}
	onclick={(e) => {
		if (selectedAttack === undefined) return;
		let shiftPressed = e.shiftKey;
		onAttackTargetSelected(character, shiftPressed);
	}}
	oncontextmenu={(e) => {
		selectedAttack = undefined;
		selectedAttackTargets = {};
		tooltip?.hide();
		e.preventDefault();
	}}
>
	{#if timesSelectedForAttack > 1}
		<div class="multiplier-indicator">
			x{timesSelectedForAttack}
		</div>
	{/if}

	<div class="character-name">{character.name}</div>

	<div class="health-bar">
		<div class="health-fill" style="width: {percentage}%"></div>
		<input
			type="text"
			class="health-input"
			placeholder="{Math.floor(currentHp)}/{max_hp}"
			onkeydown={handleHealthUpdate}
		/>
	</div>

	{#if selectedAttack === undefined}
		{#each statsToRender as statRow}
			<div class="stats-row">
				{#each statRow as stat}
					<div class="stat-parent">
						<div
							class="stat-item"
							onclick={() =>
								rollDie(
									20,
									character.name,
									stat.name.replaceAll('_', ' '),
									Math.floor(character.numbers[stat.name].value)
								)}
						>
							<div class="stat-label">{stat.name.replaceAll('_', ' ')}</div>
							<div class="stat-value">{Math.floor(character.numbers[stat.name].value)}</div>
						</div>
						{#if stat.children.length > 0}
							<div class="stat-children">
								{#each stat.children as child}
									<div
										class="child-stat"
										onclick={(e) => {
											rollDie(
												20,
												character.name,
												child.replaceAll('_', ' '),
												Math.floor(character.numbers[child].value)
											);
											e.preventDefault();
										}}
									>
										<div class="child-label">{child.replaceAll('_', ' ')}</div>
										<div class="child-value">{Math.floor(character.numbers[child].value)}</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/each}

		{#if features.length > 0}
			<div class="features">
				{#each features as [type, featureRow]}
					<div class="feature-list">
						<div class="feature-type">{type}</div>
						{#each Object.entries(featureRow) as [_, feature]}
							{#if feature.roll_against === ''}
								<div
									class="feature-item"
									onmouseover={() =>
										handleFeatureMouseOver(feature, type.substring(0, type.length - 1))}
									onmouseleave={handleMouseLeave}
									onclick={(e) => {
										onClickFeature(feature, e);
									}}
								>
									{feature.name}
								</div>
							{:else}
								<div
									class="attack-item feature-item"
									onmouseover={() => handleFeatureMouseOver(feature, 'attack')}
									onmouseleave={handleMouseLeave}
									onclick={(e) => {
										onClickFeature(feature, e);
									}}
								>
									{feature.name}
								</div>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.character-card {
		background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 50%, #1a1a1a 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 16px;
		flex: 1;
		min-width: 200px;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 2px 8px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		margin: 0.5rem;
		user-select: none;
	}
	.character-card:hover {
		z-index: 1;
	}

	.selected-for-attack {
		border: 3px solid rgba(218, 152, 18, 0.8) !important;
		margin: calc(0.5rem - 2px); /* Don't shift around just because we increased the border */
		animation: glowPulse 2s ease-in-out infinite alternate;
		background: linear-gradient(290deg, #1e1e1e 0%, #44251e 50%, #1a1a1a 100%);
	}

	@keyframes glowPulse {
		0% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
		100% {
			transform: translateY(0);
		}
	}

	.character-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
	}

	.character-card:hover {
		transform: translateY(-2px);
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.5),
			0 4px 12px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
		border-color: rgba(76, 195, 247, 0.3);
	}

	.character-name {
		font-size: 24px;
		font-weight: 700;
		color: #4fc3f7;
		text-align: center;
		text-shadow: 0 2px 8px rgba(79, 195, 247, 0.3);
		letter-spacing: 0.5px;
	}

	.health-bar {
		height: 28px;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 14px;
		overflow: hidden;
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
		margin: 0.5rem;
	}

	.health-fill {
		height: 100%;
		background: linear-gradient(90deg, #489978 0%, #48bb78 100%);
		background-size: 200% 100%;
		background-position: calc(100% - var(--percentage, 50%)) 0;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		border-radius: 14px;
		box-shadow:
			0 0 20px rgba(72, 187, 120, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.health-input {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		background: transparent;
		color: #ffffff;
		border: none;
		font-size: 13px;
		font-weight: 600;
		text-align: center;
		padding: 4px;
		outline: none;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		text-shadow: 0 1px 8px rgba(255, 255, 255, 0.3);
	}

	.health-input:focus {
		font-size: 16px;
		text-shadow: 0 2px 8px rgba(255, 255, 255, 0.3);
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
	}

	.stat-parent {
		cursor: pointer;
		position: relative;
		margin: 4px;
	}

	.stat-item {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.05) 0%,
			rgba(255, 255, 255, 0.02) 100%
		);
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 5px;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		backdrop-filter: blur(5px);
		overflow: hidden;
	}

	.stat-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
		transition: left 0.5s;
	}

	.stat-item:hover {
		background: linear-gradient(135deg, rgba(76, 195, 247, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
		border-color: rgba(76, 195, 247, 0.3);
		transform: translateY(-1px);
		box-shadow:
			0 4px 16px rgba(0, 0, 0, 0.2),
			0 0 20px rgba(76, 195, 247, 0.1);
	}

	.stat-item:hover::before {
		left: 100%;
	}

	.stat-item:active {
		transform: translateY(0);
	}

	.stat-label {
		font-size: 10px;
		color: #b0b0b0;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		font-weight: 500;
		margin-bottom: 2px;
	}

	.stat-value {
		font-size: 18px;
		font-weight: 700;
		color: #ffffff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.stat-children {
		display: none;
		position: absolute;
		top: 90%;
		left: 50%;
		transform: translateX(-50%);
		background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		padding: 8px;
		z-index: 10;
		min-width: 120px;
		text-align: left;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 2px 8px rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(10px);
		margin-top: 4px;
	}

	.stat-parent:hover .stat-children {
		display: block;
		animation: fadeInUp 0.2s ease-out;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.child-stat {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #e0e0e0;
		margin-bottom: 4px;
		padding: 2px 4px;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.child-stat:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.child-label {
		margin-right: 8px;
		font-weight: 500;
	}

	.child-value {
		font-weight: 700;
		color: #4fc3f7;
	}

	.features {
		margin-top: 16px;
	}

	.feature-type {
		font-size: 18px;
		color: #b0b0b0;
		text-transform: capitalize;
		font-weight: 600;
		letter-spacing: 0.5px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 4px;
	}

	.feature-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}

	.feature-item {
		background: linear-gradient(135deg, rgba(76, 195, 247, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
		padding: 4px 10px;
		border: 1px solid rgba(76, 195, 247, 0.2);
		font-size: 12px;
		font-weight: 500;
		border-radius: 8px;
		cursor: default;
		place-items: center;
		display: grid;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.feature-item:hover {
		background: linear-gradient(135deg, rgba(76, 195, 247, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%);
		border-color: rgba(76, 195, 247, 0.4);
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}

	.attack-item {
		background: linear-gradient(
			135deg,
			rgba(220, 38, 127, 0.15) 0%,
			rgba(255, 255, 255, 0.03) 100%
		);
		color: #ff6b9d;
		border-color: rgba(220, 38, 127, 0.3);
	}

	.attack-item:hover {
		background: linear-gradient(
			135deg,
			rgba(220, 38, 127, 0.25) 0%,
			rgba(255, 255, 255, 0.05) 100%
		);
		border-color: rgba(220, 38, 127, 0.5);
	}

	.multiplier-indicator {
		position: absolute;
		top: 0;
		right: 0;
		border-radius: 2rem;
		width: 4rem;
		height: 4rem;
		background: linear-gradient(135deg, #663399 0%, #000 100%);
		display: grid;
		place-items: center;
		font-size: 1.8rem;
	}
</style>
