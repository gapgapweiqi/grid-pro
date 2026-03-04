<script lang="ts">
	import { Sparkles, Crown, Building2, Users, Check, X } from 'lucide-svelte';
	import StripePaymentModal from '$lib/components/StripePaymentModal.svelte';
	import { showUpgradeDialog } from '$lib/stores/app';

	let showPayment = $state(false);

	function handlePaymentSuccess() {
		showPayment = false;
		showUpgradeDialog.set(false);
		window.location.reload();
	}

	function close() {
		showUpgradeDialog.set(false);
	}
</script>

{#if $showUpgradeDialog}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="upgrade-backdrop" onclick={close}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="upgrade-card" onclick={(e) => e.stopPropagation()}>
			<button class="upgrade-close" onclick={close}><X size={18} /></button>

			<div class="upgrade-icon">
				<Crown size={28} />
			</div>

			<h2 class="upgrade-title">อัพเกรดเป็น Owner Access</h2>
			<p class="upgrade-desc">ปลดล็อคการใช้งานเต็มรูปแบบ สร้างบริษัทของตัวเอง<br/>เชิญสมาชิกเข้าทีม และเข้าถึงทุกฟีเจอร์</p>

			<div class="upgrade-benefits">
				<div class="benefit-item">
					<div class="benefit-icon"><Check size={16} /></div>
					<span>เข้าถึงทุกหน้าอย่างเต็มที่</span>
				</div>
				<div class="benefit-item">
					<div class="benefit-icon"><Check size={16} /></div>
					<span>สร้างบริษัทของตัวเองได้</span>
				</div>
				<div class="benefit-item">
					<div class="benefit-icon"><Check size={16} /></div>
					<span>เชิญสมาชิกเข้าทีมได้</span>
				</div>
				<div class="benefit-item">
					<div class="benefit-icon"><Check size={16} /></div>
					<span>ใช้งานร่วมกับทีมที่ถูกเชิญ</span>
				</div>
			</div>

			<div class="upgrade-price">
				<span class="price-amount">฿790</span>
				<span class="price-period">ครั้งเดียว</span>
			</div>

			<button class="upgrade-btn" onclick={() => showPayment = true}>
				<Sparkles size={16} /> อัพเกรดเลย
			</button>
		</div>
	</div>
{/if}

<StripePaymentModal
	open={showPayment}
	productType="OWNER_ACCESS"
	onClose={() => showPayment = false}
	onSuccess={handlePaymentSuccess}
/>

<style>
	.upgrade-backdrop {
		position: fixed; inset: 0; z-index: 9999;
		background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
		display: flex; align-items: center; justify-content: center;
		padding: 16px;
	}
	.upgrade-card {
		position: relative;
		background: #fff; border-radius: 20px; padding: 36px 32px;
		max-width: 400px; width: 100%; text-align: center;
		box-shadow: 0 24px 64px rgba(0,0,0,0.18);
		animation: upgradeSlideUp 0.3s ease-out;
	}
	@keyframes upgradeSlideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.upgrade-close {
		position: absolute; top: 16px; right: 16px;
		background: none; border: none; cursor: pointer;
		color: #9ca3af; padding: 4px;
	}
	.upgrade-close:hover { color: #374151; }
	.upgrade-icon {
		width: 60px; height: 60px; margin: 0 auto 16px;
		background: linear-gradient(135deg, #fef3c7, #fde68a);
		color: #d97706; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
	}
	.upgrade-title { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 8px; }
	.upgrade-desc { font-size: 13px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
	.upgrade-benefits {
		text-align: left;
		display: flex; flex-direction: column; gap: 10px;
		margin-bottom: 24px;
		padding: 16px 20px;
		background: #f9fafb; border-radius: 12px;
	}
	.benefit-item {
		display: flex; align-items: center; gap: 10px;
		font-size: 13px; color: #374151; font-weight: 500;
	}
	.benefit-icon {
		width: 24px; height: 24px; border-radius: 50%;
		background: #dcfce7; color: #16a34a;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.upgrade-price {
		margin-bottom: 16px;
		display: flex; align-items: baseline; justify-content: center; gap: 6px;
	}
	.price-amount { font-size: 28px; font-weight: 800; color: #111; }
	.price-period { font-size: 13px; color: #9ca3af; font-weight: 500; }
	.upgrade-btn {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		width: 100%; padding: 14px;
		background: linear-gradient(135deg, #f59e0b, #d97706);
		color: #fff; border: none; border-radius: 12px;
		font-size: 15px; font-weight: 700; cursor: pointer;
		transition: all 0.2s; font-family: inherit;
	}
	.upgrade-btn:hover {
		background: linear-gradient(135deg, #d97706, #b45309);
		box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
	}
</style>
