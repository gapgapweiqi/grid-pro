<script lang="ts">
	import { onMount } from 'svelte';
	import { sendNotification, getNotificationLog, getSubscribers, deleteLogEntry, clearAllLogs, updateSubscriberTags, uploadNotificationImage } from '$lib/services/push';
	import { addToast } from '$lib/stores/app';
	import { Bell, Send, Users, Clock, Image, Globe, User, Tag, Trash2, Upload, X, Plus, Check } from 'lucide-svelte';

	// Form state
	let targetType = $state<'broadcast' | 'user' | 'tag'>('broadcast');
	let targetValue = $state('');
	let title = $state('');
	let body = $state('');
	let imageUrl = $state('');
	let notifUrl = $state('/');
	let sending = $state(false);
	let uploading = $state(false);
	let imageInputMode = $state<'upload' | 'url'>('upload');

	// Data
	let subscribers: any[] = $state([]);
	let logs: any[] = $state([]);
	let loading = $state(true);

	// Subscriber panel
	let showSubscriberPanel = $state(false);
	let editingTagEndpoint = $state<string | null>(null);
	let editTagInput = $state('');

	let fileInputEl: HTMLInputElement;

	onMount(async () => {
		const [subs, history] = await Promise.all([getSubscribers(), getNotificationLog()]);
		subscribers = subs;
		logs = history;
		loading = false;
	});

	async function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		const result = await uploadNotificationImage(file);
		uploading = false;
		if (result.ok && result.url) {
			imageUrl = result.url;
			addToast('อัปโหลดรูปสำเร็จ', 'success');
		} else {
			addToast(`อัปโหลดไม่สำเร็จ: ${result.error}`, 'error');
		}
		input.value = '';
	}

	async function handleSend() {
		if (!title.trim()) { addToast('กรุณากรอกหัวข้อ', 'error'); return; }
		if (targetType !== 'broadcast' && !targetValue.trim()) {
			addToast('กรุณาระบุเป้าหมาย', 'error'); return;
		}
		sending = true;
		const result = await sendNotification({
			targetType,
			targetValue: targetValue.trim() || undefined,
			title: title.trim(),
			body: body.trim() || undefined,
			imageUrl: imageUrl.trim() || undefined,
			url: notifUrl.trim() || '/',
		});
		sending = false;
		if (result.ok) {
			addToast(`ส่งแจ้งเตือนสำเร็จ (${result.sentCount} คน)`, 'success');
			title = ''; body = ''; imageUrl = '';
			logs = await getNotificationLog();
		} else {
			addToast(`ส่งไม่สำเร็จ: ${result.error}`, 'error');
		}
	}

	async function handleDeleteLog(logId: string) {
		const ok = await deleteLogEntry(logId);
		if (ok) {
			logs = logs.filter(l => l.id !== logId);
			addToast('ลบประวัติแล้ว', 'info');
		} else {
			addToast('ลบไม่สำเร็จ', 'error');
		}
	}

	async function handleClearAllLogs() {
		if (!confirm('ล้างประวัติการส่งทั้งหมด?')) return;
		const ok = await clearAllLogs();
		if (ok) {
			logs = [];
			addToast('ล้างประวัติทั้งหมดแล้ว', 'info');
		} else {
			addToast('ล้างไม่สำเร็จ', 'error');
		}
	}

	function startEditTags(sub: any) {
		editingTagEndpoint = sub.endpoint;
		try {
			const tags = JSON.parse(sub.tags || '[]');
			editTagInput = tags.join(', ');
		} catch {
			editTagInput = '';
		}
	}

	async function saveEditTags(sub: any) {
		const tags = editTagInput.split(',').map((t: string) => t.trim()).filter(Boolean);
		const ok = await updateSubscriberTags(sub.endpoint, tags);
		if (ok) {
			sub.tags = JSON.stringify(tags);
			subscribers = [...subscribers];
			addToast('บันทึก Tags แล้ว', 'success');
		} else {
			addToast('บันทึกไม่สำเร็จ', 'error');
		}
		editingTagEndpoint = null;
	}

	function parseTags(tagsStr: string): string[] {
		try { return JSON.parse(tagsStr || '[]'); } catch { return []; }
	}

	function getInitials(name: string): string {
		if (!name) return '?';
		return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '-';
		const d = new Date(dateStr);
		return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	const targetTypeOptions = [
		{ value: 'broadcast', label: 'ทุกคน (Broadcast)', icon: Globe },
		{ value: 'user', label: 'เฉพาะผู้ใช้', icon: User },
		{ value: 'tag', label: 'ตาม Tag', icon: Tag },
	] as const;
</script>

<svelte:head>
	<title>จัดการแจ้งเตือน | Admin</title>
</svelte:head>

<input type="file" accept="image/*" style="display:none;" bind:this={fileInputEl} onchange={handleImageUpload} />

<div style="max-width: 960px; margin: 0 auto; padding: 24px 16px;">
	<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
		<div style="width: 40px; height: 40px; background: var(--color-primary-soft); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
			<Bell size={20} style="color: var(--color-primary);" />
		</div>
		<div>
			<h1 style="font-size: 20px; font-weight: 700; margin: 0;">จัดการแจ้งเตือน Push</h1>
			<p style="font-size: 13px; color: var(--color-gray-500); margin: 0;">ส่งแจ้งเตือนให้ผู้ใช้ทั้งหมดหรือเฉพาะคน</p>
		</div>
		<div style="margin-left: auto;">
			<button
				class="btn btn-sm"
				style="background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; cursor: pointer;"
				onclick={() => { showSubscriberPanel = !showSubscriberPanel; }}
			>
				<Users size={14} /> {subscribers.length} ผู้รับ
			</button>
		</div>
	</div>

	<!-- Subscriber Panel (expandable) -->
	{#if showSubscriberPanel}
		<div class="card" style="margin-bottom: 20px;">
			<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
				<Users size={16} /> ผู้รับแจ้งเตือน ({subscribers.length})
				<button class="btn btn-sm" style="margin-left: auto; background: none; color: var(--color-gray-400);" onclick={() => { showSubscriberPanel = false; }}>
					<X size={14} />
				</button>
			</h3>
			{#if loading}
				<div style="text-align: center; padding: 20px; color: var(--color-gray-400);">กำลังโหลด...</div>
			{:else if subscribers.length === 0}
				<div style="text-align: center; padding: 20px; color: var(--color-gray-400);">ยังไม่มีผู้สมัครรับแจ้งเตือน</div>
			{:else}
				<div style="max-height: 320px; overflow-y: auto;">
					{#each subscribers as sub}
						<div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--color-gray-100);">
							<!-- Avatar -->
							{#if sub.avatar_url}
								<img src={sub.avatar_url} alt="" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;" />
							{:else}
								<div style="width: 36px; height: 36px; background: var(--color-primary-soft); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--color-primary);">
									{getInitials(sub.name || sub.email || '')}
								</div>
							{/if}
							<!-- Info -->
							<div style="flex: 1; min-width: 0;">
								<div style="font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{sub.name || sub.email || 'Unknown'}</div>
								<div style="font-size: 11px; color: var(--color-gray-400);">{sub.email || ''} · {formatDate(sub.created_at)}</div>
							</div>
							<!-- Tags -->
							<div style="display: flex; align-items: center; gap: 4px;">
								{#if editingTagEndpoint === sub.endpoint}
									<input
										class="field-control"
										type="text"
										style="font-size: 11px; padding: 4px 8px; width: 140px;"
										placeholder="tag1, tag2"
										bind:value={editTagInput}
										onkeydown={(e) => { if (e.key === 'Enter') saveEditTags(sub); if (e.key === 'Escape') editingTagEndpoint = null; }}
									/>
									<button class="btn btn-sm" style="padding: 3px 6px; background: var(--color-primary); color: #fff;" onclick={() => saveEditTags(sub)}>
										<Check size={12} />
									</button>
									<button class="btn btn-sm" style="padding: 3px 6px; background: var(--color-gray-100);" onclick={() => { editingTagEndpoint = null; }}>
										<X size={12} />
									</button>
								{:else}
									{#each parseTags(sub.tags) as tag}
										<span style="font-size: 10px; background: var(--color-primary-soft); color: var(--color-primary); padding: 2px 6px; border-radius: 4px;">{tag}</span>
									{/each}
									<button
										class="btn btn-sm"
										style="padding: 2px 6px; background: var(--color-gray-100); color: var(--color-gray-500); font-size: 10px;"
										title="แก้ไข Tags"
										onclick={() => startEditTags(sub)}
									>
										<Tag size={10} /> {parseTags(sub.tags).length > 0 ? 'แก้ไข' : '+ Tag'}
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
		<!-- Send Form -->
		<div class="card" style="grid-column: 1;">
			<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
				<Send size={16} /> ส่งแจ้งเตือนใหม่
			</h3>

			<div style="margin-bottom: 14px;">
				<span class="field-label" id="notif-target-label">เป้าหมาย</span>
				<div style="display: flex; gap: 8px;" role="group" aria-labelledby="notif-target-label">
					{#each targetTypeOptions as opt}
						<button
							class="btn btn-sm"
							style={targetType === opt.value ? 'background: var(--color-primary); color: #fff;' : 'background: var(--color-gray-100); color: var(--color-gray-700);'}
							onclick={() => { targetType = opt.value; targetValue = ''; }}
						>
							<opt.icon size={14} /> {opt.label}
						</button>
					{/each}
				</div>
			</div>

			{#if targetType === 'user'}
				<div style="margin-bottom: 14px;">
					<label class="field-label" for="notif-user">User ID หรือ Email</label>
					<select id="notif-user" class="field-control" bind:value={targetValue}>
						<option value="">-- เลือกผู้ใช้ --</option>
						{#each [...new Map(subscribers.map((s: any) => [s.user_id, s])).values()] as sub}
							<option value={sub.user_id}>{sub.name || sub.email || sub.user_id}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if targetType === 'tag'}
				<div style="margin-bottom: 14px;">
					<label class="field-label" for="notif-tag">Tag</label>
					<input id="notif-tag" class="field-control" type="text" placeholder="เช่น premium, beta" bind:value={targetValue} />
				</div>
			{/if}

			<div style="margin-bottom: 14px;">
				<label class="field-label" for="notif-title">หัวข้อ *</label>
				<input id="notif-title" class="field-control" type="text" placeholder="หัวข้อแจ้งเตือน" bind:value={title} maxlength="100" />
			</div>

			<div style="margin-bottom: 14px;">
				<label class="field-label" for="notif-body">ข้อความ</label>
				<textarea id="notif-body" class="field-control" rows="3" placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" bind:value={body} maxlength="500"></textarea>
			</div>

			<div style="margin-bottom: 14px;">
				<label class="field-label" style="display: flex; align-items: center; gap: 8px;">
					<Image size={14} /> รูปภาพ
					<div style="margin-left: auto; display: flex; gap: 4px;">
						<button class="btn btn-sm" style="padding: 2px 8px; font-size: 11px; {imageInputMode === 'upload' ? 'background: var(--color-primary); color: #fff;' : 'background: var(--color-gray-100);'}" onclick={() => { imageInputMode = 'upload'; }}>อัปโหลด</button>
						<button class="btn btn-sm" style="padding: 2px 8px; font-size: 11px; {imageInputMode === 'url' ? 'background: var(--color-primary); color: #fff;' : 'background: var(--color-gray-100);'}" onclick={() => { imageInputMode = 'url'; }}>ลิงก์ URL</button>
					</div>
				</label>

				{#if imageInputMode === 'upload'}
					<button
						class="btn"
						style="width: 100%; padding: 12px; border: 2px dashed var(--color-gray-300); background: var(--color-gray-50); color: var(--color-gray-500); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
						onclick={() => fileInputEl?.click()}
						disabled={uploading}
					>
						{#if uploading}
							<span>กำลังอัปโหลด...</span>
						{:else}
							<Upload size={16} /> เลือกรูปภาพ (PNG, JPEG, WebP)
						{/if}
					</button>
				{:else}
					<input class="field-control" type="url" placeholder="https://example.com/image.jpg" bind:value={imageUrl} />
				{/if}

				{#if imageUrl}
					<div style="margin-top: 8px; position: relative; border-radius: 8px; overflow: hidden; max-height: 120px;">
						<img src={imageUrl} alt="Preview" style="width: 100%; object-fit: cover;" onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
						<button
							class="btn btn-sm"
							style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: #fff; border-radius: 50%; width: 24px; height: 24px; padding: 0; display: flex; align-items: center; justify-content: center;"
							onclick={() => { imageUrl = ''; }}
						>
							<X size={12} />
						</button>
					</div>
				{/if}
			</div>

			<div style="margin-bottom: 16px;">
				<label class="field-label" for="notif-url">URL เมื่อกดแจ้งเตือน</label>
				<input id="notif-url" class="field-control" type="text" placeholder="/" bind:value={notifUrl} />
			</div>

			<button class="btn btn-primary" style="width: 100%;" onclick={handleSend} disabled={sending || !title.trim()}>
				{#if sending}
					กำลังส่ง...
				{:else}
					<Send size={16} /> ส่งแจ้งเตือน
				{/if}
			</button>
		</div>

		<!-- Right column: Subscribers summary + History -->
		<div style="display: flex; flex-direction: column; gap: 20px;">
			<!-- Subscriber Summary (compact) -->
			<div class="card">
				<h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
					<Users size={16} /> ผู้รับแจ้งเตือน ({subscribers.length})
				</h3>
				{#if loading}
					<div style="text-align: center; padding: 20px; color: var(--color-gray-400);">กำลังโหลด...</div>
				{:else if subscribers.length === 0}
					<div style="text-align: center; padding: 20px; color: var(--color-gray-400);">ยังไม่มีผู้สมัครรับแจ้งเตือน</div>
				{:else}
					<div style="max-height: 200px; overflow-y: auto;">
						{#each subscribers as sub}
							<div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--color-gray-100);">
								{#if sub.avatar_url}
									<img src={sub.avatar_url} alt="" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" />
								{:else}
									<div style="width: 28px; height: 28px; background: var(--color-primary-soft); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--color-primary);">
										{getInitials(sub.name || sub.email || '')}
									</div>
								{/if}
								<div style="flex: 1; min-width: 0;">
									<div style="font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{sub.name || sub.email || 'Unknown'}</div>
									<div style="font-size: 11px; color: var(--color-gray-400);">{formatDate(sub.created_at)}</div>
								</div>
								{#if parseTags(sub.tags).length > 0}
									<div style="display: flex; gap: 2px; flex-wrap: wrap;">
										{#each parseTags(sub.tags) as tag}
											<span style="font-size: 10px; background: var(--color-primary-soft); color: var(--color-primary); padding: 2px 6px; border-radius: 4px;">{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Notification History -->
			<div class="card">
				<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
					<h3 style="font-size: 15px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
						<Clock size={16} /> ประวัติการส่ง
					</h3>
					{#if logs.length > 0}
						<button
							class="btn btn-sm"
							style="margin-left: auto; background: #fee2e2; color: #ef4444; font-size: 11px; padding: 3px 8px;"
							onclick={handleClearAllLogs}
						>
							<Trash2 size={12} /> ล้างทั้งหมด
						</button>
					{/if}
				</div>
				{#if logs.length === 0}
					<div style="text-align: center; padding: 20px; color: var(--color-gray-400);">ยังไม่มีประวัติ</div>
				{:else}
					<div style="max-height: 300px; overflow-y: auto;">
						{#each logs as log}
							<div style="padding: 10px 0; border-bottom: 1px solid var(--color-gray-100); position: relative;">
								<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
									<span style="font-size: 13px; font-weight: 600;">{log.title}</span>
									<span style="font-size: 10px; background: {log.target_type === 'broadcast' ? 'var(--color-primary-soft)' : 'var(--color-gray-100)'}; color: {log.target_type === 'broadcast' ? 'var(--color-primary)' : 'var(--color-gray-600)'}; padding: 2px 6px; border-radius: 4px;">
										{log.target_type === 'broadcast' ? 'ทุกคน' : log.target_type === 'user' ? 'เฉพาะคน' : 'Tag: ' + log.target_value}
									</span>
									<button
										class="btn btn-sm"
										style="margin-left: auto; padding: 2px 4px; background: none; color: var(--color-gray-300); cursor: pointer;"
										title="ลบ"
										onclick={() => handleDeleteLog(log.id)}
									>
										<Trash2 size={12} />
									</button>
								</div>
								{#if log.body}
									<div style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 4px;">{log.body}</div>
								{/if}
								<div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-gray-400);">
									<span>ส่ง {log.sent_count} คน</span>
									<span>โดย {log.sender_name || log.sender_email || '-'}</span>
									<span>{formatDate(log.created_at)}</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	@media (max-width: 768px) {
		div[style*="grid-template-columns: 1fr 1fr"] {
			grid-template-columns: 1fr !important;
		}
	}
</style>
