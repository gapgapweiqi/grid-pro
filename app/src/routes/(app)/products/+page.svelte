<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/services/api';
	import { currentCompanyId, activeCompanyIds, addToast, setTopbarActions, clearTopbarActions } from '$lib/stores/app';
	import type { Product } from '$lib/types';
	import { Plus, Search, Trash2, Upload, Download, Pencil, Package, AlertTriangle, ArrowUpDown, Filter, TrendingUp, Banknote, FileText, Lock } from 'lucide-svelte';
	import { formatMoney } from '$lib/utils/format';
	import { exportCsv, parseCsv, readFileAsText, PRODUCT_CSV_COLUMNS } from '$lib/utils/csv';
	import { isSandbox, SANDBOX_LOCKED_PRODUCT_ID } from '$lib/stores/sandbox';
	import SandboxUpgradeDialog from '$lib/components/SandboxUpgradeDialog.svelte';

	let products: Product[] = $state([]);
	let fileInput: HTMLInputElement;
	let searchQuery = $state('');
	let selectedIds: Set<string> = $state(new Set());
	let showForm = $state(false);
	let editingProduct: Product | null = $state(null);

	// Form fields
	let formCode = $state('');
	let formName = $state('');
	let formCategory = $state('สินค้า');
	let formDescription = $state('');
	let formUnit = $state('');
	let formPrice = $state(0);
	let formPurchasePrice = $state(0);
	let formTaxRate = $state<'none' | '3' | '7' | 'custom'>('none');
	let formTaxRateCustom = $state(0);
	let formStockEnabled = $state(false);
	let formStockQty = $state(0);
	let formMinStock = $state(0);

	// Filters
	let filterCategory = $state('');
	let filterStockStatus = $state('all');

	// Derived KPI
	let productItems = $derived(products.filter(p => p.json?.category === 'สินค้า'));
	let stockProducts = $derived(productItems.filter(p => p.json?.stockEnabled));
	let totalStockItems = $derived(stockProducts.length);
	let totalStockValue = $derived(stockProducts.reduce((s, p) => s + ((p.json?.stockQty || 0) * (p.json?.purchasePrice || p.json?.price || 0)), 0));
	let lowStockProducts = $derived(stockProducts.filter(p => {
		const qty = (p.json?.stockQty || 0) as number;
		const min = (p.json?.minStock || 0) as number;
		return min > 0 && qty <= min;
	}));
	let categories = $derived([...new Set(products.map(p => (p.json.category as string) || '').filter(Boolean))]);

	// Stock adjustment modal
	let showStockAdjust = $state(false);
	let showUpgradeDialog = $state(false);
	let adjustProduct: Product | null = $state(null);
	let adjustQty = $state(0);
	let adjustType: 'IN' | 'OUT' | 'ADJUST' = $state('ADJUST');
	let adjustReason = $state('');

	let companyUnsubscribe: () => void;

	onMount(async () => {
		companyUnsubscribe = activeCompanyIds.subscribe(async (ids) => {
			const validIds = ids.filter(Boolean);
			if (validIds.length) {
				const results = await Promise.all(validIds.map(id => api.listProducts(id)));
				products = results.flat();
			} else {
				products = [];
			}
		});

		setTopbarActions([
			{ label: 'เพิ่มสินค้า', icon: Plus, primary: true, onClick: openAdd }
		]);
	});

	onDestroy(() => {
		if (companyUnsubscribe) companyUnsubscribe();
		clearTopbarActions();
	});

	$effect(() => {
		// Reactive filtered list
	});

	function filteredProducts(): Product[] {
		let result = products;
		// Text search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(p =>
				p.name.toLowerCase().includes(q) ||
				p.code.toLowerCase().includes(q) ||
				(p.json.category || '').toString().toLowerCase().includes(q)
			);
		}
		// Category filter
		if (filterCategory) {
			result = result.filter(p => (p.json.category || '') === filterCategory);
		}
		// Stock status filter
		if (filterStockStatus === 'enabled') {
			result = result.filter(p => p.json.stockEnabled);
		} else if (filterStockStatus === 'low') {
			result = result.filter(p => isLowStock(p));
		} else if (filterStockStatus === 'out') {
			result = result.filter(p => p.json.stockEnabled && (p.json.stockQty || 0) === 0);
		}
		return result;
	}

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		const filtered = filteredProducts();
		if (selectedIds.size === filtered.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(filtered.map(p => p.entityId));
		}
	}

	function openAdd() {
		editingProduct = null;
		formCode = '';
		formName = '';
		formCategory = 'สินค้า';
		formDescription = '';
		formUnit = '';
		formPrice = 0;
		formPurchasePrice = 0;
		formTaxRate = 'none';
		formTaxRateCustom = 0;
		formStockEnabled = false;
		formStockQty = 0;
		formMinStock = 0;
		showForm = true;
	}

	function openEdit(p: Product) {
		if ($isSandbox && p.entityId === SANDBOX_LOCKED_PRODUCT_ID) {
			showUpgradeDialog = true;
			return;
		}
		editingProduct = p;
		formCode = p.code;
		formName = p.name;
		formCategory = (p.json.category as string) || 'สินค้า';
		formDescription = (p.json.description as string) || '';
		formUnit = (p.json.unit as string) || '';
		formPrice = (p.json.price as number) || 0;
		formPurchasePrice = (p.json.purchasePrice as number) || 0;
		const tr = p.json.taxRate as string | undefined;
		if (tr === '3' || tr === '7') formTaxRate = tr;
		else if (tr === 'none' || !tr) formTaxRate = 'none';
		else { formTaxRate = 'custom'; formTaxRateCustom = parseFloat(tr) || 0; }
		formStockEnabled = p.json.stockEnabled || false;
		formStockQty = (p.json.stockQty as number) || 0;
		formMinStock = (p.json.minStock as number) || 0;
		showForm = true;
	}

	function openStockAdjust(p: Product) {
		adjustProduct = p;
		adjustQty = 0;
		adjustType = 'ADJUST';
		adjustReason = '';
		showStockAdjust = true;
	}

	async function saveStockAdjust() {
		if (!adjustProduct || adjustQty === 0) return;
		const currentQty = (adjustProduct.json.stockQty as number) || 0;
		let newQty = currentQty;
		if (adjustType === 'IN') newQty = currentQty + Math.abs(adjustQty);
		else if (adjustType === 'OUT') newQty = currentQty - Math.abs(adjustQty);
		else newQty = adjustQty;

		const logs = (adjustProduct.json.stockLogs as any[]) || [];
		logs.push({ date: new Date().toISOString(), qty: adjustQty, type: adjustType, reason: adjustReason });

		const result = await api.upsertProduct({
			companyId: adjustProduct.companyId,
			entityId: adjustProduct.entityId,
			code: adjustProduct.code,
			name: adjustProduct.name,
			json: { ...adjustProduct.json, stockQty: Math.max(0, newQty), stockLogs: logs }
		});
		if (result.ok) {
			products = await api.listProducts($currentCompanyId || 'comp-001');
			addToast(`ปรับสต๊อก ${adjustProduct.name} เรียบร้อย (${newQty})`, 'success');
		}
		showStockAdjust = false;
	}

	function isLowStock(p: Product): boolean {
		if (!p.json.stockEnabled) return false;
		const qty = (p.json.stockQty as number) || 0;
		const min = (p.json.minStock as number) || 0;
		return min > 0 && qty <= min;
	}

	async function saveProduct() {
		if (!formName.trim()) {
			addToast('กรุณากรอกชื่อสินค้า', 'error');
			return;
		}
		const companyId = $currentCompanyId || 'comp-001';
		const isProduct = formCategory === 'สินค้า';
		const payload = {
			companyId,
			...(editingProduct ? { entityId: editingProduct.entityId } : {}),
			code: formCode || `P${String(products.length + 1).padStart(4, '0')}`,
			name: formName,
			json: {
				...(editingProduct?.json || {}),
				unit: formUnit, price: formPrice, purchasePrice: formPurchasePrice, category: formCategory, description: formDescription,
				taxRate: formTaxRate === 'custom' ? String(formTaxRateCustom) : formTaxRate,
				stockEnabled: isProduct ? formStockEnabled : false, 
				stockQty: isProduct ? formStockQty : 0, 
				minStock: isProduct ? formMinStock : 0
			}
		};
		const result = await api.upsertProduct(payload);
		if (result.ok) {
			products = await api.listProducts(companyId);
			addToast(editingProduct ? 'แก้ไขสินค้าเรียบร้อย' : 'เพิ่มสินค้าเรียบร้อย', 'success');
		} else { addToast('เกิดข้อผิดพลาด', 'error'); }
		showForm = false;
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		if ($isSandbox && selectedIds.has(SANDBOX_LOCKED_PRODUCT_ID)) {
			showUpgradeDialog = true;
			return;
		}
		if (!confirm(`ลบ ${selectedIds.size} รายการ?`)) return;
		await api.deleteProducts([...selectedIds]);
		products = await api.listProducts($currentCompanyId || 'comp-001');
		selectedIds = new Set();
		addToast('ลบเรียบร้อย', 'success');
	}

	async function deleteOne(id: string) {
		if ($isSandbox && id === SANDBOX_LOCKED_PRODUCT_ID) {
			showUpgradeDialog = true;
			return;
		}
		if (!confirm('ลบรายการนี้?')) return;
		await api.deleteProducts([id]);
		products = await api.listProducts($currentCompanyId || 'comp-001');
		addToast('ลบเรียบร้อย', 'success');
	}

	function handleExport() {
		exportCsv(products, PRODUCT_CSV_COLUMNS, `products_${new Date().toISOString().substring(0, 10)}.csv`);
		addToast(`ส่งออก ${products.length} รายการ`, 'success');
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		try {
			const text = await readFileAsText(input.files[0]);
			const result = parseCsv(text);
			if (result.errors.length) { addToast(result.errors[0], 'error'); return; }
			let added = 0;
			for (const row of result.rows) {
				const name = row['ชื่อสินค้า'] || row['name'] || '';
				if (!name.trim()) continue;
				const newP: Product = {
					entityId: crypto.randomUUID(), entityType: 'PRODUCT', userId: 'user-001',
					companyId: $currentCompanyId || 'comp-001',
					code: row['รหัส'] || row['code'] || `P${String(products.length + added + 1).padStart(4, '0')}`,
					name, name2: row['ชื่อสินค้า (EN)'] || '', taxId: '', phone: '', email: '', address: '',
					tags: '', status: 'ACTIVE', isDeleted: false,
					json: { unit: row['หน่วย'] || row['unit'] || '', price: parseFloat(row['ราคา'] || row['price'] || '0') || 0, category: row['หมวดหมู่'] || row['category'] || '' },
					createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
				};
				products = [...products, newP];
				added++;
			}
			addToast(`นำเข้า ${added} รายการ`, 'success');
		} catch (err) { addToast('ไม่สามารถอ่านไฟล์ได้', 'error'); }
		input.value = '';
	}
