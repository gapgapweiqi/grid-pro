<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto, beforeNavigate } from '$app/navigation';
	import { api, initApi } from '$lib/services/api';
	import { memoryAdapter } from '$lib/services/memory-adapter';
	import { get } from 'svelte/store';
	import { currentCompanyId, currentCompany, addToast, topbarActions, showDriveConnectModal } from '$lib/stores/app';
	import { currentUser } from '$lib/stores/auth';
	import { DOC_TYPES, DOC_CONFIG, getDocConfig } from '$lib/config/constants';
	import { calculateDocument, type CustomFeeVatMode } from '$lib/utils/calc';
	import { formatMoney, getDocTypeLabel, bahtText } from '$lib/utils/format';
	import { generateUuid, nowIso } from '$lib/utils/helpers';
	import { generateDocNo, DEFAULT_DOC_NO_SETTINGS } from '$lib/utils/sequence';
	import type { Customer, Product, DocType, DocumentHeader, DocLine, Salesperson, DocLang, BankAccount } from '$lib/types';
	import { companies as companiesStore, currentCompanyId as companyIdStore } from '$lib/stores/app';
	import { Plus, Trash2, Save, Eye, Printer, Upload, X, ChevronRight, ChevronLeft, ChevronDown, FileText, ListOrdered, Settings2, Link2, Lock, ArrowDownCircle, ArrowUpCircle } from 'lucide-svelte';
	import { loadDocPrefs, saveDocPrefs } from '$lib/stores/userPrefs';
	import { getTemplateIdForDocType } from '$lib/config/templates';
	import PaginatedDocPreview from '$lib/components/documents/PaginatedDocPreview.svelte';
	import PreviewModal from '$lib/components/documents/PreviewModal.svelte';
	import PresetBar from '$lib/components/PresetBar.svelte';
	import ProductPickerDialog from '$lib/components/documents/ProductPickerDialog.svelte';
	import type { PickedItem } from '$lib/types';
	import { ShoppingCart } from 'lucide-svelte';
	import type { OverlayItem } from '$lib/types';
	import { isSandbox, SANDBOX_LOCKED_PRODUCT_ID, SANDBOX_LOGO_URL } from '$lib/stores/sandbox';
	import SandboxUpgradeDialog from '$lib/components/SandboxUpgradeDialog.svelte';

	let customers: Customer[] = $state([]);
	let products: Product[] = $state([]);
	let salespersons: Salesperson[] = $state([]);
	let editingDocId: string | null = $state(null);
	let showSandboxUpgrade = $state(false);

	// Document chaining (follow-up from existing doc)
	let refDocId = $state('');
	let refDocNo = $state('');

	// Form state
	let docCategory: 'income' | 'expense' = $state('income');
	let combinedTaxRcpt = $state(false);
	let returnToStock = $state(false);
	let docType: DocType = $state('QUO');
	let docNo = $state('');
	let docDate = $state(new Date().toISOString().substring(0, 10));
	let dueDate = $state('');
	let customerId = $state('');
	let salespersonId = $state('');
	let contactPerson = $state('');
	let contactPersonMode: 'select' | 'custom' = $state('select');
	let docLang: DocLang = $state('th');
	let notes = $state('');
	let terms = $state('');

	// Customer detail (auto-filled when selected)
	let customerName = $state('');
	let customerTaxId = $state('');
	let customerAddress = $state('');
	let customerPhone = $state('');
	let customerEmail = $state('');
	let customerOfficeType = $state<'none' | 'hq' | 'branch'>('none');
	let customerBranchName = $state('');
	let customerBranchNo = $state('');

	// Company override (document-specific, doesn't change global company data)
	let compOverrideName = $state('');
	let compOverrideAddress = $state('');
	let compOverridePhone = $state('');
	let compOverrideEmail = $state('');
	let compOverrideTaxId = $state('');
	let compOverrideOfficeType = $state<'none' | 'hq' | 'branch'>('none');
	let compOverrideBranchName = $state('');
	let compOverrideBranchNo = $state('');
	let compOverrideOpen = $state(false);

	function fillCompanyOverrideFromCurrent() {
		const c = $currentCompany;
		if (!c) return;
		compOverrideName = c.name || '';
		compOverrideAddress = c.address || '';
		compOverridePhone = c.phone || '';
		compOverrideEmail = c.email || '';
		compOverrideTaxId = c.taxId || '';
		const cj = (c.json || {}) as Record<string, any>;
		const ot = cj.officeType as string;
		compOverrideOfficeType = ot === 'hq' ? 'hq' : ot === 'branch' ? 'branch' : ot === 'none' ? 'none' : (cj.isHeadOffice ? 'hq' : 'none');
		compOverrideBranchName = (cj.branchName as string) || '';
		compOverrideBranchNo = (cj.branchNo as string) || '';
	}

	// Custom fields (user-defined key-value pairs)
	let customFields: Array<{label: string; value: string}> = $state([]);

	// Template ID derived from settings
	let templateId = $derived(getTemplateIdForDocType(docType));

	// Bank info for payment channel
	let showBankInfo = $state(false);
	let selectedBankIndexes: number[] = $state([]);

	// Financial toggles
	let discountEnabled = $state(false);
	let discountType: 'AMOUNT' | 'PERCENT' = $state('PERCENT');
	let discountValue = $state(0);
	let vatEnabled = $state(true);
	let vatRate = $state(7);
	let vatInclusive = $state(false);
	let whtEnabled = $state(false);
	let whtRate = $state(3);
	let signatureEnabled = $state(true);
	let signatureTitle = $state('');
	let signatureName = $state('');
	let signDate = $state('');
	let signatureImage = $state('');

	// Signature 2 (ผู้รับ)
	let signature2Enabled = $state(false);
	let signature2Title = $state('');
	let signature2Name = $state('');
	let signature2Date = $state('');
	let signature2Image = $state('');

	// Signature 3 (custom title, e.g. ผู้อนุมัติ)
	let signature3Enabled = $state(false);
	let signature3Title = $state('');
	let signature3Name = $state('');
	let signature3Date = $state('');
	let signature3Image = $state('');

	// Stamp
	let stampEnabled = $state(false);
	let stampSource: 'logo' | 'custom' = $state('logo');
	let stampImage = $state('');

	// Overlay transform state for interactive drag/resize/rotate (stamp only)
	let stampTransform = $state({ x: 65, y: 100, width: 50, height: 50, rotation: -35 });

	// Custom fee
	let customFeeEnabled = $state(false);
	let customFeeName = $state('');
	let customFeeAmount = $state(0);
	let customFeeVatMode: CustomFeeVatMode = $state('NO_VAT');

	// Payment method (multi-select: which to show + which are ticked)
	let paymentMethodEnabled = $state(false);
	let paymentMethodValues = $state<Record<string, boolean>>({ cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false });
	let paymentMethodChecked = $state<Record<string, boolean>>({ cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false });
	let paymentMethodCustom = $state('');
	const PAYMENT_METHOD_OPTIONS = [
		{ value: 'cash', label: 'เงินสด' },
		{ value: 'transfer', label: 'โอนเงิน' },
		{ value: 'cheque', label: 'เช็ค' },
		{ value: 'credit_card', label: 'บัตรเครดิต' },
		{ value: 'promptpay', label: 'พร้อมเพย์' },
		{ value: 'credit_term', label: 'เครดิต (เงินเชื่อ)' },
		{ value: 'custom', label: 'อื่นๆ' }
	];

	// Payment terms
	let paymentTermsEnabled = $state(false);
	let paymentTermsPreset = $state('credit30');
	let paymentTermsCustom = $state('');
	const PAYMENT_TERMS_OPTIONS = [
		{ value: 'cash', label: 'เงินสด' },
		{ value: 'credit7', label: 'เครดิต 7 วัน' },
		{ value: 'credit15', label: 'เครดิต 15 วัน' },
		{ value: 'credit30', label: 'เครดิต 30 วัน' },
		{ value: 'credit45', label: 'เครดิต 45 วัน' },
		{ value: 'credit60', label: 'เครดิต 60 วัน' },
		{ value: 'custom', label: 'กำหนดเอง' }
	];

	// Line items
	let itemMode: 'product' | 'service' = $state('product');
	let showItemDetails = $state(false);

	// Column visibility settings for line items
	let showColumnSettings = $state(false);
	let lineColumnVisibility = $state({
		rowNum: true,
		code: true,
		name: true,
		description: false,
		qty: true,
		unit: true,
		unitPrice: true,
		discount: true,
		tax: false,
	});

	// Billing note invoice selector
	let billingInvoices: import('$lib/types').DocumentHeader[] = $state([]);
	let selectedInvoiceIds: Set<string> = $state(new Set());
	let loadingInvoices = $state(false);

	async function fetchBillingInvoices() {
		if (docType !== 'BILL' || !customerId) { billingInvoices = []; return; }
		loadingInvoices = true;
		try {
			const companyId = $currentCompanyId || 'comp-001';
			billingInvoices = await api.listInvoicesForBilling(companyId, customerId);
		} catch { billingInvoices = []; }
		loadingInvoices = false;
	}

	function toggleInvoiceSelection(docId: string) {
		const next = new Set(selectedInvoiceIds);
		if (next.has(docId)) next.delete(docId); else next.add(docId);
		selectedInvoiceIds = next;
		// Sync lines from selected invoices
		lines = billingInvoices.filter(inv => selectedInvoiceIds.has(inv.docId)).map(inv => ({
			id: generateUuid(),
			productId: inv.docId,
			code: inv.docNo,
			name: `${inv.docNo} (${inv.docDate})`,
			description: `ใบแจ้งหนี้ ${inv.docNo}`,
			details: '',
			qty: 1,
			unit: 'ฉบับ',
			unitPrice: inv.grandTotal,
			discountType: '',
			discountValue: 0,
			taxRate: 'none'
		}));
		if (lines.length === 0) lines = [createEmptyLine()];
	}

	interface LineItem {
		id: string;
		productId: string;
		code: string;
		name: string;
		description: string;
		details: string;
		qty: number;
		unit: string;
		unitPrice: number;
		discountType: string;
		discountValue: number;
		taxRate: string;
	}

	let lines: LineItem[] = $state([createEmptyLine()]);

	// Derived
	let config = $derived(getDocConfig(docType));
	let calcResult = $derived(calculateDocument({
		lines: lines.map(l => ({ qty: l.qty, unitPrice: l.unitPrice, discountType: l.discountType, discountValue: l.discountValue, taxRate: l.taxRate })),
		discountEnabled, discountType, discountValue,
		vatEnabled, vatRate, vatInclusive, whtEnabled, whtRate,
		customFeeEnabled, customFeeAmount, customFeeVatMode
	}));
	let selectedCustomer = $derived(customers.find(c => c.entityId === customerId) || null);
	let customerContactPersons = $derived((selectedCustomer?.json?.contactPersons as Array<{name: string; position?: string}>) || []);
	let companyBankAccounts = $derived(($currentCompany?.json?.bankAccounts as BankAccount[] || []));

	// Build a merged company object for preview — override fields take precedence
	let companyForPreview = $derived.by(() => {
		const base = $currentCompany;
		if (!base) return null;
		if (!compOverrideOpen) return base;
		const baseJson = (base.json || {}) as Record<string, any>;
		return {
			...base,
			name: compOverrideName || base.name,
			address: compOverrideAddress || base.address,
			phone: compOverridePhone || base.phone,
			email: compOverrideEmail || base.email,
			taxId: compOverrideTaxId || base.taxId,
			json: {
				...baseJson,
				officeType: compOverrideOfficeType,
				isHeadOffice: compOverrideOfficeType === 'hq',
				branchName: compOverrideOfficeType === 'branch' ? compOverrideBranchName : '',
				branchNo: compOverrideOfficeType === 'branch' ? compOverrideBranchNo : '',
			},
		};
	});

	// Build customer object with document-level office type override for preview
	let customerForPreview = $derived.by(() => {
		const base = selectedCustomer;
		if (!base) return null;
		const baseJson = (base.json || {}) as Record<string, any>;
		return {
			...base,
			name: customerName || base.name,
			json: {
				...baseJson,
				officeType: customerOfficeType,
				isHeadOffice: customerOfficeType === 'hq',
				branchName: customerOfficeType === 'branch' ? customerBranchName : '',
				branchNo: customerOfficeType === 'branch' ? customerBranchNo : '',
			},
		};
	});

	// Auto-fill customer details when selection changes
	$effect(() => {
		if (selectedCustomer) {
			customerName = selectedCustomer.name;
			customerTaxId = selectedCustomer.taxId || '';
			customerAddress = selectedCustomer.address || '';
			customerPhone = selectedCustomer.phone || '';
			customerEmail = selectedCustomer.email || '';
			const cj = (selectedCustomer.json || {}) as Record<string, any>;
			const cot = cj.officeType as string;
			customerOfficeType = cot === 'hq' ? 'hq' : cot === 'branch' ? 'branch' : cot === 'none' ? 'none' : (cj.isHeadOffice ? 'hq' : 'none');
			customerBranchName = (cj.branchName as string) || '';
			customerBranchNo = (cj.branchNo as string) || '';
			customFields = ((selectedCustomer.json?.customFields as Array<{label: string; value: string}>) || []).map(cf => ({ ...cf }));
			contactPerson = ''; contactPersonMode = 'select';
		} else if (!customerId && !customerName.trim()) {
			customerTaxId = ''; customerAddress = ''; customerPhone = ''; customerEmail = '';
			customerOfficeType = 'none'; customerBranchName = ''; customerBranchNo = '';
			customFields = [];
			contactPerson = ''; contactPersonMode = 'select';
		}
	});

	// Auto-fill signature titles when docType changes
	$effect(() => {
		if (!signatureTitle.trim()) {
			signatureTitle = autoIssuerTitle();
		}
		if (!signature2Title.trim()) {
			signature2Title = autoReceiverTitle();
		}
	});
	$effect(() => {
		if (customerContactPersons.length === 0) {
			contactPersonMode = 'custom';
		}
	});

	// Auto-fetch invoices for billing note when customer changes
	$effect(() => {
		if (docType === 'BILL' && customerId) {
			fetchBillingInvoices();
		}
	});
	let selectedSalesperson = $derived(salespersons.find(s => s.entityId === salespersonId));
	let paymentTermsLabel = $derived(() => {
		if (paymentTermsPreset === 'custom') return paymentTermsCustom;
		return PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTermsPreset)?.label || '';
	});

	// Auto-fill signature titles based on document type
	let autoIssuerTitle = $derived(() => {
		const docName = config?.nameTH || '';
		switch (docType) {
			case 'QUO': return `ผู้ออก${docName}`;
			case 'INV': return `ผู้ออก${docName}`;
			case 'BILL': return `ผู้ออก${docName}`;
			case 'TAX': return `ผู้ออก${docName}`;
			case 'RCPT': return `ผู้ออก${docName}`;
			case 'DO': return `ผู้ออก${docName}`;
			case 'PO': return `ผู้ออก${docName}`;
			case 'CN': return `ผู้ออก${docName}`;
			case 'PV': return `ผู้ออก${docName}`;
			case 'PR': return `ผู้ออก${docName}`;
			default: return `ผู้ออกเอกสาร`;
		}
	});

	let autoReceiverTitle = $derived(() => {
		const docName = config?.nameTH || '';
		switch (docType) {
			case 'QUO': return `ผู้รับ${docName}`;
			case 'INV': return `ผู้รับ${docName}`;
			case 'BILL': return `ผู้รับ${docName}`;
			case 'TAX': return `ผู้รับ${docName}`;
			case 'RCPT': return `ผู้รับ${docName}`;
			case 'DO': return `ผู้รับ${docName}`;
			case 'PO': return `ผู้รับ${docName}`;
			case 'CN': return `ผู้รับ${docName}`;
			case 'PV': return `ผู้รับ${docName}`;
			case 'PR': return `ผู้รับ${docName}`;
			default: return `ผู้รับเอกสาร`;
		}
	});

	let showPreview = $state(false);

	// Step wizard
	let currentStep = $state(1);
	const STEPS = [
		{ num: 1, label: 'ส่วนหัว', icon: FileText },
		{ num: 2, label: 'รายการ+สรุป', icon: ListOrdered },
		{ num: 3, label: 'ส่วนเสริม', icon: Settings2 }
	];

	function nextStep() {
		if (currentStep === 1) {
			if (!customerId && !customerName.trim()) { addToast('กรุณาเลือกลูกค้าหรือกรอกชื่อ', 'error'); return; }
		}
		if (currentStep < 3) currentStep++;
	}

	function prevStep() {
		if (currentStep > 1) currentStep--;
	}

	function savePrefsForCurrentDocType() {
		saveDocPrefs(docType, {
			vatEnabled, vatRate, vatInclusive, whtEnabled, whtRate,
			signatureEnabled, stampEnabled, showBankInfo, paymentTermsEnabled, itemMode,
			lineColumnVisibility
		});
	}

	onMount(async () => {
		// Load products, customers, salespersons immediately
		await loadRefData();

		// Topbar actions cleared (preview button is in step nav)
		topbarActions.set([]);

		const editId = $page.url.searchParams.get('edit');
		const paramType = $page.url.searchParams.get('type');
		const fromDocId = $page.url.searchParams.get('fromDoc');

		// Restore draft if no edit/query params — preserves form + wizard step
		if (!editId && !paramType && !fromDocId) {
			const restored = restoreDraft();
			if (restored) { ensureSandboxLockedLine(); return; }
		}

		// Load cached preferences (only when not restoring draft)
		const prefs = loadDocPrefs(docType);
		if (prefs.vatEnabled !== undefined) vatEnabled = prefs.vatEnabled;
		if (prefs.vatRate !== undefined) vatRate = prefs.vatRate;
		if (prefs.vatInclusive !== undefined) vatInclusive = prefs.vatInclusive;
		if (prefs.whtEnabled !== undefined) whtEnabled = prefs.whtEnabled;
		if (prefs.whtRate !== undefined) whtRate = prefs.whtRate;
		if (prefs.signatureEnabled !== undefined) signatureEnabled = prefs.signatureEnabled;
		if (prefs.stampEnabled !== undefined) stampEnabled = prefs.stampEnabled;
		if (prefs.showBankInfo !== undefined) showBankInfo = prefs.showBankInfo;
		if (prefs.paymentTermsEnabled !== undefined) paymentTermsEnabled = prefs.paymentTermsEnabled;
		if (prefs.itemMode !== undefined) itemMode = prefs.itemMode;
		if (prefs.lineColumnVisibility) {
			lineColumnVisibility = { ...lineColumnVisibility, ...prefs.lineColumnVisibility };
			showItemDetails = lineColumnVisibility.description;
		}
		if (editId) {
			const existing = await api.getDoc(editId);
			if (existing) {
				editingDocId = editId;
				const h = existing.header;
				docType = h.docType;
				docNo = h.docNo;
				docDate = h.docDate;
				dueDate = h.dueDate;
				customerId = h.customerId;
				notes = h.notes;
				terms = h.terms;
				discountEnabled = h.discountEnabled;
				discountType = h.discountType;
				discountValue = h.discountValue;
				vatEnabled = h.vatEnabled;
				vatRate = h.vatRate;
				whtEnabled = h.whtEnabled;
				whtRate = h.whtRate;
				signatureEnabled = h.signatureEnabled;
				lines = existing.lines.map(l => ({
					id: generateUuid(),
					productId: l.productId || '',
					code: l.code,
					name: l.name,
					description: l.description,
					details: (l as any).details || '',
					qty: l.qty,
					unit: l.unit,
					unitPrice: l.unitPrice,
					discountType: l.discountType || '',
					discountValue: l.discountValue || 0,
					taxRate: (l as any).taxRate || 'none'
				}));
				if (lines.length === 0) lines = [createEmptyLine()];
				// Restore json fields
				const j = (h.json || {}) as Record<string, any>;
				customerName = j.customerName || '';
				customerTaxId = j.customerTaxId || '';
				customerAddress = j.customerAddress || '';
				customerPhone = j.customerPhone || '';
				customerEmail = j.customerEmail || '';
				const cot = j.customerOfficeType as string;
				customerOfficeType = cot === 'hq' ? 'hq' : cot === 'branch' ? 'branch' : 'none';
				customerBranchName = j.customerBranchName || '';
				customerBranchNo = j.customerBranchNo || '';
				docLang = j.docLang || 'th';
				salespersonId = j.salespersonId || '';
				contactPerson = j.contactPerson || '';
				signatureTitle = j.signatureTitle || '';
				signatureName = j.signatureName || '';
				signDate = j.signDate || '';
				signature2Enabled = j.signature2Enabled || false;
				signature2Title = j.signature2Title || '';
				signature2Name = j.signature2Name || '';
				signature2Date = j.signature2Date || '';
				signature3Enabled = j.signature3Enabled || false;
				signature3Title = j.signature3Title || '';
				signature3Name = j.signature3Name || '';
				signature3Date = j.signature3Date || '';
				vatInclusive = j.vatInclusive || false;
				customFeeEnabled = j.customFeeEnabled || false;
				customFeeName = j.customFeeName || '';
				customFeeAmount = j.customFeeAmount || 0;
				customFeeVatMode = j.customFeeVatMode || 'NO_VAT';
				paymentMethodEnabled = j.paymentMethodEnabled || false;
				if (j.paymentMethodValues && typeof j.paymentMethodValues === 'object') {
					paymentMethodValues = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, ...j.paymentMethodValues };
				} else if (j.paymentMethodValue && typeof j.paymentMethodValue === 'string') {
					paymentMethodValues = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, [j.paymentMethodValue]: true };
				}
				if (j.paymentMethodChecked && typeof j.paymentMethodChecked === 'object') {
					paymentMethodChecked = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, ...j.paymentMethodChecked };
				} else if (j.paymentMethodValue && typeof j.paymentMethodValue === 'string') {
					// Old format: the single selected value was the ticked one
					paymentMethodChecked = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, [j.paymentMethodValue]: true };
				}
				paymentMethodCustom = j.paymentMethodCustom || '';
				paymentTermsEnabled = j.paymentTermsEnabled || false;
				paymentTermsPreset = j.paymentTermsPreset || 'credit30';
				paymentTermsCustom = j.paymentTermsCustom || '';
				showBankInfo = j.showBankInfo || false;
				customFields = (j.customFields as Array<{label: string; value: string}> || []).map((cf: any) => ({ ...cf }));
				refDocId = j.refDocId || '';
				returnToStock = j.returnToStock || false;
				// Restore lineColumnVisibility
				if (j.lineColumnVisibility) {
					lineColumnVisibility = { ...lineColumnVisibility, ...j.lineColumnVisibility };
					showItemDetails = lineColumnVisibility.description;
				}
				// Restore company override
				if (j.companyOverride) {
					compOverrideName = j.companyOverride.name || '';
					compOverrideAddress = j.companyOverride.address || '';
					compOverridePhone = j.companyOverride.phone || '';
					compOverrideEmail = j.companyOverride.email || '';
					compOverrideTaxId = j.companyOverride.taxId || '';
					const ovOt = j.companyOverride.officeType as string;
					compOverrideOfficeType = ovOt === 'hq' ? 'hq' : ovOt === 'branch' ? 'branch' : 'none';
					compOverrideBranchName = j.companyOverride.branchName || '';
					compOverrideBranchNo = j.companyOverride.branchNo || '';
					compOverrideOpen = true;
				}
				ensureSandboxLockedLine();
				return;
			}
		}

		// ── Document Chaining: Create follow-up from existing document ──
		if (fromDocId) {
			const sourceDoc = await api.getDoc(fromDocId);
			if (sourceDoc) {
				const h = sourceDoc.header;
				const j = (h.json || {}) as Record<string, any>;

				// Set document type from param (new type), keep new docDate
				if (paramType && ['QUO','INV','BILL','TAX','RCPT','DO','PO','CN','PV','PR'].includes(paramType)) {
					docType = paramType as DocType;
				}

				// Store reference to source document
				refDocId = h.docId;
				refDocNo = h.docNo;

				// Copy customer info
				customerId = h.customerId || '';
				customerName = j.customerName || '';
				customerTaxId = j.customerTaxId || '';
				customerAddress = j.customerAddress || '';
				customerPhone = j.customerPhone || '';
				customerEmail = j.customerEmail || '';
				customFields = (j.customFields as Array<{label: string; value: string}> || []).map(cf => ({ ...cf }));

				// Copy salesperson & contact
				salespersonId = j.salespersonId || '';
				contactPerson = j.contactPerson || '';
				docLang = j.docLang || 'th';

				// Copy financial settings
				discountEnabled = h.discountEnabled;
				discountType = h.discountType;
				discountValue = h.discountValue;
				vatEnabled = h.vatEnabled;
				vatRate = h.vatRate;
				vatInclusive = j.vatInclusive ?? false;
				whtEnabled = h.whtEnabled;
				whtRate = h.whtRate;

				// Copy notes & terms
				notes = h.notes || '';
				terms = h.terms || '';

				// Copy signature settings
				signatureEnabled = h.signatureEnabled;
				signatureTitle = j.signatureTitle || '';
				signatureName = j.signatureName || '';
				signDate = j.signDate || '';
				signature2Enabled = j.signature2Enabled ?? false;
				signature2Title = j.signature2Title || '';
				signature2Name = j.signature2Name || '';
				signature2Date = j.signature2Date || '';
				signature3Enabled = j.signature3Enabled ?? false;
				signature3Title = j.signature3Title || '';
				signature3Name = j.signature3Name || '';
				signature3Date = j.signature3Date || '';

				// Copy custom fee
				customFeeEnabled = j.customFeeEnabled ?? false;
				customFeeName = j.customFeeName || '';
				customFeeAmount = j.customFeeAmount ?? 0;
				customFeeVatMode = j.customFeeVatMode || 'NO_VAT';

				// Copy payment method
				paymentMethodEnabled = j.paymentMethodEnabled ?? false;
				if (j.paymentMethodValues && typeof j.paymentMethodValues === 'object') {
					paymentMethodValues = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, ...j.paymentMethodValues };
				} else if (j.paymentMethodValue && typeof j.paymentMethodValue === 'string') {
					paymentMethodValues = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, [j.paymentMethodValue]: true };
				}
				if (j.paymentMethodChecked && typeof j.paymentMethodChecked === 'object') {
					paymentMethodChecked = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, ...j.paymentMethodChecked };
				} else if (j.paymentMethodValue && typeof j.paymentMethodValue === 'string') {
					paymentMethodChecked = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, [j.paymentMethodValue]: true };
				}
				paymentMethodCustom = j.paymentMethodCustom || '';

				// Copy payment terms
				paymentTermsEnabled = j.paymentTermsEnabled ?? false;
				paymentTermsPreset = j.paymentTermsPreset || 'credit30';
				paymentTermsCustom = j.paymentTermsCustom || '';

				// Copy bank info
				showBankInfo = j.showBankInfo ?? false;

				// Copy line items
				if (sourceDoc.lines.length > 0) {
					lines = sourceDoc.lines.map(l => ({
						id: generateUuid(),
						productId: l.productId || '',
						code: l.code,
						name: l.name,
						description: l.description,
						details: (l as any).details || '',
						qty: l.qty,
						unit: l.unit,
						unitPrice: l.unitPrice,
						discountType: l.discountType || '',
						discountValue: l.discountValue || 0,
						taxRate: (l as any).taxRate || 'none'
					}));
				}

				// Copy lineColumnVisibility
				if (j.lineColumnVisibility) {
					lineColumnVisibility = { ...lineColumnVisibility, ...j.lineColumnVisibility };
					showItemDetails = lineColumnVisibility.description;
				}

				addToast(`สร้างจาก ${getDocTypeLabel(h.docType)} ${h.docNo} — ข้อมูลถูกคัดลอกมาแล้ว`, 'success');
				await refreshDocNo();
				ensureSandboxLockedLine();
				return;
			}
		}

		// Auto-fill from query params (e.g. from purchases page PO button)
		if (paramType && ['QUO','INV','BILL','TAX','RCPT','DO','PO','CN','PV','PR'].includes(paramType)) {
			docType = paramType as DocType;
		}
		// Auto-fill supplier info from purchases page
		const paramSupplierId = $page.url.searchParams.get('supplierId');
		const paramSupplierName = $page.url.searchParams.get('supplierName');
		const paramSupplierTaxId = $page.url.searchParams.get('supplierTaxId');
		const paramSupplierAddress = $page.url.searchParams.get('supplierAddress');
		const paramSupplierPhone = $page.url.searchParams.get('supplierPhone');
		if (paramSupplierId) customerId = paramSupplierId;
		if (paramSupplierName) customerName = paramSupplierName;
		if (paramSupplierTaxId) customerTaxId = paramSupplierTaxId;
		if (paramSupplierAddress) customerAddress = paramSupplierAddress;
		if (paramSupplierPhone) customerPhone = paramSupplierPhone;

		// Load PO lines from sessionStorage if available
		try {
			const poLinesJson = sessionStorage.getItem('po_lines');
			if (poLinesJson && docType === 'PO') {
				const poLines = JSON.parse(poLinesJson) as Array<{productId?: string; name: string; qty: number; unit: string; unitPrice: number}>;
				if (poLines.length > 0) {
					lines = poLines.map(pl => ({
						id: generateUuid(), productId: pl.productId || '', code: '',
						name: pl.name, description: '', details: '',
						qty: pl.qty, unit: pl.unit, unitPrice: pl.unitPrice,
						discountType: '', discountValue: 0, taxRate: 'none'
					}));
				}
				sessionStorage.removeItem('po_lines');
			}
		} catch {}

		await refreshDocNo();
		ensureSandboxLockedLine();
	});

	// Ensure locked product line exists in sandbox mode
	function ensureSandboxLockedLine() {
		if (!$isSandbox) return;
		const hasLocked = lines.some(l => l.productId === SANDBOX_LOCKED_PRODUCT_ID);
		if (hasLocked) return;
		const prod = products.find(p => p.entityId === SANDBOX_LOCKED_PRODUCT_ID);
		if (!prod) return;
		const lockedLine: LineItem = {
			id: generateUuid(),
			productId: SANDBOX_LOCKED_PRODUCT_ID,
			code: prod.code,
			name: prod.name,
			description: (prod.json?.description as string) || '',
			details: '',
			qty: 1,
			unit: (prod.json?.unit as string) || 'License',
			unitPrice: (prod.json?.price as number) || 790,
			discountType: '',
			discountValue: 0,
			taxRate: (prod.json?.taxRate as string) || 'none'
		};
		// Insert as first line; keep other non-empty lines
		const otherLines = lines.filter(l => l.name.trim());
		lines = [lockedLine, ...otherLines];
		if (lines.length === 1) lines = [lockedLine, createEmptyLine()];
	}

	// Load reference data — called from onMount and when company changes
	async function loadRefData() {
		const cid = get(currentCompanyId) || 'comp-001';
		const [c, p, s] = await Promise.all([
			api.listCustomers(cid),
			api.listProducts(cid),
			api.listSalespersons(cid)
		]);
		customers = c;
		products = p;
		salespersons = s;
	}

	// Re-load reference data when company changes
	let companyUnsub: (() => void) | undefined;
	$effect(() => {
		companyUnsub = currentCompanyId.subscribe((id) => {
			if (id) loadRefData();
		});
		return () => { companyUnsub?.(); };
	});

	onDestroy(() => {
		topbarActions.set([]);
		saveDraft();
		companyUnsub?.();
	});

	// ── Draft Persistence (Feature F) ──
	const DRAFT_KEY = 'doc-draft';

	function getDraftData() {
		return {
			currentStep, docType, docNo, docDate, dueDate, customerId, salespersonId,
			contactPerson, contactPersonMode, docLang, notes, terms,
			customerName, customerTaxId, customerAddress, customerPhone, customerEmail,
			customFields, showBankInfo, selectedBankIndexes,
			discountEnabled, discountType, discountValue,
			vatEnabled, vatRate, vatInclusive, whtEnabled, whtRate,
			signatureEnabled, signatureTitle, signatureName, signDate,
			signature2Enabled, signature2Title, signature2Name, signature2Date,
			signature3Enabled, signature3Title, signature3Name, signature3Date,
			customFeeEnabled, customFeeName, customFeeAmount, customFeeVatMode,
			paymentMethodEnabled, paymentMethodValues, paymentMethodChecked, paymentMethodCustom,
			paymentTermsEnabled, paymentTermsPreset, paymentTermsCustom,
			stampEnabled, stampSource, itemMode, lines,
			refDocId, refDocNo, returnToStock, lineColumnVisibility,
			_ts: Date.now()
		};
	}

	function saveDraft() {
		try {
			const hasContent = lines.some(l => l.name.trim()) || customerName.trim() || customerId;
			if (hasContent) {
				sessionStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
			}
		} catch {}
	}

	function restoreDraft(): boolean {
		try {
			const raw = sessionStorage.getItem(DRAFT_KEY);
			if (!raw) return false;
			const d = JSON.parse(raw);
			// Only restore if less than 4 hours old
			if (d._ts && Date.now() - d._ts > 4 * 60 * 60 * 1000) {
				sessionStorage.removeItem(DRAFT_KEY);
				return false;
			}
			currentStep = d.currentStep ?? 1;
			docType = d.docType ?? 'QUO';
			docNo = d.docNo ?? '';
			docDate = d.docDate ?? new Date().toISOString().substring(0, 10);
			dueDate = d.dueDate ?? '';
			customerId = d.customerId ?? '';
			salespersonId = d.salespersonId ?? '';
			contactPerson = d.contactPerson ?? '';
			contactPersonMode = d.contactPersonMode ?? 'select';
			docLang = d.docLang ?? 'th';
			notes = d.notes ?? '';
			terms = d.terms ?? '';
			customerName = d.customerName ?? '';
			customerTaxId = d.customerTaxId ?? '';
			customerAddress = d.customerAddress ?? '';
			customerPhone = d.customerPhone ?? '';
			customerEmail = d.customerEmail ?? '';
			customFields = d.customFields ?? [];
			showBankInfo = d.showBankInfo ?? false;
			selectedBankIndexes = d.selectedBankIndexes ?? [];
			discountEnabled = d.discountEnabled ?? false;
			discountType = d.discountType ?? 'PERCENT';
			discountValue = d.discountValue ?? 0;
			vatEnabled = d.vatEnabled ?? true;
			vatRate = d.vatRate ?? 7;
			vatInclusive = d.vatInclusive ?? false;
			whtEnabled = d.whtEnabled ?? false;
			whtRate = d.whtRate ?? 3;
			signatureEnabled = d.signatureEnabled ?? true;
			signatureTitle = d.signatureTitle ?? '';
			signatureName = d.signatureName ?? '';
			signDate = d.signDate ?? '';
			signature2Enabled = d.signature2Enabled ?? false;
			signature2Title = d.signature2Title ?? '';
			signature2Name = d.signature2Name ?? '';
			signature2Date = d.signature2Date ?? '';
			signature3Enabled = d.signature3Enabled ?? false;
			signature3Title = d.signature3Title ?? '';
			signature3Name = d.signature3Name ?? '';
			signature3Date = d.signature3Date ?? '';
			customFeeEnabled = d.customFeeEnabled ?? false;
			customFeeName = d.customFeeName ?? '';
			customFeeAmount = d.customFeeAmount ?? 0;
			customFeeVatMode = d.customFeeVatMode ?? 'NO_VAT';
			paymentMethodEnabled = d.paymentMethodEnabled ?? false;
			if (d.paymentMethodValues && typeof d.paymentMethodValues === 'object') {
				paymentMethodValues = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, ...d.paymentMethodValues };
			} else if (d.paymentMethodValue && typeof d.paymentMethodValue === 'string') {
				paymentMethodValues = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, [d.paymentMethodValue]: true };
			}
			if (d.paymentMethodChecked && typeof d.paymentMethodChecked === 'object') {
				paymentMethodChecked = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, ...d.paymentMethodChecked };
			} else if (d.paymentMethodValue && typeof d.paymentMethodValue === 'string') {
				paymentMethodChecked = { cash: false, transfer: false, cheque: false, credit_card: false, promptpay: false, credit_term: false, custom: false, [d.paymentMethodValue]: true };
			}
			paymentMethodCustom = d.paymentMethodCustom ?? '';
			paymentTermsEnabled = d.paymentTermsEnabled ?? false;
			paymentTermsPreset = d.paymentTermsPreset ?? 'cash';
			paymentTermsCustom = d.paymentTermsCustom ?? '';
			stampEnabled = d.stampEnabled ?? false;
			stampSource = d.stampSource ?? 'logo';
			itemMode = d.itemMode ?? 'product';
			refDocId = d.refDocId ?? '';
			refDocNo = d.refDocNo ?? '';
			returnToStock = d.returnToStock ?? false;
			if (d.lineColumnVisibility) {
				lineColumnVisibility = { ...lineColumnVisibility, ...d.lineColumnVisibility };
				showItemDetails = lineColumnVisibility.description;
			}
			if (d.lines?.length > 0) lines = d.lines.map((l: any) => ({ ...createEmptyLine(), ...l }));
			return true;
		} catch { return false; }
	}

	function clearDraft() {
		try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
	}

	// Auto-save draft periodically when form data changes
	let draftTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		// Touch reactive deps to trigger on changes
		void [currentStep, docType, customerId, customerName, notes, terms, lines.length,
			discountEnabled, vatEnabled, whtEnabled, customFeeEnabled, paymentTermsEnabled];
		if (draftTimer) clearTimeout(draftTimer);
		draftTimer = setTimeout(saveDraft, 1000);
	});

	// Warn before navigating away with unsaved changes
	beforeNavigate(({ cancel }) => {
		const hasContent = lines.some(l => l.name.trim()) || customerName.trim();
		if (hasContent) {
			saveDraft();
		}
	});

	function createEmptyLine(): LineItem {
		return { id: generateUuid(), productId: '', code: '', name: '', description: '', details: '', qty: 1, unit: '', unitPrice: 0, discountType: '', discountValue: 0, taxRate: 'none' };
	}

	async function refreshDocNo() {
		const companyId = $currentCompanyId || 'comp-001';
		const { items } = await api.queryDocs(companyId, { docType });
		const existingNos = new Set(items.map(d => d.docNo.toUpperCase()));
		let seq = 1;
		let candidate = generateDocNo(docType, seq);
		while (existingNos.has(candidate.toUpperCase())) { seq++; candidate = generateDocNo(docType, seq); }
		docNo = candidate;
	}

	// Filtered doc types based on income/expense category (exclude TAXRCPT — shown as checkbox)
	let filteredDocTypes = $derived(
		DOC_TYPES.filter(dt => {
			if (dt.id === 'TAXRCPT') return false;
			if (docCategory === 'income') {
				return dt.category === 'sales' || (dt.category === 'finance' && dt.id === 'CN');
			} else {
				return dt.category === 'purchase' || (dt.category === 'finance' && dt.id === 'PV');
			}
		})
	);

	function onDocCategoryChange(cat: 'income' | 'expense') {
		if (docCategory === cat) return;
		docCategory = cat;
		combinedTaxRcpt = false;
		// Reset to first doc type in new category
		const first = filteredDocTypes[0];
		if (first) docType = first.id as DocType;
		refreshDocNo();
	}

	function onCombinedTaxRcptChange(checked: boolean) {
		combinedTaxRcpt = checked;
		if (checked) {
			docType = 'TAXRCPT';
		} else {
			// Revert to the base type the checkbox was shown for
			docType = baseDocTypeForCheckbox;
		}
		refreshDocNo();
	}

	// Track which base doc type triggered the checkbox
	let baseDocTypeForCheckbox: DocType = $state('TAX');
	let showCombinedCheckbox = $derived((docType as string) === 'TAX' || (docType as string) === 'RCPT' || (docType as string) === 'TAXRCPT');

	async function onDocTypeChange() {
		// When user picks TAX or RCPT from dropdown, remember it for checkbox revert
		if (docType === 'TAX' || docType === 'RCPT') {
			baseDocTypeForCheckbox = docType;
			combinedTaxRcpt = false;
		} else {
			combinedTaxRcpt = false;
		}
		if (docType !== 'CN') returnToStock = false;
		await refreshDocNo();
	}

	let showProductPicker = $state(false);

	async function openProductPicker() {
		// Always reload products fresh when picker opens to guarantee data
		const cid = get(currentCompanyId) || 'comp-001';
		try {
			const freshProducts = await api.listProducts(cid);
			if (freshProducts.length > 0) {
				products = freshProducts;
			} else {
				// Fallback: try memory adapter directly (covers remote adapter with empty backend)
				await initApi();
				const fallback = await memoryAdapter.masterList<Product>('PRODUCT', { companyId: cid });
				if (fallback.ok && fallback.data.items.length > 0) {
					products = fallback.data.items;
				}
			}
		} catch (e) {
			console.error('[openProductPicker] Failed to load products:', e);
		}
		showProductPicker = true;
	}

	function addLine() {
		lines = [...lines, createEmptyLine()];
	}

	function handlePickerConfirm(items: PickedItem[]) {
		showProductPicker = false;
		if (!items.length) return;
		// Remove empty lines first
		const nonEmpty = lines.filter(l => l.name.trim());
		const newLines = items.map(item => {
			const prod = products.find(p => p.entityId === item.productId);
			return {
				...createEmptyLine(),
				productId: item.productId,
				code: item.code,
				name: item.name,
				description: item.description,
				unit: item.unit,
				unitPrice: item.unitPrice,
				qty: item.qty,
				taxRate: (prod?.json?.taxRate as string) || 'none',
			};
		});
		lines = nonEmpty.length > 0 ? [...nonEmpty, ...newLines] : newLines;
	}

	function removeLine(id: string) {
		if (lines.length <= 1) return;
		if ($isSandbox) {
			const line = lines.find(l => l.id === id);
			if (line && line.productId === SANDBOX_LOCKED_PRODUCT_ID) {
				showSandboxUpgrade = true;
				return;
			}
		}
		lines = lines.filter(l => l.id !== id);
	}

	function onProductSelect(lineId: string, productId: string) {
		if ($isSandbox) {
			const existing = lines.find(l => l.id === lineId);
			if (existing && existing.productId === SANDBOX_LOCKED_PRODUCT_ID) {
				showSandboxUpgrade = true;
				return;
			}
		}
		const prod = products.find(p => p.entityId === productId);
		if (!prod) return;
		lines = lines.map(l => l.id === lineId ? {
			...l, productId, code: prod.code, name: prod.name,
			description: prod.json.description as string || l.description,
			details: prod.json.serviceDesc as string || '',
			unit: (prod.json.unit as string) || '', unitPrice: (prod.json.price as number) || 0,
			taxRate: (prod.json.taxRate as string) || 'none'
		} : l);
	}

	async function saveDocument() {
		if (!customerId && !customerName.trim()) { addToast('กรุณาเลือกลูกค้าหรือกรอกชื่อ', 'error'); return; }
		if (lines.every(l => !l.name.trim())) { addToast('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ', 'error'); return; }

		// Tax invoice validation: TAX and TAXRCPT require tax IDs
		if (docType === 'TAX' || docType === 'TAXRCPT') {
			const companyTaxId = ($currentCompany?.json as Record<string, any>)?.taxId || '';
			if (!companyTaxId || companyTaxId.replace(/\D/g, '').length !== 13) {
				addToast('ใบกำกับภาษี: กรุณากรอกเลขผู้เสียภาษี 13 หลักของบริษัท (ตั้งค่าที่หน้า บริษัทของฉัน)', 'error'); return;
			}
			if (!customerTaxId || customerTaxId.replace(/\D/g, '').length !== 13) {
				addToast('ใบกำกับภาษี: กรุณากรอกเลขผู้เสียภาษี 13 หลักของลูกค้า', 'error'); return;
			}
			if (!customerAddress.trim()) {
				addToast('ใบกำกับภาษี: กรุณากรอกที่อยู่ลูกค้า', 'error'); return;
			}
		}

		const companyId = $currentCompanyId || 'comp-001';
		const headerData = {
			...(editingDocId ? { docId: editingDocId } : {}),
			docType, companyId,
			customerId, docNo, docDate, dueDate, refDocNo, currency: 'THB',
			subtotal: calcResult.subtotal, discountEnabled, discountType, discountValue: discountValue,
			vatEnabled, vatRate, whtEnabled, whtRate,
			totalBeforeTax: calcResult.totalBeforeTax, vatAmount: calcResult.vatAmount, whtAmount: calcResult.whtAmount, grandTotal: calcResult.grandTotal,
			paymentStatus: 'UNPAID' as const, docStatus: 'DRAFT' as const, notes, terms, signatureEnabled,
			json: {
				customerName: customerName || selectedCustomer?.name || '',
				customerTaxId, customerAddress, customerPhone, customerEmail,
				customerOfficeType, customerBranchName: customerOfficeType === 'branch' ? customerBranchName : '', customerBranchNo: customerOfficeType === 'branch' ? customerBranchNo : '',
				salespersonId, salespersonName: selectedSalesperson?.name || '',
				contactPerson, docLang, signatureTitle, signatureName, signDate,
				signature2Enabled, signature2Title, signature2Name, signature2Date,
				signature3Enabled, signature3Title, signature3Name, signature3Date,
				vatInclusive, customFeeEnabled, customFeeName, customFeeAmount, customFeeVatMode,
				paymentMethodEnabled, paymentMethodValues, paymentMethodChecked, paymentMethodCustom,
				paymentTermsEnabled, paymentTermsPreset, paymentTermsCustom,
				showBankInfo,
				selectedBankAccounts: showBankInfo ? selectedBankIndexes.map(i => companyBankAccounts[i]).filter(Boolean) : [],
				customFields: customFields.filter(cf => cf.label.trim() && cf.value.trim()),
				refDocId: refDocId || undefined,
				returnToStock: docType === 'CN' ? returnToStock : undefined,
				lineColumnVisibility,
				companyOverride: compOverrideOpen ? {
					name: compOverrideName, address: compOverrideAddress, phone: compOverridePhone, email: compOverrideEmail, taxId: compOverrideTaxId,
					officeType: compOverrideOfficeType,
					branchName: compOverrideOfficeType === 'branch' ? compOverrideBranchName : '',
					branchNo: compOverrideOfficeType === 'branch' ? compOverrideBranchNo : ''
				} : undefined
			}
		};

		const docLines = lines.filter(l => l.name.trim()).map((l, i) => ({
			productId: l.productId, code: l.code, name: l.name, description: l.description,
			qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, discountType: l.discountType, discountValue: l.discountValue,
			taxRate: l.taxRate || 'none',
			lineTotal: calcResult.lineTotals[lines.indexOf(l)] || 0
		}));

		const result = await api.upsertDoc(headerData, docLines);
		if (!result.ok) { addToast('เกิดข้อผิดพลาด: ' + result.error.message, 'error'); return; }

		// Auto deduct stock for Delivery Order (DO)
		if (docType === 'DO' && !editingDocId) {
			const companyId = $currentCompanyId || 'comp-001';
			for (const line of docLines) {
				if (!line.productId) continue;
				const prod = products.find(p => p.entityId === line.productId);
				if (!prod || !prod.json?.stockEnabled) continue;
				const currentQty = prod.json?.stockQty || 0;
				const currentLogs = (prod.json?.stockLogs as import('$lib/types').StockLog[]) || [];
				const newLog: import('$lib/types').StockLog = {
					date: docDate, qty: line.qty, type: 'OUT',
					reason: `ส่งของ ${docNo}`, refDocNo: docNo
				};
				await api.upsertProduct({
					...prod, companyId,
					json: { ...prod.json, stockQty: Math.max(0, currentQty - line.qty), stockLogs: [...currentLogs, newLog] }
				});
			}
			products = await api.listProducts(companyId);
		}

		// Update source document status to CONVERTED when creating follow-up
		if (refDocId && !editingDocId) {
			try {
				await api.updateDocStatus(refDocId, 'CONVERTED');
			} catch {}
		}

		clearDraft();
		const savedDocId = editingDocId || result.data.header.docId;

		// Smart toast: stock-related doc types → action button to stock page (non-blocking)
		const STOCK_OUT_DOC_TYPES = ['INV', 'TAX', 'TAXRCPT', 'RCPT'];
		const STOCK_IN_DOC_TYPES = ['PO'];
		const hasStockOutItems = !editingDocId && STOCK_OUT_DOC_TYPES.includes(docType) && docLines.some(l => {
			const prod = products.find(p => p.entityId === l.productId);
			return prod?.json?.stockEnabled;
		});
		const hasStockInItems = !editingDocId && STOCK_IN_DOC_TYPES.includes(docType) && docLines.some(l => {
			const prod = products.find(p => p.entityId === l.productId);
			return prod?.json?.stockEnabled;
		});
		const hasCnReturnItems = !editingDocId && docType === 'CN' && returnToStock && docLines.some(l => {
			const prod = products.find(p => p.entityId === l.productId);
			return prod?.json?.stockEnabled;
		});

		if (hasStockOutItems) {
			addToast(`บันทึก ${getDocTypeLabel(docType)} ${docNo} เรียบร้อย`, 'success', 5000, { label: 'ไปตัดสต็อก', href: '/stock?tab=pending' });
		} else if (hasStockInItems) {
			addToast(`บันทึก ${getDocTypeLabel(docType)} ${docNo} เรียบร้อย`, 'success', 5000, { label: 'ไปรับสินค้าเข้าคลัง', href: '/stock?tab=pending' });
		} else if (hasCnReturnItems) {
			addToast(`บันทึก ${getDocTypeLabel(docType)} ${docNo} เรียบร้อย`, 'success', 5000, { label: 'ไปรับคืนเข้าคลัง', href: '/stock?tab=pending' });
		} else {
			addToast(`บันทึก ${getDocTypeLabel(docType)} ${docNo} เรียบร้อย`, 'success');
		}

		goto(`/documents/${savedDocId}`);
	}

	function getLineTotal(index: number): number {
		return calcResult.lineTotals[index] || 0;
	}

	// Drive gate: check if user has connected Google Drive before allowing image upload
	function requireDriveForUpload(): boolean {
		const u = get(currentUser);
		if (u && !u.driveFolderId) {
			showDriveConnectModal.set(true);
			return false;
		}
		return true;
	}

	// Signature image upload
	// svelte-ignore non_reactive_update
	let signInputEl: HTMLInputElement;
	function handleSignUpload(e: Event) {
		if (!requireDriveForUpload()) { (e.target as HTMLInputElement).value = ''; return; }
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { addToast('ไฟล์ใหญ่เกิน 2MB', 'error'); return; }
		const reader = new FileReader();
		reader.onload = (ev) => { signatureImage = ev.target?.result as string; };
		reader.readAsDataURL(file);
	}

	// svelte-ignore non_reactive_update
	let sign2InputEl: HTMLInputElement;
	function handleSign2Upload(e: Event) {
		if (!requireDriveForUpload()) { (e.target as HTMLInputElement).value = ''; return; }
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { addToast('ไฟล์ใหญ่เกิน 2MB', 'error'); return; }
		const reader = new FileReader();
		reader.onload = (ev) => { signature2Image = ev.target?.result as string; };
		reader.readAsDataURL(file);
	}

	// svelte-ignore non_reactive_update
	let sign3InputEl: HTMLInputElement;
	function handleSign3Upload(e: Event) {
		if (!requireDriveForUpload()) { (e.target as HTMLInputElement).value = ''; return; }
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { addToast('ไฟล์ใหญ่เกิน 2MB', 'error'); return; }
		const reader = new FileReader();
		reader.onload = (ev) => { signature3Image = ev.target?.result as string; };
		reader.readAsDataURL(file);
	}

	// Stamp image upload — converts to grayscale (matches GAS)
	// svelte-ignore non_reactive_update
	let stampInputEl: HTMLInputElement;
	function convertToGrayscale(imgSrc: string): Promise<string> {
		return new Promise((resolve) => {
			if (!imgSrc) { resolve(imgSrc); return; }
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				try {
					const canvas = document.createElement('canvas');
					canvas.width = img.naturalWidth || img.width;
					canvas.height = img.naturalHeight || img.height;
					const ctx = canvas.getContext('2d')!;
					ctx.filter = 'grayscale(100%)';
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
					resolve(canvas.toDataURL('image/png'));
				} catch {
					resolve(imgSrc);
				}
			};
			img.onerror = () => resolve(imgSrc);
			img.src = imgSrc;
		});
	}

	function handleStampUpload(e: Event) {
		if (!requireDriveForUpload()) { (e.target as HTMLInputElement).value = ''; return; }
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { addToast('ไฟล์ใหญ่เกิน 2MB', 'error'); return; }
		const reader = new FileReader();
		reader.onload = async (ev) => {
			const src = ev.target?.result as string;
			stampImage = await convertToGrayscale(src);
		};
		reader.readAsDataURL(file);
	}

	// Build overlay items reactively (stamp only — signature is static in DocPreview)
	let overlayItems: OverlayItem[] = $derived.by(() => {
		const items: OverlayItem[] = [];
		const sandboxMode = $isSandbox;
		const isStampOn = sandboxMode ? true : stampEnabled;
		const resolvedStampImage = sandboxMode
			? SANDBOX_LOGO_URL
			: (stampEnabled ? (stampSource === 'custom' ? stampImage : ($currentCompany?.json?.logo as string || '')) : '');
		if (isStampOn && resolvedStampImage) {
			items.push({
				id: 'stamp',
				src: resolvedStampImage,
				x: stampTransform.x,
				y: stampTransform.y,
				width: stampTransform.width,
				height: stampTransform.height,
				rotation: stampTransform.rotation,
				opacity: 0.15,
				grayscale: true
			});
		}
		return items;
	});

	function handleOverlayChange(newItems: OverlayItem[]) {
		for (const item of newItems) {
			if (item.id === 'stamp') {
				stampTransform = { x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation };
			}
		}
	}
