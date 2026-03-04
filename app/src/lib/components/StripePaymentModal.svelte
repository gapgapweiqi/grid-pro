<script lang="ts">
	import { tick } from 'svelte';
	import { X, CreditCard, Loader2, CheckCircle, AlertTriangle, QrCode } from 'lucide-svelte';
	import { currentUser, persistAuth } from '$lib/stores/auth';
	import { get } from 'svelte/store';
	import { currentCompanyId } from '$lib/stores/app';
	import { browser } from '$app/environment';

	const API_BASE = import.meta.env.VITE_API_URL || '';
	const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');

	interface Props {
		open: boolean;
		productType: 'OWNER_ACCESS' | 'TEAM_SEAT';
		quantity?: number;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { open, productType, quantity = 1, onClose, onSuccess }: Props = $props();

	let step = $state<'idle' | 'loading' | 'ready' | 'processing' | 'success' | 'error'>('idle');
	let errorMsg = $state('');
	let productName = $state('');
	let amount = $state(0);
	let clientSecret = $state('');
	let orderId = $state('');
	let paymentIntentId = $state('');
	let elementReady = $state(false);

	let stripe: any = null;
	let elements: any = null;
	let paymentElement: any = null;
	let containerEl: HTMLDivElement | undefined = $state();

	// Promo code state
	let promoCode = $state('');
	let promoLoading = $state(false);
	let promoError = $state('');
	let promoApplied = $state(false);
	let promoDescription = $state('');
	let originalAmount = $state(0);
	let discountAmount = $state(0);
	let freeOrder = $state(false);

	// Load Stripe.js dynamically (cached after first load)
	async function ensureStripe() {
		if (stripe) return true;
		if (!STRIPE_PK) {
			step = 'error';
			errorMsg = 'Stripe publishable key not configured';
			return false;
		}
		try {
			const { loadStripe: loadStripeFn } = await import('@stripe/stripe-js');
			stripe = await loadStripeFn(STRIPE_PK, { locale: 'th' });
			if (!stripe) {
				step = 'error';
				errorMsg = 'ไม่สามารถโหลด Stripe ได้';
				return false;
			}
			return true;
		} catch {
			step = 'error';
			errorMsg = 'ไม่สามารถโหลด Stripe ได้';
			return false;
		}
	}

	// Create PaymentIntent via API
	async function createPaymentIntent() {
		const token = localStorage.getItem('auth.token');
		const companyId = get(currentCompanyId) || '';

		const res = await fetch(`${API_BASE}/api/billing/create-payment-intent`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ productType, companyId, quantity, couponCode: promoApplied ? promoCode.trim() : undefined }),
		});

		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message || 'เกิดข้อผิดพลาด');

		clientSecret = json.data.clientSecret;
		orderId = json.data.orderId;
		paymentIntentId = json.data.paymentIntentId || '';
		amount = json.data.amount;
		originalAmount = json.data.originalAmount || json.data.amount;
		discountAmount = json.data.discountAmount || 0;
		productName = json.data.productName;
		freeOrder = !!json.data.freeOrder;
	}

	// Mount Stripe Elements into the container div
	function mountElements() {
		if (!stripe || !clientSecret || !containerEl) return;

		// Cleanup previous
		destroyElements();

		elements = stripe.elements({
			clientSecret,
			appearance: {
				theme: 'stripe',
				variables: {
					colorPrimary: '#16a34a',
					colorBackground: '#ffffff',
					colorText: '#1e293b',
					colorDanger: '#ef4444',
					fontFamily: 'Sarabun, system-ui, sans-serif',
					spacingUnit: '4px',
					borderRadius: '10px',
				},
			},
		});

		paymentElement = elements.create('payment', {
			layout: 'tabs',
			defaultValues: {
				billingDetails: {
					email: get(currentUser)?.email || '',
				},
			},
		});

		paymentElement.on('ready', () => { elementReady = true; });
		paymentElement.mount(containerEl);
	}

	function destroyElements() {
		if (paymentElement) {
			try { paymentElement.destroy(); } catch {}
		}
		paymentElement = null;
		elements = null;
		elementReady = false;
	}

	// Apply promo code — validate + update PI at Stripe
	async function handleApplyPromo() {
		if (!promoCode.trim()) return;
		promoLoading = true;
		promoError = '';
		try {
			const token = localStorage.getItem('auth.token');
			// First validate the coupon
			const valRes = await fetch(`${API_BASE}/api/billing/validate-coupon`, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: promoCode.trim(), productType, quantity }),
			});
			const valJson = await valRes.json();
			if (!valJson.ok || !valJson.data) {
				promoError = valJson.error?.message || 'รหัสส่วนลดไม่ถูกต้อง';
				return;
			}

			// Then update the PaymentIntent at Stripe with the coupon
			const updRes = await fetch(`${API_BASE}/api/billing/update-payment-intent`, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ paymentIntentId, orderId, couponCode: promoCode.trim() }),
			});
			const updJson = await updRes.json();
			if (!updJson.ok) {
				promoError = updJson.error?.message || 'ไม่สามารถใช้ส่วนลดได้';
				return;
			}

			promoApplied = true;
			promoDescription = valJson.data.description || `ลด ${valJson.data.discountType === 'PERCENT' ? valJson.data.discountValue + '%' : '฿' + valJson.data.discountValue}`;
			discountAmount = updJson.data.discountAmount;
			amount = updJson.data.amount;
			originalAmount = updJson.data.originalAmount;

			// Handle 100% discount (free order)
			if (updJson.data.freeOrder) {
				freeOrder = true;
				step = 'success';
				try {
					const stored = localStorage.getItem('auth.user');
					if (stored) {
						const user = JSON.parse(stored);
						if (productType === 'OWNER_ACCESS') user.billingStatus = 'PAID';
						localStorage.setItem('auth.user', JSON.stringify(user));
						persistAuth(user, localStorage.getItem('auth.token') || '');
					}
				} catch {}
				setTimeout(() => { onSuccess?.(); handleClose(); }, 2000);
				return;
			}

			// Update Elements with new client_secret if changed
			if (updJson.data.clientSecret && updJson.data.clientSecret !== clientSecret) {
				clientSecret = updJson.data.clientSecret;
			}
		} catch {
			promoError = 'ไม่สามารถตรวจสอบรหัสได้';
		} finally {
			promoLoading = false;
		}
	}

	// Remove promo code — update PI at Stripe back to full price
	async function handleRemovePromo() {
		promoLoading = true;
		try {
			const token = localStorage.getItem('auth.token');
			const updRes = await fetch(`${API_BASE}/api/billing/update-payment-intent`, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ paymentIntentId, orderId, couponCode: '' }),
			});
			const updJson = await updRes.json();
			if (updJson.ok) {
				amount = updJson.data.amount;
				originalAmount = updJson.data.originalAmount;
				discountAmount = 0;
			}
		} catch {}
		promoApplied = false;
		promoCode = '';
		promoError = '';
		promoDescription = '';
		promoLoading = false;
	}

	// Full init flow: load stripe → create PI → set step to ready (mount happens via $effect on containerEl)
	async function initPayment() {
		if (!browser) return;
		step = 'loading';
		errorMsg = '';
		elementReady = false;
		promoApplied = false;
		promoCode = '';
		promoError = '';
		discountAmount = 0;
		freeOrder = false;
		destroyElements();

		try {
			const ok = await ensureStripe();
			if (!ok) return;
			await createPaymentIntent();
			if (freeOrder) {
				step = 'success';
				try {
					const stored = localStorage.getItem('auth.user');
					if (stored) {
						const user = JSON.parse(stored);
						if (productType === 'OWNER_ACCESS') user.billingStatus = 'PAID';
						localStorage.setItem('auth.user', JSON.stringify(user));
						persistAuth(user, localStorage.getItem('auth.token') || '');
					}
				} catch {}
				setTimeout(() => { onSuccess?.(); handleClose(); }, 2000);
				return;
			}
			step = 'ready';
		} catch (err: any) {
			step = 'error';
			errorMsg = err.message || 'ไม่สามารถเชื่อมต่อระบบชำระเงินได้';
		}
	}

	// Confirm payment
	async function handleSubmit() {
		if (!stripe || !elements || !elementReady) return;

		step = 'processing';
		errorMsg = '';

		try {
			const { error, paymentIntent } = await stripe.confirmPayment({
				elements,
				confirmParams: {
					return_url: `${APP_ORIGIN}/billing/success?session_id=${orderId}`,
				},
				redirect: 'if_required',
			});

			if (error) {
				step = 'ready';
				errorMsg = error.message || 'การชำระเงินล้มเหลว';
				return;
			}

			if (paymentIntent?.status === 'succeeded') {
				step = 'success';
				try {
					const stored = localStorage.getItem('auth.user');
					if (stored) {
						const user = JSON.parse(stored);
						if (productType === 'OWNER_ACCESS') {
							user.billingStatus = 'PAID';
						}
						localStorage.setItem('auth.user', JSON.stringify(user));
						persistAuth(user, localStorage.getItem('auth.token') || '');
					}
				} catch {}

				setTimeout(() => {
					onSuccess?.();
					handleClose();
				}, 2000);
			} else if (paymentIntent?.status === 'requires_action') {
				step = 'processing';
			} else {
				step = 'ready';
				errorMsg = 'สถานะการชำระเงินไม่สำเร็จ กรุณาลองใหม่';
			}
		} catch (err: any) {
			step = 'ready';
			errorMsg = err.message || 'เกิดข้อผิดพลาด';
		}
	}

	function handleClose() {
		destroyElements();
		step = 'idle';
		errorMsg = '';
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') handleClose();
	}

	// Debounced auto-apply promo code after typing stops
	let promoDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const code = promoCode;
		// Clear previous timer
		if (promoDebounceTimer) clearTimeout(promoDebounceTimer);
		// Auto-apply when code has >= 3 chars and not already applied
		if (code.trim().length >= 3 && !promoApplied && !promoLoading && step === 'ready') {
			promoDebounceTimer = setTimeout(() => {
				handleApplyPromo();
			}, 800);
		}
	});

	// When open changes to true → start init; when false → cleanup
	$effect(() => {
		if (open && browser) {
			initPayment();
		} else if (!open) {
			destroyElements();
			step = 'idle';
			errorMsg = '';
		}
	});

	// When containerEl becomes available (step=ready renders the div) → mount Elements
	$effect(() => {
		if (containerEl && step === 'ready' && stripe && clientSecret && !elementReady) {
			mountElements();
		}
	});
