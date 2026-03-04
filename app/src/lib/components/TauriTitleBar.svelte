<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/stores/auth';
	import { isTauri } from '$lib/utils/platform';
	import { RefreshCw, User, CheckCircle, Download } from 'lucide-svelte';
	import { resolveAvatarUrl } from '$lib/utils/helpers';

	let inTauri = $state(false);
	let appVersion = $state('0.1.0');
	let updateAvailable = $state(false);
	let updateChecking = $state(false);
	let updateDownloading = $state(false);
	let updateStatusMsg = $state('');

	onMount(() => {
		inTauri = isTauri();
		if (!inTauri) return;
		loadVersion();
		setTimeout(() => checkForUpdate(), 5000);
	});

	async function loadVersion() {
		try {
			const { getVersion } = await import('@tauri-apps/api/app');
			appVersion = await getVersion();
		} catch {}
	}

	async function checkForUpdate() {
		if (updateChecking) return;
		updateChecking = true;
		updateStatusMsg = '';
		try {
			const { check } = await import('@tauri-apps/plugin-updater');
			const update = await check();
			if (update && update.version) {
				updateAvailable = true;
			} else {
				updateStatusMsg = `v${appVersion} เป็นเวอร์ชันล่าสุด`;
				setTimeout(() => { updateStatusMsg = ''; }, 4000);
			}
		} catch (e: any) {
			const msg = e?.message || String(e) || '';
			const isNetwork = /fetch|network|dns|timeout|abort|connection|ECONNREFUSED/i.test(msg);
			updateStatusMsg = isNetwork ? 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต' : 'ตรวจสอบไม่สำเร็จ';
			setTimeout(() => { updateStatusMsg = ''; }, 5000);
			console.error('[tauri] Update check error:', msg);
		} finally { updateChecking = false; }
	}

	async function doUpdate() {
		updateDownloading = true;
		updateStatusMsg = '';
		try {
			const { check } = await import('@tauri-apps/plugin-updater');
			const update = await check();
			if (update) {
				await update.downloadAndInstall();
				const { relaunch } = await import('@tauri-apps/plugin-process');
				await relaunch();
			} else {
				updateDownloading = false;
				updateStatusMsg = 'ไม่พบอัพเดท';
				setTimeout(() => { updateStatusMsg = ''; }, 3000);
			}
		} catch (e: any) {
			updateDownloading = false;
			updateStatusMsg = e?.message || 'อัพเดทไม่สำเร็จ';
			setTimeout(() => { updateStatusMsg = ''; }, 4000);
		}
	}
</script>

{#if inTauri}
<div class="tbar">
	<div class="tbar-l">
		<span class="tbar-name">Grid Pro</span>
		<span class="tbar-ver">v{appVersion}</span>
	</div>
	<div class="tbar-r">
		{#if $currentUser}
			<div class="tbar-user">
				{#if $currentUser.avatarUrl}
					<img src={resolveAvatarUrl($currentUser.avatarUrl)} alt="" class="tbar-av" />
				{:else}
					<div class="tbar-av-ph"><User size={12} /></div>
				{/if}
				<span class="tbar-uname">{$currentUser.name || $currentUser.email || ''}</span>
			</div>
		{/if}
		{#if updateStatusMsg}
			<span class="tbar-upd msg">{updateStatusMsg}</span>
		{/if}
		{#if updateDownloading}
			<span class="tbar-upd dl"><RefreshCw size={12} class="spin" /> กำลังอัพเดท...</span>
		{:else if updateAvailable}
			<button class="tbar-upd avail" onclick={doUpdate}><Download size={14} /> อัพเดทพร้อม!</button>
		{:else}
			<button class="tbar-upd chk" onclick={checkForUpdate} title="ตรวจสอบอัพเดท">
				{#if updateChecking}<RefreshCw size={12} class="spin" /> กำลังตรวจสอบ...{:else}<RefreshCw size={12} /> ตรวจสอบอัพเดท{/if}
			</button>
		{/if}
	</div>
</div>
{/if}

<style>
.tbar{display:flex;align-items:center;justify-content:space-between;padding:4px 16px;height:30px;background:#0f1f17;color:#a3b8a8;font-size:11px;user-select:none;-webkit-app-region:drag}
.tbar-l{display:flex;align-items:center;gap:8px}
.tbar-name{font-weight:700;color:#e0efe4;letter-spacing:.3px}
.tbar-ver{font-size:10px;color:#6b8c73}
.tbar-r{display:flex;align-items:center;gap:10px;-webkit-app-region:no-drag}
.tbar-user{display:flex;align-items:center;gap:6px}
.tbar-av{width:18px;height:18px;border-radius:50%;object-fit:cover}
.tbar-av-ph{width:18px;height:18px;border-radius:50%;background:#1a3d28;display:flex;align-items:center;justify-content:center;color:#6b8c73}
.tbar-uname{font-size:11px;color:#c0d4c6;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tbar-upd{display:flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;border:none;cursor:pointer;font-family:inherit;background:transparent;color:#6b8c73}
.tbar-upd.avail{background:#4ade80;color:#052e16;animation:pulse 2s infinite}
.tbar-upd.avail:hover{background:#86efac}
.tbar-upd.dl{background:#1e3a5f;color:#93c5fd;cursor:default}
.tbar-upd.chk:hover{color:#a3b8a8}
.tbar-upd.msg{color:#93c5fd;font-size:10px;cursor:default}
:global(.spin){animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.4)}50%{box-shadow:0 0 0 4px rgba(74,222,128,0)}}
</style>
