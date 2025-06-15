<script lang="ts">
	let {
		character,
		updateCharacterHealth
	}: {
		character: Character;
		updateCharacterHealth: Function;
	} = $props();

	let max_hp = $derived(character.numbers.max_hp.value);
	let damage = $derived(character.numbers.damage.value);
	let currentHp = $derived(Math.max(0, max_hp - damage));
	let percentage = $derived((currentHp / max_hp) * 100);

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
</script>

<div class="character-list-card">
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
</div>

<style>
	.character-list-card {
		background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 50%, #1a1a1a 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 12px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		margin-bottom: 8px;
		user-select: none;
		cursor: pointer;
	}

	.character-list-card:hover {
		transform: translateY(-1px);
		border-color: rgba(76, 195, 247, 0.3);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.character-name {
		font-size: 16px;
		font-weight: 600;
		color: #4fc3f7;
		text-align: center;
		margin-bottom: 8px;
		text-shadow: 0 1px 4px rgba(79, 195, 247, 0.3);
	}

	.health-bar {
		height: 24px;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 12px;
		overflow: hidden;
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.health-fill {
		height: 100%;
		background: linear-gradient(90deg, #489978 0%, #48bb78 100%);
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		border-radius: 12px;
		box-shadow: 0 0 10px rgba(72, 187, 120, 0.2);
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
		font-size: 12px;
		font-weight: 600;
		text-align: center;
		padding: 4px;
		outline: none;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
	}

	.health-input:focus {
		font-size: 14px;
	}
</style>
