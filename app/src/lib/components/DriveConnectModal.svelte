<script lang="ts">
	import { HardDrive, X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onConnect: () => void;
		onSkip: () => void;
	}

	let { open, onConnect, onSkip }: Props = $props();
</script>

{#if open}
	<div class="dcm-backdrop" onclick={onSkip}>
		<div class="dcm-modal" onclick={(e) => e.stopPropagation()}>
			<button class="dcm-close" onclick={onSkip}><X size={18} /></button>
			<div class="dcm-icon"><HardDrive size={32} /></div>
			<h2 class="dcm-title">เชื่อมต่อ Google Drive</h2>
			<p class="dcm-desc">เพื่ออัปโหลดและจัดเก็บไฟล์ คุณต้องเชื่อมต่อบัญชี Google Drive ก่อน</p>
			<div class="dcm-actions">
				<button class="dcm-btn-primary" onclick={onConnect}>
					<svg width="16" height="16" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.2c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.4 9.35z" fill="#ea4335"/><path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h22.9c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>
					เชื่อมต่อ Google Drive
				</button>
				<button class="dcm-btn-skip" onclick={onSkip}>ข้ามไปก่อน</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dcm-backdrop {
		position: fixed; inset: 0; z-index: 9999;
		background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
		display: flex; align-items: center; justify-content: center;
		padding: 16px;
	}
	.dcm-modal {
		background: #fff; border-radius: 16px; padding: 32px;
		max-width: 420px; width: 100%; text-align: center;
		position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
	}
	.dcm-close {
		position: absolute; top: 14px; right: 14px;
		background: none; border: none; color: #9ca3af; cursor: pointer;
		padding: 4px; display: flex; border-radius: 6px;
	}
	.dcm-close:hover { background: #f3f4f6; color: #374151; }
	.dcm-icon {
		width: 64px; height: 64px; margin: 0 auto 16px;
		background: #f0f4ff; color: #3b82f6; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
	}
	.dcm-title { font-size: 18px; font-weight: 800; color: #0a0a0a; margin-bottom: 8px; }
	.dcm-desc { font-size: 13px; color: #6b7280; line-height: 1.5; margin-bottom: 24px; }
	.dcm-actions { display: flex; flex-direction: column; gap: 10px; }
	.dcm-btn-primary {
		display: flex; align-items: center; justify-content: center; gap: 10px;
		padding: 12px; border-radius: 10px; background: #1a4731; color: #fff;
		font-size: 14px; font-weight: 700; border: none; cursor: pointer;
		font-family: inherit; transition: all 0.15s;
	}
	.dcm-btn-primary:hover { background: #153d2a; }
	.dcm-btn-skip {
		padding: 10px; border-radius: 10px; background: none;
		color: #6b7280; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb;
		cursor: pointer; font-family: inherit; transition: all 0.15s;
	}
	.dcm-btn-skip:hover { background: #f9fafb; border-color: #d1d5db; }
</style>
