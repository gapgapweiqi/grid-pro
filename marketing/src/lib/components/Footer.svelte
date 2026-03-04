<script lang="ts">
	import { FileText } from 'lucide-svelte';
</script>

<footer class="pub-footer">
	<div class="pub-footer-inner">
		<div class="pub-footer-grid">
			<div class="pub-footer-brand">
				<div class="pub-footer-logo">
					<div class="pub-footer-logo-icon"><FileText size={16} /></div>
					<span>Grid Doc</span>
				</div>
				<p>ระบบออกเอกสารธุรกิจออนไลน์<br/>สำหรับธุรกิจไทยยุคใหม่</p>
			</div>
			<div class="pub-footer-col">
				<h4>ผลิตภัณฑ์</h4>
				<a href="/#features">ฟีเจอร์</a>
				<a href="/#pricing">ราคา</a>
				<a href="/download">ดาวน์โหลด</a>
			</div>
			<div class="pub-footer-col">
				<h4>ช่วยเหลือ</h4>
				<a href="/guide">คู่มือใช้งาน</a>
				<a href="/contact">ติดต่อเรา</a>
				<a href="/#faq">คำถามที่พบบ่อย</a>
			</div>
			<div class="pub-footer-col">
				<h4>กฎหมาย</h4>
				<a href="/privacy">นโยบายความเป็นส่วนตัว</a>
				<a href="/terms">เงื่อนไขการใช้งาน</a>
			</div>
		</div>
		<div class="pub-footer-bottom">
			&copy; {new Date().getFullYear()} Grid Doc. All rights reserved.
		</div>
	</div>
</footer>

<style>
	.pub-footer {
		background: #1a4731;
		color: rgba(255, 255, 255, 0.7);
	}
	.pub-footer-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 48px 24px 24px;
	}
	.pub-footer-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr;
		gap: 40px;
		margin-bottom: 32px;
	}
	.pub-footer-logo {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 18px;
		font-weight: 800;
		color: #fff;
		margin-bottom: 10px;
	}
	.pub-footer-logo-icon {
		width: 28px;
		height: 28px;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.pub-footer-brand p {
		font-size: 13px;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.5);
	}
	.pub-footer-col h4 {
		font-size: 13px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 14px;
	}
	.pub-footer-col a {
		display: block;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.5);
		text-decoration: none;
		margin-bottom: 10px;
		transition: color 0.15s;
	}
	.pub-footer-col a:hover {
		color: #fff;
	}
	.pub-footer-bottom {
		padding-top: 20px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		text-align: center;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
	}
	@media (max-width: 768px) {
		.pub-footer-grid {
			grid-template-columns: 1fr 1fr;
			gap: 24px;
		}
	}
</style>
