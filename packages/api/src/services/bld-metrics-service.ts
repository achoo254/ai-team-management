/**
 * BLD Metrics Service
 * Computes fleet KPIs and rebalance suggestions.
 *
 * SCOPE: Parameterized via MetricsScope.
 * - admin: seats with include_in_overview=true
 * - user: user's own seat_ids (no overview filter)
 */

import mongoose from 'mongoose'
import { Seat, type ISeat } from '../models/seat.js'
import { User } from '../models/user.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { computeAllSeatForecasts } from './quota-forecast-service.js'
import type {
  FleetKpis,
  RebalanceSuggestion,
  WwHistoryPoint,
} from '../../../shared/types.js'

// ── Scope type ────────────────────────────────────────────────────────────────

/** Determines which seats are included in BLD metric computations. */
export type MetricsScope =
  | { type: 'admin' }                        // seats with include_in_overview=true
  | { type: 'user'; seatIds: string[] }      // user's seats only

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_MONTHLY_COST_USD = 125

function parseMonthlyCost(): number {
  const raw = process.env.SEAT_MONTHLY_COST_USD
  if (!raw) return DEFAULT_MONTHLY_COST_USD
  const val = Number(raw)
  if (!isFinite(val) || val <= 0) return DEFAULT_MONTHLY_COST_USD
  return val
}

export function getMonthlyCostUsd(): number {
  return parseMonthlyCost()
}

// ── Seat scope resolver ───────────────────────────────────────────────────────

/** Resolve which seats are in scope for BLD metrics. */
export async function getSeatsInScope(scope: MetricsScope): Promise<ISeat[]> {
  if (scope.type === 'admin') {
    // Only seats explicitly opted-in to the overview
    return Seat.find({ include_in_overview: true }).lean() as Promise<ISeat[]>
  }
  // user scope: fetch by explicit seat_ids
  if (scope.seatIds.length === 0) return []
  const objectIds = scope.seatIds.map(id => new mongoose.Types.ObjectId(id))
  return Seat.find({ _id: { $in: objectIds } }).lean() as Promise<ISeat[]>
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

async function latestSnapshotsFor(seatIds: string[]): Promise<Array<{ seat_id: string; seven_day_pct: number }>> {
  if (seatIds.length === 0) return []
  const results = await UsageSnapshot.aggregate([
    { $match: { seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) }, seven_day_pct: { $ne: null } } },
    { $sort: { fetched_at: -1 } },
    { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
  ])
  return results.map(r => ({ seat_id: String(r._id), seven_day_pct: r.seven_day_pct ?? 0 }))
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/**
 * Compute average peak 5h per seat for a given day (Asia/Ho_Chi_Minh timezone).
 * Each seat contributes its max five_hour_pct from that day.
 * Returns fleet-wide average of those per-seat peaks, or null if no data.
 */
async function dailyFleetIntensity(seatIds: string[], date: Date): Promise<number | null> {
  if (seatIds.length === 0) return null
  // Build day boundaries in UTC (server stores fetched_at in UTC)
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const results = await UsageSnapshot.aggregate([
    {
      $match: {
        seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) },
        five_hour_pct: { $ne: null },
        fetched_at: { $gte: dayStart, $lte: dayEnd },
      },
    },
    { $group: { _id: '$seat_id', peak: { $max: '$five_hour_pct' } } },
  ])
  if (results.length === 0) return null
  return avg(results.map(r => r.peak ?? 0))
}

/** Compute fleet avg 7d_pct for the given seat IDs using snapshots taken up to `before` date. */
async function historicalFleetUtil(seatIds: string[], before: Date): Promise<number> {
  if (seatIds.length === 0) return 0
  const results = await UsageSnapshot.aggregate([
    {
      $match: {
        seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) },
        seven_day_pct: { $ne: null },
        fetched_at: { $lte: before },
      },
    },
    { $sort: { fetched_at: -1 } },
    { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
  ])
  if (results.length === 0) return 0
  return avg(results.map(r => r.seven_day_pct ?? 0))
}

