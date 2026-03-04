<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
</script>

<svelte:head>
	<title>เงื่อนไขการใช้งาน - Grid Doc</title>
	<meta name="description" content="เงื่อนไขการใช้งาน Grid Doc" />
</svelte:head>

<div class="legal">
	<div class="legal-container">
		<a href="/" class="legal-back"><ArrowLeft size={16} /> กลับหน้าหลัก</a>
		<h1>เงื่อนไขการใช้งาน</h1>
		<p class="legal-date">อัปเดตล่าสุด: 1 มกราคม 2568</p>

		<div class="legal-content">
			<h2>1. การยอมรับเงื่อนไข</h2>
			<p>การใช้งาน Grid Doc ถือว่าคุณยอมรับเงื่อนไขการใช้งานทั้งหมดที่ระบุไว้ในเอกสารนี้</p>

			<h2>2. บริการที่ให้</h2>
			<p>Grid Doc เป็นระบบออกเอกสารธุรกิจออนไลน์ ให้บริการสร้าง จัดเก็บ และจัดการเอกสารธุรกิจ ข้อมูลสินค้า ลูกค้า และรายงานที่เกี่ยวข้อง</p>

			<h2>3. แผนการชำระเงิน</h2>
			<p>Grid Doc เสนอแผน Pro ในราคา ฿790 (จ่ายครั้งเดียว ใช้งานได้ตลอดชีพ) การชำระเงินดำเนินการผ่าน Stripe อย่างปลอดภัย ไม่มีค่าบริการรายเดือนหรือรายปีแอบแฝง</p>

			<h2>4. การใช้งานที่อนุญาต</h2>
			<p>คุณตกลงที่จะใช้บริการเพื่อวัตถุประสงค์ทางธุรกิจที่ถูกกฎหมายเท่านั้น ห้ามใช้บริการเพื่อ:</p>
			<ul>
				<li>สร้างเอกสารปลอมหรือหลอกลวง</li>
				<li>ละเมิดกฎหมายภาษีหรือกฎหมายอื่นๆ</li>
				<li>แทรกแซงหรือทำลายระบบ</li>
			</ul>

			<h2>5. ความรับผิดชอบ</h2>
			<p>คุณรับผิดชอบในความถูกต้องของข้อมูลที่ป้อนเข้าสู่ระบบ Grid Doc ให้เครื่องมือสร้างเอกสาร แต่ไม่รับรองความถูกต้องทางกฎหมายหรือภาษีของเอกสารที่สร้างขึ้น</p>

			<h2>6. การยกเลิกบริการ</h2>
			<p>เราสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีที่ละเมิดเงื่อนไขการใช้งาน โดยจะแจ้งให้ทราบล่วงหน้าตามสมควร</p>

			<h2>7. การเปลี่ยนแปลงเงื่อนไข</h2>
			<p>เราอาจปรับปรุงเงื่อนไขเหล่านี้เป็นครั้งคราว การเปลี่ยนแปลงสำคัญจะแจ้งให้ทราบผ่านอีเมลหรือการแจ้งเตือนในระบบ</p>

			<h2>8. การติดต่อ</h2>
			<p>หากมีคำถามเกี่ยวกับเงื่อนไขการใช้งาน กรุณาติดต่อเราที่ <strong>support@grid-doc.com</strong></p>
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
