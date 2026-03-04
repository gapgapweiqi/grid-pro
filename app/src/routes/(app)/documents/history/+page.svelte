<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { api } from '$lib/services/api';
	import { DOC_TYPES, PAYMENT_STATUS_COLORS, DOC_STATUS_COLORS, DOC_TYPE_CONVERSIONS, getDocConfig } from '$lib/config/constants';
	import { goto } from '$app/navigation';
	import { formatMoney, formatDateShort, getDocTypeLabel, getPaymentStatusLabel, getDocStatusLabel } from '$lib/utils/format';
	import { currentCompanyId, activeCompanyIds, addToast, currentCompany } from '$lib/stores/app';
	import type { DocumentHeader, DocType } from '$lib/types';
	import { Search, Trash2, Filter, Download, Printer, X, ArrowRight, FileText, Eye } from 'lucide-svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import CopyModeDialog from '$lib/components/common/CopyModeDialog.svelte';
	import PreviewModal from '$lib/components/documents/PreviewModal.svelte';
	import PaginatedDocPreview from '$lib/components/documents/PaginatedDocPreview.svelte';
	import { getTemplateIdForDocType } from '$lib/config/templates';
	import { stripSvelteClasses, hexToRgba, getDocPrintStyles, getFullDocStyles, buildPdfColorOverrides, applyInlineAlignmentStyles, readAccentColor, buildBulkPdfClone, getPrintCss, swapBadges } from '$lib/utils/docPrintUtils';
	import { printHtmlContent } from '$lib/utils/print';
	import type { DocumentWithLines, Customer, DocLine } from '$lib/types';

	let documents: DocumentHeader[] = $state([]);
	let searchQuery = $state('');
	let filterDocType = $state('');
	let filterPaymentStatus = $state('');
	let selectedIds: Set<string> = $state(new Set());
	let showDeleteDialog = $state(false);
	let showPreview = $state(false);
	let previewDoc: DocumentHeader | null = $state(null);
	let previewLines: Array<{name: string; description: string; code: string; qty: number; unit: string; unitPrice: number; lineTotal: number}> = $state([]);
	let previewCustomer: Customer | null = $state(null);

	// Doc type change dialog
	let showTypeChangeDialog = $state(false);
	let typeChangeDoc: DocumentHeader | null = $state(null);

	// Auto-action for PreviewModal (auto-trigger print/download after opening)
	let previewAutoAction: 'print' | 'download' | null = $state(null);
	let previewAutoActionMode: 'original' | 'copy' | null = $state(null);

	// Bulk render state
	interface BulkDocData {
		doc: DocumentHeader;
		lines: Array<{name: string; description: string; code: string; qty: number; unit: string; unitPrice: number; lineTotal: number; details?: string}>;
		customer: Customer | null;
	}
	let showBulkCopyMode = $state(false);
	let bulkCopyModeAction: 'print' | 'download' = $state('download');
	let bulkRenderDocs: BulkDocData[] = $state([]);
	let bulkRenderEl: HTMLDivElement | undefined = $state();
	let bulkBusy = $state(false);
	let bulkRenderMode: 'original' | 'copy' | null = $state(null);
	let bulkRenderAction: 'print' | 'download' | null = $state(null);


	function getDocColor(docType: string): string {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(`docColor.${docType}`);
			if (saved) return saved;
		}
		return getDocConfig(docType as DocType).color || '#1e40af';
	}

	let companyUnsub: (() => void) | undefined;

	onMount(() => {
		companyUnsub = activeCompanyIds.subscribe(async (ids) => {
			const validIds = ids.filter(Boolean);
			if (validIds.length) {
				const results = await Promise.all(validIds.map(id => api.queryDocs(id)));
				documents = results.flatMap(r => r.items);
			}
		});
	});

	onDestroy(() => {
		companyUnsub?.();
	});

	function filtered(): DocumentHeader[] {
		let result = documents;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(d =>
				d.docNo.toLowerCase().includes(q) ||
				((d.json as Record<string, string>)?.customerName || '').toLowerCase().includes(q)
			);
		}
		if (filterDocType) result = result.filter(d => d.docType === filterDocType);
		if (filterPaymentStatus) result = result.filter(d => d.paymentStatus === filterPaymentStatus);
		return result.toSorted((a, b) => b.docDate.localeCompare(a.docDate));
	}

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		const f = filtered();
		selectedIds = selectedIds.size === f.length ? new Set() : new Set(f.map(d => d.docId));
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		showDeleteDialog = true;
	}

	async function confirmDelete() {
		showDeleteDialog = false;
		await api.deleteDocs([...selectedIds]);
		const { items } = await api.queryDocs($currentCompanyId || 'comp-001');
		documents = items;
		selectedIds = new Set();
		addToast('ลบเรียบร้อย', 'success');
	}

	async function openPreview(doc: DocumentHeader) {
		previewDoc = doc;
		previewLines = [];
		previewCustomer = null;
		showPreview = true;
		// Fetch full doc with lines
		const fullDoc = await api.getDoc(doc.docId);
		if (fullDoc) {
			previewLines = fullDoc.lines.map(l => ({
				name: l.name, description: l.description, code: l.code,
				qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, lineTotal: l.lineTotal
			}));
			if (fullDoc.header.customerId) {
				previewCustomer = await api.getCustomer(fullDoc.header.customerId);
			}
		}
	}

	function getCustomerName(doc: DocumentHeader): string {
		return (doc.json as Record<string, string>)?.customerName || '-';
	}

	function handleExport() {
		addToast('ฟังก์ชันส่งออกกำลังพัฒนา', 'info');
	}

	// Open type change dialog
	function openTypeChange(doc: DocumentHeader) {
		const conversions = DOC_TYPE_CONVERSIONS[doc.docType] || [];
		if (conversions.length === 0) {
			addToast('ไม่มีประเภทที่สามารถเปลี่ยนได้', 'info');
			return;
		}
		typeChangeDoc = doc;
		showTypeChangeDialog = true;
	}

	// Navigate to create follow-up document
	function createFollowUp(newType: DocType) {
		if (!typeChangeDoc) return;
		showTypeChangeDialog = false;
		goto(`/documents?fromDoc=${typeChangeDoc.docId}&type=${newType}`);
		typeChangeDoc = null;
	}

	// Open preview and auto-trigger an action (print/download)
	async function openPreviewWithAction(doc: DocumentHeader, action: 'print' | 'download', mode: 'original' | 'copy' | null = null) {
		previewAutoAction = action;
		previewAutoActionMode = mode;
		await openPreview(doc);
	}

	// Bulk print/download — show CopyModeDialog first, then process queue
	function bulkPrint() {
		if (selectedIds.size === 0) return;
		bulkCopyModeAction = 'print';
		showBulkCopyMode = true;
	}

	function bulkDownload() {
		if (selectedIds.size === 0) return;
		bulkCopyModeAction = 'download';
		showBulkCopyMode = true;
	}

	async function handleBulkCopyModeSelect(mode: 'original' | 'copy') {
		showBulkCopyMode = false;
		bulkBusy = true;
		bulkRenderMode = mode;
		bulkRenderAction = bulkCopyModeAction;

		const ids = [...selectedIds];
		addToast(`กำลังโหลดข้อมูล ${ids.length} เอกสาร...`, 'info');

		// Fetch all selected docs' full data
		const docsData: BulkDocData[] = [];
		for (const id of ids) {
			const header = documents.find(d => d.docId === id);
			if (!header) continue;
			const fullDoc = await api.getDoc(id);
			let lines: BulkDocData['lines'] = [];
			let customer: Customer | null = null;
			if (fullDoc) {
				lines = fullDoc.lines.map(l => ({
					name: l.name, description: l.description, code: l.code,
					qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, lineTotal: l.lineTotal,
					details: (l as any).details || ''
				}));
				if (fullDoc.header.customerId) {
					customer = await api.getCustomer(fullDoc.header.customerId);
				}
			}
			docsData.push({ doc: header, lines, customer });
		}

		// Set state to trigger rendering in hidden container
		bulkRenderDocs = docsData;

		// Wait for Svelte to render + PaginatedDocPreview pagination to measure
		await tick();
		await new Promise(r => setTimeout(r, 800));

		// Process the rendered container
		await processBulkAfterRender();
	}

	async function processBulkAfterRender() {
		if (!bulkRenderEl || !bulkRenderMode || !bulkRenderAction) {
			bulkBusy = false;
			bulkRenderDocs = [];
			return;
		}

		try {
			if (bulkRenderAction === 'download') {
				await bulkDownloadPdf();
			} else {
				bulkPrintDocs();
			}
		} catch (err) {
			console.error('Bulk operation error:', err);
			addToast('เกิดข้อผิดพลาด', 'error');
		} finally {
			bulkBusy = false;
			bulkRenderDocs = [];
			bulkRenderMode = null;
			bulkRenderAction = null;
		}
	}

	async function bulkDownloadPdf() {
		if (!bulkRenderEl || !bulkRenderMode) return;

		const result = buildBulkPdfClone(bulkRenderEl, bulkRenderMode);
		document.body.appendChild(result.container);
		await new Promise(r => setTimeout(r, 300));

		const { default: html2pdf } = await import('html2pdf.js');
		const pdfFilename = `เอกสารรวม-${bulkRenderDocs.length}รายการ.pdf`;

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
			// Remove blank trailing pages
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
		addToast(`ดาวน์โหลด PDF รวม ${bulkRenderDocs.length} เอกสารเสร็จสิ้น`, 'success');
	}

	function bulkPrintDocs() {
		if (!bulkRenderEl || !bulkRenderMode) return;

		// Clone the rendered container
		const source = bulkRenderEl;
		const clone = source.cloneNode(true) as HTMLElement;
		clone.style.transform = 'none';

		// Swap badges
		swapBadges(clone, bulkRenderMode);

		// Hide measure containers
		clone.querySelectorAll('.measure-container').forEach(el => { (el as HTMLElement).style.display = 'none'; });
		clone.querySelectorAll('.doc-page-wrapper').forEach(w => { (w as HTMLElement).style.marginBottom = '0'; });

		// Read accent color for print CSS
		const { accent, soft } = readAccentColor(source);
		const printCss = getPrintCss(accent, soft);

		printHtmlContent({
			title: 'พิมพ์เอกสารรวม',
			css: printCss,
			bodyHtml: clone.innerHTML,
		});
		addToast(`ส่งพิมพ์ ${bulkRenderDocs.length} เอกสาร`, 'success');
	}

	// Single doc print/download — open preview then auto-trigger CopyModeDialog
	function singlePrint(doc: DocumentHeader) {
		openPreviewWithAction(doc, 'print');
	}

	function singleDownload(doc: DocumentHeader) {
		openPreviewWithAction(doc, 'download');
	}
