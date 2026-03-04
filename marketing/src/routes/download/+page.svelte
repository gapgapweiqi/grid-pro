<script lang="ts">
	import { Monitor, Smartphone, Globe, Download, ArrowRight } from 'lucide-svelte';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || '';

	const platforms = [
		{
			icon: Monitor,
			name: 'macOS',
			desc: 'สำหรับ Mac (Apple Silicon)',
			version: 'v0.1.0',
			size: '4.9 MB',
			btnLabel: 'ดาวน์โหลด .dmg',
			available: true,
			href: `${APP_ORIGIN}/api/downloads/Grid-Pro_0.1.0_aarch64.dmg`,
			external: true,
		},
		{
			icon: Monitor,
			name: 'Windows',
			desc: 'สำหรับ Windows 10/11 (64-bit)',
			version: 'v0.1.0',
			size: '~3 MB',
			btnLabel: 'ดาวน์โหลด .exe',
			available: true,
			href: `${APP_ORIGIN}/api/downloads/Grid-Pro_0.1.0_x64-setup.exe`,
			external: true,
		},
		{
			icon: Smartphone,
			name: 'มือถือ / แท็บเล็ต',
			desc: 'ติดตั้งเป็นแอปผ่าน Safari (iOS) หรือ Chrome (Android)',
			version: 'PWA',
			size: '-',
			btnLabel: 'วิธีติดตั้ง',
			available: true,
			href: '/install',
		},
		{
			icon: Globe,
			name: 'Web Browser',
			desc: 'Chrome, Safari, Edge, Firefox',
			version: 'Latest',
			size: '-',
			btnLabel: 'เปิดใช้งานเลย',
			available: true,
			href: `${APP_ORIGIN}/login`,
		},
	];
</script>

<svelte:head>
	<title>ดาวน์โหลด - Grid Doc</title>
	<meta name="description" content="ดาวน์โหลด Grid Doc สำหรับ Mac, Windows, มือถือ หรือใช้งานบน Web Browser" />
</svelte:head>

<div class="dl">
	<div class="dl-container">
		<div class="dl-header">
			<h1>ดาวน์โหลด Grid Doc</h1>
			<p>เลือกแพลตฟอร์มที่เหมาะกับคุณ ใช้งานได้ทุกอุปกรณ์</p>
		</div>

		<div class="dl-grid">
			{#each platforms as p}
				{@const Icon = p.icon}
				<div class="dl-card" class:coming-soon={!p.available}>
					<div class="dl-card-icon"><Icon size={28} /></div>
					<h3>{p.name}</h3>
					<p class="dl-card-desc">{p.desc}</p>
					<div class="dl-card-meta">
						<span>{p.version}</span>
						{#if p.size !== '-'}<span>&middot;</span><span>{p.size}</span>{/if}
					</div>
					{#if p.available && p.href && p.external}
						<a href={p.href} class="dl-btn" download><Download size={14} /> {p.btnLabel}</a>
					{:else if p.available && p.href}
						<a href={p.href} class="dl-btn">{p.btnLabel} <ArrowRight size={14} /></a>
					{:else}
						<button class="dl-btn disabled" disabled><Download size={14} /> เร็วๆ นี้</button>
						{#if p.note}<p class="dl-card-note">{p.note}</p>{/if}
					{/if}
				</div>
			{/each}
		</div>

		<div class="dl-note">
			<h3>ทำไมต้องดาวน์โหลด?</h3>
			<div class="dl-note-grid">
				<div class="dl-note-item"><strong>ใช้งานออฟไลน์</strong><span>ทำงานได้แม้ไม่มีอินเทอร์เน็ต ข้อมูลจะ sync เมื่อกลับมาออนไลน์</span></div>
				<div class="dl-note-item"><strong>เร็วกว่า</strong><span>แอปเปิดเร็วกว่า Browser ไม่ต้องเปิดแท็บเพิ่ม</span></div>
				<div class="dl-note-item"><strong>แจ้งเตือน</strong><span>รับการแจ้งเตือนบนเดสก์ท็อปเมื่อมีเอกสารใหม่</span></div>
			</div>
		</div>
	</div>
</div>

<style>
	.dl { --dl-green: #1a4731; --dl-sage: #3d8b5e; --dl-sage-soft: rgba(61,139,94,0.08); --dl-border: #eae7e1; --dl-text: #1a1a1a; --dl-muted: #6b7280; }
	.dl-container { max-width: 900px; margin: 0 auto; padding: 56px 24px 72px; }
	.dl-header { text-align: center; margin-bottom: 44px; }
	.dl-header h1 { font-size: 32px; font-weight: 800; color: var(--dl-text); margin-bottom: 8px; }
	.dl-header p { font-size: 15px; color: var(--dl-muted); }
	.dl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 56px; }
	.dl-card { background: #fff; border: 1px solid var(--dl-border); border-radius: 14px; padding: 28px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; transition: all 0.2s; }
	.dl-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.04); transform: translateY(-2px); }
	.dl-card.coming-soon { opacity: 0.7; }
	.dl-card-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; background: var(--dl-sage-soft); color: var(--dl-sage); }
	.dl-card h3 { font-size: 16px; font-weight: 700; color: var(--dl-text); margin-bottom: 4px; }
	.dl-card-desc { font-size: 12px; color: var(--dl-muted); line-height: 1.5; margin-bottom: 10px; }
	.dl-card-meta { font-size: 11px; color: #9ca3af; display: flex; gap: 6px; margin-bottom: 16px; }
	.dl-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; background: var(--dl-green); color: #fff; transition: all 0.15s; border: none; cursor: pointer; font-family: inherit; }
	.dl-btn:hover { background: #153d2a; }
	.dl-btn.disabled { background: #d1cdc6; color: #9ca3af; cursor: not-allowed; }
	.dl-note { background: #fff; border: 1px solid var(--dl-border); border-radius: 14px; padding: 28px; }
	.dl-note h3 { font-size: 18px; font-weight: 700; color: var(--dl-text); margin-bottom: 16px; text-align: center; }
	.dl-note-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
	.dl-note-item { text-align: center; }
	.dl-note-item strong { display: block; font-size: 14px; font-weight: 700; color: var(--dl-text); margin-bottom: 4px; }
	.dl-note-item span { font-size: 13px; color: var(--dl-muted); line-height: 1.5; }
	.dl-card-note { font-size: 11px; color: var(--dl-muted); margin-top: 8px; font-style: italic; line-height: 1.4; }
</style>
