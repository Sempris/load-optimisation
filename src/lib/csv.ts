export interface PriceSeries {
  /** Display label for each slot start, e.g. "13:00". */
  labels: string[]
  /** Price per slot in EUR/MWh. */
  prices: number[]
  /** Length of one slot in minutes (60 for hourly, 15 for quarter-hourly). */
  slotMinutes: number
}

export class CsvError extends Error {}

const TIME_RE = /(?:^|[T\s])(\d{1,2}):(\d{2})/

function detectDelimiter(line: string): string {
  if (line.includes(';')) return ';'
  if (line.includes('\t')) return '\t'
  return ','
}

function parseNumber(raw: string, delimiter: string): number {
  let s = raw.trim().replace(/^"|"$/g, '')
  // Semicolon-separated files from European tools usually use a decimal comma.
  if (delimiter !== ',') s = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (s === '') return NaN
  return Number(s)
}

function minutesOfDay(label: string): number | null {
  const m = TIME_RE.exec(label)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  if (/^\d{1,2}$/.test(label)) {
    const h = Number(label)
    return h >= 0 && h <= 23 ? h * 60 : null
  }
  return null
}

function formatClock(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Parse a two-column price CSV: slot start, price in EUR/MWh.
 * Accepts ISO timestamps ("2026-04-15T13:00"), clock times ("13:00") or hour
 * numbers ("13"); comma, semicolon or tab separators; an optional header row;
 * and "#" comment lines.
 */
export function parsePriceCsv(text: string): PriceSeries {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))

  if (lines.length === 0) throw new CsvError('The file is empty.')
  const delimiter = detectDelimiter(lines[0])

  const rows: { label: string; price: number; line: number }[] = []
  lines.forEach((line, i) => {
    const cells = line.split(delimiter)
    if (cells.length < 2) {
      throw new CsvError(`Row ${i + 1} has one column. Expected "time${delimiter}price".`)
    }
    const label = cells[0].trim().replace(/^"|"$/g, '')
    const price = parseNumber(cells[1], delimiter)
    if (Number.isNaN(price)) {
      if (i === 0) return // header row
      throw new CsvError(`Row ${i + 1}: "${cells[1].trim()}" is not a number.`)
    }
    rows.push({ label, price, line: i + 1 })
  })

  if (rows.length < 2) throw new CsvError('Need at least two price rows.')
  if (rows.length > 7 * 96) throw new CsvError(`Too many rows (${rows.length}). Load one day at a time.`)

  const minutes = rows.map((r) => minutesOfDay(r.label))
  let slotMinutes = 60
  if (minutes[0] !== null && minutes[1] !== null) {
    const diff = (((minutes[1] - minutes[0]) % 1440) + 1440) % 1440
    if (diff > 0) slotMinutes = diff
  }
  if (![15, 30, 60].includes(slotMinutes)) {
    throw new CsvError(`Rows are ${slotMinutes} minutes apart. Use hourly, 30-minute or 15-minute prices.`)
  }

  const startMinutes = minutes[0] ?? 0
  const labels = rows.map((_, i) => formatClock(startMinutes + i * slotMinutes))
  return { labels, prices: rows.map((r) => r.price), slotMinutes }
}

export { formatClock }
