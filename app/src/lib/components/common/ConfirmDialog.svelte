<script lang="ts">
	import { X } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		open: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let { open = $bindable(false), title = 'ยืนยันการดำเนินการ', message, confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก', onconfirm, oncancel }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if open}
	<div class="dialog-overlay" transition:fade={{ duration: 200 }} onclick={oncancel}>
		<div class="dialog-card" transition:scale={{ duration: 200, start: 0.95 }} onclick={(e) => e.stopPropagation()}>
			<div class="dialog-header">
				<div class="dialog-icon">⚠️</div>
				<h3 class="dialog-title">{title}</h3>
				<button class="dialog-close" onclick={oncancel}>
					<X size={20} />
				</button>
			</div>
			<div class="dialog-body">
				<p>{message}</p>
			</div>
			<div class="dialog-footer">
				<button class="btn btn-outline" onclick={oncancel}>{cancelLabel}</button>
				<button class="btn btn-danger" onclick={onconfirm}>{confirmLabel}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 16px;
	}

	.dialog-card {
		background: #fff;
		border-radius: 16px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		max-width: 440px;
		width: 100%;
		overflow: hidden;
	}

	.dialog-header {
		padding: 24px 24px 16px 24px;
		text-align: center;
		position: relative;
	}

	.dialog-icon {
		font-size: 48px;
		margin-bottom: 12px;
	}

	.dialog-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--color-gray-900);
		margin: 0;
	}

	.dialog-close {
		position: absolute;
		right: 16px;
		top: 16px;
		background: none;
		border: none;
		color: var(--color-gray-400);
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
		transition: all 0.15s;
	}

	.dialog-close:hover {
		background: var(--color-gray-100);
		color: var(--color-gray-600);
	}

	.dialog-body {
		padding: 0 24px 24px 24px;
		text-align: center;
	}

	.dialog-body p {
		margin: 0;
		font-size: 14px;
		color: var(--color-gray-600);
		line-height: 1.6;
	}

	.dialog-footer {
		padding: 16px 24px;
		background: var(--color-gray-50);
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	@media (max-width: 640px) {
		.dialog-card {
			max-width: 100%;
			margin: 0 16px;
		}
	}
</style>
