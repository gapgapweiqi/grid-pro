<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Grid Doc - ระบบออกเอกสารธุรกิจออนไลน์</title>
	<meta name="description" content="ระบบออกเอกสารธุรกิจออนไลน์ ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ ใบกำกับภาษี จัดการสต๊อก ลูกค้า รายงาน ครบจบในที่เดียว" />
	<meta property="og:title" content="Grid Doc - ระบบออกเอกสารธุรกิจออนไลน์" />
	<meta property="og:description" content="ออกใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ ใบกำกับภาษี พร้อมระบบจัดการสต๊อก ลูกค้า และรายงาน ครบจบในที่เดียว" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://grid-doc.com" />
	<meta property="og:locale" content="th_TH" />
</svelte:head>

<div class="site-shell">
	<Header />
	<main class="site-main">
		{@render children()}
	</main>
	<Footer />
</div>

<style>
	.site-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #faf8f4;
		font-family: "Sarabun", "Noto Sans Thai", Arial, sans-serif;
	}
	.site-main {
		flex: 1;
	}
</style>
