import type { Types } from 'mongoose'

/**
 * Pure detection logic for UsageWindow. No DB calls, no side effects.
 * Applier layer (see usage-window-applier.ts) queries snapshots and persists actions.
 */

export type DetectorSnapshot = {
  _id: Types.ObjectId
  fetched_at: Date
  five_hour_pct: number | null
  five_hour_resets_at: Date | null
  seven_day_pct: number | null
  seven_day_sonnet_pct: number | null
  seven_day_opus_pct: number | null
}

export type DetectorOpenWindow = {
  _id: Types.ObjectId
  seat_id: Types.ObjectId
  owner_id: Types.ObjectId
  window_start: Date
  window_end: Date
  utilization_pct: number
  delta_7d_pct: number
  delta_7d_sonnet_pct: number
  delta_7d_opus_pct: number
  peak_hour_of_day: number | null
  snapshot_start_id: Types.ObjectId | null
}

export type DetectorInput = {
  seat_id: Types.ObjectId
  owner_id: Types.ObjectId
  snapshotNow: DetectorSnapshot
  snapshotPrev: DetectorSnapshot | null
  snapshotStart: DetectorSnapshot | null // start snapshot of openWindow, for delta baseline
  openWindow: DetectorOpenWindow | null
}

export type WindowPayload = {
  seat_id: Types.ObjectId
  owner_id: Types.ObjectId
  window_start: Date
  window_end: Date
  is_closed: boolean
  is_partial: boolean
  duration_hours: number
  utilization_pct: number
  delta_7d_pct: number
  delta_7d_sonnet_pct: number
  delta_7d_opus_pct: number
  impact_ratio: number | null
  is_waste: boolean
  peak_hour_of_day: number | null
  last_activity_at: Date | null
  snapshot_start_id: Types.ObjectId | null
  snapshot_end_id: Types.ObjectId | null
}

export type DetectorAction =
  | { kind: 'noop' }
  | { kind: 'create_partial'; payload: WindowPayload }
  | { kind: 'open_new'; closePrev: Partial<WindowPayload> & { snapshot_end_id: Types.ObjectId | null }; createNew: WindowPayload }
  | { kind: 'update_open'; windowId: Types.ObjectId; patch: Partial<WindowPayload> }

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/**
 * Round a Date to the nearest hour. Claude API's `five_hour_resets_at` is
 * hour-aligned by design (07:00:00, 12:00:00, …) but server timestamps drift
 * ±1 second around the boundary (observed: 06:59:59 ↔ 07:00:01). Rounding
 * to hour collapses all same-cycle snapshots to a stable anchor so
 * `(seat_id, window_start)` unique index reliably dedupes.
 * Safe: 5h cycle boundaries are 5h apart → ±30min rounding window is ample.
 */
function roundToHour(d: Date): Date {
  return new Date(Math.round(d.getTime() / HOUR_MS) * HOUR_MS)
}

/**
 * Compute delta between current and start quota %.
 * When diff < 0, a quota reset happened mid-window (7d counter dropped).
 * Use curr as approximation: after reset, current value ≈ usage accumulated since reset.
 * Better than clamping to 0 which loses all contribution data.
 */
export function clampDelta(curr: number | null, start: number | null): number {
  if (curr == null || start == null) return 0
  const diff = curr - start
  return diff >= 0 ? diff : curr
}

export function computeImpactRatio(delta_7d: number, utilization: number): number | null {
  if (utilization < 1) return null
  return delta_7d / utilization
}

export function computeIsWaste(duration_hours: number, utilization: number): boolean {
  return duration_hours >= 2 && utilization < 5
}

export function getPeakHourVN(fetched_at: Date): number {
  // Asia/Ho_Chi_Minh is UTC+7 (no DST)
  const ms = fetched_at.getTime() + 7 * 60 * 60 * 1000
  return new Date(ms).getUTCHours()
}

export function computeDurationHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (60 * 60 * 1000)
}

function sameResetAt(a: Date | null, b: Date | null): boolean {
  if (a == null || b == null) return a === b
  return a.getTime() === b.getTime()
}

