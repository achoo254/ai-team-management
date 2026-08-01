/**
 * Exercises the REAL buildOverviewSection (and the efficiency section it
 * renders). An earlier version of this file kept a local copy of the formatter;
 * the copy drifted from the shipped code and stopped asserting anything real.
 */

import { describe, it, expect } from 'vitest'
import { buildOverviewSection } from '@/services/telegram-service'
import type { FleetKpis, FleetEfficiency } from '@repo/shared/types'

function makeEfficiency(overrides: Partial<FleetEfficiency> = {}): FleetEfficiency {
  return {
    optimal_count: 0,
    overload: [],
    waste: { seats: [], total_waste_usd: 0, total_waste_usd_monthly: 0 },
    unknown_count: 0,
    total_seats: 0,
    projected_util_pct: null,
    ...overrides,
  }
}

function makeKpis(overrides: Partial<FleetKpis> = {}): FleetKpis {
  return {
    utilPct: 54.5,
    cycleUtilPct: 86.2,
    lastCycleUtilPct: 98.2,
    cyclesConsidered: 4,
    wasteUsd: 103.4,
    projectedUtilPct: 99,
    projectedWasteUsd: 0,
    totalCostUsd: 750,
    monthlyCostUsd: 125,
    billableCount: 6,
    wwDelta: 10.5,
    ddDelta: null,
    worstForecast: null,
    exhaustedSeatCount: 0,
    staleSeatCount: 0,
    noDataSeatCount: 0,
    efficiency: null,
    ...overrides,
  }
}

const NO_RESETS = new Map<string, Date | null>()

describe('buildOverviewSection', () => {
  it('prices waste off completed cycles, not the running cycle', () => {
    const out = buildOverviewSection(makeKpis(), NO_RESETS)
    expect(out).toContain('Tận dụng TB 4 chu kỳ')
    expect(out).toContain('86%')
    expect(out).toContain('chu kỳ gần nhất 98%')
    expect(out).toContain('$103')
    // The mid-cycle counter must never be presented as the utilization figure.
    expect(out).not.toContain('55%')
  })

  it('labels the cycle-over-cycle delta in percentage points', () => {
    const out = buildOverviewSection(makeKpis({ wwDelta: -5.7 }), NO_RESETS)
    expect(out).toContain('-5.7 điểm %')
  })

  it('signs a positive delta explicitly', () => {
    const out = buildOverviewSection(makeKpis({ wwDelta: 10.5 }), NO_RESETS)
    expect(out).toContain('+10.5 điểm %')
  })

  it('omits the delta until two cycles have completed', () => {
    const out = buildOverviewSection(makeKpis({ wwDelta: null }), NO_RESETS)
    expect(out).not.toContain('điểm %')
    expect(out).toContain('chu kỳ gần nhất 98%')
  })

  it('says so plainly when no cycle has completed yet', () => {
    const out = buildOverviewSection(
      makeKpis({ cycleUtilPct: null, lastCycleUtilPct: null, cyclesConsidered: 0, wasteUsd: null }),
      NO_RESETS,
    )
    expect(out).toContain('chưa đủ một chu kỳ hoàn tất')
    expect(out).not.toContain('Lãng phí thực tế')
  })

  it('reports the running cycle as a projection, separate from actual waste', () => {
    const out = buildOverviewSection(makeKpis({ projectedUtilPct: 99 }), NO_RESETS)
    expect(out).toContain('Chu kỳ đang chạy: dự kiến đạt')
    expect(out).toContain('99%')
  })

  it('flags seats excluded for missing data', () => {
    const out = buildOverviewSection(makeKpis({ staleSeatCount: 1, noDataSeatCount: 2 }), NO_RESETS)
    expect(out).toContain('3 seat thiếu dữ liệu')
  })

  it('stays silent about missing data when every seat reported', () => {
    const out = buildOverviewSection(makeKpis(), NO_RESETS)
    expect(out).not.toContain('thiếu dữ liệu')
  })
})

