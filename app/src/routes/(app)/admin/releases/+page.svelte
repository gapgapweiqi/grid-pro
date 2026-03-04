<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/stores/auth';
	import { get } from 'svelte/store';
	import { Package, Plus, Trash2, ToggleLeft, ToggleRight, Apple, Monitor, ChevronLeft } from 'lucide-svelte';

	const API_BASE = import.meta.env.VITE_API_URL || '';

	interface Release {
		id: string;
		version: string;
		target: string;
		downloadUrl: string;
		signature: string;
		notes: string;
		pubDate: string;
		isActive: boolean;
		createdAt: string;
	}

	let releases: Release[] = $state([]);
	let loading = $state(true);
	let saving = $state(false);
	let showForm = $state(false);
	let error = $state('');

	// Form fields
	let formVersion = $state('');
	let formTarget = $state('darwin-aarch64');
	let formDownloadUrl = $state('');
	let formSignature = $state('');
	let formNotes = $state('');

	const TARGET_OPTIONS = [
		{ value: 'darwin-aarch64', label: 'macOS (Apple Silicon)' },
		{ value: 'darwin-x86_64', label: 'macOS (Intel)' },
		{ value: 'windows-x86_64', label: 'Windows (64-bit)' },
	];

	function getToken() {
		return localStorage.getItem('auth.token') || '';
	}

	async function apiFetch(path: string, opts: RequestInit = {}) {
		const res = await fetch(`${API_BASE}${path}`, {
			...opts,
			headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
		});
		return res.json();
	}

	onMount(async () => {
		const user = get(currentUser);
		if (!user?.isAdmin) { goto('/dashboard'); return; }
		await loadReleases();
	});

	async function loadReleases() {
		loading = true;
		error = '';
		try {
			const res = await apiFetch('/api/admin/releases');
			if (res.ok) releases = res.data;
			else error = res.error?.message || 'โหลดข้อมูลไม่สำเร็จ';
		} catch { error = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; }
		loading = false;
	}

	async function createRelease() {
		if (!formVersion.trim() || !formDownloadUrl.trim() || !formSignature.trim()) {
			error = 'กรุณากรอกข้อมูลให้ครบ (version, URL, signature)';
			return;
		}
		saving = true;
		error = '';
		try {
			const res = await apiFetch('/api/admin/releases', {
				method: 'POST',
				body: JSON.stringify({
					version: formVersion.trim(),
					target: formTarget,
					downloadUrl: formDownloadUrl.trim(),
					signature: formSignature.trim(),
					notes: formNotes.trim(),
				}),
			});
			if (res.ok) {
				resetForm();
				showForm = false;
				await loadReleases();
			} else {
				error = res.error?.message || 'สร้าง release ไม่สำเร็จ';
			}
		} catch { error = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; }
		saving = false;
	}

	async function toggleActive(rel: Release) {
		try {
			await apiFetch(`/api/admin/releases/${rel.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ isActive: !rel.isActive }),
			});
			await loadReleases();
		} catch {}
	}

	async function deleteRelease(rel: Release) {
		if (!confirm(`ลบ release ${rel.version} (${rel.target})?`)) return;
		try {
			await apiFetch(`/api/admin/releases/${rel.id}`, { method: 'DELETE' });
			await loadReleases();
		} catch {}
	}

	function resetForm() {
		formVersion = '';
		formTarget = 'darwin-aarch64';
		formDownloadUrl = '';
		formSignature = '';
		formNotes = '';
		error = '';
	}

	function targetLabel(t: string) {
		return TARGET_OPTIONS.find(o => o.value === t)?.label || t;
	}

	function formatDate(iso: string) {
		if (!iso) return '-';
		try { return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
		catch { return iso; }
	}
</script>

<div style="margin-bottom: 16px;">
	<button onclick={() => goto('/admin')} style="display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--color-gray-500); cursor: pointer; font-size: 13px; padding: 0; margin-bottom: 8px;">
		<ChevronLeft size={16} /> กลับ Admin
	</button>
	<div style="display: flex; align-items: center; justify-content: space-between;">
		<div>
			<h2 style="font-size: 20px; font-weight: 800; margin: 0 0 4px;">App Releases</h2>
			<p style="font-size: 13px; color: var(--color-gray-500); margin: 0;">จัดการเวอร์ชันแอปพลิเคชัน Tauri (macOS / Windows)</p>
		</div>
		<button onclick={() => { showForm = !showForm; if (showForm) resetForm(); }}
			style="display: inline-flex; align-items: center; gap: 6px; background: #16a34a; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
			<Plus size={16} /> เพิ่ม Release
		</button>
	</div>
</div>

{#if error}
	<div style="background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px;">{error}</div>
{/if}

{#if showForm}
	<div style="background: var(--color-gray-50, #f9fafb); border: 1px solid var(--color-gray-200, #e5e7eb); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
		<h3 style="font-size: 15px; font-weight: 700; margin: 0 0 16px;">สร้าง Release ใหม่</h3>
		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
			<div>
				<label style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Version</label>
				<input bind:value={formVersion} placeholder="0.2.0" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-gray-300, #d1d5db); border-radius: 8px; font-size: 14px; box-sizing: border-box;" />
			</div>
			<div>
				<label style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Target Platform</label>
				<select bind:value={formTarget} style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-gray-300, #d1d5db); border-radius: 8px; font-size: 14px; box-sizing: border-box; background: #fff;">
					{#each TARGET_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		</div>
		<div style="margin-bottom: 12px;">
			<label style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Download URL</label>
			<input bind:value={formDownloadUrl} placeholder="https://api.grid-doc.com/api/downloads/Grid-Pro_0.2.0_aarch64.app.tar.gz" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-gray-300, #d1d5db); border-radius: 8px; font-size: 14px; box-sizing: border-box;" />
		</div>
		<div style="margin-bottom: 12px;">
			<label style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Signature (.sig content)</label>
			<textarea bind:value={formSignature} rows={3} placeholder="dW50cnVzdGVkIGNvbW1lbnQ6..." style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-gray-300, #d1d5db); border-radius: 8px; font-size: 13px; font-family: monospace; box-sizing: border-box; resize: vertical;"></textarea>
		</div>
		<div style="margin-bottom: 16px;">
			<label style="font-size: 12px; font-weight: 600; color: var(--color-gray-600); display: block; margin-bottom: 4px;">Release Notes (optional)</label>
			<input bind:value={formNotes} placeholder="Bug fixes and improvements" style="width: 100%; padding: 8px 12px; border: 1px solid var(--color-gray-300, #d1d5db); border-radius: 8px; font-size: 14px; box-sizing: border-box;" />
		</div>
		<div style="display: flex; gap: 8px;">
			<button onclick={createRelease} disabled={saving}
				style="background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; opacity: {saving ? 0.6 : 1};">
				{saving ? 'กำลังบันทึก...' : 'บันทึก Release'}
			</button>
			<button onclick={() => { showForm = false; error = ''; }}
				style="background: var(--color-gray-200, #e5e7eb); color: var(--color-gray-700, #374151); border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
				ยกเลิก
			</button>
		</div>
	</div>
{/if}

{#if loading}
	<div style="text-align: center; padding: 48px; color: var(--color-gray-400);">กำลังโหลด...</div>
{:else if releases.length === 0}
	<div style="text-align: center; padding: 48px; color: var(--color-gray-400);">
		<Package size={40} style="margin-bottom: 8px; opacity: 0.4;" />
		<p style="margin: 0;">ยังไม่มี release — กดปุ่ม "เพิ่ม Release" เพื่อเริ่มต้น</p>
	</div>
{:else}
	<div style="overflow-x: auto;">
		<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
			<thead>
				<tr style="border-bottom: 2px solid var(--color-gray-200, #e5e7eb); text-align: left;">
					<th style="padding: 10px 12px; font-weight: 700; color: var(--color-gray-600);">Version</th>
					<th style="padding: 10px 12px; font-weight: 700; color: var(--color-gray-600);">Platform</th>
					<th style="padding: 10px 12px; font-weight: 700; color: var(--color-gray-600);">สถานะ</th>
					<th style="padding: 10px 12px; font-weight: 700; color: var(--color-gray-600);">Notes</th>
					<th style="padding: 10px 12px; font-weight: 700; color: var(--color-gray-600);">วันที่</th>
					<th style="padding: 10px 8px; font-weight: 700; color: var(--color-gray-600); text-align: right;">จัดการ</th>
				</tr>
			</thead>
			<tbody>
				{#each releases as rel}
					<tr style="border-bottom: 1px solid var(--color-gray-100, #f3f4f6);">
						<td style="padding: 10px 12px; font-weight: 700; font-family: monospace;">v{rel.version}</td>
						<td style="padding: 10px 12px;">
							<span style="display: inline-flex; align-items: center; gap: 4px; background: {rel.target.includes('darwin') ? '#f0fdf4' : '#eff6ff'}; color: {rel.target.includes('darwin') ? '#166534' : '#1e40af'}; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">
								{#if rel.target.includes('darwin')}<Apple size={13} />{:else}<Monitor size={13} />{/if}
								{targetLabel(rel.target)}
							</span>
						</td>
						<td style="padding: 10px 12px;">
							{#if rel.isActive}
								<span style="background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">Active</span>
							{:else}
								<span style="background: #f3f4f6; color: #6b7280; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">Inactive</span>
							{/if}
						</td>
						<td style="padding: 10px 12px; color: var(--color-gray-500); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{rel.notes || '-'}</td>
						<td style="padding: 10px 12px; color: var(--color-gray-500); white-space: nowrap;">{formatDate(rel.createdAt)}</td>
						<td style="padding: 10px 8px; text-align: right; white-space: nowrap;">
							<button onclick={() => toggleActive(rel)} title={rel.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
								style="background: none; border: none; cursor: pointer; padding: 4px; color: {rel.isActive ? '#16a34a' : '#9ca3af'};">
								{#if rel.isActive}<ToggleRight size={20} />{:else}<ToggleLeft size={20} />{/if}
							</button>
							<button onclick={() => deleteRelease(rel)} title="ลบ"
								style="background: none; border: none; cursor: pointer; padding: 4px; color: #ef4444;">
								<Trash2 size={16} />
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
