<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/services/api';
	import { currentCompanyId, activeCompanyIds, addToast, setTopbarActions, clearTopbarActions } from '$lib/stores/app';
	import type { Customer } from '$lib/types';
	import { Plus, Search, Trash2, Upload, Download, Pencil, X, Users } from 'lucide-svelte';
	import type { ContactPerson } from '$lib/types';
	import { exportCsv, parseCsv, readFileAsText, CUSTOMER_CSV_COLUMNS } from '$lib/utils/csv';
	import { formatTaxId, formatPhone } from '$lib/utils/format';

	let customers: Customer[] = $state([]);
	let fileInput: HTMLInputElement;
	let searchQuery = $state('');
	let selectedIds: Set<string> = $state(new Set());
	let showForm = $state(false);
	let editingCustomer: Customer | null = $state(null);

	let formCode = $state('');
	let formName = $state('');
	let formName2 = $state('');
	let formTaxId = $state('');
	let formPhone = $state('');
	let formEmail = $state('');
	let formAddress = $state('');
	let formEntitySubType = $state<'customer' | 'vendor'>('customer');
	let formOfficeType = $state<'none' | 'hq' | 'branch'>('none');
	let formBranchName = $state('');
	let formBranchNo = $state('');
	let formContactPersons: ContactPerson[] = $state([]);
	let formCustomFields: Array<{label: string; value: string}> = $state([]);

	function addContactPerson() {
		formContactPersons = [...formContactPersons, { name: '', phone: '', email: '', position: '' }];
	}
	function removeContactPerson(index: number) {
		formContactPersons = formContactPersons.filter((_, i) => i !== index);
	}

	let companyUnsubscribe: () => void;

	onMount(async () => {
		companyUnsubscribe = activeCompanyIds.subscribe(async (ids) => {
			const validIds = ids.filter(Boolean);
			if (validIds.length) {
				const results = await Promise.all(validIds.map(id => api.listCustomers(id)));
				customers = results.flat();
			} else {
				customers = [];
			}
		});

		setTopbarActions([
			{ label: 'เพิ่มลูกค้า/ผู้ขาย', icon: Plus, primary: true, onClick: openAdd }
		]);
	});

	onDestroy(() => {
		if (companyUnsubscribe) companyUnsubscribe();
		clearTopbarActions();
	});

	function filtered(): Customer[] {
		if (!searchQuery.trim()) return customers;
		const q = searchQuery.toLowerCase();
		return customers.filter(c =>
			c.name.toLowerCase().includes(q) ||
			c.code.toLowerCase().includes(q) ||
			c.phone.includes(q) ||
			c.email.toLowerCase().includes(q)
		);
	}

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		const f = filtered();
		selectedIds = selectedIds.size === f.length ? new Set() : new Set(f.map(c => c.entityId));
	}

	function openAdd() {
		editingCustomer = null;
		formEntitySubType = 'customer';
		formCode = ''; formName = ''; formName2 = ''; formTaxId = ''; formPhone = ''; formEmail = ''; formAddress = '';
		formOfficeType = 'none'; formBranchName = ''; formBranchNo = ''; formContactPersons = []; formCustomFields = [];
		showForm = true;
	}

	function openEdit(c: Customer) {
		editingCustomer = c;
		formEntitySubType = (c.json?.entitySubType as 'customer' | 'vendor') || 'customer';
		formCode = c.code; formName = c.name; formName2 = c.name2; formTaxId = c.taxId; formPhone = c.phone; formEmail = c.email; formAddress = c.address;
		const ot = c.json?.officeType as string;
		formOfficeType = ot === 'none' ? 'none' : ot === 'branch' ? 'branch' : ot === 'hq' ? 'hq' : ((c.json?.isHeadOffice as boolean) === true ? 'hq' : 'none');
		formBranchName = (c.json?.branchName as string) || '';
		formBranchNo = (c.json?.branchNo as string) || '';
		formContactPersons = ((c.json?.contactPersons as ContactPerson[]) || []).map(cp => ({ ...cp }));
		formCustomFields = ((c.json?.customFields as Array<{label: string; value: string}>) || []).map(cf => ({ ...cf }));
		showForm = true;
	}

	function addCustomField() {
		if (formCustomFields.length >= 4) return;
		formCustomFields = [...formCustomFields, { label: '', value: '' }];
	}
	function removeCustomField(index: number) {
		formCustomFields = formCustomFields.filter((_, i) => i !== index);
	}

	let formTypeLabel = $derived(formEntitySubType === 'vendor' ? 'ผู้ขาย' : 'ลูกค้า');

	async function saveCustomer() {
		if (!formName.trim()) { addToast(`กรุณากรอกชื่อ${formTypeLabel}`, 'error'); return; }
		const companyId = $currentCompanyId || 'comp-001';
		const codePrefix = formEntitySubType === 'vendor' ? 'V' : 'C';
		const payload = {
			companyId,
			...(editingCustomer ? { entityId: editingCustomer.entityId } : {}),
			code: formCode || `${codePrefix}${String(customers.length + 1).padStart(4, '0')}`,
			name: formName, name2: formName2, taxId: formTaxId, phone: formPhone, email: formEmail, address: formAddress,
			json: {
				entitySubType: formEntitySubType,
				officeType: formOfficeType,
				isHeadOffice: formOfficeType === 'hq',
				branchName: formOfficeType === 'branch' ? formBranchName : '',
				branchNo: formOfficeType === 'branch' ? formBranchNo : '',
				contactPersons: formContactPersons.filter(cp => cp.name.trim()),
				customFields: formCustomFields.filter(cf => cf.label.trim())
			}
		};
		const result = await api.upsertCustomer(payload);
		if (result.ok) {
			customers = await api.listCustomers(companyId);
			addToast(editingCustomer ? `แก้ไข${formTypeLabel}เรียบร้อย` : `เพิ่ม${formTypeLabel}เรียบร้อย`, 'success');
		} else { addToast('เกิดข้อผิดพลาด', 'error'); }
		showForm = false;
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		if (!confirm(`ลบ ${selectedIds.size} รายการ?`)) return;
		await api.deleteCustomers([...selectedIds]);
		customers = await api.listCustomers($currentCompanyId || 'comp-001');
		selectedIds = new Set();
		addToast('ลบเรียบร้อย', 'success');
	}

	async function deleteOne(id: string) {
		if (!confirm('ลบรายการนี้?')) return;
		await api.deleteCustomers([id]);
		customers = await api.listCustomers($currentCompanyId || 'comp-001');
		addToast('ลบเรียบร้อย', 'success');
	}

	function handleExport() {
		exportCsv(customers, CUSTOMER_CSV_COLUMNS, `customers_${new Date().toISOString().substring(0, 10)}.csv`);
		addToast(`ส่งออก ${customers.length} รายการ`, 'success');
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
				const name = row['ชื่อลูกค้า'] || row['name'] || '';
				if (!name.trim()) continue;
				await api.upsertCustomer({
					companyId,
					code: row['รหัส'] || row['code'] || '',
					name, name2: row['ชื่อลูกค้า (EN)'] || '', taxId: row['เลขผู้เสียภาษี'] || '',
					phone: row['โทรศัพท์'] || '', email: row['อีเมล'] || '', address: row['ที่อยู่'] || ''
				});
				added++;
			}
			customers = await api.listCustomers(companyId);
			addToast(`นำเข้า ${added} รายการ`, 'success');
		} catch { addToast('ไม่สามารถอ่านไฟล์ได้', 'error'); }
		input.value = '';
	}
