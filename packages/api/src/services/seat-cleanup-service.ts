import { Seat } from '../models/seat.js'
import { cascadeHardDelete } from './seat-cascade-delete.js'

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

  await cascadeHardDelete(ids)

  console.log(`[SeatCleanup] Purged ${expired.length} seat(s) and related data`)
}
