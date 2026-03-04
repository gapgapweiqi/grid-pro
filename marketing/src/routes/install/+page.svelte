<script lang="ts">
	import { onMount } from 'svelte';
	import { Smartphone, Monitor, Tablet, ArrowLeft, ChevronRight, CheckCircle2, AlertTriangle, Zap, Wifi, Bell, Shield, ExternalLink } from 'lucide-svelte';

	const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://app.grid-doc.com';

	type Platform = 'ios' | 'android' | 'mac' | 'windows' | 'chromebook';

	let detectedPlatform = $state<Platform>('ios');
	let activeTab = $state<Platform>('ios');
	let detectedBrowser = $state('');
	let isCorrectBrowser = $state(true);
	let deviceName = $state('');

	onMount(() => {
		const ua = navigator.userAgent.toLowerCase();
		const platform = (navigator as any).userAgentData?.platform?.toLowerCase() || navigator.platform?.toLowerCase() || '';

		// Detect platform
		if (/iphone|ipad|ipod/.test(ua) || (platform.includes('mac') && navigator.maxTouchPoints > 1)) {
			detectedPlatform = 'ios';
			deviceName = /ipad/.test(ua) || (platform.includes('mac') && navigator.maxTouchPoints > 1) ? 'iPad' : 'iPhone';
		} else if (/android/.test(ua)) {
			detectedPlatform = 'android';
			deviceName = /tablet|sm-t|gt-p|nexus 7|nexus 10/.test(ua) ? 'Android Tablet' : 'Android';
		} else if (/cros/.test(ua)) {
			detectedPlatform = 'chromebook';
			deviceName = 'Chromebook';
		} else if (/mac/.test(ua)) {
			detectedPlatform = 'mac';
			deviceName = 'Mac';
		} else {
			detectedPlatform = 'windows';
			deviceName = 'Windows PC';
		}
		activeTab = detectedPlatform;

		// Detect browser
		if (/crios|chrome/.test(ua) && !/edg/.test(ua)) detectedBrowser = 'Chrome';
		else if (/safari/.test(ua) && !/chrome/.test(ua)) detectedBrowser = 'Safari';
		else if (/edg/.test(ua)) detectedBrowser = 'Edge';
		else if (/firefox/.test(ua)) detectedBrowser = 'Firefox';
		else if (/line/.test(ua)) detectedBrowser = 'LINE';
		else if (/fban|fbav/.test(ua)) detectedBrowser = 'Facebook';
		else detectedBrowser = 'Other';

		// Check if correct browser
		if (detectedPlatform === 'ios') {
			isCorrectBrowser = detectedBrowser === 'Safari';
		} else {
			isCorrectBrowser = detectedBrowser === 'Chrome' || detectedBrowser === 'Edge';
		}
	});

	const tabs: { id: Platform; label: string; icon: typeof Smartphone }[] = [
		{ id: 'ios', label: 'iPhone / iPad', icon: Smartphone },
		{ id: 'android', label: 'Android', icon: Smartphone },
		{ id: 'mac', label: 'Mac', icon: Monitor },
		{ id: 'windows', label: 'Windows', icon: Monitor },
		{ id: 'chromebook', label: 'Chromebook', icon: Monitor },
	];

	const benefits = [
		{ icon: Zap, title: 'เปิดเร็วทันใจ', desc: 'เปิดจากหน้าจอหลักได้ทันที ไม่ต้องพิมพ์ URL' },
		{ icon: Wifi, title: 'ใช้งานออฟไลน์', desc: 'ดูเอกสารได้แม้ไม่มีเน็ต ข้อมูลจะ sync อัตโนมัติ' },
		{ icon: Bell, title: 'รับแจ้งเตือน', desc: 'ไม่พลาดทุกเอกสารใหม่และอัปเดตสำคัญ' },
		{ icon: Shield, title: 'ปลอดภัย 100%', desc: 'ไม่ต้องดาวน์โหลดไฟล์ ไม่มีไวรัส ปลอดภัยเท่าเว็บ' },
	];

	function getBrowserWarning(tab: Platform): { show: boolean; msg: string; fix: string } {
		if (tab !== detectedPlatform) return { show: false, msg: '', fix: '' };
		if (isCorrectBrowser) return { show: false, msg: '', fix: '' };
		if (tab === 'ios') {
			return {
				show: true,
				msg: `คุณกำลังใช้ ${detectedBrowser} อยู่ — iOS ต้องใช้ Safari เท่านั้นจึงจะติดตั้งได้`,
				fix: 'คัดลอก URL นี้แล้วเปิดใน Safari: app.grid-doc.com'
			};
		}
		return {
			show: true,
			msg: `คุณกำลังใช้ ${detectedBrowser} — แนะนำให้ใช้ Chrome หรือ Edge เพื่อติดตั้ง`,
			fix: 'เปิด Chrome แล้วไปที่ app.grid-doc.com'
		};
	}
</script>

<svelte:head>
	<title>วิธีติดตั้ง Grid Doc เป็นแอป - คู่มือแบบละเอียด</title>
	<meta name="description" content="คู่มือติดตั้ง Grid Doc เป็นแอป PWA แบบละเอียดทุกขั้นตอน สำหรับ iPhone, iPad, Android, Mac, Windows และ Chromebook พร้อมภาพประกอบ" />
</svelte:head>

