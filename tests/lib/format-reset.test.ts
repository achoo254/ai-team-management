import { describe, it, expect } from 'vitest'
import { formatResetTime } from '../../packages/web/src/lib/format-reset.js'

// Fixed reference "now" for deterministic tests: 2026-04-05 15:00 local
const NOW = new Date(2026, 3, 5, 15, 0, 0)

function future(ms: number): string {
  return new Date(NOW.getTime() + ms).toISOString()
}

describe('formatResetTime', () => {
  it('null → em-dash', () => {
    const r = formatResetTime(null, NOW)
    expect(r.label).toBe('—')
    expect(r.isOverdue).toBe(false)
    expect(r.isImminent).toBe(false)
  })

  it('2 min future → imminent', () => {
    const r = formatResetTime(future(2 * 60_000), NOW)
    expect(r.isImminent).toBe(true)
    expect(r.label).toMatch(/^Sắp reset \(\d{2}:\d{2}\)$/)
  })

  it('30 min future → "Còn 30min"', () => {
    const r = formatResetTime(future(30 * 60_000), NOW)
    expect(r.label).toBe('Còn 30min (15:30)')
    expect(r.isImminent).toBe(false)
  })

  it('2h15 future (same day) → "Còn 2h15min"', () => {
    const r = formatResetTime(future((2 * 60 + 15) * 60_000), NOW)
    expect(r.label).toBe('Còn 2h15min (17:15)')
  })

  it('18h future (next day) → "Còn 18h (HH:MM mai)"', () => {
    const r = formatResetTime(future(18 * 3600_000), NOW)
    expect(r.label).toBe('Còn 18h (09:00 mai)')
  })

  it('3 days future → weekday label with days remaining', () => {
    const r = formatResetTime(future(3 * 24 * 3600_000 + 30 * 60_000), NOW)
    expect(r.label).toMatch(/^T[234567CN]+ \d{2}\/\d{2} ~\d{2}:\d{2} \(còn 3 ngày\)$/)
  })

  it('past ISO → overdue', () => {
    const r = formatResetTime(future(-10 * 60_000), NOW)
    expect(r.isOverdue).toBe(true)
    expect(r.label).toBe('Đang chờ cập nhật')
  })

  it('exactly 5 min → NOT imminent (boundary)', () => {
    const r = formatResetTime(future(5 * 60_000), NOW)
    expect(r.isImminent).toBe(false)
    expect(r.label).toBe('Còn 5min (15:05)')
  })
})
