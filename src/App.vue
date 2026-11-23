<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BarChart, { type BarTone } from './components/BarChart.vue'
import sampleCsv from './data/day-ahead-sample.csv?raw'
import { CsvError, formatClock, parsePriceCsv, type PriceSeries } from './lib/csv'
import { allWindows, cheapestWindow, priciestWindow, windowCost } from './lib/optimise'
import { euro, hours, price, signed } from './lib/format'

const SAMPLE_NAME = 'Sample day · DE-LU-style day-ahead, 15 Apr 2026'

const series = ref<PriceSeries>(parsePriceCsv(sampleCsv))
const sourceName = ref(SAMPLE_NAME)
const isSample = computed(() => sourceName.value === SAMPLE_NAME)
const csvError = ref('')
const dragging = ref(false)

const durationHours = ref(3)
const powerKw = ref(800)
const earliest = ref(0)
const latestEnd = ref(series.value.prices.length)

const n = computed(() => series.value.prices.length)
const slotMinutes = computed(() => series.value.slotMinutes)
const stepHours = computed(() => slotMinutes.value / 60)
const maxHours = computed(() => (n.value * slotMinutes.value) / 60)
const runSlots = computed(() => Math.max(1, Math.round((durationHours.value * 60) / slotMinutes.value)))

const dayStartMinutes = computed(() => {
  const [h, m] = series.value.labels[0].split(':').map(Number)
  return h * 60 + m
})

/** Clock label for a slot boundary; the end of the day reads 24:00. */
function boundary(i: number): string {
  const mins = dayStartMinutes.value + i * slotMinutes.value
  if (mins === 1440) return '24:00'
  return mins > 1440 ? `${formatClock(mins)} +1` : formatClock(mins)
}

const constraint = computed(() => ({ earliest: earliest.value, latestEnd: latestEnd.value }))
const windows = computed(() => allWindows(series.value.prices, runSlots.value, constraint.value))
const best = computed(() => cheapestWindow(series.value.prices, runSlots.value, constraint.value))
const worst = computed(() => priciestWindow(series.value.prices, runSlots.value, constraint.value))
const asap = computed(() => windows.value[0] ?? null)

const cost = (w: { sum: number; start: number; end: number; avg: number } | null) =>
  w ? windowCost(w, powerKw.value || 0, slotMinutes.value) : 0
const energyMwh = computed(() => ((powerKw.value || 0) / 1000) * ((runSlots.value * slotMinutes.value) / 60))

const savingVsAsap = computed(() => cost(asap.value) - cost(best.value))
const savingVsWorst = computed(() => cost(worst.value) - cost(best.value))

const dayAvg = computed(() => series.value.prices.reduce((a, b) => a + b, 0) / n.value)

// Keep the form consistent when the data or the allowed range changes.
watch(series, () => {
  earliest.value = 0
  latestEnd.value = n.value
  durationHours.value = Math.min(Math.max(stepHours.value, durationHours.value), maxHours.value)
})
watch(earliest, (e) => {
  if (latestEnd.value <= e) latestEnd.value = Math.min(n.value, e + runSlots.value)
})
watch(latestEnd, (l) => {
  if (earliest.value >= l) earliest.value = Math.max(0, l - runSlots.value)
})

const inBest = (i: number) => !!best.value && i >= best.value.start && i < best.value.end
const allowed = (i: number) => i >= earliest.value && i < latestEnd.value

const priceTones = computed<BarTone[]>(() =>
  series.value.prices.map((_, i) => (inBest(i) ? 'accent' : allowed(i) ? 'base' : 'dim')),
)
const band = computed(() =>
  best.value ? { start: best.value.start, end: best.value.end, label: `Run ${boundary(best.value.start)}–${boundary(best.value.end)}` } : null,
)
const priceTooltip = (i: number) => {
  const lines = [`${boundary(i)}–${boundary(i + 1)}`, price(series.value.prices[i])]
  if (inBest(i)) lines.push('Inside the cheapest window')
  else if (!allowed(i)) lines.push('Outside the allowed hours')
  return lines
}

