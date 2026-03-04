<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/services/api';
	import { PAYMENT_STATUS_COLORS } from '$lib/config/constants';
	import { formatMoney, formatDateShort, getDocTypeLabel, getPaymentStatusLabel } from '$lib/utils/format';
	import { currentCompanyId, activeCompanyIds, addToast } from '$lib/stores/app';
	import type { DocumentHeader, DocType } from '$lib/types';
	import { getDocConfig, DOC_FLOW } from '$lib/config/constants';
	import { goto } from '$app/navigation';
	import { Search, CheckCircle, Clock, AlertTriangle, Filter, Wallet, ArrowRight, X, CreditCard } from 'lucide-svelte';
	import { page } from '$app/stores';

	function getDocColor(docType: string): string {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(`docColor.${docType}`);
			if (saved) return saved;
		}
		return getDocConfig(docType as DocType).color || '#1e40af';
	}

	const PAYMENT_DOC_TYPES: DocType[] = ['INV', 'BILL', 'RCPT', 'TAX', 'PV'];

	const PAYMENT_METHOD_OPTIONS = [
		{ value: 'cash', label: 'เงินสด' },
		{ value: 'transfer', label: 'โอนเงิน' },
		{ value: 'cheque', label: 'เช็ค' },
		{ value: 'credit_card', label: 'บัตรเครดิต' },
		{ value: 'promptpay', label: 'พร้อมเพย์' },
		{ value: 'credit_term', label: 'เครดิต (เงินเชื่อ)' },
	];

	function getPaymentMethodLabel(method: string | undefined): string {
		if (!method) return '-';
		return PAYMENT_METHOD_OPTIONS.find(o => o.value === method)?.label || method;
	}

	function getDocPaymentMethod(doc: DocumentHeader): string | undefined {
		return (doc.json as Record<string, any>)?.paymentMethod;
	}

	let documents: DocumentHeader[] = $state([]);
	let searchQuery = $state('');
	let filterStatus = $state('');
	let filterDocType = $state('');
	let filterPaymentMethod = $state('');

	// Record payment modal
	let showRecordModal = $state(false);
	let recordDocId = $state('');
	let recordNewStatus = $state('');
	let recordPaymentMethod = $state('transfer');

	let companyUnsub: (() => void) | undefined;

	onMount(() => {
		// Read ?status query param from URL (e.g. from dashboard "ดูทั้งหมด" link)
		const urlStatus = $page.url.searchParams.get('status');
		if (urlStatus) filterStatus = urlStatus;

		companyUnsub = activeCompanyIds.subscribe(async (ids) => {
			const validIds = ids.filter(Boolean);
			if (validIds.length) {
				const results = await Promise.all(validIds.map(id => api.queryDocs(id)));
				documents = results.flatMap(r => r.items).filter(d => PAYMENT_DOC_TYPES.includes(d.docType));
			} else {
				documents = [];
			}
		});
	});

	onDestroy(() => { companyUnsub?.(); });

	function filtered(): DocumentHeader[] {
		let result = documents;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(d => d.docNo.toLowerCase().includes(q) || getCustomerName(d).toLowerCase().includes(q));
		}
		if (filterStatus) result = result.filter(d => d.paymentStatus === filterStatus);
		if (filterDocType) result = result.filter(d => d.docType === filterDocType);
		if (filterPaymentMethod) result = result.filter(d => getDocPaymentMethod(d) === filterPaymentMethod);
		return result.toSorted((a, b) => {
			const order: Record<string, number> = { OVERDUE: 0, UNPAID: 1, PARTIAL: 2, PAID: 3 };
			return (order[a.paymentStatus] ?? 9) - (order[b.paymentStatus] ?? 9);
		});
	}

	function isOverdue(doc: DocumentHeader): boolean {
		if (doc.paymentStatus === 'PAID') return false;
		if (!doc.dueDate) return false;
		return new Date(doc.dueDate) < new Date();
	}

	function getCustomerName(doc: DocumentHeader): string {
		return (doc.json as Record<string, string>)?.customerName || '-';
	}

	let showFollowUpDialog = $state(false);
	let followUpDoc: DocumentHeader | null = $state(null);
	let followUpNextType: DocType | null = $state(null);

	function onStatusChange(docId: string, newStatus: string) {
		if (newStatus === 'PAID') {
			// Open modal to record payment method
			recordDocId = docId;
			recordNewStatus = newStatus;
			recordPaymentMethod = 'transfer';
			showRecordModal = true;
		} else {
			doUpdateStatus(docId, newStatus);
		}
	}

	async function doUpdateStatus(docId: string, newStatus: string, paymentMethod?: string) {
		const result = await api.updateDocPayment(docId, newStatus, paymentMethod);
		if (result.ok) {
			documents = documents.map(d => d.docId === docId ? result.data : d);
			addToast(`อัปเดตสถานะเป็น "${getPaymentStatusLabel(newStatus)}" เรียบร้อย`, 'success');
			if (newStatus === 'PAID') {
				const doc = result.data;
				const flow = DOC_FLOW[doc.docType];
				if (flow?.primary) {
					followUpDoc = doc;
					followUpNextType = flow.primary;
					showFollowUpDialog = true;
				}
			}
		} else { addToast('เกิดข้อผิดพลาด', 'error'); }
	}

	function confirmRecordPayment() {
		showRecordModal = false;
		doUpdateStatus(recordDocId, recordNewStatus, recordPaymentMethod);
	}

	function skipRecordPayment() {
		showRecordModal = false;
		doUpdateStatus(recordDocId, recordNewStatus);
	}

	function summaryStats() {
		const f = filtered();
		const unpaid = f.filter(d => d.paymentStatus === 'UNPAID' || d.paymentStatus === 'OVERDUE');
		const partial = f.filter(d => d.paymentStatus === 'PARTIAL');
		const paid = f.filter(d => d.paymentStatus === 'PAID');
		return {
			total: f.length,
			unpaidCount: unpaid.length,
			unpaidAmount: unpaid.reduce((s, d) => s + d.grandTotal, 0),
			partialCount: partial.length,
			partialAmount: partial.reduce((s, d) => s + d.grandTotal, 0),
			paidCount: paid.length,
			paidAmount: paid.reduce((s, d) => s + d.grandTotal, 0)
		};
	}
