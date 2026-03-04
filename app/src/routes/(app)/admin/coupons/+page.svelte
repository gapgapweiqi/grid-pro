<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/stores/auth';
	import { addToast } from '$lib/stores/app';
	import { get } from 'svelte/store';
	import { formatDateShort } from '$lib/utils/format';
	import { Ticket, Plus, Pencil, Trash2, X, Loader2, ToggleLeft, ToggleRight, Search, Copy } from 'lucide-svelte';

	const API_BASE = import.meta.env.VITE_API_URL || '';

	interface Coupon {
		couponId: string;
		code: string;
		description: string;
		discountType: 'PERCENT' | 'AMOUNT';
		discountValue: number;
		maxUses: number | null;
		usedCount: number;
		minAmount: number;
		applicableProducts: string;
		startsAt: string;
		expiresAt: string;
		isActive: boolean;
		createdAt: string;
		updatedAt: string;
	}

	let coupons: Coupon[] = $state([]);
	let loading = $state(true);
	let searchQuery = $state('');

	// Dialog state
	let showDialog = $state(false);
	let dialogMode = $state<'create' | 'edit'>('create');
	let saving = $state(false);
	let editId = $state('');

	// Form state
	let formCode = $state('');
	let formDescription = $state('');
	let formDiscountType = $state<'PERCENT' | 'AMOUNT'>('PERCENT');
	let formDiscountValue = $state(0);
	let formMaxUses = $state<number | null>(null);
	let formMinAmount = $state(0);
	let formApplicableProducts = $state('');
	let formStartsAt = $state('');
	let formExpiresAt = $state('');

	onMount(async () => {
		const user = get(currentUser);
		if (!user?.isAdmin) { goto('/dashboard'); return; }
		await loadCoupons();
	});

	async function loadCoupons() {
		loading = true;
		try {
			const token = localStorage.getItem('auth.token');
			const res = await fetch(`${API_BASE}/api/admin/coupons`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const json = await res.json();
			if (json.ok) coupons = json.data;
		} catch { addToast('โหลดข้อมูลคูปองไม่สำเร็จ', 'error'); }
		loading = false;
	}

	function filteredCoupons() {
		if (!searchQuery.trim()) return coupons;
		const q = searchQuery.toLowerCase();
		return coupons.filter(c =>
			c.code.toLowerCase().includes(q) ||
			c.description.toLowerCase().includes(q)
		);
	}

	function openCreate() {
		dialogMode = 'create';
		editId = '';
		formCode = '';
		formDescription = '';
		formDiscountType = 'PERCENT';
		formDiscountValue = 0;
		formMaxUses = null;
		formMinAmount = 0;
		formApplicableProducts = '';
		formStartsAt = '';
		formExpiresAt = '';
		showDialog = true;
	}

	function openEdit(c: Coupon) {
		dialogMode = 'edit';
		editId = c.couponId;
		formCode = c.code;
		formDescription = c.description;
		formDiscountType = c.discountType;
		formDiscountValue = c.discountValue;
		formMaxUses = c.maxUses;
		formMinAmount = c.minAmount;
		formApplicableProducts = c.applicableProducts;
		formStartsAt = c.startsAt ? c.startsAt.slice(0, 16) : '';
		formExpiresAt = c.expiresAt ? c.expiresAt.slice(0, 16) : '';
		showDialog = true;
	}

	async function handleSave() {
		if (!formCode.trim()) { addToast('กรุณากรอกรหัสคูปอง', 'error'); return; }
		if (formDiscountValue <= 0) { addToast('กรุณากรอกมูลค่าส่วนลด', 'error'); return; }
		if (formDiscountType === 'PERCENT' && formDiscountValue > 100) { addToast('ส่วนลด % ต้องไม่เกิน 100', 'error'); return; }

		saving = true;
		try {
			const token = localStorage.getItem('auth.token');
			const payload = {
				code: formCode.trim(),
				description: formDescription,
				discountType: formDiscountType,
				discountValue: formDiscountValue,
				maxUses: formMaxUses || null,
				minAmount: formMinAmount || 0,
				applicableProducts: formApplicableProducts,
				startsAt: formStartsAt ? new Date(formStartsAt).toISOString() : '',
				expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : '',
			};

			const url = dialogMode === 'create'
				? `${API_BASE}/api/admin/coupons`
				: `${API_BASE}/api/admin/coupons/${editId}`;
			const method = dialogMode === 'create' ? 'POST' : 'PATCH';

			const res = await fetch(url, {
				method,
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const json = await res.json();
			if (json.ok) {
				addToast(dialogMode === 'create' ? 'สร้างคูปองสำเร็จ' : 'แก้ไขคูปองสำเร็จ', 'success');
				showDialog = false;
				await loadCoupons();
			} else {
				addToast(json.error?.message || 'เกิดข้อผิดพลาด', 'error');
			}
		} catch { addToast('ไม่สามารถบันทึกได้', 'error'); }
		saving = false;
	}

	async function toggleActive(c: Coupon) {
		try {
			const token = localStorage.getItem('auth.token');
			await fetch(`${API_BASE}/api/admin/coupons/${c.couponId}`, {
				method: 'PATCH',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ isActive: !c.isActive }),
			});
			c.isActive = !c.isActive;
			coupons = [...coupons];
			addToast(c.isActive ? 'เปิดใช้งานคูปอง' : 'ปิดใช้งานคูปอง', 'success');
		} catch { addToast('เกิดข้อผิดพลาด', 'error'); }
	}

	async function handleDelete(c: Coupon) {
		if (!confirm(`ลบคูปอง "${c.code}" ?`)) return;
		try {
			const token = localStorage.getItem('auth.token');
			const res = await fetch(`${API_BASE}/api/admin/coupons/${c.couponId}`, {
				method: 'DELETE',
				headers: { 'Authorization': `Bearer ${token}` },
			});
			const json = await res.json();
			if (json.ok) {
				addToast('ลบคูปองสำเร็จ', 'success');
				await loadCoupons();
			}
		} catch { addToast('ลบไม่สำเร็จ', 'error'); }
	}

	function copyCode(code: string) {
		navigator.clipboard.writeText(code);
		addToast(`คัดลอก "${code}" แล้ว`, 'success');
	}

	function formatDiscount(c: Coupon) {
		return c.discountType === 'PERCENT' ? `${c.discountValue}%` : `฿${c.discountValue.toLocaleString()}`;
	}
</script>

<svelte:head><title>จัดการคูปอง — Admin</title></svelte:head>

<div class="cp-page">
	<div class="cp-header">
		<div class="cp-title-row">
			<Ticket size={24} />
			<h1>จัดการคูปอง / โค้ดส่วนลด</h1>
		</div>
		<button class="cp-btn cp-btn-primary" onclick={openCreate}>
			<Plus size={16} /> สร้างคูปอง
		</button>
	</div>

	<!-- Search -->
	<div class="cp-search">
		<Search size={16} />
		<input type="text" placeholder="ค้นหาคูปอง..." bind:value={searchQuery} />
	</div>

	{#if loading}
		<div class="cp-center"><Loader2 size={28} class="cp-spin" /> กำลังโหลด...</div>
	{:else if coupons.length === 0}
		<div class="cp-center cp-empty">
			<Ticket size={48} strokeWidth={1} />
			<p>ยังไม่มีคูปอง</p>
			<button class="cp-btn cp-btn-primary" onclick={openCreate}><Plus size={16} /> สร้างคูปองแรก</button>
		</div>
	{:else}
		<div class="cp-grid">
			{#each filteredCoupons() as c (c.couponId)}
				<div class="cp-card" class:cp-inactive={!c.isActive}>
					<div class="cp-card-top">
						<div class="cp-code-row">
							<span class="cp-code">{c.code}</span>
							<button class="cp-icon-btn" onclick={() => copyCode(c.code)} title="คัดลอก"><Copy size={14} /></button>
						</div>
						<button class="cp-icon-btn" onclick={() => toggleActive(c)} title={c.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
							{#if c.isActive}
								<ToggleRight size={22} color="#16a34a" />
							{:else}
								<ToggleLeft size={22} color="#94a3b8" />
							{/if}
						</button>
					</div>

					<div class="cp-discount">{formatDiscount(c)}</div>
					{#if c.description}<p class="cp-desc">{c.description}</p>{/if}

					<div class="cp-meta">
						<span>ใช้แล้ว: <strong>{c.usedCount}</strong>{c.maxUses ? ` / ${c.maxUses}` : ''}</span>
						{#if c.applicableProducts}
							<span>สินค้า: {c.applicableProducts}</span>
						{/if}
						{#if c.expiresAt}
							<span>หมดอายุ: {formatDateShort(c.expiresAt)}</span>
						{/if}
					</div>

					<div class="cp-actions">
						<button class="cp-btn cp-btn-sm cp-btn-outline" onclick={() => openEdit(c)}>
							<Pencil size={13} /> แก้ไข
						</button>
						<button class="cp-btn cp-btn-sm cp-btn-danger" onclick={() => handleDelete(c)}>
							<Trash2 size={13} /> ลบ
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Dialog -->
{#if showDialog}
<div class="cp-backdrop" onclick={() => showDialog = false} onkeydown={(e) => { if (e.key === 'Escape') showDialog = false; }} role="dialog" tabindex="-1">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="cp-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
		<div class="cp-dialog-header">
			<h2>{dialogMode === 'create' ? 'สร้างคูปอง' : 'แก้ไขคูปอง'}</h2>
			<button class="cp-icon-btn" onclick={() => showDialog = false}><X size={18} /></button>
		</div>

		<div class="cp-dialog-body">
			<label class="cp-field">
				<span>รหัสคูปอง <em>*</em></span>
				<input type="text" bind:value={formCode} placeholder="เช่น WELCOME50" style="text-transform: uppercase" />
			</label>

			<label class="cp-field">
				<span>คำอธิบาย</span>
				<input type="text" bind:value={formDescription} placeholder="เช่น ส่วนลด 50% สำหรับลูกค้าใหม่" />
			</label>

			<div class="cp-row">
				<label class="cp-field" style="flex:1">
					<span>ประเภทส่วนลด</span>
					<select bind:value={formDiscountType}>
						<option value="PERCENT">เปอร์เซ็นต์ (%)</option>
						<option value="AMOUNT">จำนวนเงิน (฿)</option>
					</select>
				</label>
				<label class="cp-field" style="flex:1">
					<span>มูลค่า <em>*</em></span>
					<input type="number" bind:value={formDiscountValue} min="0" max={formDiscountType === 'PERCENT' ? 100 : 99999} />
				</label>
			</div>

			<div class="cp-row">
				<label class="cp-field" style="flex:1">
					<span>จำนวนสูงสุดที่ใช้ได้</span>
					<input type="number" bind:value={formMaxUses} min="0" placeholder="ไม่จำกัด" />
				</label>
				<label class="cp-field" style="flex:1">
					<span>ยอดขั้นต่ำ (฿)</span>
					<input type="number" bind:value={formMinAmount} min="0" />
				</label>
			</div>

			<label class="cp-field">
				<span>ใช้ได้กับสินค้า</span>
				<select bind:value={formApplicableProducts}>
					<option value="">ทั้งหมด</option>
					<option value="OWNER_ACCESS">Owner Access เท่านั้น</option>
					<option value="TEAM_SEAT">Team Seat เท่านั้น</option>
					<option value="OWNER_ACCESS,TEAM_SEAT">ทั้ง Owner + Team</option>
				</select>
			</label>

			<div class="cp-row">
				<label class="cp-field" style="flex:1">
					<span>เริ่มใช้ได้ตั้งแต่</span>
					<input type="datetime-local" bind:value={formStartsAt} />
				</label>
				<label class="cp-field" style="flex:1">
					<span>หมดอายุ</span>
					<input type="datetime-local" bind:value={formExpiresAt} />
				</label>
			</div>
		</div>

		<div class="cp-dialog-footer">
			<button class="cp-btn cp-btn-outline" onclick={() => showDialog = false}>ยกเลิก</button>
			<button class="cp-btn cp-btn-primary" onclick={handleSave} disabled={saving}>
				{#if saving}<Loader2 size={14} class="cp-spin" />{/if}
				{dialogMode === 'create' ? 'สร้าง' : 'บันทึก'}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.cp-page { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
	.cp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
	.cp-title-row { display: flex; align-items: center; gap: 10px; }
	.cp-title-row h1 { font-size: 20px; font-weight: 700; margin: 0; color: var(--color-text, #1e293b); }

	.cp-search { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--color-surface, #fff); border: 1px solid var(--color-border, #e2e8f0); border-radius: 10px; margin-bottom: 20px; }
	.cp-search input { flex: 1; border: none; outline: none; font-size: 14px; background: transparent; font-family: inherit; color: var(--color-text, #1e293b); }

	.cp-center { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 0; color: #94a3b8; }
	.cp-empty p { font-size: 15px; }
	:global(.cp-spin) { animation: cpspin 1s linear infinite; }
	@keyframes cpspin { to { transform: rotate(360deg); } }

	.cp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

	.cp-card {
		background: var(--color-surface, #fff); border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;
		transition: all 0.15s;
	}
	.cp-card:hover { border-color: #16a34a; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
	.cp-inactive { opacity: 0.55; }

	.cp-card-top { display: flex; align-items: center; justify-content: space-between; }
	.cp-code-row { display: flex; align-items: center; gap: 6px; }
	.cp-code { font-family: monospace; font-size: 16px; font-weight: 700; color: #16a34a; letter-spacing: 1px; }

	.cp-discount { font-size: 24px; font-weight: 800; color: var(--color-text, #1e293b); }
	.cp-desc { font-size: 13px; color: #64748b; margin: 0; }

	.cp-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #94a3b8; }
	.cp-meta strong { color: var(--color-text, #1e293b); }

	.cp-actions { display: flex; gap: 8px; margin-top: 4px; }

	.cp-icon-btn { background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; color: #64748b; }
	.cp-icon-btn:hover { color: #1e293b; }

	/* Buttons */
	.cp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; }
	.cp-btn-primary { background: #16a34a; color: #fff; }
	.cp-btn-primary:hover { background: #15803d; }
	.cp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.cp-btn-outline { background: var(--color-surface, #fff); border: 1px solid var(--color-border, #e2e8f0); color: var(--color-text, #1e293b); }
	.cp-btn-outline:hover { background: #f8fafc; }
	.cp-btn-danger { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
	.cp-btn-danger:hover { background: #fee2e2; }
	.cp-btn-sm { padding: 5px 10px; font-size: 12px; }

	/* Dialog */
	.cp-backdrop {
		position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,0.4);
		display: flex; align-items: center; justify-content: center; padding: 16px;
	}
	.cp-dialog {
		background: var(--color-surface, #fff); border-radius: 14px; width: 100%; max-width: 520px;
		max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
	}
	.cp-dialog-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 16px 20px; border-bottom: 1px solid var(--color-border, #e2e8f0);
	}
	.cp-dialog-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
	.cp-dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
	.cp-dialog-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--color-border, #e2e8f0); }

	.cp-field { display: flex; flex-direction: column; gap: 4px; }
	.cp-field span { font-size: 12px; font-weight: 600; color: #64748b; }
	.cp-field em { color: #dc2626; font-style: normal; }
	.cp-field input, .cp-field select {
		padding: 8px 12px; border: 1px solid var(--color-border, #e2e8f0); border-radius: 8px;
		font-size: 14px; font-family: inherit; outline: none; transition: border 0.15s;
		background: var(--color-surface, #fff); color: var(--color-text, #1e293b);
	}
	.cp-field input:focus, .cp-field select:focus { border-color: #16a34a; }

	.cp-row { display: flex; gap: 12px; }

	@media (max-width: 640px) {
		.cp-grid { grid-template-columns: 1fr; }
		.cp-row { flex-direction: column; gap: 14px; }
	}
</style>
