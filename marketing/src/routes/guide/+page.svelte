<script lang="ts">
	import { ArrowLeft, FileText, Package, Users, CreditCard, LayoutDashboard, Settings, ShoppingCart, Building2, ChevronRight } from 'lucide-svelte';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || '';

	const guides = [
		{ icon: LayoutDashboard, title: 'เริ่มต้นใช้งาน', desc: 'สมัครสมาชิกผ่าน Google หรือ LINE จากนั้นตั้งค่าข้อมูลบริษัท โลโก้ ตราประทับ และที่อยู่ให้เรียบร้อย เพียงเท่านี้ก็พร้อมออกเอกสารได้ทันที', steps: ['สมัครสมาชิกหรือเข้าสู่ระบบ', 'ไปที่ "บริษัทของฉัน" ตั้งค่าข้อมูลบริษัท', 'อัปโหลดโลโก้และตราประทับ', 'ชำระเงิน ฿790 เพื่อเปิดใช้งานเต็มรูปแบบ'] },
		{ icon: FileText, title: 'ออกเอกสาร', desc: 'สร้างเอกสารธุรกิจ 10 ประเภท ตั้งแต่ใบเสนอราคาจนถึงใบกำกับภาษี เลือกลูกค้า เพิ่มสินค้า ระบบคำนวณ VAT/WHT ให้อัตโนมัติ', steps: ['กดเมนู "ออกเอกสาร"', 'เลือกประเภทเอกสารที่ต้องการ', 'เลือกลูกค้าและเพิ่มรายการสินค้า', 'ตรวจสอบพรีวิวแล้วกด "บันทึก"', 'พิมพ์หรือส่งออก PDF'] },
		{ icon: Package, title: 'จัดการสินค้า/บริการ', desc: 'เพิ่มสินค้าและบริการพร้อมราคา หน่วย และภาษี เปิดระบบสต๊อกเพื่อติดตามจำนวนคงเหลือแบบเรียลไทม์', steps: ['ไปที่เมนู "สินค้า/บริการ"', 'กด "เพิ่มสินค้า" กรอกชื่อ ราคา หน่วย', 'เปิดสวิตช์ "ติดตามสต๊อก" ถ้าต้องการ', 'ตั้งค่า "จำนวนขั้นต่ำ" เพื่อแจ้งเตือนสต๊อกต่ำ'] },
		{ icon: Users, title: 'จัดการลูกค้า/ผู้ขาย', desc: 'บันทึกข้อมูลลูกค้าและผู้ขาย พร้อมที่อยู่ เลขประจำตัวผู้เสียภาษี เพื่อเรียกใช้ซ้ำในเอกสารทุกครั้ง', steps: ['ไปที่เมนู "ลูกค้า/ผู้ขาย"', 'กด "เพิ่มลูกค้า" กรอกข้อมูล', 'เมื่อสร้างเอกสาร เลือกลูกค้าจากรายการได้ทันที'] },
		{ icon: CreditCard, title: 'ติดตามการชำระเงิน', desc: 'ดูสถานะการชำระเงินของเอกสารทุกฉบับ อัปเดตสถานะ รอชำระ/ชำระแล้ว/ยกเลิก ได้สะดวก', steps: ['ไปที่เมนู "ติดตามชำระเงิน"', 'ดูรายการเอกสารที่รอชำระ', 'กดอัปเดตสถานะเมื่อได้รับเงิน'] },
		{ icon: ShoppingCart, title: 'สั่งซื้อสินค้า', desc: 'สร้างใบสั่งซื้อและใบขอซื้อ จัดการการสั่งซื้อสินค้าจากผู้ขาย พร้อมติดตามสถานะ', steps: ['ไปที่เมนู "สั่งซื้อสินค้า"', 'เลือกผู้ขายและเพิ่มรายการสินค้า', 'บันทึกและติดตามสถานะการสั่งซื้อ'] },
		{ icon: Building2, title: 'จัดการหลายบริษัท', desc: 'เพิ่มและสลับระหว่างหลายบริษัทได้ในคลิกเดียว ข้อมูลแต่ละบริษัทแยกกันอย่างชัดเจน', steps: ['ไปที่เมนู "บริษัทของฉัน"', 'กด "เพิ่มบริษัท" สำหรับบริษัทใหม่', 'สลับบริษัทจาก dropdown ใน Sidebar'] },
		{ icon: Settings, title: 'ตั้งค่าระบบ', desc: 'ปรับแต่งธีมสี ฟอนต์ รูปแบบเลขเอกสาร เลขเริ่มต้น และตั้งค่าอื่นๆ ตามต้องการ', steps: ['ไปที่เมนู "ตั้งค่า"', 'เปลี่ยนธีมสีและฟอนต์ในแท็บ "หน้าตา"', 'ตั้งค่ารูปแบบเลขเอกสารในแท็บ "เอกสาร"'] },
	];