export function detectWindowAction(input: DetectorInput): DetectorAction {
  const { seat_id, owner_id, snapshotNow, snapshotPrev, snapshotStart, openWindow } = input

  if (snapshotNow.five_hour_resets_at == null) {
    return { kind: 'noop' }
  }

  // Normalize resets_at by rounding to nearest hour — Claude API returns
  // hour-aligned cycle boundaries with ±1s server timestamp drift. Without
  // normalization, each tick would create a new window (metrics reset, churn).
  const windowEndNow = roundToHour(snapshotNow.five_hour_resets_at)
  const nowFiveHrPct = snapshotNow.five_hour_pct ?? 0

  // Case: no openWindow
  if (openWindow == null) {
    // No prior snapshot — first-ever for seat, create partial with snapshotNow as anchor
    if (snapshotPrev == null) {
      const window_start = new Date(windowEndNow.getTime() - FIVE_HOURS_MS)
      const payload: WindowPayload = {
        seat_id,
        owner_id,
        window_start,
        window_end: windowEndNow,
        is_closed: false,
        is_partial: true,
        duration_hours: 0,
        utilization_pct: nowFiveHrPct,
        delta_7d_pct: 0,
        delta_7d_sonnet_pct: 0,
        delta_7d_opus_pct: 0,
        impact_ratio: computeImpactRatio(0, nowFiveHrPct),
        is_waste: false,
        peak_hour_of_day: getPeakHourVN(snapshotNow.fetched_at),
        last_activity_at: nowFiveHrPct > 0 ? snapshotNow.fetched_at : null,
        snapshot_start_id: snapshotNow._id,
        snapshot_end_id: snapshotNow._id,
      }
      return { kind: 'create_partial', payload }
    }
    // Have prior — treat prev as start anchor
    const window_start = new Date(windowEndNow.getTime() - FIVE_HOURS_MS)
    const delta7d = clampDelta(snapshotNow.seven_day_pct, snapshotPrev.seven_day_pct)
    const deltaSonnet = clampDelta(snapshotNow.seven_day_sonnet_pct, snapshotPrev.seven_day_sonnet_pct)
    const deltaOpus = clampDelta(snapshotNow.seven_day_opus_pct, snapshotPrev.seven_day_opus_pct)
    const util = Math.max(snapshotPrev.five_hour_pct ?? 0, nowFiveHrPct)
    const duration = computeDurationHours(snapshotPrev.fetched_at, snapshotNow.fetched_at)
    const payload: WindowPayload = {
      seat_id,
      owner_id,
      window_start,
      window_end: windowEndNow,
      is_closed: false,
      is_partial: true,
      duration_hours: duration,
      utilization_pct: util,
      delta_7d_pct: delta7d,
      delta_7d_sonnet_pct: deltaSonnet,
      delta_7d_opus_pct: deltaOpus,
      impact_ratio: computeImpactRatio(delta7d, util),
      is_waste: computeIsWaste(duration, util),
      peak_hour_of_day: getPeakHourVN(snapshotNow.fetched_at),
      last_activity_at: util > 0
        ? (nowFiveHrPct >= (snapshotPrev.five_hour_pct ?? 0) ? snapshotNow.fetched_at : snapshotPrev.fetched_at)
        : null,
      snapshot_start_id: snapshotPrev._id,
      snapshot_end_id: snapshotNow._id,
    }
    return { kind: 'create_partial', payload }
  }

  // openWindow exists
  const prevResetAt = snapshotPrev?.five_hour_resets_at
    ? roundToHour(snapshotPrev.five_hour_resets_at)
    : openWindow.window_end

  if (!sameResetAt(windowEndNow, prevResetAt)) {
    // Reset cycle transition: close old, open new
    // Close old with snapshotPrev as end (last snapshot in old cycle)
    const endSnap = snapshotPrev ?? snapshotNow
    const closeDuration = computeDurationHours(openWindow.window_start, endSnap.fetched_at)
    const closePrev: Partial<WindowPayload> & { snapshot_end_id: Types.ObjectId | null } = {
      is_closed: true,
      duration_hours: closeDuration,
      is_waste: computeIsWaste(closeDuration, openWindow.utilization_pct),
      snapshot_end_id: endSnap._id,
    }
    // Open new window from snapshotNow
    const window_start = new Date(windowEndNow.getTime() - FIVE_HOURS_MS)
    const createNew: WindowPayload = {
      seat_id,
      owner_id,
      window_start,
      window_end: windowEndNow,
      is_closed: false,
      is_partial: false,
      duration_hours: 0,
      utilization_pct: nowFiveHrPct,
      delta_7d_pct: 0,
      delta_7d_sonnet_pct: 0,
      delta_7d_opus_pct: 0,
      impact_ratio: computeImpactRatio(0, nowFiveHrPct),
      is_waste: false,
      peak_hour_of_day: getPeakHourVN(snapshotNow.fetched_at),
      last_activity_at: nowFiveHrPct > 0 ? snapshotNow.fetched_at : null,
      snapshot_start_id: snapshotNow._id,
      snapshot_end_id: snapshotNow._id,
    }
    return { kind: 'open_new', closePrev, createNew }
  }

  // Same cycle: update open window
  const startSnap = snapshotStart ?? snapshotPrev
  const delta7d = clampDelta(snapshotNow.seven_day_pct, startSnap?.seven_day_pct ?? null)
  const deltaSonnet = clampDelta(snapshotNow.seven_day_sonnet_pct, startSnap?.seven_day_sonnet_pct ?? null)
  const deltaOpus = clampDelta(snapshotNow.seven_day_opus_pct, startSnap?.seven_day_opus_pct ?? null)
  const util = Math.max(openWindow.utilization_pct, nowFiveHrPct)
  const duration = computeDurationHours(openWindow.window_start, snapshotNow.fetched_at)

  // Peak hour = hour when utilization_pct reached its max in this window (KISS proxy for peak activity)
  let peakHour = openWindow.peak_hour_of_day
  if (peakHour == null || nowFiveHrPct > openWindow.utilization_pct) {
    peakHour = getPeakHourVN(snapshotNow.fetched_at)
  }

  const patch: Partial<WindowPayload> = {
    utilization_pct: util,
    delta_7d_pct: delta7d,
    delta_7d_sonnet_pct: deltaSonnet,
    delta_7d_opus_pct: deltaOpus,
    impact_ratio: computeImpactRatio(delta7d, util),
    duration_hours: duration,
    is_waste: computeIsWaste(duration, util),
    peak_hour_of_day: peakHour,
    snapshot_end_id: snapshotNow._id,
  }
  // Only bump last_activity_at when utilization strictly increased (real new activity)
  if (nowFiveHrPct > openWindow.utilization_pct) {
    patch.last_activity_at = snapshotNow.fetched_at
  }
  return { kind: 'update_open', windowId: openWindow._id, patch }
}
