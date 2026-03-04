<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import { FileText, Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, User } from 'lucide-svelte';
	import { authApi } from '$lib/services/api-adapter';
	import { persistAuth, restoreAuth } from '$lib/stores/auth';
	import { addToast } from '$lib/stores/app';
	import { exitSandbox, isSandbox } from '$lib/stores/sandbox';
	import { get } from 'svelte/store';

	const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
	const GOOGLE_SCOPES = 'openid email profile';
	const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_CHANNEL_ID || '';
	const _isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
	const APP_ORIGIN = _isLocalDev ? window.location.origin : (import.meta.env.VITE_APP_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : ''));

	// Hide back-to-landing button in Tauri / PWA standalone
	let showBackBtn = $state(true);
	function detectStandalone() {
		if (typeof window === 'undefined') return;
		const standalone = window.matchMedia('(display-mode: standalone)').matches
			|| ('standalone' in navigator && (navigator as any).standalone === true);
		const inTauri = '__TAURI_INTERNALS__' in window
			|| window.location.protocol === 'tauri:'
			|| window.location.hostname === 'tauri.localhost'
			|| navigator.userAgent.includes('Tauri');
		if (standalone || inTauri) showBackBtn = false;
	}

	function getPostLoginRedirect(): string {
		// Check for pending invite token (from /invite/[token] page)
		const pendingInvite = sessionStorage.getItem('pendingInviteToken');
		if (pendingInvite) {
			sessionStorage.removeItem('pendingInviteToken');
			return `/invite/${pendingInvite}`;
		}
		const params = new URLSearchParams(window.location.search);
		const redirect = params.get('redirect');
		if (redirect === 'checkout') return '/pricing';
		return '/dashboard';
	}

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let isLogin = $state(true);
	let loading = $state(false);
	let errorMsg = $state('');
	let showPassword = $state(false);

	// Typewriter
	const quotes = [
		'จัดการเอกสารธุรกิจอย่างมืออาชีพ',
		'ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จรับเงิน',
		'ออกเอกสารง่าย ส่งไว ปลอดภัย',
		'ระบบจัดการเอกสารครบวงจร',
	];
	let twText = $state('');
	let twIdx = $state(0);
	let twCharIdx = $state(0);
	let twDeleting = $state(false);

	onMount(() => {
		detectStandalone();
		if (get(isSandbox)) exitSandbox();
		if (restoreAuth()) { goto(getPostLoginRedirect()); return; }
		lineAuthUrl = buildLineAuthUrl();

		const url = new URL(window.location.href);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		if (code && state === 'line_login') {
			handleLineCallback(code);
		} else if (code) {
			handleGoogleCallback(code);
		}

		// Start typewriter
		const tick = () => {
			const current = quotes[twIdx];
			if (!twDeleting) {
				twText = current.slice(0, twCharIdx + 1);
				twCharIdx++;
				if (twCharIdx >= current.length) {
					setTimeout(() => { twDeleting = true; tick(); }, 2000);
					return;
				}
				setTimeout(tick, 60);
			} else {
				twText = current.slice(0, twCharIdx);
				twCharIdx--;
				if (twCharIdx < 0) {
					twDeleting = false;
					twIdx = (twIdx + 1) % quotes.length;
					twCharIdx = 0;
					setTimeout(tick, 400);
					return;
				}
				setTimeout(tick, 30);
			}
		};
		tick();
	});

	async function handleGoogleCallback(code: string) {
		loading = true; errorMsg = '';
		try {
			const redirectUri = `${APP_ORIGIN}/login`;
			const res = await authApi.loginGoogle(code, redirectUri);
			if (res.ok && res.data) {
				persistAuth(res.data.user as any, res.data.token as string);
				addToast('เข้าสู่ระบบสำเร็จ', 'success');
				const pendingRedirect = sessionStorage.getItem('postLoginRedirect');
				sessionStorage.removeItem('postLoginRedirect');
				goto(pendingRedirect || '/dashboard');
			} else {
				errorMsg = res.error?.message || 'Google login failed';
			}
		} catch (e: any) { errorMsg = e.message || 'เกิดข้อผิดพลาด'; }
		finally { loading = false; replaceState('/login', {}); }
	}

	async function handleSubmit() {
		if (!email.trim()) return;
		loading = true; errorMsg = '';
		console.log('[login] handleSubmit start, isLogin:', isLogin);
		try {
			const dest = getPostLoginRedirect();
			if (isLogin) {
				console.log('[login] calling authApi.login...');
				const res = await authApi.login(email, password);
				console.log('[login] authApi.login response:', JSON.stringify(res).slice(0, 200));
				if (res.ok && res.data) {
					persistAuth(res.data.user as any, res.data.token as string);
					addToast('เข้าสู่ระบบสำเร็จ', 'success'); goto(dest);
				} else { errorMsg = res.error?.message || 'เข้าสู่ระบบไม่สำเร็จ'; }
			} else {
				console.log('[login] calling authApi.register...');
				const res = await authApi.register(email, password, name);
				console.log('[login] authApi.register response:', JSON.stringify(res).slice(0, 200));
				if (res.ok && res.data) {
					persistAuth(res.data.user as any, res.data.token as string);
					addToast('สร้างบัญชีสำเร็จ', 'success'); goto(dest);
				} else { errorMsg = res.error?.message || 'สมัครไม่สำเร็จ'; }
			}
		} catch (e: any) { console.error('[login] error:', e); errorMsg = e.message || 'เกิดข้อผิดพลาด'; }
		finally { console.log('[login] finally, loading=false'); loading = false; }
	}

	function handleGoogleLogin() {
		if (!GOOGLE_CLIENT_ID) {
			addToast('Google Client ID ยังไม่ได้ตั้งค่า — เข้าแบบ demo', 'info');
			goto(getPostLoginRedirect()); return;
		}
		const pendingDest = getPostLoginRedirect();
		if (pendingDest !== '/') sessionStorage.setItem('postLoginRedirect', pendingDest);
		const redirectUri = `${APP_ORIGIN}/login`;
		const params = new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri,
			response_type: 'code', scope: GOOGLE_SCOPES,
			access_type: 'offline', prompt: 'consent',
		});
		window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
	}

	async function handleLineCallback(code: string) {
		loading = true; errorMsg = '';
		try {
			const redirectUri = `${APP_ORIGIN}/login`;
			const res = await authApi.loginLine(code, redirectUri);
			if (res.ok && res.data) {
				persistAuth(res.data.user as any, res.data.token as string);
				addToast('เข้าสู่ระบบสำเร็จ', 'success');
				const pendingRedirect = sessionStorage.getItem('postLoginRedirect');
				sessionStorage.removeItem('postLoginRedirect');
				goto(pendingRedirect || '/dashboard');
			} else {
				errorMsg = res.error?.message || 'LINE login failed';
			}
		} catch (e: any) { errorMsg = e.message || 'เกิดข้อผิดพลาด'; }
		finally { loading = false; replaceState('/login', {}); }
	}

	// Build LINE auth URL as a direct link (not JS redirect)
	// iOS Universal Links require user to tap <a href> directly — JS redirect breaks auto-login
	let lineAuthUrl = $state('');
	function buildLineAuthUrl() {
		if (!LINE_CHANNEL_ID) return '';
		const redirectUri = `${APP_ORIGIN}/login`;
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: LINE_CHANNEL_ID,
			redirect_uri: redirectUri,
			state: 'line_login',
			scope: 'profile openid email',
		});
		return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
	}

	function handleLineClick() {
		const pendingDest = getPostLoginRedirect();
		if (pendingDest !== '/') sessionStorage.setItem('postLoginRedirect', pendingDest);
		// Navigation happens via <a href> — no JS redirect needed
	}
