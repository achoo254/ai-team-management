import type { Types } from 'mongoose'
import { UsageSnapshot, type IUsageSnapshot } from '../models/usage-snapshot.js'
import { UsageWindow } from '../models/usage-window.js'
import {
  detectWindowAction,
  type DetectorSnapshot,
  type DetectorOpenWindow,
} from './usage-window-detector.js'

function toDetectorSnap(s: IUsageSnapshot | null): DetectorSnapshot | null {
  if (!s) return null
  return {
    _id: s._id as Types.ObjectId,
    fetched_at: s.fetched_at,
    five_hour_pct: s.five_hour_pct,
    five_hour_resets_at: s.five_hour_resets_at,
    seven_day_pct: s.seven_day_pct,
    seven_day_sonnet_pct: s.seven_day_sonnet_pct,
    seven_day_opus_pct: s.seven_day_opus_pct,
  }
}

/**
 * Apply window detection after a new snapshot. Idempotent — safe to retry.
 * Caller must ensure owner_id is non-null (skip seats without owner upfront).
 */
export async function applyWindowForSeat(params: {
  seat_id: Types.ObjectId
  owner_id: Types.ObjectId
  snapshotNow: IUsageSnapshot
}): Promise<void> {
  const { seat_id, owner_id, snapshotNow } = params

  // Prior snapshot (excluding current)
  const prior = await UsageSnapshot.findOne({
    seat_id,
    _id: { $ne: snapshotNow._id },
  })
    .sort({ fetched_at: -1 })
    .lean<IUsageSnapshot | null>()

  // Current open window(s) for this seat — self-heal if duplicates exist.
  // Duplicates can occur when backfill scripts/external jobs race with live collector.
  // Keep newest by window_start, merge max metrics from olders, close olders.
  const openWindows = await UsageWindow.find({ seat_id, is_closed: false })
    .sort({ window_start: -1, _id: -1 })
    .lean()
  if (openWindows.length > 1) {
    const [keep, ...dups] = openWindows
    const mergedUtil = Math.max(...openWindows.map((w) => w.utilization_pct))
    const mergedDelta7d = Math.max(...openWindows.map((w) => w.delta_7d_pct))
    const mergedDeltaSonnet = Math.max(...openWindows.map((w) => w.delta_7d_sonnet_pct))
    const mergedDeltaOpus = Math.max(...openWindows.map((w) => w.delta_7d_opus_pct))
    // Promote merged metrics onto the survivor (in-memory + DB)
    keep.utilization_pct = mergedUtil
    keep.delta_7d_pct = mergedDelta7d
    keep.delta_7d_sonnet_pct = mergedDeltaSonnet
    keep.delta_7d_opus_pct = mergedDeltaOpus
    await UsageWindow.updateOne(
      { _id: keep._id },
      {
        $set: {
          utilization_pct: mergedUtil,
          delta_7d_pct: mergedDelta7d,
          delta_7d_sonnet_pct: mergedDeltaSonnet,
          delta_7d_opus_pct: mergedDeltaOpus,
        },
      },
    )
    // Close duplicate older opens
    await UsageWindow.updateMany(
      { _id: { $in: dups.map((d) => d._id) }, is_closed: false },
      { $set: { is_closed: true } },
    )
    console.warn(
      `[UsageWindow] Self-heal: closed ${dups.length} duplicate open window(s) for seat ${seat_id}`,
    )
  }
  const openWindow = openWindows[0] ?? null

  // Start snapshot of open window (for delta baseline)
  let startSnap: IUsageSnapshot | null = null
  if (openWindow?.snapshot_start_id) {
    startSnap = await UsageSnapshot.findById(openWindow.snapshot_start_id).lean<IUsageSnapshot | null>()
  }

  const detectorOpenWindow: DetectorOpenWindow | null = openWindow
    ? {
        _id: openWindow._id as Types.ObjectId,
        seat_id: openWindow.seat_id,
        owner_id: openWindow.owner_id,
        window_start: openWindow.window_start,
        window_end: openWindow.window_end,
        utilization_pct: openWindow.utilization_pct,
        delta_7d_pct: openWindow.delta_7d_pct,
        delta_7d_sonnet_pct: openWindow.delta_7d_sonnet_pct,
        delta_7d_opus_pct: openWindow.delta_7d_opus_pct,
        peak_hour_of_day: openWindow.peak_hour_of_day,
        snapshot_start_id: openWindow.snapshot_start_id,
      }
    : null

  const action = detectWindowAction({
    seat_id,
    owner_id,
    snapshotNow: toDetectorSnap(snapshotNow)!,
    snapshotPrev: toDetectorSnap(prior),
    snapshotStart: toDetectorSnap(startSnap),
    openWindow: detectorOpenWindow,
  })

  switch (action.kind) {
    case 'noop':
      return
    case 'create_partial':
      // Idempotent via unique index {seat_id, window_start}
      try {
        await UsageWindow.create(action.payload)
      } catch (err: unknown) {
        if (!isDupKeyErr(err)) throw err
      }
      return
    case 'open_new': {
      // Partial unique index `seat_unique_open` requires close-then-create order:
      // only one is_closed:false doc per seat is allowed at any time.
      if (openWindow) {
        await UsageWindow.updateOne(
          { _id: openWindow._id, is_closed: false },
          { $set: action.closePrev },
        )
      }
      try {
        await UsageWindow.create(action.createNew)
      } catch (err: unknown) {
        if (!isDupKeyErr(err)) throw err
      }
      return
    }
    case 'update_open':
      await UsageWindow.updateOne({ _id: action.windowId }, { $set: action.patch })
      return
  }
}

function isDupKeyErr(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000,
  )
}

/**
 * Safety cron: close windows whose window_end has passed.
 * Returns count of windows closed.
 */
export async function closeStaleUsageWindows(): Promise<number> {
  const now = new Date()
  const stale = await UsageWindow.find({ is_closed: false, window_end: { $lt: now } })
    .lean()

  let closed = 0
  for (const w of stale) {
    // Load end snapshot (last snapshot before window_end)
    const endSnap = await UsageSnapshot.findOne({
      seat_id: w.seat_id,
      fetched_at: { $lte: w.window_end },
    })
      .sort({ fetched_at: -1 })
      .lean<IUsageSnapshot | null>()

    const durationHours = endSnap
      ? (endSnap.fetched_at.getTime() - w.window_start.getTime()) / (60 * 60 * 1000)
      : 5
    const isWaste = durationHours >= 2 && w.utilization_pct < 5

    const result = await UsageWindow.updateOne(
      { _id: w._id, is_closed: false },
      {
        $set: {
          is_closed: true,
          duration_hours: durationHours,
          is_waste: isWaste,
          snapshot_end_id: endSnap?._id ?? w.snapshot_end_id,
        },
      },
    )
    if (result.modifiedCount > 0) closed++
  }

  if (closed > 0) console.log(`[UsageWindow] Stale-close: closed ${closed} windows`)
  return closed
}