</script>

<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
	<div style="flex: 1; min-width: 200px; position: relative;" data-tour="customer-search">
		<Search size={16} style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-gray-400);" />
		<input class="field-control" type="text" placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร, อีเมล..." bind:value={searchQuery} style="padding-left: 36px;" />
	</div>
	<button class="btn btn-sm btn-outline" onclick={handleExport} data-tour="customer-csv"><Download size={14} /> ส่งออก CSV</button>
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
			<Users size={56} strokeWidth={1} color="var(--color-gray-300)" />
		</div>
		<div class="empty-state-title">ยังไม่มีลูกค้า</div>
		<div class="empty-state-text">กดปุ่ม "เพิ่มลูกค้า" เพื่อเริ่มต้น</div>
	</div>
{:else}
	<div class="card" style="padding: 0; overflow: auto;" data-tour="customer-table">
		<table class="data-table">
			<thead>
				<tr>
					<th style="width: 40px;"><input type="checkbox" checked={selectedIds.size === filtered().length && filtered().length > 0} onchange={toggleSelectAll} /></th>
					<th>รหัส</th>
					<th style="width: 70px;">ประเภท</th>
					<th>ชื่อ</th>
					<th>เลขผู้เสียภาษี</th>
					<th>โทรศัพท์</th>
					<th>อีเมล</th>
					<th style="width: 80px;"></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered() as c (c.entityId)}
					<tr>
						<td style="white-space: nowrap;"><input type="checkbox" checked={selectedIds.has(c.entityId)} onchange={() => toggleSelect(c.entityId)} /></td>
						<td style="color: var(--color-gray-500); font-size: 12px; white-space: nowrap;">{c.code}</td>
						<td style="white-space: nowrap;">
							{#if (c.json?.entitySubType as string) === 'vendor'}
								<span class="badge badge-purple" style="font-size: 10px;">ผู้ขาย</span>
							{:else}
								<span class="badge badge-blue" style="font-size: 10px;">ลูกค้า</span>
							{/if}
						</td>
						<td style="font-weight: 500; white-space: nowrap;">{c.name}</td>
						<td style="font-size: 12px; white-space: nowrap;">{formatTaxId(c.taxId)}</td>
						<td style="white-space: nowrap;">{formatPhone(c.phone)}</td>
						<td style="font-size: 12px; white-space: nowrap;">{c.email}</td>
						<td style="white-space: nowrap;">
							<div style="display: flex; gap: 4px;">
								<button class="btn btn-sm btn-icon btn-outline" onclick={() => openEdit(c)}><Pencil size={14} /></button>
								<button class="btn btn-sm btn-icon btn-outline" style="color: var(--color-danger);" onclick={() => deleteOne(c.entityId)}><Trash2 size={14} /></button>
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
			<div class="modal-header">
				<div class="modal-title">{editingCustomer ? `แก้ไข${formTypeLabel}` : `เพิ่ม${formTypeLabel}`}</div>
				<button class="btn btn-icon" onclick={() => showForm = false}>&times;</button>
			</div>
			<div class="modal-body">
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<!-- Entity Sub Type -->
					<div>
						<span class="field-label">ประเภท</span>
						<div style="display: flex; align-items: center; gap: 16px; margin-top: 4px;">
							<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
								<input type="radio" name="entitySubType" value="customer" checked={formEntitySubType === 'customer'} onchange={() => { formEntitySubType = 'customer'; }} />
								ลูกค้า
							</label>
							<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
								<input type="radio" name="entitySubType" value="vendor" checked={formEntitySubType === 'vendor'} onchange={() => { formEntitySubType = 'vendor'; }} />
								ผู้ขาย
							</label>
						</div>
					</div>
					<div><label class="field-label" for="formCode">รหัส</label><input id="formCode" class="field-control" bind:value={formCode} placeholder="อัตโนมัติ" /></div>
					<div><label class="field-label" for="formName">ชื่อ{formTypeLabel} *</label><input id="formName" class="field-control" bind:value={formName} /></div>
					<div><label class="field-label" for="formName2">ชื่อ (EN)</label><input id="formName2" class="field-control" bind:value={formName2} /></div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
						<div><label class="field-label" for="formTaxId">เลขผู้เสียภาษี</label><input id="formTaxId" class="field-control" bind:value={formTaxId} /></div>
						<div><label class="field-label" for="formPhone">โทรศัพท์</label><input id="formPhone" class="field-control" bind:value={formPhone} /></div>
					</div>
					<div><label class="field-label" for="formEmail">อีเมล</label><input id="formEmail" class="field-control" bind:value={formEmail} type="email" /></div>
					<div><label class="field-label" for="formAddress">ที่อยู่</label><textarea id="formAddress" class="field-control" bind:value={formAddress} rows="3"></textarea></div>

					<!-- HQ / Branch Radio -->
					<div>
						<span class="field-label">ประเภทสำนักงาน</span>
						<div style="display: flex; align-items: center; gap: 16px; margin-top: 4px;">
						<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
							<input type="radio" name="custBranchType" value="none" checked={formOfficeType === 'none'} onchange={() => { formOfficeType = 'none'; formBranchName = ''; formBranchNo = ''; }} />
							ไม่ระบุ
						</label>
						<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
							<input type="radio" name="custBranchType" value="hq" checked={formOfficeType === 'hq'} onchange={() => { formOfficeType = 'hq'; formBranchName = ''; formBranchNo = ''; }} />
							สำนักงานใหญ่
						</label>
						<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
							<input type="radio" name="custBranchType" value="branch" checked={formOfficeType === 'branch'} onchange={() => { formOfficeType = 'branch'; formBranchName = ''; formBranchNo = ''; }} />
							สาขา
						</label>
					</div>
					{#if formOfficeType === 'branch'}
						<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-top: 8px;">
							<div><label class="field-label" style="font-size: 11px;" for="formBranchName">ชื่อสาขา</label><input id="formBranchName" class="field-control" bind:value={formBranchName} placeholder="เช่น สาขาลาดพร้าว" /></div>
							<div><label class="field-label" style="font-size: 11px;" for="formBranchNo">รหัสสาขา</label><input id="formBranchNo" class="field-control" bind:value={formBranchNo} placeholder="00001" /></div>
						</div>
					{/if}
					</div>

					<!-- Custom Fields (max 4) -->
					<div style="border-top: 1px solid var(--color-gray-200); padding-top: 12px; margin-top: 4px;">
						<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
							<span class="field-label" style="margin: 0; font-weight: 700;">ข้อมูลเพิ่มเติม</span>
							{#if formCustomFields.length < 4}
								<button type="button" class="btn btn-sm btn-outline" onclick={addCustomField}><Plus size={14} /> เพิ่มข้อมูล</button>
							{/if}
						</div>
						{#if formCustomFields.length === 0}
							<div style="text-align: center; padding: 12px; color: var(--color-gray-400); font-size: 13px; border: 1px dashed var(--color-gray-200); border-radius: 8px;">
								ยังไม่มีข้อมูลเพิ่มเติม (สูงสุด 4 รายการ)
							</div>
						{:else}
							{#each formCustomFields as cf, i}
								<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
									<input class="field-control" style="flex: 1; font-size: 12px; padding: 6px 8px;" bind:value={cf.label} placeholder="หัวข้อ เช่น ยี่ห้อรถ" />
									<span style="color: var(--color-gray-400); font-weight: 600;">:</span>
									<input class="field-control" style="flex: 1; font-size: 12px; padding: 6px 8px;" bind:value={cf.value} placeholder="คำตอบ เช่น ฮอนด้า" />
									<button type="button" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 2px;" onclick={() => removeCustomField(i)} title="ลบ">
										<X size={14} />
									</button>
								</div>
							{/each}
						{/if}
					</div>

					<!-- Contact Persons -->
					<div style="border-top: 1px solid var(--color-gray-200); padding-top: 12px; margin-top: 4px;">
						<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
							<span class="field-label" style="margin: 0; font-weight: 700;">ผู้ติดต่อ</span>
							<button type="button" class="btn btn-sm btn-outline" onclick={addContactPerson}><Plus size={14} /> เพิ่มผู้ติดต่อ</button>
						</div>
						{#if formContactPersons.length === 0}
							<div style="text-align: center; padding: 12px; color: var(--color-gray-400); font-size: 13px; border: 1px dashed var(--color-gray-200); border-radius: 8px;">
								ยังไม่มีผู้ติดต่อ
							</div>
						{:else}
							{#each formContactPersons as cp, i}
								<div style="border: 1px solid var(--color-gray-200); border-radius: 8px; padding: 10px; margin-bottom: 8px; position: relative;">
									<button type="button" style="position: absolute; top: 6px; right: 6px; background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 2px;" onclick={() => removeContactPerson(i)} title="ลบ">
										<X size={14} />
									</button>
									<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
										<div><label class="field-label" style="font-size: 11px;" for="cpName{i}">ชื่อ</label><input id="cpName{i}" class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={cp.name} placeholder="ชื่อ-นามสกุล" /></div>
										<div><label class="field-label" style="font-size: 11px;" for="cpPos{i}">ตำแหน่ง</label><input id="cpPos{i}" class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={cp.position} placeholder="เช่น ผู้จัดการ" /></div>
										<div><label class="field-label" style="font-size: 11px;" for="cpPhone{i}">โทรศัพท์</label><input id="cpPhone{i}" class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={cp.phone} placeholder="0xx-xxx-xxxx" /></div>
										<div><label class="field-label" style="font-size: 11px;" for="cpEmail{i}">อีเมล</label><input id="cpEmail{i}" class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={cp.email} placeholder="email@example.com" /></div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-outline" onclick={() => showForm = false}>ยกเลิก</button>
				<button class="btn btn-primary" onclick={saveCustomer}>บันทึก</button>
			</div>
		</div>
	</div>
{/if}