const startLabels = computed(() => windows.value.map((w) => boundary(w.start)))
const startValues = computed(() => windows.value.map((w) => Math.round(w.avg * 100) / 100))
const startTones = computed<BarTone[]>(() =>
  windows.value.map((w) => (best.value && w.start === best.value.start ? 'accent' : 'base')),
)
const startBand = computed(() => {
  const i = windows.value.findIndex((w) => best.value && w.start === best.value.start)
  return i < 0 ? null : { start: i, end: i + 1, label: `Best start ${boundary(windows.value[i].start)}` }
})
const startTooltip = (i: number) => {
  const w = windows.value[i]
  return [`Run ${boundary(w.start)}–${boundary(w.end)}`, `Average ${price(w.avg)}`, `Cost ${euro(cost(w))}`]
}

const slotOptions = computed(() => series.value.labels.map((_, i) => ({ value: i, label: boundary(i) })))
const endOptions = computed(() =>
  series.value.labels.map((_, i) => ({ value: i + 1, label: boundary(i + 1) })),
)

async function loadFile(file: File | undefined | null) {
  if (!file) return
  try {
    const parsed = parsePriceCsv(await file.text())
    series.value = parsed
    sourceName.value = file.name
    csvError.value = ''
  } catch (e) {
    csvError.value = e instanceof CsvError ? `${file.name}: ${e.message}` : `Could not read ${file.name}.`
  }
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  loadFile(input.files?.[0])
  input.value = ''
}
function onDrop(e: DragEvent) {
  dragging.value = false
  loadFile(e.dataTransfer?.files?.[0])
}
function useSample() {
  series.value = parsePriceCsv(sampleCsv)
  sourceName.value = SAMPLE_NAME
  csvError.value = ''
}
function setHours(v: number) {
  if (!Number.isFinite(v)) return
  const snapped = Math.round(v / stepHours.value) * stepHours.value
  durationHours.value = Math.min(maxHours.value, Math.max(stepHours.value, snapped))
}
const presets = [1, 2, 3, 4, 6, 8]
</script>

