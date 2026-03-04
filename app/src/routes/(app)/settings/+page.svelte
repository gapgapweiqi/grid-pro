<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { THEME_OPTIONS, FONT_OPTIONS, DEFAULT_SETTINGS, DOC_TYPES, getDocTitle, getDocConfig } from '$lib/config/constants';
	import { DEFAULT_DOC_NO_SETTINGS } from '$lib/utils/sequence';
	import { currentThemeId, currentFontId, applyTheme, applyFont, addToast, currentCompany, currentCompanyId, companies } from '$lib/stores/app';
	import { Palette, Type, FileText, Save, Layout, Check, Eye } from 'lucide-svelte';
	import { calculateDocument } from '$lib/utils/calc';
	import { BUILT_IN_TEMPLATES, setTemplateForDocType, getTemplateIdForDocType, type DocTemplate } from '$lib/config/templates';
	import DocPreview from '$lib/components/documents/DocPreview.svelte';
	import PreviewModal from '$lib/components/documents/PreviewModal.svelte';
	import { currentUser } from '$lib/stores/auth';
	import { settingsApi } from '$lib/services/api-adapter';
	import { isSandbox } from '$lib/stores/sandbox';

	let activeTab = $state('appearance');

	// Store original values for revert
	let originalTheme = $state($currentThemeId);
	let originalFont = $state($currentFontId);
	
	let docColors = $state(
		DOC_TYPES.reduce((acc, typeInfo) => {
			acc[typeInfo.id] = getDocConfig(typeInfo.id as any).color || '#1e3a8a';
			return acc;
		}, {} as Record<string, string>)
	);

	// Appearance
	let selectedTheme = $state($currentThemeId);
	let selectedFont = $state($currentFontId);

	// Document Number
	let docNoPattern = $state(DEFAULT_DOC_NO_SETTINGS.pattern);
	let docNoDigits = $state(DEFAULT_DOC_NO_SETTINGS.digits);
	let docNoSeparator = $state(DEFAULT_DOC_NO_SETTINGS.separator);

	// Defaults
	let defaultVatRate = $state(DEFAULT_SETTINGS.vatRate);
	let defaultWhtRate = $state(DEFAULT_SETTINGS.whtRate);
	let defaultCurrency = $state(DEFAULT_SETTINGS.currency);
	let defaultDocLang = $state('th');

	// Templates
	let templateAssignments: Record<string, string> = $state({});
	let defaultTemplate = $state('standard');
	let showTemplatePreview = $state(false);
	let previewTemplateId = $state('standard');

	const SAMPLE_LINES = [
		{ name: 'บริการออกแบบเว็บไซต์', description: 'Landing page 5 หน้า', code: 'SVC-001', qty: 1, unit: 'งาน', unitPrice: 15000, lineTotal: 15000 },
		{ name: 'โฮสติ้ง 1 ปี', description: 'Cloud hosting package', code: 'SVC-002', qty: 1, unit: 'ปี', unitPrice: 3600, lineTotal: 3600 },
		{ name: 'โดเมนเนม .com', description: 'จดทะเบียนโดเมน 1 ปี', code: 'SVC-003', qty: 1, unit: 'รายการ', unitPrice: 400, lineTotal: 400 },
	];
	const SAMPLE_CALC = calculateDocument({
		lines: SAMPLE_LINES.map(l => ({ qty: l.qty, unitPrice: l.unitPrice, discountType: '', discountValue: 0 })),
		discountEnabled: false, discountType: 'AMOUNT', discountValue: 0,
		vatEnabled: true, vatRate: 7, vatInclusive: false,
		whtEnabled: false, whtRate: 3,
		customFeeEnabled: false, customFeeAmount: 0
	});
	const SAMPLE_CUSTOMER = { name: 'บริษัท ตัวอย่าง จำกัด', taxId: '0123456789012', address: '123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110', phone: '02-123-4567', email: 'info@example.co.th' };

	onMount(async () => {
		// Store original values when component mounts
		originalTheme = $currentThemeId;
		originalFont = $currentFontId;
		
		// Load document colors from localStorage (as cache)
		if (typeof window !== 'undefined') {
			DOC_TYPES.forEach(typeInfo => {
				const savedColor = localStorage.getItem(`docColor.${typeInfo.id}`);
				if (savedColor) {
					docColors[typeInfo.id] = savedColor;
				}
			});
			// Load template assignments from localStorage cache
			defaultTemplate = localStorage.getItem('docTemplate.default') || 'standard';
			DOC_TYPES.forEach(typeInfo => {
				templateAssignments[typeInfo.id] = getTemplateIdForDocType(typeInfo.id as any);
			});
		}

		// Handle tab query param (?tab=doccolors)
		const url = new URL(window.location.href);
		const tabParam = url.searchParams.get('tab');
		if (tabParam) {
			activeTab = tabParam;
		}

		// Load settings from D1 (overrides localStorage cache)
		await loadSettingsFromServer();
	});

	onDestroy(() => {
		// Revert to original theme if user navigates away without saving
		if (selectedTheme !== originalTheme) {
			applyTheme(originalTheme);
		}
		if (selectedFont !== originalFont) {
			applyFont(originalFont);
		}
	});

	function previewTheme(themeId: string) {
		selectedTheme = themeId;
		// Apply immediately for preview
		applyTheme(themeId);
	}

	function previewFont(fontId: string) {
		selectedFont = fontId;
		// Apply immediately for preview
		applyFont(fontId);
	}

	async function saveAppearance() {
		// Update the "saved" original values
		originalTheme = selectedTheme;
		originalFont = selectedFont;
		applyTheme(selectedTheme);
		applyFont(selectedFont);
		
		// Save to localStorage so it persists across refreshes
		if (typeof window !== 'undefined') {
			localStorage.setItem('ui.theme', selectedTheme);
			localStorage.setItem('ui.font', selectedFont);
		}
		// Persist to D1
		try {
			await settingsApi.save({ 'ui.theme': selectedTheme, 'ui.font': selectedFont });
		} catch { /* localStorage is primary cache */ }
		addToast('บันทึกการตั้งค่าเรียบร้อย', 'success');
	}

	function cancelAppearance() {
		// Revert to original
		selectedTheme = originalTheme;
		selectedFont = originalFont;
		applyTheme(originalTheme);
		applyFont(originalFont);
		
		addToast('ยกเลิกการเปลี่ยนแปลง', 'info');
	}
	
	async function saveDocColors() {
		const entries: Record<string, string> = {};
		if (typeof window !== 'undefined') {
			// Save doc colors to localStorage
			Object.entries(docColors).forEach(([type, color]) => {
				localStorage.setItem(`docColor.${type}`, color);
				entries[`docColor.${type}`] = color;
			});
		}
		// Persist to D1
		try {
			await settingsApi.save(entries);
		} catch { /* localStorage is primary cache */ }
		addToast('บันทึกสีเอกสารเรียบร้อย', 'success');
	}
	
	function cancelDocColors() {
		if (typeof window !== 'undefined') {
			Object.keys(docColors).forEach(typeId => {
				const savedColor = localStorage.getItem(`docColor.${typeId}`);
				if (savedColor) {
					docColors[typeId] = savedColor;
				} else {
					docColors[typeId] = getDocConfig(typeId as any).color || '#1e3a8a';
				}
			});
		}
		addToast('ยกเลิกการเปลี่ยนแปลง', 'info');
	}

	async function saveDocNo() {
		if (typeof window !== 'undefined') {
			localStorage.setItem('docNo.pattern', docNoPattern);
			localStorage.setItem('docNo.digits', String(docNoDigits));
			localStorage.setItem('docNo.separator', docNoSeparator);
		}
		try {
			await settingsApi.save({
				'docNo.pattern': docNoPattern,
				'docNo.digits': String(docNoDigits),
				'docNo.separator': docNoSeparator,
			});
		} catch { /* localStorage is primary cache */ }
		addToast('บันทึกรูปแบบเลขที่เอกสารเรียบร้อย', 'success');
	}

	async function saveDefaults() {
		if (typeof window !== 'undefined') {
			localStorage.setItem('defaults.vatRate', String(defaultVatRate));
			localStorage.setItem('defaults.whtRate', String(defaultWhtRate));
			localStorage.setItem('defaults.currency', defaultCurrency);
			localStorage.setItem('defaults.docLang', defaultDocLang);
		}
		try {
			await settingsApi.save({
				'defaults.vatRate': String(defaultVatRate),
				'defaults.whtRate': String(defaultWhtRate),
				'defaults.currency': defaultCurrency,
				'defaults.docLang': defaultDocLang,
			});
		} catch { /* localStorage is primary cache */ }
		addToast('บันทึกค่าเริ่มต้นเรียบร้อย', 'success');
	}

	async function saveTemplates() {
		if (typeof window !== 'undefined') {
			localStorage.setItem('docTemplate.default', defaultTemplate);
			Object.entries(templateAssignments).forEach(([docType, templateId]) => {
				setTemplateForDocType(docType as any, templateId);
			});
		}
		try {
			const entries: Record<string, string> = { 'template.default': defaultTemplate };
			Object.entries(templateAssignments).forEach(([docType, templateId]) => {
				entries[`template.${docType}`] = templateId;
			});
			await settingsApi.save(entries);
		} catch { /* localStorage is primary cache */ }
		addToast('บันทึกรูปแบบเอกสารเรียบร้อย', 'success');
	}

	// ===== Load settings from D1 =====
	async function loadSettingsFromServer() {
		try {
			const res = await settingsApi.get('USER');
			if (!res.ok || !res.data) return;
			const s = res.data as Record<string, string>;

			// Theme & font
			if (s['ui.theme']) { selectedTheme = s['ui.theme']; originalTheme = s['ui.theme']; applyTheme(s['ui.theme']); localStorage.setItem('ui.theme', s['ui.theme']); }
			if (s['ui.font']) { selectedFont = s['ui.font']; originalFont = s['ui.font']; applyFont(s['ui.font']); localStorage.setItem('ui.font', s['ui.font']); }

			// Doc colors
			DOC_TYPES.forEach(typeInfo => {
				const key = `docColor.${typeInfo.id}`;
				if (s[key]) { docColors[typeInfo.id] = s[key]; localStorage.setItem(key, s[key]); }
			});

			// Doc number format
			if (s['docNo.pattern']) { docNoPattern = s['docNo.pattern']; localStorage.setItem('docNo.pattern', s['docNo.pattern']); }
			if (s['docNo.digits']) { docNoDigits = parseInt(s['docNo.digits'], 10) || DEFAULT_DOC_NO_SETTINGS.digits; localStorage.setItem('docNo.digits', s['docNo.digits']); }
			if (s['docNo.separator']) { docNoSeparator = s['docNo.separator']; localStorage.setItem('docNo.separator', s['docNo.separator']); }

			// Defaults
			if (s['defaults.vatRate']) { defaultVatRate = parseFloat(s['defaults.vatRate']) as any; localStorage.setItem('defaults.vatRate', s['defaults.vatRate']); }
			if (s['defaults.whtRate']) { defaultWhtRate = parseFloat(s['defaults.whtRate']) as any; localStorage.setItem('defaults.whtRate', s['defaults.whtRate']); }
			if (s['defaults.currency']) { defaultCurrency = s['defaults.currency'] as any; localStorage.setItem('defaults.currency', s['defaults.currency']); }
			if (s['defaults.docLang']) { defaultDocLang = s['defaults.docLang']; localStorage.setItem('defaults.docLang', s['defaults.docLang']); }

			// Templates
			if (s['template.default']) { defaultTemplate = s['template.default']; localStorage.setItem('docTemplate.default', s['template.default']); }
			DOC_TYPES.forEach(typeInfo => {
				const key = `template.${typeInfo.id}`;
				if (s[key]) { templateAssignments[typeInfo.id] = s[key]; setTemplateForDocType(typeInfo.id as any, s[key]); }
			});
		} catch {
			// D1 unavailable — use localStorage cache (already loaded)
		}
	}

	const allTabs = [
		{ id: 'appearance', label: 'ธีมและฟอนต์', icon: Palette },
		{ id: 'doccolors', label: 'สีเอกสาร', icon: Palette },
		{ id: 'templates', label: 'รูปแบบเอกสาร', icon: Layout },
		{ id: 'docno', label: 'เลขที่เอกสาร', icon: FileText },
		{ id: 'defaults', label: 'ค่าเริ่มต้น', icon: Save },
	];
	let tabs = $derived.by(() => {
		return allTabs;
	});
