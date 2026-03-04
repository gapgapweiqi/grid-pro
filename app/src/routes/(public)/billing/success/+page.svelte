<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CheckCircle, Loader2, AlertTriangle } from 'lucide-svelte';

	const API_BASE = import.meta.env.VITE_API_URL || '';

	let status = $state<'verifying' | 'paid' | 'pending' | 'error'>('verifying');
	let countdown = $state(5);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		const sessionId = page.url.searchParams.get('session_id');
		if (!sessionId) { status = 'error'; return; }

		const token = localStorage.getItem('auth.token');
		if (!token) { goto('/login'); return; }

		// Poll verify-session up to 5 times (webhook may be delayed)
		for (let attempt = 0; attempt < 5; attempt++) {
			try {
				const res = await fetch(`${API_BASE}/api/billing/verify-session?session_id=${sessionId}`, {
					headers: { 'Authorization': `Bearer ${token}` },
				});
				const json = await res.json();
				if (json.ok && json.data?.status === 'PAID') {
					status = 'paid';
					// Refresh auth to update billingStatus
					try {
						const stored = localStorage.getItem('auth.user');
						if (stored) {
							const user = JSON.parse(stored);
							user.billingStatus = 'PAID';
							localStorage.setItem('auth.user', JSON.stringify(user));
						}
					} catch {}
					startCountdown();
					return;
				}
			} catch {}
			// Wait 2s before retrying
			if (attempt < 4) await new Promise(r => setTimeout(r, 2000));
		}

		// If after polling, still not paid
		status = 'pending';
		startCountdown();
	});

	function startCountdown() {
		intervalId = setInterval(() => {
			countdown--;
			if (countdown <= 0) {
				if (intervalId) clearInterval(intervalId);
				goto('/dashboard');
			}
		}, 1000);
	}
</script>

<div class="success-page">
	<div class="success-card">
		{#if status === 'verifying'}
			<Loader2 size={64} strokeWidth={1.5} color="#6366f1" class="spin" />
			<h1>กำลังตรวจสอบการชำระเงิน...</h1>
			<p>กรุณารอสักครู่</p>
		{:else if status === 'paid'}
			<CheckCircle size={64} strokeWidth={1.5} color="#22c55e" />
			<h1>ชำระเงินสำเร็จ!</h1>
			<p>ขอบคุณที่เลือกใช้งานระบบ GridDoc</p>
			<p class="success-sub">ระบบจะพาคุณไปหน้าหลักใน <strong>{countdown}</strong> วินาที...</p>
			<button class="btn-go" onclick={() => goto('/dashboard')}>ไปหน้าหลักเลย</button>
		{:else if status === 'pending'}
			<CheckCircle size={64} strokeWidth={1.5} color="#f59e0b" />
			<h1>กำลังดำเนินการ</h1>
			<p>ระบบกำลังประมวลผลการชำระเงินของคุณ อาจใช้เวลาสักครู่</p>
			<p class="success-sub">ระบบจะพาคุณไปหน้าหลักใน <strong>{countdown}</strong> วินาที...</p>
			<button class="btn-go" onclick={() => goto('/dashboard')}>ไปหน้าหลักเลย</button>
		{:else}
			<AlertTriangle size={64} strokeWidth={1.5} color="#ef4444" />
			<h1>เกิดข้อผิดพลาด</h1>
			<p>ไม่พบข้อมูลการชำระเงิน กรุณาติดต่อฝ่ายสนับสนุน</p>
			<button class="btn-go" onclick={() => goto('/pricing')}>กลับหน้าชำระเงิน</button>
		{/if}
	</div>
</div>

<style>
	.success-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
		padding: 24px;
	}
	.success-card {
		background: #fff;
		border-radius: 20px;
		padding: 48px 40px;
		text-align: center;
		max-width: 420px;
		box-shadow: 0 8px 30px rgba(0,0,0,0.06);
	}
	.success-card h1 {
		font-size: 24px;
		font-weight: 800;
		color: #1e293b;
		margin: 16px 0 8px;
	}
	.success-card p {
		font-size: 14px;
		color: #64748b;
		margin: 0 0 4px;
	}
	.success-sub {
		margin-top: 16px !important;
		font-size: 13px !important;
	}
	.btn-go {
		margin-top: 20px;
		padding: 10px 24px;
		background: #22c55e;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}
	.btn-go:hover { background: #16a34a; }
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
