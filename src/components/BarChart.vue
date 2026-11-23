<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js'
import { useChartTheme, type ChartTheme } from '../lib/theme'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

export type BarTone = 'accent' | 'base' | 'dim'

const props = defineProps<{
  labels: string[]
  values: number[]
  tones: BarTone[]
  /** Shaded range behind bars [start, end) with a label. */
  band?: { start: number; end: number; label: string } | null
  yTitle: string
  tooltip: (index: number) => string[]
  label: string
  height?: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const theme = useChartTheme()
let chart: Chart<'bar'> | null = null

const bandPlugin: Plugin<'bar'> = {
  id: 'windowBand',
  beforeDatasetsDraw(c) {
    const band = props.band
    if (!band || band.end <= band.start) return
    const t = theme.value
    const x = c.scales.x
    const { top, bottom } = c.chartArea
    const step = x.width / Math.max(1, props.labels.length)
    const x0 = x.getPixelForValue(band.start) - step / 2
    const x1 = x.getPixelForValue(band.end - 1) + step / 2
    const ctx = c.ctx
    ctx.save()
    ctx.fillStyle = t.band
    ctx.fillRect(x0, top, x1 - x0, bottom - top)
    ctx.strokeStyle = t.accent
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(Math.round(x0) + 0.5, top)
    ctx.lineTo(Math.round(x0) + 0.5, bottom)
    ctx.moveTo(Math.round(x1) - 0.5, top)
    ctx.lineTo(Math.round(x1) - 0.5, bottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = t.accentInk
    ctx.font = `600 12px ${t.fontSans}`
    ctx.textBaseline = 'top'
    const w = ctx.measureText(band.label).width
    // Keep the label inside the plot: flip to the band's right edge when needed.
    const lx = x0 + 6 + w > c.chartArea.right ? x1 - 6 - w : x0 + 6
    ctx.fillText(band.label, Math.max(c.chartArea.left + 2, lx), top + 6)
    ctx.restore()
  },
}

function colours(t: ChartTheme) {
  return props.tones.map((tone) => (tone === 'accent' ? t.accent : tone === 'dim' ? t.barDim : t.bar))
}

function config(t: ChartTheme): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: props.labels,
      datasets: [
        {
          data: props.values,
          backgroundColor: colours(t),
          hoverBackgroundColor: colours(t),
          borderRadius: 4,
          borderSkipped: 'start',
          categoryPercentage: 0.86,
          barPercentage: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 4, right: 4 } },
      scales: {
        x: {
          grid: { display: false },
          border: { color: t.line },
          ticks: {
            color: t.muted,
            font: { family: t.fontMono, size: 11 },
            maxRotation: 0,
            autoSkip: true,
            autoSkipPadding: 10,
          },
        },
        y: {
          grace: '8%',
          border: { display: false },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? t.zero : t.line),
            lineWidth: (ctx) => (ctx.tick.value === 0 ? 1.5 : 1),
          },
          ticks: { color: t.muted, font: { family: t.fontMono, size: 11 }, maxTicksLimit: 6 },
          title: { display: true, text: props.yTitle, color: t.ink2, font: { family: t.fontSans, size: 12 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.surface,
          borderColor: t.line,
          borderWidth: 1,
          titleColor: t.ink,
          bodyColor: t.ink2,
          titleFont: { family: t.fontMono, size: 12, weight: 600 },
          bodyFont: { family: t.fontSans, size: 12 },
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (item) => props.tooltip(item.dataIndex),
          },
        },
      },
    },
    plugins: [bandPlugin],
  }
}

function render() {
  if (!canvas.value) return
  const t = theme.value
  if (!chart) {
    chart = new Chart(canvas.value, config(t))
    return
  }
  const next = config(t)
  chart.data = next.data
  chart.options = next.options!
  chart.update()
}

onMounted(render)
watch(() => [props.labels, props.values, props.tones, props.band, theme.value], render, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="chart" :style="{ height: `${height ?? 300}px` }">
    <canvas ref="canvas" role="img" :aria-label="label"></canvas>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
}
</style>
