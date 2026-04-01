import { Alert } from '../models/alert.js'
import { UsageLog } from '../models/usage-log.js'
import { Seat } from '../models/seat.js'
import { config } from '../config.js'

/** Insert alert if not already exists for same seat+type today */
async function insertIfNew(seatId: string, type: string, message: string): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const existing = await Alert.findOne({
    seat_id: seatId,
    type,
    created_at: { $gte: today, $lt: tomorrow },
  }).lean()

  if (existing) return false
  await Alert.create({ seat_id: seatId, type, message })
  return true
}

/** Check alert rules based on weekly percentage data */
export async function checkAlerts() {
  let created = 0

  // Rule 1: High usage — aggregate by seat_id
  const highUsage = await UsageLog.aggregate([
    { $sort: { week_start: -1 } },
    {
      $group: {
        _id: '$seat_id',
        max_week: { $first: '$week_start' },
        weekly_all_pct: { $first: '$weekly_all_pct' },
      },
    },
    { $match: { weekly_all_pct: { $gte: config.alerts.highUsagePct } } },
  ])

  // Build seat lookup for labels in alert messages
  const seatIds = highUsage.map((r) => r._id)
  const highSeats = await Seat.find({ _id: { $in: seatIds } }, 'email label').lean()
  const seatMap = new Map(highSeats.map((s) => [String(s._id), s]))

  for (const row of highUsage) {
    const seat = seatMap.get(String(row._id))
    const label = seat?.label ?? seat?.email ?? row._id
    const msg = `Seat ${label}: ${row.weekly_all_pct}% usage (ngưỡng: ${config.alerts.highUsagePct}%)`
    if (await insertIfNew(String(row._id), 'high_usage', msg)) created++
  }

  // Rule 2: No activity
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - config.alerts.inactivityWeeks * 7)
  const cutoffWeek = cutoffDate.toISOString().split('T')[0]
  const allSeats = await Seat.find({}, '_id email label').lean()

  for (const seat of allSeats) {
    const recent = await UsageLog.findOne({
      seat_id: seat._id,
      week_start: { $gte: cutoffWeek },
    }).lean()
    if (!recent) {
      const ever = await UsageLog.findOne({ seat_id: seat._id }).lean()
      if (ever) {
        const msg = `Seat ${seat.label ?? seat.email}: không có log tuần này`
        if (await insertIfNew(String(seat._id), 'no_activity', msg)) created++
      }
    }
  }

  return { alertsCreated: created }
}