</script>

{#if open}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="spm-backdrop" onclick={handleClose} onkeydown={handleKeydown}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="spm-modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
		<!-- Header -->
		<div class="spm-header">
			<div class="spm-header-left">
				<CreditCard size={20} />
				<span>ชำระเงิน</span>
			</div>
			<button class="spm-close" onclick={handleClose} aria-label="ปิด">
				<X size={18} />
			</button>
		</div>

		<!-- Body -->
		<div class="spm-body">
			{#if step === 'loading'}
				<div class="spm-center">
					<Loader2 size={32} class="spm-spin" />
					<p>กำลังเตรียมระบบชำระเงิน...</p>
				</div>

			{:else if step === 'error'}
				<div class="spm-center">
					<AlertTriangle size={32} color="var(--color-danger, #ef4444)" />
					<p class="spm-error-text">{errorMsg}</p>
					<button class="spm-btn spm-btn-outline" onclick={initPayment}>ลองใหม่</button>
				</div>

			{:else if step === 'success'}
				<div class="spm-center">
					<div class="spm-success-icon">
						<CheckCircle size={48} color="#16a34a" />
					</div>
					<h3 class="spm-success-title">ชำระเงินสำเร็จ!</h3>
					<p class="spm-success-desc">ขอบคุณที่สมัครใช้งาน {productName}</p>
				</div>

			{:else}
				<!-- Product Info -->
				<div class="spm-product">
					<div class="spm-product-name">{productName}</div>
					<div class="spm-product-price-col">
						{#if discountAmount > 0}
							<span class="spm-original-price">฿{originalAmount.toLocaleString()}</span>
						{/if}
						<span class="spm-product-price">฿{amount.toLocaleString()}</span>
					</div>
				</div>

				{#if discountAmount > 0}
					<div class="spm-discount-badge">ส่วนลด -฿{discountAmount.toLocaleString()} {promoDescription ? `(${promoDescription})` : ''}</div>
				{/if}

				<!-- Promo code -->
				<div class="spm-promo">
					{#if promoApplied}
						<div class="spm-promo-applied">
							<span>🎟️ <strong>{promoCode}</strong></span>
							<button class="spm-promo-remove" onclick={handleRemovePromo}>ลบ</button>
						</div>
					{:else}
						<div class="spm-promo-row">
							<input
								type="text"
								class="spm-promo-input"
								placeholder="รหัสส่วนลด"
								bind:value={promoCode}
								onkeydown={(e) => { if (e.key === 'Enter') handleApplyPromo(); }}
								disabled={promoLoading}
							/>
							<button
								class="spm-promo-btn"
								onclick={handleApplyPromo}
								disabled={promoLoading || !promoCode.trim()}
							>
								{#if promoLoading}
									<Loader2 size={14} class="spm-spin" />
								{:else}
									ใช้โค้ด
								{/if}
							</button>
						</div>
						{#if promoError}
							<div class="spm-promo-error">{promoError}</div>
						{/if}
					{/if}
				</div>

				<!-- Payment methods info -->
				<div class="spm-methods">
					<div class="spm-method-badge"><CreditCard size={14} /> บัตรเครดิต/เดบิต</div>
					<div class="spm-method-badge"><QrCode size={14} /> PromptPay</div>
				</div>

				{#if errorMsg}
					<div class="spm-inline-error">{errorMsg}</div>
				{/if}

				<!-- Stripe Elements Container -->
				<div class="spm-elements" bind:this={containerEl}></div>

				<!-- Submit -->
				<button
					class="spm-btn spm-btn-primary"
					onclick={handleSubmit}
					disabled={step === 'processing' || !elementReady}
				>
					{#if step === 'processing'}
						<Loader2 size={16} class="spm-spin" /> กำลังดำเนินการ...
					{:else if !elementReady}
						<Loader2 size={16} class="spm-spin" /> กำลังโหลด...
					{:else}
						ชำระเงิน ฿{amount.toLocaleString()}
					{/if}
				</button>

				<p class="spm-secure">🔒 ชำระเงินผ่าน Stripe อย่างปลอดภัย</p>
			{/if}
		</div>
	</div>
</div>
{/if}

<style>
	.spm-backdrop {
		position: fixed; inset: 0; z-index: 9999;
		background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
		display: flex; align-items: center; justify-content: center;
		padding: 16px;
	}
	.spm-modal {
		background: #fff; border-radius: 16px; width: 100%; max-width: 440px;
		box-shadow: 0 20px 60px rgba(0,0,0,0.2);
		overflow: hidden; animation: spmSlideUp 0.3s ease;
	}
	@keyframes spmSlideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.spm-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 16px 20px; border-bottom: 1px solid #f1f5f9;
	}
	.spm-header-left {
		display: flex; align-items: center; gap: 8px;
		font-weight: 600; font-size: 15px; color: #1e293b;
	}
	.spm-close {
		background: none; border: none; cursor: pointer; padding: 4px;
		border-radius: 6px; color: #94a3b8;
		transition: all 0.15s;
	}
	.spm-close:hover { background: #f1f5f9; color: #475569; }
	.spm-close:disabled { opacity: 0.4; cursor: not-allowed; }

	.spm-body { padding: 20px; }

	.spm-center {
		display: flex; flex-direction: column; align-items: center; gap: 12px;
		padding: 24px 0; text-align: center; color: #64748b;
	}

	.spm-product {
		display: flex; align-items: center; justify-content: space-between;
		padding: 14px 16px; background: #f8fafc; border-radius: 10px;
		margin-bottom: 16px;
	}
	.spm-product-name { font-weight: 600; font-size: 14px; color: #1e293b; }
	.spm-product-price-col { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
	.spm-original-price { font-size: 13px; color: #94a3b8; text-decoration: line-through; }
	.spm-product-price { font-weight: 700; font-size: 18px; color: #16a34a; }

	.spm-discount-badge {
		background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px;
		padding: 6px 12px; font-size: 12px; color: #92400e; font-weight: 500;
		margin-bottom: 12px; text-align: center;
	}

	.spm-promo { margin-bottom: 12px; }
	.spm-promo-row { display: flex; gap: 8px; }
	.spm-promo-input {
		flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
		font-size: 13px; font-family: inherit; outline: none; transition: border 0.15s;
	}
	.spm-promo-input:focus { border-color: #16a34a; }
	.spm-promo-btn {
		padding: 8px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
		font-size: 13px; font-weight: 600; color: #15803d; cursor: pointer;
		font-family: inherit; white-space: nowrap; display: flex; align-items: center; gap: 4px;
		transition: all 0.15s;
	}
	.spm-promo-btn:hover:not(:disabled) { background: #dcfce7; }
	.spm-promo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.spm-promo-error { font-size: 12px; color: #dc2626; margin-top: 4px; }
	.spm-promo-applied {
		display: flex; align-items: center; justify-content: space-between;
		padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
		font-size: 13px; color: #15803d;
	}
	.spm-promo-remove {
		background: none; border: none; color: #dc2626; cursor: pointer;
		font-size: 12px; font-weight: 600; font-family: inherit;
	}

	.spm-methods {
		display: flex; gap: 8px; margin-bottom: 16px;
	}
	.spm-method-badge {
		display: flex; align-items: center; gap: 4px;
		padding: 4px 10px; background: #f0fdf4; border: 1px solid #bbf7d0;
		border-radius: 20px; font-size: 11px; color: #15803d; font-weight: 500;
	}

	.spm-inline-error {
		background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
		padding: 10px 14px; margin-bottom: 12px; font-size: 13px; color: #dc2626;
	}

	.spm-elements {
		min-height: 120px; margin-bottom: 16px;
	}

	.spm-btn {
		width: 100%; padding: 12px; border-radius: 10px; font-size: 14px;
		font-weight: 600; cursor: pointer; display: flex; align-items: center;
		justify-content: center; gap: 8px; transition: all 0.15s; border: none;
	}
	.spm-btn-primary {
		background: #16a34a; color: #fff;
	}
	.spm-btn-primary:hover:not(:disabled) { background: #15803d; }
	.spm-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.spm-btn-outline {
		background: #fff; color: #475569; border: 1px solid #e2e8f0;
	}
	.spm-btn-outline:hover { background: #f8fafc; }

	.spm-secure {
		text-align: center; font-size: 11px; color: #94a3b8; margin-top: 12px;
	}

	.spm-error-text { color: #ef4444; font-size: 14px; }

	.spm-success-icon { animation: spmPop 0.4s ease; }
	@keyframes spmPop {
		0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); }
	}
	.spm-success-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
	.spm-success-desc { font-size: 14px; color: #64748b; margin: 0; }

	:global(.spm-spin) { animation: spmSpin 1s linear infinite; }
	@keyframes spmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
