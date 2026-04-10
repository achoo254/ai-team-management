import { describe, it, expect } from 'vitest'
import { classifyEfficiency } from '@/services/quota-efficiency-service'
import type { SeatForecast } from '@/services/quota-forecast-service'

/** Helper: create a SeatForecast with sensible defaults */
function makeForecast(overrides: Partial<SeatForecast> = {}): SeatForecast {
  return {
    seat_id: 's1',
    seat_label: 'Test Seat',
    current_pct: 50,
    slope_per_hour: 0.5,
    hours_to_full: null,
    forecast_at: null,
    status: 'watch',
    resets_at: null,
    ...overrides,
  }
}

/** Helper: create a Date relative to a reset date, positioned at a specific point in the 7-day cycle */
function makeTimeContext(hoursSinceReset: number) {
  const now = new Date('2026-04-10T12:00:00Z')
  // resets_at = cycleStart + 7 days
  const cycleStart = new Date(now.getTime() - hoursSinceReset * 3600_000)
  const resetsAt = new Date(cycleStart.getTime() + 7 * 24 * 3600_000)
  const hoursToReset = (resetsAt.getTime() - now.getTime()) / 3600_000
  return { now, resetsAt: resetsAt.toISOString(), hoursToReset }
}

describe('classifyEfficiency', () => {
  it('returns unknown for collecting status', () => {
    const f = makeForecast({ status: 'collecting' })
    const result = classifyEfficiency(f, new Date())
    expect(result.bucket).toBe('unknown')
  })

  it('returns unknown when resets_at is null', () => {
    const f = makeForecast({ resets_at: null, status: 'watch' })
    const result = classifyEfficiency(f, new Date())
    expect(result.bucket).toBe('unknown')
  })

  it('returns unknown when reset time has passed (hoursToReset <= 0)', () => {
    const pastReset = new Date(Date.now() - 3600_000).toISOString()
    const f = makeForecast({ resets_at: pastReset, status: 'watch' })
    const result = classifyEfficiency(f, new Date())
    expect(result.bucket).toBe('unknown')
  })

  it('returns unknown when less than 24h into cycle', () => {
    const { now, resetsAt } = makeTimeContext(12) // only 12h into cycle
    const f = makeForecast({ resets_at: resetsAt, status: 'watch' })
    const result = classifyEfficiency(f, now)
    expect(result.bucket).toBe('unknown')
  })

  it('classifies overload when projected >= 100%', () => {
    const { now, resetsAt, hoursToReset } = makeTimeContext(72) // 72h in, ~96h left
    // slope such that projected = current + slope * hoursToReset >= 100
    // 50 + slope * 96 >= 100 → slope >= 0.52
    const f = makeForecast({
      resets_at: resetsAt,
      status: 'warning',
      current_pct: 50,
      slope_per_hour: 0.6,
      hours_to_full: 83.3, // (100-50)/0.6
    })
    const result = classifyEfficiency(f, now)
    expect(result.bucket).toBe('overload')
    expect(result.projected_pct).toBe(100)
    expect(result.hours_early).toBeGreaterThan(0)
  })

  it('classifies optimal when projected between 85-99%', () => {
    const { now, resetsAt, hoursToReset } = makeTimeContext(72)
    // projected = 50 + slope * hoursToReset ≈ 92
    // slope = (92 - 50) / hoursToReset
    const slope = (92 - 50) / hoursToReset
    const f = makeForecast({
      resets_at: resetsAt,
      status: 'watch',
      current_pct: 50,
      slope_per_hour: slope,
    })
    const result = classifyEfficiency(f, now)
    expect(result.bucket).toBe('optimal')
    expect(result.projected_pct).toBe(92)
  })

  it('classifies optimal at boundary (projected = 85%)', () => {
    const { now, resetsAt, hoursToReset } = makeTimeContext(72)
    const slope = (85 - 50) / hoursToReset
    const f = makeForecast({
      resets_at: resetsAt,
      status: 'watch',
      current_pct: 50,
      slope_per_hour: slope,
    })
    const result = classifyEfficiency(f, now)
    expect(result.bucket).toBe('optimal')
    expect(result.projected_pct).toBe(85)
  })

  it('classifies waste when projected = 84% (just below boundary)', () => {
    const { now, resetsAt, hoursToReset } = makeTimeContext(72)
    const slope = (84 - 50) / hoursToReset
    const f = makeForecast({
      resets_at: resetsAt,
      status: 'watch',
      current_pct: 50,
      slope_per_hour: slope,
    })
    const result = classifyEfficiency(f, now)
    expect(result.bucket).toBe('waste')
    expect(result.waste_pct).toBe(1) // 85 - 84
  })

  it('classifies waste when projected = 60%', () => {
    const { now, resetsAt, hoursToReset } = makeTimeContext(72)
    const slope = (60 - 50) / hoursToReset
    const f = makeForecast({
      resets_at: resetsAt,
      status: 'watch',
      current_pct: 50,
      slope_per_hour: slope,
    })
    const result = classifyEfficiency(f, now)
    expect(result.bucket).toBe('waste')
    expect(result.projected_pct).toBe(60)
    expect(result.waste_pct).toBe(25) // 85 - 60
  })

  it('classifies waste for stale seat (slope = 0, current = 40%)', () => {
    const { now, resetsAt } = makeTimeContext(72)
    const f = makeForecast({
      resets_at: resetsAt,
      status: 'safe_decreasing',
      current_pct: 40,
      slope_per_hour: 0,
    })
    const result = classifyEfficiency(f, now)
    expect(result.bucket).toBe('waste')
    expect(result.projected_pct).toBe(40)
    expect(result.waste_pct).toBe(45) // 85 - 40
  })
})