</script>

<!-- Filters -->
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;" data-tour="filter-section">
	<div style="flex: 1; min-width: 200px; position: relative;" data-tour="search-input">
		<Search size={16} style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-gray-400);" />
		<input class="field-control" placeholder="ค้นหาเลขที่ / ชื่อลูกค้า..." bind:value={searchQuery} style="padding-left: 36px;" />
	</div>
	<select class="field-control" style="width: 160px;" bind:value={filterDocType}>
		<option value="">ทุกประเภท</option>
		{#each DOC_TYPES as dt}<option value={dt.id}>{dt.labelTh}</option>{/each}
	</select>
	<select class="field-control" style="width: 140px;" bind:value={filterPaymentStatus}>
		<option value="">ทุกสถานะ</option>
		<option value="UNPAID">ยังไม่ชำระ</option>
		<option value="PARTIAL">ชำระบางส่วน</option>
		<option value="PAID">ชำระแล้ว</option>
	</select>
	<button class="btn btn-sm btn-outline" onclick={handleExport}><Download size={14} /> ส่งออก CSV</button>
</div>

{#if selectedIds.size > 0}
	<div class="floating-bulk-actions">
		<span>เลือกแล้ว {selectedIds.size} รายการ</span>
		<div style="display: flex; gap: 6px;">
			<button class="btn btn-outline" onclick={bulkPrint} style="border-radius: 100px; padding: 6px 16px;">
				<Printer size={16} /> พิมพ์
			</button>
			<button class="btn btn-outline" onclick={bulkDownload} style="border-radius: 100px; padding: 6px 16px;">
				<Download size={16} /> ดาวน์โหลด PDF
			</button>
			<button class="btn btn-danger" onclick={deleteSelected} style="border-radius: 100px; padding: 6px 16px;">
				<Trash2 size={16} /> ลบที่เลือก
			</button>
		</div>
	</div>
{/if}

<!-- Stats -->
<div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
	<div class="card" style="flex: 1; min-width: 120px; padding: 12px; text-align: center;">
		<div style="font-size: 20px; font-weight: 700;">{filtered().length}</div>
		<div style="font-size: 11px; color: var(--color-gray-500);">เอกสารทั้งหมด</div>
	</div>
	<div class="card" style="flex: 1; min-width: 120px; padding: 12px; text-align: center;">
		<div style="font-size: 20px; font-weight: 700; color: var(--color-success);">{formatMoney(filtered().reduce((s, d) => s + d.grandTotal, 0))}</div>
		<div style="font-size: 11px; color: var(--color-gray-500);">ยอดรวม</div>
	</div>
</div>

<!-- Table -->
{#if filtered().length === 0}
	<div class="empty-state">
		<div class="empty-state-icon" style="background: none;">
			<FileText size={56} strokeWidth={1} color="var(--color-gray-300)" />
		</div>
		<div class="empty-state-title">ไม่พบเอกสาร</div>
		<div class="empty-state-text">ลองเปลี่ยนตัวกรอง หรือสร้างเอกสารใหม่</div>
	</div>
{:else}
	<div class="card" style="padding: 0; overflow: auto;" data-tour="doc-table">
		<table class="data-table">
			<thead>
				<tr>
					<th style="width: 40px;"><input type="checkbox" checked={selectedIds.size === filtered().length && filtered().length > 0} onchange={toggleSelectAll} /></th>
					<th>เลขที่</th>
					<th>ประเภท</th>
					<th>วันที่</th>
					<th>ลูกค้า</th>
					<th style="text-align: right;">ยอดรวม</th>
					<th style="text-align: center; min-width: 90px;">สถานะ</th>
					<th style="width: 120px;"></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered() as doc (doc.docId)}
					<tr>
						<td><input type="checkbox" checked={selectedIds.has(doc.docId)} onchange={() => toggleSelect(doc.docId)} /></td>
						<td><a href="/documents/{doc.docId}" style="font-weight: 600; color: var(--color-primary); text-decoration: none;">{doc.docNo}</a></td>
						<td>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span class="doc-badge doc-badge-clickable" style="background: color-mix(in srgb, {getDocColor(doc.docType)} 12%, white); color: {getDocColor(doc.docType)}; border: 1px solid color-mix(in srgb, {getDocColor(doc.docType)} 25%, transparent);" onclick={() => openTypeChange(doc)} title="คลิกเพื่อเปลี่ยนประเภท">
								{getDocTypeLabel(doc.docType)}
							</span>
						</td>
						<td>{formatDateShort(doc.docDate)}</td>
						<td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{getCustomerName(doc)}</td>
						<td style="text-align: right; font-weight: 500;">{formatMoney(doc.grandTotal)}</td>
						<td style="text-align: center;">
							{#if doc.paymentStatus === 'PAID'}
								<span class="status-badge success">ชำระแล้ว</span>
							{:else if doc.paymentStatus === 'PARTIAL'}
								<span class="status-badge warning">บางส่วน</span>
							{:else}
								<span class="status-badge danger">ยังไม่ชำระ</span>
							{/if}
						</td>
						<td>
							<div style="display: flex; gap: 4px; justify-content: flex-end;">
								<a href="/documents/{doc.docId}" class="btn btn-sm btn-icon btn-outline" title="ดูรายละเอียด"><Search size={14} /></a>
								<button class="btn btn-sm btn-icon btn-outline" onclick={() => singlePrint(doc)} title="พิมพ์"><Printer size={14} /></button>
								<button class="btn btn-sm btn-icon btn-outline" onclick={() => singleDownload(doc)} title="ดาวน์โหลด PDF"><Download size={14} /></button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- Delete Confirmation Dialog -->
<ConfirmDialog
	bind:open={showDeleteDialog}
	title="ยืนยันการลบ"
	message="คุณต้องการลบ {selectedIds.size} เอกสารที่เลือกใช่หรือไม่?"
	confirmLabel="ลบ"
	cancelLabel="ยกเลิก"
	onconfirm={confirmDelete}
	oncancel={() => showDeleteDialog = false}
/>

<!-- Preview Modal -->
{#if previewDoc}
	<PreviewModal
		open={showPreview}
		title="พรีวิว {getDocTypeLabel(previewDoc.docType)} {previewDoc.docNo}"
		filename="{previewDoc.docNo}.pdf"
		docType={previewDoc.docType}
		autoAction={previewAutoAction}
		autoActionMode={previewAutoActionMode}
		onautoactiondone={() => { previewAutoAction = null; previewAutoActionMode = null; }}
		onclose={() => { showPreview = false; previewDoc = null; previewAutoAction = null; previewAutoActionMode = null; }}
	>
		<PaginatedDocPreview
			docType={previewDoc.docType}
			docNo={previewDoc.docNo}
			docDate={previewDoc.docDate}
			dueDate={previewDoc.dueDate}
			company={$currentCompany}
			customer={previewCustomer || { name: getCustomerName(previewDoc) } as any}
			lines={previewLines}
			calc={{ subtotal: previewDoc.subtotal, totalBeforeTax: previewDoc.totalBeforeTax, preTaxBase: previewDoc.totalBeforeTax, vatAmount: previewDoc.vatAmount, whtAmount: previewDoc.whtAmount, grandTotal: previewDoc.grandTotal, itemDiscountTotal: 0, discount: previewDoc.discountEnabled ? (previewDoc.discountType === 'PERCENT' ? previewDoc.subtotal * previewDoc.discountValue / 100 : previewDoc.discountValue) : 0, lineTotals: previewLines.map(l => l.lineTotal), afterItemDiscount: previewDoc.subtotal, customFeeAmount: 0, customFeeVatAmount: 0, exemptTotal: previewLines.filter((l: any) => l.taxRate === 'exempt').reduce((s: number, l: any) => s + l.lineTotal, 0) }}
			discountEnabled={previewDoc.discountEnabled}
			discountType={previewDoc.discountType}
			discountValue={previewDoc.discountValue}
			vatEnabled={previewDoc.vatEnabled}
			vatRate={previewDoc.vatRate}
			vatInclusive={false}
			whtEnabled={previewDoc.whtEnabled}
			whtRate={previewDoc.whtRate}
			signatureEnabled={previewDoc.signatureEnabled}
			signatureName={(previewDoc.json as Record<string, any>)?.signatureName || ''}
			signDate={(previewDoc.json as Record<string, any>)?.signDate || ''}
			notes={previewDoc.notes}
			terms={previewDoc.terms}
			salespersonName={(previewDoc.json as Record<string, any>)?.salespersonName || ''}
			contactPerson={(previewDoc.json as Record<string, any>)?.contactPerson || ''}
			showPaymentTerms={(previewDoc.json as Record<string, any>)?.paymentTermsEnabled || false}
			paymentTermsLabel={(previewDoc.json as Record<string, any>)?.paymentTermsCustom || ''}
			customFeeName={(previewDoc.json as Record<string, any>)?.customFeeName || ''}
			customFeeAmount={(previewDoc.json as Record<string, any>)?.customFeeAmount || 0}
			showCustomFee={(previewDoc.json as Record<string, any>)?.customFeeEnabled || false}
			templateId={getTemplateIdForDocType(previewDoc.docType)}
		/>
	</PreviewModal>
{/if}

<!-- Doc Type Change Dialog -->
{#if showTypeChangeDialog && typeChangeDoc}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal-overlay" role="dialog" aria-modal="true" tabindex="-1">
		<div class="modal" onclick={(e) => e.stopPropagation()} style="max-width: 440px; padding: 24px; position: relative;">
			<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
				<h3 style="font-size: 16px; font-weight: 700; margin: 0;">สร้างเอกสารต่อเนื่อง</h3>
				<button style="background: none; border: none; padding: 4px; cursor: pointer; color: var(--color-gray-400);" onclick={() => { showTypeChangeDialog = false; typeChangeDoc = null; }}>
					<X size={20} />
				</button>
			</div>
			<div style="font-size: 13px; color: var(--color-gray-500); margin-bottom: 16px;">
				สร้างเอกสารใหม่จาก <strong style="color: {getDocColor(typeChangeDoc.docType)};">{getDocTypeLabel(typeChangeDoc.docType)} {typeChangeDoc.docNo}</strong> โดยคัดลอกข้อมูลทั้งหมดให้อัตโนมัติ:
			</div>
			<div style="display: flex; flex-direction: column; gap: 8px;">
				{#each (DOC_TYPE_CONVERSIONS[typeChangeDoc.docType] || []) as targetType}
					<button class="type-change-option" style="--type-color: {getDocColor(targetType)};" onclick={() => createFollowUp(targetType)}>
						<span class="doc-badge" style="background: color-mix(in srgb, {getDocColor(targetType)} 12%, white); color: {getDocColor(targetType)}; border: 1px solid color-mix(in srgb, {getDocColor(targetType)} 25%, transparent);">
							{getDocTypeLabel(targetType)}
						</span>
						<span style="font-size: 12px; color: var(--color-gray-500);">คัดลอกข้อมูลทั้งหมด + สร้างเลขที่ใหม่</span>
						<ArrowRight size={14} style="color: var(--color-gray-400); margin-left: auto;" />
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- Hidden bulk render container -->
{#if bulkRenderDocs.length > 0}
	<div bind:this={bulkRenderEl} style="position:absolute;left:-9999px;top:0;width:210mm;pointer-events:none;z-index:-9999;">
		{#each bulkRenderDocs as bd}
			<PaginatedDocPreview
				docType={bd.doc.docType}
				docNo={bd.doc.docNo}
				docDate={bd.doc.docDate}
				dueDate={bd.doc.dueDate}
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
{#if bulkBusy}
	<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
		<div style="background:#fff;border-radius:12px;padding:32px 48px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
			<div style="font-size:16px;font-weight:600;margin-bottom:8px;">กำลังดำเนินการ...</div>
			<div style="font-size:13px;color:var(--color-gray-500);">กรุณารอสักครู่</div>
		</div>
	</div>
{/if}

<!-- Bulk Copy Mode Dialog (Original / Copy) -->
<CopyModeDialog
	open={showBulkCopyMode}
	title={bulkCopyModeAction === 'print' ? 'เลือกรูปแบบก่อนพิมพ์' : 'เลือกรูปแบบก่อนดาวน์โหลด'}
	onselect={handleBulkCopyModeSelect}
	oncancel={() => { showBulkCopyMode = false; }}
/>

<style>
	.doc-badge {
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
	}
	.doc-badge-clickable {
		cursor: pointer;
		transition: all 0.15s;
	}
	.doc-badge-clickable:hover {
		opacity: 0.8;
		transform: scale(1.05);
	}
	.status-badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
	}
	.type-change-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--color-gray-200);
		border-radius: 10px;
		background: white;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
	}
	.type-change-option:hover {
		border-color: var(--type-color, var(--color-primary));
		background: color-mix(in srgb, var(--type-color, var(--color-primary)) 4%, white);
		transform: translateX(4px);
	}
	
	@media (max-width: 768px) {
		.doc-badge {
			font-size: 11px;
			padding: 3px 6px;
			white-space: nowrap;
		}
	}
</style>
