<script lang="ts">
	import { PRO_PLAN, FAQ_ITEMS } from '$lib/config/pricing';
	import { Check, ArrowRight, ChevronDown, ChevronUp } from 'lucide-svelte';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || '';

	let openFaqIndex: number | null = $state(null);
	function toggleFaq(i: number) { openFaqIndex = openFaqIndex === i ? null : i; }
</script>

<svelte:head>
	<title>ราคา - Grid Doc</title>
	<meta name="description" content="Grid Doc ราคาเดียว ฿790 ตลอดชีพ ครบทุกฟีเจอร์ ไม่มีรายเดือน" />
</svelte:head>

<div class="pr">
	<div class="pr-container">
		<div class="pr-header">
			<h1>ราคาเดียว ครบทุกฟีเจอร์</h1>
			<p>จ่ายครั้งเดียว ใช้งานได้ตลอดชีพ ไม่มีรายเดือน</p>
		</div>

		<div class="pr-card">
			<div class="pr-card-top">
				<div>
					<div class="pr-plan-name">{PRO_PLAN.nameTh}</div>
					<div class="pr-plan-desc">{PRO_PLAN.description}</div>
				</div>
				<div class="pr-price">
					<span class="pr-price-amt">฿{PRO_PLAN.price.toLocaleString()}</span>
					<span class="pr-price-per">ตลอดชีพ</span>
				</div>
			</div>
			<div class="pr-features">
				{#each PRO_PLAN.features as feat}
					<div class="pr-feat"><span class="pr-check"><Check size={14} /></span>{feat}</div>
				{/each}
			</div>
			<a href="{APP_ORIGIN}/login?redirect=checkout" class="pr-cta-btn">สมัครสมาชิก <ArrowRight size={16} /></a>
			<div class="pr-cta-note">เข้าสู่ระบบหรือสร้างบัญชีเพื่อเริ่มใช้งาน</div>
		</div>

		<div class="pr-faq">
			<h2>คำถามที่พบบ่อย</h2>
			<div class="pr-faq-list">
				{#each FAQ_ITEMS as item, i}
					<button class="pr-faq-item" class:open={openFaqIndex === i} onclick={() => toggleFaq(i)}>
						<div class="pr-faq-q">
							<span>{item.q}</span>
							{#if openFaqIndex === i}<ChevronUp size={18} />{:else}<ChevronDown size={18} />{/if}
						</div>
						{#if openFaqIndex === i}<div class="pr-faq-a">{item.a}</div>{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.pr { --pr-green: #1a4731; --pr-sage: #3d8b5e; --pr-sage-soft: rgba(61,139,94,0.08); --pr-border: #eae7e1; --pr-text: #1a1a1a; --pr-muted: #6b7280; }
	.pr-container { max-width: 720px; margin: 0 auto; padding: 56px 24px 72px; }
	.pr-header { text-align: center; margin-bottom: 40px; }
	.pr-header h1 { font-size: 32px; font-weight: 800; color: var(--pr-text); margin-bottom: 8px; }
	.pr-header p { font-size: 15px; color: var(--pr-muted); }
	.pr-card { background: #fff; border: 1.5px solid var(--pr-border); border-radius: 16px; padding: 32px; margin-bottom: 56px; }
	.pr-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--pr-border); flex-wrap: wrap; }
	.pr-plan-name { font-size: 24px; font-weight: 800; color: var(--pr-text); margin-bottom: 4px; }
	.pr-plan-desc { font-size: 14px; color: var(--pr-muted); }
	.pr-price { text-align: right; }
	.pr-price-amt { font-size: 44px; font-weight: 900; color: var(--pr-green); }
	.pr-price-per { font-size: 15px; color: var(--pr-muted); }
	.pr-features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
	.pr-feat { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: #374151; line-height: 1.4; }
	.pr-check { width: 22px; height: 22px; border-radius: 50%; background: var(--pr-sage-soft); color: var(--pr-sage); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.pr-cta-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none; background: var(--pr-green); color: #fff; transition: all 0.15s; border: none; cursor: pointer; }
	.pr-cta-btn:hover { background: #153d2a; }
	.pr-cta-note { text-align: center; font-size: 12px; color: var(--pr-muted); margin-top: 10px; }
	.pr-faq { max-width: 600px; margin: 0 auto; }
	.pr-faq h2 { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 24px; color: var(--pr-text); }
	.pr-faq-list { display: flex; flex-direction: column; gap: 8px; }
	.pr-faq-item { width: 100%; text-align: left; background: #fff; border: 1px solid var(--pr-border); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.15s; font-family: inherit; font-size: inherit; padding: 0; }
	.pr-faq-item:hover { border-color: #d1cdc6; }
	.pr-faq-item.open { border-color: var(--pr-sage); }
	.pr-faq-q { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; font-size: 14px; font-weight: 600; color: var(--pr-text); }
	.pr-faq-a { padding: 0 16px 14px; font-size: 13px; color: var(--pr-muted); line-height: 1.6; }
	@media (max-width: 640px) { .pr-features { grid-template-columns: 1fr; } .pr-card-top { flex-direction: column; } }
</style>
