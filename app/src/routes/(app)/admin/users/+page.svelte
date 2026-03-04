<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/stores/auth';
	import { addToast } from '$lib/stores/app';
	import { get } from 'svelte/store';
	import { formatDateShort } from '$lib/utils/format';
	import { Shield, ShieldCheck, CheckCircle, XCircle, Search, Building2, FileText, Users as UsersIcon, Plus, X } from 'lucide-svelte';
	import { resolveAvatarUrl } from '$lib/utils/helpers';

	const API_BASE = import.meta.env.VITE_API_URL || '';

	let users: any[] = $state([]);
	let loading = $state(true);
	let searchQuery = $state('');

	// Grant seats dialog state
	let showGrantDialog = $state(false);
	let grantTargetUser: any = $state(null);
	let grantQty = $state(1);
	let granting = $state(false);

	onMount(async () => {
		const user = get(currentUser);
		if (!user?.isAdmin) { goto('/dashboard'); return; }
		await loadUsers();
	});

	async function loadUsers() {
		loading = true;
		try {
			const token = localStorage.getItem('auth.token');
			const res = await fetch(`${API_BASE}/api/admin/users`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const json = await res.json();
			if (json.ok) users = json.data;
		} catch {}
		loading = false;
	}

	function filteredUsers() {
		if (!searchQuery.trim()) return users;
		const q = searchQuery.toLowerCase();
		return users.filter(u =>
			u.email.toLowerCase().includes(q) ||
			u.name.toLowerCase().includes(q)
		);
	}

	const MAX_TEAM = 10;
	const FREE_SEATS = 2;

	function openGrantDialog(user: any) {
		grantTargetUser = user;
		const currentPaid = user.paidSeats || 0;
		const maxCanGrant = MAX_TEAM - FREE_SEATS - currentPaid;
		grantQty = Math.min(1, maxCanGrant);
		showGrantDialog = true;
	}

	function closeGrantDialog() {
		showGrantDialog = false;
		grantTargetUser = null;
		grantQty = 1;
	}

	async function grantSeats() {
		if (!grantTargetUser || grantQty < 1) return;
		granting = true;
		try {
			const token = localStorage.getItem('auth.token');
			const res = await fetch(`${API_BASE}/api/admin/users/${grantTargetUser.userId}/grant-seats`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ seats: grantQty }),
			});
			const json = await res.json();
			if (json.ok) {
				// Update local state
				const d = json.data;
				users = users.map(u => u.userId === grantTargetUser.userId ? {
					...u,
					paidSeats: d.totalPaidSeats,
					adminGrantedSeats: (u.adminGrantedSeats || 0) + grantQty,
				} : u);
				addToast(`เพิ่ม ${grantQty} ที่นั่งให้ ${grantTargetUser.name || grantTargetUser.email} สำเร็จ`, 'success');
				closeGrantDialog();
			} else {
				addToast(json.error?.message || 'เพิ่มที่นั่งไม่สำเร็จ', 'error');
			}
		} catch {
			addToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
		} finally {
			granting = false;
		}
	}

	async function updateUserStatus(userId: string, field: string, value: any) {
		try {
			const token = localStorage.getItem('auth.token');
			const res = await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
				method: 'PATCH',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ [field]: value }),
			});
			const json = await res.json();
			if (json.ok) {
				users = users.map(u => u.userId === userId ? { ...u, ...json.data } : u);
				addToast('อัปเดตสถานะสำเร็จ', 'success');
			} else {
				addToast(json.error?.message || 'เกิดข้อผิดพลาด', 'error');
			}
		} catch {
			addToast('ไม่สามารถอัปเดตได้', 'error');
		}
	}
</script>

