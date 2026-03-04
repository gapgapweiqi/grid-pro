<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Lock, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-svelte';
	import { authApi } from '$lib/services/api-adapter';

	let token = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let status = $state<'form' | 'success' | 'error'>('form');
	let errorMsg = $state('');

	onMount(() => {
		const url = new URL(window.location.href);
		token = url.searchParams.get('token') || '';
		if (!token) {
			status = 'error';
			errorMsg = 'ลิงก์ไม่ถูกต้อง กรุณาขอรีเซ็ตรหัสผ่านใหม่';
		}
	});

	async function handleSubmit() {
		errorMsg = '';
		if (newPassword.length < 8) {
			errorMsg = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
			return;
		}
		if (newPassword !== confirmPassword) {
			errorMsg = 'รหัสผ่านไม่ตรงกัน';
			return;
		}
		loading = true;
		try {
			const res = await authApi.resetPassword(token, newPassword);
			if (res.ok) {
				status = 'success';
			} else {
				const code = res.error?.code;
				if (code === 'EXPIRED') {
					errorMsg = 'ลิงก์หมดอายุแล้ว กรุณาขอรีเซ็ตรหัสผ่านใหม่';
				} else if (code === 'USED') {
					errorMsg = 'ลิงก์นี้ถูกใช้ไปแล้ว กรุณาขอรีเซ็ตรหัสผ่านใหม่';
				} else {
					errorMsg = res.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
				}
			}
		} catch (e: any) {
			errorMsg = e.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
		} finally {
			loading = false;
		}
	}
</script>

<div class="rp">
	<div class="rp-card">
		{#if status === 'success'}
			<div class="rp-result">
				<div class="rp-icon-wrap success"><CheckCircle size={28} /></div>
				<h1>เปลี่ยนรหัสผ่านสำเร็จ!</h1>
				<p>คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว</p>
				<button class="rp-btn" onclick={() => goto('/login')}>
					ไปหน้าเข้าสู่ระบบ
				</button>
			</div>
		{:else if status === 'error' && !token}
			<div class="rp-result">
				<div class="rp-icon-wrap error"><AlertTriangle size={28} /></div>
				<h1>ลิงก์ไม่ถูกต้อง</h1>
				<p>{errorMsg}</p>
				<button class="rp-btn" onclick={() => goto('/forgot-password')}>
					ขอรีเซ็ตรหัสผ่านใหม่
				</button>
			</div>
		{:else}
			<div class="rp-icon-wrap"><Lock size={28} /></div>
			<h1>ตั้งรหัสผ่านใหม่</h1>
			<p>กรอกรหัสผ่านใหม่ที่คุณต้องการใช้</p>

			{#if errorMsg}
				<div class="rp-error">{errorMsg}</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<div class="rp-field">
					<label class="rp-label" for="newPw">รหัสผ่านใหม่</label>
					<div class="rp-input-wrap">
						<Lock size={16} />
						<input id="newPw" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" bind:value={newPassword} required />
					</div>
				</div>
				<div class="rp-field">
					<label class="rp-label" for="confirmPw">ยืนยันรหัสผ่านใหม่</label>
					<div class="rp-input-wrap">
						<Lock size={16} />
						<input id="confirmPw" type="password" placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" bind:value={confirmPassword} required />
					</div>
				</div>
				<button type="submit" class="rp-submit" disabled={loading}>
					{#if loading}
						กำลังดำเนินการ...
					{:else}
						เปลี่ยนรหัสผ่าน
					{/if}
				</button>
			</form>

			<div class="rp-back">
				<button type="button" class="rp-link" onclick={() => goto('/login')}>
					<ArrowLeft size={14} /> กลับไปหน้าเข้าสู่ระบบ
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.rp {
		min-height: calc(100vh - 65px);
		display: flex; align-items: center; justify-content: center;
		padding: 32px 16px;
	}
	.rp-card {
		width: 100%; max-width: 420px;
		background: #fff; border-radius: 16px; padding: 36px 32px;
		border: 1px solid #eae7e1; text-align: center;
	}
	.rp-icon-wrap {
		width: 56px; height: 56px; margin: 0 auto 16px;
		background: #f0f4ff; color: #3b82f6;
		border-radius: 50%; display: flex; align-items: center; justify-content: center;
	}
	.rp-icon-wrap.success { background: #f0fdf4; color: #16a34a; }
	.rp-icon-wrap.error { background: #fef2f2; color: #ef4444; }
	.rp-card h1 { font-size: 20px; font-weight: 800; color: #1a1a1a; margin-bottom: 8px; }
	.rp-card p { font-size: 13px; color: #6b7280; margin-bottom: 20px; line-height: 1.5; }
	.rp-error {
		background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
		padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #dc2626; text-align: left;
	}
	.rp-field { margin-bottom: 14px; text-align: left; }
	.rp-label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 6px; }
	.rp-input-wrap { position: relative; display: flex; align-items: center; }
	.rp-input-wrap :global(svg) { position: absolute; left: 14px; color: #9ca3af; pointer-events: none; }
	.rp-input-wrap input {
		width: 100%; padding: 12px 14px 12px 40px; border: 1px solid #eae7e1;
		border-radius: 10px; font-size: 14px; outline: none; background: #faf8f4;
		font-family: inherit; transition: all 0.15s;
	}
	.rp-input-wrap input:focus { border-color: #3d8b5e; box-shadow: 0 0 0 3px rgba(61,139,94,0.08); background: #fff; }
	.rp-submit {
		width: 100%; padding: 12px; border-radius: 10px; margin-top: 4px;
		background: #1a4731; color: #fff; font-size: 15px; font-weight: 700;
		border: none; cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.rp-submit:hover:not(:disabled) { background: #153d2a; }
	.rp-submit:disabled { opacity: 0.6; cursor: not-allowed; }
	.rp-back { margin-top: 20px; }
	.rp-link {
		background: none; border: none; color: #3d8b5e; font-weight: 600;
		cursor: pointer; font-size: 13px; font-family: inherit;
		display: inline-flex; align-items: center; gap: 6px;
	}
	.rp-link:hover { text-decoration: underline; }
	.rp-btn {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 10px 20px; border-radius: 10px; background: #1a4731; color: #fff;
		font-size: 14px; font-weight: 600; border: none; cursor: pointer;
		font-family: inherit; margin-top: 12px;
	}
	.rp-btn:hover { background: #153d2a; }
	.rp-result { text-align: center; }
</style>
