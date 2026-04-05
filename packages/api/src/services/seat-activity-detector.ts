import type { Types } from 'mongoose'
import { SeatActivityLog } from '../models/seat-activity-log.js'
import type { IUsageSnapshot } from '../models/usage-snapshot.js'

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000 // Asia/Ho_Chi_Minh = UTC+7 (no DST)

/** Pure detection: compare current vs previous snapshot's five_hour_pct */
export function detectActivity(
  current: { five_hour_pct: number | null },
  previous: { five_hour_pct: number | null } | null,
): { isActive: boolean; delta: number } {
  if (!previous) return { isActive: false, delta: 0 }
  const currentPct = current.five_hour_pct ?? 0
  const prevPct = previous.five_hour_pct ?? 0
  const delta = currentPct - prevPct

  // Active if five_hour_pct increased
  if (delta > 0) return { isActive: true, delta }
  // Handle reset: if delta < 0, quota reset happened — check if currentPct > 0
  if (delta < 0 && currentPct > 0) return { isActive: true, delta: currentPct }
  return { isActive: false, delta: 0 }
}

/** Get current date (midnight) and hour in VN timezone */
function getVnDateAndHour(now: Date = new Date()): { date: Date; hour: number } {
  const vnTime = new Date(now.getTime() + TZ_OFFSET_MS)
  const hour = vnTime.getUTCHours()
  // Midnight VN time = strip time from VN-adjusted UTC
  const date = new Date(Date.UTC(vnTime.getUTCFullYear(), vnTime.getUTCMonth(), vnTime.getUTCDate()))
  return { date, hour }
}

/** Detect activity and upsert seat_activity_log record for current hour */
export async function recordSeatActivity(
  seatId: Types.ObjectId,
  current: IUsageSnapshot,
  previous: IUsageSnapshot | null,
): Promise<void> {
  const { isActive, delta } = detectActivity(current, previous)
  if (!isActive) return

  const { date, hour } = getVnDateAndHour()

  await SeatActivityLog.findOneAndUpdate(
    { seat_id: seatId, date, hour },
    {
      $set: { is_active: true },
      $inc: { delta_5h_pct: delta, snapshot_count: 1 },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  )
}
