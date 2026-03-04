<script lang="ts">
	import { Lock, CreditCard, Home, FlaskConical } from 'lucide-svelte';
	import StripePaymentModal from '$lib/components/StripePaymentModal.svelte';

	let showPayment = $state(false);

	function handlePaymentSuccess() {
		// Reload to refresh billing status
		window.location.reload();
	}
</script>

<div class="pro-backdrop">
	<div class="pro-card">
		<div class="pro-icon"><Lock size={28} /></div>
		<h2 class="pro-title">กรุณาชำระเงินเพื่อใช้งาน</h2>
		<p class="pro-desc">คุณยังไม่ได้ชำระเงิน กรุณาเลือกแพ็กเกจเพื่อปลดล็อคการใช้งานระบบ<br/>หรือทดลองใช้งานผ่าน Sandbox ได้ฟรี</p>
		<div class="pro-actions">
			<button class="pro-btn pro-btn-primary" onclick={() => showPayment = true}>
				<CreditCard size={16} /> ชำระเงิน ฿790
			</button>
			<a href="https://grid-doc.com" class="pro-btn pro-btn-outline">
				<Home size={16} /> กลับหน้าหลัก
			</a>
			<a href="/sandbox" class="pro-btn pro-btn-outline">
				<FlaskConical size={16} /> ทดลอง Sandbox
			</a>
		</div>
	</div>
</div>

<StripePaymentModal
	open={showPayment}
	productType="OWNER_ACCESS"
	onClose={() => showPayment = false}
	onSuccess={handlePaymentSuccess}
/>

<style>
	.pro-backdrop {
		position: fixed; inset: 0; z-index: 9998;
		background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
		display: flex; align-items: center; justify-content: center;
		padding: 16px;
	}
	.pro-card {
		background: #fff; border-radius: 20px; padding: 40px 36px;
		max-width: 440px; width: 100%; text-align: center;
		box-shadow: 0 24px 64px rgba(0,0,0,0.18);
		animation: proSlideUp 0.35s ease-out;
	}
	@keyframes proSlideUp {
		from { opacity: 0; transform: translateY(24px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.pro-icon {
		width: 64px; height: 64px; margin: 0 auto 20px;
		background: #fef2f2; color: #dc2626; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
	}
	.pro-title { font-size: 20px; font-weight: 800; color: #0a0a0a; margin-bottom: 10px; }
	.pro-desc { font-size: 13px; color: #6b7280; line-height: 1.6; margin-bottom: 28px; }
	.pro-actions { display: flex; flex-direction: column; gap: 10px; }
	.pro-btn {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 700;
		text-decoration: none; cursor: pointer; transition: all 0.15s;
		font-family: inherit; border: none;
	}
	.pro-btn-primary {
		background: #1a4731; color: #fff;
	}
	.pro-btn-primary:hover { background: #153d2a; }
	.pro-btn-outline {
		background: #fff; color: #374151; border: 1px solid #e5e7eb;
	}
	.pro-btn-outline:hover { background: #f9fafb; border-color: #d1d5db; }
	.pro-btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
	.pro-error { font-size: 13px; color: #dc2626; margin-bottom: 12px; }
	:global(.spin) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
