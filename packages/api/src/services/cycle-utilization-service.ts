/**
 * Utilization measured over COMPLETED 7-day quota cycles.
 *
 * `seven_day_pct` is a cumulative counter that climbs 0% -> 100% and then resets.
 * Sampling it mid-cycle measures how far into the cycle we are, not how much
 * quota went unused — so waste must be derived from finished cycles instead.
 * Within a cycle the counter only grows, so its max is the quota consumed.
 */

import mongoose from 'mongoose'
import { UsageSnapshot } from '../models/usage-snapshot.js'

/** Anthropic returns seven_day_resets_at with sub-second drift between calls;
 *  bucket to the nearest hour so one cycle stays one group. Rounding (not
 *  flooring) matters — real boundaries land on both sides of the hour
 *  (e.g. 22:59:59.960Z and 23:00:00.500Z belong to the same cycle). */
const RESET_BUCKET_MS = 3600_000

/** A cycle collected for less than a day can't be trusted to show its true peak. */
const MIN_CYCLE_SAMPLES = 288

/** How many completed cycles feed the trailing average. */
export const DEFAULT_CYCLE_WINDOW = 4

export interface CompletedCycle {
  /** Cycle boundary (reset instant), bucketed to the hour. */
  resets_at: string
  /** Highest seven_day_pct seen in the cycle = quota actually consumed. */
  peak_pct: number
  sample_count: number
}

export interface SeatCycleUtilization {
  seat_id: string
  seat_label: string
  /** Completed cycles, newest first, capped at the requested window. */
  completed: CompletedCycle[]
  /** Peak of the most recent completed cycle. */
  lastCyclePct: number | null
  /** Mean peak across `completed`. */
  avgPct: number | null
}

export interface FleetCycleUtilization {
  seats: SeatCycleUtilization[]
  /** Mean of per-seat `avgPct`, over seats with at least one completed cycle. */
  avgUtilPct: number | null
  /** Mean of per-seat `lastCyclePct`. */
  lastCycleUtilPct: number | null
  /** Mean peak of the cycle before the last one, over seats having BOTH. */
  prevCycleUtilPct: number | null
  /** Last completed cycle minus the one before it, in percentage points.
   *  Both sides average the SAME seats (those with two completed cycles), so
   *  the delta can't be moved by a seat entering or leaving the set. */
  cycleDeltaPp: number | null
  /** Seats contributing to `avgUtilPct`. */
  seatsWithData: number
  cyclesRequested: number
}

interface RawCycleRow {
  seat_id: string
  resets_at: Date
  peak_pct: number
  sample_count: number
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

/**
 * Turn raw per-cycle rows into a per-seat summary. Pure — no DB access.
 * Drops cycles still in progress and cycles with too little coverage.
 */
export function summarizeSeatCycles(
  rows: RawCycleRow[],
  seatId: string,
  seatLabel: string,
  now: Date,
  window: number,
): SeatCycleUtilization {
  const completed = rows
    .filter(r => String(r.seat_id) === seatId)
    .filter(r => r.resets_at.getTime() <= now.getTime())
    .filter(r => r.sample_count >= MIN_CYCLE_SAMPLES)
    .sort((a, b) => b.resets_at.getTime() - a.resets_at.getTime())
    .slice(0, window)
    .map(r => ({
      resets_at: r.resets_at.toISOString(),
      peak_pct: r.peak_pct,
      sample_count: r.sample_count,
    }))

  return {
    seat_id: seatId,
    seat_label: seatLabel,
    completed,
    lastCyclePct: completed[0]?.peak_pct ?? null,
    avgPct: mean(completed.map(c => c.peak_pct)),
  }
}

/** Aggregate completed-cycle peaks for the given seats. */
export async function computeFleetCycleUtilization(
  seats: Array<{ _id: unknown; label: string }>,
  now: Date = new Date(),
  window: number = DEFAULT_CYCLE_WINDOW,
): Promise<FleetCycleUtilization> {
  const empty: FleetCycleUtilization = {
    seats: [], avgUtilPct: null, lastCycleUtilPct: null, prevCycleUtilPct: null,
    cycleDeltaPp: null, seatsWithData: 0, cyclesRequested: window,
  }
  if (seats.length === 0) return empty

  const objectIds = seats.map(s => new mongoose.Types.ObjectId(String(s._id)))
  // One extra cycle of history so the oldest requested cycle is fully covered.
  const since = new Date(now.getTime() - (window + 1) * 7 * 24 * 3600_000)

  const half = RESET_BUCKET_MS / 2
  const shifted = { $add: [{ $toLong: '$seven_day_resets_at' }, half] }

  const rows = await UsageSnapshot.aggregate<{
    _id: { seat: mongoose.Types.ObjectId; cycle: Date }
    peak: number
    n: number
  }>([
    {
      $match: {
        seat_id: { $in: objectIds },
        seven_day_pct: { $ne: null },
        seven_day_resets_at: { $ne: null },
        fetched_at: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          seat: '$seat_id',
          // round(resets_at / 1h) * 1h
          cycle: { $toDate: { $subtract: [shifted, { $mod: [shifted, RESET_BUCKET_MS] }] } },
        },
        peak: { $max: '$seven_day_pct' },
        n: { $sum: 1 },
      },
    },
  ])

  const raw: RawCycleRow[] = rows.map(r => ({
    seat_id: String(r._id.seat),
    resets_at: r._id.cycle,
    peak_pct: r.peak ?? 0,
    sample_count: r.n,
  }))

  const perSeat = seats.map(s =>
    summarizeSeatCycles(raw, String(s._id), s.label, now, window),
  )

  const withData = perSeat.filter(s => s.avgPct != null)
  const withTwo = perSeat.filter(s => s.completed.length >= 2)

  const pairedLast = mean(withTwo.map(s => s.completed[0].peak_pct))
  const pairedPrev = mean(withTwo.map(s => s.completed[1].peak_pct))

  return {
    seats: perSeat,
    avgUtilPct: mean(withData.map(s => s.avgPct!)),
    lastCycleUtilPct: mean(withData.map(s => s.lastCyclePct!)),
    prevCycleUtilPct: pairedPrev,
    cycleDeltaPp: pairedLast != null && pairedPrev != null ? pairedLast - pairedPrev : null,
    seatsWithData: withData.length,
    cyclesRequested: window,
  }
}
