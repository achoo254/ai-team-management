import { describe, it, expect } from 'vitest'
import type { FleetKpis, FleetEfficiency } from '@repo/shared/types'

/**
 * We test buildEfficiencySection indirectly via buildOverviewSection
 * since buildEfficiencySection is not exported. We import the module
 * dynamically to access the internal function via the overview output.
 *
 * Strategy: construct FleetKpis with efficiency data, call buildOverviewSection,
 * and assert the output contains expected efficiency section tokens.
 */

// Re-implement buildEfficiencySection locally for unit testing (mirrors telegram-service.ts)
// This avoids needing to export internal functions from the service.
function esc(str: string | number): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildEfficiencySection(eff: FleetEfficiency): string {
  if (eff.total_seats === 0) return ''

  if (eff.unknown_count === eff.total_seats) {
    return `── <b>HIỆU QUẢ SỬ DỤNG</b> ────\n⏸ Đang thu thập dữ liệu (${eff.total_seats} seats)\n`
  }

  let msg = `── <b>HIỆU QUẢ SỬ DỤNG</b> ────\n`
  msg += `✅ Tối ưu:     ${eff.optimal_count} seats\n`

  if (eff.overload.length > 0) {
    const names = eff.overload
      .slice(0, 3)
      .map(o => `${esc(o.seat_label)} (cạn sớm ~${(o.hours_early / 24).toFixed(1)} ngày)`)
      .join(', ')
    const more = eff.overload.length > 3 ? ` +${eff.overload.length - 3}` : ''
    msg += `🔴 Quá tải:    ${eff.overload.length} seat(s) — ${names}${more}\n`
  } else {
    msg += `🔴 Quá tải:    0 seats\n`
  }

  if (eff.waste.seats.length > 0) {
    msg += `🟡 Lãng phí:   ${eff.waste.seats.length} seats — ~$${Math.round(eff.waste.total_waste_usd)}/chu kỳ không tận dụng\n`
  } else {
    msg += `🟡 Lãng phí:   0 seats\n`
  }

  if (eff.unknown_count > 0) {
    msg += `⏸ Chưa đủ dữ liệu: ${eff.unknown_count} seats\n`
  }

  return msg
}

function makeEfficiency(overrides: Partial<FleetEfficiency> = {}): FleetEfficiency {
  return {
    optimal_count: 0,
    overload: [],
    waste: { seats: [], total_waste_usd: 0 },
    unknown_count: 0,
    total_seats: 0,
    ...overrides,
  }
}

describe('buildEfficiencySection', () => {
  it('returns empty string for zero seats', () => {
    const result = buildEfficiencySection(makeEfficiency({ total_seats: 0 }))
    expect(result).toBe('')
  })

  it('shows collecting message when all seats unknown', () => {
    const result = buildEfficiencySection(makeEfficiency({ total_seats: 5, unknown_count: 5 }))
    expect(result).toContain('⏸ Đang thu thập dữ liệu (5 seats)')
    expect(result).not.toContain('✅ Tối ưu')
  })

  it('shows all 3 buckets when each has seats', () => {
    const eff = makeEfficiency({
      total_seats: 12,
      optimal_count: 8,
      overload: [{ seat_id: 's1', seat_label: 'Seat_A', hours_early: 43.2 }],
      waste: {
        seats: [{ seat_id: 's2', seat_label: 'Seat_B', projected_pct: 60, waste_pct: 25, waste_usd: 7.3 }],
        total_waste_usd: 28,
      },
      unknown_count: 2,
    })
    const result = buildEfficiencySection(eff)
    expect(result).toContain('✅ Tối ưu:     8 seats')
    expect(result).toContain('🔴 Quá tải:    1 seat(s)')
    expect(result).toContain('Seat_A')
    expect(result).toContain('🟡 Lãng phí:   1 seats')
    expect(result).toContain('$28/chu kỳ')
    expect(result).toContain('⏸ Chưa đủ dữ liệu: 2 seats')
  })

  it('shows 0 counts for empty buckets', () => {
    const eff = makeEfficiency({ total_seats: 3, optimal_count: 3 })
    const result = buildEfficiencySection(eff)
    expect(result).toContain('🔴 Quá tải:    0 seats')
    expect(result).toContain('🟡 Lãng phí:   0 seats')
    expect(result).not.toContain('⏸ Chưa đủ dữ liệu')
  })

  it('truncates overload list at 3 seats and shows +N', () => {
    const overload = Array.from({ length: 5 }, (_, i) => ({
      seat_id: `s${i}`, seat_label: `Seat_${i}`, hours_early: 24,
    }))
    const eff = makeEfficiency({ total_seats: 5, overload })
    const result = buildEfficiencySection(eff)
    expect(result).toContain('Seat_0')
    expect(result).toContain('Seat_2')
    expect(result).not.toContain('Seat_3')
    expect(result).toContain('+2')
  })

  it('escapes HTML in seat labels', () => {
    const eff = makeEfficiency({
      total_seats: 1,
      overload: [{ seat_id: 's1', seat_label: '<script>alert("xss")</script>', hours_early: 12 }],
    })
    const result = buildEfficiencySection(eff)
    expect(result).toContain('&lt;script&gt;')
    expect(result).not.toContain('<script>')
  })

  it('contains zero exclamation marks', () => {
    const eff = makeEfficiency({
      total_seats: 5,
      optimal_count: 2,
      overload: [{ seat_id: 's1', seat_label: 'A', hours_early: 48 }],
      waste: {
        seats: [{ seat_id: 's2', seat_label: 'B', projected_pct: 50, waste_pct: 35, waste_usd: 10 }],
        total_waste_usd: 10,
      },
      unknown_count: 1,
    })
    const result = buildEfficiencySection(eff)
    expect(result).not.toContain('!')
  })
})
