<script lang="ts">
	import { PRO_PLAN, FAQ_ITEMS } from '$lib/config/pricing';
	import { Check, FileText, Package, BarChart3, Building2, Shield, Globe, ArrowRight, Users, Receipt, ChevronRight, Sparkles, CheckCircle2, ChevronDown } from 'lucide-svelte';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || '';

	let openFaqIndex: number | null = $state(null);
	function toggleFaq(i: number) { openFaqIndex = openFaqIndex === i ? null : i; }

	const features = [
		{ icon: FileText, title: 'ออกเอกสาร 10 ประเภท', desc: 'ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ ใบกำกับภาษี ใบสั่งซื้อ และอื่นๆ พร้อมพิมพ์และ PDF' },
		{ icon: Package, title: 'จัดการสต๊อกสินค้า', desc: 'ติดตามสินค้าคงเหลือแบบเรียลไทม์ แจ้งเตือนสต๊อกต่ำ พร้อมประวัติเคลื่อนไหว' },
		{ icon: BarChart3, title: 'แดชบอร์ดรายงาน', desc: 'ดูยอดขาย ลูกค้ายอดนิยม สินค้าขายดี แนวโน้มรายได้ ได้ทันทีในหน้าเดียว' },
		{ icon: Building2, title: 'จัดการหลายบริษัท', desc: 'สลับบริษัทได้ทันทีในคลิกเดียว ข้อมูลแยกกันชัดเจน ปลอดภัย' },
		{ icon: Shield, title: 'VAT / WHT อัตโนมัติ', desc: 'คำนวณภาษีมูลค่าเพิ่มและหัก ณ ที่จ่าย ถูกต้องตามกฎหมาย รองรับ VAT Inclusive' },
		{ icon: Globe, title: 'ใช้ได้ทุกที่ ทุกอุปกรณ์', desc: 'ใช้งานผ่าน Browser ได้ทุกอุปกรณ์ ไม่ต้องติดตั้ง หรือดาวน์โหลดแอปใช้งาน' },
	];

	const steps = [
		{ num: '01', title: 'สร้างบัญชี', desc: 'สมัครใช้งานฟรี กรอกข้อมูลบริษัทเสร็จภายใน 2 นาที' },
		{ num: '02', title: 'เพิ่มข้อมูล', desc: 'เพิ่มสินค้า ลูกค้า ตั้งค่าเอกสาร ระบบนำทางให้ทุกขั้นตอน' },
		{ num: '03', title: 'ออกเอกสาร', desc: 'เลือกประเภทเอกสาร กรอกข้อมูล พรีวิว แล้วพิมพ์หรือส่ง PDF ได้เลย' },
	];

	const docTypes = [
		{ name: 'ใบเสนอราคา', color: '#1e40af' },
		{ name: 'ใบแจ้งหนี้', color: '#3730a3' },
		{ name: 'ใบวางบิล', color: '#be185d' },
		{ name: 'ใบกำกับภาษี', color: '#c2410c' },
		{ name: 'ใบเสร็จรับเงิน', color: '#166534' },
		{ name: 'ใบส่งของ', color: '#6b21a8' },
		{ name: 'ใบสั่งซื้อ', color: '#0369a1' },
		{ name: 'ใบลดหนี้', color: '#b91c1c' },
		{ name: 'ใบสำคัญจ่าย', color: '#a16207' },
		{ name: 'ใบขอซื้อ', color: '#4338ca' },
	];

	const stats = [
		{ value: '10+', label: 'ประเภทเอกสาร' },
		{ value: '4', label: 'รูปแบบเทมเพลต' },
		{ value: '99.9%', label: 'Uptime' },
		{ value: '5K+', label: 'ผู้ใช้งาน' },
	];
</script>

<svelte:head>
	<title>Grid Doc - ระบบออกเอกสารธุรกิจออนไลน์</title>
</svelte:head>

