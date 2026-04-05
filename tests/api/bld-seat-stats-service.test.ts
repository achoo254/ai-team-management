/**
 * Tests for bld-seat-stats-service.ts
 * Uses vi.mock to isolate DB dependencies.
 * File is isolated from bld-metrics.test.ts to avoid mock pollution on
 * pure-function tests (getMonthlyCostUsd, etc.).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fakeId(n: number): string {
  return String(n).padStart(24, '0')
}

function fakeSeat(n: number, label: string, email = `seat${n}@company.vn`) {
  return { _id: { toString: () => fakeId(n) }, label, email }
}

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

vi.mock('../../packages/api/src/services/bld-metrics-service.js', () => ({
  getSeatsInScope: vi.fn(),
  getMonthlyCostUsd: vi.fn().mockReturnValue(125),
}))

vi.mock('../../packages/api/src/models/usage-snapshot.js', () => ({
  UsageSnapshot: {
    aggregate: vi.fn(),
    find: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    }),
  },
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  getSeatsInScope,
} from '../../packages/api/src/services/bld-metrics-service.js'
import { UsageSnapshot } from '../../packages/api/src/models/usage-snapshot.js'
import { computeSeatStats } from '../../packages/api/src/services/bld-seat-stats-service.js'
import type { MetricsScope } from '../../packages/api/src/services/bld-metrics-service.js'

const ADMIN_SCOPE: MetricsScope = { type: 'admin' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeSeatStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(UsageSnapshot.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    } as never)
  })

  it('returns empty response when no company seats', async () => {
    vi.mocked(getSeatsInScope).mockResolvedValue([])

    const result = await computeSeatStats(ADMIN_SCOPE)

    expect(result.topWaste).toHaveLength(0)
    expect(result.burndownRisk).toHaveLength(0)
    expect(result.degradationWatch).toHaveLength(0)
  })

  it('topWaste sorted by wasteUsd desc — lowest util = highest waste', async () => {
    const seats = [1, 2, 3].map(n => fakeSeat(n, `Seat ${n}`))
    vi.mocked(getSeatsInScope).mockResolvedValue(seats as never)

    // Seat 1: 10% util → 90% waste, Seat 2: 90% → 10%, Seat 3: 50% → 50%
    vi.mocked(UsageSnapshot.aggregate)
      .mockResolvedValueOnce([
        { _id: fakeId(1), seven_day_pct: 10 },
        { _id: fakeId(2), seven_day_pct: 90 },
        { _id: fakeId(3), seven_day_pct: 50 },
      ])
      .mockResolvedValueOnce([]) // 7d-ago

    const result = await computeSeatStats(ADMIN_SCOPE)

    // Most waste = seat1 (10% util → 0.9 * 125 = 112.5)
    expect(result.topWaste[0].seatLabel).toBe('Seat 1')
    expect(result.topWaste[0].wasteUsd).toBeCloseTo(112.5)
    expect(result.topWaste[0].wastePct).toBeCloseTo(90)
    // Least waste = seat2 (90% util → 0.1 * 125 = 12.5)
    const last = result.topWaste[result.topWaste.length - 1]
    expect(last.seatLabel).toBe('Seat 2')
    expect(last.wasteUsd).toBeCloseTo(12.5)
  })

  it('burndownRisk: seat with 3+ consecutive days ≥80% is included', async () => {
    const seats = [fakeSeat(1, 'Heavy Seat')]
    vi.mocked(getSeatsInScope).mockResolvedValue(seats as never)

    vi.mocked(UsageSnapshot.aggregate)
      .mockResolvedValueOnce([{ _id: fakeId(1), seven_day_pct: 85 }]) // current
      .mockResolvedValueOnce([]) // 7d-ago

    // Build 4 days of snapshots at ≥80%
    const now = new Date()
    const snapRows = [0, 1, 2, 3].flatMap(daysAgo => {
      const d = new Date(now.getTime() - daysAgo * 24 * 3600_000)
      return [
        { seat_id: fakeId(1), seven_day_pct: 82, fetched_at: d },
        { seat_id: fakeId(1), seven_day_pct: 85, fetched_at: new Date(d.getTime() + 3600_000) },
      ]
    })
    vi.mocked(UsageSnapshot.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue(snapRows),
    } as never)

    const result = await computeSeatStats(ADMIN_SCOPE)

    expect(result.burndownRisk).toHaveLength(1)
    expect(result.burndownRisk[0].seatLabel).toBe('Heavy Seat')
    expect(result.burndownRisk[0].consecutiveDays).toBeGreaterThanOrEqual(3)
    expect(result.burndownRisk[0].latestUtilPct).toBe(85)
  })

  it('burndownRisk: seat with only 2 consecutive days ≥80% is excluded', async () => {
    const seats = [fakeSeat(1, 'Seat A')]
    vi.mocked(getSeatsInScope).mockResolvedValue(seats as never)

    vi.mocked(UsageSnapshot.aggregate)
      .mockResolvedValueOnce([{ _id: fakeId(1), seven_day_pct: 82 }])
      .mockResolvedValueOnce([])

    // Only 2 days of ≥80% data
    const now = new Date()
    const snapRows = [0, 1].flatMap(daysAgo => {
      const d = new Date(now.getTime() - daysAgo * 24 * 3600_000)
      return [{ seat_id: fakeId(1), seven_day_pct: 85, fetched_at: d }]
    })
    vi.mocked(UsageSnapshot.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue(snapRows),
    } as never)

    const result = await computeSeatStats(ADMIN_SCOPE)

    expect(result.burndownRisk).toHaveLength(0)
  })

  it('degradationWatch: drop ≥10pp W/W included; drop <10pp excluded; no history skipped', async () => {
    // Seat 1: current 50%, lastWeek 65% → drop 15pp → included
    // Seat 2: current 70%, lastWeek 75% → drop 5pp  → excluded
    // Seat 3: current 40%, no lastWeek snapshot      → skipped
    const seats = [1, 2, 3].map(n => fakeSeat(n, `Seat ${n}`))
    vi.mocked(getSeatsInScope).mockResolvedValue(seats as never)

    vi.mocked(UsageSnapshot.aggregate)
      .mockResolvedValueOnce([
        { _id: fakeId(1), seven_day_pct: 50 },
        { _id: fakeId(2), seven_day_pct: 70 },
        { _id: fakeId(3), seven_day_pct: 40 },
      ])
      .mockResolvedValueOnce([
        // seat 3 missing → skipped
        { _id: fakeId(1), seven_day_pct: 65 },
        { _id: fakeId(2), seven_day_pct: 75 },
      ])

    const result = await computeSeatStats(ADMIN_SCOPE)

    expect(result.degradationWatch).toHaveLength(1)
    expect(result.degradationWatch[0].seatLabel).toBe('Seat 1')
    expect(result.degradationWatch[0].dropPp).toBeCloseTo(15)
    expect(result.degradationWatch[0].currentUtilPct).toBe(50)
    expect(result.degradationWatch[0].lastWeekUtilPct).toBe(65)
  })

  // ── User scope: only seat_ids from user, no company filter ─────────────────

  it('user scope: returns only stats for user-owned seats', async () => {
    // 3 seats exist in DB; user only has seat 1
    const seat1 = fakeSeat(1, 'My Seat')
    const userScope: MetricsScope = { type: 'user', seatIds: [fakeId(1)] }

    // getSeatsInScope resolves to seat1 only (simulating DB lookup by id)
    vi.mocked(getSeatsInScope).mockResolvedValue([seat1] as never)

    vi.mocked(UsageSnapshot.aggregate)
      .mockResolvedValueOnce([{ _id: fakeId(1), seven_day_pct: 20 }]) // current — 80% waste
      .mockResolvedValueOnce([]) // 7d-ago

    const result = await computeSeatStats(userScope)

    // Only seat1 in result
    expect(result.topWaste).toHaveLength(1)
    expect(result.topWaste[0].seatLabel).toBe('My Seat')
    expect(result.topWaste[0].wastePct).toBeCloseTo(80)
  })

  it('user scope with empty seat_ids returns empty stats', async () => {
    const userScope: MetricsScope = { type: 'user', seatIds: [] }
    vi.mocked(getSeatsInScope).mockResolvedValue([])

    const result = await computeSeatStats(userScope)

    expect(result.topWaste).toHaveLength(0)
    expect(result.burndownRisk).toHaveLength(0)
    expect(result.degradationWatch).toHaveLength(0)
  })

  // ── include_in_overview: admin scope scoping ──────────────────────────────

  it('admin scope: getSeatsInScope is called with { type: "admin" } — returns only include_in_overview seats', async () => {
    // Only seat with include_in_overview=true should appear in results.
    // The actual DB filter is on the Seat model; here we verify the mock contract:
    // getSeatsInScope resolves to only the opted-in seat (simulating DB filter).
    const overviewSeat = { ...fakeSeat(10, 'Overview Seat'), include_in_overview: true }
    vi.mocked(getSeatsInScope).mockResolvedValue([overviewSeat] as never)

    vi.mocked(UsageSnapshot.aggregate)
      .mockResolvedValueOnce([{ _id: fakeId(10), seven_day_pct: 40 }])
      .mockResolvedValueOnce([])

    const result = await computeSeatStats(ADMIN_SCOPE)

    expect(getSeatsInScope).toHaveBeenCalledWith(ADMIN_SCOPE)
    expect(result.topWaste).toHaveLength(1)
    expect(result.topWaste[0].seatLabel).toBe('Overview Seat')
  })

  it('admin scope: non-overview seats are excluded when getSeatsInScope returns empty', async () => {
    // Simulates the case where no seat has include_in_overview=true
    vi.mocked(getSeatsInScope).mockResolvedValue([])

    const result = await computeSeatStats(ADMIN_SCOPE)

    expect(result.topWaste).toHaveLength(0)
    expect(result.burndownRisk).toHaveLength(0)
    expect(result.degradationWatch).toHaveLength(0)
  })
})