<!-- Grant Seats Dialog -->
{#if showGrantDialog && grantTargetUser}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="grant-dialog-overlay" onclick={closeGrantDialog}>
		<div class="grant-dialog" onclick={(e) => e.stopPropagation()}>
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
				<h3 style="font-size: 16px; font-weight: 700; margin: 0;">เพิ่มที่นั่งสมาชิกทีม</h3>
				<button style="background: none; border: none; cursor: pointer; color: var(--color-gray-400); padding: 4px;" onclick={closeGrantDialog}>
					<X size={18} />
				</button>
			</div>

			<div style="background: #f8fafc; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
				<div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">{grantTargetUser.name || '-'}</div>
				<div style="font-size: 12px; color: var(--color-gray-500);">{grantTargetUser.email}</div>
				<div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12px;">
					<span>ฟรี: <strong>{FREE_SEATS}</strong></span>
					<span>ซื้อ/เพิ่ม: <strong>{grantTargetUser.paidSeats || 0}</strong></span>
					<span>ใช้แล้ว: <strong>{grantTargetUser.teamMemberCount || 0}</strong></span>
					<span>รวม: <strong>{FREE_SEATS + (grantTargetUser.paidSeats || 0)}</strong>/{MAX_TEAM}</span>
				</div>
			</div>

			{#if MAX_TEAM - FREE_SEATS - (grantTargetUser.paidSeats || 0) <= 0}
				<div style="text-align: center; padding: 16px; background: #fef2f2; border-radius: 8px; color: #991b1b; font-size: 13px;">
					ผู้ใช้นี้มีที่นั่งเต็มแล้ว ({MAX_TEAM} ที่นั่ง)
				</div>
			{:else}
				{@const maxCanGrant = MAX_TEAM - FREE_SEATS - (grantTargetUser.paidSeats || 0)}
				<div style="margin-bottom: 16px;">
					<label style="font-size: 13px; font-weight: 600; color: var(--color-gray-700); display: block; margin-bottom: 6px;">จำนวนที่นั่งที่ต้องการเพิ่ม</label>
					<div style="display: flex; align-items: center; gap: 8px;">
						<div style="display: flex; align-items: center; gap: 0; background: #fff; border: 1px solid var(--color-gray-200); border-radius: 8px; overflow: hidden;">
							<button style="background: none; border: none; cursor: pointer; font-size: 18px; font-weight: 700; color: var(--color-gray-500); padding: 6px 12px; border-right: 1px solid var(--color-gray-200);" onclick={() => grantQty = Math.max(1, grantQty - 1)} disabled={grantQty <= 1}>−</button>
							<span style="font-size: 16px; font-weight: 700; min-width: 36px; text-align: center; padding: 6px 4px;">{grantQty}</span>
							<button style="background: none; border: none; cursor: pointer; font-size: 18px; font-weight: 700; color: var(--color-gray-500); padding: 6px 12px; border-left: 1px solid var(--color-gray-200);" onclick={() => grantQty = Math.min(maxCanGrant, grantQty + 1)} disabled={grantQty >= maxCanGrant}>+</button>
						</div>
						<span style="font-size: 12px; color: var(--color-gray-500);">เพิ่มได้สูงสุด {maxCanGrant} ที่นั่ง</span>
					</div>
				</div>

				<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #166534;">
					หลังเพิ่ม: {FREE_SEATS + (grantTargetUser.paidSeats || 0) + grantQty} ที่นั่ง (ฟรี {FREE_SEATS} + {(grantTargetUser.paidSeats || 0) + grantQty} เพิ่ม)
				</div>

				<div style="display: flex; gap: 8px; justify-content: flex-end;">
					<button class="btn btn-outline" onclick={closeGrantDialog} style="font-size: 13px; padding: 8px 16px;">ยกเลิก</button>
					<button class="btn btn-primary" onclick={grantSeats} disabled={granting} style="font-size: 13px; padding: 8px 16px;">
						{#if granting}
							กำลังเพิ่ม...
						{:else}
							<Plus size={14} /> เพิ่ม {grantQty} ที่นั่ง
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
	<div>
		<h2 style="font-size: 20px; font-weight: 800; margin: 0 0 4px;">จัดการผู้ใช้</h2>
		<p style="font-size: 13px; color: var(--color-gray-500); margin: 0;">รายชื่อผู้ใช้ทั้งหมดในระบบ ({users.length} คน)</p>
	</div>
	<div style="position: relative; min-width: 240px;">
		<Search size={16} style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-gray-400);" />
		<input class="field-control" placeholder="ค้นหาชื่อ / อีเมล..." bind:value={searchQuery} style="padding-left: 36px;" />
	</div>
</div>

{#if loading}
	<div style="text-align: center; padding: 48px; color: var(--color-gray-400);">กำลังโหลด...</div>
{:else}
	<!-- Desktop table -->
	<div class="card admin-desktop" style="padding: 0; overflow: auto;">
		<table class="data-table">
			<thead>
				<tr>
					<th>ผู้ใช้</th>
					<th>อีเมล</th>
					<th>บริษัท</th>
					<th style="text-align: center;">เอกสาร</th>
					<th style="text-align: center;">ทีม</th>
					<th style="text-align: center;">ที่นั่ง</th>
					<th>สถานะชำระ</th>
					<th>สถานะบัญชี</th>
					<th>Admin</th>
					<th>สมัครเมื่อ</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredUsers() as u (u.userId)}
					<tr>
						<td>
							<div style="display: flex; align-items: center; gap: 8px;">
								{#if u.avatarUrl}
									<img src={resolveAvatarUrl(u.avatarUrl)} alt="" style="width: 28px; height: 28px; border-radius: 50%;" />
								{:else}
									<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--color-gray-200); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--color-gray-500);">
										{u.name?.charAt(0) || '?'}
									</div>
								{/if}
								<span style="font-weight: 600; white-space: nowrap;">{u.name || '-'}</span>
							</div>
						</td>
						<td style="font-size: 12px; color: var(--color-gray-500);">{u.email}</td>
						<td>
							{#each u.companies as comp}
								<span style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; background: var(--color-gray-100); padding: 2px 8px; border-radius: 4px; margin-right: 4px;">
									<Building2 size={10} /> {comp.name}
								</span>
							{/each}
						</td>
						<td style="text-align: center;">{u.documentCount}</td>
						<td style="text-align: center;">{u.teamMemberCount}</td>
						<td style="text-align: center;">
							<div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
								<span style="font-size: 12px;">{FREE_SEATS + (u.paidSeats || 0)}</span>
								{#if u.adminGrantedSeats > 0}
									<span style="font-size: 10px; background: #ede9fe; color: #7c3aed; padding: 1px 5px; border-radius: 4px;">+{u.adminGrantedSeats} admin</span>
								{/if}
								{#if FREE_SEATS + (u.paidSeats || 0) < MAX_TEAM}
									<button class="admin-grant-btn" onclick={() => openGrantDialog(u)} title="เพิ่มที่นั่ง">
										<Plus size={12} />
									</button>
								{/if}
							</div>
						</td>
						<td>
							<select class="field-control admin-select" value={u.billingStatus} onchange={(e) => updateUserStatus(u.userId, 'billingStatus', (e.target as HTMLSelectElement).value)}>
								<option value="UNPAID">ยังไม่ชำระ</option>
								<option value="PAID">ชำระแล้ว</option>
							</select>
						</td>
						<td>
							<button
								class="admin-toggle-btn"
								class:active={u.isActive}
								onclick={() => updateUserStatus(u.userId, 'isActive', !u.isActive)}
							>
								{#if u.isActive}
									<CheckCircle size={14} /> ใช้งาน
								{:else}
									<XCircle size={14} /> ปิด
								{/if}
							</button>
						</td>
						<td>
							<button
								class="admin-toggle-btn"
								class:admin-on={u.isAdmin}
								onclick={() => updateUserStatus(u.userId, 'isAdmin', !u.isAdmin)}
							>
								{#if u.isAdmin}
									<ShieldCheck size={14} /> Admin
								{:else}
									<Shield size={14} /> User
								{/if}
							</button>
						</td>
						<td style="white-space: nowrap; font-size: 12px; color: var(--color-gray-500);">{formatDateShort(u.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile cards -->
	<div class="admin-mobile">
		{#each filteredUsers() as u (u.userId)}
			<div class="card" style="padding: 14px; margin-bottom: 10px;">
				<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
					{#if u.avatarUrl}
						<img src={resolveAvatarUrl(u.avatarUrl)} alt="" style="width: 36px; height: 36px; border-radius: 50%;" />
					{:else}
						<div style="width: 36px; height: 36px; border-radius: 50%; background: var(--color-gray-200); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--color-gray-500);">
							{u.name?.charAt(0) || '?'}
						</div>
					{/if}
					<div style="flex: 1; min-width: 0;">
						<div style="font-weight: 700; font-size: 14px;">{u.name || '-'}</div>
						<div style="font-size: 12px; color: var(--color-gray-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{u.email}</div>
					</div>
					{#if u.isAdmin}
						<span style="background: #6366f1; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;">Admin</span>
					{/if}
				</div>

				<div style="display: flex; gap: 12px; font-size: 12px; color: var(--color-gray-500); margin-bottom: 10px; flex-wrap: wrap;">
					<span style="display: inline-flex; align-items: center; gap: 3px;"><FileText size={12} /> {u.documentCount} เอกสาร</span>
					<span style="display: inline-flex; align-items: center; gap: 3px;"><UsersIcon size={12} /> {u.teamMemberCount} ทีม</span>
					<span style="display: inline-flex; align-items: center; gap: 3px;">
						ที่นั่ง {FREE_SEATS + (u.paidSeats || 0)}/{MAX_TEAM}
						{#if u.adminGrantedSeats > 0}
							<span style="font-size: 10px; background: #ede9fe; color: #7c3aed; padding: 1px 5px; border-radius: 4px;">+{u.adminGrantedSeats} admin</span>
						{/if}
					</span>
					<span>{formatDateShort(u.createdAt)}</span>
				</div>

				{#if u.companies.length > 0}
					<div style="margin-bottom: 10px;">
						{#each u.companies as comp}
							<span style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; background: var(--color-gray-100); padding: 2px 8px; border-radius: 4px; margin-right: 4px; margin-bottom: 4px;">
								<Building2 size={10} /> {comp.name}
							</span>
						{/each}
					</div>
				{/if}

				<div style="display: flex; gap: 8px; flex-wrap: wrap;">
					<select class="field-control admin-select" value={u.billingStatus} onchange={(e) => updateUserStatus(u.userId, 'billingStatus', (e.target as HTMLSelectElement).value)} style="flex: 1;">
						<option value="UNPAID">ยังไม่ชำระ</option>
						<option value="PAID">ชำระแล้ว</option>
					</select>
					<button
						class="admin-toggle-btn"
						class:active={u.isActive}
						onclick={() => updateUserStatus(u.userId, 'isActive', !u.isActive)}
					>
						{#if u.isActive}
							<CheckCircle size={14} /> ใช้งาน
						{:else}
							<XCircle size={14} /> ปิด
						{/if}
					</button>
					{#if FREE_SEATS + (u.paidSeats || 0) < MAX_TEAM}
						<button class="admin-grant-btn-mobile" onclick={() => openGrantDialog(u)}>
							<Plus size={12} /> เพิ่มที่นั่ง
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.admin-select {
		font-size: 12px;
		padding: 5px 24px 5px 8px;
		min-width: 110px;
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
	}
	.admin-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border: 1px solid var(--color-gray-200);
		border-radius: 6px;
		background: var(--color-gray-50);
		color: var(--color-gray-500);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.admin-toggle-btn.active {
		background: #dcfce7;
		color: #16a34a;
		border-color: #86efac;
	}
	.admin-toggle-btn.admin-on {
		background: #ede9fe;
		color: #6366f1;
		border-color: #a5b4fc;
	}

	.admin-desktop { display: block; }
	.admin-mobile { display: none; }

	@media (max-width: 768px) {
		.admin-desktop { display: none !important; }
		.admin-mobile { display: block; }
	}
	.admin-grant-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: 1px solid #c4b5fd;
		border-radius: 4px;
		background: #ede9fe;
		color: #7c3aed;
		cursor: pointer;
		padding: 0;
		transition: all 0.15s;
		font-family: inherit;
	}
	.admin-grant-btn:hover {
		background: #ddd6fe;
		border-color: #a78bfa;
	}
	.admin-grant-btn-mobile {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 4px 10px;
		border: 1px solid #c4b5fd;
		border-radius: 6px;
		background: #ede9fe;
		color: #7c3aed;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.admin-grant-btn-mobile:hover {
		background: #ddd6fe;
	}
	.grant-dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.4);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.grant-dialog {
		background: #fff;
		border-radius: 16px;
		padding: 24px;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0,0,0,0.15);
	}
</style>
