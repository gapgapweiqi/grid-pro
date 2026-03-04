<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { page } from '$app/stores';
	import { api } from '$lib/services/api';
	import { currentCompany, addToast, setTopbarCustomContent, clearTopbarCustomContent } from '$lib/stores/app';
	import { formatMoney, getDocTypeLabel, getPaymentStatusLabel, getDocStatusLabel } from '$lib/utils/format';
	import { PAYMENT_STATUS_COLORS, DOC_STATUS_COLORS, DOC_TYPE_CONVERSIONS, DOC_FLOW, getDocConfig } from '$lib/config/constants';
	import type { DocumentWithLines, Customer, DocumentHeader, DocType, DocLine } from '$lib/types';
	import DocPreview from '$lib/components/documents/DocPreview.svelte';
	import PaginatedDocPreview from '$lib/components/documents/PaginatedDocPreview.svelte';
	import CopyModeDialog from '$lib/components/common/CopyModeDialog.svelte';
	import { getTemplateIdForDocType } from '$lib/config/templates';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Printer, Edit, CreditCard, Link2, ArrowRight, FilePlus2, ChevronDown, AlertTriangle, Download, Eye } from 'lucide-svelte';
	import PreviewModal from '$lib/components/documents/PreviewModal.svelte';
	import { printHtmlContent } from '$lib/utils/print';
	import { buildBulkPdfClone, readAccentColor, getDocPrintStyles, getPrintCss, swapBadges } from '$lib/utils/docPrintUtils';
	import { formatDateShort } from '$lib/utils/format';

	const PM_LABELS: Record<string, string> = { cash: 'เงินสด', transfer: 'โอนเงิน', cheque: 'เช็ค', credit_card: 'บัตรเครดิต', promptpay: 'พร้อมเพย์', credit_term: 'เครดิต (เงินเชื่อ)' };
	function buildPaymentMethodItems(j: Record<string, any>): Array<{label: string; checked: boolean}> {
		if (!j?.paymentMethodEnabled) return [];
		const checked = j.paymentMethodChecked && typeof j.paymentMethodChecked === 'object' ? j.paymentMethodChecked : null;
		// New format: paymentMethodValues (show) + paymentMethodChecked (tick)
		if (j.paymentMethodValues && typeof j.paymentMethodValues === 'object') {
			const items = Object.entries(PM_LABELS)
				.filter(([k]) => j.paymentMethodValues[k])
				.map(([k, label]) => ({ label, checked: checked ? !!checked[k] : !!j.paymentMethodValues[k] }));
			if (j.paymentMethodValues.custom) items.push({ label: j.paymentMethodCustom || 'อื่นๆ', checked: checked ? !!checked.custom : true });
			return items;
		}
		// Old format: single paymentMethodValue string
		if (j.paymentMethodValue) {
			return Object.entries(PM_LABELS).map(([k, label]) => ({ label, checked: k === j.paymentMethodValue }));
		}
		return [];
	}

	// Business document flow order for sorting chain timeline
	const DOC_TYPE_ORDER: Record<string, number> = {
		QUO: 0, PR: 1, PO: 2, DO: 3, INV: 4, BILL: 5, TAX: 6, RCPT: 7, CN: 8, PV: 9
	};

	let doc: DocumentWithLines | null = $state(null);
	let customer: Customer | null = $state(null);
	let linkedDocs: DocumentHeader[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	// Reactive: reload data whenever the route param changes (enables chain navigation)
	$effect(() => {
		const docId = $page.params.id;
		if (!docId) { error = 'ไม่พบ ID เอกสาร'; loading = false; return; }
		loadDocument(docId);
	});

	async function loadDocument(docId: string) {
		loading = true;
		error = '';
		doc = null;
		customer = null;
		linkedDocs = [];

		const result = await api.getDoc(docId);
		if (!result) {
			error = 'ไม่พบเอกสาร';
			loading = false;
			return;
		}
		doc = result;

		if (doc.header.customerId) {
			customer = await api.getCustomer(doc.header.customerId);
		}

		// Load linked documents via chain endpoint (with client-side fallback)
		if (doc.header.companyId) {
			let chainResult = await api.getDocChain(doc.header.docId);
			if (chainResult.length === 0) {
				// Fallback: client-side filtering for mock/legacy mode
				const { items } = await api.queryDocs(doc.header.companyId);
				const myDocId = doc.header.docId;
				const myDocNo = doc.header.docNo;
				const myRefDocNo = doc.header.refDocNo;
				const myRefDocId = (doc.header.json as Record<string, any>)?.refDocId || '';
				chainResult = items.filter(d => {
					if (d.docId === myDocId) return false;
					if (myRefDocId && d.docId === myRefDocId) return true;
					if (myRefDocNo && d.docNo === myRefDocNo) return true;
					const theirRefDocId = (d.json as Record<string, any>)?.refDocId || '';
					if (theirRefDocId === myDocId) return true;
					if (d.refDocNo && d.refDocNo === myDocNo) return true;
					return false;
				});
			}
			linkedDocs = chainResult.toSorted((a, b) => {
				const orderA = DOC_TYPE_ORDER[a.docType] ?? 99;
				const orderB = DOC_TYPE_ORDER[b.docType] ?? 99;
				if (orderA !== orderB) return orderA - orderB;
				return a.docDate.localeCompare(b.docDate);
			});
		}
		loading = false;

		// Set topbar custom content
		if (doc) {
			setTopbarCustomContent({
				title: `${getDocTypeLabel(doc.header.docType)} ${doc.header.docNo}`,
				badges: [
					{ label: getDocStatusLabel(doc.header.docStatus), color: DOC_STATUS_COLORS[doc.header.docStatus] || 'gray' },
					{ label: getPaymentStatusLabel(doc.header.paymentStatus), color: PAYMENT_STATUS_COLORS[doc.header.paymentStatus] || 'gray' }
				],
				customActions: [
					{ label: 'พรีวิว', icon: 'eye', onClick: () => { showPreviewModal = true; }, variant: 'outline' }
				]
			});
		}
	}

	onDestroy(() => {
		clearTopbarCustomContent();
	});

	// Derive docLang and company with override from saved json
	let docJson = $derived(((doc as any)?.header?.json || {}) as Record<string, any>);
	let docLang = $derived(docJson.docLang || 'th');
	let companyForPreview = $derived.by(() => {
		const base = $currentCompany;
		if (!base) return null;
		const ov = docJson.companyOverride as Record<string, any> | undefined;
		if (!ov) return base;
		const baseJson = (base.json || {}) as Record<string, any>;
		return {
			...base,
			name: ov.name || base.name,
			address: ov.address || base.address,
			phone: ov.phone || base.phone,
			email: ov.email || base.email,
			taxId: ov.taxId || base.taxId,
			json: {
				...baseJson,
				officeType: ov.officeType || baseJson.officeType,
				isHeadOffice: ov.officeType === 'hq',
				branchName: ov.branchName || baseJson.branchName || '',
				branchNo: ov.branchNo || baseJson.branchNo || '',
			},
		};
	});

	function previewLines() {
		if (!doc) return [];
		return doc.lines.map(l => ({
			name: l.name,
			description: l.description,
			code: l.code,
			qty: l.qty,
			unit: l.unit,
			unitPrice: l.unitPrice,
			lineTotal: l.lineTotal
		}));
	}

	function calcResult() {
		if (!doc) return { subtotal: 0, itemDiscountTotal: 0, afterItemDiscount: 0, discount: 0, totalBeforeTax: 0, preTaxBase: 0, vatAmount: 0, whtAmount: 0, customFeeAmount: 0, customFeeVatAmount: 0, exemptTotal: 0, grandTotal: 0, lineTotals: [] };
		const h = doc.header;
		// Calculate exempt total from lines with taxRate === 'exempt'
		const exemptTotal = doc.lines.filter(l => l.taxRate === 'exempt').reduce((s, l) => s + l.lineTotal, 0);
		return {
			subtotal: h.subtotal,
			itemDiscountTotal: 0,
			afterItemDiscount: h.subtotal,
			discount: h.discountEnabled ? (h.discountType === 'PERCENT' ? h.subtotal * h.discountValue / 100 : h.discountValue) : 0,
			totalBeforeTax: h.totalBeforeTax,
			preTaxBase: h.totalBeforeTax - exemptTotal,
			vatAmount: h.vatAmount,
			whtAmount: h.whtAmount,
			customFeeAmount: 0,
			customFeeVatAmount: 0,
			exemptTotal,
			grandTotal: h.grandTotal,
			lineTotals: doc.lines.map(l => l.lineTotal)
		};
	}

	async function updatePayment(newStatus: string) {
		if (!doc) return;
		const result = await api.updateDocPayment(doc.header.docId, newStatus);
		if (result.ok) {
			doc = { ...doc, header: result.data };
			setTopbarCustomContent({
				title: `${getDocTypeLabel(result.data.docType)} ${result.data.docNo}`,
				badges: [
					{ label: getDocStatusLabel(result.data.docStatus), color: DOC_STATUS_COLORS[result.data.docStatus] || 'gray' },
					{ label: getPaymentStatusLabel(result.data.paymentStatus), color: PAYMENT_STATUS_COLORS[result.data.paymentStatus] || 'gray' }
				],
				customActions: [
					{ label: 'พรีวิว', icon: 'eye', onClick: () => { showPreviewModal = true; }, variant: 'outline' }
				]
			});
			addToast(`อัปเดตสถานะเป็น "${getPaymentStatusLabel(newStatus)}" เรียบร้อย`, 'success');
		}
	}

	function getFlow() {
		if (!doc) return { primary: null, skip: [], special: [] };
		return DOC_FLOW[doc.header.docType] || { primary: null, skip: [], special: [] };
	}

	function getAvailableFlow(): { primary: DocType[]; skip: DocType[]; special: DocType[] } {
		const flow = getFlow();
		const existingTypes = new Set(linkedDocs.map(d => d.docType));
		return {
			primary: flow.primary && !existingTypes.has(flow.primary) ? [flow.primary] : [],
			skip: flow.skip.filter(t => !existingTypes.has(t)),
			special: flow.special.filter(t => !existingTypes.has(t))
		};
	}

	function getDocColor(docType: string): string {
		return getDocConfig(docType as DocType).color || '#1e40af';
	}

	function createFollowUp(newType: DocType) {
		if (!doc) return;
		goto(`/documents?fromDoc=${doc.header.docId}&type=${newType}`);
	}

	// ===== Bulk chain download/print =====
	let chainSelectedIds: Set<string> = $state(new Set());

	// All real docs in the chain (linked + current)
	function chainDocs(): DocumentHeader[] {
		if (!doc) return [];
		return [...linkedDocs, doc.header];
	}

	function toggleChainSelect(docId: string) {
		const next = new Set(chainSelectedIds);
		if (next.has(docId)) next.delete(docId); else next.add(docId);
		chainSelectedIds = next;
	}

	function toggleChainSelectAll() {
		const all = chainDocs();
		chainSelectedIds = chainSelectedIds.size === all.length ? new Set() : new Set(all.map(d => d.docId));
	}

	// Bulk render state
	interface BulkDocData {
		doc: DocumentHeader;
		lines: Array<{name: string; description: string; code: string; qty: number; unit: string; unitPrice: number; lineTotal: number; details?: string}>;
		customer: Customer | null;
	}
	let showChainCopyMode = $state(false);
	let chainCopyModeAction: 'print' | 'download' = $state('download');
	let chainBulkDocs: BulkDocData[] = $state([]);
	let chainBulkEl: HTMLDivElement | undefined = $state();
	let chainBulkBusy = $state(false);
	let chainBulkMode: 'original' | 'copy' | null = $state(null);
	let chainBulkAction: 'print' | 'download' | null = $state(null);

	function chainBulkPrint() {
		if (chainSelectedIds.size === 0) return;
		chainCopyModeAction = 'print';
		showChainCopyMode = true;
	}

	function chainBulkDownload() {
		if (chainSelectedIds.size === 0) return;
		chainCopyModeAction = 'download';
		showChainCopyMode = true;
	}

	async function handleChainCopyModeSelect(mode: 'original' | 'copy') {
		showChainCopyMode = false;
		chainBulkBusy = true;
		chainBulkMode = mode;
		chainBulkAction = chainCopyModeAction;

		const ids = [...chainSelectedIds];
		addToast(`กำลังโหลดข้อมูล ${ids.length} เอกสาร...`, 'info');

		const docsData: BulkDocData[] = [];
		for (const id of ids) {
			const header = chainDocs().find(d => d.docId === id);
			if (!header) continue;
			const fullDoc = await api.getDoc(id);
			let lines: BulkDocData['lines'] = [];
			let cust: Customer | null = null;
			if (fullDoc) {
				lines = fullDoc.lines.map(l => ({
					name: l.name, description: l.description, code: l.code,
					qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, lineTotal: l.lineTotal,
					details: (l as any).details || ''
				}));
				if (fullDoc.header.customerId) {
					cust = await api.getCustomer(fullDoc.header.customerId);
				}
			}
			docsData.push({ doc: header, lines, customer: cust });
		}

		chainBulkDocs = docsData;
		await tick();
		await new Promise(r => setTimeout(r, 800));
		await processChainBulk();
	}

	async function processChainBulk() {
		if (!chainBulkEl || !chainBulkMode || !chainBulkAction) {
			chainBulkBusy = false;
			chainBulkDocs = [];
			return;
		}
		try {
			if (chainBulkAction === 'download') {
				await chainBulkDownloadPdf();
			} else {
				chainBulkPrintDocs();
			}
		} catch (err) {
			console.error('Chain bulk error:', err);
			addToast('เกิดข้อผิดพลาด', 'error');
		} finally {
			chainBulkBusy = false;
			chainBulkDocs = [];
			chainBulkMode = null;
			chainBulkAction = null;
		}
	}

	async function chainBulkDownloadPdf() {
		if (!chainBulkEl || !chainBulkMode) return;
		const result = buildBulkPdfClone(chainBulkEl, chainBulkMode);
		document.body.appendChild(result.container);
		await new Promise(r => setTimeout(r, 300));

		const { default: html2pdf } = await import('html2pdf.js');
		const pdfFilename = `เอกสารต่อเนื่อง-${chainBulkDocs.length}รายการ.pdf`;

		const opt: any = {
			margin: 0,
			filename: pdfFilename,
			image: { type: 'jpeg', quality: 0.98 },
			html2canvas: {
				scale: 2, useCORS: true, letterRendering: true,
				width: 794, windowWidth: 794,
				scrollX: 0, scrollY: 0, x: 0, y: 0
			},
			jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
			pagebreak: { mode: ['avoid-all'] }
		};

		await html2pdf().set(opt).from(result.clone).toPdf().get('pdf').then((pdf: any) => {
			while (pdf.internal.getNumberOfPages() > result.pageCount) {
				pdf.deletePage(pdf.internal.getNumberOfPages());
			}
			if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
				const blob = pdf.output('blob');
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url; a.download = pdfFilename; a.style.display = 'none';
				document.body.appendChild(a); a.click();
				setTimeout(() => { document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 10000); }, 500);
			} else {
				pdf.save(pdfFilename);
			}
		});

		document.body.removeChild(result.container);
		document.getElementById('__pdf-clone-styles__')?.remove();
		addToast(`ดาวน์โหลด PDF รวม ${chainBulkDocs.length} เอกสารเสร็จสิ้น`, 'success');
	}

	function chainBulkPrintDocs() {
		if (!chainBulkEl || !chainBulkMode) return;
		const source = chainBulkEl;
		const clone = source.cloneNode(true) as HTMLElement;
		clone.style.transform = 'none';
		swapBadges(clone, chainBulkMode);
		clone.querySelectorAll('.measure-container').forEach(el => { (el as HTMLElement).style.display = 'none'; });
		clone.querySelectorAll('.doc-page-wrapper').forEach(w => { (w as HTMLElement).style.marginBottom = '0'; });

		const { accent, soft } = readAccentColor(source);
		const printCss = getPrintCss(accent, soft);

		printHtmlContent({
			title: 'พิมพ์เอกสารต่อเนื่อง',
			css: printCss,
			bodyHtml: clone.innerHTML,
		});
		addToast(`ส่งพิมพ์ ${chainBulkDocs.length} เอกสาร`, 'success');
	}

	function getCustomerName(d: DocumentHeader): string {
		return (d.json as Record<string, string>)?.customerName || '-';
	}

	// ===== Preview Modal =====
	let showPreviewModal = $state(false);

	function openPreviewModal() {
		showPreviewModal = true;
	}