</script>

<!-- Stats -->
{#if true}
{@const stats = summaryStats()}
<div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;" data-tour="payment-kpi">
	<div class="card" style="flex: 1; min-width: 150px; padding: 14px;">
		<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
			<AlertTriangle size={16} color="var(--color-danger)" />
			<span style="font-size: 12px; color: var(--color-gray-500);">ค้างชำระ</span>
		</div>
		<div style="font-size: 22px; font-weight: 700; color: var(--color-danger);">{formatMoney(stats.unpaidAmount)}</div>
		<div style="font-size: 11px; color: var(--color-gray-400);">{stats.unpaidCount} เอกสาร</div>
	</div>
	<div class="card" style="flex: 1; min-width: 150px; padding: 14px;">
		<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
			<Clock size={16} color="var(--color-warning, #f59e0b)" />
			<span style="font-size: 12px; color: var(--color-gray-500);">ชำระบางส่วน</span>
		</div>
		<div style="font-size: 22px; font-weight: 700; color: var(--color-warning, #f59e0b);">{formatMoney(stats.partialAmount)}</div>
		<div style="font-size: 11px; color: var(--color-gray-400);">{stats.partialCount} เอกสาร</div>
	</div>
	<div class="card" style="flex: 1; min-width: 150px; padding: 14px;">
		<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
			<CheckCircle size={16} color="var(--color-success)" />
			<span style="font-size: 12px; color: var(--color-gray-500);">ชำระแล้ว</span>
		</div>
		<div style="font-size: 22px; font-weight: 700; color: var(--color-success);">{formatMoney(stats.paidAmount)}</div>
		<div style="font-size: 11px; color: var(--color-gray-400);">{stats.paidCount} เอกสาร</div>
	</div>
</div>

<!-- Filters -->
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;" data-tour="payment-filters">
	<div style="flex: 1; min-width: 200px; position: relative;" data-tour="payment-search">
		<Search size={16} style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-gray-400);" />
		<input class="field-control" placeholder="ค้นหาเลขที่ / ชื่อลูกค้า..." bind:value={searchQuery} style="padding-left: 36px;" />
	</div>
	<select class="field-control" style="width: 130px;" bind:value={filterDocType}>
		<option value="">ทุกประเภท</option>
		{#each PAYMENT_DOC_TYPES as dt}
			<option value={dt}>{getDocTypeLabel(dt as import('$lib/types').DocType)}</option>
		{/each}
	</select>
	<select class="field-control" style="width: 150px;" bind:value={filterStatus}>
		<option value="">ทุกสถานะ</option>
		<option value="UNPAID">ยังไม่ชำระ</option>
		<option value="PARTIAL">ชำระบางส่วน</option>
		<option value="PAID">ชำระแล้ว</option>
		<option value="OVERDUE">เกินกำหนด</option>
	</select>
	<select class="field-control" style="width: 150px;" bind:value={filterPaymentMethod}>
		<option value="">ทุกช่องทาง</option>
		{#each PAYMENT_METHOD_OPTIONS as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>

<!-- Table (desktop) / Cards (mobile) -->
{#if filtered().length === 0}
	<div class="empty-state">
		<div class="empty-state-icon" style="background: none;">
			<Wallet size={56} strokeWidth={1} color="var(--color-gray-300)" />
		</div>
		<div class="empty-state-title">ไม่พบเอกสาร</div>
	</div>
{:else}
	<!-- Desktop table -->
	<div class="card pay-desktop" style="padding: 0; overflow: auto;" data-tour="payment-list">
		<table class="data-table">
			<thead>
				<tr>
					<th>เลขที่</th>
					<th>ประเภท</th>
					<th>อ้างอิง</th>
					<th>วันที่</th>
					<th>ครบกำหนด</th>
					<th>ลูกค้า</th>
					<th style="text-align: right;">ยอด</th>
					<th>ช่องทาง</th>
					<th>สถานะ</th>
					<th style="width: 160px;">เปลี่ยนสถานะ</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered() as doc (doc.docId)}
					<tr style={isOverdue(doc) ? 'background: color-mix(in srgb, var(--color-danger) 5%, white);' : ''}>
						<td style="white-space: nowrap;"><a href="/documents/{doc.docId}" style="font-weight: 600; color: var(--color-primary); text-decoration: none;">{doc.docNo}</a></td>
						<td style="white-space: nowrap;"><span class="pay-doc-badge" style="background: color-mix(in srgb, {getDocColor(doc.docType)} 12%, white); color: {getDocColor(doc.docType)}; border: 1px solid color-mix(in srgb, {getDocColor(doc.docType)} 25%, transparent);">{getDocTypeLabel(doc.docType)}</span></td>
						<td style="white-space: nowrap; font-size: 12px; color: var(--color-gray-500);">{doc.refDocNo || '-'}</td>
						<td style="white-space: nowrap;">{formatDateShort(doc.docDate)}</td>
						<td style="white-space: nowrap;">{doc.dueDate ? formatDateShort(doc.dueDate) : '-'}</td>
						<td style="white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis;">{getCustomerName(doc)}</td>
						<td style="text-align: right; font-weight: 500; white-space: nowrap;">{formatMoney(doc.grandTotal)}</td>
						<td style="white-space: nowrap; font-size: 12px;">
							{#if getDocPaymentMethod(doc)}
								<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:var(--color-gray-100);color:var(--color-gray-600);font-size:11px;"><CreditCard size={12} />{getPaymentMethodLabel(getDocPaymentMethod(doc))}</span>
							{:else}
								<span style="color:var(--color-gray-400);">-</span>
							{/if}
						</td>
						<td style="white-space: nowrap;">
							<span class="badge badge-{PAYMENT_STATUS_COLORS[doc.paymentStatus] || 'gray'}">{getPaymentStatusLabel(doc.paymentStatus)}</span>
						</td>
						<td>
							<select class="field-control pay-status-select" value={doc.paymentStatus} onchange={(e) => onStatusChange(doc.docId, (e.target as HTMLSelectElement).value)}>
								<option value="UNPAID">ยังไม่ชำระ</option>
								<option value="PARTIAL">ชำระบางส่วน</option>
								<option value="PAID">ชำระแล้ว</option>
								<option value="OVERDUE">เกินกำหนด</option>
							</select>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile cards -->
	<div class="pay-mobile">
		{#each filtered() as doc (doc.docId)}
			<div class="card pay-card" style={isOverdue(doc) ? 'border-left: 3px solid var(--color-danger);' : ''}>
				<div class="pay-card-top">
					<span class="pay-doc-badge" style="background: color-mix(in srgb, {getDocColor(doc.docType)} 12%, white); color: {getDocColor(doc.docType)}; border: 1px solid color-mix(in srgb, {getDocColor(doc.docType)} 25%, transparent);">{getDocTypeLabel(doc.docType)}</span>
					<a href="/documents/{doc.docId}" style="font-weight: 600; color: var(--color-primary); text-decoration: none; font-size: 13px;">{doc.docNo}</a>
					<span class="badge badge-{PAYMENT_STATUS_COLORS[doc.paymentStatus] || 'gray'}" style="margin-left: auto;">{getPaymentStatusLabel(doc.paymentStatus)}</span>
				</div>
				<div class="pay-card-customer">{getCustomerName(doc)}</div>
				<div class="pay-card-meta">
					<span>{formatDateShort(doc.docDate)}</span>
					{#if doc.dueDate}
						<span style="color: var(--color-gray-400);">→</span>
						<span>{formatDateShort(doc.dueDate)}</span>
					{/if}
					{#if doc.refDocNo}
						<span style="color: var(--color-gray-400);">อ้าง: {doc.refDocNo}</span>
					{/if}
					{#if getDocPaymentMethod(doc)}
						<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:var(--color-gray-100);color:var(--color-gray-600);font-size:11px;"><CreditCard size={10} />{getPaymentMethodLabel(getDocPaymentMethod(doc))}</span>
					{/if}
				</div>
				<div class="pay-card-bottom">
					<span class="pay-card-amount">{formatMoney(doc.grandTotal)}</span>
					<select class="field-control pay-status-select" value={doc.paymentStatus} onchange={(e) => onStatusChange(doc.docId, (e.target as HTMLSelectElement).value)}>
						<option value="UNPAID">ยังไม่ชำระ</option>
						<option value="PARTIAL">ชำระบางส่วน</option>
						<option value="PAID">ชำระแล้ว</option>
						<option value="OVERDUE">เกินกำหนด</option>
					</select>
				</div>
			</div>
		{/each}
	</div>
{/if}
{/if}

<style>
	.pay-doc-badge {
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		display: inline-block;
	}
	.pay-status-select {
		font-size: 12px;
		padding: 6px 10px;
		min-width: 130px;
		appearance: none;
		-webkit-appearance: none;
		background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 8px center;
		padding-right: 28px;
		border: 1px solid var(--color-gray-300);
		border-radius: 6px;
		cursor: pointer;
	}
	/* Desktop: show table, hide cards */
	.pay-desktop { display: block; }
	.pay-mobile { display: none; }

	/* Mobile: hide table, show cards */
	@media (max-width: 768px) {
		.pay-desktop { display: none !important; }
		.pay-mobile {
			display: flex;
			flex-direction: column;
			gap: 10px;
		}
	}
	.pay-card {
		padding: 14px;
	}
	.pay-card-top {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}
	.pay-card-customer {
		font-size: 13px;
		color: var(--color-gray-600);
		margin-bottom: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pay-card-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--color-gray-500);
		margin-bottom: 10px;
		flex-wrap: wrap;
	}
	.pay-card-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.pay-card-amount {
		font-size: 16px;
		font-weight: 700;
		color: var(--color-gray-800);
	}
</style>

<!-- Follow-up Document Dialog -->
{#if showFollowUpDialog && followUpDoc && followUpNextType}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay">
	<div class="modal" onclick={(e) => e.stopPropagation()} style="max-width: 400px; padding: 24px; position: relative;">
		<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
			<h3 style="font-size: 16px; font-weight: 700; margin: 0;">สร้างเอกสารต่อเนื่อง?</h3>
			<button style="background: none; border: none; padding: 4px; cursor: pointer; color: var(--color-gray-400);" onclick={() => { showFollowUpDialog = false; followUpDoc = null; }}>
				<X size={20} />
			</button>
		</div>
		<div style="font-size: 13px; color: var(--color-gray-500); margin-bottom: 20px; line-height: 1.6;">
			เอกสาร <strong style="color: {getDocColor(followUpDoc.docType)};">{getDocTypeLabel(followUpDoc.docType)} {followUpDoc.docNo}</strong> ชำระแล้ว<br />
			ต้องการสร้าง <strong style="color: {getDocColor(followUpNextType)};">{getDocTypeLabel(followUpNextType)}</strong> ต่อเลยไหม?
		</div>
		<div style="display: flex; gap: 8px; justify-content: flex-end;">
			<button class="btn btn-outline" onclick={() => { showFollowUpDialog = false; followUpDoc = null; }}>ไม่ ขอบคุณ</button>
			<button class="btn btn-primary" onclick={() => { showFollowUpDialog = false; goto(`/documents?fromDoc=${followUpDoc?.docId}&type=${followUpNextType}`); }}>
				สร้างเลย <ArrowRight size={14} />
			</button>
		</div>
	</div>
</div>
{/if}

<!-- Record Payment Method Modal -->
{#if showRecordModal}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={() => { showRecordModal = false; }}>
	<div class="modal" onclick={(e) => e.stopPropagation()} style="max-width: 380px; padding: 24px; position: relative;">
		<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
			<h3 style="font-size: 16px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
				<CreditCard size={18} color="var(--color-primary)" /> บันทึกช่องทางชำระเงิน
			</h3>
			<button style="background: none; border: none; padding: 4px; cursor: pointer; color: var(--color-gray-400);" onclick={() => { showRecordModal = false; }}>
				<X size={20} />
			</button>
		</div>
		<div style="margin-bottom: 16px;">
			<label style="font-size: 13px; color: var(--color-gray-600); margin-bottom: 6px; display: block;">ช่องทางการชำระเงิน</label>
			<select class="field-control" style="width: 100%;" bind:value={recordPaymentMethod}>
				{#each PAYMENT_METHOD_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
		<div style="display: flex; gap: 8px; justify-content: flex-end;">
			<button class="btn btn-outline" onclick={skipRecordPayment}>ข้าม</button>
			<button class="btn btn-primary" onclick={confirmRecordPayment}>
				<CheckCircle size={14} /> บันทึก
			</button>
		</div>
	</div>
</div>
{/if}
