/**
 * Which seats a BLD metric computation covers.
 *
 * - admin: seats with include_in_overview=true
 * - user: the user's own seat_ids (no overview filter)
 */

import mongoose from 'mongoose'
import { Seat, type ISeat } from '../models/seat.js'

export type MetricsScope =
  | { type: 'admin' }
  | { type: 'user'; seatIds: string[] }

/** Resolve which seats are in scope for BLD metrics. */
export async function getSeatsInScope(scope: MetricsScope): Promise<ISeat[]> {
  if (scope.type === 'admin') {
    // Only seats explicitly opted-in to the overview
    return Seat.find({ include_in_overview: true }).lean() as Promise<ISeat[]>
  }
  if (scope.seatIds.length === 0) return []
  const objectIds = scope.seatIds.map(id => new mongoose.Types.ObjectId(id))
  return Seat.find({ _id: { $in: objectIds } }).lean() as Promise<ISeat[]>
}
