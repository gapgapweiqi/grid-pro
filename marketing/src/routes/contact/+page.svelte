<script lang="ts">
	import { Mail, MessageCircle, ArrowLeft } from 'lucide-svelte';

	function sendEmail() {
		const subject = encodeURIComponent('สอบถามเกี่ยวกับ Grid Doc');
		const body = encodeURIComponent('สวัสดีครับ/ค่ะ\n\nต้องการสอบถามเกี่ยวกับ...\n');
		window.location.href = `mailto:support@grid-doc.com?subject=${subject}&body=${body}`;
	}
</script>

<svelte:head>
	<title>ติดต่อเรา - Grid Doc</title>
	<meta name="description" content="ติดต่อทีมงาน Grid Doc สำหรับคำถาม ข้อเสนอแนะ หรือปัญหาการใช้งาน" />
</svelte:head>

<div class="ct">
	<div class="ct-container">
		<a href="/" class="ct-back"><ArrowLeft size={16} /> กลับหน้าหลัก</a>
		<div class="ct-header">
			<h1>ติดต่อเรา</h1>
			<p>มีคำถามหรือต้องการความช่วยเหลือ? ทีมงานพร้อมช่วยคุณ</p>
		</div>
		<div class="ct-grid">
			<button class="ct-card" onclick={sendEmail}>
				<div class="ct-card-icon"><Mail size={24} /></div>
				<h3>อีเมล</h3>
				<p>support@grid-doc.com</p>
				<span class="ct-card-action">ส่งอีเมล →</span>
			</button>
			<div class="ct-card">
				<div class="ct-card-icon"><MessageCircle size={24} /></div>
				<h3>LINE</h3>
				<p>เพิ่มเพื่อน @griddoc</p>
				<span class="ct-card-action">เร็วๆ นี้</span>
			</div>
		</div>
		<div class="ct-note">
			<p>เวลาทำการ: จันทร์ - ศุกร์ 9:00 - 18:00 น.</p>
			<p>ตอบกลับภายใน 24 ชั่วโมงทำการ</p>
		</div>
	</div>
</div>

<style>
	.ct { --ct-green: #1a4731; --ct-sage: #3d8b5e; --ct-sage-soft: rgba(61,139,94,0.08); --ct-border: #eae7e1; --ct-text: #1a1a1a; --ct-muted: #6b7280; }
	.ct-container { max-width: 640px; margin: 0 auto; padding: 40px 24px 72px; }
	.ct-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--ct-muted); text-decoration: none; margin-bottom: 24px; }
	.ct-back:hover { color: var(--ct-green); }
	.ct-header { text-align: center; margin-bottom: 36px; }
	.ct-header h1 { font-size: 32px; font-weight: 800; color: var(--ct-text); margin-bottom: 8px; }
	.ct-header p { font-size: 15px; color: var(--ct-muted); }
	.ct-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
	.ct-card { background: #fff; border: 1px solid var(--ct-border); border-radius: 14px; padding: 28px 24px; text-align: center; cursor: pointer; transition: all 0.2s; font-family: inherit; font-size: inherit; }
	.ct-card:hover { border-color: var(--ct-sage); box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
	.ct-card-icon { width: 56px; height: 56px; border-radius: 14px; background: var(--ct-sage-soft); color: var(--ct-sage); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
	.ct-card h3 { font-size: 16px; font-weight: 700; color: var(--ct-text); margin-bottom: 4px; }
	.ct-card p { font-size: 13px; color: var(--ct-muted); margin-bottom: 12px; }
	.ct-card-action { font-size: 13px; font-weight: 600; color: var(--ct-sage); }
	.ct-note { text-align: center; }
	.ct-note p { font-size: 13px; color: var(--ct-muted); line-height: 1.8; }
	@media (max-width: 480px) { .ct-grid { grid-template-columns: 1fr; } }
</style>
