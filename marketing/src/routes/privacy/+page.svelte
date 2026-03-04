<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
</script>

<svelte:head>
	<title>นโยบายความเป็นส่วนตัว - Grid Doc</title>
	<meta name="description" content="นโยบายความเป็นส่วนตัวของ Grid Doc" />
</svelte:head>

<div class="legal">
	<div class="legal-container">
		<a href="/" class="legal-back"><ArrowLeft size={16} /> กลับหน้าหลัก</a>
		<h1>นโยบายความเป็นส่วนตัว</h1>
		<p class="legal-date">อัปเดตล่าสุด: 1 มกราคม 2568</p>

		<div class="legal-content">
			<h2>1. ข้อมูลที่เราเก็บรวบรวม</h2>
			<p>เราเก็บรวบรวมข้อมูลที่จำเป็นสำหรับการให้บริการ ได้แก่:</p>
			<ul>
				<li>ข้อมูลบัญชีผู้ใช้ (ชื่อ อีเมล)</li>
				<li>ข้อมูลบริษัท (ชื่อบริษัท ที่อยู่ เลขประจำตัวผู้เสียภาษี)</li>
				<li>ข้อมูลเอกสารที่สร้างในระบบ</li>
				<li>ข้อมูลการชำระเงิน (ผ่านผู้ให้บริการ Stripe)</li>
			</ul>

			<h2>2. การใช้ข้อมูล</h2>
			<p>เราใช้ข้อมูลของคุณเพื่อ:</p>
			<ul>
				<li>ให้บริการระบบออกเอกสารตามที่คุณร้องขอ</li>
				<li>จัดการบัญชีผู้ใช้และการยืนยันตัวตน</li>
				<li>ปรับปรุงและพัฒนาบริการ</li>
				<li>ติดต่อสื่อสารเกี่ยวกับบริการ</li>
			</ul>

			<h2>3. การเก็บรักษาข้อมูล</h2>
			<p>ข้อมูลของคุณถูกจัดเก็บอย่างปลอดภัยบน Cloudflare Workers และ D1 Database ด้วยการเข้ารหัสมาตรฐานสากล เราไม่แบ่งปันข้อมูลส่วนตัวของคุณกับบุคคลที่สามโดยไม่ได้รับอนุญาต</p>

			<h2>4. สิทธิ์ของคุณ</h2>
			<p>คุณมีสิทธิ์:</p>
			<ul>
				<li>เข้าถึงและแก้ไขข้อมูลส่วนตัวของคุณ</li>
				<li>ขอลบบัญชีและข้อมูลทั้งหมด</li>
				<li>ส่งออกข้อมูลของคุณ</li>
			</ul>

			<h2>5. การติดต่อ</h2>
			<p>หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อเราที่ <strong>support@grid-doc.com</strong></p>
		</div>
	</div>
</div>

<style>
	.legal { --legal-text: #1a1a1a; --legal-muted: #6b7280; --legal-border: #eae7e1; }
	.legal-container { max-width: 720px; margin: 0 auto; padding: 40px 24px 72px; }
	.legal-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--legal-muted); text-decoration: none; margin-bottom: 24px; }
	.legal-back:hover { color: #1a4731; }
	.legal-container h1 { font-size: 32px; font-weight: 800; color: var(--legal-text); margin-bottom: 8px; }
	.legal-date { font-size: 13px; color: var(--legal-muted); margin-bottom: 36px; }
	.legal-content h2 { font-size: 18px; font-weight: 700; color: var(--legal-text); margin-top: 32px; margin-bottom: 12px; }
	.legal-content p { font-size: 14px; color: #374151; line-height: 1.8; margin-bottom: 12px; }
	.legal-content ul { padding-left: 24px; margin-bottom: 16px; }
	.legal-content li { font-size: 14px; color: #374151; line-height: 1.8; margin-bottom: 4px; }
</style>
