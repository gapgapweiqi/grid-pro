<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import type { SalesTrendItem } from '$lib/types';

	Chart.register(...registerables);

	interface Props {
		data: SalesTrendItem[];
	}

	let { data }: Props = $props();
	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		createChart();
	});

	onDestroy(() => {
		chart?.destroy();
	});

	$effect(() => {
		if (data.length > 0 && canvas) {
			if (chart) {
				chart.data.labels = data.map(d => d.label);
				chart.data.datasets[0].data = data.map(d => d.total);
				chart.update();
			} else {
				createChart();
			}
		}
	});

	function createChart() {
		if (!canvas || data.length === 0) return;

		const primary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#4f46e5';

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: data.map(d => d.label),
				datasets: [{
					label: 'ยอดขาย',
					data: data.map(d => d.total),
					backgroundColor: primary + '33',
					borderColor: primary,
					borderWidth: 2,
					borderRadius: 6,
					borderSkipped: false
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => {
								const val = ctx.parsed?.y ?? 0;
								return `฿${val.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`;
							}
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						grid: { color: 'rgba(0,0,0,0.05)' },
						ticks: {
							callback: (v: string | number) => {
								const n = Number(v);
								if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
								if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
								return String(n);
							},
							font: { size: 11 }
						}
					},
					x: {
						grid: { display: false },
						ticks: { font: { size: 11 } }
					}
				}
			}
		});
	}
</script>

<div style="position: relative; height: 200px;">
	<canvas bind:this={canvas}></canvas>
</div>