<template>
  <main class="page">
    <header class="masthead">
      <p class="eyebrow">Flexible load scheduler</p>
      <h1>Cheapest window</h1>
      <p class="lede">
        Tell it how long the machine runs. It finds the continuous slot with the lowest day-ahead price and shows what
        shifting the run is worth.
      </p>
    </header>

    <div class="layout">
      <form class="controls" @submit.prevent aria-label="Run settings">
        <fieldset>
          <legend>Run</legend>
          <label class="field" for="duration">
            <span class="field-label">Machine runs for</span>
            <span class="stepper">
              <button type="button" aria-label="Shorter" @click="setHours(durationHours - stepHours)">−</button>
              <input
                id="duration"
                type="number"
                inputmode="decimal"
                :min="stepHours"
                :max="maxHours"
                :step="stepHours"
                :value="durationHours"
                @change="setHours(Number(($event.target as HTMLInputElement).value))"
              />
              <span class="unit">h</span>
              <button type="button" aria-label="Longer" @click="setHours(durationHours + stepHours)">+</button>
            </span>
          </label>
          <div class="chips" role="group" aria-label="Common run lengths">
            <button
              v-for="p in presets"
              :key="p"
              type="button"
              class="chip"
              :aria-pressed="durationHours === p"
              @click="setHours(p)"
            >
              {{ p }} h
            </button>
          </div>
          <label class="field" for="power">
            <span class="field-label">Power draw</span>
            <span class="input-unit">
              <input id="power" v-model.number="powerKw" type="number" min="0" step="50" inputmode="numeric" />
              <span class="unit">kW</span>
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend>Allowed hours</legend>
          <div class="pair">
            <label class="field" for="earliest">
              <span class="field-label">Start no earlier than</span>
              <select id="earliest" v-model.number="earliest">
                <option v-for="o in slotOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <label class="field" for="latest">
              <span class="field-label">Finish by</span>
              <select id="latest" v-model.number="latestEnd">
                <option v-for="o in endOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
          </div>
          <p class="hint">Use this for shift times or a deadline for the batch.</p>
        </fieldset>

        <fieldset
          class="source"
          :class="{ dragging }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <legend>Prices</legend>
          <p class="source-name">
            <span class="dot" :class="{ sample: isSample }" aria-hidden="true"></span>{{ sourceName }}
          </p>
          <p class="hint">
            {{ n }} slots of {{ slotMinutes }} min. Day average {{ price(dayAvg) }}.
          </p>
          <div class="source-actions">
            <label class="button" for="csv">
              Load CSV…
              <input id="csv" class="visually-hidden" type="file" accept=".csv,text/csv,text/plain" @change="onPick" />
            </label>
            <button v-if="!isSample" type="button" class="button ghost" @click="useSample">Use sample day</button>
          </div>
          <p class="hint">Two columns, time and EUR/MWh. Drop a file here. 15-min prices work too.</p>
          <p v-if="csvError" class="error" role="alert">{{ csvError }}</p>
        </fieldset>
      </form>

      <section class="results" aria-live="polite">
        <div v-if="best" class="answer">
          <p class="answer-kicker">Cheapest {{ hours(runSlots, slotMinutes) }} window</p>
          <p class="answer-main">
            <span class="time">{{ boundary(best.start) }}</span>
            <span class="arrow" aria-label="to">→</span>
            <span class="time">{{ boundary(best.end) }}</span>
          </p>
          <p class="answer-sub">
            Average <strong>{{ price(best.avg) }}</strong> · {{ signed(energyMwh, 2) }} MWh costs
            <strong>{{ euro(cost(best)) }}</strong>
            <template v-if="best.avg < 0"> · you get paid to consume</template>
          </p>
        </div>
        <div v-else class="answer empty">
          <p class="answer-kicker">No window fits</p>
          <p class="answer-sub">
            A {{ hours(runSlots, slotMinutes) }} run does not fit between {{ boundary(earliest) }} and
            {{ boundary(latestEnd) }}. Shorten the run or widen the allowed hours.
          </p>
        </div>

        <dl v-if="best" class="compare">
          <div>
            <dt>vs. starting at {{ boundary(asap!.start) }}</dt>
            <dd>
              <span class="num">{{ euro(savingVsAsap) }}</span>
              <span class="sub">saved · {{ signed(asap!.avg - best.avg) }} €/MWh</span>
            </dd>
          </div>
          <div>
            <dt>vs. worst slot, {{ boundary(worst!.start) }}–{{ boundary(worst!.end) }}</dt>
            <dd>
              <span class="num">{{ euro(savingVsWorst) }}</span>
              <span class="sub">saved · {{ signed(worst!.avg - best.avg) }} €/MWh</span>
            </dd>
          </div>
          <div>
            <dt>Per year, if every day looked like this</dt>
            <dd>
              <span class="num">{{ euro(savingVsAsap * 250) }}</span>
              <span class="sub">250 working days vs. {{ boundary(asap!.start) }} start</span>
            </dd>
          </div>
        </dl>

        <figure class="panel">
          <figcaption>
            <span class="fig-title">Day-ahead price by hour</span>
            <span class="key">
              <span><i class="swatch accent"></i>Run window</span>
              <span><i class="swatch base"></i>Allowed</span>
              <span v-if="earliest > 0 || latestEnd < n"><i class="swatch dim"></i>Blocked</span>
            </span>
          </figcaption>
          <BarChart
            :labels="series.labels"
            :values="series.prices"
            :tones="priceTones"
            :band="band"
            y-title="EUR/MWh"
            :tooltip="priceTooltip"
            :label="`Bar chart of ${n} prices; cheapest window ${band?.label ?? 'none'}`"
            :height="320"
          />
        </figure>

        <figure v-if="windows.length > 1" class="panel">
          <figcaption>
            <span class="fig-title">Average price if the run starts at…</span>
            <span class="fig-note">{{ windows.length }} possible starts, every one checked</span>
          </figcaption>
          <BarChart
            :labels="startLabels"
            :values="startValues"
            :tones="startTones"
            :band="startBand"
            y-title="Avg EUR/MWh"
            :tooltip="startTooltip"
            label="Average price of the run for each possible start time"
            :height="200"
          />
        </figure>

        <details class="panel table-wrap">
          <summary>Prices as a table</summary>
          <div class="scroll">
            <table>
              <thead>
                <tr><th scope="col">Slot</th><th scope="col" class="r">EUR/MWh</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in series.prices" :key="i" :class="{ hit: inBest(i), off: !allowed(i) }">
                  <td>{{ boundary(i) }}–{{ boundary(i + 1) }}</td>
                  <td class="r">{{ signed(p) }}</td>
                  <td>{{ inBest(i) ? 'Run' : allowed(i) ? '' : 'Blocked' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        <section class="method">
          <h2>How it works</h2>
          <p>
            A run of <em>L</em> slots can start at any slot where it still finishes inside the allowed hours. With
            running totals of the prices, each candidate costs one subtraction, so all starts are checked in a single
            pass, O(n). Ties go to the earliest start. Cost is price × power × slot length, so negative prices show up
            as income.
          </p>
        </section>
      </section>
    </div>
  </main>
</template>
