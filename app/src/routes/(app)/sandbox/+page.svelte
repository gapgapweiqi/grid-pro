<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, initApi } from '$lib/services/api';
	import { companies, currentCompanyId } from '$lib/stores/app';
	import { formatMoney, formatCompactMoney, formatDateShort, getDocTypeLabel, getPaymentStatusLabel } from '$lib/utils/format';
	import { PAYMENT_STATUS_COLORS, DOC_TYPES, DOC_FLOW, getDocConfig } from '$lib/config/constants';
	import type { KpiData, SalesTrendItem, TopCustomerItem, TopProductItem, DocumentHeader, Product, DocType } from '$lib/types';
	import { TrendingUp, FileText, AlertCircle, Banknote, Receipt, ArrowRight, Calendar, ArrowDownCircle, ArrowUpCircle, Package, AlertTriangle, Link2 } from 'lucide-svelte';
	import SalesTrendChart from '$lib/components/dashboard/SalesTrendChart.svelte';
	import { isSandbox, initSandbox } from '$lib/stores/sandbox';
	import { get } from 'svelte/store';

	onMount(async () => {
		// Initialize sandbox if not already active
		if (!get(isSandbox)) {
			initSandbox();
			await initApi();
		}
		loadDashboard();
	});

	let kpi: KpiData | null = $state(null);
	let salesTrend: SalesTrendItem[] = $state([]);
	let topCustomers: TopCustomerItem[] = $state([]);
	let topProducts: TopProductItem[] = $state([]);
	let unpaidDocs: DocumentHeader[] = $state([]);
	let stockProducts: Product[] = $state([]);
	let pendingFlowDocs: { doc: DocumentHeader; nextType: DocType; nextLabel: string }[] = $state([]);
	let lowStockProducts = $derived(stockProducts.filter(p => p.json?.stockEnabled && (p.json?.stockQty || 0) <= (p.json?.minStock || 0)));
	let totalStockItems = $derived(stockProducts.filter(p => p.json?.stockEnabled).length);
	let totalStockValue = $derived(stockProducts.filter(p => p.json?.stockEnabled).reduce((s, p) => s + ((p.json?.stockQty || 0) * (p.json?.price || 0)), 0));

	const RANGE_OPTIONS = [
		{ value: 'today', label: 'วันนี้' },
		{ value: 'week', label: 'อาทิตย์นี้' },
		{ value: 'month', label: 'เดือนนี้' },
		{ value: '3months', label: '3 เดือน' },
		{ value: 'year', label: 'ปีนี้' },
		{ value: 'custom', label: 'กำหนดเอง' },
	];
	let selectedRange = $state('month');
	let customDateFrom = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
	let customDateTo = $state(new Date().toISOString().slice(0, 10));
	let kpiMode: 'income' | 'expense' = $state('income');
	let selectedDocType: DocType | 'ALL' = $state('ALL');

	let availableDocTypes = $derived(
		DOC_TYPES.filter(dt => {
			if (kpiMode === 'income') {
				return dt.category === 'sales' || (dt.category === 'finance' && dt.id === 'CN');
			} else {
				return dt.category === 'purchase' || (dt.category === 'finance' && dt.id === 'PV');
			}
		})
	);

	function getDateRange(): { from: string; to: string } {
		const now = new Date();
		const todayStr = now.toISOString().slice(0, 10);
		switch (selectedRange) {
			case 'today':
				return { from: todayStr, to: todayStr };
			case 'week': {
				const day = now.getDay();
				const diff = day === 0 ? 6 : day - 1;
				const monday = new Date(now);
				monday.setDate(now.getDate() - diff);
				return { from: monday.toISOString().slice(0, 10), to: todayStr };
			}
			case 'month':
				return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: todayStr };
			case '3months': {
				const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
				return { from: d.toISOString().slice(0, 10), to: todayStr };
			}
			case 'year':
				return { from: `${now.getFullYear()}-01-01`, to: todayStr };
			case 'custom':
				return { from: customDateFrom, to: customDateTo };
			default:
				return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: todayStr };
		}
	}

	function handleKpiModeChange(mode: 'income' | 'expense') {
		kpiMode = mode;
		selectedDocType = 'ALL';
		loadDashboard();
	}

	async function loadDashboard() {
		const companyId = $currentCompanyId || 'comp-001';
		if (!companyId) return;
		const { from, to } = getDateRange();
		const rangeLabel = selectedRange === 'today' ? 'วันนี้' : selectedRange === 'week' ? 'สัปดาห์นี้' : selectedRange === 'month' ? 'เดือนนี้' : selectedRange === '3months' ? '3 เดือน' : selectedRange === 'year' ? 'ปีนี้' : `${from} - ${to}`;

		const [allDocsResult, trend, topC, topP, products] = await Promise.all([
			api.queryDocs(companyId),
			api.getSalesTrend(companyId),
			api.getTopCustomers(companyId),
			api.getTopProducts(companyId),
			api.listProducts(companyId)
		]);

		const allDocs = allDocsResult.items;

		let filteredDocs = allDocs.filter(d => {
			const date = (d.docDate || '').slice(0, 10);
			return date >= from && date <= to;
		});
		if (selectedDocType !== 'ALL') {
			filteredDocs = filteredDocs.filter(d => d.docType === selectedDocType);
		}

		const INCOME_TYPES = new Set(['QUO', 'INV', 'BILL', 'TAX', 'RCPT', 'DO', 'CN']);
		const EXPENSE_TYPES = new Set(['PO', 'PV', 'PR']);

		const rangeFilteredAll = allDocs.filter(d => {
			const date = (d.docDate || '').slice(0, 10);
			return date >= from && date <= to;
		});

		let salesTotal = 0, paidTotal = 0, unpaidTotal = 0, vatOutput = 0;
		let expenseTotal = 0, expenseUnpaid = 0, expenseVat = 0;

		const incomeFiltered = rangeFilteredAll.filter(d => INCOME_TYPES.has(d.docType));
		for (const d of incomeFiltered) {
			salesTotal += d.grandTotal;
			vatOutput += d.vatAmount;
			if (d.docType === 'RCPT' || d.paymentStatus === 'PAID') paidTotal += d.grandTotal;
			if (d.docType !== 'RCPT' && d.paymentStatus !== 'PAID') unpaidTotal += d.grandTotal;
		}

		const expenseFiltered = rangeFilteredAll.filter(d => EXPENSE_TYPES.has(d.docType));
		for (const d of expenseFiltered) {
			expenseTotal += d.grandTotal;
			expenseVat += d.vatAmount;
			if (d.paymentStatus !== 'PAID') expenseUnpaid += d.grandTotal;
		}

		const displayDocs = selectedDocType !== 'ALL' ? filteredDocs : (kpiMode === 'income' ? incomeFiltered : expenseFiltered);

		kpi = {
			salesThisMonth: Math.round((kpiMode === 'income' ? salesTotal : expenseTotal) * 100) / 100,
			paidThisMonth: Math.round(paidTotal * 100) / 100,
			unpaidTotal: Math.round((kpiMode === 'income' ? unpaidTotal : expenseUnpaid) * 100) / 100,
			vatOutputThisMonth: Math.round((kpiMode === 'income' ? vatOutput : expenseVat) * 100) / 100,
			totalRevenue: Math.round((salesTotal - expenseTotal) * 100) / 100,
			totalDocuments: displayDocs.length,
			period: rangeLabel
		};

		salesTrend = trend;
		topCustomers = topC;
		topProducts = topP;
		unpaidDocs = allDocs.filter(d => d.docType !== 'QUO' && d.paymentStatus === 'UNPAID').slice(0, 5);
		stockProducts = products;

		const pending: typeof pendingFlowDocs = [];
		for (const d of allDocs) {
			if (d.docStatus === 'CANCELLED') continue;
			const flow = DOC_FLOW[d.docType];
			if (!flow?.primary) continue;
			const hasChild = allDocs.some(child => {
				if (child.docType !== flow.primary) return false;
				const childRef = (child.json as Record<string, any>)?.refDocId || '';
				return childRef === d.docId || child.refDocNo === d.docNo;
			});
			if (!hasChild) {
				pending.push({ doc: d, nextType: flow.primary, nextLabel: getDocTypeLabel(flow.primary) });
			}
		}
		pendingFlowDocs = pending.slice(0, 5);
	}