</script>

<div class="auth-split">
	<!-- Back button (hidden in Tauri / PWA standalone) -->
	{#if showBackBtn}
		<a href="https://grid-doc.com" class="auth-back-btn">
			<ArrowLeft size={18} />
			<span>กลับ</span>
		</a>
	{/if}

	<!-- Left Panel — Form -->
	<div class="auth-left">
		<div class="auth-form-wrap">
			<div class="auth-logo">
				<div class="auth-logo-icon"><FileText size={22} /></div>
				<span class="auth-logo-text">Grid Doc</span>
			</div>

			<h1 class="auth-title">{isLogin ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}</h1>
			<p class="auth-subtitle">{isLogin ? 'ยินดีต้อนรับกลับมา เข้าสู่ระบบเพื่อจัดการเอกสาร' : 'สมัครสมาชิกฟรี เริ่มต้นใช้งานได้ทันที'}</p>

			<!-- Social buttons -->
			<div class="auth-social">
				<button class="auth-social-btn" onclick={handleGoogleLogin} disabled={loading}>
					<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
					{isLogin ? 'เข้าสู่ระบบด้วย Google' : 'สมัครด้วย Google'}
				</button>
				{#if lineAuthUrl}
					<a href={lineAuthUrl} class="auth-social-btn auth-line-btn" onclick={handleLineClick}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
						{isLogin ? 'เข้าสู่ระบบด้วย LINE' : 'สมัครด้วย LINE'}
					</a>
				{:else}
					<button class="auth-social-btn auth-line-btn" disabled>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
						LINE Login ยังไม่เปิดใช้งาน
					</button>
				{/if}
			</div>

			<div class="auth-divider"><span>หรือใช้อีเมล</span></div>

			{#if errorMsg}
				<div class="auth-error">{errorMsg}</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				{#if !isLogin}
					<div class="auth-field">
						<label class="auth-label" for="authName">ชื่อ</label>
						<div class="auth-input-wrap">
							<User size={16} />
							<input id="authName" type="text" placeholder="ชื่อที่แสดง" bind:value={name} />
						</div>
					</div>
				{/if}
				<div class="auth-field">
					<label class="auth-label" for="authEmail">อีเมล</label>
					<div class="auth-input-wrap">
						<Mail size={16} />
						<input id="authEmail" type="email" placeholder="you@example.com" bind:value={email} required />
					</div>
				</div>
				<div class="auth-field">
					<div style="display: flex; justify-content: space-between; align-items: center;">
						<label class="auth-label" for="authPw">รหัสผ่าน</label>
						{#if isLogin}
							<a href="/forgot-password" class="auth-forgot">ลืมรหัสผ่าน?</a>
						{/if}
					</div>
					<div class="auth-input-wrap">
						<Lock size={16} />
						{#if showPassword}
							<input id="authPw" type="text" placeholder="••••••••" bind:value={password} required />
						{:else}
							<input id="authPw" type="password" placeholder="••••••••" bind:value={password} required />
						{/if}
						<button type="button" class="auth-eye" onclick={() => showPassword = !showPassword}>
							{#if showPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
						</button>
					</div>
				</div>

				<button type="submit" class="auth-submit" disabled={loading}>
					{#if loading}
						<span class="auth-spinner"></span> กำลังดำเนินการ...
					{:else}
						{isLogin ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'} <ArrowRight size={16} />
					{/if}
				</button>
			</form>

			<div class="auth-toggle">
				{#if isLogin}
					ยังไม่มีบัญชี? <button type="button" class="auth-link" onclick={() => { isLogin = false; errorMsg = ''; }}>สร้างบัญชีใหม่</button>
				{:else}
					มีบัญชีอยู่แล้ว? <button type="button" class="auth-link" onclick={() => { isLogin = true; errorMsg = ''; }}>เข้าสู่ระบบ</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Right Panel — Hero -->
	<div class="auth-right">
		<div class="auth-hero">
			<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&q=80" alt="Business documents" class="auth-hero-img" />
			<div class="auth-hero-overlay"></div>
			<div class="auth-hero-content">
				<div class="auth-hero-badge">Grid Doc</div>
				<h2 class="auth-hero-title">ระบบจัดการเอกสารธุรกิจ<br/>ครบวงจร</h2>
				<div class="auth-typewriter">
					<span>{twText}</span><span class="auth-cursor">|</span>
				</div>
				<div class="auth-hero-features">
					<div class="auth-feature-item">
						<div class="auth-feature-dot"></div>
						<span>ออกเอกสารได้ทุกประเภท</span>
					</div>
					<div class="auth-feature-item">
						<div class="auth-feature-dot"></div>
						<span>เก็บข้อมูลปลอดภัยบน Cloud</span>
					</div>
					<div class="auth-feature-item">
						<div class="auth-feature-dot"></div>
						<span>ใช้งานได้ทุกอุปกรณ์</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.auth-split {
		display: flex; min-height: 100vh; overflow: hidden;
	}

	/* ===== Left Panel ===== */
	.auth-left {
		flex: 1; display: flex; align-items: center; justify-content: center;
		padding: 40px 32px; background: #fff;
	}
	.auth-form-wrap { width: 100%; max-width: 400px; }

	.auth-logo {
		display: flex; align-items: center; gap: 10px; margin-bottom: 32px;
	}
	.auth-logo-icon {
		width: 40px; height: 40px; background: #1a4731; color: #fff;
		border-radius: 10px; display: flex; align-items: center; justify-content: center;
	}
	.auth-logo-text { font-size: 18px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.3px; }

	.auth-title { font-size: 26px; font-weight: 800; color: #0a0a0a; margin-bottom: 6px; }
	.auth-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 28px; }

	/* Social */
	.auth-social { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
	.auth-social-btn {
		display: flex; align-items: center; justify-content: center; gap: 10px;
		padding: 11px 16px; border-radius: 10px; font-size: 14px; font-weight: 600;
		cursor: pointer; transition: all 0.15s; border: 1px solid #e5e7eb;
		background: #fff; color: #374151; font-family: inherit; text-decoration: none;
	}
	.auth-social-btn:hover { border-color: #d1d5db; background: #f9fafb; }
	.auth-line-btn { background: #06C755; color: #fff; border-color: #06C755; }
	.auth-line-btn:hover { background: #05b34d; border-color: #05b34d; }

	.auth-divider { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
	.auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
	.auth-divider span { font-size: 12px; color: #9ca3af; white-space: nowrap; }

	/* Error */
	.auth-error {
		background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
		padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #dc2626;
	}

	/* Fields */
	.auth-field { margin-bottom: 14px; }
	.auth-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
	.auth-forgot { font-size: 12px; color: #3d8b5e; font-weight: 600; text-decoration: none; }
	.auth-forgot:hover { text-decoration: underline; }
	.auth-input-wrap { position: relative; display: flex; align-items: center; }
	.auth-input-wrap :global(svg:first-child) { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
	.auth-input-wrap input {
		width: 100%; padding: 11px 44px 11px 40px; border: 1px solid #e5e7eb;
		border-radius: 10px; font-size: 14px; transition: all 0.15s; outline: none;
		background: #f9fafb; font-family: inherit;
	}
	.auth-input-wrap input:focus { border-color: #3d8b5e; box-shadow: 0 0 0 3px rgba(61,139,94,0.08); background: #fff; }
	.auth-back-btn {
		position: absolute; top: 20px; left: 20px; z-index: 10;
		display: inline-flex; align-items: center; gap: 6px;
		padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
		color: #374151; background: rgba(255,255,255,0.9); backdrop-filter: blur(4px);
		text-decoration: none; border: 1px solid #e5e7eb; transition: all 0.15s;
	}
	.auth-back-btn:hover { background: #fff; border-color: #d1d5db; color: #1a4731; }

	.auth-eye {
		position: absolute; right: 12px; background: none; border: none;
		color: #9ca3af; cursor: pointer; padding: 4px; display: flex; z-index: 2;
	}
	.auth-eye:hover { color: #6b7280; }

	/* Submit */
	.auth-submit {
		width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
		padding: 12px; border-radius: 10px; background: #1a4731; color: #fff;
		font-size: 15px; font-weight: 700; border: none; cursor: pointer; transition: all 0.15s;
		font-family: inherit; margin-top: 4px;
	}
	.auth-submit:hover:not(:disabled) { background: #153d2a; }
	.auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }
	.auth-spinner {
		width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
		border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Toggle */
	.auth-link { background: none; border: none; color: #3d8b5e; font-weight: 600; cursor: pointer; padding: 0; font-size: inherit; font-family: inherit; }
	.auth-link:hover { text-decoration: underline; }
	.auth-toggle { text-align: center; margin-top: 24px; font-size: 13px; color: #6b7280; }

	/* ===== Right Panel ===== */
	.auth-right {
		flex: 1; display: none; position: relative; overflow: hidden;
	}
	.auth-hero { position: relative; width: 100%; height: 100%; }
	.auth-hero-img {
		width: 100%; height: 100%; object-fit: cover;
	}
	.auth-hero-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(135deg, rgba(10,40,25,0.85) 0%, rgba(15,25,15,0.7) 100%);
	}
	.auth-hero-content {
		position: absolute; inset: 0; display: flex; flex-direction: column;
		justify-content: center; padding: 60px 48px; color: #fff;
	}
	.auth-hero-badge {
		display: inline-flex; align-items: center; gap: 6px;
		padding: 6px 14px; background: rgba(255,255,255,0.12); border-radius: 20px;
		font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
		margin-bottom: 24px; width: fit-content; backdrop-filter: blur(4px);
	}
	.auth-hero-title {
		font-size: 32px; font-weight: 800; line-height: 1.3; margin-bottom: 20px;
		text-shadow: 0 2px 8px rgba(0,0,0,0.3);
	}
	.auth-typewriter {
		font-size: 18px; color: rgba(255,255,255,0.8); margin-bottom: 32px;
		min-height: 28px;
	}
	.auth-cursor { animation: blink 0.8s step-end infinite; font-weight: 300; }
	@keyframes blink { 50% { opacity: 0; } }

	.auth-hero-features { display: flex; flex-direction: column; gap: 14px; }
	.auth-feature-item { display: flex; align-items: center; gap: 12px; font-size: 14px; color: rgba(255,255,255,0.85); }
	.auth-feature-dot {
		width: 8px; height: 8px; border-radius: 50%; background: #4ade80; flex-shrink: 0;
	}

	/* Responsive */
	@media (min-width: 1024px) {
		.auth-right { display: block; }
	}
	@media (max-width: 1023px) {
		.auth-left { min-height: 100vh; }
	}
</style>
