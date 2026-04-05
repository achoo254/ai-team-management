/**
 * BLD PDF Data Helper
 * Thin DB query wrapper reused by bld-pdf-service to avoid circular imports.
 * Extracted to keep bld-pdf-service under 200 LOC.
 */

import mongoose from 'mongoose'
import { UsageSnapshot } from '../models/usage-snapshot.js'

/**
 * Returns the latest seven_day_pct snapshot per seat from the given seat IDs.
 */
export async function latestSnapshotsForSeats(
  seatIds: string[],
): Promise<Array<{ seat_id: string; seven_day_pct: number }>> {
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
