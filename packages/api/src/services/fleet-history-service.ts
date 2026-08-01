/**
 * Fleet trend history.
 *
 * The utilization trend is keyed on completed quota cycles, not calendar weeks —
 * a calendar bucket cuts across resets and would sample the sawtooth at an
 * arbitrary phase.
 */

import mongoose from 'mongoose'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { computeFleetCycleUtilization } from './cycle-utilization-service.js'
import { getSeatsInScope, type MetricsScope } from './metrics-scope.js'
import { getMonthlyCostUsd } from './seat-cost.js'
import type { WwHistoryPoint, DdHistoryPoint } from '@repo/shared/types'

const DAY_MS = 24 * 60 * 60 * 1000

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/** One point per completed quota cycle, oldest first. */
export async function computeWwHistory(
  scope: MetricsScope = { type: 'admin' },
  weeks = 8,
): Promise<WwHistoryPoint[]> {
  const MONTHLY_COST_USD = getMonthlyCostUsd()
  const seats = await getSeatsInScope(scope)
  if (seats.length === 0) return []

  const cycles = await computeFleetCycleUtilization(seats, new Date(), weeks)

  const points: WwHistoryPoint[] = []
  for (let k = weeks - 1; k >= 0; k--) {
    const atK = cycles.seats
      .map(s => s.completed[k])
      .filter((c): c is NonNullable<typeof c> => c != null)
    if (atK.length === 0) continue

    const wasteUsd = atK.reduce(
      (sum, c) => sum + MONTHLY_COST_USD * Math.max(0, 1 - c.peak_pct / 100),
      0,
    )
    // Cycle boundaries differ per seat by a few hours; label with the earliest.
    const cycleEnd = atK
      .map(c => new Date(c.resets_at).getTime())
      .reduce((a, b) => Math.min(a, b))

    points.push({
      week_start: new Date(cycleEnd - 7 * DAY_MS).toISOString(),
      utilPct: avg(atK.map(c => c.peak_pct)),
      wasteUsd,
    })
  }
  return points
}

/** Fleet avg of per-seat peak five_hour_pct, one point per VN calendar day. */
export async function computeDdHistory(
  scope: MetricsScope = { type: 'admin' },
  days = 14,
): Promise<DdHistoryPoint[]> {
  const seats = await getSeatsInScope(scope)
  if (seats.length === 0) return []

  const seatIds = seats.map(s => new mongoose.Types.ObjectId(String(s._id)))
  const startDate = new Date(Date.now() - days * DAY_MS)

  const results = await UsageSnapshot.aggregate([
    {
      $match: {
        seat_id: { $in: seatIds },
        five_hour_pct: { $ne: null },
        fetched_at: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          seat_id: '$seat_id',
          day: { $dateToString: { format: '%Y-%m-%d', date: '$fetched_at', timezone: 'Asia/Ho_Chi_Minh' } },
        },
        peak: { $max: '$five_hour_pct' },
      },
    },
    { $group: { _id: '$_id.day', avgPeak5h: { $avg: '$peak' } } },
    { $sort: { _id: 1 as const } },
  ])

  return results.map(r => ({
    date: r._id,
    avgPeak5h: Number((r.avgPeak5h ?? 0).toFixed(1)),
  }))
}
