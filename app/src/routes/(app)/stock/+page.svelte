<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/services/api';
	import { currentCompanyId, activeCompanyIds, addToast } from '$lib/stores/app';
	import { formatMoney, formatDateShort, getDocTypeLabel } from '$lib/utils/format';
	import { generateUuid } from '$lib/utils/helpers';
	import type { Product, StockLog, Customer, DocumentHeader, DocLine, DocType } from '$lib/types';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Package, Minus, Plus, Search, AlertTriangle, History, FileText, X, ArrowRight, Clock, CheckCircle, ArrowDownCircle, ArrowUpCircle, ExternalLink } from 'lucide-svelte';

	// ===== Core State =====
	let products: Product[] = $state([]);
	let customers: Customer[] = $state([]);
	let stockProducts = $derived(products.filter(p => p.json?.stockEnabled));
	let loading = $state(true);
	let saving = $state(false);
	let searchQuery = $state('');
	let filterStatus = $state<'all' | 'low' | 'out'>('all');
	let activeTab = $state<'stock' | 'pending' | 'history'>('stock');

	// ===== KPI Derived =====
	let totalStockItems = $derived(stockProducts.length);
	let totalStockValue = $derived(stockProducts.reduce((s, p) => s + ((p.json?.stockQty || 0) * ((p.json?.purchasePrice || p.json?.price || 0) as number)), 0));
	let lowStockCount = $derived(stockProducts.filter(p => { const q = (p.json?.stockQty || 0) as number; const m = (p.json?.minStock || 0) as number; return m > 0 && q <= m; }).length);
	let outOfStockCount = $derived(stockProducts.filter(p => (p.json?.stockQty || 0) === 0).length);
	let filteredProducts = $derived.by(() => {
		let r = stockProducts;
		if (searchQuery.trim()) { const q = searchQuery.trim().toLowerCase(); r = r.filter(p => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)); }
		if (filterStatus === 'low') r = r.filter(p => { const q2 = (p.json?.stockQty as number) || 0; const m = (p.json?.minStock as number) || 0; return m > 0 && q2 <= m; });
		if (filterStatus === 'out') r = r.filter(p => (p.json?.stockQty || 0) === 0);
		return r;
	});

	// ===== Pending Documents (Document-Driven) =====
	interface PendingDoc {
		docId: string;
		docNo: string;
		docType: DocType;
		docDate: string;
		customerName: string;
		refDocId: string;
		refDocType: string;
		direction: 'OUT' | 'IN';
		lines: Array<{
			productId: string;
			productName: string;
			unit: string;
			orderedQty: number;
			processedQty: number;
			pendingQty: number;
			confirmQty: number;
		}>;
	}

	let pendingOutDocs: PendingDoc[] = $state([]);
	let pendingInDocs: PendingDoc[] = $state([]);
	let allDocs: Array<{ header: DocumentHeader; lines: DocLine[] }> = $state([]);
	let showConfirmModal = $state(false);
	let confirmTarget: PendingDoc | null = $state(null);

	let totalPendingCount = $derived(pendingOutDocs.length + pendingInDocs.length);

	// Build pending docs from loaded documents + products
	function buildPendingDocs() {
		const outDocs: PendingDoc[] = [];
		const inDocs: PendingDoc[] = [];

		// Collect all stock log refDocNos from all products for fast lookup
		const allStockLogsByRef: Record<string, Array<{ productId: string; qty: number; type: string }>> = {};
		for (const p of products) {
			for (const log of ((p.json?.stockLogs as StockLog[]) || [])) {
				if (log.refDocNo) {
					if (!allStockLogsByRef[log.refDocNo]) allStockLogsByRef[log.refDocNo] = [];
					allStockLogsByRef[log.refDocNo].push({ productId: p.entityId, qty: log.qty, type: log.type });
				}
			}
		}

		// Find DO docNos that already auto-deducted (for anti-duplicate logic)
		const doDocNosDeducted = new Set<string>();
		for (const doc of allDocs) {
			if (doc.header.docType === 'DO') {
				const logs = allStockLogsByRef[doc.header.docNo];
				if (logs?.some(l => l.type === 'OUT')) doDocNosDeducted.add(doc.header.docNo);
			}
		}

		// Also collect DO docIds that are deducted
		const doDocIdsDeducted = new Set<string>();
		for (const doc of allDocs) {
			if (doc.header.docType === 'DO' && doDocNosDeducted.has(doc.header.docNo)) {
				doDocIdsDeducted.add(doc.header.docId);
			}
		}

		const STOCK_OUT_TYPES = ['INV', 'TAX', 'TAXRCPT', 'RCPT'];
		const STOCK_IN_TYPES = ['PO'];

		for (const doc of allDocs) {
			const h = doc.header;
			if (h.docStatus === 'CANCELLED') continue;

			const stockLines = doc.lines.filter(l => {
				if (!l.productId) return false;
				const prod = products.find(p => p.entityId === l.productId);
				return prod?.json?.stockEnabled;
			});
			if (stockLines.length === 0) continue;

			// --- Pending OUT (INV, TAX, TAXRCPT, RCPT) ---
			if (STOCK_OUT_TYPES.includes(h.docType)) {
				// Anti-duplicate: skip if this doc was created from a DO that already deducted
				const sourceRefDocId = (h.json as any)?.refDocId || '';
				if (sourceRefDocId && doDocIdsDeducted.has(sourceRefDocId)) continue;

				// Also check if refDocNo matches a DO that deducted
				if (h.refDocNo && doDocNosDeducted.has(h.refDocNo)) continue;

				const pendingLines = stockLines.map(l => {
					const prod = products.find(p => p.entityId === l.productId)!;
					const logsForDoc = allStockLogsByRef[h.docNo] || [];
					const processedQty = logsForDoc.filter(lg => lg.productId === l.productId && lg.type === 'OUT').reduce((s, lg) => s + lg.qty, 0);
					const pendingQty = Math.max(0, l.qty - processedQty);
					return {
						productId: l.productId,
						productName: l.name || prod.name,
						unit: l.unit || (prod.json?.unit as string) || '',
						orderedQty: l.qty,
						processedQty,
						pendingQty,
						confirmQty: pendingQty
					};
				}).filter(l => l.pendingQty > 0);

				if (pendingLines.length > 0) {
					outDocs.push({
						docId: h.docId, docNo: h.docNo, docType: h.docType,
						docDate: h.docDate,
						customerName: (h.json as any)?.customerName || '',
						refDocId: sourceRefDocId,
						refDocType: '',
						direction: 'OUT',
						lines: pendingLines
					});
				}
			}

			// --- Pending IN (PO) ---
			if (STOCK_IN_TYPES.includes(h.docType)) {
				const pendingLines = stockLines.map(l => {
					const prod = products.find(p => p.entityId === l.productId)!;
					const logsForDoc = allStockLogsByRef[h.docNo] || [];
					const processedQty = logsForDoc.filter(lg => lg.productId === l.productId && lg.type === 'IN').reduce((s, lg) => s + lg.qty, 0);
					const pendingQty = Math.max(0, l.qty - processedQty);
					return {
						productId: l.productId,
						productName: l.name || prod.name,
						unit: l.unit || (prod.json?.unit as string) || '',
						orderedQty: l.qty,
						processedQty,
						pendingQty,
						confirmQty: pendingQty
					};
				}).filter(l => l.pendingQty > 0);

				if (pendingLines.length > 0) {
					inDocs.push({
						docId: h.docId, docNo: h.docNo, docType: h.docType,
						docDate: h.docDate,
						customerName: (h.json as any)?.customerName || '',
						refDocId: '', refDocType: '',
						direction: 'IN',
						lines: pendingLines
					});
				}
			}

			// --- Pending IN from CN (Credit Note with returnToStock) ---
			if (h.docType === 'CN' && (h.json as any)?.returnToStock) {
				const pendingLines = stockLines.map(l => {
					const prod = products.find(p => p.entityId === l.productId)!;
					const logsForDoc = allStockLogsByRef[h.docNo] || [];
					const processedQty = logsForDoc.filter(lg => lg.productId === l.productId && lg.type === 'IN').reduce((s, lg) => s + lg.qty, 0);
					const pendingQty = Math.max(0, l.qty - processedQty);
					return {
						productId: l.productId,
						productName: l.name || prod.name,
						unit: l.unit || (prod.json?.unit as string) || '',
						orderedQty: l.qty,
						processedQty,
						pendingQty,
						confirmQty: pendingQty
					};
				}).filter(l => l.pendingQty > 0);

				if (pendingLines.length > 0) {
					inDocs.push({
						docId: h.docId, docNo: h.docNo, docType: h.docType,
						docDate: h.docDate,
						customerName: (h.json as any)?.customerName || '',
						refDocId: '', refDocType: '',
						direction: 'IN',
						lines: pendingLines
					});
				}
			}
		}

		pendingOutDocs = outDocs;
		pendingInDocs = inDocs;
	}

	// ===== Confirm Stock Action =====
	function openConfirm(doc: PendingDoc) {
		confirmTarget = { ...doc, lines: doc.lines.map(l => ({ ...l })) };
		showConfirmModal = true;
	}

	async function executeConfirm() {
		if (!confirmTarget) return;
		const doc = confirmTarget;
		const validLines = doc.lines.filter(l => l.confirmQty > 0);
		if (!validLines.length) { addToast('ไม่มีรายการที่จะดำเนินการ', 'error'); return; }

		// Validate: confirmQty must not exceed pendingQty
		for (const line of validLines) {
			if (line.confirmQty > line.pendingQty) {
				addToast(`${line.productName}: จำนวนเกินกว่าที่รอดำเนินการ (${line.pendingQty})`, 'error');
				return;
			}
		}

		saving = true;
		showConfirmModal = false;
		const cid = $currentCompanyId || 'comp-001';
		let ok = 0;
		const today = new Date().toISOString().slice(0, 10);

		for (const line of validLines) {
			const prod = products.find(p => p.entityId === line.productId);
			if (!prod) continue;
			const cur = (prod.json?.stockQty as number) || 0;
			const logs: StockLog[] = (prod.json?.stockLogs as StockLog[]) || [];

			let newQty: number;
			let newLog: StockLog;

			if (doc.direction === 'OUT') {
				newQty = Math.max(0, cur - line.confirmQty);
				newLog = {
					date: today,
					qty: line.confirmQty,
					type: 'OUT',
					reason: `ตัดสต็อกจาก ${getDocTypeLabel(doc.docType as any)} ${doc.docNo}`,
					refDocNo: doc.docNo
				};
			} else {
				newQty = cur + line.confirmQty;
				const label = doc.docType === 'CN' ? 'รับคืน' : 'รับสินค้า';
				newLog = {
					date: today,
					qty: line.confirmQty,
					type: 'IN',
					reason: `${label}จาก ${getDocTypeLabel(doc.docType as any)} ${doc.docNo}`,
					refDocNo: doc.docNo
				};
			}

			const res = await api.upsertProduct({
				...prod, companyId: cid,
				json: { ...prod.json, stockQty: newQty, stockLogs: [...logs, newLog] }
			});
			if (res.ok) ok++;
		}

		await reloadData();
		const action = doc.direction === 'OUT' ? 'ตัดสต็อก' : 'รับเข้าสต็อก';
		addToast(`${action}สำเร็จ ${ok}/${validLines.length} รายการ (${doc.docNo})`, 'success');
		confirmTarget = null;
		saving = false;
	}

	// ===== History =====
	let historyFilter = $state<'all' | 'IN' | 'OUT'>('all');
	let allLogs = $derived.by(() => {
		const logs: Array<{ productName: string; log: StockLog }> = [];
		for (const p of stockProducts) for (const log of ((p.json?.stockLogs as StockLog[]) || [])) logs.push({ productName: p.name, log });
		logs.sort((a, b) => new Date(b.log.date).getTime() - new Date(a.log.date).getTime());
		return historyFilter !== 'all' ? logs.filter(l => l.log.type === historyFilter) : logs;
	});

	// Find docId from docNo for linking
	function findDocId(docNo: string): string | null {
		if (!docNo) return null;
		const doc = allDocs.find(d => d.header.docNo === docNo);
		return doc?.header.docId || null;
	}

	// ===== Data Loading =====
	async function reloadData() {
		const ids = $activeCompanyIds.filter(Boolean);
		if (!ids.length) return;
		const [ap, ac] = await Promise.all([
			Promise.all(ids.map(id => api.listProducts(id))),
			Promise.all(ids.map(id => api.listCustomers(id)))
		]);
		products = ap.flat();
		customers = ac.flat();

		// Load all relevant docs (OUT types + IN types + CN)
		try {
			const docTypes = ['INV', 'TAX', 'TAXRCPT', 'RCPT', 'PO', 'CN', 'DO'];
			const results = await Promise.all(
				ids.flatMap(id => docTypes.map(dt => api.queryDocs(id, { docType: dt as any })))
			);
			const allHeaders = results.flatMap(r => r.items);
			const fullDocs: typeof allDocs = [];
			// Load lines for recent docs (last 50 for performance)
			const sortedHeaders = allHeaders.sort((a, b) => new Date(b.docDate).getTime() - new Date(a.docDate).getTime()).slice(0, 100);
			for (const h of sortedHeaders) {
				const doc = await api.getDoc(h.docId);
				if (doc) fullDocs.push({ header: doc.header, lines: doc.lines });
			}
			allDocs = fullDocs;
		} catch {}

		buildPendingDocs();
	}

	let unsub: (() => void) | null = null;
	onMount(async () => {
		// Read tab from URL params
		const params = $page.url.searchParams;
		const tabParam = params.get('tab');
		if (tabParam === 'pending') activeTab = 'pending';
		else if (tabParam === 'history') activeTab = 'history';

		unsub = activeCompanyIds.subscribe(async () => { loading = true; await reloadData(); loading = false; });
	});
	onDestroy(() => { unsub?.(); });