describe('efficiency section', () => {
  const render = (eff: FleetEfficiency, resets = NO_RESETS) =>
    buildOverviewSection(makeKpis({ efficiency: eff }), resets)

  it('is omitted when there are no seats', () => {
    expect(render(makeEfficiency({ total_seats: 0 }))).not.toContain('HIỆU QUẢ SỬ DỤNG')
  })

  it('shows a collecting message when every seat is unknown', () => {
    const out = render(makeEfficiency({ total_seats: 5, unknown_count: 5 }))
    expect(out).toContain('⏸ Đang thu thập dữ liệu (5 seats)')
    expect(out).not.toContain('✅ Tối ưu')
  })

  it('shows all three buckets, with waste priced per month', () => {
    const out = render(makeEfficiency({
      total_seats: 12,
      optimal_count: 8,
      overload: [{ seat_id: 's1', seat_label: 'Seat_A', hours_early: 43.2 }],
      waste: {
        seats: [{ seat_id: 's2', seat_label: 'Seat_B', projected_pct: 60, waste_pct: 25, waste_usd: 7.3 }],
        total_waste_usd: 28,
        total_waste_usd_monthly: 120,
      },
      unknown_count: 2,
    }))
    expect(out).toContain('✅ Tối ưu:     8 seats')
    expect(out).toContain('🔴 Quá tải:    1 seat(s)')
    expect(out).toContain('Seat_A')
    expect(out).toContain('🟡 Lãng phí:   1 seats')
    // One unit across the whole message — no mixing $/cycle with $/month.
    expect(out).toContain('$120/tháng')
    expect(out).not.toContain('/chu kỳ')
    expect(out).toContain('⏸ Chưa đủ dữ liệu: 2 seats')
  })

  it('never contradicts the overview waste figure', () => {
    // 0 wasting seats must not sit next to a non-zero projected waste.
    const out = render(makeEfficiency({ total_seats: 6, optimal_count: 6 }))
    expect(out).toContain('🟡 Lãng phí:   0 seats')
    expect(out).toContain('Chu kỳ đang chạy')
  })

  it('shows 0 counts for empty buckets', () => {
    const out = render(makeEfficiency({ total_seats: 3, optimal_count: 3 }))
    expect(out).toContain('🔴 Quá tải:    0 seats')
    expect(out).toContain('🟡 Lãng phí:   0 seats')
    expect(out).not.toContain('⏸ Chưa đủ dữ liệu')
  })

  it('truncates the overload list at 3 seats and shows +N', () => {
    const overload = Array.from({ length: 5 }, (_, i) => ({
      seat_id: `s${i}`, seat_label: `Seat_${i}`, hours_early: 24,
    }))
    const out = render(makeEfficiency({ total_seats: 5, overload }))
    expect(out).toContain('Seat_0')
    expect(out).toContain('Seat_2')
    expect(out).not.toContain('Seat_3')
    expect(out).toContain('+2')
  })

  it('renders the exhaustion date when the reset boundary is known', () => {
    const resets = new Map<string, Date | null>([['s1', new Date('2026-08-05T00:00:00Z')]])
    const out = render(
      makeEfficiency({ total_seats: 1, overload: [{ seat_id: 's1', seat_label: 'Seat_A', hours_early: 48 }] }),
      resets,
    )
    // Separator between day and month is ICU/runtime dependent for vi-VN.
    expect(out).toMatch(/Seat_A \(cạn 03.08\)/)
  })

  it('escapes HTML in seat labels', () => {
    const out = render(makeEfficiency({
      total_seats: 1,
      overload: [{ seat_id: 's1', seat_label: '<script>alert("xss")</script>', hours_early: 12 }],
    }))
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script>')
  })

  it('contains zero exclamation marks', () => {
    const out = render(makeEfficiency({
      total_seats: 5,
      optimal_count: 2,
      overload: [{ seat_id: 's1', seat_label: 'A', hours_early: 48 }],
      waste: {
        seats: [{ seat_id: 's2', seat_label: 'B', projected_pct: 50, waste_pct: 35, waste_usd: 10 }],
        total_waste_usd: 10,
        total_waste_usd_monthly: 43,
      },
      unknown_count: 1,
    }))
    expect(out).not.toContain('!')
  })
})