</script>

<svelte:head>
	<title>คู่มือใช้งาน - Grid Doc</title>
	<meta name="description" content="คู่มือใช้งาน Grid Doc เรียนรู้การออกเอกสาร จัดการสินค้า ลูกค้า และอื่นๆ" />
</svelte:head>

<div class="guide">
	<div class="guide-container">
		<a href="/" class="guide-back"><ArrowLeft size={16} /> กลับหน้าหลัก</a>
		<div class="guide-header">
			<h1>คู่มือใช้งาน</h1>
			<p>เรียนรู้การใช้งาน Grid Doc อย่างรวดเร็ว</p>
		</div>
		<div class="guide-grid">
			{#each guides as g, i}
				{@const Icon = g.icon}
				<div class="guide-card">
					<div class="guide-card-head">
						<div class="guide-card-icon"><Icon size={22} /></div>
						<div><div class="guide-card-num">ขั้นตอนที่ {i + 1}</div><h2 class="guide-card-title">{g.title}</h2></div>
					</div>
					<p class="guide-card-desc">{g.desc}</p>
					<ol class="guide-steps">{#each g.steps as step}<li>{step}</li>{/each}</ol>
				</div>
			{/each}
		</div>
		<div class="guide-cta">
			<h2>พร้อมเริ่มต้นแล้ว?</h2>
			<p>ทดลองใช้งานจริงผ่าน Sandbox ได้ทันที หรือสมัครเพื่อเริ่มใช้งาน</p>
			<div class="guide-cta-btns">
				<a href="{APP_ORIGIN}/sandbox" class="guide-btn-primary">ทดลอง Sandbox <ChevronRight size={16} /></a>
				<a href="{APP_ORIGIN}/login" class="guide-btn-outline">เข้าสู่ระบบ <ChevronRight size={16} /></a>
			</div>
		</div>
	</div>
</div>

<style>
	.guide { min-height: 100vh; }
	.guide-container { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
	.guide-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: #6b7280; text-decoration: none; margin-bottom: 24px; }
	.guide-back:hover { color: #1a4731; }
	.guide-header { text-align: center; margin-bottom: 40px; }
	.guide-header h1 { font-size: 32px; font-weight: 900; color: #1a1a1a; margin-bottom: 8px; }
	.guide-header p { font-size: 15px; color: #6b7280; }
	.guide-grid { display: flex; flex-direction: column; gap: 16px; }
	.guide-card { background: #fff; border: 1px solid #eae7e1; border-radius: 16px; padding: 28px 24px; transition: all 0.2s; }
	.guide-card:hover { border-color: #3d8b5e; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
	.guide-card-head { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
	.guide-card-icon { width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0; background: rgba(61,139,94,0.08); color: #3d8b5e; display: flex; align-items: center; justify-content: center; }
	.guide-card-num { font-size: 12px; font-weight: 700; color: #3d8b5e; margin-bottom: 2px; }
	.guide-card-title { font-size: 18px; font-weight: 800; color: #1a1a1a; }
	.guide-card-desc { font-size: 14px; color: #6b7280; line-height: 1.7; margin-bottom: 14px; }
	.guide-steps { padding-left: 20px; margin: 0; }
	.guide-steps li { font-size: 14px; color: #4b5563; line-height: 1.8; margin-bottom: 4px; }
	.guide-steps li::marker { color: #3d8b5e; font-weight: 700; }
	.guide-cta { text-align: center; margin-top: 48px; padding: 40px 24px; background: #1a4731; border-radius: 16px; color: #fff; }
	.guide-cta h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
	.guide-cta p { font-size: 14px; opacity: 0.7; margin-bottom: 20px; }
	.guide-cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
	.guide-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; background: #fff; color: #1a4731; text-decoration: none; transition: all 0.15s; }
	.guide-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
	.guide-btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.3); text-decoration: none; transition: all 0.15s; }
	.guide-btn-outline:hover { border-color: #fff; }
	@media (max-width: 640px) { .guide-container { padding: 24px 16px 60px; } .guide-header h1 { font-size: 26px; } .guide-card { padding: 20px 18px; } }
</style>