// ── Fleet KPIs ────────────────────────────────────────────────────────────────

export async function computeFleetKpis(scope: MetricsScope = { type: 'admin' }): Promise<FleetKpis> {
  const MONTHLY_COST_USD = getMonthlyCostUsd()
  const seats = await getSeatsInScope(scope)
  const billableCount = seats.length
  const totalCostUsd = billableCount * MONTHLY_COST_USD

  if (billableCount === 0) {
    return {
      utilPct: 0, wasteUsd: 0, totalCostUsd: 0,
      monthlyCostUsd: MONTHLY_COST_USD, billableCount: 0,
      wwDelta: 0, ddDelta: null, worstForecast: null,
    }
  }

  const seatIds = seats.map(s => String(s._id))
  const snaps = await latestSnapshotsFor(seatIds)
  const utilPct = avg(snaps.map(s => s.seven_day_pct))
  const wasteUsd = totalCostUsd * (1 - utilPct / 100)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000)
  const today = new Date()
  const yesterday = new Date(Date.now() - 24 * 3600_000)

  const [lastWeekUtil, todayIntensity, yesterdayIntensity, forecasts] = await Promise.all([
    historicalFleetUtil(seatIds, sevenDaysAgo),
    dailyFleetIntensity(seatIds, today),
    dailyFleetIntensity(seatIds, yesterday),
    computeAllSeatForecasts(seatIds),
  ])

  const wwDelta = utilPct - lastWeekUtil
  const ddDelta = todayIntensity != null && yesterdayIntensity != null
    ? todayIntensity - yesterdayIntensity
    : null

  const worstForecast = forecasts.find(f => f.hours_to_full != null) ?? null

  return {
    utilPct, wasteUsd, totalCostUsd,
    monthlyCostUsd: MONTHLY_COST_USD,
    billableCount, wwDelta, ddDelta,
    worstForecast: worstForecast
      ? {
          seat_id: worstForecast.seat_id,
          seat_label: worstForecast.seat_label,
          hours_to_full: worstForecast.hours_to_full,
          forecast_at: worstForecast.forecast_at,
          status: worstForecast.status,
        }
      : null,
  }
}

// ── W/W history ───────────────────────────────────────────────────────────────

export async function computeWwHistory(scope: MetricsScope = { type: 'admin' }, weeks = 8): Promise<WwHistoryPoint[]> {
  const MONTHLY_COST_USD = getMonthlyCostUsd()
  const seats = await getSeatsInScope(scope)
  if (seats.length === 0) return []

  const seatIds = seats.map(s => String(s._id))
  const result: WwHistoryPoint[] = []
  const now = new Date()

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 3600_000)
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 3600_000)
    const utilPct = await historicalFleetUtil(seatIds, weekEnd)
    const totalCostUsd = seatIds.length * MONTHLY_COST_USD
    const wasteUsd = totalCostUsd * (1 - utilPct / 100)
    result.push({
      week_start: weekStart.toISOString(),
      utilPct,
      wasteUsd,
    })
  }

  return result
}

// ── D/D history ──────────────────────────────────────────────────────────────

export async function computeDdHistory(scope: MetricsScope = { type: 'admin' }, days = 14): Promise<Array<{ date: string; avgPeak5h: number }>> {
  const seats = await getSeatsInScope(scope)
  if (seats.length === 0) return []

  const seatIds = seats.map(s => new mongoose.Types.ObjectId(String(s._id)))
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  // Aggregate: per seat per day → max five_hour_pct, then avg across seats per day
  const pipeline = [
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
    {
      $group: {
        _id: '$_id.day',
        avgPeak5h: { $avg: '$peak' },
      },
    },
    { $sort: { _id: 1 as const } },
  ]

  const results = await UsageSnapshot.aggregate(pipeline)
  return results.map(r => ({
    date: r._id,
    avgPeak5h: Number((r.avgPeak5h ?? 0).toFixed(1)),
  }))
}