</script>


<div class="stock-page">
<div class="kpi-row">
<div class="card kpi-card"><div class="kpi-icon" style="background:color-mix(in srgb,var(--color-primary) 12%,white)"><Package size={18} style="color:var(--color-primary)" /></div><div><div class="kpi-label">สินค้าเปิดสต็อก</div><div class="kpi-value">{totalStockItems} <span class="kpi-unit">รายการ</span></div></div></div>
<div class="card kpi-card"><div class="kpi-icon" style="background:color-mix(in srgb,#22c55e 12%,white)"><Package size={18} style="color:#22c55e" /></div><div><div class="kpi-label">มูลค่าสต็อก</div><div class="kpi-value" style="color:#22c55e">{formatMoney(totalStockValue)}</div></div></div>
<div class="card kpi-card"><div class="kpi-icon" style="background:color-mix(in srgb,#f59e0b 12%,white)"><AlertTriangle size={18} style="color:#f59e0b" /></div><div><div class="kpi-label">สต็อกต่ำ/หมด</div><div class="kpi-value" style="color:#f59e0b">{lowStockCount + outOfStockCount}</div></div></div>
</div>
<div class="tab-bar">
<button class="tab-btn" class:active={activeTab==='stock'} onclick={()=>activeTab='stock'}><Package size={15}/> ภาพรวม</button>
<button class="tab-btn" class:active={activeTab==='pending'} onclick={()=>activeTab='pending'}><Clock size={15}/> รอดำเนินการ{#if totalPendingCount>0}<span class="tab-badge">{totalPendingCount}</span>{/if}</button>
<button class="tab-btn" class:active={activeTab==='history'} onclick={()=>activeTab='history'}><History size={15}/> ประวัติ</button>
</div>

{#if activeTab==='stock'}
<div class="card" style="margin-bottom:16px">
<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
<div style="flex:1;min-width:200px;position:relative"><Search size={15} style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--color-gray-400)"/><input class="field-control" style="padding-left:32px" placeholder="ค้นหาสินค้า..." bind:value={searchQuery}/></div>
<select class="field-control" style="width:auto" bind:value={filterStatus}><option value="all">ทั้งหมด</option><option value="low">สต็อกต่ำ</option><option value="out">หมดสต็อก</option></select>
</div>
</div>
{#if loading}<div class="card" style="text-align:center;padding:48px;color:var(--color-gray-400)">กำลังโหลด...</div>
{:else if stockProducts.length===0}<div class="card" style="text-align:center;padding:48px;color:var(--color-gray-400)"><Package size={40} style="margin-bottom:12px;opacity:0.3"/><div style="font-weight:600">ยังไม่มีสินค้าเปิดสต็อก</div><div style="font-size:12px;margin-top:4px">เปิดสต็อกได้ที่หน้า สินค้า/บริการ</div><button class="btn btn-outline" style="margin-top:12px" onclick={()=>goto('/products')}>ไปหน้าสินค้า</button></div>
{:else}<div class="card table-card"><table class="data-table"><thead><tr><th>สินค้า</th><th style="text-align:center">สต็อก</th><th style="text-align:center">ขั้นต่ำ</th><th style="text-align:right">ราคาทุน</th><th style="text-align:right">มูลค่า</th></tr></thead><tbody>
{#each filteredProducts as p (p.entityId)}{@const qty=(p.json?.stockQty||0) as number}{@const min=(p.json?.minStock||0) as number}{@const cost=Number(p.json?.purchasePrice)||Number(p.json?.price)||0}{@const isLow=min>0&&qty<=min}{@const isOut=qty===0}
<tr><td><div style="font-weight:600;font-size:13px">{p.name}</div>{#if p.code}<div style="font-size:11px;color:var(--color-gray-400)">{p.code} · {(p.json?.unit as string)||'ชิ้น'}</div>{/if}</td><td style="text-align:center"><span class="stock-badge" class:danger={isOut} class:warning={isLow&&!isOut} class:ok={!isLow&&!isOut}>{qty}</span></td><td style="text-align:center;font-size:12px;color:var(--color-gray-400)">{min||'-'}</td><td style="text-align:right;font-size:12px">{cost?formatMoney(cost):'-'}</td><td style="text-align:right;font-size:12px;font-weight:600">{cost?formatMoney(qty*cost):'-'}</td></tr>
{/each}</tbody></table></div>{/if}
{/if}

{#if activeTab==='pending'}
<div class="card" style="margin-bottom:16px">
<h3 style="font-size:15px;font-weight:700;margin:0 0 14px;display:flex;align-items:center;gap:8px"><ArrowUpCircle size={16} style="color:#ef4444"/> รอตัดสต็อก ({pendingOutDocs.length})</h3>
{#if pendingOutDocs.length === 0}
<div style="text-align:center;padding:24px;color:var(--color-gray-400);font-size:13px;border:1px dashed var(--color-gray-200);border-radius:8px">ไม่มีเอกสารรอตัดสต็อก</div>
{:else}
<div class="pending-list">
{#each pendingOutDocs as doc (doc.docId)}
<div class="pending-doc-card">
<div class="pending-doc-header">
<div><button class="doc-link" onclick={() => goto('/documents/' + doc.docId)}><FileText size={13}/> {doc.docNo}</button><span class="doc-type-badge out">{getDocTypeLabel(doc.docType)}</span></div>
<div style="text-align:right;font-size:11px;color:var(--color-gray-400)"><Clock size={10}/> {formatDateShort(doc.docDate)}{#if doc.customerName}<br/>{doc.customerName}{/if}</div>
</div>
<div class="pending-doc-lines">
{#each doc.lines as line}
<div class="pending-line"><span class="pending-line-name">{line.productName} <span style="color:var(--color-gray-400)">({line.unit})</span></span><span style="font-size:11px;color:var(--color-gray-400)">สั่ง {line.orderedQty}{#if line.processedQty > 0} · ตัดแล้ว {line.processedQty}{/if}</span><span class="pending-line-qty" style="color:#ef4444">คงค้าง {line.pendingQty}</span></div>
{/each}
</div>
<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none;font-weight:600" onclick={() => openConfirm(doc)} disabled={saving}><Minus size={13}/> ยืนยันตัดสต็อก</button></div>
</div>
{/each}
</div>
{/if}
</div>

<div class="card">
<h3 style="font-size:15px;font-weight:700;margin:0 0 14px;display:flex;align-items:center;gap:8px"><ArrowDownCircle size={16} style="color:#22c55e"/> รอรับเข้าสต็อก ({pendingInDocs.length})</h3>
{#if pendingInDocs.length === 0}
<div style="text-align:center;padding:24px;color:var(--color-gray-400);font-size:13px;border:1px dashed var(--color-gray-200);border-radius:8px">ไม่มีเอกสารรอรับเข้าสต็อก</div>
{:else}
<div class="pending-list">
{#each pendingInDocs as doc (doc.docId)}
<div class="pending-doc-card" style="border-left-color:#22c55e">
<div class="pending-doc-header">
<div><button class="doc-link" onclick={() => goto('/documents/' + doc.docId)}><FileText size={13}/> {doc.docNo}</button><span class="doc-type-badge in">{getDocTypeLabel(doc.docType)}{#if doc.docType === 'CN'} (คืนสินค้า){/if}</span></div>
<div style="text-align:right;font-size:11px;color:var(--color-gray-400)"><Clock size={10}/> {formatDateShort(doc.docDate)}{#if doc.customerName}<br/>{doc.customerName}{/if}</div>
</div>
<div class="pending-doc-lines">
{#each doc.lines as line}
<div class="pending-line"><span class="pending-line-name">{line.productName} <span style="color:var(--color-gray-400)">({line.unit})</span></span><span style="font-size:11px;color:var(--color-gray-400)">สั่ง {line.orderedQty}{#if line.processedQty > 0} · รับแล้ว {line.processedQty}{/if}</span><span class="pending-line-qty" style="color:#22c55e">คงค้าง {line.pendingQty}</span></div>
{/each}
</div>
<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-sm" style="background:#22c55e;color:#fff;border:none;font-weight:600" onclick={() => openConfirm(doc)} disabled={saving}><Plus size={13}/> ยืนยันรับเข้าสต็อก</button></div>
</div>
{/each}
</div>
{/if}
</div>
{/if}

{#if activeTab==='history'}
<div class="card">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
<h3 style="font-size:15px;font-weight:700;margin:0"><History size={16}/> ประวัติสต็อกทั้งหมด</h3>
<select class="field-control" style="width:auto" bind:value={historyFilter}><option value="all">ทั้งหมด</option><option value="IN">รับเข้า</option><option value="OUT">ตัดออก</option></select>
</div>
{#if allLogs.length===0}<div style="text-align:center;padding:48px;color:var(--color-gray-400)">ยังไม่มีประวัติ</div>
{:else}<div style="display:flex;flex-direction:column;gap:8px">{#each allLogs.slice(0,50) as item}{@const linkedDocId = findDocId(item.log.refDocNo || '')}
<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--color-gray-100);border-radius:10px;font-size:13px">
<div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:{item.log.type==='IN'?'color-mix(in srgb,#22c55e 12%,white)':'color-mix(in srgb,#ef4444 12%,white)'}">
{#if item.log.type==='IN'}<Plus size={16} style="color:#22c55e"/>{:else}<Minus size={16} style="color:#ef4444"/>{/if}
</div>
<div style="flex:1;min-width:0">
<div style="font-weight:600">{item.productName}</div>
<div style="font-size:11px;color:var(--color-gray-400)">{item.log.reason||'-'}{#if item.log.refDocNo} · {#if linkedDocId}<button class="doc-link" onclick={() => goto('/documents/' + linkedDocId)}>{item.log.refDocNo}</button>{:else}<span style="color:var(--color-primary)">{item.log.refDocNo}</span>{/if}{/if}</div>
</div>
<div style="text-align:right;flex-shrink:0">
<div style="font-weight:700;color:{item.log.type==='IN'?'#22c55e':'#ef4444'}">{item.log.type==='IN'?'+':'-'}{item.log.qty}</div>
<div style="font-size:11px;color:var(--color-gray-400)">{formatDateShort(item.log.date)}</div>
</div>
</div>{/each}</div>{/if}
</div>
{/if}
</div>

{#if showConfirmModal && confirmTarget}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={()=>{showConfirmModal=false;confirmTarget=null}} onkeydown={()=>{}}>
<div class="modal-card" onclick={(e)=>e.stopPropagation()} onkeydown={()=>{}}>
<h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:{confirmTarget.direction==='OUT'?'#ef4444':'#22c55e'}">
{confirmTarget.direction === 'OUT' ? 'ยืนยันตัดสต็อก' : 'ยืนยันรับเข้าสต็อก'}
</h3>
<p style="font-size:13px;color:var(--color-gray-500);margin:0 0 16px">
เอกสาร <b>{confirmTarget.docNo}</b> ({getDocTypeLabel(confirmTarget.docType)})
</p>
<div style="background:var(--color-gray-50);border-radius:8px;padding:12px;margin-bottom:16px;max-height:250px;overflow-y:auto">
{#each confirmTarget.lines as line}
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid var(--color-gray-100)">
<div style="flex:1"><span style="font-weight:600">{line.productName}</span> <span style="color:var(--color-gray-400)">({line.unit})</span></div>
<div style="display:flex;align-items:center;gap:8px">
<span style="font-size:11px;color:var(--color-gray-400)">คงค้าง {line.pendingQty}</span>
<input class="field-control" type="number" min="0" max={line.pendingQty} bind:value={line.confirmQty} style="width:70px;text-align:center;font-size:13px"/>
</div>
</div>
{/each}
</div>
<div style="display:flex;gap:8px;justify-content:flex-end">
<button class="btn btn-outline" onclick={()=>{showConfirmModal=false;confirmTarget=null}}>ยกเลิก</button>
<button class="btn btn-primary" style="background:{confirmTarget.direction==='OUT'?'#ef4444':'#22c55e'}" onclick={executeConfirm} disabled={saving}>
{saving ? 'กำลังบันทึก...' : confirmTarget.direction === 'OUT' ? 'ยืนยันตัดสต็อก' : 'ยืนยันรับเข้าสต็อก'}
</button>
</div>
</div>
</div>
{/if}

<style>
.stock-page{max-width:1200px}
.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px}
.kpi-card{display:flex;align-items:center;gap:14px;padding:16px 18px}
.kpi-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.kpi-label{font-size:11px;color:var(--color-gray-400);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.kpi-value{font-size:22px;font-weight:800;color:var(--color-text);line-height:1.2}
.kpi-unit{font-size:12px;font-weight:500;color:var(--color-gray-400)}
.tab-bar{display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--color-gray-100);padding-bottom:0}
.tab-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;font-size:13px;font-weight:600;border:none;background:none;color:var(--color-gray-400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;font-family:inherit}
.tab-btn:hover{color:var(--color-text)}
.tab-btn.active{color:var(--color-primary);border-bottom-color:var(--color-primary)}
.tab-badge{background:var(--color-danger);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:4px}
.table-card{overflow-x:auto;padding:0}
.data-table{width:100%;border-collapse:collapse;font-size:13px}
.data-table th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--color-gray-400);text-transform:uppercase;letter-spacing:.03em;border-bottom:2px solid var(--color-gray-100)}
.data-table td{padding:10px 14px;border-bottom:1px solid var(--color-gray-50)}
.data-table tr:hover{background:var(--color-gray-50)}
.stock-badge{display:inline-block;padding:3px 10px;border-radius:8px;font-size:13px;font-weight:700}
.stock-badge.ok{background:color-mix(in srgb,#22c55e 10%,white);color:#16a34a}
.stock-badge.warning{background:color-mix(in srgb,#f59e0b 10%,white);color:#d97706}
.stock-badge.danger{background:color-mix(in srgb,#ef4444 10%,white);color:#dc2626}
.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.modal-card{background:#fff;border-radius:16px;padding:24px;max-width:520px;width:calc(100% - 32px);box-shadow:0 20px 60px rgba(0,0,0,.15)}
.pending-list{display:flex;flex-direction:column;gap:12px}
.pending-doc-card{border:1px solid var(--color-gray-200);border-left:3px solid #ef4444;border-radius:10px;padding:14px 16px}
.pending-doc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.pending-doc-lines{display:flex;flex-direction:column;gap:4px}
.pending-line{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px;background:var(--color-gray-50);border-radius:6px;font-size:12px}
.pending-line-name{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pending-line-qty{font-weight:700;flex-shrink:0}
.doc-link{display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--color-primary);font-weight:600;font-size:13px;cursor:pointer;padding:0;font-family:inherit;text-decoration:underline;text-underline-offset:2px}
.doc-link:hover{opacity:.7}
.doc-type-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;margin-left:6px}
.doc-type-badge.out{background:color-mix(in srgb,#ef4444 10%,white);color:#ef4444}
.doc-type-badge.in{background:color-mix(in srgb,#22c55e 10%,white);color:#22c55e}
@media(max-width:768px){.kpi-row{grid-template-columns:1fr}.tab-bar{overflow-x:auto}.tab-btn{white-space:nowrap;padding:10px 12px;font-size:12px}}
</style>