</script>

<!-- KPI Cards -->
{#if products.length > 0}
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;" data-tour="product-kpi">
	<div class="card" style="padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
		<div style="width: 38px; height: 38px; background: color-mix(in srgb, var(--color-primary) 12%, white); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
			<Package size={18} style="color: var(--color-primary);" />
		</div>
		<div>
			<div style="font-size: 11px; color: var(--color-gray-500);">สินค้าทั้งหมด</div>
			<div style="font-size: 20px; font-weight: 700;">{productItems.length}</div>
		</div>
	</div>
	<div class="card" style="padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
		<div style="width: 38px; height: 38px; background: color-mix(in srgb, var(--color-success) 12%, white); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
			<Banknote size={18} style="color: var(--color-success);" />
		</div>
		<div>
			<div style="font-size: 11px; color: var(--color-gray-500);">มูลค่าสต๊อก</div>
			<div style="font-size: 20px; font-weight: 700; color: var(--color-success);">{formatMoney(totalStockValue)}</div>
		</div>
	</div>
	<div class="card" style="padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
		<div style="width: 38px; height: 38px; background: color-mix(in srgb, var(--color-primary) 12%, white); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
			<TrendingUp size={18} style="color: var(--color-primary);" />
		</div>
		<div>
			<div style="font-size: 11px; color: var(--color-gray-500);">เปิดสต๊อก</div>
			<div style="font-size: 20px; font-weight: 700;">{totalStockItems} <span style="font-size: 12px; font-weight: 400; color: var(--color-gray-400);">รายการ</span></div>
		</div>
	</div>
	<div class="card" style="padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
		<div style="width: 38px; height: 38px; background: color-mix(in srgb, {lowStockProducts.length > 0 ? '#ef4444' : 'var(--color-success)'} 12%, white); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
			<AlertTriangle size={18} style="color: {lowStockProducts.length > 0 ? '#ef4444' : 'var(--color-success)'};" />
		</div>
		<div>
			<div style="font-size: 11px; color: var(--color-gray-500);">สต๊อกต่ำ/หมด</div>
			<div style="font-size: 20px; font-weight: 700; color: {lowStockProducts.length > 0 ? '#ef4444' : 'var(--color-success)'};">{lowStockProducts.length}</div>
		</div>
	</div>
</div>
{/if}

<!-- Toolbar -->
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
	<div style="flex: 1; min-width: 200px; position: relative;" data-tour="product-search">
		<Search size={16} style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-gray-400);" />
		<input
			class="field-control"
			type="text"
			placeholder="ค้นหาสินค้า..."
			bind:value={searchQuery}
			style="padding-left: 36px;"
		/>
	</div>
	<button class="btn btn-sm btn-outline" onclick={handleExport} data-tour="product-csv">
		<Download size={14} /> ส่งออก CSV
	</button>
	<button class="btn btn-sm btn-outline" onclick={() => fileInput.click()}>
		<Upload size={14} /> นำเข้า CSV
	</button>
	<input type="file" accept=".csv" bind:this={fileInput} onchange={handleImport} style="display: none;" />
