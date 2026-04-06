import { Alert } from '../models/alert.js'
import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { User, type IUser } from '../models/user.js'
import { sendAlertToUser } from './telegram-service.js'
import { sendPushToUser } from './fcm-service.js'
import { checkFastBurnAlerts, checkQuotaForecastAlerts } from './predictive-alert-service.js'
import type { AlertType, AlertWindow } from '@repo/shared/types'

/** Signature for insertIfNewPerUser — used by predictive-alert-service. */
export type InsertAlertFn = (
  user: IUser, seatId: string, type: AlertType, window: AlertWindow,
  message: string, metadata: Record<string, unknown>, seatLabel: string,
) => Promise<boolean>

/** Return true if user has notifications enabled for this type. */
function isTypeEnabledForUser(user: IUser, type: AlertType): boolean {
  const as = user.alert_settings
  if (!as?.enabled) return false
  if (type === 'token_failure') return as.token_failure_enabled !== false
  return true
}

/** Send alert to a single user's enabled channels. */
async function deliverToUser(
  user: IUser,
  type: AlertType,
  seatLabel: string,
  metadata: Record<string, unknown>,
  alertId: string,
  seatId?: string,
) {
  const as = user.alert_settings
  if (!as?.enabled) return
  const telegramOn = as.telegram_enabled !== false && user.telegram_bot_token && user.telegram_chat_id
  const pushOn = user.push_enabled && (user.fcm_tokens?.length ?? 0) > 0

  const promises: Promise<unknown>[] = []
  if (telegramOn) promises.push(sendAlertToUser(user, type, seatLabel, metadata, seatId).catch((e) => console.error('[Alert] telegram:', e)))
  if (pushOn) promises.push(sendPushToUser(String(user._id), type, seatLabel, '', alertId).catch((e) => console.error('[Alert] push:', e)))
  await Promise.allSettled(promises)
}

/**
 * Per-user dedup: insert alert if no already-notified alert exists for
 * same (user, seat, type, window) within 24h, then send to user's channels.
 */
async function insertIfNewPerUser(
  user: IUser,
  seatId: string,
  type: AlertType,
  window: AlertWindow,
  message: string,
  metadata: Record<string, unknown>,
  seatLabel: string,
): Promise<boolean> {
  if (!isTypeEnabledForUser(user, type)) return false

  const dedupHours = type === 'fast_burn' ? 4 : 24
  const dedupAgo = new Date(Date.now() - dedupHours * 60 * 60 * 1000)
  const lastAlert = await Alert.findOne({
    user_id: user._id,
    seat_id: seatId,
    type,
    window,
    notified_at: { $ne: null },
    created_at: { $gte: dedupAgo },
  }).sort({ created_at: -1 }).lean()

  if (lastAlert) {
    // For rate_limit: allow re-alert if usage dipped below threshold since last
    // alert (covers resets, manual usage drops, any re-crossing of threshold).
    if (type === 'rate_limit' && window) {
      const threshold = (metadata as { threshold?: number }).threshold
      const field = window === '5h' ? 'five_hour_pct' : 'seven_day_pct'
      if (threshold != null) {
        const dip = await UsageSnapshot.findOne({
          seat_id: seatId,
          fetched_at: { $gt: lastAlert.created_at },
          [field]: { $lt: threshold },
        }).lean()
        if (!dip) return false
      } else {
        return false
      }
    } else {
      return false
    }
  }

  const alert = await Alert.create({
    user_id: user._id,
    seat_id: seatId,
    type,
    window,
    message,
    metadata,
    read_by: [],
    notified_at: new Date(),
  })
  await deliverToUser(user, type, seatLabel, metadata, String(alert._id), seatId)
  return true
}

/**
 * Seat-wide dedup (user_id = null): used for usage_exceeded, session_waste, 7d_risk.
 * Inserts one alert record per (seat, type) per 24h, then fans out to all watchers.
 */
async function insertIfNewSeatWide(
  seatId: string,
  type: AlertType,
  message: string,
  metadata: Record<string, unknown>,
  seatLabel: string,
): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const existing = await Alert.findOne({
    user_id: null,
    seat_id: seatId,
    type,
    notified_at: { $ne: null },
    created_at: { $gte: oneDayAgo },
  })
  if (existing) return false

  const alert = await Alert.create({
    user_id: null,
    seat_id: seatId,
    type,
    window: null,
    message,
    metadata,
    read_by: [],
    notified_at: new Date(),
  })
  const alertId = String(alert._id)

  // Fanout to all users watching this seat with alerts enabled
  const watchers = await User.find({
    'watched_seats.seat_id': seatId,
    'alert_settings.enabled': true,
  })
  await Promise.allSettled(watchers.map((u) => deliverToUser(u, type, seatLabel, metadata, alertId, seatId)))
  return true
}

