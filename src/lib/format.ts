const MINUS = '−'

export function signed(n: number, digits = 2): string {
  const s = Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return n < -1e-9 ? `${MINUS}${s}` : s
}

export function euro(n: number): string {
  const s = Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < -0.004 ? `${MINUS}€${s}` : `€${s}`
}

export function price(n: number): string {
  return `${signed(n)} €/MWh`
}

export function hours(slots: number, slotMinutes: number): string {
  const h = (slots * slotMinutes) / 60
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, '')} h`
}
