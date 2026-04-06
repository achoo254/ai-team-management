import type { Types } from 'mongoose'
import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { UsageWindow } from '../models/usage-window.js'
import { Alert } from '../models/alert.js'
import { SeatActivityLog } from '../models/seat-activity-log.js'

/** Hard-delete seat(s) + all related data. Used by force-new and cleanup service. */
export async function cascadeHardDelete(seatIds: Types.ObjectId[]) {
  await Promise.all([
    UsageSnapshot.deleteMany({ seat_id: { $in: seatIds } }),
    UsageWindow.deleteMany({ seat_id: { $in: seatIds } }),
    Alert.deleteMany({ seat_id: { $in: seatIds } }),
    SeatActivityLog.deleteMany({ seat_id: { $in: seatIds } }),
    Seat.deleteMany({ _id: { $in: seatIds }, deleted_at: { $ne: null } }),
  ])
}
