/**
 * Cheapest continuous window for a flexible load.
 *
 * Given N price slots and a run length of L slots, find the start index s that
 * minimises sum(prices[s .. s+L-1]) subject to an allowed range
 * [earliest, latestEnd). Prefix sums make every window sum O(1), so the whole
 * search is O(N).
 */

export interface WindowConstraint {
  /** First slot the load may start in (inclusive). Defaults to 0. */
  earliest?: number
  /** Slot boundary the load must be finished by (exclusive). Defaults to N. */
  latestEnd?: number
}

export interface PriceWindow {
  start: number
  /** Exclusive end slot. */
  end: number
  /** Sum of slot prices across the window. */
  sum: number
  /** Mean price across the window. */
  avg: number
}

const EPS = 1e-9

function prefixSums(prices: readonly number[]): number[] {
  const out = new Array<number>(prices.length + 1)
  out[0] = 0
  for (let i = 0; i < prices.length; i++) out[i + 1] = out[i] + prices[i]
  return out
}

/** Every feasible window in start order. Empty when the run does not fit. */
export function allWindows(
  prices: readonly number[],
  length: number,
  { earliest = 0, latestEnd = prices.length }: WindowConstraint = {},
): PriceWindow[] {
  if (!Number.isInteger(length) || length < 1) return []
  const lo = Math.max(0, Math.floor(earliest))
  const hi = Math.min(prices.length, Math.ceil(latestEnd))
  const ps = prefixSums(prices)
  const windows: PriceWindow[] = []
  for (let s = lo; s + length <= hi; s++) {
    const sum = ps[s + length] - ps[s]
    windows.push({ start: s, end: s + length, sum, avg: sum / length })
  }
  return windows
}

function pick(windows: PriceWindow[], better: (a: number, b: number) => boolean): PriceWindow | null {
  let best: PriceWindow | null = null
  for (const w of windows) {
    // Strict comparison with a small tolerance: ties go to the earliest start.
    if (best === null || better(w.sum, best.sum)) best = w
  }
  return best
}

/** The cheapest feasible window, earliest start on ties. Null if none fits. */
export function cheapestWindow(
  prices: readonly number[],
  length: number,
  constraint?: WindowConstraint,
): PriceWindow | null {
  return pick(allWindows(prices, length, constraint), (a, b) => a < b - EPS)
}

/** The most expensive feasible window, earliest start on ties. */
export function priciestWindow(
  prices: readonly number[],
  length: number,
  constraint?: WindowConstraint,
): PriceWindow | null {
  return pick(allWindows(prices, length, constraint), (a, b) => a > b + EPS)
}

/**
 * Energy cost in EUR for running a constant load over a window.
 * prices are EUR/MWh, power is kW, slotMinutes is the price resolution.
 */
export function windowCost(window: PriceWindow, powerKw: number, slotMinutes: number): number {
  const mwhPerSlot = (powerKw / 1000) * (slotMinutes / 60)
  return window.sum * mwhPerSlot
}