<div class="ld">
	<!-- Hero -->
	<section class="ld-hero">
		<div class="ld-container">
			<div class="ld-hero-inner">
				<div class="ld-hero-text">
					<div class="ld-badge"><Sparkles size={12} /> ระบบออกเอกสารธุรกิจออนไลน์</div>
					<h1>จัดการเอกสารธุรกิจ<br/>ได้ง่ายขึ้น <span class="ld-accent">อย่างมืออาชีพ</span></h1>
					<p>ออกใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ ใบกำกับภาษี และอื่นๆ<br/>พร้อมระบบจัดการสต๊อก ลูกค้า และรายงาน ครบจบในที่เดียว</p>
					<div class="ld-hero-btns">
						<a href="{APP_ORIGIN}/login" class="ld-btn-primary">เริ่มต้นใช้งาน <ArrowRight size={16} /></a>
						<a href="{APP_ORIGIN}/sandbox" class="ld-btn-outline">ทดลองใช้ Sandbox <ChevronRight size={16} /></a>
					</div>
					<div class="ld-hero-trust">จ่ายครั้งเดียว ฿790 ตลอดชีพ &middot; ทดลองใช้ฟรีผ่าน Sandbox</div>
				</div>
				<div class="ld-hero-visual">
					<div class="ld-glow"></div>
					<div class="ld-cards-stack">
						<!-- Card 3 (back) -->
						<div class="ld-doc-card card-3">
							<div class="ld-doc-card-bar" style="background: #6b21a8"></div>
							<div class="ld-doc-card-body">
								<div class="ld-doc-card-head">
									<span class="ld-doc-card-icon" style="color: #6b21a8; background: rgba(107,33,168,0.08)"><Receipt size={16} /></span>
									<span class="ld-doc-card-type">ใบเสร็จรับเงิน</span>
								</div>
								<div class="ld-doc-card-lines">
									<div class="ld-line w80"></div><div class="ld-line w60"></div><div class="ld-line w70"></div><div class="ld-line w50"></div><div class="ld-line w75"></div><div class="ld-line w65"></div><div class="ld-line w80"></div><div class="ld-line w45"></div>
								</div>
								<div class="ld-doc-card-total"><span>รวมทั้งสิ้น</span><span class="ld-total-val">฿8,560.00</span></div>
							</div>
						</div>
						<!-- Card 2 (middle) -->
						<div class="ld-doc-card card-2">
							<div class="ld-doc-card-bar" style="background: #3730a3"></div>
							<div class="ld-doc-card-body">
								<div class="ld-doc-card-head">
									<span class="ld-doc-card-icon" style="color: #3730a3; background: rgba(55,48,163,0.08)"><FileText size={16} /></span>
									<span class="ld-doc-card-type">ใบแจ้งหนี้</span>
								</div>
								<div class="ld-doc-card-lines">
									<div class="ld-line w90"></div><div class="ld-line w50"></div><div class="ld-line w75"></div><div class="ld-line w60"></div><div class="ld-line w85"></div><div class="ld-line w70"></div><div class="ld-line w55"></div><div class="ld-line w80"></div>
								</div>
								<div class="ld-doc-card-total"><span>รวมทั้งสิ้น</span><span class="ld-total-val">฿24,750.00</span></div>
							</div>
						</div>
						<!-- Card 1 (front) -->
						<div class="ld-doc-card card-1">
							<div class="ld-doc-card-bar" style="background: #1e40af"></div>
							<div class="ld-doc-card-body">
								<div class="ld-doc-card-head">
									<span class="ld-doc-card-icon" style="color: #1e40af; background: rgba(30,64,175,0.08)"><FileText size={16} /></span>
									<span class="ld-doc-card-type">ใบเสนอราคา</span>
									<span class="ld-doc-card-status"><CheckCircle2 size={14} /> สำเร็จ</span>
								</div>
								<div class="ld-doc-card-lines">
									<div class="ld-line w90"></div><div class="ld-line w65"></div><div class="ld-line w80"></div><div class="ld-line w45"></div><div class="ld-line w75"></div><div class="ld-line w60"></div><div class="ld-line w85"></div><div class="ld-line w50"></div><div class="ld-line w70"></div>
								</div>
								<div class="ld-doc-card-total"><span>รวมทั้งสิ้น</span><span class="ld-total-val">฿45,300.00</span></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Stats -->
	<section class="ld-stats">
		<div class="ld-container">
			<div class="ld-stats-grid">
				{#each stats as s}
					<div class="ld-stat"><div class="ld-stat-value">{s.value}</div><div class="ld-stat-label">{s.label}</div></div>
				{/each}
			</div>
		</div>
	</section>

	<!-- How it works -->
	<section class="ld-section">
		<div class="ld-container">
			<div class="ld-section-head"><h2>เริ่มต้นง่ายๆ ใน 3 ขั้นตอน</h2><p>ไม่ต้องตั้งค่าซับซ้อน ใช้งานได้ทันที</p></div>
			<div class="ld-steps">
				{#each steps as step}
					<div class="ld-step-card"><div class="ld-step-num">{step.num}</div><h3>{step.title}</h3><p>{step.desc}</p></div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Features -->
	<section id="features" class="ld-section ld-bg-white">
		<div class="ld-container">
			<div class="ld-section-head"><h2>ฟีเจอร์ที่ออกแบบมาเพื่อธุรกิจไทย</h2><p>ครบทุกเครื่องมือที่ต้องการ พร้อมใช้งานทันที</p></div>
			<div class="ld-features">
				{#each features as f}
					{@const Icon = f.icon}
					<div class="ld-feature"><div class="ld-feature-icon"><Icon size={22} /></div><h3>{f.title}</h3><p>{f.desc}</p></div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Document Types -->
	<section class="ld-section">
		<div class="ld-container">
			<div class="ld-section-head"><h2>รองรับเอกสาร 10 ประเภท</h2><p>ครอบคลุมทุกเอกสารที่ธุรกิจต้องใช้ ทั้งฝั่งขายและฝั่งซื้อ</p></div>
			<div class="ld-doc-chips">
				{#each docTypes as dt}
					<span class="ld-chip" style="--chip-color: {dt.color}">{dt.name}</span>
				{/each}
			</div>
		</div>
	</section>

	<!-- Pricing -->
	<section id="pricing" class="ld-section ld-bg-white">
		<div class="ld-container">
			<div class="ld-section-head"><h2>ราคาเดียว ครบทุกฟีเจอร์</h2><p>จ่ายครั้งเดียว ใช้งานได้ตลอดชีพ ไม่มีรายเดือน</p></div>
			<div class="ld-pricing-card">
				<div class="ld-pricing-top">
					<div><div class="ld-pricing-name">{PRO_PLAN.nameTh}</div><div class="ld-pricing-desc">{PRO_PLAN.description}</div></div>
					<div class="ld-pricing-price"><span class="ld-price-amount">฿{PRO_PLAN.price.toLocaleString()}</span><span class="ld-price-period">ตลอดชีพ</span></div>
				</div>
				<div class="ld-pricing-features">
					{#each PRO_PLAN.features as feat}
						<div class="ld-pricing-feat"><span class="ld-check"><Check size={14} /></span>{feat}</div>
					{/each}
				</div>
				<a href="{APP_ORIGIN}/sandbox" class="ld-btn-primary" style="width: 100%; justify-content: center;">ทดลองใช้ Sandbox (ไม่ต้องสมัคร) <ArrowRight size={16} /></a>
			</div>
		</div>
	</section>

	<!-- FAQ -->
	<section id="faq" class="ld-section">
		<div class="ld-container">
			<div class="ld-section-head"><h2>คำถามที่พบบ่อย</h2><p>คำตอบสำหรับคำถามยอดนิยม</p></div>
			<div class="ld-faq-list">
				{#each FAQ_ITEMS as faq, i}
					<button class="ld-faq-item" class:open={openFaqIndex === i} onclick={() => toggleFaq(i)}>
						<div class="ld-faq-q"><span>{faq.q}</span><span class="ld-faq-chevron"><ChevronDown size={18} /></span></div>
						{#if openFaqIndex === i}<div class="ld-faq-a">{faq.a}</div>{/if}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section class="ld-cta">
		<div class="ld-container">
			<div class="ld-cta-box">
				<h2>พร้อมจัดการธุรกิจอย่างมืออาชีพ?</h2>
				<p>ทดลองใช้งานระบบจริงผ่านโหมด Sandbox ได้ทันที ไม่ต้องสมัครสมาชิก</p>
				<a href="{APP_ORIGIN}/sandbox" class="ld-btn-cta-white">เข้าสู่โหมด Sandbox <ArrowRight size={16} /></a>
			</div>
		</div>
	</section>
</div>

<style>
	.ld { --ld-green: #1a4731; --ld-sage: #3d8b5e; --ld-sage-soft: rgba(61,139,94,0.08); --ld-cream: #faf8f4; --ld-border: #eae7e1; --ld-text: #1a1a1a; --ld-muted: #6b7280; --ld-light-bg: #f5f2ed; width: 100%; overflow-x: hidden; }
	.ld * { box-sizing: border-box; }
	.ld-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; width: 100%; }
	.ld-section { padding: 72px 0; }
	.ld-bg-white { background: #fff; }
	.ld-section-head { text-align: center; margin-bottom: 40px; }
	.ld-section-head h2 { font-size: 28px; font-weight: 800; color: var(--ld-text); margin-bottom: 8px; }
	.ld-section-head p { font-size: 15px; color: var(--ld-muted); }
	.ld-hero { padding: 64px 0 72px; }
	.ld-hero-inner { display: flex; align-items: center; gap: 56px; }
	.ld-hero-text { flex: 1; min-width: 340px; animation: heroFadeIn 0.7s ease-out both; }
	.ld-badge { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, rgba(61,139,94,0.1), rgba(45,212,191,0.1)); color: var(--ld-sage); padding: 7px 18px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 20px; border: 1px solid rgba(61,139,94,0.15); }
	.ld-hero-text h1 { font-size: 44px; font-weight: 900; line-height: 1.2; color: var(--ld-text); margin-bottom: 16px; letter-spacing: -0.02em; }
	.ld-accent { background: linear-gradient(135deg, #3d8b5e, #2dd4bf); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
	.ld-hero-text p { font-size: 16px; color: var(--ld-muted); line-height: 1.7; margin-bottom: 28px; }
	.ld-hero-btns { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
	.ld-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 13px 26px; border-radius: 12px; font-size: 15px; font-weight: 700; text-decoration: none; background: linear-gradient(135deg, #1a4731, #245e3f); color: #fff; transition: all 0.2s; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(26,71,49,0.2); }
	.ld-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,71,49,0.3); }
	.ld-btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 13px 26px; border-radius: 12px; font-size: 15px; font-weight: 600; text-decoration: none; color: var(--ld-text); border: 1.5px solid var(--ld-border); background: #fff; transition: all 0.2s; cursor: pointer; }
	.ld-btn-outline:hover { border-color: var(--ld-sage); color: var(--ld-sage); transform: translateY(-1px); }
	.ld-hero-trust { font-size: 12px; color: var(--ld-muted); }
	.ld-hero-visual { flex: 1; min-width: 320px; display: flex; justify-content: center; position: relative; animation: heroFadeIn 0.7s 0.2s ease-out both; }
	.ld-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 380px; height: 380px; border-radius: 50%; background: radial-gradient(circle, rgba(61,139,94,0.12) 0%, rgba(45,212,191,0.06) 50%, transparent 70%); pointer-events: none; z-index: 0; }
	.ld-cards-stack { position: relative; width: 320px; height: 480px; z-index: 1; }
	.ld-doc-card { position: absolute; width: 280px; aspect-ratio: 1 / 1.414; border-radius: 14px; overflow: hidden; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(234,231,225,0.8); box-shadow: 0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.3s ease, box-shadow 0.3s ease; display: flex; flex-direction: column; }
	.ld-doc-card:hover { box-shadow: 0 16px 48px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.04); }
	.card-1 { top: 40px; left: 30px; z-index: 3; animation: cardFloat 4s ease-in-out infinite; }
	.card-2 { top: 10px; left: 60px; z-index: 2; transform: rotate(3deg); animation: cardFloat 4s 0.5s ease-in-out infinite; }
	.card-3 { top: 70px; left: 0; z-index: 1; transform: rotate(-3deg); animation: cardFloat 4s 1s ease-in-out infinite; }
	.ld-doc-card-bar { height: 4px; flex-shrink: 0; }
	.ld-doc-card-body { padding: 16px 18px; display: flex; flex-direction: column; flex: 1; }
	.ld-doc-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
	.ld-doc-card-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.ld-doc-card-type { font-size: 13px; font-weight: 700; color: var(--ld-text); }
	.ld-doc-card-status { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-size: 11px; font-weight: 600; color: #16a34a; background: rgba(22,163,74,0.08); padding: 3px 10px; border-radius: 12px; }
	.ld-doc-card-lines { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
	.ld-line { height: 8px; border-radius: 4px; background: var(--ld-light-bg); }
	.ld-line.w90 { width: 90%; } .ld-line.w85 { width: 85%; } .ld-line.w80 { width: 80%; }
	.ld-line.w75 { width: 75%; } .ld-line.w70 { width: 70%; } .ld-line.w65 { width: 65%; }
	.ld-line.w60 { width: 60%; } .ld-line.w55 { width: 55%; } .ld-line.w50 { width: 50%; }
	.ld-line.w45 { width: 45%; }
	.ld-doc-card-total { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px dashed var(--ld-border); font-size: 12px; color: var(--ld-muted); margin-top: auto; }
	.ld-total-val { font-size: 15px; font-weight: 800; color: var(--ld-text); }
	@keyframes heroFadeIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
	@keyframes cardFloat { 0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(-8px) rotate(var(--r, 0deg)); } }
	.card-1 { --r: 0deg; } .card-2 { --r: 3deg; } .card-3 { --r: -3deg; }
	.ld-stats { background: var(--ld-green); padding: 32px 0; }
	.ld-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: center; }
	.ld-stat-value { font-size: 32px; font-weight: 800; color: #fff; }
	.ld-stat-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 4px; }
	.ld-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
	.ld-step-card { background: #fff; border: 1px solid var(--ld-border); border-radius: 14px; padding: 28px 24px; transition: all 0.2s; }
	.ld-step-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.04); transform: translateY(-2px); }
	.ld-step-num { font-size: 32px; font-weight: 900; color: var(--ld-sage); opacity: 0.5; margin-bottom: 12px; }
	.ld-step-card h3 { font-size: 16px; font-weight: 700; color: var(--ld-text); margin-bottom: 6px; }
	.ld-step-card p { font-size: 13px; color: var(--ld-muted); line-height: 1.6; }
	.ld-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
	.ld-feature { padding: 24px; background: var(--ld-cream); border: 1px solid var(--ld-border); border-radius: 14px; transition: all 0.2s; }
	.ld-feature:hover { border-color: var(--ld-sage); box-shadow: 0 4px 16px rgba(0,0,0,0.03); }
	.ld-feature-icon { width: 44px; height: 44px; background: var(--ld-sage-soft); color: var(--ld-sage); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
	.ld-feature h3 { font-size: 15px; font-weight: 700; color: var(--ld-text); margin-bottom: 6px; }
	.ld-feature p { font-size: 13px; color: var(--ld-muted); line-height: 1.6; }
	.ld-doc-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
	.ld-chip { padding: 8px 20px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--chip-color); background: color-mix(in srgb, var(--chip-color) 8%, white); border: 1px solid color-mix(in srgb, var(--chip-color) 20%, white); transition: all 0.15s; }
	.ld-chip:hover { background: color-mix(in srgb, var(--chip-color) 15%, white); transform: translateY(-1px); }
	.ld-pricing-card { max-width: 600px; margin: 0 auto; background: var(--ld-cream); border: 1.5px solid var(--ld-border); border-radius: 16px; padding: 32px; }
	.ld-pricing-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--ld-border); flex-wrap: wrap; }
	.ld-pricing-name { font-size: 22px; font-weight: 800; color: var(--ld-text); margin-bottom: 4px; }
	.ld-pricing-desc { font-size: 13px; color: var(--ld-muted); }
	.ld-pricing-price { text-align: right; }
	.ld-price-amount { font-size: 40px; font-weight: 900; color: var(--ld-green); }
	.ld-price-period { font-size: 14px; color: var(--ld-muted); }
	.ld-pricing-features { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
	.ld-pricing-feat { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #374151; line-height: 1.4; }
	.ld-check { width: 20px; height: 20px; border-radius: 50%; background: var(--ld-sage-soft); color: var(--ld-sage); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.ld-cta { padding: 72px 0; }
	.ld-cta-box { text-align: center; padding: 56px 32px; background: var(--ld-green); border-radius: 20px; color: #fff; }
	.ld-cta-box h2 { font-size: 28px; font-weight: 800; margin-bottom: 10px; }
	.ld-cta-box p { font-size: 15px; opacity: 0.75; margin-bottom: 24px; }
	.ld-btn-cta-white { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; background: #fff; color: var(--ld-green); transition: all 0.15s; }
	.ld-btn-cta-white:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
	.ld-faq-list { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
	.ld-faq-item { width: 100%; text-align: left; background: #fff; border: 1px solid var(--ld-border); border-radius: 12px; padding: 0; cursor: pointer; transition: all 0.15s; font-family: inherit; font-size: inherit; }
	.ld-faq-item:hover { border-color: var(--ld-sage); }
	.ld-faq-item.open { border-color: var(--ld-sage); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
	.ld-faq-q { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; font-size: 15px; font-weight: 700; color: var(--ld-text); }
	.ld-faq-chevron { color: var(--ld-muted); transition: transform 0.2s; flex-shrink: 0; }
	.ld-faq-item.open .ld-faq-chevron { transform: rotate(180deg); }
	.ld-faq-a { padding: 0 20px 16px; font-size: 14px; color: var(--ld-muted); line-height: 1.7; }
	@media (max-width: 768px) {
		.ld-container { padding: 0 16px; }
		.ld-hero { padding: 32px 0 40px; }
		.ld-hero-inner { flex-direction: column; gap: 32px; text-align: center; }
		.ld-hero-text, .ld-hero-visual { min-width: 0; width: 100%; }
		.ld-hero-text h1 { font-size: 32px; }
		.ld-hero-btns { justify-content: center; }
		.ld-cards-stack { width: 280px; height: 420px; margin: 0 auto; }
		.ld-doc-card { width: 250px; }
		.card-1 { top: 30px; left: 20px; } .card-2 { top: 5px; left: 40px; transform: rotate(2deg); } .card-3 { top: 55px; left: 0; transform: rotate(-2deg); }
		.ld-glow { width: 260px; height: 260px; }
		.ld-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
		.ld-pricing-card { padding: 24px 20px; }
		.ld-pricing-features { grid-template-columns: 1fr; }
		.ld-pricing-top { flex-direction: column; align-items: center; text-align: center; }
		.ld-pricing-price { text-align: center; margin-top: 12px; }
	}
</style>
