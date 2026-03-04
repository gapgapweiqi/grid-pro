<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Topbar from '$lib/components/layout/Topbar.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import MobileMenu from '$lib/components/layout/MobileMenu.svelte';
	import { companies, currentCompanyId, applyTheme, applyFont, isOwner, teamPermissions, teamPermissionsMap, activeTeamPermissions, canAccessPage, getFirstPermittedPath } from '$lib/stores/app';
	import { api, setAdapter } from '$lib/services/api';
	import { cachingAdapter, onCacheUpdate, flushMutationQueue } from '$lib/services/caching-adapter';
	import { isTauri } from '$lib/utils/platform';
	import { get } from 'svelte/store';
	import { restoreAuth, currentUser, persistAuth } from '$lib/stores/auth';
	import { bootstrapApi } from '$lib/services/api-adapter';
	import { isSandbox, restoreSandbox, initSandbox } from '$lib/stores/sandbox';
	import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';
	import DriveConnectModal from '$lib/components/DriveConnectModal.svelte';
	import PaymentRequiredOverlay from '$lib/components/PaymentRequiredOverlay.svelte';
	import UpgradeDialog from '$lib/components/UpgradeDialog.svelte';
	import { startSyncPoller, stopSyncPoller, updateSyncCompany } from '$lib/services/sync-poller';
	import { showDriveConnectModal } from '$lib/stores/app';
	import { page } from '$app/stores';
	import { initPwaInstall } from '$lib/stores/pwa-install';
	import { initSyncManager } from '$lib/services/sync-manager';
	import OfflineBar from '$lib/components/OfflineBar.svelte';
	import UpdateToast from '$lib/components/UpdateToast.svelte';
	import TauriTitleBar from '$lib/components/TauriTitleBar.svelte';

	let { children } = $props();
	let ready = $state(false);
	let showBillingOverlay = $state(false);
	let companyUnsub: (() => void) | null = null;


	onDestroy(() => {
		stopSyncPoller();
		companyUnsub?.();
	});

	onMount(async () => {
		// Re-enable right-click context menu in Tauri (WebView disables it by default)
		if (isTauri()) {
			document.addEventListener('contextmenu', (e) => {
				e.stopImmediatePropagation();
			}, true);
		}

		// Initialize PWA install listeners (shared store for install prompt)
		initPwaInstall();
		// Initialize offline sync manager (online/offline detection + sync queue flush)
		initSyncManager();

		// Restore auth from localStorage FIRST
		const hasAuth = restoreAuth();

		// Check if user has a REAL auth token (not mock)
		const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth.token') : null;
		const hasRealAuth = hasAuth && !!storedToken && storedToken !== 'mock-jwt-token';

		// Detect if user is visiting /sandbox directly
		const isSandboxPath = typeof window !== 'undefined' && window.location.pathname === '/sandbox';

		// Restore sandbox flag from sessionStorage
		let sandboxRestored = restoreSandbox();

		// If real user is NOT on /sandbox path but has stale sandbox session → clear it
		if (hasRealAuth && sandboxRestored && !isSandboxPath) {
			isSandbox.set(false);
			if (typeof window !== 'undefined') sessionStorage.removeItem('sandbox');
			sandboxRestored = false;
		}

		if (!hasAuth && !sandboxRestored && !isSandboxPath) {
			// No auth token and not sandbox → redirect appropriately
			const { isTauri, isPwaStandalone } = await import('$lib/utils/platform');
			const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
			if (isTauri() || isPwaStandalone() || isLocalDev) {
				goto('/login');
			} else {
				window.location.href = 'https://grid-doc.com';
			}
			return;
		}

		// If visiting /sandbox directly → enter sandbox mode
		// initSandbox() safely stashes real auth before overwriting with mock
		if (isSandboxPath && !sandboxRestored) {
			initSandbox();
			sandboxRestored = true;
		}

		// Sandbox mode: use memory adapter with mock data, skip real API
		if (sandboxRestored || get(isSandbox)) {
			// Ensure mock auth is set (for non-logged-in users or sandbox restore)
			if (!get(isSandbox)) initSandbox();
			const result = await api.bootstrap();
			if (result.ok) {
				companies.set(result.data.companies);
				if (result.data.companies.length > 0) {
					currentCompanyId.set(result.data.companies[0].entityId);
				}
			}
			if (typeof window !== 'undefined') {
				const savedTheme = localStorage.getItem('ui.theme') || 'blue';
				const savedFont = localStorage.getItem('ui.font') || 'sarabun';
				applyTheme(savedTheme);
				applyFont(savedFont);
			}
			ready = true;
			return;
		}

		// Try real API bootstrap — switch to caching adapter for persistent storage
		const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') : null;
		if (token && token !== 'mock-jwt-token') {
			// Switch to caching adapter: IndexedDB cache + D1 remote (stale-while-revalidate)
			setAdapter(cachingAdapter);

			// Flush any queued offline mutations
			flushMutationQueue().catch(() => {});

			// Single bootstrap call returns companies + settings + user profile
			const res = await bootstrapApi.user();
			if (res.ok && res.data) {
				const d = res.data as any;
				const comps = d.companies || [];
				companies.set(comps);
				if (comps.length > 0) {
					// Restore previously selected company if still valid
					const savedCompId = localStorage.getItem('currentCompanyId');
					const validSaved = savedCompId && (savedCompId === '__all__' || comps.some((c: any) => c.entityId === savedCompId));
					const compId = validSaved ? savedCompId : comps[0].entityId;
					currentCompanyId.set(compId);
					localStorage.setItem('currentCompanyId', compId);
				}
				// User profile included in bootstrap — no separate auth/me call needed
				if (d.user) {
					const updatedUser = {
						...get(currentUser),
						...d.user,
						isAdmin: !!d.user.isAdmin,
						billingStatus: d.user.billingStatus || 'UNPAID',
						isOwner: !!d.user.isOwner,
						hasTeamAccess: !!d.user.hasTeamAccess,
						teamPermissions: d.user.teamPermissions || [],
						teamCompanyIds: d.user.teamCompanyIds || [],
					};
					persistAuth(updatedUser, token);
					// Set team access stores
					isOwner.set(!!d.user.isOwner);
					teamPermissions.set(d.user.teamPermissions || []);
					teamPermissionsMap.set(d.user.teamPermissionsMap || {});
				}
			} else {
				// Bootstrap failed — distinguish 401 (expired token) vs network error
				const httpStatus = (res as any)._httpStatus;
				const errorCode = res.error?.code || '';
				const isUnauthorized = httpStatus === 401 || errorCode === 'UNAUTHORIZED';
				const isNetworkError = errorCode === 'NETWORK_ERROR' || errorCode === 'TIMEOUT';

				if (isUnauthorized) {
					// Token expired/invalid → clear auth and redirect to login
					console.log('[auth] Token rejected by server (401), redirecting to login');
					localStorage.removeItem('auth.token');
					localStorage.removeItem('auth.user');
					goto('/login');
					return;
				}

				// Network error / timeout → keep tokens, try IndexedDB offline fallback
				console.log('[offline] Bootstrap failed:', errorCode, '— trying IndexedDB fallback');
				let offlineFallbackOk = false;
				try {
					const { db } = await import('$lib/db/local');
					const cachedCompanies = await db.master
						.where('entityType').equals('COMPANY')
						.filter((e: any) => !e.isDeleted)
						.toArray();
					if (cachedCompanies.length > 0) {
						companies.set(cachedCompanies as any);
						const savedCompId = localStorage.getItem('currentCompanyId');
						const validSaved = savedCompId && (savedCompId === '__all__' || cachedCompanies.some((c: any) => c.entityId === savedCompId));
						const compId = validSaved ? savedCompId : (cachedCompanies[0] as any).entityId;
						currentCompanyId.set(compId);
						offlineFallbackOk = true;
						console.log('[offline] Loaded', cachedCompanies.length, 'companies from IndexedDB cache');
					}
				} catch {}

				if (!offlineFallbackOk) {
					// No cached data AND network error → redirect to login but keep tokens
					// (user can retry when network is back, restoreAuth will restore session)
					console.log('[offline] No cached data available, redirecting to login');
					goto('/login');
					return;
				}
			}

			// Billing gating: show overlay only if user is UNPAID, not admin, AND not a team member of paid owner
			const user = get(currentUser);
			if (user && !user.isAdmin && user.billingStatus !== 'PAID') {
				showBillingOverlay = true;
			}
		}

		// Load mock data as fallback for demo/dev mode
		const currentComps = get(companies) ?? [];
		if (!currentComps || currentComps.length === 0) {
			const result = await api.bootstrap();
			if (result.ok) {
				companies.set(result.data.companies);
				if (result.data.companies.length > 0) {
					currentCompanyId.set(result.data.companies[0].entityId);
				}
			}
		}

		if (typeof window !== 'undefined') {
			const savedTheme = localStorage.getItem('ui.theme') || 'blue';
			const savedFont = localStorage.getItem('ui.font') || 'sarabun';
			applyTheme(savedTheme);
			applyFont(savedFont);
		} else {
			applyTheme('blue');
			applyFont('sarabun');
		}
		// Start sync poller for multi-device consistency (only for real users)
		const compId = get(currentCompanyId);
		if (token && token !== 'mock-jwt-token' && compId) {
			startSyncPoller(compId);
		}

		// Listen for company switches to update sync poller
		companyUnsub = currentCompanyId.subscribe((id) => {
			if (id) updateSyncCompany(id);
		});

		// SW update notifications are handled by UpdateToast component (non-aggressive)

		ready = true;
	});


	// Page guard: redirect non-owner team members from unauthorized pages
	// Also blocks admin-only pages for non-admin users
	$effect(() => {
		if (!ready) return;
		const path = $page.url.pathname;
		const ownerVal = get(isOwner);
		const user = get(currentUser);

		// Admin-only pages: block non-admin users (including owners who aren't admins)
		if (path.startsWith('/admin') && (!user || !user.isAdmin)) {
			goto('/dashboard');
			return;
		}

		// Team member permission guard (non-owner, non-admin team members)
		if (user && !ownerVal && user.hasTeamAccess && !user.isAdmin) {
			const perms = get(activeTeamPermissions);
			if (!canAccessPage(path, false, perms)) {
				// Redirect to first permitted page instead of always /dashboard
				const target = getFirstPermittedPath(perms);
				if (path !== target) {
					goto(target);
				}
			}
		}
	});
</script>

<TauriTitleBar />
<div class="app-shell">
	<Sidebar />
	<div class="main-content">
		<Topbar />
		<main class="content-area">
			{#if ready}
				{@render children()}
			{/if}
		</main>
	</div>
	<BottomNav />
	<MobileMenu />
	<InstallPrompt />
	{#if showBillingOverlay}
		<PaymentRequiredOverlay />
	{/if}
	<DriveConnectModal
		open={$showDriveConnectModal}
		onConnect={() => {
			showDriveConnectModal.set(false);
			// Directly trigger Google OAuth flow for Drive access
			const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
			const origin = import.meta.env.VITE_APP_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
			if (clientId) {
				const redirectUri = `${origin}/account`;
				const scope = 'https://www.googleapis.com/auth/drive.file';
				const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=drive_connect`;
				window.location.href = url;
			} else {
				goto('/account');
			}
		}}
		onSkip={() => showDriveConnectModal.set(false)}
	/>
	<UpgradeDialog />
	<OfflineBar />
	<UpdateToast />
</div>