// ── Rebalance suggestions ─────────────────────────────────────────────────────

const OVERLOAD_PCT = 80
const UNDERUSE_PCT = 30
const MEDIUM_UNDER_MIN_PCT = 30
const MEDIUM_UNDER_MAX_PCT = 50
const ADD_SEAT_STRAIN_PCT = 70
const MIN_STRAINED_SEATS = 2
const SUSTAINED_DAYS = 3

async function seatSustainedAboveForDays(
  seatId: string,
  threshold: number,
  minDays: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - minDays * 24 * 3600_000)
  const snaps = await UsageSnapshot.find(
    { seat_id: seatId, fetched_at: { $gte: cutoff }, seven_day_pct: { $ne: null } },
    'seven_day_pct fetched_at',
  ).sort({ fetched_at: 1 }).lean()

  if (snaps.length === 0) return false
  const dayMap = new Map<string, number>()
  for (const s of snaps) {
    const day = new Date(s.fetched_at).toISOString().slice(0, 10)
    const pct = s.seven_day_pct ?? 0
    dayMap.set(day, Math.max(dayMap.get(day) ?? 0, pct))
  }
  const days = [...dayMap.values()]
  return days.length >= minDays && days.every(p => p >= threshold)
}

async function seatSustainedBelowForDays(
  seatId: string,
  threshold: number,
  minDays: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - minDays * 24 * 3600_000)
  const snaps = await UsageSnapshot.find(
    { seat_id: seatId, fetched_at: { $gte: cutoff }, seven_day_pct: { $ne: null } },
    'seven_day_pct fetched_at',
  ).sort({ fetched_at: 1 }).lean()

  if (snaps.length === 0) return false
  const dayMap = new Map<string, number>()
  for (const s of snaps) {
    const day = new Date(s.fetched_at).toISOString().slice(0, 10)
    const pct = s.seven_day_pct ?? 0
    dayMap.set(day, Math.min(dayMap.get(day) ?? 100, pct))
  }
  const days = [...dayMap.values()]
  return days.length >= minDays && days.every(p => p < threshold)
}

async function countMembersPerSeat(seatIds: string[]): Promise<Map<string, number>> {
  const objectIds = seatIds.map(id => new mongoose.Types.ObjectId(id))
  const rows = await User.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { seat_ids: { $in: objectIds } } },
    { $unwind: '$seat_ids' },
    { $match: { seat_ids: { $in: objectIds } } },
    { $group: { _id: '$seat_ids', count: { $sum: 1 } } },
  ])
  const map = new Map<string, number>()
  for (const r of rows) map.set(String(r._id), r.count)
  return map
}

