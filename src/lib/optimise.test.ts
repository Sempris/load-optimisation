import { describe, expect, it } from 'vitest'
import { allWindows, cheapestWindow, priciestWindow, windowCost } from './optimise'

const bruteForce = (p: number[], L: number, lo = 0, hi = p.length) => {
  let best: { start: number; sum: number } | null = null
  for (let s = lo; s + L <= hi; s++) {
    const sum = p.slice(s, s + L).reduce((a, b) => a + b, 0)
    if (!best || sum < best.sum - 1e-9) best = { start: s, sum }
  }
  return best
}

describe('cheapestWindow', () => {
  it('finds the cheapest continuous block', () => {
    const p = [50, 40, 10, 5, 30, 80]
    expect(cheapestWindow(p, 2)).toMatchObject({ start: 2, end: 4, sum: 15, avg: 7.5 })
    expect(cheapestWindow(p, 3)?.start).toBe(2) // 10+5+30 = 45 beats 40+10+5 = 55
  })

  it('handles negative prices', () => {
    const p = [20, -5, -10, 3, 50]
    expect(cheapestWindow(p, 2)).toMatchObject({ start: 1, sum: -15 })
  })

  it('breaks ties on the earliest start', () => {
    expect(cheapestWindow([10, 10, 10, 10], 2)?.start).toBe(0)
  })

  it('respects earliest start and latest finish', () => {
    const p = [1, 1, 50, 60, 70, 2, 2]
    expect(cheapestWindow(p, 2, { earliest: 2 })?.start).toBe(5)
    expect(cheapestWindow(p, 2, { earliest: 2, latestEnd: 5 })?.start).toBe(2)
  })

  it('returns null when the run does not fit', () => {
    expect(cheapestWindow([1, 2, 3], 4)).toBeNull()
    expect(cheapestWindow([1, 2, 3, 4], 2, { earliest: 3 })).toBeNull()
    expect(cheapestWindow([1, 2, 3], 0)).toBeNull()
  })

  it('matches brute force on random days', () => {
    for (let t = 0; t < 200; t++) {
      const n = 24 + Math.floor(Math.random() * 73)
      const p = Array.from({ length: n }, () => Math.round((Math.random() * 300 - 50) * 10) / 10)
      const L = 1 + Math.floor(Math.random() * n)
      const got = cheapestWindow(p, L)
      const want = bruteForce(p, L)
      expect(got?.start).toBe(want?.start)
      expect(got?.sum).toBeCloseTo(want!.sum, 6)
    }
  })
})

describe('priciestWindow / allWindows', () => {
  it('finds the most expensive block', () => {
    expect(priciestWindow([1, 9, 8, 2], 2)?.start).toBe(1)
  })
  it('lists every feasible start', () => {
    expect(allWindows([1, 2, 3, 4], 2).map((w) => w.start)).toEqual([0, 1, 2])
  })
})

describe('windowCost', () => {
  it('converts EUR/MWh, kW and slot length into EUR', () => {
    // 1 MW for 3 hourly slots at 100 EUR/MWh = 300 EUR
    const w = { start: 0, end: 3, sum: 300, avg: 100 }
    expect(windowCost(w, 1000, 60)).toBeCloseTo(300)
    // 1 MW for 4 quarter-hours at 100 EUR/MWh = 1 MWh = 100 EUR
    expect(windowCost({ start: 0, end: 4, sum: 400, avg: 100 }, 1000, 15)).toBeCloseTo(100)
  })
})
