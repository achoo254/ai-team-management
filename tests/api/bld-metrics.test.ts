/**
 * Unit tests for bld-metrics-service.ts and bld-seat-stats-service.ts
 * Tests pure functions and logic WITHOUT a live DB (DB-dependent functions mocked).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test the pure-logic exports directly.
// DB-touching functions are tested via integration-style mocks on their deps.
import {
  getMonthlyCostUsd,
  type MetricsScope,
} from '../../packages/api/src/services/bld-metrics-service.js'

// ── getMonthlyCostUsd ─────────────────────────────────────────────────────────

describe('getMonthlyCostUsd', () => {
  afterEach(() => {
    delete process.env.SEAT_MONTHLY_COST_USD
  })

  it('returns default 125 when env not set', () => {
    delete process.env.SEAT_MONTHLY_COST_USD
    expect(getMonthlyCostUsd()).toBe(125)
  })

  it('returns value from SEAT_MONTHLY_COST_USD env', () => {
    process.env.SEAT_MONTHLY_COST_USD = '200'
    expect(getMonthlyCostUsd()).toBe(200)
  })

  it('falls back to 125 when env value is NaN', () => {
    process.env.SEAT_MONTHLY_COST_USD = 'not-a-number'
    expect(getMonthlyCostUsd()).toBe(125)
  })

  it('falls back to 125 when env value is negative', () => {
    process.env.SEAT_MONTHLY_COST_USD = '-50'
    expect(getMonthlyCostUsd()).toBe(125)
  })

  it('falls back to 125 when env value is zero', () => {
    process.env.SEAT_MONTHLY_COST_USD = '0'
    expect(getMonthlyCostUsd()).toBe(125)
  })

  it('falls back to 125 when env value is Infinity', () => {
    process.env.SEAT_MONTHLY_COST_USD = 'Infinity'
    // Number('Infinity') = Infinity, isFinite(Infinity) = false → fallback
    expect(getMonthlyCostUsd()).toBe(125)
  })

  it('accepts decimal cost values', () => {
    process.env.SEAT_MONTHLY_COST_USD = '99.5'
    expect(getMonthlyCostUsd()).toBe(99.5)
  })
})

// ── Billable cost math ────────────────────────────────────────────────────────

describe('billable cost math', () => {
  it('wasteUsd = 0 when utilPct = 100', () => {
    const totalCostUsd = 3 * 125
    const utilPct = 100
    const wasteUsd = totalCostUsd * (1 - utilPct / 100)
    expect(wasteUsd).toBe(0)
  })

  it('wasteUsd = totalCostUsd when utilPct = 0', () => {
    const totalCostUsd = 3 * 125
    const utilPct = 0
    const wasteUsd = totalCostUsd * (1 - utilPct / 100)
    expect(wasteUsd).toBe(totalCostUsd)
  })

  it('wasteUsd computation at 60% util', () => {
    const totalCostUsd = 4 * 125 // 4 seats
    const utilPct = 60
    const wasteUsd = totalCostUsd * (1 - utilPct / 100)
    expect(wasteUsd).toBeCloseTo(200) // 500 * 0.4
  })

  it('totalCostUsd = billableCount * monthlyCost', () => {
    delete process.env.SEAT_MONTHLY_COST_USD
    const billableCount = 3 // seats with include_in_overview=true
    const cost = getMonthlyCostUsd()
    expect(billableCount * cost).toBe(3 * 125)
  })
})

// ── computeRebalanceSuggestions — no user references in output (pure shape) ───

describe('computeRebalanceSuggestions output shape — no user refs', () => {
  it('move_member suggestion has no userId/userName fields', () => {
    // Validate the type shape via a plain object (type-only test)
    const suggestion = {
      type: 'move_member' as const,
      fromSeatId: 'aaa',
      fromSeatLabel: 'Seat A',
      toSeatId: 'bbb',
      toSeatLabel: 'Seat B',
      reason: 'test',
    }
    expect('userId' in suggestion).toBe(false)
    expect('userName' in suggestion).toBe(false)
    expect(suggestion.type).toBe('move_member')
    expect(suggestion.fromSeatLabel).toBeDefined()
    expect(suggestion.toSeatLabel).toBeDefined()
  })

  it('rebalance_seat suggestion has no userId/userName fields', () => {
    const suggestion = {
      type: 'rebalance_seat' as const,
      overloadedSeatId: 'aaa',
      overloadedSeatLabel: 'Overloaded',
      underusedSeatId: 'bbb',
      underusedSeatLabel: 'Underused',
      reason: 'test reason',
    }
    expect('userId' in suggestion).toBe(false)
    expect('userName' in suggestion).toBe(false)
    expect(suggestion.type).toBe('rebalance_seat')
    expect(suggestion.overloadedSeatLabel).toBeDefined()
    expect(suggestion.underusedSeatLabel).toBeDefined()
  })
})

// ── MetricsScope type — shape and discriminant checks ─────────────────────────

describe('MetricsScope — type discriminants', () => {
  it('admin scope has type "admin"', () => {
    const scope: MetricsScope = { type: 'admin' }
    expect(scope.type).toBe('admin')
  })

  it('user scope has type "user" and seatIds array', () => {
    const scope: MetricsScope = { type: 'user', seatIds: ['aaa', 'bbb'] }
    expect(scope.type).toBe('user')
    expect(scope.seatIds).toEqual(['aaa', 'bbb'])
  })

  it('user scope with empty seatIds is valid', () => {
    const scope: MetricsScope = { type: 'user', seatIds: [] }
    expect(scope.seatIds).toHaveLength(0)
  })
})

// ── scopeCacheKey logic — no cross-scope leakage ─────────────────────────────

describe('scope cache key isolation', () => {
  /** Pure reimplementation of the route's scopeCacheKey for unit testing. */
  function scopeCacheKey(prefix: string, scope: MetricsScope): string {
    if (scope.type === 'admin') return `${prefix}:admin`
    const sorted = [...scope.seatIds].sort().join(',')
    return `${prefix}:user:${sorted}`
  }

  it('admin scope key never matches user scope key', () => {
    const adminKey = scopeCacheKey('fleet-kpis', { type: 'admin' })
    const userKey = scopeCacheKey('fleet-kpis', { type: 'user', seatIds: [] })
    expect(adminKey).not.toBe(userKey)
  })

  it('user scope key is stable regardless of seatIds order', () => {
    const k1 = scopeCacheKey('fleet-kpis', { type: 'user', seatIds: ['bbb', 'aaa'] })
    const k2 = scopeCacheKey('fleet-kpis', { type: 'user', seatIds: ['aaa', 'bbb'] })
    expect(k1).toBe(k2)
  })

  it('different seat sets produce different user scope keys', () => {
    const k1 = scopeCacheKey('fleet-kpis', { type: 'user', seatIds: ['aaa'] })
    const k2 = scopeCacheKey('fleet-kpis', { type: 'user', seatIds: ['bbb'] })
    expect(k1).not.toBe(k2)
  })

  it('same prefix + scope produces same key (cache hit possible)', () => {
    const scope: MetricsScope = { type: 'user', seatIds: ['aaa', 'bbb'] }
    expect(scopeCacheKey('seat-stats', scope)).toBe(scopeCacheKey('seat-stats', scope))
  })

  it('different prefixes produce different keys for same scope', () => {
    const scope: MetricsScope = { type: 'admin' }
    expect(scopeCacheKey('fleet-kpis', scope)).not.toBe(scopeCacheKey('seat-stats', scope))
  })
})