</script>

{#if loading}
	<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; gap: 12px;">
		<div class="loading-spinner"></div>
		<div style="color: var(--color-gray-400); font-size: 13px;">กำลังโหลด...</div>
	</div>
{:else if error}
	<div class="empty-state">
		<div class="empty-state-icon" style="background: none;"><AlertTriangle size={48} strokeWidth={1} color="var(--color-gray-300)" /></div>
		<div class="empty-state-title">{error}</div>
		<a href="/documents/history" class="btn btn-outline" style="margin-top: 12px;">
			<ArrowLeft size={16} /> กลับหน้าประวัติ
		</a>
	</div>
{:else if doc}
	<!-- Top Bar -->
	<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
		<a href="/documents/history" class="btn btn-sm btn-outline">
			<ArrowLeft size={14} /> กลับ
		</a>
		<div style="flex: 1;"></div>
		<div style="display: flex; gap: 8px; flex-shrink: 0;">
			<!-- Payment status dropdown -->
			{#if doc.header.docType !== 'QUO'}
				<select class="field-control" style="font-size: 12px; padding: 6px 32px 6px 10px; width: auto; min-width: 140px;" value={doc.header.paymentStatus} onchange={(e) => updatePayment((e.target as HTMLSelectElement).value)}>
					<option value="UNPAID">ยังไม่ชำระ</option>
					<option value="PARTIAL">ชำระบางส่วน</option>
					<option value="PAID">ชำระแล้ว</option>
					<option value="OVERDUE">เกินกำหนด</option>
				</select>
			{/if}
			<a href="/documents?edit={doc.header.docId}" class="btn btn-sm btn-outline"><Edit size={14} /> แก้ไข</a>
		</div>
	</div>

	<!-- Document Chain Timeline -->
	{#if linkedDocs.length > 0 || getAvailableFlow().primary.length > 0 || getAvailableFlow().skip.length > 0 || getAvailableFlow().special.length > 0}
		<div class="card" style="margin-bottom: 16px; padding: 14px; overflow: hidden;">
			<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
				<Link2 size={16} style="color: var(--color-primary);" />
				<span style="font-size: 14px; font-weight: 700;">เอกสารต่อเนื่อง</span>
				{#if chainDocs().length > 1}
					<div style="margin-left: auto; display: flex; align-items: center; gap: 6px;">
						<label style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-gray-500); cursor: pointer; user-select: none;">
							<input type="checkbox" checked={chainSelectedIds.size === chainDocs().length && chainDocs().length > 0} onchange={toggleChainSelectAll} style="cursor: pointer;" />
							เลือกทั้งหมด
						</label>
					</div>
				{/if}
			</div>
			{#if chainSelectedIds.size > 0}
				<div class="chain-bulk-actions">
					<span style="font-size: 12px; font-weight: 600; color: var(--color-gray-600);">เลือก {chainSelectedIds.size} เอกสาร</span>
					<div style="display: flex; gap: 6px;">
						<button class="btn btn-sm btn-outline" onclick={chainBulkDownload} style="font-size: 11px; padding: 4px 10px; border-radius: 100px;">
							<Download size={13} /> ดาวน์โหลด PDF
						</button>
						<button class="btn btn-sm btn-outline" onclick={chainBulkPrint} style="font-size: 11px; padding: 4px 10px; border-radius: 100px;">
							<Printer size={13} /> พิมพ์
						</button>
					</div>
				</div>
			{/if}
			<div class="chain-list">
				<!-- Linked parent/child docs -->
				{#each linkedDocs as ld, i}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="chain-row" class:chain-row-selected={chainSelectedIds.has(ld.docId)} onclick={() => toggleChainSelect(ld.docId)}>
						<div class="chain-dot" style="background: {getDocColor(ld.docType)};"></div>
						<div class="chain-content">
							<div class="chain-header">
								<span class="chain-badge" style="background: color-mix(in srgb, {getDocColor(ld.docType)} 12%, white); color: {getDocColor(ld.docType)}; border: 1px solid color-mix(in srgb, {getDocColor(ld.docType)} 25%, transparent);">{getDocTypeLabel(ld.docType)}</span>
								<span class="chain-docno">{ld.docNo}</span>
								<span class="chain-date">{formatDateShort(ld.docDate)}</span>
								<a href="/documents/{ld.docId}" class="chain-more-link" onclick={(e) => e.stopPropagation()}><Eye size={11} /> ดูเพิ่มเติม</a>
							</div>
							<div class="chain-meta">
								<span class="badge badge-{DOC_STATUS_COLORS[ld.docStatus] || 'gray'}" style="font-size: 10px;">{getDocStatusLabel(ld.docStatus)}</span>
								<span style="margin-left: auto; font-weight: 600; color: var(--color-primary); font-size: 12px;">{formatMoney(ld.grandTotal)}</span>
							</div>
						</div>
					</div>
				{/each}
				<!-- Current document (highlighted) -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="chain-row chain-row-current" class:chain-row-selected={!!doc && chainSelectedIds.has(doc.header.docId)} onclick={() => doc && toggleChainSelect(doc.header.docId)}>
					<div class="chain-dot chain-dot-current" style="background: {getDocColor(doc.header.docType)};"></div>
					<div class="chain-content">
						<div class="chain-header">
							<span class="chain-badge" style="background: color-mix(in srgb, {getDocColor(doc.header.docType)} 12%, white); color: {getDocColor(doc.header.docType)}; border: 1px solid color-mix(in srgb, {getDocColor(doc.header.docType)} 25%, transparent);">{getDocTypeLabel(doc.header.docType)}</span>
							<span class="chain-docno">{doc.header.docNo}</span>
							<span class="chain-current-label">◀ ปัจจุบัน</span>
						</div>
						<div class="chain-meta">
							<span class="badge badge-{DOC_STATUS_COLORS[doc.header.docStatus] || 'gray'}" style="font-size: 10px;">{getDocStatusLabel(doc.header.docStatus)}</span>
							<span style="margin-left: auto; font-weight: 600; color: var(--color-primary); font-size: 12px;">{formatMoney(doc.header.grandTotal)}</span>
						</div>
					</div>
				</div>
				<!-- Primary next step -->
				{#each getAvailableFlow().primary as targetType}
					<button class="chain-row chain-row-new chain-row-primary" onclick={() => createFollowUp(targetType)}>
						<div class="chain-dot chain-dot-new" style="border-color: {getDocColor(targetType)};"></div>
						<div class="chain-content chain-new-content">
							<span class="chain-badge" style="background: color-mix(in srgb, {getDocColor(targetType)} 12%, white); color: {getDocColor(targetType)}; border: 1px solid color-mix(in srgb, {getDocColor(targetType)} 25%, transparent);">{getDocTypeLabel(targetType)}</span>
							<span style="font-size: 12px; color: var(--color-gray-500);">สร้างเอกสารใหม่</span>
							<ArrowRight size={14} style="color: var(--color-gray-400); margin-left: auto;" />
						</div>
					</button>
				{/each}
				<!-- Skip options -->
				{#each getAvailableFlow().skip as targetType}
					<button class="chain-row chain-row-new chain-row-skip" onclick={() => createFollowUp(targetType)}>
						<div class="chain-dot chain-dot-new chain-dot-skip" style="border-color: var(--color-gray-300);"></div>
						<div class="chain-content chain-new-content">
							<span style="font-size: 11px; color: var(--color-gray-400);">ข้าม →</span>
							<span class="chain-badge" style="background: color-mix(in srgb, {getDocColor(targetType)} 8%, white); color: {getDocColor(targetType)}; border: 1px solid color-mix(in srgb, {getDocColor(targetType)} 15%, transparent); opacity: 0.8;">{getDocTypeLabel(targetType)}</span>
							<ArrowRight size={12} style="color: var(--color-gray-300); margin-left: auto;" />
						</div>
					</button>
				{/each}
				<!-- Special options (CN) -->
				{#each getAvailableFlow().special as targetType}
					<button class="chain-row chain-row-new chain-row-skip" onclick={() => createFollowUp(targetType)}>
						<div class="chain-dot chain-dot-new chain-dot-skip" style="border-color: var(--color-gray-300);"></div>
						<div class="chain-content chain-new-content">
							<span class="chain-badge" style="background: color-mix(in srgb, {getDocColor(targetType)} 8%, white); color: {getDocColor(targetType)}; border: 1px solid color-mix(in srgb, {getDocColor(targetType)} 15%, transparent); opacity: 0.8;">{getDocTypeLabel(targetType)}</span>
							<span style="font-size: 11px; color: var(--color-gray-400);">เอกสารพิเศษ</span>
							<ArrowRight size={12} style="color: var(--color-gray-300); margin-left: auto;" />
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Info Cards -->
	<div class="info-cards-grid">
		<div class="card" style="padding: 12px;">
			<div style="font-size: 11px; color: var(--color-gray-500);">ยอดรวมสุทธิ</div>
			<div style="font-size: 20px; font-weight: 700; color: var(--color-primary);">{formatMoney(doc.header.grandTotal)}</div>
		</div>
		<div class="card" style="padding: 12px;">
			<div style="font-size: 11px; color: var(--color-gray-500);">ลูกค้า</div>
			<div style="font-size: 14px; font-weight: 600;">{customer?.name || (doc.header.json as Record<string, string>)?.customerName || '-'}</div>
		</div>
		<div class="card" style="padding: 12px;">
			<div style="font-size: 11px; color: var(--color-gray-500);">รายการ</div>
			<div style="font-size: 14px; font-weight: 600;">{doc.lines.length} รายการ</div>
		</div>
	</div>

	<!-- A4 Preview -->
	<div class="preview-wrapper">
		<DocPreview
			docType={doc.header.docType}
			docNo={doc.header.docNo}
			docDate={doc.header.docDate}
			dueDate={doc.header.dueDate}
			lang={docLang}
			company={companyForPreview}
			{customer}
			lines={previewLines()}
			calc={calcResult()}
			discountEnabled={doc.header.discountEnabled}
			discountType={doc.header.discountType}
			discountValue={doc.header.discountValue}
			vatEnabled={doc.header.vatEnabled}
			vatRate={doc.header.vatRate}
			whtEnabled={doc.header.whtEnabled}
			whtRate={doc.header.whtRate}
			signatureEnabled={doc.header.signatureEnabled}
			notes={doc.header.notes}
			terms={doc.header.terms}
			templateId={getTemplateIdForDocType(doc.header.docType)}
		/>
	</div>
{/if}

<!-- Hidden bulk render container for chain docs -->
{#if chainBulkDocs.length > 0}
	<div bind:this={chainBulkEl} style="position:absolute;left:-9999px;top:0;width:210mm;pointer-events:none;z-index:-9999;">
		{#each chainBulkDocs as bd}
			<PaginatedDocPreview
				docType={bd.doc.docType}
				docNo={bd.doc.docNo}
				docDate={bd.doc.docDate}
				dueDate={bd.doc.dueDate}
				lang={(bd.doc.json as Record<string, any>)?.docLang || 'th'}
				company={$currentCompany}
				customer={bd.customer || { name: getCustomerName(bd.doc) } as any}
				lines={bd.lines}
				calc={{ subtotal: bd.doc.subtotal, totalBeforeTax: bd.doc.totalBeforeTax, preTaxBase: bd.doc.totalBeforeTax, vatAmount: bd.doc.vatAmount, whtAmount: bd.doc.whtAmount, grandTotal: bd.doc.grandTotal, itemDiscountTotal: 0, discount: bd.doc.discountEnabled ? (bd.doc.discountType === 'PERCENT' ? bd.doc.subtotal * bd.doc.discountValue / 100 : bd.doc.discountValue) : 0, lineTotals: bd.lines.map(l => l.lineTotal), afterItemDiscount: bd.doc.subtotal, customFeeAmount: 0, customFeeVatAmount: 0, exemptTotal: bd.lines.filter((l: any) => l.taxRate === 'exempt').reduce((s: number, l: any) => s + l.lineTotal, 0) }}
				discountEnabled={bd.doc.discountEnabled}
				discountType={bd.doc.discountType}
				discountValue={bd.doc.discountValue}
				vatEnabled={bd.doc.vatEnabled}
				vatRate={bd.doc.vatRate}
				vatInclusive={false}
				whtEnabled={bd.doc.whtEnabled}
				whtRate={bd.doc.whtRate}
				signatureEnabled={bd.doc.signatureEnabled}
				signatureName={(bd.doc.json as Record<string, any>)?.signatureName || ''}
				signDate={(bd.doc.json as Record<string, any>)?.signDate || ''}
				notes={bd.doc.notes}
				terms={bd.doc.terms}
				salespersonName={(bd.doc.json as Record<string, any>)?.salespersonName || ''}
				contactPerson={(bd.doc.json as Record<string, any>)?.contactPerson || ''}
				showPaymentMethod={(bd.doc.json as Record<string, any>)?.paymentMethodEnabled || false}
				paymentMethodItems={buildPaymentMethodItems((bd.doc.json as Record<string, any>) || {})}
				showPaymentTerms={(bd.doc.json as Record<string, any>)?.paymentTermsEnabled || false}
				paymentTermsLabel={(bd.doc.json as Record<string, any>)?.paymentTermsCustom || ''}
				customFeeName={(bd.doc.json as Record<string, any>)?.customFeeName || ''}
				customFeeAmount={(bd.doc.json as Record<string, any>)?.customFeeAmount || 0}
				showCustomFee={(bd.doc.json as Record<string, any>)?.customFeeEnabled || false}
				templateId={getTemplateIdForDocType(bd.doc.docType)}
			/>
		{/each}
	</div>
{/if}

<!-- Bulk busy loading overlay -->
{#if chainBulkBusy}
	<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
		<div style="background:#fff;border-radius:12px;padding:32px 48px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
			<div style="font-size:16px;font-weight:600;margin-bottom:8px;">กำลังดำเนินการ...</div>
			<div style="font-size:13px;color:var(--color-gray-500);">กรุณารอสักครู่</div>
		</div>
	</div>
{/if}

<!-- Chain Bulk Copy Mode Dialog -->
<CopyModeDialog
	open={showChainCopyMode}
	title={chainCopyModeAction === 'print' ? 'เลือกรูปแบบก่อนพิมพ์' : 'เลือกรูปแบบก่อนดาวน์โหลด'}
	onselect={handleChainCopyModeSelect}
	oncancel={() => { showChainCopyMode = false; }}
/>

<!-- Preview Modal -->
{#if doc && showPreviewModal}
	<PreviewModal
		open={showPreviewModal}
		title="พรีวิว {getDocTypeLabel(doc.header.docType)} {doc.header.docNo}"
		filename="{doc.header.docNo}.pdf"
		docType={doc.header.docType}
		onclose={() => { showPreviewModal = false; }}
	>
		<PaginatedDocPreview
			docType={doc.header.docType}
			docNo={doc.header.docNo}
			docDate={doc.header.docDate}
			dueDate={doc.header.dueDate}
			lang={docLang}
			company={companyForPreview}
			{customer}
			lines={previewLines()}
			calc={calcResult()}
			discountEnabled={doc.header.discountEnabled}
			discountType={doc.header.discountType}
			discountValue={doc.header.discountValue}
			vatEnabled={doc.header.vatEnabled}
			vatRate={doc.header.vatRate}
			vatInclusive={false}
			whtEnabled={doc.header.whtEnabled}
			whtRate={doc.header.whtRate}
			signatureEnabled={doc.header.signatureEnabled}
			signatureName={(doc.header.json as Record<string, any>)?.signatureName || ''}
			signDate={(doc.header.json as Record<string, any>)?.signDate || ''}
			notes={doc.header.notes}
			terms={doc.header.terms}
			salespersonName={(doc.header.json as Record<string, any>)?.salespersonName || ''}
			contactPerson={(doc.header.json as Record<string, any>)?.contactPerson || ''}
			showPaymentMethod={(doc.header.json as Record<string, any>)?.paymentMethodEnabled || false}
			paymentMethodItems={buildPaymentMethodItems((doc.header.json as Record<string, any>) || {})}
			showPaymentTerms={(doc.header.json as Record<string, any>)?.paymentTermsEnabled || false}
			paymentTermsLabel={(doc.header.json as Record<string, any>)?.paymentTermsCustom || ''}
			customFeeName={(doc.header.json as Record<string, any>)?.customFeeName || ''}
			customFeeAmount={(doc.header.json as Record<string, any>)?.customFeeAmount || 0}
			showCustomFee={(doc.header.json as Record<string, any>)?.customFeeEnabled || false}
			templateId={getTemplateIdForDocType(doc.header.docType)}
		/>
	</PreviewModal>
{/if}

<style>
	.info-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.preview-wrapper {
		overflow: hidden;
		padding-bottom: 20px;
	}

	/* Chain List */
	.chain-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.chain-bulk-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		margin-bottom: 8px;
		background: color-mix(in srgb, var(--color-primary) 5%, white);
		border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
		border-radius: 8px;
	}
	.chain-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 8px 12px;
		border-radius: 8px;
		color: inherit;
		transition: background 0.15s;
		cursor: pointer;
		user-select: none;
		position: relative;
	}
	.chain-row:hover {
		background: var(--color-gray-50, #f9fafb);
	}
	.chain-row-selected {
		background: color-mix(in srgb, #6366f1 10%, white);
		outline: 1.5px solid color-mix(in srgb, #6366f1 30%, transparent);
	}
	.chain-row-current {
		background: color-mix(in srgb, var(--color-primary) 6%, white);
		border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
	}
	.chain-row-current.chain-row-selected {
		background: color-mix(in srgb, #6366f1 10%, white);
		border-color: color-mix(in srgb, #6366f1 25%, transparent);
		outline: 1.5px solid color-mix(in srgb, #6366f1 40%, transparent);
	}
	.chain-row-new {
		border: 1px dashed var(--color-gray-300);
		background: none;
		width: 100%;
		text-align: left;
		font: inherit;
	}
	.chain-row-new:hover {
		background: var(--color-gray-50, #f9fafb);
		border-color: var(--color-gray-400);
	}
	.chain-row-skip {
		border-style: dotted;
		border-color: var(--color-gray-200);
		padding: 6px 12px;
	}
	/* "ดูเพิ่มเติม" link */
	.chain-more-link {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		color: #6366f1;
		text-decoration: none;
		opacity: 0;
		transition: opacity 0.15s, background 0.15s;
		cursor: pointer;
		padding: 1px 8px;
		border: 1px solid color-mix(in srgb, #6366f1 30%, transparent);
		border-radius: 100px;
		background: color-mix(in srgb, #6366f1 6%, white);
		white-space: nowrap;
	}
	.chain-more-link:hover {
		background: color-mix(in srgb, #6366f1 12%, white);
	}
	.chain-row:hover .chain-more-link,
	.chain-row-selected .chain-more-link {
		opacity: 1;
	}
	/* Dots */
	.chain-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 4px;
	}
	.chain-dot-current {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, white);
	}
	.chain-dot-new {
		background: white !important;
		border: 2px dashed var(--color-gray-300);
	}
	.chain-dot-skip {
		width: 10px;
		height: 10px;
		border-width: 1.5px;
	}
	.chain-content {
		flex: 1;
		min-width: 0;
	}
	.chain-header {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.chain-badge {
		padding: 2px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
	}
	.chain-docno {
		font-weight: 600;
		font-size: 13px;
	}
	.chain-date {
		font-size: 12px;
		color: var(--color-gray-400);
	}
	.chain-current-label {
		font-size: 11px;
		color: var(--color-primary);
		font-weight: 600;
	}
	.chain-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}
	.chain-new-content {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	@media (max-width: 768px) {
		.info-cards-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
