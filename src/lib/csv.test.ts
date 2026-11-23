import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CsvError, parsePriceCsv } from './csv'

describe('parsePriceCsv', () => {
  it('parses the bundled sample', () => {
    const text = readFileSync(new URL('../data/day-ahead-sample.csv', import.meta.url), 'utf8')
    const s = parsePriceCsv(text)
    expect(s.prices).toHaveLength(24)
    expect(s.slotMinutes).toBe(60)
    expect(s.labels[0]).toBe('00:00')
    expect(s.labels[13]).toBe('13:00')
    expect(s.prices[14]).toBe(-8.9)
  })

  it('accepts hour numbers without a header', () => {
    const s = parsePriceCsv('0,10\n1,20\n2,30')
    expect(s.labels).toEqual(['00:00', '01:00', '02:00'])
    expect(s.prices).toEqual([10, 20, 30])
  })

  it('accepts semicolons with decimal commas', () => {
    const s = parsePriceCsv('Zeit;Preis\n00:00;98,2\n01:00;-3,4')
    expect(s.prices).toEqual([98.2, -3.4])
  })

  it('infers quarter-hour resolution', () => {
    const s = parsePriceCsv('time,price\n00:00,1\n00:15,2\n00:30,3\n00:45,4')
    expect(s.slotMinutes).toBe(15)
    expect(s.labels[3]).toBe('00:45')
  })

  it('reports bad rows clearly', () => {
    expect(() => parsePriceCsv('time,price\n00:00,1\n01:00,abc')).toThrow(/Row 3/)
    expect(() => parsePriceCsv('')).toThrow(CsvError)
    expect(() => parsePriceCsv('00:00,1')).toThrow(/at least two/)
  })
})