</script>

{#if kpi}
	<!-- Date Range Filter -->
	<div class="filter-section">
		<div class="range-bar">
			<Calendar size={14} style="color: var(--color-gray-400);" />
			<div class="range-scroll">
				{#each RANGE_OPTIONS as opt}
					<button
						class="range-pill"
						class:active={selectedRange === opt.value}
						onclick={() => { selectedRange = opt.value; if (opt.value !== 'custom') loadDashboard(); }}
					>{opt.label}</button>
				{/each}
			</div>
			{#if selectedRange === 'custom'}
				<div class="custom-date-group">
					<input type="date" class="field-control" bind:value={customDateFrom} />
					<span style="font-size: 12px; color: var(--color-gray-400);">ถึง</span>
					<input type="date" class="field-control" bind:value={customDateTo} />
					<button class="btn btn-sm btn-primary" onclick={loadDashboard}>ค้นหา</button>
				</div>
			{/if}
		</div>

		<div class="controls-row">
			<div class="kpi-toggle">
				<button class="kpi-toggle-btn" class:active={kpiMode === 'income'} onclick={() => handleKpiModeChange('income')}>
					<ArrowDownCircle size={16} /> รายรับ
				</button>
				<button class="kpi-toggle-btn expense" class:active={kpiMode === 'expense'} onclick={() => handleKpiModeChange('expense')}>
					<ArrowUpCircle size={16} /> รายจ่าย
				</button>
			</div>

			<div class="doc-filter">
				<label>ประเภทเอกสาร:</label>
				<select class="field-control" bind:value={selectedDocType} onchange={loadDashboard}>
					<option value="ALL">ทั้งหมด</option>
					{#each availableDocTypes as docType}
						<option value={docType.id}>{docType.labelTh}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- KPI Cards -->
	<div class="kpi-grid">
		{#if kpiMode === 'income'}
		<div class="kpi-card">
			<div class="kpi-icon" style="background: var(--color-primary-soft); color: var(--color-primary);">
				<TrendingUp size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">ยอดขาย</div>
				<div class="kpi-value">{formatCompactMoney(kpi.salesThisMonth)}</div>
				<div class="kpi-sub">{kpi.period}</div>
			</div>
		</div>
		<div class="kpi-card">
			<div class="kpi-icon" style="background: color-mix(in srgb, var(--color-success) 12%, white); color: var(--color-success);">
				<Banknote size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">ชำระแล้ว</div>
				<div class="kpi-value" style="color: var(--color-success);">{formatCompactMoney(kpi.paidThisMonth)}</div>
				<div class="kpi-sub">{kpi.period}</div>
			</div>
		</div>
		<div class="kpi-card">
			<div class="kpi-icon" style="background: color-mix(in srgb, var(--color-danger) 12%, white); color: var(--color-danger);">
				<AlertCircle size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">ค้างชำระ</div>
				<div class="kpi-value" style="color: var(--color-danger);">{formatCompactMoney(kpi.unpaidTotal)}</div>
				<div class="kpi-sub">{kpi.period}</div>
			</div>
		</div>
		<div class="kpi-card">
			<div class="kpi-icon" style="background: color-mix(in srgb, var(--color-info, #3b82f6) 12%, white); color: var(--color-info, #3b82f6);">
				<FileText size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">เอกสารทั้งหมด</div>
				<div class="kpi-value">{kpi.totalDocuments}</div>
				<div class="kpi-sub">ฉบับ</div>
			</div>
		</div>
		{:else}
		<div class="kpi-card">
			<div class="kpi-icon" style="background: color-mix(in srgb, #f59e0b 12%, white); color: #f59e0b;">
				<ArrowUpCircle size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">ค่าใช้จ่าย</div>
				<div class="kpi-value" style="color: #f59e0b;">{formatCompactMoney(kpi.salesThisMonth)}</div>
				<div class="kpi-sub">{kpi.period}</div>
			</div>
		</div>
		<div class="kpi-card">
			<div class="kpi-icon" style="background: color-mix(in srgb, #ef4444 12%, white); color: #ef4444;">
				<Receipt size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">รอจ่าย</div>
				<div class="kpi-value" style="color: #ef4444;">{formatCompactMoney(kpi.unpaidTotal)}</div>
				<div class="kpi-sub">{kpi.period}</div>
			</div>
		</div>
		<div class="kpi-card">
			<div class="kpi-icon" style="background: color-mix(in srgb, var(--color-primary) 12%, white); color: var(--color-primary);">
				<TrendingUp size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">กำไรสุทธิ</div>
				<div class="kpi-value" style="color: {kpi.totalRevenue >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">{formatCompactMoney(kpi.totalRevenue)}</div>
				<div class="kpi-sub">รายรับ - รายจ่าย · {kpi.period}</div>
			</div>
		</div>
		<div class="kpi-card">
			<div class="kpi-icon" style="background: color-mix(in srgb, #8b5cf6 12%, white); color: #8b5cf6;">
				<Banknote size={20} />
			</div>
			<div class="kpi-body">
				<div class="kpi-label">ภาษีซื้อ (VAT)</div>
				<div class="kpi-value" style="color: #8b5cf6;">{formatCompactMoney(kpi.vatOutputThisMonth)}</div>
				<div class="kpi-sub">{kpi.period}</div>
			</div>
		</div>
		{/if}
	</div>

	<!-- Charts Row -->
	<div class="dashboard-row">
		<div class="card" style="flex: 2; min-width: 300px;">
			<h3 class="card-title">แนวโน้มยอดขาย 6 เดือน</h3>
			{#if salesTrend.length > 0}
				<SalesTrendChart data={salesTrend} />
			{:else}
				<div class="empty-state" style="padding: 24px;"><div class="empty-state-text">ยังไม่มีข้อมูล</div></div>
			{/if}
		</div>
		<div class="card" style="flex: 1; min-width: 250px;">
			<h3 class="card-title">ลูกค้ายอดนิยม</h3>
			{#if topCustomers.length === 0}
				<div class="empty-state" style="padding: 24px;"><div class="empty-state-text">ยังไม่มีข้อมูล</div></div>
			{:else}
				<div class="top-list">
					{#each topCustomers as cust, i}
						<div class="top-list-item">
							<span class="top-rank">{i + 1}</span>
							<span class="top-name">{cust.customerName}</span>
							<span class="top-value">{formatCompactMoney(cust.total)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Second Row -->
	<div class="dashboard-row" style="margin-top: 16px;">
		<div class="card" style="flex: 1; min-width: 250px;">
			<h3 class="card-title">สินค้า/บริการยอดนิยม</h3>
			{#if topProducts.length === 0}
				<div class="empty-state" style="padding: 24px;"><div class="empty-state-text">ยังไม่มีข้อมูล</div></div>
			{:else}
				<div class="top-list">
					{#each topProducts as prod, i}
						<div class="top-list-item">
							<span class="top-rank">{i + 1}</span>
							<span class="top-name">{prod.name}</span>
							<span class="top-value">{formatCompactMoney(prod.total)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		<div class="card" style="flex: 2; min-width: 300px;">
			<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
				<h3 class="card-title" style="margin-bottom: 0;">เอกสารค้างชำระ</h3>
				<a href="/payments" class="btn btn-sm btn-outline">ดูทั้งหมด <ArrowRight size={14} /></a>
			</div>
			{#if unpaidDocs.length === 0}
				<div class="empty-state" style="padding: 24px;"><div class="empty-state-text">ไม่มีเอกสารค้างชำระ</div></div>
			{:else}
				<table class="data-table">
					<thead><tr><th>เลขที่</th><th>ประเภท</th><th>วันที่</th><th style="text-align: right;">ยอด</th><th>สถานะ</th></tr></thead>
					<tbody>
						{#each unpaidDocs as doc}
							<tr>
								<td style="font-weight: 600;">{doc.docNo}</td>
								<td>{getDocTypeLabel(doc.docType)}</td>
								<td>{formatDateShort(doc.docDate)}</td>
								<td style="text-align: right; font-weight: 500;">{formatMoney(doc.grandTotal)}</td>
								<td><span class="badge badge-{PAYMENT_STATUS_COLORS[doc.paymentStatus] || 'gray'}">{getPaymentStatusLabel(doc.paymentStatus)}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>

	<!-- Quick Actions -->
	<div style="margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
		<a href="/documents" class="btn btn-primary"><FileText size={16} /> สร้างเอกสาร</a>
		<a href="/payments" class="btn btn-outline"><Banknote size={16} /> ติดตามชำระเงิน</a>
		<a href="/documents/history" class="btn btn-outline"><FileText size={16} /> ประวัติเอกสาร</a>
	</div>
{:else}
	<div class="empty-state">
		<div class="empty-state-icon" style="background: none;"><div class="loading-spinner"></div></div>
		<div class="empty-state-title" style="color: var(--color-gray-400); font-weight: 500;">กำลังโหลด...</div>
	</div>
{/if}

<style>
	.filter-section { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
	.range-bar { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
	.range-scroll { display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 4px; }
	.range-scroll::-webkit-scrollbar { display: none; }
	.range-pill { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--color-gray-200); background: #fff; font-size: 13px; font-weight: 500; color: var(--color-gray-600); cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0; }
	.range-pill:hover { border-color: var(--color-primary); color: var(--color-primary); }
	.range-pill.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
	.custom-date-group { display: flex; align-items: center; gap: 6px; margin-left: 4px; flex-shrink: 0; }
	.custom-date-group .field-control { font-size: 12px; padding: 4px 8px; width: 130px; }
	.controls-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
	.kpi-toggle { display: flex; gap: 4px; background: var(--color-gray-100); border-radius: 10px; padding: 3px; width: fit-content; }
	.kpi-toggle-btn { display: flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: var(--color-gray-500); cursor: pointer; transition: all 0.15s; }
	.kpi-toggle-btn.active { background: white; color: var(--color-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
	.kpi-toggle-btn.expense.active { color: #f59e0b; }
	.doc-filter { display: flex; align-items: center; gap: 8px; }
	.doc-filter label { font-size: 13px; font-weight: 600; color: var(--color-gray-600); white-space: nowrap; }
	.doc-filter select { font-size: 13px; padding: 6px 10px; width: 160px; }

	@media (max-width: 768px) {
		.filter-section { gap: 12px; }
		.range-bar { width: 100%; }
		.custom-date-group { flex-wrap: wrap; margin-left: 0; width: 100%; }
		.custom-date-group .field-control { flex: 1; min-width: 110px; }
		.controls-row { flex-direction: column; align-items: flex-start; gap: 12px; }
		.kpi-toggle { width: 100%; }
		.kpi-toggle-btn { flex: 1; justify-content: center; }
		.doc-filter { width: 100%; justify-content: space-between; }
		.doc-filter select { flex: 1; max-width: none; }
	}

	.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
	.kpi-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px; background: #fff; border-radius: 14px; border: 1px solid var(--color-gray-100); box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
	.kpi-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.kpi-body { flex: 1; min-width: 0; }
	.kpi-label { font-size: 12px; font-weight: 500; color: var(--color-gray-500); margin-bottom: 2px; }
	.kpi-value { font-size: 20px; font-weight: 700; color: var(--color-gray-900); line-height: 1.2; }
	.kpi-sub { font-size: 11px; color: var(--color-gray-400); margin-top: 2px; }
	.dashboard-row { display: flex; gap: 16px; flex-wrap: wrap; }
	.card-title { font-size: 14px; font-weight: 700; color: var(--color-gray-800); margin-bottom: 16px; }
	.top-list { display: flex; flex-direction: column; gap: 8px; }
	.top-list-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--color-gray-100); }
	.top-list-item:last-child { border-bottom: none; }
	.top-rank { width: 22px; height: 22px; background: var(--color-primary-soft); color: var(--color-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
	.top-name { flex: 1; font-size: 13px; color: var(--color-gray-800); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.top-value { font-size: 13px; font-weight: 600; color: var(--color-gray-900); white-space: nowrap; }
</style>