</div>

<!-- Filter Bar -->
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;" data-tour="product-filter">
	<Filter size={14} style="color: var(--color-gray-400);" />
	<select class="field-control" style="width: auto; min-width: 140px; font-size: 13px; padding: 6px 10px;" bind:value={filterCategory}>
		<option value="">ทุกหมวดหมู่</option>
		{#each categories as cat}
			<option value={cat}>{cat}</option>
		{/each}
	</select>
	<select class="field-control" style="width: auto; min-width: 140px; font-size: 13px; padding: 6px 10px;" bind:value={filterStockStatus}>
		<option value="all">สต๊อกทั้งหมด</option>
		<option value="enabled">เปิดสต๊อก</option>
		<option value="low">สต๊อกต่ำ</option>
		<option value="out">หมดสต๊อก</option>
	</select>
	{#if filterCategory || filterStockStatus !== 'all'}
		<button class="btn btn-sm btn-outline" style="font-size: 12px;" onclick={() => { filterCategory = ''; filterStockStatus = 'all'; }}>
			ล้างตัวกรอง
		</button>
	{/if}
	<span style="font-size: 12px; color: var(--color-gray-400); margin-left: auto;">{filteredProducts().length} / {products.length} รายการ</span>
</div>

{#if selectedIds.size > 0}
	<div class="floating-bulk-actions">
		<span>เลือกแล้ว {selectedIds.size} รายการ</span>
		<button class="btn btn-danger" onclick={deleteSelected} style="border-radius: 100px; padding: 6px 16px;">
			<Trash2 size={16} /> ลบที่เลือก
		</button>
	</div>
{/if}

<!-- Table -->
{#if filteredProducts().length === 0}
	<div class="empty-state">
		<div class="empty-state-icon" style="background: none;">
			<Package size={56} strokeWidth={1} color="var(--color-gray-300)" />
		</div>
		<div class="empty-state-title">ยังไม่มีสินค้า</div>
		<div class="empty-state-text">กดปุ่ม "เพิ่มสินค้า" เพื่อเริ่มต้น</div>
	</div>
{:else}
	<div class="card" style="padding: 0; overflow: auto;" data-tour="product-table">
		<table class="data-table">
			<thead>
				<tr>
					<th style="width: 40px;">
						<input type="checkbox" checked={selectedIds.size === filteredProducts().length && filteredProducts().length > 0} onchange={toggleSelectAll} />
					</th>
					<th>รหัส</th>
					<th>ชื่อสินค้า/บริการ</th>
					<th>หน่วย</th>
					<th style="text-align: right;">ราคาขาย</th>
					<th style="text-align: right;">ราคาซื้อ</th>
					<th style="text-align: center;">สต๊อก</th>
					<th>หมวด</th>
					<th style="width: 110px;"></th>
				</tr>
			</thead>
			<tbody>
				{#each filteredProducts() as p (p.entityId)}
					<tr>
						<td style="white-space: nowrap;">
							<input type="checkbox" checked={selectedIds.has(p.entityId)} onchange={() => toggleSelect(p.entityId)} />
						</td>
						<td style="color: var(--color-gray-500); font-size: 12px; white-space: nowrap;">{p.code}</td>
						<td style="font-weight: 500; white-space: nowrap;">
							{p.name}
							{#if $isSandbox && p.entityId === SANDBOX_LOCKED_PRODUCT_ID}
								<span style="display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: var(--color-gray-100); color: var(--color-gray-500); border: 1px solid var(--color-gray-200);"><Lock size={10} /> ล็อก</span>
							{/if}
						</td>
						<td style="white-space: nowrap;">{p.json.unit || '-'}</td>
						<td style="text-align: right; white-space: nowrap;">{p.json.price ? formatMoney(p.json.price as number) : '-'}</td>
					<td style="text-align: right; white-space: nowrap; color: var(--color-gray-500);">{p.json.purchasePrice ? formatMoney(p.json.purchasePrice as number) : '-'}</td>
						<td style="text-align: center; white-space: nowrap;">
							{#if p.json.stockEnabled}
								<span style="font-weight: 600; {isLowStock(p) ? 'color: var(--color-danger);' : ''}">
									{p.json.stockQty ?? 0}
								</span>
								{#if isLowStock(p)}
									<AlertTriangle size={12} style="color: var(--color-danger); vertical-align: middle; margin-left: 2px;" />
								{/if}
							{:else}
								<span style="color: var(--color-gray-300);">-</span>
							{/if}
						</td>
						<td style="white-space: nowrap;">{p.json.category || '-'}</td>
						<td style="white-space: nowrap;">
							<div style="display: flex; gap: 4px;">
								{#if p.json.stockEnabled}
									<button class="btn btn-sm btn-icon btn-outline" onclick={() => openStockAdjust(p)} title="ปรับสต๊อก">
										<ArrowUpDown size={14} />
									</button>
								{/if}
								<button class="btn btn-sm btn-icon btn-outline" onclick={() => openEdit(p)} title="แก้ไข">
									<Pencil size={14} />
								</button>
								<button class="btn btn-sm btn-icon btn-outline" onclick={() => deleteOne(p.entityId)} title="ลบ" style="color: var(--color-danger);">
									<Trash2 size={14} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- Modal Form -->
{#if showForm}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<div class="modal-title">{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</div>
				<button class="btn btn-icon" onclick={() => showForm = false}>&times;</button>
			</div>
			<div class="modal-body">
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<div>
						<label class="field-label" for="formCode">รหัส</label>
						<input id="formCode" class="field-control" bind:value={formCode} placeholder="อัตโนมัติ" />
					</div>
					<div>
						<label class="field-label" for="formName">ชื่อสินค้า/บริการ *</label>
						<input id="formName" class="field-control" bind:value={formName} placeholder="เช่น บริการออกแบบเว็บไซต์" />
					</div>
					<div>
						<label class="field-label" for="formCategory">หมวดหมู่ *</label>
						<select id="formCategory" class="field-control" bind:value={formCategory}>
							<option value="สินค้า">สินค้า</option>
							<option value="บริการ">บริการ</option>
						</select>
					</div>
					<div>
						<label class="field-label" for="formDescription">{formCategory === 'สินค้า' ? 'รายละเอียดสินค้า' : 'รายละเอียดงานบริการ'}</label>
						<textarea id="formDescription" class="field-control" bind:value={formDescription} placeholder={formCategory === 'สินค้า' ? 'เช่น ขนาด, สี, สเปคของสินค้า' : 'เช่น ขอบเขตงาน, ระยะเวลาให้บริการ'} rows="3" style="resize: vertical;"></textarea>
					</div>
					<div>
						<label class="field-label" for="formUnit">หน่วย</label>
						<input id="formUnit" class="field-control" bind:value={formUnit} placeholder="เช่น ชิ้น, งาน" />
					</div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
						<div>
							<label class="field-label" for="formPrice">ราคาขาย</label>
							<input id="formPrice" class="field-control" type="number" bind:value={formPrice} placeholder="0.00" />
						</div>
						<div>
							<label class="field-label" for="formPurchasePrice">ราคาซื้อ (ต้นทุน)</label>
							<input id="formPurchasePrice" class="field-control" type="number" bind:value={formPurchasePrice} placeholder="0.00" />
						</div>
					</div>

					<!-- Tax Rate -->
					<div>
						<label class="field-label" for="formTaxRate">ภาษี</label>
						<div style="display: flex; gap: 8px; align-items: center;">
							<select id="formTaxRate" class="field-control" style="flex: 1;" bind:value={formTaxRate}>
								<option value="none">ไม่ระบุ</option>
								<option value="3">3%</option>
								<option value="7">7%</option>
								<option value="custom">กำหนดเอง</option>
							</select>
							{#if formTaxRate === 'custom'}
								<div style="display: flex; align-items: center; gap: 4px; flex: 0 0 100px;">
									<input class="field-control" type="number" bind:value={formTaxRateCustom} placeholder="0" min="0" step="0.01" style="text-align: right;" />
									<span style="font-size: 13px; color: var(--color-gray-500);">%</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- Stock Section -->
					{#if formCategory === 'สินค้า'}
						<div style="border-top: 1px solid var(--color-gray-200); padding-top: 12px; margin-top: 4px;">
							<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; margin-bottom: 8px;">
								<input type="checkbox" bind:checked={formStockEnabled} />
								<Package size={14} /> เปิดใช้ระบบสต๊อก
							</label>
							{#if formStockEnabled}
								<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
									<div>
										<label class="field-label" for="formStockQty">จำนวนคงเหลือ</label>
										<input id="formStockQty" class="field-control" type="number" bind:value={formStockQty} min="0" />
									</div>
									<div>
										<label class="field-label" for="formMinStock">แจ้งเตือนเมื่อเหลือ</label>
										<input id="formMinStock" class="field-control" type="number" bind:value={formMinStock} min="0" placeholder="0 = ไม่แจ้งเตือน" />
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-outline" onclick={() => showForm = false}>ยกเลิก</button>
				<button class="btn btn-primary" onclick={saveProduct}>บันทึก</button>
			</div>
		</div>
	</div>
{/if}

<!-- Stock Adjustment Modal -->
{#if showStockAdjust && adjustProduct}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay">
		<div class="modal" onclick={(e) => e.stopPropagation()} style="max-width: 400px;">
			<div class="modal-header">
				<div class="modal-title">ปรับสต๊อก: {adjustProduct.name}</div>
				<button class="btn btn-icon" onclick={() => showStockAdjust = false}>&times;</button>
			</div>
			<div class="modal-body">
				<div style="text-align: center; margin-bottom: 16px;">
					<div style="font-size: 12px; color: var(--color-gray-500);">คงเหลือปัจจุบัน</div>
					<div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">{adjustProduct.json.stockQty ?? 0}</div>
				</div>
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<div>
						<label class="field-label" for="adjustType">ประเภท</label>
						<select id="adjustType" class="field-control" bind:value={adjustType}>
							<option value="IN">รับเข้า (+)</option>
							<option value="OUT">เบิกออก (-)</option>
							<option value="ADJUST">ตั้งค่าใหม่ (=)</option>
						</select>
					</div>
					<div>
						<label class="field-label" for="adjustQty">จำนวน</label>
						<input id="adjustQty" class="field-control" type="number" bind:value={adjustQty} min="0" />
					</div>
					<div>
						<label class="field-label" for="adjustReason">เหตุผล (ไม่บังคับ)</label>
						<input id="adjustReason" class="field-control" bind:value={adjustReason} placeholder="เช่น นับสต๊อก, สินค้าเสียหาย" />
					</div>
					{#if adjustType !== 'ADJUST'}
						<div class="card" style="padding: 8px 12px; background: var(--color-gray-50); font-size: 12px;">
							หลังปรับ: <strong>{Math.max(0, (adjustProduct.json.stockQty as number || 0) + (adjustType === 'IN' ? Math.abs(adjustQty) : -Math.abs(adjustQty)))}</strong>
						</div>
					{/if}
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-outline" onclick={() => showStockAdjust = false}>ยกเลิก</button>
				<button class="btn btn-primary" onclick={saveStockAdjust}>บันทึก</button>
			</div>
		</div>
	</div>
{/if}

<SandboxUpgradeDialog
	bind:show={showUpgradeDialog}
	message="สินค้า 'โปรแกรมออกเอกสาร' เป็นสินค้าตัวอย่างในโหมดทดลอง ไม่สามารถแก้ไขหรือลบได้ สมัครใช้งานจริงเพื่อจัดการสินค้าอย่างอิสระ"
	onclose={() => showUpgradeDialog = false}
/>
