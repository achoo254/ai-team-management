/**
 * Rebalance suggestions: move a member, add a seat, or level two seats out.
 *
 * These read current seven_day_pct on purpose — the question here is "who is
 * under strain right now", not "how much money did we waste".
 */

import mongoose from 'mongoose'
import { User } from '../models/user.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { getSeatsInScope, type MetricsScope } from './metrics-scope.js'
import { getMonthlyCostUsd } from './seat-cost.js'
import type { RebalanceSuggestion } from '@repo/shared/types'

const OVERLOAD_PCT = 80
const UNDERUSE_PCT = 30
const MEDIUM_UNDER_MIN_PCT = 30
const MEDIUM_UNDER_MAX_PCT = 50
const ADD_SEAT_STRAIN_PCT = 70
const MIN_STRAINED_SEATS = 2
const SUSTAINED_DAYS = 3

async function latestPctBySeat(seatIds: string[]): Promise<Map<string, number>> {
  if (seatIds.length === 0) return new Map()
  const results = await UsageSnapshot.aggregate([
    { $match: { seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) }, seven_day_pct: { $ne: null } } },
    { $sort: { fetched_at: -1 } },
    { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
  ])
  return new Map(results.map(r => [String(r._id), r.seven_day_pct ?? 0]))
}

async function seatSustainedAboveForDays(seatId: string, threshold: number, minDays: number): Promise<boolean> {
  const snaps = await UsageSnapshot.find(
    { seat_id: seatId, fetched_at: { $gte: new Date(Date.now() - minDays * 24 * 3600_000) }, seven_day_pct: { $ne: null } },
    'seven_day_pct fetched_at',
  ).sort({ fetched_at: 1 }).lean()

  if (snaps.length === 0) return false
  const dayMap = new Map<string, number>()
  for (const s of snaps) {
    const day = new Date(s.fetched_at).toISOString().slice(0, 10)
    dayMap.set(day, Math.max(dayMap.get(day) ?? 0, s.seven_day_pct ?? 0))
  }
  const days = [...dayMap.values()]
  return days.length >= minDays && days.every(p => p >= threshold)
}

async function seatSustainedBelowForDays(seatId: string, threshold: number, minDays: number): Promise<boolean> {
  const snaps = await UsageSnapshot.find(
    { seat_id: seatId, fetched_at: { $gte: new Date(Date.now() - minDays * 24 * 3600_000) }, seven_day_pct: { $ne: null } },
    'seven_day_pct fetched_at',
  ).sort({ fetched_at: 1 }).lean()

  if (snaps.length === 0) return false
  const dayMap = new Map<string, number>()
  for (const s of snaps) {
    const day = new Date(s.fetched_at).toISOString().slice(0, 10)
    dayMap.set(day, Math.min(dayMap.get(day) ?? 100, s.seven_day_pct ?? 0))
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
  return new Map(rows.map(r => [String(r._id), r.count]))
}

export async function computeRebalanceSuggestions(
  scope: MetricsScope = { type: 'admin' },
): Promise<RebalanceSuggestion[]> {
  const MONTHLY_COST_USD = getMonthlyCostUsd()
  const seats = await getSeatsInScope(scope)
  if (seats.length === 0) return []

  const seatIds = seats.map(s => String(s._id))
  const snapMap = await latestPctBySeat(seatIds)
  const memberMap = await countMembersPerSeat(seatIds)

  const suggestions: RebalanceSuggestion[] = []
  const highSeats = seats.filter(s => (snapMap.get(String(s._id)) ?? 0) >= OVERLOAD_PCT)
  const lowSeats = seats.filter(s => (snapMap.get(String(s._id)) ?? 0) < UNDERUSE_PCT)

  for (const highSeat of highSeats) {
    const highId = String(highSeat._id)
    if (!await seatSustainedAboveForDays(highId, OVERLOAD_PCT, SUSTAINED_DAYS)) continue

    for (const lowSeat of lowSeats) {
      const lowId = String(lowSeat._id)
      if (!await seatSustainedBelowForDays(lowId, UNDERUSE_PCT, SUSTAINED_DAYS)) continue

      const highPct = snapMap.get(highId) ?? 0
      const lowPct = snapMap.get(lowId) ?? 0
      suggestions.push({
        type: 'move_member',
        fromSeatId: highId,
        fromSeatLabel: highSeat.label,
        toSeatId: lowId,
        toSeatLabel: lowSeat.label,
        reason:
          `'${highSeat.label}' ${highPct.toFixed(0)}% (${memberMap.get(highId) ?? 0} member, ≥${OVERLOAD_PCT}% liên tục ${SUSTAINED_DAYS} ngày) ↔ ` +
          `'${lowSeat.label}' ${lowPct.toFixed(0)}% (${memberMap.get(lowId) ?? 0} member, <${UNDERUSE_PCT}% liên tục ${SUSTAINED_DAYS} ngày)`,
      })
      break
    }
  }

  const strainedSeats: Array<{ label: string; pct: number }> = []
  for (const seat of seats) {
    const id = String(seat._id)
    const pct = snapMap.get(id) ?? 0
    if (pct >= ADD_SEAT_STRAIN_PCT && await seatSustainedAboveForDays(id, ADD_SEAT_STRAIN_PCT, SUSTAINED_DAYS)) {
      strainedSeats.push({ label: seat.label, pct })
    }
  }
  if (strainedSeats.length >= MIN_STRAINED_SEATS) {
    const list = strainedSeats.slice(0, 3).map(s => `${s.label} (${s.pct.toFixed(0)}%)`).join(', ')
    suggestions.push({
      type: 'add_seat',
      reason: `${strainedSeats.length} seat ≥${ADD_SEAT_STRAIN_PCT}% liên tục ${SUSTAINED_DAYS} ngày: ${list}`,
      estimatedMonthlyCost: MONTHLY_COST_USD,
    })
  }

  for (const overloadedSeat of highSeats) {
    const overloadedId = String(overloadedSeat._id)
    if (!await seatSustainedAboveForDays(overloadedId, OVERLOAD_PCT, SUSTAINED_DAYS)) continue
    if (suggestions.some(s => s.type === 'move_member' && s.fromSeatId === overloadedId)) continue

    const underusedSeat = seats.find(s => {
      const uid = String(s._id)
      const pct = snapMap.get(uid) ?? 0
      return uid !== overloadedId && pct >= MEDIUM_UNDER_MIN_PCT && pct < MEDIUM_UNDER_MAX_PCT
    })
    if (!underusedSeat) continue

    const underusedId = String(underusedSeat._id)
    suggestions.push({
      type: 'rebalance_seat',
      overloadedSeatId: overloadedId,
      overloadedSeatLabel: overloadedSeat.label,
      underusedSeatId: underusedId,
      underusedSeatLabel: underusedSeat.label,
      reason:
        `'${overloadedSeat.label}' ${(snapMap.get(overloadedId) ?? 0).toFixed(0)}% (${memberMap.get(overloadedId) ?? 0} member) vs ` +
        `'${underusedSeat.label}' ${(snapMap.get(underusedId) ?? 0).toFixed(0)}% (${memberMap.get(underusedId) ?? 0} member) — ` +
        `cân bằng band ${MEDIUM_UNDER_MIN_PCT}-${MEDIUM_UNDER_MAX_PCT}%`,
    })
  }

  return suggestions
}
