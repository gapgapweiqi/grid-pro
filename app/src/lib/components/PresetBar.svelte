<script lang="ts">
	import { getPresets, addPreset, deletePreset, type Preset } from '$lib/stores/presets';
	import { addToast } from '$lib/stores/app';
	import { Plus, X } from 'lucide-svelte';

	interface Props {
		category: string;
		onApply: (data: Record<string, unknown>) => void;
		collectData: () => Record<string, unknown>;
		label?: string;
	}

	let { category, onApply, collectData, label = 'บันทึก' }: Props = $props();

	let presets: Preset[] = $state([]);
	let showSaveDialog = $state(false);
	let saveName = $state('');

	$effect(() => {
		presets = getPresets(category);
	});

	function refresh() {
		presets = getPresets(category);
	}

	function apply(index: number) {
		const p = presets[index];
		if (!p) return;
		onApply(p.data);
		addToast(`ใช้ "${p.name}" เรียบร้อย`, 'success');
	}

	function remove(index: number) {
		const name = presets[index]?.name || '';
		if (!confirm(`ลบ "${name}" ?`)) return;
		deletePreset(category, index);
		refresh();
		addToast('ลบเรียบร้อย', 'success');
	}

	function openSave() {
		if (presets.length >= 5) {
			addToast('บันทึกได้สูงสุด 5 ชุด', 'warning');
			return;
		}
		saveName = '';
		showSaveDialog = true;
	}

	function confirmSave() {
		if (!saveName.trim()) { addToast('กรุณาตั้งชื่อ', 'error'); return; }
		const data = collectData();
		addPreset(category, { name: saveName.trim(), data });
		refresh();
		showSaveDialog = false;
		addToast(`บันทึก "${saveName.trim()}" เรียบร้อย`, 'success');
	}
</script>

<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
	{#each presets as preset, i}
		<div style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 16px; font-size: 12px; cursor: pointer; border: 1px solid var(--color-gray-200); background: #fff; transition: all 0.15s;"
			role="button"
			tabindex="0"
			onkeydown={(e) => { if (e.key === 'Enter') apply(i); }}
			onclick={() => apply(i)}
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-soft)'; }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gray-200)'; (e.currentTarget as HTMLElement).style.background = '#fff'; }}
		>
			<span>{preset.name}</span>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span style="display: inline-flex; align-items: center; color: var(--color-gray-400); margin-left: 2px;"
				onclick={(e) => { e.stopPropagation(); remove(i); }}
				onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'; }}
				onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-400)'; }}
			>
				<X size={12} />
			</span>
		</div>
	{/each}

	{#if showSaveDialog}
		<div style="display: inline-flex; align-items: center; gap: 4px;">
			<input class="field-control" style="width: 120px; font-size: 12px; padding: 4px 8px; border-radius: 16px;" bind:value={saveName} placeholder="ชื่อ preset..." onkeydown={(e) => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') showSaveDialog = false; }} />
			<button type="button" style="padding: 3px 8px; border-radius: 12px; font-size: 11px; border: 1px solid var(--color-primary); background: var(--color-primary); color: #fff; cursor: pointer;" onclick={confirmSave}>OK</button>
			<button type="button" style="padding: 3px 8px; border-radius: 12px; font-size: 11px; border: 1px solid var(--color-gray-300); background: #fff; cursor: pointer;" onclick={() => showSaveDialog = false}>ยกเลิก</button>
		</div>
	{:else}
		<button type="button" style="display: inline-flex; align-items: center; gap: 3px; padding: 4px 10px; border-radius: 16px; font-size: 12px; cursor: pointer; border: 1px dashed var(--color-gray-300); background: #fafafa; color: var(--color-gray-500); transition: all 0.15s;"
			onclick={openSave}
			onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; }}
			onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gray-300)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-500)'; }}
		>
			<Plus size={12} /> {label}
		</button>
	{/if}
</div>
