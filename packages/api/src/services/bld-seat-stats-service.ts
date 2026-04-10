/**
 * BLD Seat Stats Service
 * Computes seat-level efficiency stats: topWaste,
 * burndownRisk (3+ consecutive days ≥80%), degradationWatch (W/W drop ≥10pp).
 *
 * Scope is parameterized via MetricsScope — admin sees company seats,
 * user sees their own seat_ids only.
 * Timezone: Asia/Ho_Chi_Minh for day aggregation.
 */

import mongoose from 'mongoose'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { getSeatsInScope, getMonthlyCostUsd, type MetricsScope } from './bld-metrics-service.js'
import type {
  SeatWasteEntry,
  BurndownSeat,
  DegradationSeat,
  SeatStatsResponse,
} from '@repo/shared/types'

const TZ = 'Asia/Ho_Chi_Minh'
const BURNDOWN_THRESHOLD = 80
const BURNDOWN_MIN_DAYS = 3
const DEGRADATION_MIN_DROP_PP = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

function toVnDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
}

interface LatestSnap {
  seat_id: string
  seven_day_pct: number
}

async function latestSnapshotsFor(seatIds: string[]): Promise<LatestSnap[]> {
  if (seatIds.length === 0) return []
  const results = await UsageSnapshot.aggregate([
    {
      $match: {
        seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) },
        seven_day_pct: { $ne: null },
      },
    },
    { $sort: { fetched_at: -1 } },
    { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
  ])
  return results.map(r => ({ seat_id: String(r._id), seven_day_pct: r.seven_day_pct ?? 0 }))
}

async function snapshotsBefore(seatIds: string[], before: Date): Promise<LatestSnap[]> {
  if (seatIds.length === 0) return []
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
  return results.map(r => ({ seat_id: String(r._id), seven_day_pct: r.seven_day_pct ?? 0 }))
}

// ── Burndown: consecutive days ≥80% ──────────────────────────────────────────

async function computeBurndownRisk(
  seatIds: string[],
  snapMap: Map<string, number>,
): Promise<BurndownSeat[]> {
  if (seatIds.length === 0) return []

  const cutoff = new Date(Date.now() - 30 * 24 * 3600_000)
  const rawSnaps = await UsageSnapshot.find(
    {
      seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) },
      fetched_at: { $gte: cutoff },
      seven_day_pct: { $ne: null },
    },
    'seat_id seven_day_pct fetched_at',
  ).lean()

  const seatDayMap = new Map<string, Map<string, number>>()
  for (const snap of rawSnaps) {
    const sid = String(snap.seat_id)
    const day = toVnDay(new Date(snap.fetched_at))
    if (!seatDayMap.has(sid)) seatDayMap.set(sid, new Map())
    const dayMap = seatDayMap.get(sid)!
    dayMap.set(day, Math.max(dayMap.get(day) ?? 0, snap.seven_day_pct ?? 0))
  }

  const result: BurndownSeat[] = []
  const todayStr = toVnDay(new Date())

  for (const [seatId, dayMap] of seatDayMap.entries()) {
    let count = 0
    const checkDate = new Date()
    while (true) {
      const dayStr = toVnDay(checkDate)
      const maxPct = dayMap.get(dayStr)
      if (maxPct === undefined) {
        if (dayStr === todayStr) {
          checkDate.setDate(checkDate.getDate() - 1)
          continue
        }
        break
      }
      if (maxPct < BURNDOWN_THRESHOLD) break
      count++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    if (count >= BURNDOWN_MIN_DAYS) {
      result.push({
        seatId,
        seatLabel: '',
        consecutiveDays: count,
        latestUtilPct: snapMap.get(seatId) ?? 0,
      })
    }
  }

  return result
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function computeSeatStats(scope: MetricsScope = { type: 'admin' }): Promise<SeatStatsResponse> {
  const MONTHLY_COST_USD = getMonthlyCostUsd()
  const seats = await getSeatsInScope(scope)
  if (seats.length === 0) {
    return { topWaste: [], burndownRisk: [], degradationWatch: [] }
  }

  const seatIds = seats.map(s => String(s._id))
  const seatLabelMap = new Map(seats.map(s => [String(s._id), s.label]))

  const currentSnaps = await latestSnapshotsFor(seatIds)
  const snapMap = new Map(currentSnaps.map(s => [s.seat_id, s.seven_day_pct]))

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000)
  const oldSnaps = await snapshotsBefore(seatIds, sevenDaysAgo)
  const oldSnapMap = new Map(oldSnaps.map(s => [s.seat_id, s.seven_day_pct]))

  // ── topWaste: top 5 by wasteUsd desc ──────────────────────────────────────

  const wasteList: SeatWasteEntry[] = currentSnaps.map(s => {
    const wastePct = 100 - s.seven_day_pct
    const wasteUsd = (wastePct / 100) * MONTHLY_COST_USD
    return {
      seatId: s.seat_id,
      seatLabel: seatLabelMap.get(s.seat_id) ?? s.seat_id,
      utilPct: s.seven_day_pct,
      wasteUsd,
      wastePct,
    }
  })
  wasteList.sort((a, b) => b.wasteUsd - a.wasteUsd)
  const topWaste = wasteList.slice(0, 5)

  // ── burndownRisk: seats ≥80% util for 3+ consecutive days ─────────────────

  const burndownPartial = await computeBurndownRisk(seatIds, snapMap)
  const burndownRisk: BurndownSeat[] = burndownPartial.map(b => ({
    ...b,
    seatLabel: seatLabelMap.get(b.seatId) ?? b.seatId,
  }))
  burndownRisk.sort((a, b) => b.consecutiveDays - a.consecutiveDays)

  // ── degradationWatch: util drop ≥10pp W/W ─────────────────────────────────

  const degradationWatch: DegradationSeat[] = []
  for (const seatId of seatIds) {
    const current = snapMap.get(seatId)
    const lastWeek = oldSnapMap.get(seatId)
    if (current == null || lastWeek == null) continue
    const dropPp = lastWeek - current
    if (dropPp >= DEGRADATION_MIN_DROP_PP) {
      degradationWatch.push({
        seatId,
        seatLabel: seatLabelMap.get(seatId) ?? seatId,
        currentUtilPct: current,
        lastWeekUtilPct: lastWeek,
        dropPp,
      })
    }
  }
  degradationWatch.sort((a, b) => b.dropPp - a.dropPp)

  return { topWaste, burndownRisk, degradationWatch }
}
