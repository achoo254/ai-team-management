/**
 * Fleet-level KPIs.
 *
 * Two different questions, two different numbers — never mixed:
 *  - What did we actually waste?  -> completed cycles (cycle-utilization-service)
 *  - Are we on track this cycle?  -> projection (quota-efficiency-service)
 *
 * `seven_day_pct` sampled right now only says how deep into the current cycle we
 * are, so it is reported as `utilPct` and never used to price waste.
 */

import mongoose from 'mongoose'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { computeAllSeatForecasts } from './quota-forecast-service.js'
import { computeFleetEfficiency } from './quota-efficiency-service.js'
import { computeFleetCycleUtilization } from './cycle-utilization-service.js'
import { getSeatsInScope, type MetricsScope } from './metrics-scope.js'
import { getMonthlyCostUsd } from './seat-cost.js'
import type { FleetKpis } from '@repo/shared/types'

/** A seat whose newest snapshot is older than this has a broken collector; its
 *  frozen value must not keep feeding the fleet average. 12x the 5-min cron. */
const STALE_AFTER_MS = 60 * 60 * 1000

/** Asia/Ho_Chi_Minh is UTC+7 year-round (no DST). */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// ── Snapshot helpers ──────────────────────────────────────────────────────────

interface LatestSnap {
  seat_id: string
  seven_day_pct: number
  fetched_at: Date
}

async function latestSnapshotsFor(seatIds: string[]): Promise<LatestSnap[]> {
  if (seatIds.length === 0) return []
  const results = await UsageSnapshot.aggregate([
    { $match: { seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) }, seven_day_pct: { $ne: null } } },
    { $sort: { fetched_at: -1 } },
    { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' }, fetched_at: { $first: '$fetched_at' } } },
  ])
  return results.map(r => ({
    seat_id: String(r._id),
    seven_day_pct: r.seven_day_pct ?? 0,
    fetched_at: new Date(r.fetched_at),
  }))
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/** UTC bounds of the Asia/Ho_Chi_Minh calendar day containing `date`. */
function vnDayBoundsUtc(date: Date): { start: Date; end: Date } {
  const dayStartVn = Math.floor((date.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS
  return {
    start: new Date(dayStartVn - VN_OFFSET_MS),
    end: new Date(dayStartVn + DAY_MS - VN_OFFSET_MS - 1),
  }
}

/**
 * Fleet average of per-seat peak five_hour_pct for one VN calendar day.
 * Returns null when no seat reported that day.
 */
async function dailyFleetIntensity(seatIds: string[], date: Date): Promise<number | null> {
  if (seatIds.length === 0) return null
  const { start, end } = vnDayBoundsUtc(date)

  const results = await UsageSnapshot.aggregate([
    {
      $match: {
        seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) },
        five_hour_pct: { $ne: null },
        fetched_at: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: '$seat_id', peak: { $max: '$five_hour_pct' } } },
  ])
  if (results.length === 0) return null
  return avg(results.map(r => r.peak ?? 0))
}

// ── Fleet KPIs ────────────────────────────────────────────────────────────────

export async function computeFleetKpis(scope: MetricsScope = { type: 'admin' }): Promise<FleetKpis> {
  const MONTHLY_COST_USD = getMonthlyCostUsd()
  const seats = await getSeatsInScope(scope)
  const billableCount = seats.length
  const totalCostUsd = billableCount * MONTHLY_COST_USD

  if (billableCount === 0) {
    return {
      utilPct: 0, cycleUtilPct: null, lastCycleUtilPct: null, cyclesConsidered: 0,
      wasteUsd: null, projectedUtilPct: null, projectedWasteUsd: null,
      totalCostUsd: 0, monthlyCostUsd: MONTHLY_COST_USD, billableCount: 0,
      wwDelta: null, ddDelta: null, worstForecast: null,
      exhaustedSeatCount: 0, staleSeatCount: 0, noDataSeatCount: 0, efficiency: null,
    }
  }

  const seatIds = seats.map(s => String(s._id))
  const now = new Date()

  const [snaps, todayIntensity, yesterdayIntensity, forecasts, cycles] = await Promise.all([
    latestSnapshotsFor(seatIds),
    dailyFleetIntensity(seatIds, now),
    dailyFleetIntensity(seatIds, new Date(now.getTime() - DAY_MS)),
    computeAllSeatForecasts(seatIds),
    computeFleetCycleUtilization(seats, now),
  ])

  // Cycle-to-date consumption, fresh readings only — a frozen snapshot from a
  // dead collector would otherwise sit in the average forever.
  const fresh = snaps.filter(s => now.getTime() - s.fetched_at.getTime() <= STALE_AFTER_MS)
  const utilPct = avg(fresh.map(s => s.seven_day_pct))
  const staleSeatCount = snaps.length - fresh.length
  const noDataSeatCount = billableCount - snaps.length

  // Waste is summed per seat with data, so a seat we know nothing about
  // contributes $0 instead of reading as 100% wasted.
  const seatsWithCycleData = cycles.seats.filter(s => s.avgPct != null)
  const wasteUsd = cycles.avgUtilPct == null
    ? null
    : seatsWithCycleData.reduce(
        (sum, s) => sum + MONTHLY_COST_USD * Math.max(0, 1 - s.avgPct! / 100),
        0,
      )

  const ddDelta = todayIntensity != null && yesterdayIntensity != null
    ? todayIntensity - yesterdayIntensity
    : null

  // Bỏ qua seat đã cạn quota (hours_to_full=0, pct>=100) — đó là "đã hết"
  // chứ không còn "sắp hết". Pick seat sắp cạn tiếp theo theo hours_to_full nhỏ nhất.
  const worstForecast = forecasts.find(
    f => f.hours_to_full != null && f.hours_to_full > 0,
  ) ?? null
  const exhaustedSeatCount = forecasts.filter(f => f.current_pct >= 100).length

  // Reuse already-fetched forecasts — no extra DB round-trip
  const efficiency = computeFleetEfficiency(forecasts, now)

  return {
    utilPct,
    cycleUtilPct: cycles.avgUtilPct,
    lastCycleUtilPct: cycles.lastCycleUtilPct,
    cyclesConsidered: seatsWithCycleData.reduce(
      (max, s) => Math.max(max, s.completed.length), 0,
    ),
    wasteUsd,
    projectedUtilPct: efficiency.projected_util_pct,
    projectedWasteUsd: efficiency.waste.total_waste_usd_monthly,
    totalCostUsd,
    monthlyCostUsd: MONTHLY_COST_USD,
    billableCount,
    wwDelta: cycles.cycleDeltaPp,
    ddDelta,
    worstForecast: worstForecast
      ? {
          seat_id: worstForecast.seat_id,
          seat_label: worstForecast.seat_label,
          hours_to_full: worstForecast.hours_to_full,
          forecast_at: worstForecast.forecast_at,
          status: worstForecast.status,
        }
      : null,
    exhaustedSeatCount,
    staleSeatCount,
    noDataSeatCount,
    efficiency,
  }
}
