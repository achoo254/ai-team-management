import mongoose from 'mongoose'
import { Schedule } from '../models/schedule.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Seat } from '../models/seat.js'
import { Alert } from '../models/alert.js'
import { User } from '../models/user.js'
import { sendAlertToUser } from './telegram-service.js'
import { sendPushToUser } from './fcm-service.js'
import { detectActivity } from './seat-activity-detector.js'

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7

/** Check if seat is currently active based on latest 2 snapshots */
async function isCurrentlyActive(seatId: mongoose.Types.ObjectId): Promise<boolean> {
  const [latest, previous] = await UsageSnapshot.find({ seat_id: seatId })
    .sort({ fetched_at: -1 }).limit(2).lean()
  if (!latest || !previous) return false
  // Only consider "active" if latest snapshot is within 10 minutes
  if (Date.now() - new Date(latest.fetched_at).getTime() > 10 * 60 * 1000) return false
  return detectActivity(latest, previous).isActive
}

/** Check anomalies for a single seat after each snapshot collection */
export async function checkActivityAnomalies(seatId: mongoose.Types.ObjectId): Promise<void> {
  const vnNow = new Date(Date.now() + TZ_OFFSET_MS)
  const dayOfWeek = vnNow.getUTCDay()
  const hour = vnNow.getUTCHours()

  // Get predicted pattern for this slot
  const pattern = await Schedule.findOne({
    seat_id: seatId,
    day_of_week: dayOfWeek,
    start_hour: { $lte: hour },
    end_hour: { $gt: hour },
    source: 'auto',
  })

  const isActive = await isCurrentlyActive(seatId)

  const seat = await Seat.findById(seatId, 'label email').lean()
  if (!seat) return
  const label = seat.label || seat.email

  // Dedup: check if alert already sent for this seat+type in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  if (isActive && !pattern) {
    const existing = await Alert.findOne({
      seat_id: seatId, type: 'unexpected_activity',
      created_at: { $gte: oneDayAgo },
    })
    if (!existing) {
      const alert = await Alert.create({
        user_id: null,
        seat_id: seatId,
        type: 'unexpected_activity',
        window: null,
        message: `Seat ${label}: hoạt động ngoài giờ dự kiến (${String(hour).padStart(2, '0')}:00)`,
        metadata: { hour, day_of_week: dayOfWeek },
        read_by: [],
        notified_at: new Date(),
      })
      await fanoutToWatchers(seatId, 'unexpected_activity', label, { hour, day_of_week: dayOfWeek }, String(alert._id))
    }
  }

  if (!isActive && pattern) {
    const existing = await Alert.findOne({
      seat_id: seatId, type: 'unexpected_idle',
      created_at: { $gte: oneDayAgo },
    })
    if (!existing) {
      const alert = await Alert.create({
        user_id: null,
        seat_id: seatId,
        type: 'unexpected_idle',
        window: null,
        message: `Seat ${label}: không hoạt động trong giờ dự kiến (${String(hour).padStart(2, '0')}:00)`,
        metadata: { hour, day_of_week: dayOfWeek },
        read_by: [],
        notified_at: new Date(),
      })
      await fanoutToWatchers(seatId, 'unexpected_idle', label, { hour, day_of_week: dayOfWeek }, String(alert._id))
    }
  }
}

/** Send alert to all users watching this seat */
async function fanoutToWatchers(
  seatId: mongoose.Types.ObjectId,
  type: 'unexpected_activity' | 'unexpected_idle',
  seatLabel: string,
  metadata: Record<string, unknown>,
  alertId: string,
) {
  const watchers = await User.find({
    'watched_seats.seat_id': seatId,
    'alert_settings.enabled': true,
  })

  for (const user of watchers) {
    const telegramOn = user.alert_settings?.telegram_enabled !== false && user.telegram_bot_token && user.telegram_chat_id
    const pushOn = user.push_enabled && (user.fcm_tokens?.length ?? 0) > 0

    const promises: Promise<unknown>[] = []
    if (telegramOn) {
      promises.push(sendAlertToUser(user, type, seatLabel, metadata).catch(e => console.error('[Anomaly] telegram:', e)))
    }
    if (pushOn) {
      promises.push(sendPushToUser(String(user._id), type, seatLabel, '', alertId).catch(e => console.error('[Anomaly] push:', e)))
    }
    await Promise.allSettled(promises)
  }
}
