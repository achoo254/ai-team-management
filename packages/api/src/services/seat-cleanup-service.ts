import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { UsageWindow } from '../models/usage-window.js'
import { Alert } from '../models/alert.js'
import { SessionMetric } from '../models/session-metric.js'

const RETENTION_DAYS = 30
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

/**
 * Hard-delete seats soft-deleted more than RETENTION_DAYS ago, along with their
 * usage history (snapshots, windows, alerts, session_metrics).
 * Runs daily via cron.
 */
export async function cleanupExpiredDeletedSeats(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_MS)

  // Bypass soft-delete query middleware by passing explicit deleted_at filter
  const expired = await Seat.find({ deleted_at: { $ne: null, $lt: cutoff } }, '_id label deleted_at').lean()
  if (expired.length === 0) {
    console.log('[SeatCleanup] No expired seats to purge')
    return
  }

  const ids = expired.map((s) => s._id)
  console.log(`[SeatCleanup] Purging ${expired.length} seat(s) deleted before ${cutoff.toISOString()}`)

  const [snapshots, windows, alerts, metrics, seats] = await Promise.all([
    UsageSnapshot.deleteMany({ seat_id: { $in: ids } }),
    UsageWindow.deleteMany({ seat_id: { $in: ids } }),
    Alert.deleteMany({ seat_id: { $in: ids } }),
    SessionMetric.deleteMany({ seat_id: { $in: ids } }),
    Seat.deleteMany({ _id: { $in: ids }, deleted_at: { $ne: null } }),
  ])

  console.log(
    `[SeatCleanup] Purged — seats: ${seats.deletedCount}, snapshots: ${snapshots.deletedCount}, ` +
    `windows: ${windows.deletedCount}, alerts: ${alerts.deletedCount}, session_metrics: ${metrics.deletedCount}`,
  )
}
