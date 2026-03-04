<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/services/api';
	import { currentCompanyId, activeCompanyIds, addToast, setTopbarActions, clearTopbarActions } from '$lib/stores/app';
	import type { Salesperson } from '$lib/types';
	import { Plus, Search, Trash2, Upload, Download, Pencil, UserRound } from 'lucide-svelte';
	import { exportCsv, parseCsv, readFileAsText, SALESPERSON_CSV_COLUMNS } from '$lib/utils/csv';

	let salespersons: Salesperson[] = $state([]);
	let fileInput: HTMLInputElement;
	let searchQuery = $state('');
	let selectedIds: Set<string> = $state(new Set());
	let showForm = $state(false);
	let editing: Salesperson | null = $state(null);
	let formName = $state('');
	let formPhone = $state('');
	let formEmail = $state('');
	let formPosition = $state('');

	let companyUnsubscribe: () => void;

	onMount(async () => {
		companyUnsubscribe = activeCompanyIds.subscribe(async (ids) => {
			const validIds = ids.filter(Boolean);
			if (validIds.length) {
				const results = await Promise.all(validIds.map(id => api.listSalespersons(id)));
				salespersons = results.flat();
			} else {
				salespersons = [];
			}
		});

		setTopbarActions([
			{ label: 'เพิ่มพนักงานขาย', icon: Plus, primary: true, onClick: openAdd }
		]);
	});

	onDestroy(() => {
		if (companyUnsubscribe) companyUnsubscribe();
		clearTopbarActions();
	});

	function filtered() {
		if (!searchQuery.trim()) return salespersons;
		const q = searchQuery.toLowerCase();
		return salespersons.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
	}

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		const f = filtered();
		if (selectedIds.size === f.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(f.map(p => p.entityId));
		}
	}

	function openAdd() { editing = null; formName = ''; formPhone = ''; formEmail = ''; formPosition = ''; showForm = true; }
	function openEdit(s: Salesperson) { editing = s; formName = s.name; formPhone = s.phone; formEmail = s.email; formPosition = (s.json.position as string) || ''; showForm = true; }

	async function save() {
		if (!formName.trim()) { addToast('กรุณากรอกชื่อ', 'error'); return; }
		const companyId = $currentCompanyId || 'comp-001';
		const payload = {
			companyId,
			...(editing ? { entityId: editing.entityId } : {}),
			name: formName, phone: formPhone, email: formEmail,
			json: { position: formPosition }
		};
		const result = await api.upsertSalesperson(payload);
		if (result.ok) {
			salespersons = await api.listSalespersons(companyId);
			addToast(editing ? 'แก้ไขเรียบร้อย' : 'เพิ่มเรียบร้อย', 'success');
		} else { addToast('เกิดข้อผิดพลาด', 'error'); }
		showForm = false;
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		if (!confirm(`ลบ ${selectedIds.size} รายการ?`)) return;
		await api.deleteSalespersons([...selectedIds]);
		salespersons = await api.listSalespersons($currentCompanyId || 'comp-001');
		selectedIds = new Set();
		addToast('ลบเรียบร้อย', 'success');
	}

	async function deleteOne(id: string) {
		if (!confirm('ลบ?')) return;
		await api.deleteSalespersons([id]);
		salespersons = await api.listSalespersons($currentCompanyId || 'comp-001');
		addToast('ลบเรียบร้อย', 'success');
	}

	function handleExport() {
		exportCsv(salespersons, SALESPERSON_CSV_COLUMNS, `salespersons_${new Date().toISOString().substring(0, 10)}.csv`);
		addToast(`ส่งออก ${salespersons.length} รายการ`, 'success');
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		try {
			const text = await readFileAsText(input.files[0]);
			const result = parseCsv(text);
			if (result.errors.length) { addToast(result.errors[0], 'error'); return; }
			const companyId = $currentCompanyId || 'comp-001';
			let added = 0;
			for (const row of result.rows) {
				const name = row['ชื่อ'] || row['name'] || '';
				if (!name.trim()) continue;
				await api.upsertSalesperson({
					companyId, name,
					phone: row['โทรศัพท์'] || '', email: row['อีเมล'] || '',
					json: { position: row['ตำแหน่ง'] || '' }
				});
				added++;
			}
			salespersons = await api.listSalespersons(companyId);
			addToast(`นำเข้า ${added} รายการ`, 'success');
		} catch { addToast('ไม่สามารถอ่านไฟล์ได้', 'error'); }
		input.value = '';
	}
