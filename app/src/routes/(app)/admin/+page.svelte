<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/stores/auth';
	import { get } from 'svelte/store';
	import { formatMoney } from '$lib/utils/format';
	import { Users, FileText, Building2, CreditCard, TrendingUp, UserPlus, DollarSign, UserCheck } from 'lucide-svelte';

	const API_BASE = import.meta.env.VITE_API_URL || '';

	let kpi: any = $state(null);
	let loading = $state(true);

	onMount(async () => {
		const user = get(currentUser);
		if (!user?.isAdmin) { goto('/dashboard'); return; }
		await loadKpi();
	});

	async function loadKpi() {
		loading = true;
		try {
			const token = localStorage.getItem('auth.token');
			const res = await fetch(`${API_BASE}/api/admin/kpi`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const json = await res.json();
			if (json.ok) kpi = json.data;
		} catch {}
		loading = false;
	}
</script>

<div style="margin-bottom: 24px;">
	<h2 style="font-size: 20px; font-weight: 800; margin: 0 0 4px;">Admin Dashboard</h2>
	<p style="font-size: 13px; color: var(--color-gray-500); margin: 0;">ภาพรวมระบบทั้งหมด</p>
</div>

{#if loading}
	<div style="text-align: center; padding: 48px; color: var(--color-gray-400);">กำลังโหลด...</div>
{:else if kpi}
	<div class="admin-kpi-grid">
		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #ede9fe; color: #7c3aed;">
				<Users size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{kpi.totalUsers}</div>
				<div class="admin-kpi-label">ผู้ใช้ทั้งหมด</div>
			</div>
		</div>

		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #dcfce7; color: #16a34a;">
				<UserCheck size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{kpi.activeUsers}</div>
				<div class="admin-kpi-label">ใช้งานอยู่</div>
			</div>
		</div>

		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #dbeafe; color: #2563eb;">
				<CreditCard size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{kpi.paidUsers}</div>
				<div class="admin-kpi-label">ชำระแล้ว</div>
			</div>
		</div>

		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #fef3c7; color: #d97706;">
				<TrendingUp size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{kpi.unpaidUsers}</div>
				<div class="admin-kpi-label">ยังไม่ชำระ</div>
			</div>
		</div>

		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #fce7f3; color: #db2777;">
				<FileText size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{kpi.totalDocuments}</div>
				<div class="admin-kpi-label">เอกสารทั้งหมด</div>
			</div>
		</div>

		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #e0f2fe; color: #0284c7;">
				<Building2 size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{kpi.totalCompanies}</div>
				<div class="admin-kpi-label">บริษัท</div>
			</div>
		</div>

		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #f0fdf4; color: #15803d;">
				<DollarSign size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{formatMoney(kpi.totalRevenue)}</div>
				<div class="admin-kpi-label">รายได้รวม (THB)</div>
			</div>
		</div>

		<div class="admin-kpi-card">
			<div class="admin-kpi-icon" style="background: #fef9c3; color: #a16207;">
				<UserPlus size={22} />
			</div>
			<div class="admin-kpi-info">
				<div class="admin-kpi-value">{kpi.recentSignups}</div>
				<div class="admin-kpi-label">สมัครใหม่ 30 วัน</div>
			</div>
		</div>
	</div>

	<div style="margin-top: 20px;">
		<a href="/admin/users" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
			<Users size={16} /> จัดการผู้ใช้
		</a>
	</div>
{/if}

<style>
	.admin-kpi-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}
	@media (max-width: 900px) {
		.admin-kpi-grid { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 480px) {
		.admin-kpi-grid { grid-template-columns: 1fr; }
	}
	.admin-kpi-card {
		background: var(--color-card-bg, #fff);
		border-radius: 12px;
		padding: 18px;
		display: flex;
		align-items: center;
		gap: 14px;
		border: 1px solid var(--color-border, #e2e8f0);
	}
	.admin-kpi-icon {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.admin-kpi-info {
		min-width: 0;
	}
	.admin-kpi-value {
		font-size: 22px;
		font-weight: 800;
		color: var(--color-gray-800, #1e293b);
		line-height: 1.2;
	}
	.admin-kpi-label {
		font-size: 12px;
		color: var(--color-gray-500, #64748b);
		margin-top: 2px;
	}
</style>
