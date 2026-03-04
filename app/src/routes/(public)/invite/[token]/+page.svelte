<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { FileText, CheckCircle, XCircle, Loader } from 'lucide-svelte';
	import { teamApi } from '$lib/services/api-adapter';
	import { restoreAuth } from '$lib/stores/auth';
	import { addToast } from '$lib/stores/app';

	let status = $state<'loading' | 'success' | 'error' | 'login'>('loading');
	let errorMsg = $state('');

	onMount(async () => {
		const token = $page.params.token;

		if (!token) {
			status = 'error';
			errorMsg = 'ลิงก์เชิญไม่ถูกต้อง';
			return;
		}

		// Must be logged in to accept invite
		const loggedIn = restoreAuth();
		if (!loggedIn) {
			// Save invite token so we can redirect back after login
			sessionStorage.setItem('pendingInviteToken', token);
			status = 'login';
			return;
		}

		try {
			const res = await teamApi.acceptInvite(token);
			if (res.ok) {
				status = 'success';
				addToast('เข้าร่วมทีมเรียบร้อย!', 'success');
				setTimeout(() => goto('/dashboard'), 2000);
			} else {
				status = 'error';
				errorMsg = res.error?.message || 'ไม่สามารถตอบรับคำเชิญได้';
			}
		} catch (e: any) {
			status = 'error';
			errorMsg = e.message || 'เกิดข้อผิดพลาด';
		}
	});
</script>

<div class="invite-page">
	<div class="invite-card">
		<div class="invite-logo"><FileText size={24} /></div>

		{#if status === 'loading'}
			<Loader size={32} class="animate-spin" />
			<h2>กำลังตรวจสอบคำเชิญ...</h2>
		{:else if status === 'success'}
			<CheckCircle size={48} color="#22c55e" />
			<h2>เข้าร่วมทีมเรียบร้อย!</h2>
			<p>กำลังนำคุณไปหน้าหลัก...</p>
		{:else if status === 'login'}
			<h2>กรุณาเข้าสู่ระบบก่อน</h2>
			<p>คุณต้องเข้าสู่ระบบก่อนจึงจะตอบรับคำเชิญได้</p>
			<button class="invite-btn" onclick={() => goto('/login')}>เข้าสู่ระบบ</button>
		{:else}
			<XCircle size={48} color="#ef4444" />
			<h2>เกิดข้อผิดพลาด</h2>
			<p>{errorMsg}</p>
			<button class="invite-btn" onclick={() => goto('/login')}>กลับหน้าเข้าสู่ระบบ</button>
		{/if}
	</div>
</div>

<style>
	.invite-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
		padding: 20px;
	}
	.invite-card {
		background: #fff;
		border-radius: 20px;
		padding: 48px 40px;
		text-align: center;
		max-width: 420px;
		width: 100%;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
	}
	.invite-logo {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		background: linear-gradient(135deg, #0ea5e9, #0284c7);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 24px;
	}
	h2 {
		font-size: 20px;
		font-weight: 700;
		color: #111827;
		margin: 16px 0 8px;
	}
	p {
		font-size: 14px;
		color: #6b7280;
		margin: 0 0 20px;
	}
	.invite-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 28px;
		background: linear-gradient(135deg, #0ea5e9, #0284c7);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}
	.invite-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
	}
	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