</script>

<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
	<div style="flex: 1; min-width: 200px; position: relative;" data-tour="sp-search">
		<Search size={16} style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-gray-400);" />
		<input class="field-control" placeholder="ค้นหา..." bind:value={searchQuery} style="padding-left: 36px;" />
	</div>
	<button class="btn btn-sm btn-outline" onclick={handleExport}><Download size={14} /> ส่งออก CSV</button>
	<button class="btn btn-sm btn-outline" onclick={() => fileInput.click()}><Upload size={14} /> นำเข้า CSV</button>
	<input type="file" accept=".csv" bind:this={fileInput} onchange={handleImport} style="display: none;" />
</div>

{#if selectedIds.size > 0}
	<div class="floating-bulk-actions">
		<span>เลือกแล้ว {selectedIds.size} รายการ</span>
		<button class="btn btn-danger" onclick={deleteSelected} style="border-radius: 100px; padding: 6px 16px;">
			<Trash2 size={16} /> ลบที่เลือก
		</button>
	</div>
{/if}

{#if filtered().length === 0}
	<div class="empty-state">
		<div class="empty-state-icon" style="background: none;">
			<UserRound size={56} strokeWidth={1} color="var(--color-gray-300)" />
		</div>
		<div class="empty-state-title">ยังไม่มีพนักงานขาย</div>
		<div class="empty-state-text">กดปุ่ม "เพิ่มพนักงานขาย" เพื่อเริ่มต้น</div>
	</div>
{:else}
	<div class="card" style="padding: 0; overflow: auto;" data-tour="sp-table">
		<table class="data-table">
			<thead>
				<tr>
					<th style="width: 40px;"><input type="checkbox" checked={selectedIds.size === filtered().length && filtered().length > 0} onchange={toggleSelectAll} /></th>
					<th>รหัส</th>
					<th>ชื่อ</th>
					<th>ตำแหน่ง</th>
					<th>โทรศัพท์</th>
					<th>อีเมล</th>
					<th style="width: 80px;"></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered() as s (s.entityId)}
					<tr>
						<td style="white-space: nowrap;"><input type="checkbox" checked={selectedIds.has(s.entityId)} onchange={() => toggleSelect(s.entityId)} /></td>
						<td style="color: var(--color-gray-500); font-size: 12px; white-space: nowrap;">{s.code}</td>
						<td style="font-weight: 500; white-space: nowrap;">{s.name}</td>
						<td style="white-space: nowrap;">{s.json.position || '-'}</td>
						<td style="white-space: nowrap;">{s.phone || '-'}</td>
						<td style="font-size: 12px; white-space: nowrap;">{s.email || '-'}</td>
						<td style="white-space: nowrap;">
							<div style="display: flex; gap: 4px;">
								<button class="btn btn-sm btn-icon btn-outline" onclick={() => openEdit(s)}><Pencil size={14} /></button>
								<button class="btn btn-sm btn-icon btn-outline" onclick={() => deleteOne(s.entityId)} style="color: var(--color-danger);"><Trash2 size={14} /></button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if showForm}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header"><div class="modal-title">{editing ? 'แก้ไข' : 'เพิ่ม'}พนักงานขาย</div><button class="btn btn-icon" onclick={() => showForm = false}>&times;</button></div>
			<div class="modal-body">
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<div><label class="field-label" for="formName">ชื่อ *</label><input id="formName" class="field-control" bind:value={formName} /></div>
					<div><label class="field-label" for="formPosition">ตำแหน่ง</label><input id="formPosition" class="field-control" bind:value={formPosition} /></div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
						<div><label class="field-label" for="formPhone">โทรศัพท์</label><input id="formPhone" class="field-control" bind:value={formPhone} /></div>
						<div><label class="field-label" for="formEmail">อีเมล</label><input id="formEmail" class="field-control" bind:value={formEmail} /></div>
					</div>
				</div>
			</div>
			<div class="modal-footer"><button class="btn btn-outline" onclick={() => showForm = false}>ยกเลิก</button><button class="btn btn-primary" onclick={save}>บันทึก</button></div>
		</div>
	</div>
{/if}
