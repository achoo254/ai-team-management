/**
 * Seat cost is read from one place so the SEAT_MONTHLY_COST_USD override can
 * never make the overview line and the efficiency line disagree.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { getMonthlyCostUsd, getCycleCostUsd, cycleUsdToMonthly } from '@/services/seat-cost'

afterEach(() => {
  delete process.env.SEAT_MONTHLY_COST_USD
})

describe('seat cost', () => {
  it('derives the 7-day cycle cost from the monthly cost', () => {
    expect(getCycleCostUsd()).toBeCloseTo(125 * 7 / 30)
  })

  it('cycle cost follows the env override', () => {
    process.env.SEAT_MONTHLY_COST_USD = '200'
    expect(getMonthlyCostUsd()).toBe(200)
    expect(getCycleCostUsd()).toBeCloseTo(200 * 7 / 30)
  })

  it('reads the env on every call, not once at import', () => {
    expect(getMonthlyCostUsd()).toBe(125)
    process.env.SEAT_MONTHLY_COST_USD = '300'
    expect(getMonthlyCostUsd()).toBe(300)
  })

  it('round-trips between cycle and monthly amounts', () => {
    expect(cycleUsdToMonthly(getCycleCostUsd())).toBeCloseTo(getMonthlyCostUsd())
  })
})
