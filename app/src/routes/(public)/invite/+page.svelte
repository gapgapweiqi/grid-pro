<script lang="ts">
	import { FileText, XCircle } from 'lucide-svelte';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || '';
</script>

<div class="invite-page">
	<div class="invite-card">
		<div class="invite-logo"><FileText size={24} /></div>
		<XCircle size={48} color="#ef4444" />
		<h2>ลิงก์เชิญไม่ถูกต้อง</h2>
		<p>กรุณาตรวจสอบลิงก์ที่ได้รับอีกครั้ง</p>
		<a href="{APP_ORIGIN}/login" class="invite-btn">กลับหน้าเข้าสู่ระบบ</a>
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
		width: 48px; height: 48px; border-radius: 12px;
		background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #fff;
		display: flex; align-items: center; justify-content: center;
		margin: 0 auto 24px;
	}
	h2 { font-size: 20px; font-weight: 700; color: #111827; margin: 16px 0 8px; }
	p { font-size: 14px; color: #6b7280; margin: 0 0 20px; }
	.invite-btn {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 12px 28px; background: linear-gradient(135deg, #0ea5e9, #0284c7);
		color: #fff; border: none; border-radius: 12px;
		font-size: 14px; font-weight: 600; cursor: pointer;
		text-decoration: none; font-family: inherit; transition: all 0.2s;
	}
	.invite-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
	}
</style>
