<script lang="ts">
	import { goto } from '$app/navigation';
	import { Mail, ArrowLeft, Send } from 'lucide-svelte';
	import { authApi } from '$lib/services/api-adapter';

	let email = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let errorMsg = $state('');

	async function handleSubmit() {
		if (!email.trim()) return;
		loading = true;
		errorMsg = '';
		try {
			const res = await authApi.forgotPassword(email);
			if (res.ok) {
				sent = true;
			} else {
				errorMsg = res.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
			}
		} catch (e: any) {
			errorMsg = e.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
		} finally {
			loading = false;
		}
	}
</script>

<div class="fp">
	<div class="fp-card">
		{#if sent}
			<div class="fp-success">
				<div class="fp-icon-wrap success">
					<Send size={28} />
				</div>
				<h1>ส่งลิงก์แล้ว!</h1>
				<p>เราส่งลิงก์รีเซ็ตรหัสผ่านไปที่ <strong>{email}</strong> แล้ว</p>
				<p class="fp-sub">กรุณาตรวจสอบอีเมลของคุณ (รวมถึงโฟลเดอร์สแปม) ลิงก์จะหมดอายุใน 1 ชั่วโมง</p>
				<button class="fp-btn" onclick={() => goto('/login')}>
					<ArrowLeft size={16} /> กลับไปหน้าเข้าสู่ระบบ
				</button>
			</div>
		{:else}
			<div class="fp-icon-wrap">
				<Mail size={28} />
			</div>
			<h1>ลืมรหัสผ่าน?</h1>
			<p>กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ</p>

			{#if errorMsg}
				<div class="fp-error">{errorMsg}</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<div class="fp-field">
					<div class="fp-input-wrap">
						<Mail size={16} />
						<input type="email" placeholder="อีเมลของคุณ" bind:value={email} required />
					</div>
				</div>
				<button type="submit" class="fp-submit" disabled={loading}>
					{#if loading}
						กำลังส่ง...
					{:else}
						ส่งลิงก์รีเซ็ตรหัสผ่าน
					{/if}
				</button>
			</form>

			<div class="fp-back">
				<button type="button" class="fp-link" onclick={() => goto('/login')}>
					<ArrowLeft size={14} /> กลับไปหน้าเข้าสู่ระบบ
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.fp {
		min-height: calc(100vh - 65px);
		display: flex; align-items: center; justify-content: center;
		padding: 32px 16px;
	}
	.fp-card {
		width: 100%; max-width: 420px;
		background: #fff; border-radius: 16px; padding: 36px 32px;
		border: 1px solid #eae7e1; text-align: center;
	}
	.fp-icon-wrap {
		width: 56px; height: 56px; margin: 0 auto 16px;
		background: #f0f4ff; color: #3b82f6;
		border-radius: 50%; display: flex; align-items: center; justify-content: center;
	}
	.fp-icon-wrap.success { background: #f0fdf4; color: #16a34a; }
	.fp-card h1 { font-size: 20px; font-weight: 800; color: #1a1a1a; margin-bottom: 8px; }
	.fp-card p { font-size: 13px; color: #6b7280; margin-bottom: 20px; line-height: 1.5; }
	.fp-sub { font-size: 12px; color: #9ca3af; }
	.fp-error {
		background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
		padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #dc2626;
	}
	.fp-field { margin-bottom: 16px; }
	.fp-input-wrap { position: relative; display: flex; align-items: center; }
	.fp-input-wrap :global(svg) { position: absolute; left: 14px; color: #9ca3af; pointer-events: none; }
	.fp-input-wrap input {
		width: 100%; padding: 12px 14px 12px 40px; border: 1px solid #eae7e1;
		border-radius: 10px; font-size: 14px; outline: none; background: #faf8f4;
		font-family: inherit; transition: all 0.15s;
	}
	.fp-input-wrap input:focus { border-color: #3d8b5e; box-shadow: 0 0 0 3px rgba(61,139,94,0.08); background: #fff; }
	.fp-submit {
		width: 100%; padding: 12px; border-radius: 10px;
		background: #1a4731; color: #fff; font-size: 15px; font-weight: 700;
		border: none; cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.fp-submit:hover:not(:disabled) { background: #153d2a; }
	.fp-submit:disabled { opacity: 0.6; cursor: not-allowed; }
	.fp-back { margin-top: 20px; }
	.fp-link {
		background: none; border: none; color: #3d8b5e; font-weight: 600;
		cursor: pointer; font-size: 13px; font-family: inherit;
		display: inline-flex; align-items: center; gap: 6px;
	}
	.fp-link:hover { text-decoration: underline; }
	.fp-btn {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 10px 20px; border-radius: 10px; background: #1a4731; color: #fff;
		font-size: 14px; font-weight: 600; border: none; cursor: pointer;
		font-family: inherit; margin-top: 12px;
	}
	.fp-btn:hover { background: #153d2a; }
	.fp-success { text-align: center; }
</style>