/** Check alerts based on latest UsageSnapshot data + seat token status. Uses per-user-per-seat thresholds. */
export async function checkSnapshotAlerts() {
  let created = 0

  // 1. Get latest snapshot per seat (within last 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const snapshots = await UsageSnapshot.aggregate([
    { $match: { fetched_at: { $gte: oneHourAgo } } },
    { $sort: { fetched_at: -1 } },
    { $group: { _id: '$seat_id', snapshot: { $first: '$$ROOT' } } },
  ])

  const seatIds = snapshots.map((s) => s._id)
  const seats = await Seat.find(
    { _id: { $in: seatIds } },
    'label email token_active last_fetch_error',
  ).lean()
  const seatMap = new Map(seats.map((s) => [String(s._id), s]))

  // Load all watchers for these seats
  const watchers = await User.find({
    'alert_settings.enabled': true,
    'watched_seats.seat_id': { $in: seatIds },
  })

  // 2. Per-user rate_limit checks (5h + 7d windows)
  for (const { _id: seatId, snapshot } of snapshots) {
    const seat = seatMap.get(String(seatId))
    if (!seat) continue
    const label = seat.label || seat.email

    const seatWatchers = watchers.filter((u) =>
      (u.watched_seats ?? []).some((ws) => String(ws.seat_id) === String(seatId)),
    )
    if (seatWatchers.length === 0) continue

    const fiveHourPct = snapshot.five_hour_pct
    const sevenDayPct = snapshot.seven_day_pct
    const sevenDaySonnetPct = snapshot.seven_day_sonnet_pct
    const sevenDayOpusPct = snapshot.seven_day_opus_pct
    const maxSevenDay = Math.max(sevenDayPct ?? -1, sevenDaySonnetPct ?? -1, sevenDayOpusPct ?? -1)
    const hasSevenDay = (sevenDayPct ?? null) != null || (sevenDaySonnetPct ?? null) != null || (sevenDayOpusPct ?? null) != null

    for (const user of seatWatchers) {
      const ws = (user.watched_seats ?? []).find((w) => String(w.seat_id) === String(seatId))
      if (!ws) continue

      // 5h window
      if (fiveHourPct != null && fiveHourPct >= ws.threshold_5h_pct) {
        const msg = `Seat ${label}: 5h usage ${fiveHourPct}% vượt ngưỡng ${ws.threshold_5h_pct}%`
        const metadata = {
          window: '5h' as const,
          pct: fiveHourPct,
          threshold: ws.threshold_5h_pct,
          resets_at: snapshot.five_hour_resets_at ?? null,
          session: '5h' as const,
        }
        if (await insertIfNewPerUser(user, String(seatId), 'rate_limit', '5h', msg, metadata, label)) created++
      }

      // 7d window (max across 3 variants)
      if (hasSevenDay && maxSevenDay >= ws.threshold_7d_pct) {
        const msg = `Seat ${label}: 7d usage ${maxSevenDay}% vượt ngưỡng ${ws.threshold_7d_pct}%`
        const metadata = {
          window: '7d' as const,
          max_pct: maxSevenDay,
          pct: maxSevenDay,
          threshold: ws.threshold_7d_pct,
          breakdown: {
            seven_day_pct: sevenDayPct ?? null,
            seven_day_sonnet_pct: sevenDaySonnetPct ?? null,
            seven_day_opus_pct: sevenDayOpusPct ?? null,
          },
          session: '7d' as const,
        }
        if (await insertIfNewPerUser(user, String(seatId), 'rate_limit', '7d', msg, metadata, label)) created++
      }
    }
  }

  // 3. Fast burn checks (5h velocity + ETA)
  created += await checkFastBurnAlerts(snapshots, seatMap, watchers, insertIfNewPerUser)

  // 4. Quota forecast checks (7d linear projection)
  const seatIdStrs = seatIds.map((id) => String(id))
  created += await checkQuotaForecastAlerts(seatIdStrs, seatMap, watchers, insertIfNewPerUser)

  // 5. Check token_failure — seats with any fetch error, fanout per-user
  const failedSeats = await Seat.find(
    { last_fetch_error: { $ne: null } },
    'label email token_active last_fetch_error',
  ).lean()

  for (const seat of failedSeats) {
    const label = seat.label || seat.email
    const isHardFail = !seat.token_active
    const prefix = isHardFail
      ? `Seat ${label}: refresh token invalid — cần đăng nhập lại`
      : `Seat ${label}: token lỗi`
    const msg = `${prefix} — ${seat.last_fetch_error}`
    const metadata = {
      error: seat.last_fetch_error?.slice(0, 200),
      hard_fail: isHardFail,
    }

    // Fanout: all users watching this seat + token_failure_enabled
    const tfWatchers = await User.find({
      'watched_seats.seat_id': seat._id,
      'alert_settings.enabled': true,
      'alert_settings.token_failure_enabled': { $ne: false },
    })
    for (const user of tfWatchers) {
      if (await insertIfNewPerUser(user, String(seat._id), 'token_failure', null, msg, metadata, label)) created++
    }
  }

  return { alertsCreated: created }
}