</script>

<!-- Tabs -->
<div class="tabs-container" data-tour="settings-tabs">
	{#each tabs as tab}
		{@const Icon = tab.icon}
		<button
			class="settings-tab"
			class:active={activeTab === tab.id}
			onclick={() => { activeTab = tab.id; }}
		>
			<Icon size={16} />
			{tab.label}
		</button>
	{/each}
</div>

<!-- Appearance Tab -->
{#if activeTab === 'appearance'}
	<div class="card" style="max-width: 100%;">
		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">ธีมสีระบบ</h3>
		<div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
			{#each THEME_OPTIONS as theme}
				<button
					class="theme-option"
					class:selected={selectedTheme === theme.id}
					onclick={() => previewTheme(theme.id)}
					style="--theme-color: {theme.value};"
				>
					<div class="theme-swatch"></div>
					<span>{theme.label}</span>
				</button>
			{/each}
		</div>

		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">ฟอนต์เอกสาร</h3>
		<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 32px;">
			{#each FONT_OPTIONS as font}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<label class="font-option" class:selected={selectedFont === font.id}>
					<input type="radio" name="font" value={font.id} bind:group={selectedFont} onchange={() => previewFont(font.id)} />
					<span style="font-family: {font.css};">{font.label}</span>
					<span style="font-family: {font.css}; color: var(--color-gray-400); font-size: 12px;">กรุงเทพมหานคร 123,456.78</span>
				</label>
			{/each}
		</div>

		<div style="display: flex; gap: 8px; position: sticky; bottom: 16px; background: white; padding: 16px 0; border-top: 1px solid var(--color-gray-100);">
			<button class="btn btn-primary" onclick={saveAppearance}><Save size={16} /> บันทึกการตั้งค่า</button>
			<button class="btn btn-outline" onclick={cancelAppearance}>ยกเลิก / คืนค่า</button>
		</div>
	</div>
{/if}

<!-- Doc Colors Tab -->
{#if activeTab === 'doccolors'}
	<div class="card" style="max-width: 100%;">
		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">สีเอกสารแต่ละประเภท</h3>
		<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
			{#each DOC_TYPES as typeInfo}
				<div class="doc-color-card">
					<div class="doc-color-header">
						<div>
							<div style="font-weight: 600; font-size: 14px; color: var(--color-gray-900);">{getDocTitle('th', typeInfo.id as any)}</div>
							<div style="font-size: 11px; color: var(--color-gray-500);">{getDocConfig(typeInfo.id as any).nameEN || typeInfo.id}</div>
						</div>
						<input type="color" class="doc-color-picker" bind:value={docColors[typeInfo.id]} />
					</div>
					
					<div class="doc-color-preview" style="--doc-color: {docColors[typeInfo.id]};">
						<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
							<div>
								<div style="font-weight: 700; font-size: 13px; color: var(--doc-color);">{$currentCompany?.name || 'บริษัท ตัวอย่าง จำกัด'}</div>
								<div style="font-size: 9px; color: var(--color-gray-400);">ที่อยู่บริษัท | โทร: 0XX-XXX-XXXX</div>
							</div>
							<div style="text-align: right;">
								<div style="font-weight: 700; font-size: 14px; color: var(--doc-color);">{getDocTitle('th', typeInfo.id as any)}</div>
								<div style="font-size: 9px; color: var(--color-gray-400);">{getDocConfig(typeInfo.id as any).nameEN || typeInfo.id}</div>
							</div>
						</div>
						
						<div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 9px;">
							<div style="color: var(--color-gray-500);">
								<u style="color: var(--color-gray-400);">ลูกค้า</u><br>
								<b style="font-size: 10px; color: var(--color-gray-700);">บริษัท ลูกค้า จำกัด</b><br>
								ที่อยู่ลูกค้า
							</div>
							<table style="border-collapse: collapse;">
								<tbody>
									<tr><td style="color: var(--doc-color); font-weight: 600; padding-right: 8px;">เลขที่</td><td style="font-weight: 600; color: var(--color-gray-700);">{typeInfo.id}6902-0001</td></tr>
									<tr><td style="color: var(--doc-color); font-weight: 600; padding-right: 8px;">วันที่</td><td style="font-weight: 600; color: var(--color-gray-700);">18 ก.พ. 2569</td></tr>
								</tbody>
							</table>
						</div>
						
						<div style="background: color-mix(in srgb, var(--doc-color) 10%, white); color: var(--doc-color); padding: 4px 8px; font-size: 10px; font-weight: 600; border: 1px solid var(--color-gray-200); border-bottom: none;">
							รายการสินค้า / บริการ
						</div>
						
						<table style="width: 100%; font-size: 9px; border-collapse: collapse; border: 1px solid var(--color-gray-200);">
							<thead>
								<tr style="background: var(--color-gray-50);">
									<th style="padding: 3px 4px; text-align: left; border-bottom: 1px solid var(--color-gray-200); color: var(--color-gray-600);">#</th>
									<th style="padding: 3px 4px; text-align: left; border-bottom: 1px solid var(--color-gray-200); color: var(--color-gray-600);">รายการ</th>
									<th style="padding: 3px 4px; text-align: right; border-bottom: 1px solid var(--color-gray-200); color: var(--color-gray-600);">รวม</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td style="padding: 3px 4px; border-bottom: 1px solid var(--color-gray-100); color: var(--color-gray-600);">1</td>
									<td style="padding: 3px 4px; border-bottom: 1px solid var(--color-gray-100); color: var(--color-gray-700);">สินค้าตัวอย่าง</td>
									<td style="padding: 3px 4px; text-align: right; border-bottom: 1px solid var(--color-gray-100); font-weight: 600; color: var(--color-gray-700);">350.00</td>
								</tr>
							</tbody>
						</table>
						
						<div style="display: flex; justify-content: flex-end; margin-top: 6px;">
							<table style="font-size: 9px; border-collapse: collapse; width: 120px;">
								<tbody>
									<tr><td style="padding: 2px 0; color: var(--color-gray-500);">รวมเงิน</td><td style="text-align: right; padding: 2px 0; color: var(--color-gray-700);">350.00</td></tr>
									<tr style="background: color-mix(in srgb, var(--doc-color) 10%, white); color: var(--doc-color);">
										<td style="padding: 4px 4px; font-weight: 600;">ยอดสุทธิ</td>
										<td style="text-align: right; padding: 4px 4px; font-weight: 700; font-size: 11px;">350.00</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div style="display: flex; gap: 8px; position: sticky; bottom: 16px; background: white; padding: 16px 0; border-top: 1px solid var(--color-gray-100);">
			<button class="btn btn-primary" onclick={saveDocColors}><Save size={16} /> บันทึกการตั้งค่าสีเอกสาร</button>
			<button class="btn btn-outline" onclick={cancelDocColors}>ยกเลิก / คืนค่า</button>
		</div>
	</div>
{/if}

<!-- Templates Tab -->
{#if activeTab === 'templates'}
	<div class="card" style="max-width: 100%;">
		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">รูปแบบเอกสาร (Template)</h3>
		
		<!-- Default Template -->
		<div style="margin-bottom: 24px;">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label class="field-label">รูปแบบเริ่มต้น (ใช้กับทุกประเภท)</label>
			<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
				{#each BUILT_IN_TEMPLATES as tpl}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="template-card"
						class:selected={defaultTemplate === tpl.id}
						onclick={() => defaultTemplate = tpl.id}
					>
						<div class="template-preview" style="--tpl-color: {tpl.config.colorMode === 'minimal' ? 'var(--color-gray-400)' : 'var(--color-primary)'};">
							<!-- Mini preview illustration -->
							{#if tpl.layout === 'standard'}
								<div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
									<div style="width: 24px; height: 24px; background: var(--tpl-color); border-radius: 4px; opacity: 0.3;"></div>
									<div style="text-align: right;">
										<div style="width: 40px; height: 4px; background: var(--tpl-color); border-radius: 2px; margin-bottom: 3px;"></div>
										<div style="width: 28px; height: 3px; background: var(--color-gray-200); border-radius: 2px; margin-left: auto;"></div>
									</div>
								</div>
							{:else if tpl.layout === 'modern'}
								<div style="height: 6px; background: var(--tpl-color); border-radius: 3px; margin-bottom: 6px;"></div>
								<div style="display: flex; gap: 6px; margin-bottom: 6px;">
									<div style="width: 20px; height: 20px; background: var(--tpl-color); border-radius: 4px; opacity: 0.2;"></div>
									<div style="flex: 1;"><div style="width: 60%; height: 4px; background: var(--color-gray-300); border-radius: 2px;"></div></div>
								</div>
							{:else if tpl.layout === 'minimal'}
								<div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
									<div style="width: 20px; height: 20px; border: 1px solid var(--color-gray-300); border-radius: 4px;"></div>
									<div style="width: 36px; height: 4px; background: var(--color-gray-300); border-radius: 2px; margin-top: 8px;"></div>
								</div>
							{:else}
								<div style="border: 1px solid var(--tpl-color); border-radius: 4px; padding: 4px; margin-bottom: 4px; opacity: 0.5;">
									<div style="width: 30px; height: 3px; background: var(--tpl-color); border-radius: 2px; margin: 0 auto;"></div>
								</div>
							{/if}
							<!-- Table lines -->
							<div style="border-top: 1px solid var(--color-gray-200); padding-top: 4px;">
								{#each [1, 2] as _}
									<div style="height: 3px; background: var(--color-gray-100); border-radius: 2px; margin-bottom: 3px;"></div>
								{/each}
							</div>
						</div>
						<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
							<div class="template-name" style="margin: 0;">{tpl.name}</div>
							<button class="btn btn-sm btn-outline" style="font-size: 11px; padding: 3px 10px; flex-shrink: 0;" onclick={(e) => { e.stopPropagation(); previewTemplateId = tpl.id; showTemplatePreview = true; }}>
								<Eye size={12} /> พรีวิว
							</button>
						</div>
						<div class="template-desc">{tpl.description}</div>
						{#if defaultTemplate === tpl.id}
							<div style="position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; background: var(--color-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
								<Check size={14} color="#fff" />
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Per-DocType Template Assignment -->
		<div style="border-top: 1px solid var(--color-gray-200); padding-top: 20px;">
			<h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">กำหนดรูปแบบตามประเภทเอกสาร</h4>
			<p style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 16px;">สามารถเลือกรูปแบบที่แตกต่างกันสำหรับเอกสารแต่ละประเภท หรือปล่อยว่างเพื่อใช้รูปแบบเริ่มต้น</p>
			<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
				{#each DOC_TYPES as typeInfo}
					<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--color-gray-200); border-radius: 8px;">
						<div style="flex: 1; min-width: 0;">
							<div style="font-weight: 600; font-size: 13px;">{getDocTitle('th', typeInfo.id as any)}</div>
							<div style="font-size: 11px; color: var(--color-gray-400);">{typeInfo.id}</div>
						</div>
						<select class="field-control" style="width: 130px; font-size: 12px; padding: 5px 8px;" bind:value={templateAssignments[typeInfo.id]}>
							{#each BUILT_IN_TEMPLATES as tpl}
								<option value={tpl.id}>{tpl.name}</option>
							{/each}
						</select>
					</div>
				{/each}
			</div>
		</div>

		<div style="display: flex; gap: 8px; position: sticky; bottom: 16px; background: white; padding: 16px 0; border-top: 1px solid var(--color-gray-100); margin-top: 24px;">
			<button class="btn btn-primary" onclick={saveTemplates}><Save size={16} /> บันทึกรูปแบบเอกสาร</button>
		</div>
	</div>
{/if}

<!-- DocNo Tab -->
{#if activeTab === 'docno'}
	<div class="card" style="max-width: 100%;">
		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">รูปแบบเลขที่เอกสาร</h3>
		<div style="display: flex; flex-direction: column; gap: 16px;">
			<div>
				<label class="field-label" for="docNoPattern">รูปแบบวันที่</label>
				<select id="docNoPattern" class="field-control" bind:value={docNoPattern}>
					<option value="A">ปี พ.ศ. 2 หลัก + เดือน (เช่น 6902)</option>
					<option value="B">ปี พ.ศ. 2 หลัก (เช่น 69)</option>
					<option value="C">ปี พ.ศ. 4 หลัก (เช่น 2569)</option>
					<option value="D">ปี ค.ศ. 2 หลัก + เดือน (เช่น 2602)</option>
					<option value="E">ปี ค.ศ. 4 หลัก (เช่น 2026)</option>
				</select>
			</div>
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
				<div>
					<label class="field-label" for="docNoDigits">จำนวนหลักลำดับ</label>
					<input id="docNoDigits" class="field-control" type="number" bind:value={docNoDigits} min="3" max="6" />
				</div>
				<div>
					<label class="field-label" for="docNoSeparator">ตัวคั่น</label>
					<input id="docNoSeparator" class="field-control" bind:value={docNoSeparator} placeholder="เช่น - หรือ /" />
				</div>
			</div>
			<div class="card" style="background: var(--color-gray-50); padding: 12px;">
				<div style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 4px;">ตัวอย่าง</div>
				<div style="font-size: 15px; font-weight: 600; font-family: monospace;">
					INV{docNoPattern === 'A' ? '6902' : docNoPattern === 'B' ? '69' : docNoPattern === 'C' ? '2569' : docNoPattern === 'D' ? '2602' : '2026'}{docNoSeparator}{'0'.repeat(Math.max(docNoDigits - 1, 0))}1
				</div>
			</div>
		</div>
		<div style="margin-top: 20px;">
			<button class="btn btn-primary" onclick={saveDocNo}><Save size={16} /> บันทึก</button>
		</div>
	</div>
{/if}

<!-- Defaults Tab -->
{#if activeTab === 'defaults'}
	<div class="card" style="max-width: 100%;">
		<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">ค่าเริ่มต้น</h3>
		<div style="display: flex; flex-direction: column; gap: 16px;">
			<div>
				<label class="field-label" for="defaultCurrency">สกุลเงิน</label>
				<select id="defaultCurrency" class="field-control" bind:value={defaultCurrency}>
					<option value="THB">THB - บาท</option>
					<option value="USD">USD - ดอลลาร์สหรัฐ</option>
					<option value="EUR">EUR - ยูโร</option>
				</select>
			</div>
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
				<div>
					<label class="field-label" for="defaultVatRate">อัตรา VAT เริ่มต้น (%)</label>
					<input id="defaultVatRate" class="field-control" type="number" bind:value={defaultVatRate} min="0" max="100" />
				</div>
				<div>
					<label class="field-label" for="defaultWhtRate">อัตราหัก ณ ที่จ่ายเริ่มต้น (%)</label>
					<input id="defaultWhtRate" class="field-control" type="number" bind:value={defaultWhtRate} min="0" max="100" />
				</div>
			</div>
			<div style="margin-top: 16px;">
				<label class="field-label" for="defaultDocLang">ภาษาเอกสารเริ่มต้น</label>
				<select id="defaultDocLang" class="field-control" style="width: 160px;" bind:value={defaultDocLang}>
					<option value="th">ไทย</option>
					<option value="en">English</option>
				</select>
			</div>
		</div>
		<div style="margin-top: 20px;">
			<button class="btn btn-primary" onclick={saveDefaults}><Save size={16} /> บันทึก</button>
		</div>
	</div>
{/if}

<!-- Template Preview Modal -->
<PreviewModal
	open={showTemplatePreview}
	title="พรีวิวรูปแบบ: {BUILT_IN_TEMPLATES.find(t => t.id === previewTemplateId)?.name || previewTemplateId}"
	onclose={() => showTemplatePreview = false}
>
	<DocPreview
		docType="INV"
		docNo="INV6802-001"
		docDate="2025-02-15"
		dueDate="2025-03-15"
		company={$currentCompany}
		customer={SAMPLE_CUSTOMER as any}
		lines={SAMPLE_LINES}
		calc={SAMPLE_CALC}
		discountEnabled={false}
		discountType="AMOUNT"
		discountValue={0}
		vatEnabled={true}
		vatRate={7}
		whtEnabled={false}
		whtRate={3}
		signatureEnabled={true}
		notes="ขอบคุณที่ใช้บริการ"
		terms="ชำระภายใน 30 วัน"
		templateId={previewTemplateId}
	/>
</PreviewModal>

<style>
	.tabs-container {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		border-bottom: 2px solid var(--color-gray-200);
		padding-bottom: 0;
		overflow-x: auto;
		white-space: nowrap;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none; /* Firefox */
	}
	
	.tabs-container::-webkit-scrollbar {
		display: none; /* Chrome, Safari and Opera */
	}

	.settings-tab {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--color-gray-500);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.settings-tab:hover {
		color: var(--color-gray-700);
	}

	.settings-tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.theme-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		background: none;
		border: 1px solid var(--color-gray-200);
		border-radius: 12px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s;
		width: 100px;
	}

	.theme-option:hover {
		border-color: var(--theme-color);
		background: color-mix(in srgb, var(--theme-color) 4%, white);
	}

	.theme-option.selected {
		border-color: var(--theme-color);
		background: color-mix(in srgb, var(--theme-color) 8%, white);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-color) 20%, transparent);
	}

	.theme-swatch {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--theme-color);
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
	}

	.theme-option span {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-gray-700);
	}

	.font-option {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px;
		border: 1px solid var(--color-gray-200);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.font-option:hover {
		background: var(--color-gray-50);
	}

	.font-option.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-soft);
	}

	.font-option input[type="radio"] {
		width: 18px;
		height: 18px;
		accent-color: var(--color-primary);
	}

	.font-option span:nth-child(2) {
		font-size: 15px;
		font-weight: 500;
		color: var(--color-gray-900);
		flex: 1;
	}
	
	.doc-color-card {
		border: 1px solid var(--color-gray-200);
		border-radius: 12px;
		padding: 16px;
		background: white;
		box-shadow: 0 1px 3px rgba(0,0,0,0.05);
	}
	
	.doc-color-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}
	
	.doc-color-picker {
		width: 44px;
		height: 44px;
		padding: 4px;
		border: 1px solid var(--color-gray-200);
		border-radius: 8px;
		background: white;
		cursor: pointer;
	}
	
	.doc-color-picker::-webkit-color-swatch-wrapper {
		padding: 0;
	}
	
	.doc-color-picker::-webkit-color-swatch {
		border: none;
		border-radius: 4px;
	}
	
	.doc-color-preview {
		border: 1px solid var(--color-gray-200);
		border-radius: 8px;
		padding: 16px;
		background: white;
		font-family: 'Sarabun', sans-serif;
	}

	.template-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		text-align: left;
		padding: 14px;
		border: 2px solid var(--color-gray-200);
		border-radius: 12px;
		background: #fff;
		cursor: pointer;
		transition: all 0.2s;
	}

	.template-card:hover {
		border-color: var(--color-primary);
		background: var(--color-primary-soft);
	}

	.template-card.selected {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
	}

	.template-preview {
		background: var(--color-gray-50);
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 10px;
		min-height: 60px;
	}

	.template-name {
		font-weight: 700;
		font-size: 14px;
		color: var(--color-gray-900);
		margin-bottom: 2px;
	}

	.template-desc {
		font-size: 11px;
		color: var(--color-gray-500);
		line-height: 1.4;
	}

</style>