<div class="inst">
	<div class="inst-container">
		<a href="/download" class="inst-back"><ArrowLeft size={16} /> กลับหน้าดาวน์โหลด</a>

		<!-- Hero -->
		<div class="inst-hero">
			<div class="inst-hero-badge">PWA Install Guide</div>
			<h1>ติดตั้ง Grid Doc เป็นแอป</h1>
			<p>ใช้เวลาไม่ถึง 30 วินาที ไม่ต้องดาวน์โหลดจาก App Store</p>

			{#if deviceName}
				<div class="inst-detected">
					<div class="inst-detected-icon">
						{#if detectedPlatform === 'ios'}
							<Smartphone size={20} />
						{:else if detectedPlatform === 'android'}
							<Smartphone size={20} />
						{:else}
							<Monitor size={20} />
						{/if}
					</div>
					<div>
						<div class="inst-detected-label">ตรวจพบอุปกรณ์ของคุณ</div>
						<div class="inst-detected-device">{deviceName} - {detectedBrowser}</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Benefits -->
		<div class="inst-benefits">
			{#each benefits as b}
				{@const Icon = b.icon}
				<div class="inst-benefit">
					<div class="inst-benefit-icon"><Icon size={18} /></div>
					<div>
						<strong>{b.title}</strong>
						<span>{b.desc}</span>
					</div>
				</div>
			{/each}
		</div>

		<!-- Platform Tabs -->
		<div class="inst-section-title">
			<h2>เลือกอุปกรณ์ของคุณ</h2>
			<p>เลือกแพลตฟอร์มที่ตรงกับอุปกรณ์ที่คุณใช้อยู่ตอนนี้</p>
		</div>

		<div class="inst-tabs">
			{#each tabs as tab}
				{@const Icon = tab.icon}
				<button
					class="inst-tab"
					class:active={activeTab === tab.id}
					class:detected={tab.id === detectedPlatform && activeTab !== tab.id}
					onclick={() => activeTab = tab.id}
				>
					<Icon size={16} />
					<span>{tab.label}</span>
					{#if tab.id === detectedPlatform}
						<span class="inst-tab-badge">อุปกรณ์ของคุณ</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Browser Warning -->
		{#if getBrowserWarning(activeTab).show}
			<div class="inst-warning">
				<div class="inst-warning-header">
					<AlertTriangle size={18} />
					<strong>{getBrowserWarning(activeTab).msg}</strong>
				</div>
				<div class="inst-warning-fix">
					<span>วิธีแก้:</span> {getBrowserWarning(activeTab).fix}
				</div>
			</div>
		{/if}

		<!-- ==================== iOS ==================== -->
		{#if activeTab === 'ios'}
			<div class="inst-platform-header">
				<div class="inst-platform-icon ios-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
				</div>
				<div>
					<h3>สำหรับ iPhone / iPad</h3>
					<p>ต้องใช้ <strong>Safari</strong> เท่านั้น (Chrome, LINE, Facebook จะไม่แสดงตัวเลือกนี้)</p>
				</div>
			</div>

			<div class="inst-req">
				<strong>สิ่งที่ต้องมี:</strong> Safari browser (มาพร้อมเครื่อง) • iOS 14.0 ขึ้นไป
			</div>

			<div class="inst-steps">
				<!-- Step 1 -->
				<div class="inst-step">
					<div class="inst-step-badge">1</div>
					<div class="inst-step-body">
						<h4>เปิด Safari แล้วไปที่เว็บแอป</h4>
						<p>เปิดแอป <strong>Safari</strong> (ไอคอนเข็มทิศสีฟ้า) แล้วพิมพ์ในช่อง URL:</p>
						<div class="inst-url-box">
							<code>app.grid-doc.com</code>
							<span class="inst-url-copy" role="button" tabindex="0">คัดลอก</span>
						</div>
						<div class="inst-mockup ios-mockup">
							<div class="ios-status-bar">
								<span>9:41</span>
								<span class="ios-status-icons">
									<span>&#9679;&#9679;&#9679;&#9679;</span>
									<span>&#9632;</span>
								</span>
							</div>
							<div class="ios-url-bar">
								<div class="ios-url-text">app.grid-doc.com</div>
							</div>
							<div class="ios-content">
								<div class="ios-app-preview">
									<div class="ios-app-logo">GD</div>
									<div class="ios-app-name">Grid Doc</div>
									<div class="ios-app-desc">ระบบออกเอกสารธุรกิจ</div>
								</div>
							</div>
							<div class="ios-bottom-bar">
								<span class="ios-bar-btn">&larr;</span>
								<span class="ios-bar-btn">&rarr;</span>
								<span class="ios-bar-btn ios-share-btn highlight-pulse">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
								</span>
								<span class="ios-bar-btn">&#9783;</span>
								<span class="ios-bar-btn">&#9634;</span>
							</div>
						</div>
						<div class="inst-visual-hint">
							<span class="inst-arrow-down"></span>
							<span>กดปุ่ม <strong>แชร์</strong> ตรงกลางด้านล่าง (สี่เหลี่ยมมีลูกศรชี้ขึ้น)</span>
						</div>
					</div>
				</div>

				<!-- Step 2 -->
				<div class="inst-step">
					<div class="inst-step-badge">2</div>
					<div class="inst-step-body">
						<h4>กดปุ่ม "แชร์" (Share)</h4>
						<p>กดไอคอน <strong>สี่เหลี่ยมมีลูกศรชี้ขึ้น</strong> ที่แถบเครื่องมือด้านล่างของ Safari</p>
						<div class="inst-mockup ios-share-mockup">
							<div class="ios-share-menu">
								<div class="ios-share-handle"></div>
								<div class="ios-share-header">
									<div class="ios-share-site-icon">GD</div>
									<div>
										<div class="ios-share-site-name">Grid Doc</div>
										<div class="ios-share-site-url">app.grid-doc.com</div>
									</div>
								</div>
								<div class="ios-share-actions">
									<div class="ios-share-action-row">
										<div class="ios-share-action-item"><span class="ios-share-action-icon copy-icon">&#128203;</span><span>Copy</span></div>
										<div class="ios-share-action-item"><span class="ios-share-action-icon">&#128172;</span><span>Message</span></div>
										<div class="ios-share-action-item"><span class="ios-share-action-icon">&#9993;</span><span>Mail</span></div>
									</div>
								</div>
								<div class="ios-share-list">
									<div class="ios-share-list-item">
										<span class="ios-share-list-icon">&#128209;</span>
										<span>Add to Reading List</span>
									</div>
									<div class="ios-share-list-item">
										<span class="ios-share-list-icon">&#128278;</span>
										<span>Add Bookmark</span>
									</div>
									<div class="ios-share-list-item highlight-item">
										<span class="ios-share-list-icon">&#10133;</span>
										<span><strong>เพิ่มไปยังหน้าจอหลัก</strong></span>
										<span class="inst-highlight-arrow">&larr; กดตรงนี้!</span>
									</div>
								</div>
							</div>
						</div>
						<div class="inst-tip">
							<strong>ไม่เจอตัวเลือกนี้?</strong> เลื่อนรายการลงด้านล่าง ตัวเลือก "เพิ่มไปยังหน้าจอหลัก" อาจอยู่ด้านล่างสุด
						</div>
					</div>
				</div>

				<!-- Step 3 -->
				<div class="inst-step">
					<div class="inst-step-badge">3</div>
					<div class="inst-step-body">
						<h4>กด "เพิ่มไปยังหน้าจอหลัก"</h4>
						<p>เลื่อนลงในเมนูแชร์ แล้วกดตัวเลือก <strong>"เพิ่มไปยังหน้าจอหลัก"</strong> (Add to Home Screen)</p>
						<div class="inst-mockup ios-add-mockup">
							<div class="ios-add-dialog">
								<div class="ios-add-header">
									<button class="ios-add-cancel">ยกเลิก</button>
									<span class="ios-add-title">เพิ่มไปยังหน้าจอหลัก</span>
									<button class="ios-add-confirm highlight-btn">เพิ่ม</button>
								</div>
								<div class="ios-add-preview">
									<div class="ios-add-icon">GD</div>
									<div class="ios-add-info">
										<div class="ios-add-name">Grid Doc</div>
										<div class="ios-add-url">app.grid-doc.com</div>
									</div>
								</div>
							</div>
						</div>
						<div class="inst-visual-hint">
							<span class="inst-arrow-up"></span>
							<span>กดปุ่ม <strong>"เพิ่ม"</strong> ที่มุมขวาบน</span>
						</div>
					</div>
				</div>

				<!-- Step 4 -->
				<div class="inst-step">
					<div class="inst-step-badge success">
						<CheckCircle2 size={20} />
					</div>
					<div class="inst-step-body">
						<h4>เสร็จแล้ว! เปิดแอปจากหน้าจอหลัก</h4>
						<p>ไอคอน <strong>Grid Doc</strong> จะปรากฏบนหน้าจอหลักของคุณ กดเปิดใช้งานได้ทันที</p>
						<div class="inst-mockup ios-home-mockup">
							<div class="ios-home-grid">
								<div class="ios-home-app"><div class="ios-home-icon gray"></div><span>Photos</span></div>
								<div class="ios-home-app"><div class="ios-home-icon gray"></div><span>Camera</span></div>
								<div class="ios-home-app"><div class="ios-home-icon gray"></div><span>Settings</span></div>
								<div class="ios-home-app highlight-app"><div class="ios-home-icon gd">GD</div><span>Grid Doc</span></div>
							</div>
						</div>
						<div class="inst-success-msg">
							<CheckCircle2 size={18} />
							<span>แอปจะเปิดแบบเต็มจอ ไม่มี URL bar ใช้งานได้เหมือนแอปจริง!</span>
						</div>
					</div>
				</div>
			</div>

		<!-- ==================== Android ==================== -->
		{:else if activeTab === 'android'}
			<div class="inst-platform-header">
				<div class="inst-platform-icon android-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
				</div>
				<div>
					<h3>สำหรับ Android</h3>
					<p>แนะนำใช้ <strong>Google Chrome</strong> (รองรับ Samsung Internet ด้วย)</p>
				</div>
			</div>

			<div class="inst-req">
				<strong>สิ่งที่ต้องมี:</strong> Google Chrome • Android 8.0 ขึ้นไป
			</div>

			<div class="inst-steps">
				<!-- Step 1 -->
				<div class="inst-step">
					<div class="inst-step-badge">1</div>
					<div class="inst-step-body">
						<h4>เปิด Chrome แล้วไปที่เว็บแอป</h4>
						<p>เปิดแอป <strong>Chrome</strong> (ไอคอนวงกลมสีรุ้ง) แล้วพิมพ์:</p>
						<div class="inst-url-box">
							<code>app.grid-doc.com</code>
							<span class="inst-url-copy" role="button" tabindex="0">คัดลอก</span>
						</div>
						<div class="inst-mockup android-mockup">
							<div class="android-status-bar">
								<span>12:00</span>
								<span class="android-status-icons">&#9679; &#9679; &#9632;</span>
							</div>
							<div class="android-url-bar">
								<div class="android-url-text">app.grid-doc.com</div>
								<div class="android-menu highlight-pulse">&#8942;</div>
							</div>
							<div class="android-content">
								<div class="android-app-preview">
									<div class="android-app-logo">GD</div>
									<div class="android-app-name">Grid Doc</div>
								</div>
							</div>
						</div>
						<div class="inst-visual-hint">
							<span class="inst-arrow-up"></span>
							<span>กดจุดสามจุด <strong>&#8942;</strong> ที่มุมขวาบน</span>
						</div>
					</div>
				</div>

				<!-- Step 2 -->
				<div class="inst-step">
					<div class="inst-step-badge">2</div>
					<div class="inst-step-body">
						<h4>กดเมนู &#8942; แล้วเลือก "ติดตั้งแอป"</h4>
						<p>กดจุดสามจุด <strong>&#8942;</strong> ที่มุมขวาบนของ Chrome</p>
						<div class="inst-mockup android-menu-mockup">
							<div class="android-dropdown">
								<div class="android-dropdown-item">New tab</div>
								<div class="android-dropdown-item">New Incognito tab</div>
								<div class="android-dropdown-item">Bookmarks</div>
								<div class="android-dropdown-item highlight-item">
									<span>&#128229; <strong>ติดตั้งแอป</strong></span>
									<span class="inst-highlight-arrow">&larr; กดตรงนี้!</span>
								</div>
								<div class="android-dropdown-item">History</div>
								<div class="android-dropdown-item">Settings</div>
							</div>
						</div>
						<div class="inst-tip">
							<strong>ไม่เห็น "ติดตั้งแอป"?</strong> อาจแสดงเป็น "Add to Home screen" หรือ "เพิ่มลงในหน้าจอหลัก" ลองเลื่อนดูในเมนู
						</div>
					</div>
				</div>

				<!-- Step 3 -->
				<div class="inst-step">
					<div class="inst-step-badge">3</div>
					<div class="inst-step-body">
						<h4>กด "ติดตั้ง" ในป๊อปอัปยืนยัน</h4>
						<p>Chrome จะแสดงหน้าต่างยืนยันการติดตั้ง กดปุ่ม <strong>"ติดตั้ง"</strong></p>
						<div class="inst-mockup android-confirm-mockup">
							<div class="android-dialog">
								<div class="android-dialog-header">ติดตั้งแอปนี้?</div>
								<div class="android-dialog-preview">
									<div class="android-dialog-icon">GD</div>
									<div>
										<div class="android-dialog-name">Grid Doc</div>
										<div class="android-dialog-url">app.grid-doc.com</div>
									</div>
								</div>
								<div class="android-dialog-actions">
									<button class="android-dialog-cancel">ยกเลิก</button>
									<button class="android-dialog-install highlight-btn">ติดตั้ง</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Step 4 -->
				<div class="inst-step">
					<div class="inst-step-badge success">
						<CheckCircle2 size={20} />
					</div>
					<div class="inst-step-body">
						<h4>เสร็จแล้ว! เปิดแอปจากหน้าจอหลัก</h4>
						<p>ไอคอน Grid Doc จะปรากฏบนหน้าจอหลัก เปิดใช้งานได้ทันทีเหมือนแอปจริง</p>
						<div class="inst-mockup android-home-mockup">
							<div class="android-home-grid">
								<div class="android-home-app"><div class="android-home-icon gray"></div><span>Phone</span></div>
								<div class="android-home-app"><div class="android-home-icon gray"></div><span>Messages</span></div>
								<div class="android-home-app"><div class="android-home-icon gray"></div><span>Camera</span></div>
								<div class="android-home-app highlight-app"><div class="android-home-icon gd">GD</div><span>Grid Doc</span></div>
							</div>
						</div>
						<div class="inst-success-msg">
							<CheckCircle2 size={18} />
							<span>แอปจะเปิดแบบเต็มจอ ใช้งานได้เหมือนแอปจริงที่โหลดจาก Play Store!</span>
						</div>
					</div>
				</div>
			</div>

		<!-- ==================== Mac ==================== -->
		{:else if activeTab === 'mac'}
			<div class="inst-platform-header">
				<div class="inst-platform-icon mac-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
				</div>
				<div>
					<h3>สำหรับ macOS</h3>
					<p>รองรับ <strong>Chrome</strong>, <strong>Edge</strong> และ <strong>Safari (macOS Sonoma+)</strong></p>
				</div>
			</div>

			<div class="inst-req">
				<strong>สิ่งที่ต้องมี:</strong> Chrome / Edge / Safari (macOS 14+) • macOS 11 ขึ้นไป
			</div>

			<div class="inst-steps">
				<div class="inst-step">
					<div class="inst-step-badge">1</div>
					<div class="inst-step-body">
						<h4>เปิด Chrome แล้วไปที่เว็บแอป</h4>
						<p>เปิด <strong>Google Chrome</strong> แล้วพิมพ์ในช่อง URL:</p>
						<div class="inst-url-box">
							<code>app.grid-doc.com</code>
							<span class="inst-url-copy" role="button" tabindex="0">คัดลอก</span>
						</div>
					</div>
				</div>

				<div class="inst-step">
					<div class="inst-step-badge">2</div>
					<div class="inst-step-body">
						<h4>กดไอคอนติดตั้งที่แถบ URL</h4>
						<p>มองหาไอคอน <strong>คอมพิวเตอร์มีลูกศรลง</strong> ที่ปลายด้านขวาของแถบ URL</p>
						<div class="inst-mockup desktop-mockup">
							<div class="desktop-titlebar">
								<div class="desktop-dots">
									<span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
								</div>
								<div class="desktop-url-bar">
									<span class="desktop-lock">&#128274;</span>
									<span>app.grid-doc.com</span>
									<span class="desktop-install-icon highlight-pulse" title="ปุ่มติดตั้ง">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="12" y1="10" x2="12" y2="21"/><polyline points="8 17 12 21 16 17"/></svg>
									</span>
								</div>
							</div>
							<div class="desktop-content">
								<div class="desktop-app-preview">
									<div class="desktop-app-logo">GD</div>
									<span>Grid Doc - ระบบออกเอกสารธุรกิจ</span>
								</div>
							</div>
						</div>
						<div class="inst-visual-hint">
							<span class="inst-arrow-up"></span>
							<span>กดไอคอน <strong>ติดตั้ง</strong> ที่มุมขวาของแถบ URL</span>
						</div>
						<div class="inst-tip">
							<strong>ไม่เห็นไอคอน?</strong> กดเมนู <strong>&#8942;</strong> (จุดสามจุด) → <strong>"ติดตั้ง Grid Doc..."</strong><br/>
							หรือถ้าใช้ Safari: กดเมนู <strong>File</strong> → <strong>"Add to Dock"</strong>
						</div>
					</div>
				</div>

				<div class="inst-step">
					<div class="inst-step-badge">3</div>
					<div class="inst-step-body">
						<h4>กด "ติดตั้ง" ในป๊อปอัปยืนยัน</h4>
						<p>Chrome จะแสดงหน้าต่างยืนยัน กดปุ่ม <strong>"Install"</strong></p>
						<div class="inst-mockup desktop-dialog-mockup">
							<div class="desktop-dialog">
								<div class="desktop-dialog-title">Install app?</div>
								<div class="desktop-dialog-preview">
									<div class="desktop-dialog-icon">GD</div>
									<div>
										<div class="desktop-dialog-name">Grid Doc</div>
										<div class="desktop-dialog-url">app.grid-doc.com</div>
									</div>
								</div>
								<div class="desktop-dialog-actions">
									<button class="desktop-dialog-cancel">Cancel</button>
									<button class="desktop-dialog-install highlight-btn">Install</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="inst-step">
					<div class="inst-step-badge success"><CheckCircle2 size={20} /></div>
					<div class="inst-step-body">
						<h4>เสร็จแล้ว! เปิดแอปจาก Launchpad หรือ Dock</h4>
						<p>แอป Grid Doc จะปรากฏใน <strong>Launchpad</strong> และ <strong>Dock</strong> เปิดใช้งานได้ทันที</p>
						<div class="inst-mockup desktop-dock-mockup">
							<div class="mac-dock">
								<div class="dock-app"><div class="dock-icon gray"></div></div>
								<div class="dock-app"><div class="dock-icon gray"></div></div>
								<div class="dock-app"><div class="dock-icon gray"></div></div>
								<div class="dock-app highlight-app"><div class="dock-icon gd">GD</div></div>
								<div class="dock-app"><div class="dock-icon gray"></div></div>
							</div>
						</div>
						<div class="inst-success-msg">
							<CheckCircle2 size={18} />
							<span>แอปจะเปิดในหน้าต่างแยก ใช้งานได้เหมือนแอป Native!</span>
						</div>
					</div>
				</div>
			</div>

		<!-- ==================== Windows ==================== -->
		{:else if activeTab === 'windows'}
			<div class="inst-platform-header">
				<div class="inst-platform-icon win-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 12V6.5l8-1.1V12H3zm0 .5V18l8 1.1V12.5H3zm9 0V12.5l9 .1V21l-9-1.2V12.5zm0-.5h9V3l-9 1.2V12z"/></svg>
				</div>
				<div>
					<h3>สำหรับ Windows</h3>
					<p>แนะนำใช้ <strong>Chrome</strong> หรือ <strong>Microsoft Edge</strong></p>
				</div>
			</div>

			<div class="inst-req">
				<strong>สิ่งที่ต้องมี:</strong> Chrome / Edge • Windows 10 ขึ้นไป
			</div>

			<div class="inst-steps">
				<div class="inst-step">
					<div class="inst-step-badge">1</div>
					<div class="inst-step-body">
						<h4>เปิด Chrome หรือ Edge แล้วไปที่เว็บแอป</h4>
						<p>พิมพ์ในช่อง URL:</p>
						<div class="inst-url-box">
							<code>app.grid-doc.com</code>
							<span class="inst-url-copy" role="button" tabindex="0">คัดลอก</span>
						</div>
					</div>
				</div>
				<div class="inst-step">
					<div class="inst-step-badge">2</div>
					<div class="inst-step-body">
						<h4>กดไอคอนติดตั้งที่แถบ URL</h4>
						<p>มองหาไอคอน <strong>คอมพิวเตอร์มีลูกศรลง</strong> ที่ปลายด้านขวาของแถบ URL</p>
						<div class="inst-mockup desktop-mockup">
							<div class="desktop-titlebar win-titlebar">
								<div class="desktop-url-bar">
									<span class="desktop-lock">&#128274;</span>
									<span>app.grid-doc.com</span>
									<span class="desktop-install-icon highlight-pulse" title="ปุ่มติดตั้ง">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="12" y1="10" x2="12" y2="21"/><polyline points="8 17 12 21 16 17"/></svg>
									</span>
								</div>
								<div class="win-controls">
									<span>&#8212;</span><span>&#9634;</span><span>&#10005;</span>
								</div>
							</div>
							<div class="desktop-content">
								<div class="desktop-app-preview">
									<div class="desktop-app-logo">GD</div>
									<span>Grid Doc - ระบบออกเอกสารธุรกิจ</span>
								</div>
							</div>
						</div>
						<div class="inst-tip">
							<strong>ใช้ Edge?</strong> กดเมนู <strong>&#8943;</strong> → <strong>"แอป"</strong> → <strong>"ติดตั้งไซต์นี้เป็นแอป"</strong>
						</div>
					</div>
				</div>
				<div class="inst-step">
					<div class="inst-step-badge">3</div>
					<div class="inst-step-body">
						<h4>กด "Install" / "ติดตั้ง"</h4>
						<p>กดปุ่ม <strong>"Install"</strong> ในป๊อปอัปยืนยัน แอปจะเปิดในหน้าต่างใหม่ทันที</p>
					</div>
				</div>
				<div class="inst-step">
					<div class="inst-step-badge success"><CheckCircle2 size={20} /></div>
					<div class="inst-step-body">
						<h4>เสร็จแล้ว! เปิดแอปจาก Start Menu หรือ Taskbar</h4>
						<p>แอป Grid Doc จะปรากฏใน <strong>Start Menu</strong> และสามารถปักหมุดที่ <strong>Taskbar</strong> ได้</p>
						<div class="inst-success-msg">
							<CheckCircle2 size={18} />
							<span>แอปจะเปิดในหน้าต่างแยกเหมือนแอป Desktop จริง!</span>
						</div>
					</div>
				</div>
			</div>

		<!-- ==================== Chromebook ==================== -->
		{:else if activeTab === 'chromebook'}
			<div class="inst-platform-header">
				<div class="inst-platform-icon chrome-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4"/></svg>
				</div>
				<div>
					<h3>สำหรับ Chromebook</h3>
					<p>ใช้ <strong>Chrome</strong> (เบราว์เซอร์หลักของ ChromeOS)</p>
				</div>
			</div>

			<div class="inst-req">
				<strong>สิ่งที่ต้องมี:</strong> Chrome (มาพร้อมเครื่อง) • ChromeOS
			</div>

			<div class="inst-steps">
				<div class="inst-step">
					<div class="inst-step-badge">1</div>
					<div class="inst-step-body">
						<h4>เปิด Chrome แล้วไปที่ app.grid-doc.com</h4>
						<div class="inst-url-box">
							<code>app.grid-doc.com</code>
							<span class="inst-url-copy" role="button" tabindex="0">คัดลอก</span>
						</div>
					</div>
				</div>
				<div class="inst-step">
					<div class="inst-step-badge">2</div>
					<div class="inst-step-body">
						<h4>กดไอคอนติดตั้งที่แถบ URL หรือเมนู &#8942;</h4>
						<p>กดไอคอน <strong>คอมพิวเตอร์มีลูกศร</strong> ที่แถบ URL หรือกดเมนู &#8942; → <strong>"ติดตั้ง Grid Doc..."</strong></p>
					</div>
				</div>
				<div class="inst-step">
					<div class="inst-step-badge">3</div>
					<div class="inst-step-body">
						<h4>กด "Install" ในป๊อปอัปยืนยัน</h4>
						<p>กดปุ่ม <strong>"Install"</strong> แล้วรอสักครู่</p>
					</div>
				</div>
				<div class="inst-step">
					<div class="inst-step-badge success"><CheckCircle2 size={20} /></div>
					<div class="inst-step-body">
						<h4>เสร็จแล้ว! เปิดแอปจาก Launcher</h4>
						<p>แอป Grid Doc จะปรากฏใน <strong>Launcher</strong> (แถบด้านล่าง) สามารถปักหมุดไว้ที่ Shelf ได้</p>
						<div class="inst-success-msg">
							<CheckCircle2 size={18} />
							<span>แอปจะเปิดในหน้าต่างแยก ใช้งานเต็มจอได้!</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- CTA -->
		<div class="inst-cta">
			<h3>พร้อมติดตั้งแล้ว?</h3>
			<p>เปิดเว็บแอปแล้วทำตามขั้นตอนด้านบน</p>
			<a href="{APP_ORIGIN}" class="inst-btn">
				<ExternalLink size={16} />
				เปิด app.grid-doc.com
			</a>
		</div>

		<!-- FAQ -->
		<div class="inst-faq">
			<h3>คำถามที่พบบ่อย</h3>
			<details class="inst-faq-item">
				<summary>PWA คืออะไร?</summary>
				<p>PWA (Progressive Web App) คือเว็บแอปที่สามารถติดตั้งลงอุปกรณ์ได้เหมือนแอปทั่วไป แต่ไม่ต้องดาวน์โหลดจาก App Store หรือ Play Store มีขนาดเล็กกว่ามาก อัปเดตอัตโนมัติ และปลอดภัย 100%</p>
			</details>
			<details class="inst-faq-item">
				<summary>ปลอดภัยไหม?</summary>
				<p>ปลอดภัย 100% — PWA ทำงานผ่านเบราว์เซอร์ ไม่ต้องดาวน์โหลดไฟล์ ไม่มีไวรัส และข้อมูลถูกเข้ารหัสด้วย HTTPS เหมือนเว็บไซต์ทั่วไป</p>
			</details>
			<details class="inst-faq-item">
				<summary>ถอนการติดตั้งยังไง?</summary>
				<p><strong>iOS:</strong> กดค้างที่ไอคอน → ลบแอป<br/><strong>Android:</strong> กดค้างที่ไอคอน → ถอนการติดตั้ง<br/><strong>Mac/Windows:</strong> คลิกขวาที่ไอคอนในแอป → ถอนการติดตั้ง</p>
			</details>
			<details class="inst-faq-item">
				<summary>ใช้พื้นที่เก็บข้อมูลเท่าไหร่?</summary>
				<p>น้อยมาก! ประมาณ 5-10 MB เท่านั้น เทียบกับแอปทั่วไปที่ใช้ 50-200 MB</p>
			</details>
		</div>
	</div>
</div>

<style>
	/* ===== Base ===== */
	.inst { --c-green: #1a4731; --c-sage: #3d8b5e; --c-sage-soft: rgba(61,139,94,0.08); --c-border: #eae7e1; --c-text: #1a1a1a; --c-muted: #6b7280; --c-bg: #f8f7f4; --c-warn: #f59e0b; --c-warn-bg: #fffbeb; --c-warn-border: #fde68a; }
	.inst-container { max-width: 720px; margin: 0 auto; padding: 40px 24px 72px; }
	.inst-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--c-muted); text-decoration: none; margin-bottom: 24px; transition: color 0.15s; }
	.inst-back:hover { color: var(--c-green); }

	/* ===== Hero ===== */
	.inst-hero { text-align: center; margin-bottom: 40px; }
	.inst-hero-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; color: var(--c-sage); background: var(--c-sage-soft); margin-bottom: 16px; letter-spacing: 0.5px; text-transform: uppercase; }
	.inst-hero h1 { font-size: 32px; font-weight: 800; color: var(--c-text); margin-bottom: 8px; line-height: 1.3; }
	.inst-hero > p { font-size: 16px; color: var(--c-muted); margin-bottom: 20px; }
	.inst-detected { display: inline-flex; align-items: center; gap: 12px; padding: 12px 20px; border-radius: 12px; background: var(--c-sage-soft); border: 1px solid rgba(61,139,94,0.15); }
	.inst-detected-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--c-sage); color: #fff; display: flex; align-items: center; justify-content: center; }
	.inst-detected-label { font-size: 11px; font-weight: 600; color: var(--c-sage); text-transform: uppercase; letter-spacing: 0.5px; }
	.inst-detected-device { font-size: 15px; font-weight: 700; color: var(--c-text); }

	/* ===== Benefits ===== */
	.inst-benefits { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 48px; }
	.inst-benefit { display: flex; gap: 10px; padding: 14px 16px; border-radius: 12px; background: #fff; border: 1px solid var(--c-border); }
	.inst-benefit-icon { width: 36px; height: 36px; border-radius: 8px; background: var(--c-sage-soft); color: var(--c-sage); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.inst-benefit strong { font-size: 13px; font-weight: 700; color: var(--c-text); display: block; }
	.inst-benefit span { font-size: 11px; color: var(--c-muted); line-height: 1.4; }

	/* ===== Section Title ===== */
	.inst-section-title { text-align: center; margin-bottom: 20px; }
	.inst-section-title h2 { font-size: 22px; font-weight: 800; color: var(--c-text); margin-bottom: 4px; }
	.inst-section-title p { font-size: 14px; color: var(--c-muted); }

	/* ===== Tabs ===== */
	.inst-tabs { display: flex; gap: 8px; justify-content: center; margin-bottom: 32px; flex-wrap: wrap; }
	.inst-tab { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1.5px solid var(--c-border); background: #fff; color: var(--c-muted); cursor: pointer; transition: all 0.15s; font-family: inherit; position: relative; }
	.inst-tab:hover { border-color: var(--c-sage); color: var(--c-sage); }
	.inst-tab.active { background: var(--c-green); color: #fff; border-color: var(--c-green); }
	.inst-tab.detected { border-color: var(--c-sage); }
	.inst-tab-badge { position: absolute; top: -8px; right: -4px; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 8px; background: var(--c-sage); color: #fff; white-space: nowrap; }
	.inst-tab.active .inst-tab-badge { background: #fff; color: var(--c-green); }

	/* ===== Browser Warning ===== */
	.inst-warning { padding: 16px 20px; border-radius: 12px; background: var(--c-warn-bg); border: 1px solid var(--c-warn-border); margin-bottom: 24px; }
	.inst-warning-header { display: flex; align-items: center; gap: 8px; color: #92400e; font-size: 14px; margin-bottom: 6px; }
	.inst-warning-fix { font-size: 13px; color: #78350f; padding-left: 26px; }
	.inst-warning-fix span { font-weight: 700; }

	/* ===== Platform Header ===== */
	.inst-platform-header { display: flex; gap: 14px; align-items: center; padding: 20px; background: #fff; border: 1px solid var(--c-border); border-radius: 14px; margin-bottom: 20px; }
	.inst-platform-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; }
	.ios-icon { background: #1a1a1a; }
	.android-icon { background: #3ddc84; color: #fff; }
	.mac-icon { background: #1a1a1a; }
	.win-icon { background: #0078d4; }
	.chrome-icon { background: #4285f4; }
	.inst-platform-header h3 { font-size: 17px; font-weight: 700; color: var(--c-text); margin-bottom: 2px; }
	.inst-platform-header p { font-size: 13px; color: var(--c-muted); line-height: 1.4; }

	/* ===== Requirements ===== */
	.inst-req { font-size: 12px; color: var(--c-muted); padding: 10px 16px; background: var(--c-bg); border-radius: 8px; margin-bottom: 20px; }

	/* ===== Steps ===== */
	.inst-steps { display: flex; flex-direction: column; gap: 0; margin-bottom: 40px; position: relative; }
	.inst-step { display: flex; gap: 16px; padding: 24px 20px; background: #fff; border: 1px solid var(--c-border); border-radius: 16px; margin-bottom: 12px; position: relative; }
	.inst-step::after { content: ''; position: absolute; left: 38px; bottom: -13px; width: 2px; height: 14px; background: var(--c-border); }
	.inst-step:last-child::after { display: none; }
	.inst-step-badge { width: 36px; height: 36px; border-radius: 50%; background: var(--c-green); color: #fff; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.inst-step-badge.success { background: #16a34a; }
	.inst-step-body { flex: 1; min-width: 0; }
	.inst-step-body h4 { font-size: 16px; font-weight: 700; color: var(--c-text); margin-bottom: 6px; }
	.inst-step-body > p { font-size: 14px; color: var(--c-muted); line-height: 1.6; margin-bottom: 12px; }

	/* ===== URL Box ===== */
	.inst-url-box { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 10px; margin-bottom: 16px; }
	.inst-url-box code { font-size: 15px; font-weight: 700; color: var(--c-green); flex: 1; font-family: 'SF Mono', Monaco, monospace; }
	.inst-url-copy { font-size: 12px; font-weight: 600; color: var(--c-sage); cursor: pointer; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(61,139,94,0.2); background: rgba(61,139,94,0.05); }
	.inst-url-copy:hover { background: rgba(61,139,94,0.12); }

	/* ===== Visual Hints ===== */
	.inst-visual-hint { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--c-sage); font-weight: 600; margin-top: 12px; padding: 8px 12px; background: var(--c-sage-soft); border-radius: 8px; }
	.inst-arrow-down, .inst-arrow-up { width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; flex-shrink: 0; }
	.inst-arrow-down { border-top: 8px solid var(--c-sage); }
	.inst-arrow-up { border-bottom: 8px solid var(--c-sage); }
	.inst-tip { font-size: 12px; color: var(--c-muted); padding: 10px 14px; background: var(--c-bg); border-radius: 8px; margin-top: 10px; line-height: 1.6; border-left: 3px solid var(--c-sage); }
	.inst-success-msg { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #16a34a; font-weight: 600; padding: 12px 16px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0; margin-top: 12px; }

	/* ===== Mockups — Shared ===== */
	.inst-mockup { border-radius: 16px; overflow: hidden; border: 2px solid var(--c-border); margin: 12px 0; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }

	/* ===== Highlight animations ===== */
	.highlight-pulse { animation: pulse-highlight 2s ease-in-out infinite; }
	@keyframes pulse-highlight { 0%, 100% { box-shadow: 0 0 0 0 rgba(61,139,94,0.4); } 50% { box-shadow: 0 0 0 8px rgba(61,139,94,0); } }
	.highlight-item { background: rgba(61,139,94,0.08) !important; border-left: 3px solid var(--c-sage) !important; }
	.inst-highlight-arrow { font-size: 12px; font-weight: 700; color: var(--c-sage); margin-left: auto; }
	.highlight-btn { background: var(--c-sage) !important; color: #fff !important; font-weight: 700 !important; }
	.highlight-app { animation: pulse-scale 2s ease-in-out infinite; }
	@keyframes pulse-scale { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }

	/* ===== iOS Mockups ===== */
	.ios-mockup { max-width: 320px; }
	.ios-status-bar { display: flex; justify-content: space-between; padding: 6px 16px; font-size: 12px; font-weight: 600; color: #1a1a1a; background: #f2f2f7; }
	.ios-url-bar { padding: 6px 16px 8px; background: #f2f2f7; }
	.ios-url-text { padding: 8px 12px; background: #e5e5ea; border-radius: 10px; font-size: 13px; color: #1a1a1a; text-align: center; }
	.ios-content { padding: 32px 20px; background: #fff; text-align: center; min-height: 100px; }
	.ios-app-preview { display: flex; flex-direction: column; align-items: center; gap: 6px; }
	.ios-app-logo { width: 48px; height: 48px; border-radius: 12px; background: var(--c-green); color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; }
	.ios-app-name { font-size: 16px; font-weight: 700; color: var(--c-text); }
	.ios-app-desc { font-size: 12px; color: var(--c-muted); }
	.ios-bottom-bar { display: flex; justify-content: space-around; padding: 10px 16px; background: #f2f2f7; border-top: 1px solid #d1d1d6; }
	.ios-bar-btn { color: #007aff; font-size: 16px; cursor: default; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
	.ios-share-btn { border-radius: 8px; background: rgba(0,122,255,0.08); }
	.ios-share-btn.highlight-pulse { box-shadow: 0 0 0 0 rgba(0,122,255,0.4); animation: pulse-blue 2s ease-in-out infinite; }
	@keyframes pulse-blue { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,122,255,0.4); } 50% { box-shadow: 0 0 0 8px rgba(0,122,255,0); } }

	.ios-share-mockup { max-width: 320px; }
	.ios-share-menu { background: #f2f2f7; border-radius: 14px; overflow: hidden; }
	.ios-share-handle { width: 36px; height: 4px; border-radius: 2px; background: #c7c7cc; margin: 8px auto; }
	.ios-share-header { display: flex; gap: 10px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #d1d1d6; }
	.ios-share-site-icon { width: 32px; height: 32px; border-radius: 8px; background: var(--c-green); color: #fff; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; }
	.ios-share-site-name { font-size: 14px; font-weight: 600; color: var(--c-text); }
	.ios-share-site-url { font-size: 11px; color: var(--c-muted); }
	.ios-share-actions { padding: 12px 16px; border-bottom: 1px solid #d1d1d6; }
	.ios-share-action-row { display: flex; gap: 16px; }
	.ios-share-action-item { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: var(--c-muted); }
	.ios-share-action-icon { width: 40px; height: 40px; border-radius: 10px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; }
	.ios-share-list { padding: 4px 0; }
	.ios-share-list-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; font-size: 14px; color: var(--c-text); border-bottom: 1px solid #e5e5ea; }
	.ios-share-list-icon { font-size: 18px; width: 24px; text-align: center; }

	.ios-add-mockup { max-width: 320px; }
	.ios-add-dialog { background: #f2f2f7; border-radius: 14px; overflow: hidden; }
	.ios-add-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #d1d1d6; }
	.ios-add-cancel { font-size: 14px; color: #007aff; background: none; border: none; cursor: default; font-family: inherit; }
	.ios-add-title { font-size: 15px; font-weight: 600; color: var(--c-text); }
	.ios-add-confirm { font-size: 14px; font-weight: 600; color: #007aff; background: none; border: none; cursor: default; font-family: inherit; padding: 4px 12px; border-radius: 6px; }
	.ios-add-preview { display: flex; gap: 12px; align-items: center; padding: 20px 16px; }
	.ios-add-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--c-green); color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.ios-add-name { font-size: 15px; font-weight: 600; color: var(--c-text); }
	.ios-add-url { font-size: 12px; color: var(--c-muted); }

	.ios-home-mockup { max-width: 320px; }
	.ios-home-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px; text-align: center; }
	.ios-home-app { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: var(--c-text); }
	.ios-home-icon { width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; }
	.ios-home-icon.gray { background: #e5e7eb; }
	.ios-home-icon.gd { background: var(--c-green); color: #fff; }

	/* ===== Android Mockups ===== */
	.android-mockup { max-width: 320px; }
	.android-status-bar { display: flex; justify-content: space-between; padding: 4px 16px; font-size: 11px; color: #1a1a1a; background: #f5f5f5; }
	.android-url-bar { display: flex; align-items: center; padding: 8px 12px; background: #f5f5f5; gap: 8px; }
	.android-url-text { flex: 1; padding: 8px 12px; background: #e8e8e8; border-radius: 20px; font-size: 13px; color: #1a1a1a; }
	.android-menu { font-size: 20px; font-weight: 700; color: #5f6368; cursor: default; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
	.android-menu.highlight-pulse { background: rgba(61,139,94,0.1); color: var(--c-sage); }
	.android-content { padding: 32px 20px; background: #fff; text-align: center; min-height: 80px; }
	.android-app-preview { display: flex; flex-direction: column; align-items: center; gap: 6px; }
	.android-app-logo { width: 48px; height: 48px; border-radius: 12px; background: var(--c-green); color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; }
	.android-app-name { font-size: 16px; font-weight: 700; color: var(--c-text); }

	.android-menu-mockup { max-width: 280px; }
	.android-dropdown { background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); overflow: hidden; }
	.android-dropdown-item { padding: 12px 20px; font-size: 14px; color: var(--c-text); border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }

	.android-confirm-mockup { max-width: 300px; }
	.android-dialog { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
	.android-dialog-header { font-size: 18px; font-weight: 600; color: var(--c-text); margin-bottom: 16px; }
	.android-dialog-preview { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; }
	.android-dialog-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--c-green); color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; }
	.android-dialog-name { font-size: 15px; font-weight: 600; color: var(--c-text); }
	.android-dialog-url { font-size: 12px; color: var(--c-muted); }
	.android-dialog-actions { display: flex; justify-content: flex-end; gap: 12px; }
	.android-dialog-cancel, .android-dialog-install { padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; border: none; cursor: default; font-family: inherit; }
	.android-dialog-cancel { background: none; color: var(--c-muted); }
	.android-dialog-install { background: #1a73e8; color: #fff; }

	.android-home-mockup { max-width: 320px; }
	.android-home-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px; text-align: center; }
	.android-home-app { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: var(--c-text); }
	.android-home-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; }
	.android-home-icon.gray { background: #e5e7eb; }
	.android-home-icon.gd { background: var(--c-green); color: #fff; border-radius: 12px; }

	/* ===== Desktop Mockups ===== */
	.desktop-mockup { max-width: 100%; }
	.desktop-titlebar { display: flex; align-items: center; padding: 8px 12px; background: #f5f5f5; gap: 10px; }
	.desktop-dots { display: flex; gap: 6px; }
	.dot { width: 12px; height: 12px; border-radius: 50%; }
	.dot.red { background: #ff5f57; }
	.dot.yellow { background: #febc2e; }
	.dot.green { background: #28c840; }
	.desktop-url-bar { flex: 1; display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #fff; border-radius: 8px; font-size: 13px; color: var(--c-text); }
	.desktop-lock { font-size: 11px; }
	.desktop-install-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-left: auto; color: var(--c-sage); cursor: default; background: var(--c-sage-soft); }
	.desktop-content { padding: 32px 20px; background: #fff; text-align: center; min-height: 60px; }
	.desktop-app-preview { display: flex; align-items: center; justify-content: center; gap: 10px; }
	.desktop-app-logo { width: 36px; height: 36px; border-radius: 8px; background: var(--c-green); color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; }
	.win-titlebar { flex-direction: row-reverse; }
	.win-titlebar .desktop-url-bar { order: -1; }
	.win-controls { display: flex; gap: 0; }
	.win-controls span { width: 32px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #5f6368; }

	.desktop-dialog-mockup { max-width: 340px; }
	.desktop-dialog { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
	.desktop-dialog-title { font-size: 16px; font-weight: 600; color: var(--c-text); margin-bottom: 16px; }
	.desktop-dialog-preview { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; }
	.desktop-dialog-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--c-green); color: #fff; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; }
	.desktop-dialog-name { font-size: 14px; font-weight: 600; color: var(--c-text); }
	.desktop-dialog-url { font-size: 12px; color: var(--c-muted); }
	.desktop-dialog-actions { display: flex; justify-content: flex-end; gap: 10px; }
	.desktop-dialog-cancel, .desktop-dialog-install { padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; cursor: default; font-family: inherit; }
	.desktop-dialog-cancel { background: #f3f4f6; color: var(--c-muted); }
	.desktop-dialog-install { background: #1a73e8; color: #fff; }

	.desktop-dock-mockup { max-width: 360px; }
	.mac-dock { display: flex; justify-content: center; gap: 8px; padding: 8px 16px; background: rgba(255,255,255,0.85); border-radius: 16px; border: 1px solid rgba(0,0,0,0.1); backdrop-filter: blur(20px); }
	.dock-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; }
	.dock-icon.gray { background: #e5e7eb; }
	.dock-icon.gd { background: var(--c-green); color: #fff; }

	/* ===== CTA ===== */
	.inst-cta { text-align: center; padding: 40px 24px; background: var(--c-green); border-radius: 16px; color: #fff; margin-bottom: 40px; }
	.inst-cta h3 { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
	.inst-cta p { font-size: 14px; opacity: 0.7; margin-bottom: 18px; }
	.inst-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; border-radius: 12px; font-size: 16px; font-weight: 700; text-decoration: none; background: #fff; color: var(--c-green); transition: all 0.15s; }
	.inst-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

	/* ===== FAQ ===== */
	.inst-faq { margin-bottom: 20px; }
	.inst-faq h3 { font-size: 20px; font-weight: 800; color: var(--c-text); margin-bottom: 16px; text-align: center; }
	.inst-faq-item { border: 1px solid var(--c-border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
	.inst-faq-item summary { padding: 14px 20px; font-size: 14px; font-weight: 600; color: var(--c-text); cursor: pointer; list-style: none; }
	.inst-faq-item summary::-webkit-details-marker { display: none; }
	.inst-faq-item summary::before { content: '+ '; color: var(--c-sage); font-weight: 800; }
	.inst-faq-item[open] summary::before { content: '- '; }
	.inst-faq-item p { padding: 0 20px 16px; font-size: 13px; color: var(--c-muted); line-height: 1.7; }

	/* ===== Responsive ===== */
	@media (max-width: 640px) {
		.inst-hero h1 { font-size: 24px; }
		.inst-benefits { grid-template-columns: 1fr; }
		.inst-tabs { gap: 6px; }
		.inst-tab { padding: 8px 12px; font-size: 12px; }
		.inst-tab-badge { font-size: 8px; }
		.inst-step { padding: 16px 14px; }
		.inst-step-body h4 { font-size: 14px; }
	}
</style>
