<script lang="ts">
	import { Sparkles, X, ArrowRight, Check } from 'lucide-svelte';

	interface Props {
		show: boolean;
		message?: string;
		onclose: () => void;
	}

	let { show = $bindable(false), message = '', onclose }: Props = $props();

	function handleSignup() {
		window.location.href = '/login';
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="upgrade-overlay" onclick={() => { show = false; onclose(); }}>
		<div class="upgrade-card" onclick={(e) => e.stopPropagation()}>
			<button class="upgrade-close" onclick={() => { show = false; onclose(); }}>
				<X size={16} />
			</button>

			<div class="upgrade-icon">
				<Sparkles size={24} />
			</div>

			<h2 class="upgrade-title">อัพเกรดเพื่อใช้งานเต็มรูปแบบ</h2>

			<p class="upgrade-desc">
				{message || 'ฟีเจอร์นี้สำหรับผู้ใช้จริงเท่านั้น สมัครใช้งานเพื่อปลดล็อกทุกฟีเจอร์'}
			</p>

			<ul class="upgrade-features">
				<li><span class="check-icon"><Check size={12} strokeWidth={3} /></span>ใช้งานได้ทุกฟีเจอร์ไม่จำกัด</li>
				<li><span class="check-icon"><Check size={12} strokeWidth={3} /></span>จ่ายครั้งเดียว ไม่มีค่ารายเดือน</li>
				<li><span class="check-icon"><Check size={12} strokeWidth={3} /></span>ใช้โลโก้และตราประทับของคุณเอง</li>
				<li><span class="check-icon"><Check size={12} strokeWidth={3} /></span>สร้างสินค้าและเอกสารไม่จำกัด</li>
			</ul>

			<div class="upgrade-price">
				<span class="upgrade-price-original">฿1,590</span>
				<span class="upgrade-price-amount">฿790</span>
				<span class="upgrade-price-label">ตลอดชีพ</span>
			</div>

			<button class="upgrade-btn-primary" onclick={handleSignup}>
				สมัครใช้งานเลย <ArrowRight size={15} />
			</button>

			<button class="upgrade-link" onclick={() => { show = false; onclose(); }}>
				ทดลองต่อ
			</button>
		</div>
	</div>
{/if}

<style>
	.upgrade-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		animation: fadeIn 0.15s ease;
	}

	.upgrade-card {
		position: relative;
		background: #fff;
		border-radius: 18px;
		padding: 32px 28px 24px;
		max-width: 400px;
		width: 100%;
		text-align: center;
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.02);
		animation: slideUp 0.15s ease;
	}

	.upgrade-close {
		position: absolute;
		top: 14px;
		right: 14px;
		background: none;
		border: none;
		color: #c9cdd3;
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
		transition: color 0.15s;
		line-height: 0;
	}
	.upgrade-close:hover {
		color: #6b7280;
	}

	.upgrade-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 12px;
		background: linear-gradient(135deg, #eff4ff 0%, #e8eeff 100%);
		color: #2563eb;
		margin-bottom: 14px;
	}

	.upgrade-title {
		font-size: 18px;
		font-weight: 700;
		color: #111827;
		margin-bottom: 6px;
		letter-spacing: -0.01em;
	}

	.upgrade-desc {
		font-size: 13px;
		color: #9ca3af;
		line-height: 1.5;
		margin-bottom: 18px;
	}

	.upgrade-features {
		text-align: left;
		list-style: none;
		padding: 0 8px;
		margin: 0 0 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.upgrade-features li {
		font-size: 13px;
		color: #374151;
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 500;
	}
	.upgrade-features li :global(.check-icon) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #ecfdf5;
		color: #10b981;
		flex-shrink: 0;
	}

	.upgrade-price {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 8px;
		margin-bottom: 16px;
	}
	.upgrade-price-original {
		font-size: 15px;
		font-weight: 500;
		color: #d1d5db;
		text-decoration: line-through;
	}
	.upgrade-price-amount {
		font-size: 32px;
		font-weight: 800;
		color: #111827;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}
	.upgrade-price-label {
		font-size: 13px;
		color: #9ca3af;
		font-weight: 500;
	}

	.upgrade-btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 11px 20px;
		border: none;
		border-radius: 10px;
		background: #2563eb;
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}
	.upgrade-btn-primary:hover {
		background: #1d4ed8;
		box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
	}
	.upgrade-btn-primary:active {
		transform: scale(0.98);
	}

	.upgrade-link {
		display: block;
		width: 100%;
		margin-top: 10px;
		padding: 6px;
		background: none;
		border: none;
		color: #9ca3af;
		font-size: 13px;
		cursor: pointer;
		transition: color 0.15s;
	}
	.upgrade-link:hover {
		color: #6b7280;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { transform: translateY(12px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
</style>
