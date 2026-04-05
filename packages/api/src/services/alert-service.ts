import { Alert } from '../models/alert.js'
import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Schedule } from '../models/schedule.js'
import { ActiveSession } from '../models/active-session.js'
import { SessionMetric } from '../models/session-metric.js'
import { User, type IUser } from '../models/user.js'
import { sendAlertToUser } from './telegram-service.js'
import { sendPushToUser } from './fcm-service.js'
import type { AlertType, AlertWindow } from '@repo/shared/types'

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
) {
  const as = user.alert_settings
  if (!as?.enabled) return
  const telegramOn = as.telegram_enabled !== false && user.telegram_bot_token && user.telegram_chat_id
  const pushOn = user.push_enabled && (user.fcm_tokens?.length ?? 0) > 0

  const promises: Promise<unknown>[] = []
  if (telegramOn) promises.push(sendAlertToUser(user, type, seatLabel, metadata).catch((e) => console.error('[Alert] telegram:', e)))
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

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const lastAlert = await Alert.findOne({
    user_id: user._id,
    seat_id: seatId,
    type,
    window,
    notified_at: { $ne: null },
    created_at: { $gte: oneDayAgo },
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
  await deliverToUser(user, type, seatLabel, metadata, String(alert._id))
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
  await Promise.allSettled(watchers.map((u) => deliverToUser(u, type, seatLabel, metadata, alertId)))
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

  // 3. Check token_failure — seats with any fetch error, fanout per-user
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

/** Check usage budget alerts for active scheduled sessions */
export async function checkBudgetAlerts() {
  const now = new Date()
  const currentHour = now.getHours()
  const dayOfWeek = now.getDay()

  const activeSchedules = await Schedule.find({
    day_of_week: dayOfWeek,
    start_hour: { $lte: currentHour },
    end_hour: { $gt: currentHour },
    usage_budget_pct: { $ne: null },
  }).populate('user_id', 'name')

  let created = 0

  for (const schedule of activeSchedules) {
    const seatId = String(schedule.seat_id)
    const userId = String(schedule.user_id)

    let session = await ActiveSession.findOne({ schedule_id: schedule._id })
    if (!session) {
      const latestSnap = await UsageSnapshot.findOne({ seat_id: seatId }).sort({ fetched_at: -1 })
      if (!latestSnap) continue
      session = await ActiveSession.create({
        seat_id: seatId,
        user_id: userId,
        schedule_id: schedule._id,
        started_at: now,
        snapshot_at_start: {
          five_hour_pct: latestSnap.five_hour_pct,
          seven_day_pct: latestSnap.seven_day_pct,
          seven_day_sonnet_pct: latestSnap.seven_day_sonnet_pct,
          seven_day_opus_pct: latestSnap.seven_day_opus_pct,
        },
      })
    }

    const currentSnap = await UsageSnapshot.findOne({ seat_id: seatId }).sort({ fetched_at: -1 })
    if (!currentSnap) continue

    if (currentSnap.five_hour_resets_at) {
      const currentResetsAt = currentSnap.five_hour_resets_at.getTime()
      const lastResetsAt = session.last_resets_at?.getTime() ?? 0
      if (lastResetsAt > 0 && currentResetsAt !== lastResetsAt) {
        session.reset_count_5h = (session.reset_count_5h ?? 0) + 1
      }
      session.last_resets_at = currentSnap.five_hour_resets_at
      await session.save()
    }

    const deltas = [
      { key: '5h', delta: Math.max(0, (currentSnap.five_hour_pct ?? 0) - (session.snapshot_at_start.five_hour_pct ?? 0)) },
      { key: '7d', delta: Math.max(0, (currentSnap.seven_day_pct ?? 0) - (session.snapshot_at_start.seven_day_pct ?? 0)) },
      { key: '7d_sonnet', delta: Math.max(0, (currentSnap.seven_day_sonnet_pct ?? 0) - (session.snapshot_at_start.seven_day_sonnet_pct ?? 0)) },
      { key: '7d_opus', delta: Math.max(0, (currentSnap.seven_day_opus_pct ?? 0) - (session.snapshot_at_start.seven_day_opus_pct ?? 0)) },
    ]

    const worst = deltas.reduce((a, b) => (a.delta > b.delta ? a : b))

    if (worst.delta >= schedule.usage_budget_pct!) {
      const seat = await Seat.findById(seatId, 'label email')
      const label = seat?.label || seat?.email || seatId
      const userName = (schedule.user_id as any).name || ''

      if (await insertIfNewSeatWide(seatId, 'usage_exceeded',
        `${userName} vượt budget: ${worst.delta.toFixed(1)}% / ${schedule.usage_budget_pct}% (${worst.key})`,
        { delta: worst.delta, budget: schedule.usage_budget_pct, session: worst.key, user_id: userId, user_name: userName },
        label,
      )) created++

      await notifyNextUser(seatId, dayOfWeek, currentHour, label).catch(console.error)
    }
  }

  await cleanupExpiredSessions(dayOfWeek, currentHour)

  if (created > 0) console.log(`[BudgetAlert] Created ${created} usage_exceeded alerts`)
}

async function notifyNextUser(seatId: string, dayOfWeek: number, currentHour: number, seatLabel: string) {
  const nextSchedule = await Schedule.findOne({
    seat_id: seatId,
    day_of_week: dayOfWeek,
    start_hour: { $gt: currentHour },
  }).sort({ start_hour: 1 }).populate('user_id', 'name telegram_bot_token telegram_chat_id alert_settings')

  if (nextSchedule) {
    const nextUser = nextSchedule.user_id as any
    if (nextUser?.telegram_bot_token && nextUser?.telegram_chat_id) {
      await sendAlertToUser(nextUser, 'usage_exceeded', seatLabel, {
        user_name: nextUser.name,
        next_user: true,
      }).catch(console.error)
    }
  }
}

async function cleanupExpiredSessions(dayOfWeek: number, currentHour: number) {
  const sessions = await ActiveSession.find({}).populate('schedule_id')

  for (const session of sessions) {
    const sched = session.schedule_id as any
    if (!sched || sched.day_of_week !== dayOfWeek || sched.end_hour <= currentHour) {
      await persistSessionMetric(session, sched)
      await session.deleteOne()
    }
  }
}

async function persistSessionMetric(session: any, sched: any) {
  const seatId = String(session.seat_id)
  const userId = String(session.user_id)

  const endSnap = await UsageSnapshot.findOne({ seat_id: seatId }).sort({ fetched_at: -1 })
  if (!endSnap) return

  const startSnap = session.snapshot_at_start
  const delta5h = Math.max(0, (endSnap.five_hour_pct ?? 0) - (startSnap.five_hour_pct ?? 0))
  const delta7d = Math.max(0, (endSnap.seven_day_pct ?? 0) - (startSnap.seven_day_pct ?? 0))
  const delta7dSonnet = Math.max(0, (endSnap.seven_day_sonnet_pct ?? 0) - (startSnap.seven_day_sonnet_pct ?? 0))
  const delta7dOpus = Math.max(0, (endSnap.seven_day_opus_pct ?? 0) - (startSnap.seven_day_opus_pct ?? 0))

  const durationHours = sched ? (sched.end_hour - sched.start_hour) : 0
  const impactRatio = delta5h > 0 ? delta7d / delta5h : null
  const utilization = durationHours > 0 ? Math.min(100, (delta5h / (durationHours / 5 * 100)) * 100) : 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    await SessionMetric.create({
      seat_id: seatId,
      user_id: userId,
      schedule_id: session.schedule_id,
      date: today,
      start_hour: sched?.start_hour ?? 0,
      end_hour: sched?.end_hour ?? 0,
      duration_hours: durationHours,
      delta_5h_pct: delta5h,
      delta_7d_pct: delta7d,
      delta_7d_sonnet_pct: delta7dSonnet,
      delta_7d_opus_pct: delta7dOpus,
      impact_ratio: impactRatio,
      utilization_pct: Math.round(utilization),
      reset_count_5h: session.reset_count_5h ?? 0,
      snapshot_start: startSnap,
      snapshot_end: {
        five_hour_pct: endSnap.five_hour_pct,
        seven_day_pct: endSnap.seven_day_pct,
        seven_day_sonnet_pct: endSnap.seven_day_sonnet_pct,
        seven_day_opus_pct: endSnap.seven_day_opus_pct,
      },
    })
  } catch (err) {
    console.error('[SessionMetric] Failed to persist:', err)
  }

  // Waste alert: session > 2h but Δ5h < 5%
  if (durationHours >= 2 && delta5h < 5) {
    const seat = await Seat.findById(seatId, 'label email')
    const label = seat?.label || seat?.email || seatId
    const userName = sched?.user_id?.name || ''
    await insertIfNewSeatWide(seatId, 'session_waste',
      `${userName} dùng ${durationHours}h nhưng chỉ dùng ${delta5h.toFixed(1)}% 5h session`,
      { delta: delta5h, duration: durationHours, user_id: userId, user_name: userName },
      label,
    )
  }

  // 7d risk
  const current7d = endSnap.seven_day_pct ?? 0
  if (current7d > 70) {
    const remainingToday = await Schedule.countDocuments({
      seat_id: seatId,
      day_of_week: new Date().getDay(),
      start_hour: { $gt: sched?.end_hour ?? 0 },
    })
    const avgMetrics = await SessionMetric.aggregate([
      { $match: { seat_id: session.seat_id } },
      { $group: { _id: null, avg_delta_7d: { $avg: '$delta_7d_pct' } } },
    ])
    const avgDelta7d = avgMetrics[0]?.avg_delta_7d ?? delta7d
    const projected = current7d + remainingToday * avgDelta7d

    if (projected > 90) {
      const seat = await Seat.findById(seatId, 'label email')
      const label = seat?.label || seat?.email || seatId
      await insertIfNewSeatWide(seatId, '7d_risk',
        `Seat ${label}: 7d hiện ${current7d.toFixed(0)}%, dự kiến ${projected.toFixed(0)}% sau ${remainingToday} sessions`,
        { current_7d: current7d, projected, remaining_sessions: remainingToday },
        label,
      )
    }
  }
}