export async function computeRebalanceSuggestions(scope: MetricsScope = { type: 'admin' }): Promise<RebalanceSuggestion[]> {
  const MONTHLY_COST_USD = getMonthlyCostUsd()
  const seats = await getSeatsInScope(scope)
  if (seats.length === 0) return []

  const seatIds = seats.map(s => String(s._id))
  const snaps = await latestSnapshotsFor(seatIds)
  const snapMap = new Map(snaps.map(s => [s.seat_id, s.seven_day_pct]))
  const memberMap = await countMembersPerSeat(seatIds)

  const suggestions: RebalanceSuggestion[] = []

  const highSeats = seats.filter(s => (snapMap.get(String(s._id)) ?? 0) >= OVERLOAD_PCT)
  const lowSeats = seats.filter(s => (snapMap.get(String(s._id)) ?? 0) < UNDERUSE_PCT)

  for (const highSeat of highSeats) {
    const highId = String(highSeat._id)
    const sustained = await seatSustainedAboveForDays(highId, OVERLOAD_PCT, SUSTAINED_DAYS)
    if (!sustained) continue

    for (const lowSeat of lowSeats) {
      const lowId = String(lowSeat._id)
      const lowSustained = await seatSustainedBelowForDays(lowId, UNDERUSE_PCT, SUSTAINED_DAYS)
      if (!lowSustained) continue

      const highPct = snapMap.get(highId) ?? 0
      const lowPct = snapMap.get(lowId) ?? 0
      const highMembers = memberMap.get(highId) ?? 0
      const lowMembers = memberMap.get(lowId) ?? 0
      suggestions.push({
        type: 'move_member',
        fromSeatId: highId,
        fromSeatLabel: highSeat.label,
        toSeatId: lowId,
        toSeatLabel: lowSeat.label,
        reason:
          `'${highSeat.label}' ${highPct.toFixed(0)}% (${highMembers} member, ≥${OVERLOAD_PCT}% liên tục ${SUSTAINED_DAYS} ngày) ↔ ` +
          `'${lowSeat.label}' ${lowPct.toFixed(0)}% (${lowMembers} member, <${UNDERUSE_PCT}% liên tục ${SUSTAINED_DAYS} ngày)`,
      })
      break
    }
  }

  const strainedSeats: Array<{ label: string; pct: number }> = []
  for (const seat of seats) {
    const id = String(seat._id)
    const pct = snapMap.get(id) ?? 0
    if (pct >= ADD_SEAT_STRAIN_PCT) {
      const sustained = await seatSustainedAboveForDays(id, ADD_SEAT_STRAIN_PCT, SUSTAINED_DAYS)
      if (sustained) strainedSeats.push({ label: seat.label, pct })
    }
  }
  if (strainedSeats.length >= MIN_STRAINED_SEATS) {
    const list = strainedSeats
      .slice(0, 3)
      .map(s => `${s.label} (${s.pct.toFixed(0)}%)`)
      .join(', ')
    suggestions.push({
      type: 'add_seat',
      reason: `${strainedSeats.length} seat ≥${ADD_SEAT_STRAIN_PCT}% liên tục ${SUSTAINED_DAYS} ngày: ${list}`,
      estimatedMonthlyCost: MONTHLY_COST_USD,
    })
  }

  for (const overloadedSeat of highSeats) {
    const overloadedId = String(overloadedSeat._id)
    const sustained = await seatSustainedAboveForDays(overloadedId, OVERLOAD_PCT, SUSTAINED_DAYS)
    if (!sustained) continue

    const alreadySuggested = suggestions.some(
      s => s.type === 'move_member' && s.fromSeatId === overloadedId,
    )
    if (alreadySuggested) continue

    const underusedSeat = seats.find(s => {
      const uid = String(s._id)
      const pct = snapMap.get(uid) ?? 0
      return uid !== overloadedId && pct >= MEDIUM_UNDER_MIN_PCT && pct < MEDIUM_UNDER_MAX_PCT
    })
    if (!underusedSeat) continue

    const overPct = snapMap.get(overloadedId) ?? 0
    const underPct = snapMap.get(String(underusedSeat._id)) ?? 0
    const overMembers = memberMap.get(overloadedId) ?? 0
    const underMembers = memberMap.get(String(underusedSeat._id)) ?? 0
    suggestions.push({
      type: 'rebalance_seat',
      overloadedSeatId: overloadedId,
      overloadedSeatLabel: overloadedSeat.label,
      underusedSeatId: String(underusedSeat._id),
      underusedSeatLabel: underusedSeat.label,
      reason:
        `'${overloadedSeat.label}' ${overPct.toFixed(0)}% (${overMembers} member) vs ` +
        `'${underusedSeat.label}' ${underPct.toFixed(0)}% (${underMembers} member) — ` +
        `cân bằng band ${MEDIUM_UNDER_MIN_PCT}-${MEDIUM_UNDER_MAX_PCT}%`,
    })
  }

  return suggestions
}