</script>

<!-- Step Indicator -->
<div class="step-indicator" data-tour="step-indicator">
	{#each STEPS as step}
		<button
			class="step-item"
			class:active={currentStep === step.num}
			class:completed={currentStep > step.num}
			onclick={() => { if (step.num <= currentStep) currentStep = step.num; }}
			type="button"
		>
			<div class="step-circle">
				{#if currentStep > step.num}
					<span>✓</span>
				{:else}
					{@const Icon = step.icon}
					<Icon size={16} />
				{/if}
			</div>
			<span class="step-label">{step.label}</span>
		</button>
		{#if step.num < 3}
			<div class="step-line" class:active={currentStep > step.num}></div>
		{/if}
	{/each}
</div>

<div class="doc-form-wrapper">
	<!-- Left: Form -->
	<div class="doc-form-left">

		<!-- ===== STEP 1: ส่วนหัว ===== -->
		{#if currentStep === 1}
		<!-- Card 1: ออกเอกสารในนาม -->
		<div class="card" style="margin-bottom: 16px;">
			<div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
				<span style="font-weight: 600; font-size: 14px; white-space: nowrap;">ออกเอกสารในนาม</span>
				<select class="field-control" style="min-width: 250px; font-weight: 500; flex: 1;" bind:value={$companyIdStore}>
					{#each $companiesStore as comp}
						<option value={comp.entityId}>{comp.name}</option>
					{/each}
				</select>
			</div>
			{#if !config.showVendor && salespersons.length > 0}
				<div style="margin-top: 10px;">
					<label class="field-label" style="font-size: 12px;">พนักงานขาย</label>
					<select class="field-control" bind:value={salespersonId}>
						<option value="">-- ไม่ระบุ --</option>
						{#each salespersons as sp}
							<option value={sp.entityId}>{sp.name}</option>
						{/each}
					</select>
				</div>
			{/if}
			<!-- Collapsible company info override -->
			<div style="margin-top: 10px; border-top: 1px solid var(--color-gray-100); padding-top: 8px;">
				<button type="button" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-gray-500); padding: 0;" onclick={() => { if (!compOverrideOpen && !compOverrideName) fillCompanyOverrideFromCurrent(); compOverrideOpen = !compOverrideOpen; }}>
					<ChevronDown size={14} style="transform: rotate({compOverrideOpen ? '0' : '-90'}deg); transition: transform 0.2s;" />
					แก้ไขข้อมูลบริษัทสำหรับเอกสารนี้
				</button>
				{#if compOverrideOpen}
					<div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
						<div><label class="field-label" style="font-size: 11px;">ชื่อบริษัท</label><input class="field-control" bind:value={compOverrideName} /></div>
						<div><label class="field-label" style="font-size: 11px;">ที่อยู่</label><textarea class="field-control" bind:value={compOverrideAddress} rows="2"></textarea></div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
							<div><label class="field-label" style="font-size: 11px;">โทรศัพท์</label><input class="field-control" bind:value={compOverridePhone} /></div>
							<div><label class="field-label" style="font-size: 11px;">อีเมล</label><input class="field-control" bind:value={compOverrideEmail} /></div>
						</div>
						<div><label class="field-label" style="font-size: 11px;">เลขผู้เสียภาษี</label><input class="field-control" bind:value={compOverrideTaxId} /></div>
						<!-- Office type -->
						<div>
							<label class="field-label" style="font-size: 11px;">ประเภทสำนักงาน</label>
							<div style="display: flex; align-items: center; gap: 14px; margin-top: 4px;">
								<label style="display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
									<input type="radio" name="compOvOffice" value="none" checked={compOverrideOfficeType === 'none'} onchange={() => { compOverrideOfficeType = 'none'; compOverrideBranchName = ''; compOverrideBranchNo = ''; }} />
									ไม่ระบุ
								</label>
								<label style="display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
									<input type="radio" name="compOvOffice" value="hq" checked={compOverrideOfficeType === 'hq'} onchange={() => { compOverrideOfficeType = 'hq'; compOverrideBranchName = ''; compOverrideBranchNo = ''; }} />
									สำนักงานใหญ่
								</label>
								<label style="display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
									<input type="radio" name="compOvOffice" value="branch" checked={compOverrideOfficeType === 'branch'} onchange={() => { compOverrideOfficeType = 'branch'; compOverrideBranchName = ''; compOverrideBranchNo = ''; }} />
									สาขา
								</label>
							</div>
							{#if compOverrideOfficeType === 'branch'}
								<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-top: 6px;">
									<div><label class="field-label" style="font-size: 10px;">ชื่อสาขา</label><input class="field-control" bind:value={compOverrideBranchName} /></div>
									<div><label class="field-label" style="font-size: 10px;">รหัสสาขา</label><input class="field-control" bind:value={compOverrideBranchNo} /></div>
								</div>
							{/if}
						</div>
						<div style="font-size: 10px; color: var(--color-gray-400);">* แก้ไขข้อมูลเฉพาะในเอกสารนี้ ไม่กระทบข้อมูลบริษัทหลัก</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Ref doc banner (when creating follow-up) -->
		{#if refDocId && refDocNo}
			<div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: 16px; border-radius: 8px; background: color-mix(in srgb, var(--color-primary) 6%, white); border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent); font-size: 13px;">
				<Link2 size={14} style="color: var(--color-primary);" />
				<span style="color: var(--color-gray-600);">สร้างจากเอกสาร:</span>
				<a href="/documents/{refDocId}" style="font-weight: 600; color: var(--color-primary); text-decoration: none;">{refDocNo}</a>
			</div>
		{/if}

		<!-- Card 2: ข้อมูลเอกสาร -->
		<div class="card" style="margin-bottom: 16px;" data-tour="doc-info-card">
			<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
				<h3 style="font-size: 14px; font-weight: 700; margin: 0;">ข้อมูลเอกสาร</h3>
				<div class="doc-cat-toggle">
					<button class="doc-cat-btn" class:active={docCategory === 'income'} onclick={() => onDocCategoryChange('income')}>
						<ArrowDownCircle size={14} /> รายรับ
					</button>
					<button class="doc-cat-btn doc-cat-expense" class:active={docCategory === 'expense'} onclick={() => onDocCategoryChange('expense')}>
						<ArrowUpCircle size={14} /> รายจ่าย
					</button>
				</div>
			</div>
			<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
				<div>
					<label class="field-label">ประเภทเอกสาร</label>
					{#if combinedTaxRcpt}
						<div class="field-control" style="background: var(--color-gray-50); color: var(--color-gray-700); display: flex; align-items: center;">ใบเสร็จรับเงิน/ใบกำกับภาษี</div>
					{:else}
						<select class="field-control" bind:value={docType} onchange={onDocTypeChange}>
							{#each filteredDocTypes as dt}
								<option value={dt.id}>{dt.labelTh}</option>
							{/each}
						</select>
					{/if}
					{#if showCombinedCheckbox}
						<label class="combined-checkbox" style="margin-top: 6px;">
							<input type="checkbox" checked={combinedTaxRcpt} onchange={(e) => onCombinedTaxRcptChange((e.target as HTMLInputElement).checked)} />
							<span>{docType === 'RCPT' || (docType === 'TAXRCPT' && baseDocTypeForCheckbox === 'RCPT') ? 'ออกพร้อมใบกำกับภาษี' : 'ออกพร้อมใบเสร็จรับเงิน'}</span>
						</label>
						<div class="combined-hint">ใบเสร็จรับเงิน/ใบกำกับภาษี · ตามข้อกำหนดกรมสรรพากร</div>
					{/if}
					{#if docType === 'CN'}
						<label class="combined-checkbox" style="margin-top: 6px;">
							<input type="checkbox" bind:checked={returnToStock} />
							<span>รับสินค้าคืนเข้าคลัง (Return to stock)</span>
						</label>
						<div class="combined-hint">ติ๊กเลือกถ้าลูกค้าคืนสินค้าจริง — จะแสดงในหน้าคลังสินค้าเพื่อยืนยันรับเข้า</div>
					{/if}
				</div>
				<div>
					<label class="field-label">เลขที่เอกสาร</label>
					<input class="field-control" bind:value={docNo} />
				</div>
				<div>
					<label class="field-label">วันที่เอกสาร</label>
					<input class="field-control" type="date" bind:value={docDate} />
				</div>
				{#if config.showDueDate || config.showValidUntil}
					<div>
						<label class="field-label">{config.showValidUntil ? 'ใช้ได้ถึง' : 'วันครบกำหนด'}</label>
						<input class="field-control" type="date" bind:value={dueDate} />
					</div>
				{/if}
				<div>
					<label class="field-label">ภาษาเอกสาร</label>
					<select class="field-control" style="width: 120px;" bind:value={docLang}>
						<option value="th">ไทย</option>
						<option value="en">English</option>
					</select>
				</div>
			</div>
		</div>

		<!-- Card 3: ข้อมูลลูกค้า -->
		<div class="card" style="margin-bottom: 16px;" data-tour="customer-card">
			<h3 style="font-size: 14px; font-weight: 700; margin: 0 0 14px 0;">{config.showVendor ? 'ข้อมูลผู้ขาย' : 'ข้อมูลลูกค้า'}</h3>
			<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
				<div>
					<label class="field-label">{config.showVendor ? 'เลือกผู้ขาย' : 'เลือกลูกค้า'}</label>
					<select class="field-control" bind:value={customerId} onchange={(e) => { if (!(e.target as HTMLSelectElement).value) { customerName = ''; customerTaxId = ''; customerAddress = ''; customerPhone = ''; customerEmail = ''; customFields = []; contactPerson = ''; contactPersonMode = 'select'; } }}>
						<option value="">-- เลือก{config.showVendor ? 'ผู้ขาย' : 'ลูกค้า'} --</option>
						{#each customers as c}
							<option value={c.entityId}>{c.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="field-label">{config.showVendor ? 'ชื่อผู้ขาย' : 'ชื่อลูกค้า'}</label>
					<input class="field-control" bind:value={customerName} placeholder="ชื่อ" />
				</div>
				<div>
					<label class="field-label">เลขประจำตัวผู้เสียภาษี</label>
					<input class="field-control" bind:value={customerTaxId} placeholder="เลข 13 หลัก" />
				</div>
				<div style="grid-column: 1 / -1;">
					<label class="field-label">ที่อยู่</label>
					<textarea class="field-control" bind:value={customerAddress} rows="2" placeholder="ที่อยู่สำหรับออกเอกสาร"></textarea>
				</div>
				<div>
					<label class="field-label">โทรศัพท์</label>
					<input class="field-control" bind:value={customerPhone} placeholder="เบอร์โทร" />
				</div>
				<div>
					<label class="field-label">อีเมล</label>
					<input class="field-control" bind:value={customerEmail} placeholder="อีเมล" type="email" />
				</div>
				<div>
					<label class="field-label">ผู้ติดต่อ</label>
					<select class="field-control" value={contactPersonMode === 'custom' ? '__custom__' : contactPerson} onchange={(e) => {
						const v = (e.target as HTMLSelectElement).value;
						if (v === '__custom__') { contactPersonMode = 'custom'; contactPerson = ''; }
						else { contactPersonMode = 'select'; contactPerson = v; }
					}}>
						<option value="">-- เลือกผู้ติดต่อ --</option>
						{#each customerContactPersons as cp}
							<option value={cp.name}>{cp.name}{cp.position ? ` (${cp.position})` : ''}</option>
						{/each}
						<option value="__custom__">กำหนดเอง...</option>
					</select>
					{#if contactPersonMode === 'custom'}
						<input class="field-control" style="margin-top: 6px;" bind:value={contactPerson} placeholder="พิมพ์ชื่อผู้ติดต่อ" />
					{/if}
				</div>
			</div>
			<!-- Office Type -->
			<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--color-gray-100);">
				<label class="field-label" style="font-size: 12px;">ประเภทสำนักงาน</label>
				<div style="display: flex; align-items: center; gap: 14px; margin-top: 4px;">
					<label style="display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
						<input type="radio" name="custDocOffice" value="none" checked={customerOfficeType === 'none'} onchange={() => { customerOfficeType = 'none'; customerBranchName = ''; customerBranchNo = ''; }} />
						ไม่ระบุ
					</label>
					<label style="display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
						<input type="radio" name="custDocOffice" value="hq" checked={customerOfficeType === 'hq'} onchange={() => { customerOfficeType = 'hq'; customerBranchName = ''; customerBranchNo = ''; }} />
						สำนักงานใหญ่
					</label>
					<label style="display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
						<input type="radio" name="custDocOffice" value="branch" checked={customerOfficeType === 'branch'} onchange={() => { customerOfficeType = 'branch'; }} />
						สาขา
					</label>
				</div>
				{#if customerOfficeType === 'branch'}
					<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-top: 6px;">
						<div><label class="field-label" style="font-size: 11px;">ชื่อสาขา</label><input class="field-control" bind:value={customerBranchName} placeholder="เช่น สาขาลาดพร้าว" /></div>
						<div><label class="field-label" style="font-size: 11px;">รหัสสาขา</label><input class="field-control" bind:value={customerBranchNo} placeholder="00001" /></div>
					</div>
				{/if}
			</div>
			<!-- Custom Fields -->
			{#if customFields.length > 0}
				<div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--color-gray-200);">
					<div style="font-size: 12px; font-weight: 600; color: var(--color-gray-500); margin-bottom: 8px;">ข้อมูลเพิ่มเติม</div>
					<div style="display: flex; flex-wrap: wrap; gap: 8px;">
						{#each customFields as cf, i}
							<div style="display: flex; align-items: center; gap: 4px; background: var(--color-gray-50); border: 1px solid var(--color-gray-200); border-radius: 8px; padding: 4px 8px;">
								<input class="field-control" style="width: 80px; padding: 4px 6px; font-size: 12px; border: none; background: transparent; font-weight: 600;" bind:value={cf.label} placeholder="ชื่อ" />
								<span style="color: var(--color-gray-400);">:</span>
								<input class="field-control" style="width: 100px; padding: 4px 6px; font-size: 12px; border: none; background: transparent;" bind:value={cf.value} placeholder="ค่า" />
								<button class="btn btn-sm btn-icon" style="padding: 2px; background: none; border: none; color: var(--color-gray-400);" onclick={() => { customFields = customFields.filter((_, idx) => idx !== i); }} type="button">
									<X size={12} />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
		{/if}

		<!-- ===== STEP 2: รายการ+สรุป ===== -->
		{#if currentStep === 2}

		{#if docType === 'BILL'}
		<!-- Billing Note: Invoice Selector -->
		<div class="card" style="margin-bottom: 16px; padding: 12px;">
			<h3 style="font-size: 14px; font-weight: 700; margin: 0 0 12px 0;">{config.itemsTitleTh || 'รายการใบแจ้งหนี้'}</h3>
			{#if !customerId}
				<div style="text-align: center; padding: 24px; color: var(--color-gray-400); font-size: 13px; border: 1px dashed var(--color-gray-200); border-radius: 8px;">
					กรุณาเลือกลูกค้าในขั้นตอนที่ 1 ก่อน
				</div>
			{:else if loadingInvoices}
				<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px;"><div class="loading-spinner"></div><div style="color: var(--color-gray-400); font-size: 12px;">กำลังโหลดใบแจ้งหนี้...</div></div>
			{:else if billingInvoices.length === 0}
				<div style="text-align: center; padding: 24px; color: var(--color-gray-400); font-size: 13px; border: 1px dashed var(--color-gray-200); border-radius: 8px;">
					ไม่พบใบแจ้งหนี้ที่ค้างชำระสำหรับลูกค้านี้
				</div>
			{:else}
				<div style="display: flex; flex-direction: column; gap: 8px;">
					{#each billingInvoices as inv}
						<label style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--color-gray-200); border-radius: 8px; cursor: pointer; transition: all 0.15s; font-size: 13px;"
							class:selected-bank={selectedInvoiceIds.has(inv.docId)}>
							<input type="checkbox" checked={selectedInvoiceIds.has(inv.docId)} onchange={() => toggleInvoiceSelection(inv.docId)} />
							<div style="flex: 1; min-width: 0;">
								<div style="font-weight: 600;">{inv.docNo}</div>
								<div style="font-size: 12px; color: var(--color-gray-500);">วันที่: {inv.docDate} {inv.dueDate ? `· ครบกำหนด: ${inv.dueDate}` : ''}</div>
							</div>
							<div style="font-weight: 700; color: var(--color-primary); white-space: nowrap;">
								{formatMoney(inv.grandTotal)}
							</div>
						</label>
					{/each}
				</div>
				{#if selectedInvoiceIds.size > 0}
					<div style="margin-top: 12px; padding: 10px 14px; background: var(--color-primary-soft); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
						<span>เลือก {selectedInvoiceIds.size} ใบแจ้งหนี้</span>
						<span style="font-weight: 700; font-size: 15px; color: var(--color-primary);">{formatMoney(billingInvoices.filter(i => selectedInvoiceIds.has(i.docId)).reduce((s, i) => s + i.grandTotal, 0))}</span>
					</div>
				{/if}
			{/if}
		</div>
		{:else}
		<!-- Normal Line Items -->
		<div class="card" style="margin-bottom: 16px; padding: 12px;" data-tour="line-items">
			<div style="margin-bottom: 12px;">
			<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
				<div style="display: flex; align-items: center; gap: 8px;">
					<h3 style="font-size: 14px; font-weight: 700; margin: 0;">{config.itemsTitleTh || 'รายการสินค้า/บริการ'}</h3>
					<button class="btn btn-sm btn-icon" style="padding: 3px; background: none; border: 1px solid var(--color-gray-200); border-radius: 6px; color: var(--color-gray-500); cursor: pointer;" title="ตั้งค่าคอลัมน์" onclick={() => showColumnSettings = !showColumnSettings}>
						<Settings2 size={14} />
					</button>
				</div>
				<div style="display: flex; align-items: center; gap: 6px;">
					<span style="font-size: 12px; color: var(--color-gray-500);">ประเภท:</span>
					<select class="field-control" style="width: auto; min-width: 80px; padding: 4px 8px; font-size: 12px;" bind:value={itemMode}>
						<option value="product">สินค้า</option>
						<option value="service">บริการ</option>
					</select>
				</div>
			</div>
			{#if showColumnSettings}
				<div class="col-settings-card">
					<div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--color-gray-700);">คอลัมน์ที่แสดง</div>
					<div style="display: flex; flex-wrap: wrap; gap: 6px 16px;">
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.rowNum} /> #</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.code} /> รหัส</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item" style="opacity: 0.5; pointer-events: none;"><input type="checkbox" checked disabled /> รายการ</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.description} onchange={() => { showItemDetails = lineColumnVisibility.description; }} /> รายละเอียด</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.qty} /> จำนวน</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.unit} /> หน่วย</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.unitPrice} /> ราคา/หน่วย</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.discount} /> ส่วนลด</label>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={lineColumnVisibility.tax} /> ภาษี</label>
					</div>
				</div>
			{/if}
			<div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
				<button class="btn btn-sm btn-outline" onclick={openProductPicker}><ShoppingCart size={14} /> เลือกสินค้า</button>
				<button class="btn btn-sm btn-outline" onclick={addLine}><Plus size={14} /> เพิ่มรายการ</button>
			</div>
		</div>

			<div class="line-items-scroll">
				{#each lines as line, i (line.id)}
					{@const isLockedLine = $isSandbox && line.productId === SANDBOX_LOCKED_PRODUCT_ID}
					<div class="line-item-row" style="{isLockedLine ? 'opacity: 0.85; background: var(--color-gray-50); border-radius: 8px; border: 1px solid var(--color-gray-200);' : ''}">
						<div style="min-width: 200px; flex: 2;">
							<label class="field-label" style="font-size: 10px;">สินค้า/บริการ {#if isLockedLine}<span style="display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; background: var(--color-gray-100); color: var(--color-gray-500); border: 1px solid var(--color-gray-200); vertical-align: middle;"><Lock size={8} /> ล็อก</span>{/if}</label>
							<select class="field-control" style="font-size: 12px; padding: 6px 8px;" value={line.productId} onchange={(e) => onProductSelect(line.id, (e.target as HTMLSelectElement).value)} disabled={isLockedLine}>
								<option value="">พิมพ์เอง</option>
								{#each products as p}<option value={p.entityId}>{p.name}{p.json.stockEnabled ? ` [คงเหลือ ${p.json.stockQty ?? 0}]` : ''}</option>{/each}
							</select>
							<input class="field-control" style="font-size: 12px; padding: 6px 8px; margin-top: 4px;" bind:value={line.name} placeholder="ชื่อรายการ (แก้ไขได้)" disabled={isLockedLine} />
							{#if showItemDetails}
								<textarea class="field-control" style="font-size: 11px; padding: 6px 8px; margin-top: 4px; min-height: 40px;" bind:value={line.description} placeholder="รายละเอียดเพิ่มเติม (แต่ละบรรทัดจะแสดงเป็นรายการย่อย)" rows="2" disabled={isLockedLine}></textarea>
							{/if}
						</div>
						{#if lineColumnVisibility.unit}
						<div style="min-width: 60px; width: 60px;">
							<label class="field-label" style="font-size: 10px;">หน่วย</label>
							<input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={line.unit} disabled={isLockedLine} />
						</div>
						{/if}
						{#if lineColumnVisibility.qty}
						<div style="min-width: 55px; width: 55px;">
							<label class="field-label" style="font-size: 10px;">จำนวน</label>
							<input class="field-control" style="font-size: 12px; padding: 6px 8px; text-align: right;" type="number" bind:value={line.qty} min="1" disabled={isLockedLine} />
							{#if line.productId && products.find(p => p.entityId === line.productId)?.json.stockEnabled && line.qty > ((products.find(p => p.entityId === line.productId)?.json.stockQty as number) || 0)}
								<div style="font-size: 9px; color: var(--color-danger); margin-top: 2px;">เกินสต๊อก!</div>
							{/if}
						</div>
						{/if}
						{#if lineColumnVisibility.unitPrice}
						<div style="min-width: 100px; width: 100px;">
							<label class="field-label" style="font-size: 10px;">ราคา/หน่วย</label>
							<input class="field-control" style="font-size: 12px; padding: 6px 8px; text-align: right;" type="number" bind:value={line.unitPrice} disabled={isLockedLine} />
						</div>
						{/if}
						{#if lineColumnVisibility.discount}
						<div style="min-width: 120px; width: 120px;">
							<label class="field-label" style="font-size: 10px;">ส่วนลด</label>
							<div class="discount-group">
								<input class="discount-input" type="number" bind:value={line.discountValue} min="0" placeholder="0" disabled={isLockedLine} oninput={() => { if (line.discountValue > 0 && !line.discountType) line.discountType = 'AMOUNT'; }} />
								<button class="discount-toggle" type="button" onclick={() => { line.discountType = line.discountType === 'PERCENT' ? 'AMOUNT' : line.discountType === 'AMOUNT' ? '' : 'PERCENT'; }} disabled={isLockedLine}>
									{line.discountType === 'PERCENT' ? '%' : line.discountType === 'AMOUNT' ? '฿' : '-'}
								</button>
							</div>
						</div>
						{/if}
						{#if lineColumnVisibility.tax}
						<div style="min-width: 90px; width: 90px;">
							<label class="field-label" style="font-size: 10px;">ภาษี</label>
							<select class="field-control" style="font-size: 11px; padding: 6px 4px;" bind:value={line.taxRate} disabled={isLockedLine}>
								<option value="none">ไม่ระบุ</option>
								<option value="3">3%</option>
								<option value="7">7%</option>
								<option value="exempt">ยกเว้น</option>
							</select>
						</div>
						{/if}
						<div style="min-width: 80px; width: 80px; text-align: right;">
							<label class="field-label" style="font-size: 10px;">รวม</label>
							<div style="font-size: 13px; font-weight: 600; padding: 6px 0;">{formatMoney(getLineTotal(i))}</div>
						</div>
						<div style="min-width: 32px; width: 32px;">
							{#if lines.length > 1 && !isLockedLine}
								<button class="btn btn-sm btn-icon" style="padding: 4px; background: none; border: none; color: var(--color-danger);" onclick={() => removeLine(line.id)}>
									<Trash2 size={14} />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<PresetBar
				category="lineItems"
				label="บันทึกรายการ"
				collectData={() => ({ lines: lines.filter(l => l.name.trim()).map(l => ({ name: l.name, code: l.code, description: l.description, details: l.details, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, discountType: l.discountType, discountValue: l.discountValue })) })}
				onApply={(data) => { const items = data.lines as any[]; if (items?.length) { lines = items.map(l => ({ ...createEmptyLine(), ...l })); } }}
			/>
		</div>
		{/if}

		<!-- Financial Options -->
		<div class="card" style="margin-bottom: 16px;">
			<h3 style="font-size: 14px; font-weight: 700; margin: 0 0 16px 0;">สรุปยอดและอื่นๆ</h3>
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px;">
				<!-- Discount -->
				<div style="display: flex; align-items: center; gap: 8px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap;">
						<input type="checkbox" bind:checked={discountEnabled} />
						ส่วนลดรวม
					</label>
					{#if discountEnabled}
						<select class="field-control" style="width: 70px; font-size: 12px; padding: 5px 6px;" bind:value={discountType}>
							<option value="PERCENT">%</option>
							<option value="AMOUNT">฿</option>
						</select>
						<input class="field-control" style="width: 80px; text-align: right; font-size: 12px; padding: 5px 6px;" type="number" bind:value={discountValue} />
					{/if}
				</div>
				<!-- Custom Fee -->
				<div style="display: flex; align-items: center; gap: 8px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap;">
						<input type="checkbox" bind:checked={customFeeEnabled} />
						ค่าใช้จ่ายเพิ่มเติม
					</label>
				</div>
				<!-- VAT -->
				<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap;">
						<input type="checkbox" bind:checked={vatEnabled} />
						VAT
					</label>
					{#if vatEnabled}
						<input class="field-control" style="width: 50px; text-align: right; font-size: 12px; padding: 5px 6px;" type="number" bind:value={vatRate} />
						<span style="font-size: 12px; color: var(--color-gray-500);">%</span>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; color: var(--color-gray-500);">
							<input type="checkbox" bind:checked={vatInclusive} />
							รวมในสินค้า/บริการแล้ว
						</label>
					{/if}
				</div>
				<!-- Custom Fee Details (row 2, col 2) -->
				{#if customFeeEnabled}
					<div style="display: flex; align-items: center; gap: 8px;">
						<input class="field-control" style="flex: 1; font-size: 12px; padding: 5px 8px;" bind:value={customFeeName} placeholder="ชื่อรายการ" />
						<input class="field-control" style="width: 90px; text-align: right; font-size: 12px; padding: 5px 6px;" type="number" bind:value={customFeeAmount} />
						{#if vatEnabled}
							<select class="field-control" style="width: auto; min-width: 140px; font-size: 11px; padding: 5px 6px;" bind:value={customFeeVatMode}>
								<option value="NO_VAT">ไม่มี VAT</option>
								<option value="EXCLUSIVE">บวก VAT เพิ่ม {vatRate}%</option>
								<option value="INCLUSIVE">ราคารวม VAT แล้ว</option>
							</select>
						{/if}
					</div>
				{:else}
					<div></div>
				{/if}
				<!-- WHT -->
				<div style="display: flex; align-items: center; gap: 8px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap;">
						<input type="checkbox" bind:checked={whtEnabled} />
						หัก ณ ที่จ่าย (WHT)
					</label>
					{#if whtEnabled}
						<input class="field-control" style="width: 50px; text-align: right; font-size: 12px; padding: 5px 6px;" type="number" bind:value={whtRate} />
						<span style="font-size: 12px; color: var(--color-gray-500);">%</span>
					{/if}
				</div>
				<div></div>
			</div>
		</div>
		{/if}

		<!-- ===== STEP 3: ส่วนเสริม ===== -->
		{#if currentStep === 3}
		<!-- Signature & Stamp Card -->
		<div class="card" style="margin-bottom: 16px;">
			<h3 style="font-size: 14px; font-weight: 700; margin: 0 0 16px 0;">ลงนามและตราประทับ</h3>
			<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px;">

				<!-- Signature 2: ผู้รับ (Receiver) - LEFT -->
				<div style="border: 1px solid var(--color-gray-200); border-radius: 10px; padding: 14px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 12px;">
						<input type="checkbox" bind:checked={signature2Enabled} />
						ผู้รับเอกสาร
					</label>
					{#if signature2Enabled}
						<div style="display: flex; flex-direction: column; gap: 10px;">
							<div>
								<label class="field-label" style="font-size: 11px;">หัวข้อ (แสดงในเอกสาร)</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={signature2Title} placeholder={autoReceiverTitle()} />
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">ชื่อผู้ลงนาม</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={signature2Name} placeholder="ชื่อ-นามสกุล" />
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">รูปลายเซ็น</label>
								<div style="display: flex; align-items: center; gap: 10px;">
									<div style="width: 120px; height: 60px; border: 1px dashed var(--color-gray-300); border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
										{#if signature2Image}
											<img src={signature2Image} alt="ลายเซ็น" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
										{:else}
											<span style="font-size: 10px; color: var(--color-gray-400);">ยังไม่มีลายเซ็น</span>
										{/if}
									</div>
									<div style="display: flex; flex-direction: column; gap: 4px;">
										<input type="file" accept="image/*" style="display: none;" bind:this={sign2InputEl} onchange={handleSign2Upload} />
										<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px;" onclick={() => sign2InputEl.click()}>
											<Upload size={12} /> เลือกรูป
										</button>
										{#if signature2Image}
											<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px; color: var(--color-danger); border-color: var(--color-danger);" onclick={() => signature2Image = ''}>
												<X size={12} /> ลบ
											</button>
										{/if}
										<span style="font-size: 9px; color: var(--color-gray-400);">PNG พื้นใส แนะนำ</span>
									</div>
								</div>
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">วันที่ลงนาม</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" type="date" bind:value={signature2Date} />
							</div>
							<PresetBar
								category="signature2"
								label="บันทึกลายเซ็น"
								collectData={() => ({ signature2Title, signature2Name, signature2Image, signature2Date })}
								onApply={(data) => { signature2Title = (data.signature2Title as string) || ''; signature2Name = (data.signature2Name as string) || ''; signature2Image = (data.signature2Image as string) || ''; signature2Date = (data.signature2Date as string) || ''; }}
							/>
						</div>
					{/if}
				</div>

				<!-- Signature 3: Custom (e.g. ผู้อนุมัติ) - CENTER -->
				<div style="border: 1px solid var(--color-gray-200); border-radius: 10px; padding: 14px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 12px;">
						<input type="checkbox" bind:checked={signature3Enabled} />
						ลงนามเพิ่มเติม
					</label>
					{#if signature3Enabled}
						<div style="display: flex; flex-direction: column; gap: 10px;">
							<div>
								<label class="field-label" style="font-size: 11px;">หัวข้อ (แสดงในเอกสาร)</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={signature3Title} placeholder="เช่น ผู้อนุมัติ ใบเสนอราคา" />
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">ชื่อผู้ลงนาม</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={signature3Name} placeholder="ชื่อ-นามสกุล" />
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">รูปลายเซ็น</label>
								<div style="display: flex; align-items: center; gap: 10px;">
									<div style="width: 120px; height: 60px; border: 1px dashed var(--color-gray-300); border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
										{#if signature3Image}
											<img src={signature3Image} alt="ลายเซ็น" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
										{:else}
											<span style="font-size: 10px; color: var(--color-gray-400);">ยังไม่มีลายเซ็น</span>
										{/if}
									</div>
									<div style="display: flex; flex-direction: column; gap: 4px;">
										<input type="file" accept="image/*" style="display: none;" bind:this={sign3InputEl} onchange={handleSign3Upload} />
										<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px;" onclick={() => sign3InputEl.click()}>
											<Upload size={12} /> เลือกรูป
										</button>
										{#if signature3Image}
											<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px; color: var(--color-danger); border-color: var(--color-danger);" onclick={() => signature3Image = ''}>
												<X size={12} /> ลบ
											</button>
										{/if}
										<span style="font-size: 9px; color: var(--color-gray-400);">PNG พื้นใส แนะนำ</span>
									</div>
								</div>
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">วันที่ลงนาม</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" type="date" bind:value={signature3Date} />
							</div>
							<PresetBar
								category="signature3"
								label="บันทึกลายเซ็น"
								collectData={() => ({ signature3Title, signature3Name, signature3Image, signature3Date })}
								onApply={(data) => { signature3Title = (data.signature3Title as string) || ''; signature3Name = (data.signature3Name as string) || ''; signature3Image = (data.signature3Image as string) || ''; signature3Date = (data.signature3Date as string) || ''; }}
							/>
						</div>
					{/if}
				</div>

				<!-- Signature 1: ผู้ออก (Issuer) - RIGHT -->
				<div style="border: 1px solid var(--color-gray-200); border-radius: 10px; padding: 14px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 12px;">
						<input type="checkbox" bind:checked={signatureEnabled} />
						ผู้ออกเอกสาร
					</label>
					{#if signatureEnabled}
						<div style="display: flex; flex-direction: column; gap: 10px;">
							<div>
								<label class="field-label" style="font-size: 11px;">หัวข้อ (แสดงในเอกสาร)</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={signatureTitle} placeholder={autoIssuerTitle()} />
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">ชื่อผู้ลงนาม</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={signatureName} placeholder="ชื่อ-นามสกุล" />
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">รูปลายเซ็น</label>
								<div style="display: flex; align-items: center; gap: 10px;">
									<div style="width: 120px; height: 60px; border: 1px dashed var(--color-gray-300); border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
										{#if signatureImage}
											<img src={signatureImage} alt="ลายเซ็น" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
										{:else}
											<span style="font-size: 10px; color: var(--color-gray-400);">ยังไม่มีลายเซ็น</span>
										{/if}
									</div>
									<div style="display: flex; flex-direction: column; gap: 4px;">
										<input type="file" accept="image/*" style="display: none;" bind:this={signInputEl} onchange={handleSignUpload} />
										<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px;" onclick={() => signInputEl.click()}>
											<Upload size={12} /> เลือกรูป
										</button>
										{#if signatureImage}
											<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px; color: var(--color-danger); border-color: var(--color-danger);" onclick={() => signatureImage = ''}>
												<X size={12} /> ลบ
											</button>
										{/if}
										<span style="font-size: 9px; color: var(--color-gray-400);">PNG พื้นใส แนะนำ</span>
									</div>
								</div>
							</div>
							<div>
								<label class="field-label" style="font-size: 11px;">วันที่ลงนาม</label>
								<input class="field-control" style="font-size: 12px; padding: 6px 8px;" type="date" bind:value={signDate} />
							</div>
							<PresetBar
								category="signature"
								label="บันทึกลายเซ็น"
								collectData={() => ({ signatureTitle, signatureName, signatureImage, signDate })}
								onApply={(data) => { signatureTitle = (data.signatureTitle as string) || ''; signatureName = (data.signatureName as string) || ''; signatureImage = (data.signatureImage as string) || ''; signDate = (data.signDate as string) || ''; }}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Stamp Card (Separate) -->
		<div class="card" style="margin-bottom: 16px;">
			<h3 style="font-size: 14px; font-weight: 700; margin: 0 0 16px 0;">ตราประทับ</h3>
			<div style="border: 1px solid var(--color-gray-200); border-radius: 10px; padding: 14px; max-width: 400px;">
				{#if $isSandbox}
					<!-- Sandbox: stamp is locked to GridPro logo -->
					<div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--color-gray-600);">
						<input type="checkbox" checked disabled />
						ตราประทับ (Stamp)
						<span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: var(--color-gray-100); color: var(--color-gray-500); border: 1px solid var(--color-gray-200);"><Lock size={10} /> ล็อก</span>
					</div>
					<div style="display: flex; align-items: center; gap: 10px;">
						<div style="width: 100px; height: 100px; border: 1px dashed var(--color-gray-300); border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
							<img src={SANDBOX_LOGO_URL} alt="GridPro Logo" style="max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0.5; filter: grayscale(100%);" />
						</div>
						<div style="font-size: 11px; color: var(--color-gray-500);">
							โหมดทดลอง: ใช้ตราประทับ GridPro<br/>
							<button type="button" style="margin-top: 6px; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; border: 1px solid #2563eb; background: #eff6ff; color: #2563eb; cursor: pointer;" onclick={() => showSandboxUpgrade = true}>สมัครเพื่อใช้ตราของคุณเอง</button>
						</div>
					</div>
				{:else}
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 12px;">
						<input type="checkbox" bind:checked={stampEnabled} />
						ตราประทับ (Stamp)
					</label>
					{#if stampEnabled}
						<div style="display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; gap: 12px;">
								<label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;">
									<input type="radio" name="stampSource" value="logo" bind:group={stampSource} />
									ใช้ Logo บริษัท
								</label>
								<label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;">
									<input type="radio" name="stampSource" value="custom" bind:group={stampSource} />
									อัพโหลดรูปใหม่
								</label>
							</div>
							<div style="display: flex; align-items: center; gap: 10px;">
								<div style="width: 100px; height: 100px; border: 1px dashed var(--color-gray-300); border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
									{#if stampImage}
										<img src={stampImage} alt="ตราประทับ" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
									{:else if stampSource === 'logo' && $currentCompany?.json?.logo}
										<img src={$currentCompany.json.logo} alt="Logo" style="max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0.5; filter: grayscale(100%);" />
									{:else}
										<span style="font-size: 10px; color: var(--color-gray-400); text-align: center;">ไม่มีรูป</span>
									{/if}
								</div>
								{#if stampSource === 'custom'}
									<div style="display: flex; flex-direction: column; gap: 4px;">
										<input type="file" accept="image/*" style="display: none;" bind:this={stampInputEl} onchange={handleStampUpload} />
										<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px;" onclick={() => stampInputEl.click()}>
											<Upload size={12} /> เลือกรูป
										</button>
										{#if stampImage}
											<button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 10px; color: var(--color-danger); border-color: var(--color-danger);" onclick={() => stampImage = ''}>
												<X size={12} /> ลบ
											</button>
										{/if}
										<span style="font-size: 9px; color: var(--color-gray-400);">PNG พื้นใส แนะนำ</span>
									</div>
								{/if}
							</div>
						</div>
						<PresetBar
							category="stamp"
							label="บันทึกตราประทับ"
							collectData={() => ({ stampImage, stampSource })}
							onApply={(data) => { stampImage = (data.stampImage as string) || ''; const src = (data.stampSource as string) || 'logo'; stampSource = src === 'custom' ? 'custom' : 'logo'; }}
						/>
					{/if}
				{/if}
				</div>
		</div>

		<!-- Payment Channel (Bank Info) -->
		{#if companyBankAccounts.length > 0}
			<div class="card" style="margin-bottom: 16px;">
				<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; cursor: pointer;">
						<input type="checkbox" bind:checked={showBankInfo} />
						ช่องทางชำระเงิน
					</label>
				</div>
				{#if showBankInfo}
					<div style="display: flex; flex-direction: column; gap: 8px;">
						{#each companyBankAccounts as bank, i}
							<label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--color-gray-200); border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.15s;"
								class:selected-bank={selectedBankIndexes.includes(i)}>
								<input type="checkbox" checked={selectedBankIndexes.includes(i)} onchange={() => {
									if (selectedBankIndexes.includes(i)) {
										selectedBankIndexes = selectedBankIndexes.filter(idx => idx !== i);
									} else {
										selectedBankIndexes = [...selectedBankIndexes, i];
									}
								}} />
								<div style="flex: 1; min-width: 0;">
									<div style="font-weight: 600;">{bank.bankName} {bank.branch ? `(${bank.branch})` : ''}</div>
									<div style="font-size: 12px; color: var(--color-gray-500);">เลขบัญชี: {bank.accountNo} &middot; ชื่อบัญชี: {bank.accountName}</div>
								</div>
							</label>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Payment Method (column-visibility style) -->
		{#if config.showPaymentMethod}
			<div class="card" style="margin-bottom: 16px;">
				<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="col-settings-item" style="font-weight: 600;">
						<input type="checkbox" bind:checked={paymentMethodEnabled} />
						ชำระโดย
					</label>
				</div>
				{#if paymentMethodEnabled}
				<div class="col-settings-card">
					<div style="font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--color-gray-700);">ตัวเลือกที่แสดงในเอกสาร</div>
					<div style="display: flex; flex-wrap: wrap; gap: 6px 16px;">
						{#each PAYMENT_METHOD_OPTIONS.filter(o => o.value !== 'custom') as opt}
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label class="col-settings-item"><input type="checkbox" bind:checked={paymentMethodValues[opt.value]} /> {opt.label}</label>
						{/each}
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="col-settings-item"><input type="checkbox" bind:checked={paymentMethodValues.custom} /> อื่นๆ</label>
					</div>
					{#if paymentMethodValues.custom}
						<input class="field-control" style="margin-top: 8px; max-width: 280px;" bind:value={paymentMethodCustom} placeholder="ระบุวิธีชำระ..." />
					{/if}
					{#if Object.entries(paymentMethodValues).some(([k, v]) => v && k !== 'custom') || paymentMethodValues.custom}
						<div style="font-size: 12px; font-weight: 600; margin-top: 10px; margin-bottom: 6px; color: var(--color-gray-700);">ติ๊กเลือก (✓)</div>
						<div style="display: flex; flex-wrap: wrap; gap: 6px 16px;">
							{#each PAYMENT_METHOD_OPTIONS.filter(o => o.value !== 'custom') as opt}
								{#if paymentMethodValues[opt.value]}
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="col-settings-item"><input type="checkbox" bind:checked={paymentMethodChecked[opt.value]} /> {opt.label}</label>
								{/if}
							{/each}
							{#if paymentMethodValues.custom}
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label class="col-settings-item"><input type="checkbox" bind:checked={paymentMethodChecked.custom} /> {paymentMethodCustom || 'อื่นๆ'}</label>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
			</div>
		{/if}

		<!-- Payment Terms -->
		{#if config.showPaymentTerms}
			<div class="card" style="margin-bottom: 16px;">
				<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
						<input type="checkbox" bind:checked={paymentTermsEnabled} />
						เงื่อนไขการชำระเงิน
					</label>
					{#if paymentTermsEnabled}
						<select class="field-control" style="width: 180px;" bind:value={paymentTermsPreset}>
							{#each PAYMENT_TERMS_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
						{#if paymentTermsPreset === 'custom'}
							<input class="field-control" style="flex: 1; min-width: 120px;" bind:value={paymentTermsCustom} placeholder="ระบุเงื่อนไข..." />
						{/if}
					{/if}
				</div>
				<PresetBar
					category="paymentTerms"
					label="บันทึกเงื่อนไข"
					collectData={() => ({ paymentTermsPreset, paymentTermsCustom })}
					onApply={(data) => { paymentTermsEnabled = true; paymentTermsPreset = (data.paymentTermsPreset as string) || 'cash'; paymentTermsCustom = (data.paymentTermsCustom as string) || ''; }}
				/>
			</div>
		{/if}

		<!-- Notes & Terms -->
		<div class="card" style="margin-bottom: 16px;">
			<div class="two-col-grid" style="gap: 12px;">
				<div>
					<label class="field-label">หมายเหตุ</label>
					<textarea class="field-control" bind:value={notes} rows="3" placeholder="หมายเหตุ..."></textarea>
					<PresetBar
						category="notes"
						label="บันทึกหมายเหตุ"
						collectData={() => ({ notes })}
						onApply={(data) => { notes = (data.notes as string) || ''; }}
					/>
				</div>
				{#if config.showTermsAndConditions}
					<div>
						<label class="field-label">ข้อกำหนดและเงื่อนไข</label>
						<textarea class="field-control" bind:value={terms} rows="3" placeholder="ข้อกำหนดและเงื่อนไข..."></textarea>
						<PresetBar
							category="terms"
							label="บันทึกเงื่อนไข"
							collectData={() => ({ terms, paymentTermsEnabled, paymentTermsPreset, paymentTermsCustom })}
							onApply={(data) => { terms = (data.terms as string) || ''; if (data.paymentTermsEnabled !== undefined) { paymentTermsEnabled = data.paymentTermsEnabled as boolean; paymentTermsPreset = (data.paymentTermsPreset as string) || 'credit30'; paymentTermsCustom = (data.paymentTermsCustom as string) || ''; } }}
						/>
					</div>
				{/if}
			</div>
		</div>

		{/if}

		<!-- Step Navigation -->
		<div class="step-nav">
			{#if currentStep > 1}
				<button class="btn btn-outline" onclick={prevStep} type="button">
					<ChevronLeft size={16} /> ย้อนกลับ
				</button>
			{:else}
				<div></div>
			{/if}
			<div style="display: flex; gap: 8px;">
				<button class="btn btn-outline" onclick={() => showPreview = true} type="button">
					<Eye size={16} /> พรีวิว
				</button>
				{#if currentStep < 3}
					<button class="btn btn-primary" onclick={nextStep} type="button">
						ถัดไป <ChevronRight size={16} />
					</button>
				{:else}
					<button class="btn btn-primary" onclick={() => { savePrefsForCurrentDocType(); saveDocument(); }} type="button">
						<Save size={16} /> บันทึกเอกสาร
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Right: Summary (visible on step 2+3) -->
	{#if currentStep >= 2}
	<div style="width: 320px; flex-shrink: 0;">
		<div class="card" style="position: sticky; top: 24px;">
			<h3 style="font-size: 14px; font-weight: 700; margin-bottom: 16px;">สรุปยอด</h3>
			<div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
				<div style="display: flex; justify-content: space-between;">
					<span style="color: var(--color-gray-500);">รวมเงิน</span>
					<span>{formatMoney(calcResult.subtotal)}</span>
				</div>
				{#if calcResult.itemDiscountTotal > 0}
					<div style="display: flex; justify-content: space-between;">
						<span style="color: var(--color-gray-500);">ส่วนลดรายการ</span>
						<span style="color: var(--color-danger);">-{formatMoney(calcResult.itemDiscountTotal)}</span>
					</div>
				{/if}
				{#if discountEnabled && calcResult.discount > 0}
					<div style="display: flex; justify-content: space-between;">
						<span style="color: var(--color-gray-500);">ส่วนลด{discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}</span>
						<span style="color: var(--color-danger);">-{formatMoney(calcResult.discount)}</span>
					</div>
					<div style="display: flex; justify-content: space-between; font-weight: 500;">
						<span>ยอดหลังหักส่วนลด</span>
						<span>{formatMoney(calcResult.afterItemDiscount - calcResult.discount)}</span>
					</div>
				{/if}
				{#if customFeeEnabled && customFeeAmount > 0 && customFeeVatMode === 'EXCLUSIVE'}
					<div style="display: flex; justify-content: space-between;">
						<span style="color: var(--color-gray-500);">{customFeeName || 'ค่าใช้จ่ายเพิ่มเติม'}</span>
						<span>+{formatMoney(customFeeAmount)}</span>
					</div>
				{/if}
				{#if vatEnabled && vatInclusive}
					<div style="display: flex; justify-content: space-between; font-weight: 500;">
						<span>ยอดก่อนภาษี</span>
						<span>{formatMoney(calcResult.preTaxBase)}</span>
					</div>
				{/if}
				{#if vatEnabled}
					<div style="display: flex; justify-content: space-between;">
						<span style="color: var(--color-gray-500);">ภาษีมูลค่าเพิ่ม ({vatRate}%)</span>
						<span>{formatMoney(calcResult.vatAmount)}</span>
					</div>
				{/if}
				{#if whtEnabled}
					<div style="display: flex; justify-content: space-between;">
						<span style="color: var(--color-gray-500);">หัก ณ ที่จ่าย ({whtRate}%)</span>
						<span style="color: var(--color-danger);">-{formatMoney(calcResult.whtAmount)}</span>
					</div>
				{/if}
				{#if customFeeEnabled && customFeeAmount > 0 && customFeeVatMode === 'NO_VAT'}
					<div style="display: flex; justify-content: space-between;">
						<span style="color: var(--color-gray-500);">{customFeeName || 'ค่าใช้จ่ายเพิ่มเติม'}</span>
						<span>{formatMoney(customFeeAmount)}</span>
					</div>
				{/if}
				<div style="border-top: 2px solid var(--color-gray-200); padding-top: 8px; display: flex; justify-content: space-between;">
					<span style="font-size: 15px; font-weight: 700;">ยอดสุทธิ</span>
					<span style="font-size: 18px; font-weight: 700; color: var(--color-primary);">{formatMoney(calcResult.grandTotal)}</span>
				</div>
				<div style="font-size: 11px; color: var(--color-gray-400); text-align: right;">
					{bahtText(calcResult.grandTotal)}
				</div>
			</div>
		</div>
	</div>
	{/if}
</div>

<!-- Preview Modal Popup -->
<PreviewModal
	open={showPreview}
	title="พรีวิว {getDocTypeLabel(docType)} {docNo}"
	filename="{docNo || 'document'}.pdf"
	{docType}
	lang={docLang}
	{overlayItems}
	onoverlaychange={handleOverlayChange}
	onclose={() => showPreview = false}
>
	<PaginatedDocPreview
		{docType}
		{docNo}
		{docDate}
		{dueDate}
		lang={docLang}
		company={companyForPreview}
		customer={customerForPreview}
		lines={lines.filter(l => l.name.trim()).map((l) => ({ name: l.name, description: l.description, code: l.code, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, discountType: l.discountType, discountValue: l.discountValue, lineTotal: calcResult.lineTotals[lines.indexOf(l)] || 0, taxRate: l.taxRate || 'none' }))}
		calc={calcResult}
		{discountEnabled}
		{discountType}
		{discountValue}
		{vatEnabled}
		{vatRate}
		{vatInclusive}
		{whtEnabled}
		{whtRate}
		{signatureEnabled}
		{signatureTitle}
		{signatureName}
		{signatureImage}
		{signDate}
		{signature2Enabled}
		{signature2Title}
		{signature2Name}
		{signature2Image}
		{signature2Date}
		{signature3Enabled}
		{signature3Title}
		{signature3Name}
		{signature3Image}
		{signature3Date}
		showStamp={$isSandbox ? true : stampEnabled}
		stampImage={$isSandbox ? SANDBOX_LOGO_URL : (stampEnabled ? (stampSource === 'custom' ? stampImage : ($currentCompany?.json?.logo as string || '')) : '')}
		{notes}
		{terms}
		salespersonName={selectedSalesperson?.name || ''}
		{contactPerson}
		showPaymentMethod={paymentMethodEnabled}
		paymentMethodItems={paymentMethodEnabled ? PAYMENT_METHOD_OPTIONS.filter(o => o.value !== 'custom' && paymentMethodValues[o.value]).map(o => ({ label: o.label, checked: !!paymentMethodChecked[o.value] })).concat(paymentMethodValues.custom ? [{ label: paymentMethodCustom || 'อื่นๆ', checked: !!paymentMethodChecked.custom }] : []) : []}
		showPaymentTerms={paymentTermsEnabled}
		paymentTermsLabel={paymentTermsLabel()}
		{customFeeName}
		{customFeeAmount}
		showCustomFee={customFeeEnabled}
		{customFeeVatMode}
		{showBankInfo}
		selectedBankAccounts={showBankInfo ? selectedBankIndexes.map(i => companyBankAccounts[i]).filter(Boolean) : []}
		customFields={customFields.filter(cf => cf.label.trim() && cf.value.trim())}
		{templateId}
		visibleColumns={lineColumnVisibility}
	/>
</PreviewModal>

<ProductPickerDialog
	open={showProductPicker}
	{products}
	onconfirm={handlePickerConfirm}
	oncancel={() => showProductPicker = false}
/>

<style>
	/* Step Indicator */
	.step-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		margin-bottom: 24px;
		padding: 16px 24px;
		background: white;
		border-radius: 12px;
		border: 1px solid var(--color-gray-200);
	}
	.step-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 12px;
		opacity: 0.5;
		transition: opacity 0.2s;
	}
	.step-item.active, .step-item.completed {
		opacity: 1;
	}
	.step-circle {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gray-200);
		color: var(--color-gray-500);
		font-size: 14px;
		transition: all 0.2s;
	}
	.step-item.active .step-circle {
		background: var(--color-primary);
		color: white;
	}
	.step-item.completed .step-circle {
		background: var(--color-success, #10b981);
		color: white;
	}
	.step-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-gray-500);
		white-space: nowrap;
	}
	.step-item.active .step-label {
		color: var(--color-primary);
	}
	.step-item.completed .step-label {
		color: var(--color-success, #10b981);
	}
	.step-line {
		flex: 1;
		height: 2px;
		background: var(--color-gray-200);
		min-width: 40px;
		max-width: 120px;
		margin: 0 4px;
		margin-bottom: 22px;
		transition: background 0.2s;
	}
	.step-line.active {
		background: var(--color-success, #10b981);
	}

	/* Step Navigation */
	.step-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 0;
		margin-top: 8px;
		border-top: 1px solid var(--color-gray-200);
	}

	.two-col-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.doc-form-wrapper {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
		overflow-x: hidden;
	}
	.doc-form-left {
		flex: 1;
		min-width: 400px;
		max-width: 100%;
		overflow-x: hidden;
	}

	@media (max-width: 768px) {
		.doc-form-left {
			min-width: 0;
			width: 100%;
		}
		div[style*="width: 320px"] {
			width: 100% !important;
		}
		.step-indicator {
			padding: 12px 8px;
		}
		.step-item {
			padding: 4px 6px;
		}
		.step-label {
			font-size: 10px;
		}
		.two-col-grid {
			grid-template-columns: 1fr;
		}
	}
	:global(.selected-bank) {
		border-color: var(--color-primary) !important;
		background: var(--color-primary-soft) !important;
	}

	/* Line items horizontal scroll on mobile */
	.line-items-scroll {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	.line-item-row {
		display: flex;
		gap: 6px;
		align-items: end;
		margin-bottom: 8px;
		padding: 8px;
		background: var(--color-gray-50);
		border-radius: 8px;
		min-width: 700px;
	}

	/* Discount grouped input */
	.discount-group {
		display: flex;
		border: 1px solid var(--color-gray-300);
		border-radius: 6px;
		overflow: hidden;
		background: white;
	}
	.discount-group .discount-input {
		flex: 1;
		border: none;
		outline: none;
		font-size: 12px;
		padding: 6px 8px;
		text-align: right;
		width: 60px;
		min-width: 0;
		background: transparent;
	}
	.discount-group .discount-input:focus {
		box-shadow: none;
	}
	.discount-group .discount-toggle {
		width: 32px;
		border: none;
		border-left: 1px solid var(--color-gray-300);
		background: var(--color-gray-100);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		color: var(--color-gray-600);
		transition: background 0.15s, color 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.discount-group .discount-toggle:hover {
		background: var(--color-primary-soft);
		color: var(--color-primary);
	}
	/* Income/Expense toggle */
	.doc-cat-toggle {
		display: flex;
		gap: 4px;
		background: var(--color-gray-100);
		border-radius: 8px;
		padding: 3px;
	}
	.doc-cat-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 5px 12px;
		border: none;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		background: transparent;
		color: var(--color-gray-500);
		transition: all 0.15s;
	}
	.doc-cat-btn:hover { color: var(--color-gray-700); }
	.doc-cat-btn.active {
		background: #fff;
		color: #059669;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
	}
	.doc-cat-btn.doc-cat-expense.active {
		color: #dc2626;
	}
	/* Combined doc checkbox */
	.combined-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-gray-700);
		cursor: pointer;
	}
	.combined-checkbox input[type="checkbox"] {
		width: 15px;
		height: 15px;
		accent-color: var(--color-primary);
		cursor: pointer;
	}
	.combined-hint {
		font-size: 10px;
		color: var(--color-gray-400);
		margin-top: 2px;
		padding-left: 21px;
	}

	.col-settings-card {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		border-radius: 8px;
		padding: 10px 14px;
		margin-bottom: 10px;
	}
	.col-settings-item {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--color-gray-600);
		cursor: pointer;
		white-space: nowrap;
	}
</style>

<SandboxUpgradeDialog
	bind:show={showSandboxUpgrade}
	message="รายการนี้เป็นสินค้าตัวอย่างในโหมดทดลอง ไม่สามารถแก้ไขหรือลบได้ สมัครใช้งานจริงเพื่อจัดการเอกสารอย่างอิสระ"
	onclose={() => showSandboxUpgrade = false}
/>
