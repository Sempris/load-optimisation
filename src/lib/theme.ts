import { onBeforeUnmount, onMounted, ref } from 'vue'

export interface ChartTheme {
  ink: string
  ink2: string
  muted: string
  line: string
  zero: string
  bar: string
  barDim: string
  accent: string
  accentInk: string
  band: string
  surface: string
  fontMono: string
  fontSans: string
}

function read(): ChartTheme {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string) => cs.getPropertyValue(name).trim()
  return {
    ink: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    line: v('--line'),
    zero: v('--zero'),
    bar: v('--bar'),
    barDim: v('--bar-dim'),
    accent: v('--accent'),
    accentInk: v('--accent-ink'),
    band: v('--band'),
    surface: v('--surface'),
    fontMono: v('--font-mono'),
    fontSans: v('--font-sans'),
  }
}

/** Chart colours from CSS tokens, refreshed when the OS or viewer theme changes. */
export function useChartTheme() {
  const theme = ref<ChartTheme>(read())
  const refresh = () => (theme.value = read())
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const mo = new MutationObserver(refresh)
  onMounted(() => {
    mq.addEventListener('change', refresh)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    document.fonts?.ready.then(refresh)
  })
  onBeforeUnmount(() => {
    mq.removeEventListener('change', refresh)
    mo.disconnect()
  })
  return theme
}
