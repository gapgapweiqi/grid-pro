<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/services/api';
	import { companies as companiesStore, currentCompanyId, addToast, setTopbarActions, clearTopbarActions, showDriveConnectModal, isOwner } from '$lib/stores/app';
	import { currentUser } from '$lib/stores/auth';
	import { get } from 'svelte/store';
	import type { Company } from '$lib/types';
	import { Plus, Pencil, Trash2, Building2, Upload, X, ImageIcon, Lock } from 'lucide-svelte';
	import type { BankAccount } from '$lib/types';
	import { formatTaxId, formatPhone } from '$lib/utils/format';
	import { isSandbox, SANDBOX_LOGO_URL, SANDBOX_COMPANY_ID } from '$lib/stores/sandbox';
	import SandboxUpgradeDialog from '$lib/components/SandboxUpgradeDialog.svelte';

	const API_BASE = import.meta.env.VITE_API_URL || '';
	let showUpgradeDialog = $state(false);
	let logoUploading = $state(false);

	let localCompanies: Company[] = $state([]);
	let showForm = $state(false);
	let editing: Company | null = $state(null);

	let formName = $state('');
	let formName2 = $state('');
	let formTaxId = $state('');
	let formPhone = $state('');
	let formEmail = $state('');
	let formAddress = $state('');
	let formOfficeType = $state<'none' | 'hq' | 'branch'>('hq');
	let formBranchName = $state('');
	let formBranchNo = $state('');
	let formSignerName = $state('');
	let formSignerTitle = $state('');
	let formLogo = $state('');
	let formBankAccounts: BankAccount[] = $state([]);

	// Drive gate helper
	function requireDriveForUpload(): boolean {
		const u = get(currentUser);
		if (u && !u.driveFolderId) {
			showDriveConnectModal.set(true);
			return false;
		}
		return true;
	}

	// Logo upload → R2
	let logoInputEl: HTMLInputElement;
	async function handleLogoUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 5 * 1024 * 1024) { addToast('ไฟล์ใหญ่เกิน 5MB', 'error'); return; }

		// Resize client-side before upload
		const resized = await resizeImage(file, 400);

		logoUploading = true;
		try {
			const companyId = editing?.entityId || '';
			const url = await uploadImageToR2(resized, companyId, 'logo');
			if (url) formLogo = url;
		} catch {
			addToast('อัปโหลดโลโก้ไม่สำเร็จ', 'error');
		}
		logoUploading = false;
	}

	function resizeImage(file: File, max: number): Promise<Blob> {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = (ev) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					let w = img.width, h = img.height;
					if (w > max || h > max) {
						if (w > h) { h = Math.round(h * max / w); w = max; }
						else { w = Math.round(w * max / h); h = max; }
					}
					canvas.width = w; canvas.height = h;
					canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
					canvas.toBlob((blob) => resolve(blob || file), 'image/png');
				};
				img.src = ev.target?.result as string;
			};
			reader.readAsDataURL(file);
		});
	}

	async function uploadImageToR2(blob: Blob, companyId: string, refType: string): Promise<string | null> {
		const token = localStorage.getItem('auth.token');
		const fd = new FormData();
		fd.append('file', blob, `${refType}.png`);
		fd.append('companyId', companyId);
		fd.append('refType', refType);
		const res = await fetch(`${API_BASE}/api/images/upload`, {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${token}` },
			body: fd,
		});
		const json = await res.json();
		if (json.ok) return `${API_BASE}${json.data.url}`;
		addToast(json.error?.message || 'อัปโหลดไม่สำเร็จ', 'error');
		return null;
	}

	// Bank account helpers
	function addBankAccount() {
		formBankAccounts = [...formBankAccounts, { bankName: '', accountName: '', accountNo: '', branch: '', qrCodeImage: '' }];
	}
	function removeBankAccount(index: number) {
		formBankAccounts = formBankAccounts.filter((_, i) => i !== index);
	}

	async function handleBankQrUpload(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			if (file.size > 5 * 1024 * 1024) { addToast('ไฟล์ใหญ่เกิน 5MB', 'error'); return; }
			try {
				const companyId = editing?.entityId || '';
				const url = await uploadImageToR2(file, companyId, 'qr');
				if (url) formBankAccounts[index].qrCodeImage = url;
			} catch {
				addToast('อัปโหลด QR ไม่สำเร็จ', 'error');
			}
		}
	}

	async function refreshCompanies() {
		try {
			const fresh = await api.listCompanies();
			if (fresh.length > 0) {
				localCompanies = fresh;
				companiesStore.set(fresh);
			}
		} catch {}
	}

	onMount(async () => { 
		// Use store data first (populated by bootstrap)
		const storeComps = $companiesStore;
		if (storeComps && storeComps.length > 0) {
			localCompanies = storeComps;
		}
		// Refresh from API
		await refreshCompanies();
		if (get(isOwner) || get(currentUser)?.isAdmin) {
			setTopbarActions([
				{ label: 'เพิ่มบริษัท', icon: Plus, primary: true, onClick: openAdd }
			]);
		}
	});

	onDestroy(() => {
		clearTopbarActions();
	});

	function openAdd() {
		editing = null;
		formName = ''; formName2 = ''; formTaxId = ''; formPhone = ''; formEmail = ''; formAddress = '';
		formOfficeType = 'hq'; formBranchName = 'สำนักงานใหญ่'; formBranchNo = '00000'; formSignerName = ''; formSignerTitle = '';
		formLogo = $isSandbox ? SANDBOX_LOGO_URL : ''; formBankAccounts = [];
		showForm = true;
	}

	function openEdit(c: Company) {
		editing = c;
		formName = c.name; formName2 = c.name2; formTaxId = c.taxId; formPhone = c.phone; formEmail = c.email; formAddress = c.address;
		const ot = c.json.officeType as string;
		formOfficeType = ot === 'none' ? 'none' : ot === 'branch' ? 'branch' : ((c.json.isHeadOffice as boolean) === false ? 'branch' : 'hq');
		formBranchName = (c.json.branchName as string) || ''; formBranchNo = (c.json.branchNo as string) || '';
		formSignerName = (c.json.signerName as string) || ''; formSignerTitle = (c.json.signerTitle as string) || '';
		formLogo = (c.json.logo as string) || '';
		formBankAccounts = (c.json.bankAccounts as BankAccount[] || []).map(b => ({ ...b }));
		showForm = true;
	}

	async function save() {
		if (!formName.trim()) { addToast('กรุณากรอกชื่อบริษัท', 'error'); return; }
		const saveLogo = $isSandbox ? SANDBOX_LOGO_URL : formLogo;
		const payload = {
			companyId: editing ? editing.entityId : '',
			...(editing ? { entityId: editing.entityId } : {}),
			name: formName, name2: formName2, taxId: formTaxId, phone: formPhone, email: formEmail, address: formAddress,
			json: { officeType: formOfficeType, isHeadOffice: formOfficeType === 'hq', branchName: formOfficeType === 'hq' ? 'สำนักงานใหญ่' : formOfficeType === 'branch' ? formBranchName : '', branchNo: formOfficeType === 'hq' ? '00000' : formOfficeType === 'branch' ? formBranchNo : '', signerName: formSignerName, signerTitle: formSignerTitle, vatRegistered: true, logo: saveLogo, bankAccounts: formBankAccounts.filter(b => b.bankName || b.accountNo) }
		};
		const result = await api.upsertCompany(payload);
		if (result.ok) {
			await refreshCompanies();
			if (localCompanies.length === 1) currentCompanyId.set(localCompanies[0].entityId);
			if (!editing && result.data?.entityId && !$currentCompanyId) {
				currentCompanyId.set(result.data.entityId);
			}
			addToast(editing ? 'แก้ไขบริษัทเรียบร้อย' : 'เพิ่มบริษัทเรียบร้อย', 'success');
		} else { addToast('เกิดข้อผิดพลาด', 'error'); }
		showForm = false;
	}

	async function deleteCompany(id: string) {
		if ($isSandbox && id === SANDBOX_COMPANY_ID) { showUpgradeDialog = true; return; }
		if (!confirm('ลบบริษัทนี้?')) return;
		await api.deleteCompanies([id]);
		await refreshCompanies();
		addToast('ลบเรียบร้อย', 'success');
	}
</script>

{#if localCompanies.length === 0}
	<div class="empty-state">
		<div class="empty-state-icon" style="background: none;">
			<Building2 size={56} strokeWidth={1} color="var(--color-gray-300)" />
		</div>
		<div class="empty-state-title">ยังไม่มีบริษัท</div>
		<div class="empty-state-text">กดปุ่ม "เพิ่มบริษัท" เพื่อเริ่มต้น</div>
	</div>
{:else}
	<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px;" data-tour="company-list">
		{#each localCompanies as company (company.entityId)}
			<div class="card">
				<div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
					<div style="width: 48px; height: 48px; background: var(--color-primary-soft); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;">
						{#if company.json.logo}
							<img src={company.json.logo} alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
						{:else}
							<Building2 size={24} color="var(--color-primary)" />
						{/if}
					</div>
					<div style="flex: 1; min-width: 0;">
						<div style="font-weight: 700; font-size: 15px;">{company.name}</div>
						{#if company.name2}<div style="font-size: 12px; color: var(--color-gray-500);">{company.name2}</div>{/if}
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						{#if $isSandbox}
							<span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: var(--color-gray-100); color: var(--color-gray-500); border: 1px solid var(--color-gray-200);"><Lock size={10} /> ล็อก</span>
						{/if}
						<button class="btn btn-sm btn-icon btn-outline" onclick={() => openEdit(company)}><Pencil size={14} /></button>
						<button class="btn btn-sm btn-icon btn-outline" onclick={() => deleteCompany(company.entityId)} style="color: var(--color-danger);"><Trash2 size={14} /></button>
					</div>
				</div>
				<div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--color-gray-600);">
					{#if company.taxId}<div>เลขผู้เสียภาษี: <strong>{formatTaxId(company.taxId)}</strong></div>{/if}
					{#if company.json.branchName}<div>สาขา: {company.json.branchName} ({company.json.branchNo})</div>{/if}
					{#if company.phone}<div>โทร: {formatPhone(company.phone)}</div>{/if}
					{#if company.email}<div>อีเมล: {company.email}</div>{/if}
					{#if company.address}<div style="margin-top: 4px; line-height: 1.4;">{company.address}</div>{/if}
					{#if company.json.bankAccounts && (company.json.bankAccounts as any[]).length > 0}
						<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--color-gray-100);">
							{#each company.json.bankAccounts as bank}
								<div style="font-size: 12px; color: var(--color-gray-500);">{(bank as any).bankName} {(bank as any).accountNo}</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if showForm}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay">
		<div class="modal" style="max-width: 680px; max-height: 90vh; overflow: auto;" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header"><div class="modal-title">{editing ? 'แก้ไข' : 'เพิ่ม'}บริษัท</div><button class="btn btn-icon" onclick={() => showForm = false}>&times;</button></div>
			<div class="modal-body">
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<!-- Logo Upload -->
					<div>
						<label class="field-label">โลโก้บริษัท {#if $isSandbox}<span style="display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; background: var(--color-gray-100); color: var(--color-gray-500); border: 1px solid var(--color-gray-200); vertical-align: middle;"><Lock size={8} /> ล็อก</span>{/if}</label>
						<div style="display: flex; align-items: center; gap: 12px;">
							<div style="position: relative;">
								<div style="width: 80px; height: 80px; border: 2px dashed var(--color-gray-300); border-radius: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--color-gray-50);">
									{#if formLogo}
										<img src={formLogo} alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
									{:else}
										{#if $isSandbox}
											<img src={SANDBOX_LOGO_URL} alt="GridPro Logo" style="width: 100%; height: 100%; object-fit: contain;" />
										{:else}
											<ImageIcon size={24} color="var(--color-gray-400)" />
										{/if}
									{/if}
								</div>
								{#if formLogo && !$isSandbox}
									<button type="button" style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; border: none; background: var(--color-danger); color: #fff; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;" onclick={() => formLogo = ''} title="ลบโลโก้">✕</button>
								{/if}
							</div>
							<div>
								{#if $isSandbox}
									<p style="font-size: 11px; color: var(--color-gray-500); margin: 0;">โหมดทดลอง: ใช้โลโก้ GridPro</p>
									<button type="button" class="btn btn-sm btn-outline" style="margin-top: 6px; font-size: 11px; border-color: #2563eb; color: #2563eb;" onclick={() => showUpgradeDialog = true}>
										สมัครเพื่อใช้โลโก้ของคุณเอง
									</button>
								{:else}
									<input type="file" accept="image/*" style="display: none;" bind:this={logoInputEl} onchange={handleLogoUpload} />
									<button type="button" class="btn btn-sm btn-outline" onclick={() => logoInputEl.click()} disabled={logoUploading}>
										{#if logoUploading}
											กำลังอัปโหลด...
										{:else}
											<Upload size={14} /> เลือกรูปภาพ
										{/if}
									</button>
									<p style="font-size: 11px; color: var(--color-gray-400); margin-top: 4px;">JPG, PNG (แนะนำ 200×200px)</p>
								{/if}
							</div>
						</div>
					</div>

					<div><label class="field-label">ชื่อบริษัท (TH) *</label><input class="field-control" bind:value={formName} /></div>
					<div><label class="field-label">ชื่อบริษัท (EN)</label><input class="field-control" bind:value={formName2} /></div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
						<div><label class="field-label">เลขผู้เสียภาษี</label><input class="field-control" bind:value={formTaxId} /></div>
						<div><label class="field-label">โทรศัพท์</label><input class="field-control" bind:value={formPhone} /></div>
					</div>
					<div><label class="field-label">อีเมล</label><input class="field-control" bind:value={formEmail} type="email" /></div>
					<div>
						<label class="field-label">ประเภทสำนักงาน</label>
						<div style="display: flex; align-items: center; gap: 16px; margin-top: 4px;">
							<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
								<input type="radio" name="branchType" value="none" checked={formOfficeType === 'none'} onchange={() => { formOfficeType = 'none'; formBranchName = ''; formBranchNo = ''; }} />
								ไม่ระบุ
							</label>
							<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
								<input type="radio" name="branchType" value="hq" checked={formOfficeType === 'hq'} onchange={() => { formOfficeType = 'hq'; formBranchName = 'สำนักงานใหญ่'; formBranchNo = '00000'; }} />
								สำนักงานใหญ่
							</label>
							<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
								<input type="radio" name="branchType" value="branch" checked={formOfficeType === 'branch'} onchange={() => { formOfficeType = 'branch'; formBranchName = ''; formBranchNo = ''; }} />
								สาขา
							</label>
						</div>
						{#if formOfficeType === 'branch'}
							<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-top: 8px;">
								<div><label class="field-label" style="font-size: 11px;">ชื่อสาขา</label><input class="field-control" bind:value={formBranchName} placeholder="เช่น สาขาลาดพร้าว" /></div>
								<div><label class="field-label" style="font-size: 11px;">รหัสสาขา</label><input class="field-control" bind:value={formBranchNo} placeholder="00001" /></div>
							</div>
						{/if}
					</div>
					<div><label class="field-label">ที่อยู่</label><textarea class="field-control" bind:value={formAddress} rows="3"></textarea></div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
						<div><label class="field-label">ชื่อผู้ลงนาม</label><input class="field-control" bind:value={formSignerName} /></div>
						<div><label class="field-label">ตำแหน่งผู้ลงนาม</label><input class="field-control" bind:value={formSignerTitle} /></div>
					</div>

					<!-- Bank Accounts -->
					<div style="border-top: 1px solid var(--color-gray-200); padding-top: 12px; margin-top: 4px;">
						<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
							<label class="field-label" style="margin: 0; font-weight: 700;">ข้อมูลธนาคาร</label>
							<button type="button" class="btn btn-sm btn-outline" onclick={addBankAccount}><Plus size={14} /> เพิ่มบัญชี</button>
						</div>
						{#if formBankAccounts.length === 0}
							<div style="text-align: center; padding: 16px; color: var(--color-gray-400); font-size: 13px; border: 1px dashed var(--color-gray-200); border-radius: 8px;">
								ยังไม่มีบัญชีธนาคาร
							</div>
						{:else}
							{#each formBankAccounts as bank, i}
								<div style="border: 1px solid var(--color-gray-200); border-radius: 8px; padding: 12px; margin-bottom: 8px; position: relative;">
									<button type="button" style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 2px;" onclick={() => removeBankAccount(i)} title="ลบบัญชี">
										<X size={14} />
									</button>
									<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
										<div><label class="field-label" style="font-size: 11px;">ชื่อธนาคาร</label><input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={bank.bankName} placeholder="เช่น ธ.กสิกรไทย" /></div>
										<div><label class="field-label" style="font-size: 11px;">สาขา</label><input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={bank.branch} placeholder="สาขา" /></div>
										<div><label class="field-label" style="font-size: 11px;">เลขบัญชี</label><input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={bank.accountNo} placeholder="XXX-X-XXXXX-X" /></div>
										<div><label class="field-label" style="font-size: 11px;">ชื่อบัญชี</label><input class="field-control" style="font-size: 12px; padding: 6px 8px;" bind:value={bank.accountName} placeholder="ชื่อเจ้าของบัญชี" /></div>
									</div>
									<div style="margin-top: 8px;">
										<label class="field-label" style="font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
											<span>QR Code รับเงิน (ทางเลือก)</span>
											{#if bank.qrCodeImage}
												<button type="button" class="btn btn-sm btn-outline" style="padding: 2px 6px; font-size: 10px; color: var(--color-danger); border-color: var(--color-danger);" onclick={() => bank.qrCodeImage = ''}>
													ลบรูป
												</button>
											{/if}
										</label>
										{#if bank.qrCodeImage}
											<div style="margin-bottom: 8px; max-width: 120px;">
												<img src={bank.qrCodeImage} alt="QR Code" style="width: 100%; border: 1px solid var(--color-gray-200); border-radius: 4px; object-fit: contain;" />
											</div>
										{/if}
										<input type="file" accept="image/png, image/jpeg, image/jpg" class="field-control" style="font-size: 12px; padding: 6px 8px;" onchange={(e) => handleBankQrUpload(e, i)} />
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
			<div class="modal-footer"><button class="btn btn-outline" onclick={() => showForm = false}>ยกเลิก</button><button class="btn btn-primary" onclick={save}>บันทึก</button></div>
		</div>
	</div>
{/if}

<SandboxUpgradeDialog
	bind:show={showUpgradeDialog}
	message="ข้อมูลบริษัทในโหมดทดลองไม่สามารถแก้ไขได้ สมัครใช้งานจริงเพื่อจัดการบริษัทของคุณเอง"
	onclose={() => showUpgradeDialog = false}
/>
