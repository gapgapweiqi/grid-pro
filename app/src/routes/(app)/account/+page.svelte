<script lang="ts">
	import { onMount } from 'svelte';
	import { addToast, currentCompany, currentCompanyId, companies, showDriveConnectModal, isOwner } from '$lib/stores/app';
	import { User, Users, Shield, Mail, Lock, LogOut, Trash2, Copy, Plus, UserPlus, Link2, Crown, Clock, Check, CheckCircle, XCircle, AlertTriangle, DoorOpen, Bell, Save, X, Layout, FileText } from 'lucide-svelte';
	import { isPushSupported, isSubscribed, subscribePush, unsubscribePush, getPermissionStatus, testPush } from '$lib/services/push';
	import { currentUser, MOCK_USER, initMockAuth, logout as doLogout, persistAuth, restoreAuth } from '$lib/stores/auth';
	import { authApi, teamApi, fileApi } from '$lib/services/api-adapter';
	import { goto, replaceState } from '$app/navigation';
	import type { TeamMember, TeamPermission } from '$lib/types';
	import { isSandbox } from '$lib/stores/sandbox';
	import { resetAllTours } from '$lib/stores/tour';
	import { HelpCircle } from 'lucide-svelte';
	import StripePaymentModal from '$lib/components/StripePaymentModal.svelte';
	import { resolveAvatarUrl } from '$lib/utils/helpers';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');

	let activeTab = $state('account');

	// Push notification state
	let pushSupported = $state(false);
	let pushSubscribed = $state(false);
	let pushPermission = $state<string>('default');
	let pushToggling = $state(false);

	// Notification preferences (stored in localStorage + synced to server)
	let notifPrefs = $state({
		announcements: true,
		docUpdates: true,
		payments: true,
		teamUpdates: true,
		overdueReminders: true,
		dailySummary: false,
	});

	async function loadNotifPrefs() {
		// Load from localStorage first (instant)
		try {
			const raw = localStorage.getItem('push.preferences');
			if (raw) Object.assign(notifPrefs, JSON.parse(raw));
		} catch {}
		// Then try to sync from server (background)
		try {
			const token = localStorage.getItem('auth.token');
			if (token && token !== 'mock-jwt-token') {
				const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/push/preferences`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const data = await res.json();
				if (data.ok && data.data) {
					Object.assign(notifPrefs, data.data);
					localStorage.setItem('push.preferences', JSON.stringify(notifPrefs));
				}
			}
		} catch {}
	}

	async function saveNotifPrefs() {
		const json = JSON.stringify(notifPrefs);
		localStorage.setItem('push.preferences', json);
		// Sync to CacheStorage so service worker can read preferences
		try {
			const cache = await caches.open('push-prefs');
			await cache.put('/push-preferences', new Response(json, { headers: { 'Content-Type': 'application/json' } }));
		} catch {}
		// Sync to server (best-effort)
		try {
			const token = localStorage.getItem('auth.token');
			if (token && token !== 'mock-jwt-token') {
				await fetch(`${import.meta.env.VITE_API_URL || ''}/api/push/preferences`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: json,
				});
			}
		} catch {}
		addToast('บันทึกการตั้งค่าแจ้งเตือนแล้ว', 'success');
	}

	onMount(async () => {
		// Use real auth if available, fallback to mock for dev
		const hasAuth = !!$currentUser;
		if (!hasAuth) {
			initMockAuth();
		}
		await loadAccountInfo();

		// Initialize push notification state
		pushSupported = isPushSupported();
		pushPermission = getPermissionStatus();
		if (pushSupported) {
			pushSubscribed = await isSubscribed();
		}
		loadNotifPrefs();

		// Set default tab based on user type
		const userIsOwner = $isOwner;
		const hasTeamOnly = !userIsOwner && !!$currentUser?.hasTeamAccess;
		if (hasTeamOnly) {
			activeTab = 'account';
		}

		// Handle tab query param (?tab=notifications)
		const url = new URL(window.location.href);
		const tabParam = url.searchParams.get('tab');
		if (tabParam) {
			activeTab = tabParam;
		}

		// Handle Google Drive OAuth callback for email users (?code=xxx&state=google_connect)
		const googleCode = url.searchParams.get('code');
		const oauthState = url.searchParams.get('state');
		if (googleCode && oauthState === 'google_connect') {
			activeTab = 'account';
			driveConnecting = true;
			replaceState('/account', {});
			try {
				const redirectUri = `${APP_ORIGIN}/account`;
				const res = await authApi.connectGoogleDrive(googleCode, redirectUri);
				if (res.ok && res.data) {
					const d = res.data as any;
					const user = $currentUser;
					if (user && d.driveFolderId) {
						const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') || '' : '';
						persistAuth({ ...user, driveFolderId: d.driveFolderId, googleId: d.googleId || user.googleId }, token);
					}
					addToast('เชื่อมต่อ Google Drive สำเร็จ', 'success');
				} else {
					addToast(res.error?.message || 'เชื่อมต่อ Google Drive ไม่สำเร็จ', 'error');
				}
			} catch (e: any) {
				addToast(e?.message || 'ไม่สามารถเชื่อมต่อ Google Drive ได้', 'error');
			} finally {
				driveConnecting = false;
			}
		}

		// Auto-connect Google Drive if user is Google-authenticated but missing folder
		// Silent mode: don't show error toast for auto-connect (400 = token expired, expected)
		const u = $currentUser;
		if (u && u.authProvider === 'google' && !u.driveFolderId) {
			handleConnectDrive(true);
		}

		// Load team members from D1
		await loadTeamMembers();
	});

	// ===== Load team members from D1 =====
	async function loadTeamMembers() {
		try {
			const companyId = $currentCompanyId || $currentCompany?.entityId || '';
			if (!companyId) return;
			const [membersRes, seatRes] = await Promise.all([
				teamApi.listAll(),
				teamApi.seatInfo(companyId),
			]);
			if (membersRes.ok && membersRes.data) {
				teamMembers = (membersRes.data as any[]).map((m: any) => ({
					memberId: m.memberId,
					companyId: m.companyId,
					companyIds: m.companyIds || [m.companyId],
					userId: m.userId || '',
					email: m.email,
					name: m.name || '',
					role: m.role || 'member',
					permissions: m.permissions || [],
					status: m.status || 'pending',
					inviteToken: m.inviteToken || '',
					inviteExpiresAt: m.inviteExpiresAt || '',
					createdAt: m.createdAt || '',
					updatedAt: m.updatedAt || '',
				}));
			}
			if (seatRes.ok && seatRes.data) {
				seatInfo = seatRes.data as any;
			}
		} catch {
			// D1 unavailable — leave empty
		}
	}

	// ===== Account State =====
	let accountName = $state('');
	let accountEmail = $state('');
	let accountAvatar = $state('');
	let accountProvider = $state<'email' | 'google' | 'line'>('google');

	// Password change
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showDeleteConfirm = $state(false);

	// ===== Team Members State =====
	const MAX_TEAM_MEMBERS = 10;
	const FREE_SEATS = 2;
	const COST_PER_MEMBER = 490;

	const PERMISSION_OPTIONS: { id: TeamPermission; label: string; icon: any }[] = [
		{ id: 'dashboard', label: 'แดชบอร์ด', icon: Layout },
		{ id: 'documents', label: 'ออกเอกสาร', icon: FileText },
		{ id: 'history', label: 'ประวัติเอกสาร', icon: Clock },
		{ id: 'customers', label: 'ลูกค้า/ผู้ขาย', icon: Users },
		{ id: 'products', label: 'สินค้า/บริการ', icon: FileText },
		{ id: 'salespersons', label: 'ฝ่ายขาย', icon: User },
		{ id: 'payments', label: 'ชำระเงิน', icon: Shield },
		{ id: 'purchases', label: 'จัดซื้อ', icon: FileText },
		{ id: 'settings', label: 'ตั้งค่า (อ่านอย่างเดียว)', icon: Shield },
	];

	let teamMembers: TeamMember[] = $state([]);
	let seatInfo = $state<{ currentCount: number; freeSeats: number; paidSeats: number; maxTeam: number; totalAvailable: number; remaining: number; needsPayment: boolean } | null>(null);

	let seatQty = $state(1);
	let showSeatPayment = $state(false);

	const API_BASE = import.meta.env.VITE_API_URL || '';

	function handleBuySeat() {
		showSeatPayment = true;
	}

	function handleSeatPaymentSuccess() {
		showSeatPayment = false;
		loadTeamMembers();
		addToast('ซื้อที่นั่งสำเร็จ', 'success');
	}

	let showInviteDialog = $state(false);
	let inviteEmail = $state('');
	let inviteName = $state('');
	let inviteCompanyId = $state('');
	let inviteCompanyIds: string[] = $state([]);
	let invitePermissions: TeamPermission[] = $state(['dashboard', 'documents', 'history']);
	let generatedInviteLink = $state('');
	let editingMemberId = $state<string | null>(null);
	let editPermissions: TeamPermission[] = $state([]);
	let editCompanyIds: string[] = $state([]);

	// My team memberships (for non-owner team members)
	let myMemberships: any[] = $state([]);
	let loadingMemberships = $state(false);

	async function loadMyMemberships() {
		loadingMemberships = true;
		try {
			const res = await teamApi.myMemberships();
			if (res.ok && res.data) myMemberships = res.data as any[];
		} catch { /* ignore */ }
		loadingMemberships = false;
	}

	async function handleLeaveTeam(companyId: string, companyName: string) {
		if (!confirm(`คุณต้องการออกจากทีม "${companyName}" ใช่หรือไม่?`)) return;
		try {
			const res = await teamApi.leaveTeam(companyId);
			if (res.ok) {
				addToast(`ออกจากทีม "${companyName}" เรียบร้อย`, 'success');
				myMemberships = myMemberships.filter(m => m.companyId !== companyId);
				// Reload page to refresh companies
				setTimeout(() => window.location.reload(), 1000);
			} else {
				addToast(res.error?.message || 'ไม่สามารถออกจากทีมได้', 'error');
			}
		} catch {
			addToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
		}
	}

	// Account handlers
	let avatarUploading = $state(false);
	let driveConnecting = $state(false);

	const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

	function handleConnectGoogleForDrive() {
		if (!GOOGLE_CLIENT_ID) {
			addToast('Google Client ID ยังไม่ได้ตั้งค่า', 'error');
			return;
		}
		const redirectUri = `${APP_ORIGIN}/account`;
		const params = new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
			access_type: 'offline',
			prompt: 'consent',
			state: 'google_connect',
		});
		window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
	}

	async function handleConnectDrive(silent = false) {
		driveConnecting = true;
		try {
			const res = await authApi.connectDrive();
			if (res.ok && res.data) {
				const d = res.data as any;
				const user = $currentUser;
				if (user && d.driveFolderId) {
					const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') || '' : '';
					persistAuth({ ...user, driveFolderId: d.driveFolderId }, token);
				}
				addToast('เชื่อมต่อ Google Drive สำเร็จ', 'success');
			} else if (!silent) {
				addToast(res.error?.message || 'เชื่อมต่อ Google Drive ไม่สำเร็จ', 'error');
			}
		} catch (e: any) {
			if (!silent) addToast(e?.message || 'ไม่สามารถเชื่อมต่อ Google Drive ได้', 'error');
		} finally {
			driveConnecting = false;
		}
	}

	async function loadAccountInfo() {
		const user = $currentUser || MOCK_USER;
		accountName = user.name;
		accountEmail = user.email;
		accountAvatar = resolveAvatarUrl(user.avatarUrl);
		accountProvider = user.authProvider;

		// Refresh user data from server to get latest driveFolderId
		try {
			const res = await authApi.me();
			if (res.ok && res.data) {
				const d = res.data as any;
				const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') || '' : '';
				if (token && token !== 'mock-jwt-token') {
					const updated = {
						...(user),
						name: d.name || user.name,
						email: d.email || user.email,
						avatarUrl: d.avatarUrl || user.avatarUrl,
						authProvider: d.authProvider || user.authProvider,
						driveFolderId: d.driveFolderId || '',
					};
					persistAuth(updated, token);
					accountName = updated.name;
					accountEmail = updated.email;
					accountAvatar = resolveAvatarUrl(updated.avatarUrl);
					accountProvider = updated.authProvider;
				}
			}
		} catch {
			// Server unreachable — use cached data
		}
	}

	async function handleAvatarUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type and size
		if (!file.type.startsWith('image/')) {
			addToast('กรุณาเลือกไฟล์รูปภาพ', 'error');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			addToast('ไฟล์ต้องมีขนาดไม่เกิน 5 MB', 'error');
			return;
		}

		avatarUploading = true;
		try {
			// Upload avatar directly to R2 via /api/images/upload (no Drive required)
			const token = localStorage.getItem('auth.token');
			const fd = new FormData();
			fd.append('file', file);
			fd.append('companyId', '');
			fd.append('refType', 'avatar');
			const uploadRes = await fetch(`${API_BASE}/api/images/upload`, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}` },
				body: fd,
			});
			const json = await uploadRes.json();
			if (json.ok && json.data?.url) {
				const avatarUrl = `${API_BASE}${json.data.url}`;
				accountAvatar = avatarUrl;
				// Update profile with new avatar URL
				const profileRes = await authApi.updateProfile({ avatarUrl });
				if (profileRes.ok) {
					const user = $currentUser;
					if (user) {
						const updated = { ...user, avatarUrl };
						const tkn = typeof window !== 'undefined' ? localStorage.getItem('auth.token') || '' : '';
						persistAuth(updated, tkn);
					}
				}
				addToast('อัปโหลดรูปโปรไฟล์เรียบร้อย', 'success');
			} else {
				addToast(json.error?.message || 'อัปโหลดรูปไม่สำเร็จ', 'error');
			}
		} catch (e: any) {
			addToast(e?.message || 'ไม่สามารถอัปโหลดรูปได้', 'error');
		} finally {
			avatarUploading = false;
			input.value = '';
		}
	}

	async function saveAccountInfo() {
		try {
			const res = await authApi.updateProfile({ name: accountName });
			if (res.ok && res.data) {
				const user = $currentUser;
				if (user) {
					const updated = { ...user, name: accountName };
					const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') || '' : '';
					persistAuth(updated, token);
				}
				addToast('บันทึกข้อมูลบัญชีเรียบร้อย', 'success');
			} else {
				addToast(res.error?.message || 'บันทึกไม่สำเร็จ', 'error');
			}
		} catch (e: any) {
			addToast(e?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
		}
	}

	async function savePassword() {
		if (!currentPassword || !newPassword) {
			addToast('กรุณากรอกข้อมูลให้ครบ', 'error');
			return;
		}
		if (newPassword !== confirmPassword) {
			addToast('รหัสผ่านใหม่ไม่ตรงกัน', 'error');
			return;
		}
		if (newPassword.length < 8) {
			addToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'error');
			return;
		}
		try {
			const res = await authApi.changePassword(currentPassword, newPassword);
			if (res.ok) {
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
				addToast('เปลี่ยนรหัสผ่านเรียบร้อย', 'success');
			} else {
				addToast(res.error?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ', 'error');
			}
		} catch (e: any) {
			addToast(e?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
		}
	}

	function handleLogout() {
		doLogout();
		addToast('ออกจากระบบแล้ว', 'info');
		goto('/login');
	}

	async function handleDeleteAccount() {
		showDeleteConfirm = false;
		try {
			const res = await authApi.deleteAccount();
			if (res.ok) {
				doLogout();
				addToast('ลบบัญชีเรียบร้อย', 'info');
				goto('/login');
			} else {
				addToast(res.error?.message || 'ลบบัญชีไม่สำเร็จ', 'error');
			}
		} catch (e: any) {
			addToast(e?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
		}
	}

	// Team handlers
	function toggleInvitePermission(perm: TeamPermission) {
		if (invitePermissions.includes(perm)) {
			invitePermissions = invitePermissions.filter(p => p !== perm);
		} else {
			invitePermissions = [...invitePermissions, perm];
		}
	}

	async function generateInviteLink() {
		if (!inviteEmail.trim()) {
			addToast('กรุณากรอกอีเมล', 'error');
			return;
		}
		// Multi-company: use inviteCompanyIds if available, fallback to inviteCompanyId
		const selectedIds = inviteCompanyIds.length > 0 ? inviteCompanyIds : (inviteCompanyId ? [inviteCompanyId] : ($currentCompany?.entityId ? [$currentCompany.entityId] : []));
		if (selectedIds.length === 0) {
			addToast('กรุณาเลือกบริษัท', 'error');
			return;
		}
		const companyId = selectedIds[0];
		if (teamMembers.length >= MAX_TEAM_MEMBERS) {
			addToast(`จำนวนสมาชิกเต็มแล้ว (สูงสุด ${MAX_TEAM_MEMBERS} คน)`, 'error');
			return;
		}
		try {
			const res = await teamApi.add({ companyId, companyIds: selectedIds, email: inviteEmail, name: inviteName || inviteEmail, permissions: invitePermissions });
			if (res.ok && res.data) {
				const d = res.data as any;
				generatedInviteLink = `${APP_ORIGIN}/invite/${d.inviteToken || d.memberId}`;
				const newMember: TeamMember = {
					memberId: d.memberId || `tm-${Date.now()}`,
					companyId,
					userId: '',
					email: inviteEmail,
					name: inviteName || inviteEmail,
					role: 'member',
					permissions: [...invitePermissions],
					status: 'pending',
					inviteToken: d.inviteToken,
					inviteExpiresAt: d.inviteExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				teamMembers = [...teamMembers, newMember];
				await loadTeamMembers();
				addToast('สร้างลิงก์เชิญเรียบร้อย', 'success');
			} else {
				const errCode = res.error?.code;
				if (errCode === 'PAYMENT_REQUIRED') {
					addToast(`คุณใช้สิทธิ์ฟรี ${FREE_SEATS} คนแล้ว กรุณาซื้อที่นั่งเพิ่มก่อนเชิญสมาชิก`, 'error');
				} else {
					addToast(res.error?.message || 'สร้างลิงก์ไม่สำเร็จ', 'error');
				}
			}
		} catch (e: any) {
			addToast(e?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
		}
	}

	function copyInviteLink() {
		if (generatedInviteLink && typeof navigator !== 'undefined') {
			navigator.clipboard.writeText(generatedInviteLink);
			addToast('คัดลอกลิงก์แล้ว', 'success');
		}
	}

	function closeInviteDialog() {
		showInviteDialog = false;
		inviteEmail = '';
		inviteName = '';
		inviteCompanyId = '';
		invitePermissions = ['dashboard', 'documents', 'history'];
		generatedInviteLink = '';
	}

	function startEditPermissions(member: TeamMember) {
		editingMemberId = member.memberId;
		editPermissions = [...member.permissions];
		editCompanyIds = [...(member.companyIds || [member.companyId])];
	}

	function toggleEditPermission(perm: TeamPermission) {
		if (editPermissions.includes(perm)) {
			editPermissions = editPermissions.filter(p => p !== perm);
		} else {
			editPermissions = [...editPermissions, perm];
		}
	}

	async function saveEditPermissions() {
		try {
			if (editingMemberId) {
				await teamApi.update(editingMemberId, { permissions: editPermissions, companyIds: editCompanyIds });
			}
		} catch { /* fallback */ }
		teamMembers = teamMembers.map(m =>
			m.memberId === editingMemberId ? { ...m, permissions: [...editPermissions], companyIds: [...editCompanyIds], updatedAt: new Date().toISOString() } : m
		);
		editingMemberId = null;
		addToast('บันทึกสิทธิ์เรียบร้อย', 'success');
		await loadTeamMembers();
	}

	async function removeMember(memberId: string) {
		try {
			await teamApi.remove(memberId);
		} catch { /* fallback */ }
		teamMembers = teamMembers.filter(m => m.memberId !== memberId);
		addToast('ลบสมาชิกเรียบร้อย', 'success');
	}

	const allTabs = [
		{ id: 'account', label: 'บัญชีผู้ใช้', icon: User },
		{ id: 'team', label: 'สมาชิกทีม', icon: Users },
		{ id: 'myteam', label: 'ทีมของฉัน', icon: Users },
		{ id: 'notifications', label: 'แจ้งเตือน', icon: Bell },
	];
	let tabs = $derived.by(() => {
		if ($isSandbox) return allTabs.filter(t => t.id === 'account' || t.id === 'notifications');
		const userIsOwner = $isOwner;
		const hasTeam = !!$currentUser?.hasTeamAccess;
		// Non-owner team members: only account + notifications + myteam
		if (!userIsOwner && hasTeam) {
			return allTabs.filter(t => t.id === 'account' || t.id === 'notifications' || t.id === 'myteam');
		}
		return allTabs.filter(t => {
			if (t.id === 'team') return userIsOwner || $currentUser?.isAdmin;
			if (t.id === 'myteam') return !userIsOwner && hasTeam;
			return true;
		});
	});
</script>

<!-- Tabs -->
<div class="tabs-container">
	{#each tabs as tab}
		{@const Icon = tab.icon}
		<button
			class="settings-tab"
			class:active={activeTab === tab.id}
			onclick={() => { activeTab = tab.id; if (tab.id === 'myteam') loadMyMemberships(); }}
		>
			<Icon size={16} />
			{tab.label}
		</button>
	{/each}
</div>

<!-- Account Tab -->
{#if activeTab === 'account'}
	<div class="card" style="max-width: 640px;">
		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">ข้อมูลบัญชี</h3>

		<!-- Profile avatar -->
		<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
			<div class="account-avatar" style="position: relative; cursor: pointer;" onclick={() => document.getElementById('avatarInput')?.click()}>
				{#if accountAvatar}
					<img src={accountAvatar} alt="avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />
				{:else}
					{#if accountName}
						<span style="font-size: 20px; font-weight: 700; color: #fff; text-transform: uppercase; user-select: none;">{accountName.charAt(0)}</span>
					{:else}
						<User size={28} />
					{/if}
				{/if}
				{#if avatarUploading}
					<div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
						<div style="width: 20px; height: 20px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
					</div>
				{:else}
					<div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(0,0,0,0); display: flex; align-items: center; justify-content: center; transition: background 0.2s;" class="avatar-overlay">
						<span style="color: #fff; font-size: 10px; font-weight: 600; opacity: 0; transition: opacity 0.2s;" class="avatar-overlay-text">เปลี่ยนรูป</span>
					</div>
				{/if}
				<input id="avatarInput" type="file" accept="image/*" style="display: none;" onchange={handleAvatarUpload} />
			</div>
			<div>
				<div style="font-weight: 600; font-size: 16px; color: var(--color-gray-900);">{accountName || 'ไม่ระบุชื่อ'}</div>
				<div style="font-size: 13px; color: var(--color-gray-500);">{accountEmail}</div>
				{#if accountProvider === 'google'}
					<div style="display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 2px 8px; background: #f0f4ff; border-radius: 6px; font-size: 11px; color: #4285f4; font-weight: 600;">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
						Google
					</div>
				{/if}
			</div>
		</div>

		<!-- Name field -->
		<div style="margin-bottom: 16px;">
			<label class="field-label" for="accountName">ชื่อที่แสดง</label>
			<input id="accountName" class="field-control" bind:value={accountName} placeholder="ชื่อของคุณ" />
		</div>

		<!-- Email (read-only) -->
		<div style="margin-bottom: 16px;">
			<label class="field-label" for="accountEmail">อีเมล</label>
			<input id="accountEmail" class="field-control" value={accountEmail} disabled style="background: var(--color-gray-50); color: var(--color-gray-500);" />
		</div>

		<!-- Google Drive connection -->
		<div style="margin-bottom: 16px; padding: 14px 16px; border: 1px solid var(--color-gray-200); border-radius: 10px; background: var(--color-gray-50);">
			<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
				<div style="display: flex; align-items: center; gap: 10px;">
					<svg width="20" height="20" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.2c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.4 9.35z" fill="#ea4335"/><path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h22.9c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>
					<div>
						<div style="font-weight: 600; font-size: 13px; color: var(--color-gray-800);">Google Drive</div>
						{#if ($currentUser || MOCK_USER).driveFolderId}
							<div style="font-size: 11px; color: #16a34a; display: flex; align-items: center; gap: 4px;">
								<Check size={12} /> เชื่อมต่อแล้ว
							</div>
						{:else}
							<div style="font-size: 11px; color: var(--color-gray-500);">ยังไม่ได้เชื่อมต่อ — ต้องเชื่อมเพื่ออัปโหลดไฟล์และรูปภาพ</div>
						{/if}
					</div>
				</div>
				{#if !($currentUser || MOCK_USER).driveFolderId}
					{#if accountProvider === 'google'}
						<button class="btn btn-sm btn-outline" style="font-size: 12px;" disabled={driveConnecting} onclick={() => handleConnectDrive()}>
							{#if driveConnecting}
								กำลังเชื่อมต่อ...
							{:else}
								เชื่อมต่อ Google Drive
							{/if}
						</button>
					{:else}
						<button class="btn btn-sm btn-outline" style="font-size: 12px;" disabled={driveConnecting} onclick={handleConnectGoogleForDrive}>
							{#if driveConnecting}
								กำลังเชื่อมต่อ...
							{:else}
								เชื่อมต่อ Google Drive
							{/if}
						</button>
					{/if}
				{/if}
			</div>
		</div>

		<div style="margin-bottom: 32px;">
			<button class="btn btn-primary" onclick={saveAccountInfo}><Save size={16} /> บันทึกข้อมูล</button>
		</div>

		<!-- Password section -->
		{#if accountProvider === 'email'}
			<div style="border-top: 1px solid var(--color-gray-200); padding-top: 24px; margin-bottom: 24px;">
				<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
					<Lock size={18} /> เปลี่ยนรหัสผ่าน
				</h3>
				<div style="display: flex; flex-direction: column; gap: 12px; max-width: 360px;">
					<div>
						<label class="field-label" for="currentPw">รหัสผ่านปัจจุบัน</label>
						<input id="currentPw" class="field-control" type="password" bind:value={currentPassword} placeholder="••••••••" />
					</div>
					<div>
						<label class="field-label" for="newPw">รหัสผ่านใหม่</label>
						<input id="newPw" class="field-control" type="password" bind:value={newPassword} placeholder="อย่างน้อย 8 ตัวอักษร" />
					</div>
					<div>
						<label class="field-label" for="confirmPw">ยืนยันรหัสผ่านใหม่</label>
						<input id="confirmPw" class="field-control" type="password" bind:value={confirmPassword} placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" />
					</div>
					<div>
						<button class="btn btn-primary" onclick={savePassword}><Lock size={16} /> เปลี่ยนรหัสผ่าน</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Tour reset -->
		<div style="border-top: 1px solid var(--color-gray-200); padding-top: 24px; margin-bottom: 24px;">
			<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">คู่มือแนะนำ</h3>
			<p style="font-size: 13px; color: var(--color-gray-500); margin-bottom: 12px;">แสดงคำแนะนำการใช้งานอีกครั้งในทุกหน้า</p>
			<button class="btn btn-outline" onclick={() => { resetAllTours(); addToast('รีเซ็ตคำแนะนำแล้ว จะแสดงอีกครั้งเมื่อเข้าแต่ละหน้า', 'success'); }}>
				<HelpCircle size={16} /> รีเซ็ตคำแนะนำทั้งหมด
			</button>
		</div>

		<!-- Account actions -->
		<div style="border-top: 1px solid var(--color-gray-200); padding-top: 24px;">
			<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 16px;">จัดการบัญชี</h3>
			<div style="display: flex; gap: 12px; flex-wrap: wrap;">
				<button class="btn btn-outline" onclick={handleLogout}>
					<LogOut size={16} /> ออกจากระบบ
				</button>
				<button class="btn btn-danger" onclick={() => showDeleteConfirm = true}>
					<Trash2 size={16} /> ลบบัญชี
				</button>
			</div>
		</div>
	</div>

	<!-- Delete confirm dialog -->
	{#if showDeleteConfirm}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-overlay">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="modal-content" onclick={(e) => e.stopPropagation()} style="max-width: 400px;">
				<div style="text-align: center; padding: 24px;">
					<div style="width: 48px; height: 48px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
						<AlertTriangle size={24} color="#ef4444" />
					</div>
					<h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">ลบบัญชีถาวร?</h3>
					<p style="font-size: 13px; color: var(--color-gray-500); margin-bottom: 24px;">การดำเนินการนี้ไม่สามารถย้อนกลับได้ ข้อมูลทั้งหมดจะถูกลบอย่างถาวร</p>
					<div style="display: flex; gap: 8px; justify-content: center;">
						<button class="btn btn-outline" onclick={() => showDeleteConfirm = false}>ยกเลิก</button>
						<button class="btn btn-danger" onclick={handleDeleteAccount}>ลบบัญชี</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

<!-- Team Tab -->
{#if activeTab === 'team'}
	<div class="card" style="max-width: 100%;">
		<!-- Header -->
		<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
			<div>
				<h3 style="font-size: 15px; font-weight: 700; margin: 0;">สมาชิกทีม ({teamMembers.length}/{MAX_TEAM_MEMBERS})</h3>
				<p style="font-size: 12px; color: var(--color-gray-500); margin: 4px 0 0 0;">จัดการสมาชิกที่สามารถเข้าถึงระบบของคุณ</p>
			</div>
			<button class="btn btn-primary" onclick={() => { showInviteDialog = true; generatedInviteLink = ''; inviteEmail = ''; inviteName = ''; inviteCompanyId = $currentCompanyId || $currentCompany?.entityId || ''; inviteCompanyIds = $currentCompany?.entityId ? [$currentCompany.entityId] : $companies.map(c => c.entityId); invitePermissions = ['dashboard', 'documents', 'history']; }} disabled={teamMembers.length >= MAX_TEAM_MEMBERS}>
				<UserPlus size={16} /> เชิญสมาชิก
			</button>
		</div>

		<!-- Seat info banner -->
		<div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
			<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
				<div style="width: 40px; height: 40px; background: #0ea5e9; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
					<Users size={20} color="#fff" />
				</div>
				<div>
					<div style="font-weight: 700; font-size: 14px; color: #0c4a6e;">ที่นั่งสมาชิก</div>
					<div style="font-size: 12px; color: #0369a1;">ฟรี {FREE_SEATS} คน • เพิ่มเติม {COST_PER_MEMBER} บาท/คน • สูงสุด {MAX_TEAM_MEMBERS} คน</div>
				</div>
			</div>
			{#if seatInfo}
				<div style="display: flex; gap: 12px; flex-wrap: wrap;">
					<div style="background: #fff; border-radius: 8px; padding: 8px 14px; font-size: 12px; border: 1px solid #e0f2fe;">
						<span style="color: #64748b;">ใช้แล้ว</span>
						<strong style="color: #0c4a6e;">{seatInfo.currentCount}</strong> / {seatInfo.totalAvailable}
					</div>
					<div style="background: #fff; border-radius: 8px; padding: 8px 14px; font-size: 12px; border: 1px solid #e0f2fe;">
						<span style="color: #64748b;">ฟรี</span>
						<strong style="color: #16a34a;">{FREE_SEATS}</strong>
					</div>
					<div style="background: #fff; border-radius: 8px; padding: 8px 14px; font-size: 12px; border: 1px solid #e0f2fe;">
						<span style="color: #64748b;">ซื้อเพิ่ม</span>
						<strong style="color: #2563eb;">{seatInfo.paidSeats}</strong>
					</div>
					<div style="background: #fff; border-radius: 8px; padding: 8px 14px; font-size: 12px; border: 1px solid #e0f2fe;">
						<span style="color: #64748b;">เหลือ</span>
						<strong style="color: {seatInfo.remaining > 0 ? '#16a34a' : '#ef4444'};">{seatInfo.remaining}</strong>
					</div>
				</div>
				{#if seatInfo.needsPayment}
					<div style="margin-top: 10px; padding: 12px 16px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px;">
						<div style="font-size: 12px; color: #92400e; display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
							<AlertTriangle size={14} /> ที่นั่งฟรีใช้หมดแล้ว — ซื้อที่นั่งเพิ่มเพื่อเชิญสมาชิก
						</div>
						<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
							<div style="display: flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 8px;">
								<button style="background: none; border: none; cursor: pointer; font-size: 16px; font-weight: 700; color: #6b7280; padding: 0 4px;" onclick={() => seatQty = Math.max(1, seatQty - 1)}>−</button>
								<span style="font-size: 14px; font-weight: 600; min-width: 20px; text-align: center;">{seatQty}</span>
								<button style="background: none; border: none; cursor: pointer; font-size: 16px; font-weight: 700; color: #6b7280; padding: 0 4px;" onclick={() => seatQty = Math.min(10, seatQty + 1)}>+</button>
							</div>
							<span style="font-size: 12px; color: #92400e;">× ฿{COST_PER_MEMBER}/ที่นั่ง = <strong>฿{(seatQty * COST_PER_MEMBER).toLocaleString()}</strong></span>
							<button
								style="margin-left: auto; padding: 6px 14px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;"
								onclick={handleBuySeat}
							>
								ซื้อที่นั่ง
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
		<!-- Owner row -->
		<div style="border: 1px solid var(--color-gray-200); border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
			<div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--color-gray-50);">
				<div style="width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px;">
					{($currentUser || MOCK_USER).name.charAt(0)}
				</div>
				<div style="flex: 1; min-width: 0;">
					<div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
						{($currentUser || MOCK_USER).name}
						<span style="display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; background: #fef3c7; border-radius: 6px; font-size: 11px; color: #92400e; font-weight: 600;"><Crown size={11} /> เจ้าของ</span>
					</div>
					<div style="font-size: 12px; color: var(--color-gray-500);">{($currentUser || MOCK_USER).email}</div>
				</div>
				<div style="font-size: 12px; color: var(--color-gray-400);">เข้าถึงทุกหน้า</div>
			</div>
		</div>

		<!-- Member rows -->
		{#if teamMembers.length > 0}
			<div style="border: 1px solid var(--color-gray-200); border-radius: 12px; overflow: hidden;">
				{#each teamMembers as member, i}
					<div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; {i > 0 ? 'border-top: 1px solid var(--color-gray-100);' : ''}">
						<div style="width: 36px; height: 36px; border-radius: 50%; background: {member.status === 'active' ? '#dbeafe' : '#f3f4f6'}; display: flex; align-items: center; justify-content: center; color: {member.status === 'active' ? '#2563eb' : '#9ca3af'}; font-weight: 700; font-size: 14px;">
							{member.name.charAt(0)}
						</div>
						<div style="flex: 1; min-width: 0;">
							<div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
								{member.name}
								{#if member.status === 'pending'}
									<span style="display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; background: #fff7ed; border-radius: 6px; font-size: 11px; color: #c2410c; font-weight: 600;"><Clock size={11} /> รอตอบรับ</span>
								{:else if member.status === 'active'}
									<span style="display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; background: #f0fdf4; border-radius: 6px; font-size: 11px; color: #166534; font-weight: 600;"><CheckCircle size={11} /> ใช้งาน</span>
								{:else}
									<span style="display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; background: #fef2f2; border-radius: 6px; font-size: 11px; color: #991b1b; font-weight: 600;"><XCircle size={11} /> ปิดใช้งาน</span>
								{/if}
							</div>
							<div style="font-size: 12px; color: var(--color-gray-500);">{member.email}</div>
							<!-- Company badges -->
							{#if member.companyIds && member.companyIds.length > 0}
								<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
									{#each member.companyIds as cid}
										{@const comp = $companies.find(c => c.entityId === cid)}
										{#if comp}
											<span style="padding: 1px 6px; background: #dbeafe; border-radius: 4px; font-size: 10px; color: #1e40af;">{comp.name}</span>
										{/if}
									{/each}
								</div>
							{/if}
							<!-- Permission badges -->
							<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
								{#each member.permissions as perm}
									{@const permInfo = PERMISSION_OPTIONS.find(p => p.id === perm)}
									{#if permInfo}
										<span style="padding: 1px 6px; background: var(--color-gray-100); border-radius: 4px; font-size: 10px; color: var(--color-gray-600);">{permInfo.label}</span>
									{/if}
								{/each}
							</div>
						</div>
						<div style="display: flex; gap: 6px; flex-shrink: 0;">
							<button class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px;" onclick={() => startEditPermissions(member)}>
								<Shield size={12} /> สิทธิ์
							</button>
							<button class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px; color: #ef4444; border-color: #fecaca;" onclick={() => removeMember(member.memberId)}>
								<Trash2 size={12} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div style="text-align: center; padding: 40px 20px; color: var(--color-gray-400);">
				<Users size={32} />
				<p style="margin-top: 8px; font-size: 14px;">ยังไม่มีสมาชิก</p>
				<p style="font-size: 12px;">กดปุ่ม "เชิญสมาชิก" เพื่อเพิ่มคนเข้าทีม</p>
			</div>
		{/if}
	</div>

	<!-- Invite Dialog -->
	{#if showInviteDialog}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-overlay">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="modal-content" onclick={(e) => e.stopPropagation()} style="max-width: 480px;">
				<div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--color-gray-100);">
					<h3 style="font-size: 16px; font-weight: 700; margin: 0;">เชิญสมาชิกใหม่</h3>
					<button class="btn-icon" onclick={closeInviteDialog}><X size={18} /></button>
				</div>
				<div style="padding: 20px 24px;">
					{#if !generatedInviteLink}
						<div style="margin-bottom: 16px;">
							<label class="field-label">อีเมล *</label>
							<input class="field-control" type="email" bind:value={inviteEmail} placeholder="example@email.com" />
						</div>
						<div style="margin-bottom: 16px;">
							<label class="field-label">ชื่อ (ไม่บังคับ)</label>
							<input class="field-control" bind:value={inviteName} placeholder="ชื่อสมาชิก" />
						</div>
						{#if $companies.length > 0}
							<div style="margin-bottom: 16px;">
								<label class="field-label">บริษัทที่เข้าถึงได้ *</label>
								<div style="display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid var(--color-gray-200); border-radius: 8px; background: var(--color-gray-50);">
									{#each $companies as comp}
										<label class="perm-checkbox" class:checked={inviteCompanyIds.includes(comp.entityId)}>
											<input type="checkbox" checked={inviteCompanyIds.includes(comp.entityId)} onchange={() => {
												if (inviteCompanyIds.includes(comp.entityId)) {
													inviteCompanyIds = inviteCompanyIds.filter(id => id !== comp.entityId);
												} else {
													inviteCompanyIds = [...inviteCompanyIds, comp.entityId];
												}
											}} />
											<span>{comp.name}</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}
						<div style="margin-bottom: 20px;">
							<label class="field-label">สิทธิ์การเข้าถึง</label>
							<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
								{#each PERMISSION_OPTIONS as perm}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<label class="perm-checkbox" class:checked={invitePermissions.includes(perm.id)}>
										<input type="checkbox" checked={invitePermissions.includes(perm.id)} onchange={() => toggleInvitePermission(perm.id)} />
										<span>{perm.label}</span>
									</label>
								{/each}
							</div>
						</div>
						<button class="btn btn-primary" style="width: 100%;" onclick={generateInviteLink}>
							<Link2 size={16} /> สร้างลิงก์เชิญ
						</button>
					{:else}
						<div style="text-align: center; margin-bottom: 20px;">
							<div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
								<CheckCircle size={24} color="#22c55e" />
							</div>
							<div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">ส่งคำเชิญเรียบร้อย!</div>
							<div style="font-size: 12px; color: var(--color-gray-500);">ลิงก์มีอายุ 7 วัน</div>
						</div>
						<div style="display: flex; gap: 8px; margin-bottom: 16px;">
							<input class="field-control" value={generatedInviteLink} readonly style="font-size: 12px; background: var(--color-gray-50);" />
							<button class="btn btn-outline" style="flex-shrink: 0;" onclick={copyInviteLink}>
								<Copy size={14} />
							</button>
						</div>
						<button class="btn btn-outline" style="width: 100%;" onclick={closeInviteDialog}>ปิด</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Edit Permissions Dialog -->
	{#if editingMemberId}
		{@const editMember = teamMembers.find(m => m.memberId === editingMemberId)}
		{#if editMember}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="modal-overlay">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="modal-content" onclick={(e) => e.stopPropagation()} style="max-width: 420px;">
					<div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--color-gray-100);">
						<h3 style="font-size: 16px; font-weight: 700; margin: 0;">แก้ไขสิทธิ์ — {editMember.name}</h3>
						<button class="btn-icon" onclick={() => editingMemberId = null}><X size={18} /></button>
					</div>
					<div style="padding: 20px 24px; max-height: 70vh; overflow-y: auto;">
						{#if $companies.length > 0}
							<div style="margin-bottom: 16px;">
								<label class="field-label">บริษัทที่เข้าถึงได้</label>
								<div style="display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid var(--color-gray-200); border-radius: 8px; background: var(--color-gray-50);">
									{#each $companies as comp}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<label class="perm-checkbox" class:checked={editCompanyIds.includes(comp.entityId)}>
											<input type="checkbox" checked={editCompanyIds.includes(comp.entityId)} onchange={() => {
												if (editCompanyIds.includes(comp.entityId)) {
													editCompanyIds = editCompanyIds.filter(id => id !== comp.entityId);
												} else {
													editCompanyIds = [...editCompanyIds, comp.entityId];
												}
											}} />
											<span>{comp.name}</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}
						<div style="margin-bottom: 20px;">
							<label class="field-label">สิทธิ์การเข้าถึงหน้า</label>
							<div style="display: flex; flex-direction: column; gap: 8px;">
								{#each PERMISSION_OPTIONS as perm}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<label class="perm-checkbox" class:checked={editPermissions.includes(perm.id)}>
										<input type="checkbox" checked={editPermissions.includes(perm.id)} onchange={() => toggleEditPermission(perm.id)} />
										<span>{perm.label}</span>
									</label>
								{/each}
							</div>
						</div>
						<div style="display: flex; gap: 8px;">
							<button class="btn btn-primary" style="flex: 1;" onclick={saveEditPermissions}><Save size={16} /> บันทึก</button>
							<button class="btn btn-outline" onclick={() => editingMemberId = null}>ยกเลิก</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
{/if}

<!-- My Team Tab (for non-owner team members) -->
{#if activeTab === 'myteam'}
	<div class="card" style="max-width: 100%;">
		<div style="margin-bottom: 20px;">
			<h3 style="font-size: 15px; font-weight: 700; margin: 0;">ทีมของฉัน</h3>
			<p style="font-size: 12px; color: var(--color-gray-500); margin: 4px 0 0 0;">ทีมที่คุณเป็นสมาชิกอยู่ คุณสามารถออกจากทีมได้</p>
		</div>

		{#if loadingMemberships}
			<div style="text-align: center; padding: 40px; color: var(--color-gray-400);">
				<p>กำลังโหลด...</p>
			</div>
		{:else if myMemberships.length === 0}
			<div style="text-align: center; padding: 40px 20px; color: var(--color-gray-400);">
				<Users size={32} />
				<p style="margin-top: 8px; font-size: 14px;">คุณยังไม่ได้เป็นสมาชิกทีมใด</p>
			</div>
		{:else}
			<div style="border: 1px solid var(--color-gray-200); border-radius: 12px; overflow: hidden;">
				{#each myMemberships as membership, i}
					<div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; {i > 0 ? 'border-top: 1px solid var(--color-gray-100);' : ''}">
						<div style="width: 36px; height: 36px; border-radius: 50%; background: #dbeafe; display: flex; align-items: center; justify-content: center; color: #2563eb; font-weight: 700; font-size: 14px;">
							{(membership.companyName || 'T').charAt(0)}
						</div>
						<div style="flex: 1; min-width: 0;">
							<div style="font-weight: 600; font-size: 14px;">{membership.companyName || membership.companyId}</div>
							<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
								{#each membership.permissions as perm}
									{@const permInfo = PERMISSION_OPTIONS.find(p => p.id === perm)}
									{#if permInfo}
										<span style="padding: 1px 6px; background: var(--color-gray-100); border-radius: 4px; font-size: 10px; color: var(--color-gray-600);">{permInfo.label}</span>
									{/if}
								{/each}
							</div>
						</div>
						<button
							class="btn btn-sm btn-outline"
							style="font-size: 11px; padding: 4px 10px; color: #ef4444; border-color: #fecaca;"
							onclick={() => handleLeaveTeam(membership.companyId, membership.companyName || membership.companyId)}
						>
							<DoorOpen size={12} /> ออกจากทีม
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- Notifications Tab -->
{#if activeTab === 'notifications'}
	<div class="card" style="max-width: 640px;">
		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
			<Bell size={18} /> การแจ้งเตือน Push
		</h3>

		{#if !pushSupported}
			<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; color: #92400e;">
				<p style="font-weight: 600; margin: 0 0 4px 0;">เบราว์เซอร์ไม่รองรับ</p>
				<p style="font-size: 13px; margin: 0;">Push Notification ต้องใช้ผ่าน Chrome, Edge, Firefox หรือ Safari 16.4+ และติดตั้งเป็น PWA เพื่อประสบการณ์ที่ดีที่สุด</p>
			</div>
		{:else}
			<div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: var(--color-gray-50); border-radius: 10px; margin-bottom: 16px;">
				<div>
					<div style="font-weight: 600; font-size: 14px;">รับแจ้งเตือน Push Notification</div>
					<div style="font-size: 12px; color: var(--color-gray-500); margin-top: 2px;">
						{#if pushPermission === 'denied'}
							สิทธิ์ถูกบล็อก — กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์
						{:else if pushSubscribed}
							กำลังรับแจ้งเตือนอยู่
						{:else}
							เปิดรับแจ้งเตือนเมื่อมีข่าวสารหรืออัปเดตสำคัญ
						{/if}
					</div>
				</div>
				<button
					class="btn btn-sm"
					style={pushSubscribed
						? 'background: #fee2e2; color: #ef4444; border: 1px solid #fecaca;'
						: 'background: var(--color-primary); color: #fff;'}
					disabled={pushToggling || pushPermission === 'denied'}
					onclick={async () => {
						pushToggling = true;
						if (pushSubscribed) {
							const ok = await unsubscribePush();
							if (ok) { pushSubscribed = false; addToast('ยกเลิกแจ้งเตือนแล้ว', 'info'); }
							else addToast('เกิดข้อผิดพลาด', 'error');
						} else {
							const ok = await subscribePush();
							if (ok) { pushSubscribed = true; pushPermission = getPermissionStatus(); addToast('เปิดรับแจ้งเตือนแล้ว', 'success'); }
							else { pushPermission = getPermissionStatus(); addToast('ไม่สามารถเปิดแจ้งเตือนได้', 'error'); }
						}
						pushToggling = false;
					}}
				>
					{#if pushToggling}
						...
					{:else if pushSubscribed}
						ยกเลิก
					{:else}
						เปิดรับแจ้งเตือน
					{/if}
				</button>
			</div>

			{#if pushSubscribed}
				<button
					class="btn btn-sm"
					style="background: var(--color-gray-100); color: var(--color-gray-700); margin-top: 8px;"
					onclick={async () => {
						addToast('กำลังส่งทดสอบ...', 'info');
						const result = await testPush();
						if (result.ok) {
							const d = result.data;
							if (d?.results?.[0]?.ok) {
								addToast('ส่งทดสอบสำเร็จ! ตรวจสอบแจ้งเตือน', 'success');
							} else {
								addToast(`Push service error: ${d?.results?.[0]?.error || d?.results?.[0]?.status || 'unknown'}`, 'error');
							}
						} else {
							addToast(`ส่งไม่สำเร็จ: ${result.error}`, 'error');
						}
					}}
				>🔔 ทดสอบส่งแจ้งเตือน</button>
			{/if}

			<div style="margin-top: 20px; border-top: 1px solid var(--color-gray-200); padding-top: 16px;">
				<h4 style="font-size: 13px; font-weight: 700; margin-bottom: 12px;">ประเภทการแจ้งเตือนที่ต้องการรับ</h4>
				{#if !pushSubscribed}
					<p style="font-size: 12px; color: var(--color-gray-400); margin: 0 0 10px 0;">ตั้งค่าล่วงหน้าได้ — จะมีผลเมื่อเปิดรับแจ้งเตือนแล้ว</p>
				{/if}
				<div style="display: flex; flex-direction: column; gap: 10px;">
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px;">
						<input type="checkbox" bind:checked={notifPrefs.announcements} onchange={saveNotifPrefs} style="width: 16px; height: 16px; accent-color: var(--color-primary);" />
						<div>
							<div style="font-weight: 600;">ข่าวสารและประกาศ</div>
							<div style="font-size: 11px; color: var(--color-gray-500);">อัปเดตฟีเจอร์ใหม่ โปรโมชัน และข่าวสำคัญ</div>
						</div>
					</label>
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px;">
						<input type="checkbox" bind:checked={notifPrefs.docUpdates} onchange={saveNotifPrefs} style="width: 16px; height: 16px; accent-color: var(--color-primary);" />
						<div>
							<div style="font-weight: 600;">การเปลี่ยนแปลงเอกสาร</div>
							<div style="font-size: 11px; color: var(--color-gray-500);">เมื่อสมาชิกทีมแก้ไขหรืออัปเดตเอกสาร</div>
						</div>
					</label>
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px;">
						<input type="checkbox" bind:checked={notifPrefs.payments} onchange={saveNotifPrefs} style="width: 16px; height: 16px; accent-color: var(--color-primary);" />
						<div>
							<div style="font-weight: 600;">การชำระเงิน</div>
							<div style="font-size: 11px; color: var(--color-gray-500);">เมื่อมีการชำระเงินหรือสถานะการชำระเปลี่ยน</div>
						</div>
					</label>
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px;">
						<input type="checkbox" bind:checked={notifPrefs.teamUpdates} onchange={saveNotifPrefs} style="width: 16px; height: 16px; accent-color: var(--color-primary);" />
						<div>
							<div style="font-weight: 600;">ทีมและสมาชิก</div>
							<div style="font-size: 11px; color: var(--color-gray-500);">เมื่อสมาชิกตอบรับคำเชิญ เข้าร่วม หรือออกจากทีม</div>
						</div>
					</label>
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px;">
						<input type="checkbox" bind:checked={notifPrefs.overdueReminders} onchange={saveNotifPrefs} style="width: 16px; height: 16px; accent-color: var(--color-primary);" />
						<div>
							<div style="font-weight: 600;">เตือนเอกสารเกินกำหนด</div>
							<div style="font-size: 11px; color: var(--color-gray-500);">แจ้งเตือนเมื่อมีเอกสารที่เกินกำหนดชำระ</div>
						</div>
					</label>
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px;">
						<input type="checkbox" bind:checked={notifPrefs.dailySummary} onchange={saveNotifPrefs} style="width: 16px; height: 16px; accent-color: var(--color-primary);" />
						<div>
							<div style="font-weight: 600;">สรุปรายวัน</div>
							<div style="font-size: 11px; color: var(--color-gray-500);">รายงานสรุปยอดขาย เอกสาร และการชำระเงินประจำวัน (ส่งทุกเช้า 8:00)</div>
						</div>
					</label>
				</div>
			</div>

			<div style="font-size: 12px; color: var(--color-gray-500); line-height: 1.6;">
				<p style="margin: 0 0 8px 0;"><strong>สถานะสิทธิ์:</strong>
					{#if pushPermission === 'granted'}
						<span style="color: #16a34a;">อนุญาตแล้ว</span>
					{:else if pushPermission === 'denied'}
						<span style="color: #ef4444;">ถูกบล็อก</span>
					{:else}
						<span style="color: #f59e0b;">ยังไม่ได้ตั้งค่า</span>
					{/if}
				</p>
				<p style="margin: 0 0 8px 0;">การแจ้งเตือนจะแสดงเมื่อแอดมินส่งข่าวสาร อัปเดตสำคัญ หรือมีการเปลี่ยนแปลงที่เกี่ยวข้องกับคุณ</p>
				{#if pushPermission === 'denied'}
					<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; margin-top: 4px;">
						<p style="margin: 0 0 6px 0; font-weight: 600; color: #dc2626;">วิธีเปิดการแจ้งเตือนที่ถูกบล็อก:</p>
						<p style="margin: 0 0 4px 0;"><strong>iPhone/iPad:</strong> ไปที่ การตั้งค่า → แจ้งเตือน → Grid Doc (หรือ Safari) → เปิด "อนุญาตแจ้งเตือน"</p>
						<p style="margin: 0 0 4px 0;"><strong>Android:</strong> ไปที่ การตั้งค่า → แอป → Chrome (หรือ Grid Doc) → การแจ้งเตือน → เปิดอนุญาต</p>
						<p style="margin: 0;"><strong>Desktop:</strong> คลิกไอคอนกุญแจ 🔒 ที่แถบ URL → เปลี่ยน "การแจ้งเตือน" เป็น "อนุญาต" → รีโหลดหน้า</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<StripePaymentModal
	open={showSeatPayment}
	productType="TEAM_SEAT"
	quantity={seatQty}
	onClose={() => showSeatPayment = false}
	onSuccess={handleSeatPaymentSuccess}
/>

<style>
	.tabs-container {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		border-bottom: 2px solid var(--color-gray-200);
		padding-bottom: 0;
		overflow-x: auto;
		white-space: nowrap;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	
	.tabs-container::-webkit-scrollbar {
		display: none;
	}

	.settings-tab {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--color-gray-500);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.settings-tab:hover {
		color: var(--color-gray-700);
	}

	.settings-tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	/* Account */
	.account-avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--color-gray-100);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-gray-400);
		flex-shrink: 0;
		overflow: hidden;
	}
	.account-avatar:hover .avatar-overlay {
		background: rgba(0,0,0,0.4) !important;
	}
	.account-avatar:hover .avatar-overlay-text {
		opacity: 1 !important;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 16px;
	}

	.modal-content {
		background: #fff;
		border-radius: 16px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0,0,0,0.15);
		max-height: 90vh;
		overflow-y: auto;
	}

	/* Buttons */
	.btn-danger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: #ef4444;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.btn-danger:hover { background: #dc2626; }

	.btn-icon {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
		color: var(--color-gray-400);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}
	.btn-icon:hover { background: var(--color-gray-100); color: var(--color-gray-600); }

	/* Permission checkbox */
	.perm-checkbox {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border: 1px solid var(--color-gray-200);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s;
		font-size: 13px;
	}
	.perm-checkbox:hover { background: var(--color-gray-50); }
	.perm-checkbox.checked {
		background: color-mix(in srgb, var(--color-primary) 8%, white);
		border-color: var(--color-primary);
	}
	.perm-checkbox input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: var(--color-primary);
	}
	.perm-checkbox span {
		font-weight: 500;
		color: var(--color-gray-700);
	}
</style>
