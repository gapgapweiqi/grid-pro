<script lang="ts">
	import { page } from '$app/stores';
	import { FileText, Menu, X, LogOut } from 'lucide-svelte';
	import { isLoggedIn } from '$lib/stores/auth';
	import { logout } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || '';
	const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || 'https://grid-doc.com';

	let mobileOpen = $state(false);

	const navLinks = [
		{ href: `${MARKETING_URL}/#features`, label: 'ฟีเจอร์' },
		{ href: `${MARKETING_URL}/pricing`, label: 'ราคา' },
		{ href: `${MARKETING_URL}/download`, label: 'ดาวน์โหลด' },
	];
</script>

<header class="pub-header">
	<div class="pub-header-inner">
		<a href={MARKETING_URL} class="pub-logo">
			<div class="pub-logo-icon"><FileText size={18} /></div>
			<span>Grid Doc</span>
		</a>

		<nav class="pub-nav-desktop">
			{#each navLinks as link}
				<a href={link.href} class="pub-nav-link" class:active={$page.url.pathname === link.href}>{link.label}</a>
			{/each}
		</nav>

		<div class="pub-header-actions">
			{#if $isLoggedIn}
				<a href="{APP_ORIGIN}/dashboard" class="pub-btn-cta">แดชบอร์ด</a>
				<button class="pub-btn-logout" onclick={() => { logout(); window.location.href = MARKETING_URL; }}>ออกจากระบบ <LogOut size={14} /></button>
			{:else}
				<a href="{APP_ORIGIN}/login" class="pub-btn-login">เข้าสู่ระบบ</a>
				<a href="{APP_ORIGIN}/login" class="pub-btn-cta">เริ่มใช้งาน</a>
			{/if}
		</div>

		<button class="pub-mobile-toggle" onclick={() => mobileOpen = !mobileOpen}>
			{#if mobileOpen}
				<X size={22} />
			{:else}
				<Menu size={22} />
			{/if}
		</button>
	</div>

	{#if mobileOpen}
		<div class="pub-mobile-menu">
			{#each navLinks as link}
				<a href={link.href} class="pub-mobile-link" onclick={() => mobileOpen = false}>{link.label}</a>
			{/each}
			<div class="pub-mobile-actions">
				{#if $isLoggedIn}
					<a href="{APP_ORIGIN}/dashboard" class="pub-btn-cta" onclick={() => mobileOpen = false}>แดชบอร์ด</a>
					<button class="pub-btn-logout" onclick={() => { mobileOpen = false; logout(); window.location.href = MARKETING_URL; }}>ออกจากระบบ <LogOut size={14} /></button>
				{:else}
					<a href="{APP_ORIGIN}/login" class="pub-btn-login" onclick={() => mobileOpen = false}>เข้าสู่ระบบ</a>
					<a href="{APP_ORIGIN}/login" class="pub-btn-cta" onclick={() => mobileOpen = false}>เริ่มใช้งาน</a>
				{/if}
			</div>
		</div>
	{/if}
</header>

<style>
	.pub-header {
		position: sticky;
		top: 0;
		z-index: 100;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid #eae7e1;
	}
	.pub-header-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24px;
		height: 64px;
		display: flex;
		align-items: center;
		gap: 32px;
	}
	.pub-logo {
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
		font-size: 18px;
		font-weight: 800;
		color: #1a4731;
		letter-spacing: -0.3px;
	}
	.pub-logo-icon {
		width: 32px;
		height: 32px;
		background: #1a4731;
		color: #fff;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.pub-nav-desktop {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}
	.pub-nav-link {
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		color: #4b5563;
		padding: 6px 14px;
		border-radius: 8px;
		transition: all 0.15s;
	}
	.pub-nav-link:hover {
		color: #1a4731;
		background: rgba(26, 71, 49, 0.05);
	}
	.pub-nav-link.active {
		color: #1a4731;
		font-weight: 600;
	}
	.pub-header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pub-btn-login {
		text-decoration: none;
		font-size: 14px;
		font-weight: 600;
		color: #1a4731;
		padding: 8px 16px;
		border-radius: 8px;
		transition: all 0.15s;
	}
	.pub-btn-login:hover {
		background: rgba(26, 71, 49, 0.06);
	}
	.pub-btn-cta {
		text-decoration: none;
		font-size: 14px;
		font-weight: 600;
		color: #fff;
		background: #1a4731;
		padding: 8px 20px;
		border-radius: 8px;
		transition: all 0.15s;
	}
	.pub-btn-cta:hover {
		background: #153d2a;
	}
	.pub-btn-logout {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
		color: #b91c1c;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid rgba(185,28,28,0.2);
		background: rgba(185,28,28,0.04);
		cursor: pointer;
		transition: all 0.15s;
	}
	.pub-btn-logout:hover {
		background: rgba(185,28,28,0.1);
	}
	.pub-mobile-toggle {
		display: none;
		background: none;
		border: none;
		color: #1a4731;
		cursor: pointer;
		padding: 4px;
		margin-left: auto;
	}
	.pub-mobile-menu {
		display: none;
		flex-direction: column;
		padding: 8px 24px 16px;
		border-top: 1px solid #eae7e1;
	}
	.pub-mobile-link {
		text-decoration: none;
		font-size: 15px;
		font-weight: 500;
		color: #374151;
		padding: 12px 0;
		border-bottom: 1px solid #f3f0ec;
	}
	.pub-mobile-actions {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}
	.pub-mobile-actions .pub-btn-cta,
	.pub-mobile-actions .pub-btn-login {
		flex: 1;
		text-align: center;
	}

	@media (max-width: 768px) {
		.pub-nav-desktop, .pub-header-actions { display: none; }
		.pub-mobile-toggle { display: flex; }
		.pub-mobile-menu { display: flex; }
	}
</style>
