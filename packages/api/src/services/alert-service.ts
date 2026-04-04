import { Alert } from '../models/alert.js'
import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Schedule } from '../models/schedule.js'
import { ActiveSession } from '../models/active-session.js'
import { SessionMetric } from '../models/session-metric.js'
import { User } from '../models/user.js'
import { sendAlertToUser } from './telegram-service.js'
import type { AlertType } from '@repo/shared/types'

/** Atomically insert alert if no recent alert exists for same seat+type (1h cooldown). Notifies subscribed users. */
async function insertIfNew(
  seatId: string,
  type: AlertType,
  message: string,
  metadata: Record<string, unknown>,
  seatLabel: string,
  /** The actual value to compare against per-user thresholds (e.g. usage pct) */
  triggerValue?: number,
): Promise<boolean> {
  // Cooldown: skip if any alert (resolved or not) exists for same seat+type in last 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentAlert = await Alert.findOne({
    seat_id: seatId, type, created_at: { $gte: oneHourAgo },
  })
  if (recentAlert) return false

  const result = await Alert.findOneAndUpdate(
    { seat_id: seatId, type, resolved: false },
    { $setOnInsert: { seat_id: seatId, type, message, metadata, resolved: false } },
    { upsert: true, new: true, rawResult: true },
  ) as unknown as { lastErrorObject?: { updatedExisting?: boolean } }
  if (!result.lastErrorObject?.updatedExisting) {
    await notifySubscribedUsers(seatId, type, seatLabel, metadata, triggerValue)
    return true
  }
  return false
}

/** Notify subscribed users, filtering by their individual thresholds */
async function notifySubscribedUsers(
  seatId: string,
  type: AlertType,
  seatLabel: string,
  metadata: Record<string, unknown>,
  triggerValue?: number,
) {
  const users = await User.find({
    'alert_settings.enabled': true,
    'alert_settings.subscribed_seat_ids': seatId,
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  const eligible = users.filter((user) => {
    if (triggerValue == null) return true // no threshold check (token_failure, session_waste, 7d_risk)
    const as = user.alert_settings!
    if (type === 'rate_limit') return triggerValue >= as.rate_limit_pct
    if (type === 'extra_credit') return triggerValue >= as.extra_credit_pct
    if (type === 'usage_exceeded') return true // budget alerts always notify
    return true
  })

  await Promise.allSettled(
    eligible.map((user) => sendAlertToUser(user, type, seatLabel, metadata)),
  )
}

/** Check alerts based on latest UsageSnapshot data + seat token status. Uses per-user thresholds. */
export async function checkSnapshotAlerts() {
  let created = 0

  // 1. Get latest snapshot per seat (within last 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const snapshots = await UsageSnapshot.aggregate([
    { $match: { fetched_at: { $gte: oneHourAgo } } },
    { $sort: { fetched_at: -1 } },
    { $group: { _id: '$seat_id', snapshot: { $first: '$$ROOT' } } },
  ])

  // Build seat lookup
  const seatIds = snapshots.map((s) => s._id)
  const seats = await Seat.find(
    { _id: { $in: seatIds } },
    'label email token_active last_fetch_error',
  ).lean()
  const seatMap = new Map(seats.map((s) => [String(s._id), s]))

  // Batch-load all users with alerts enabled who subscribe to any of these seats
  const subscribedUsers = await User.find({
    'alert_settings.enabled': true,
    'alert_settings.subscribed_seat_ids': { $in: seatIds },
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  // Find the lowest threshold per seat across all subscribed users (for alert record creation)
  const seatThresholds = new Map<string, { rate_limit_pct: number; extra_credit_pct: number }>()
  for (const u of subscribedUsers) {
    const as = u.alert_settings!
    for (const sid of as.subscribed_seat_ids) {
      const key = String(sid)
      const existing = seatThresholds.get(key)
      seatThresholds.set(key, {
        rate_limit_pct: existing ? Math.min(existing.rate_limit_pct, as.rate_limit_pct) : as.rate_limit_pct,
        extra_credit_pct: existing ? Math.min(existing.extra_credit_pct, as.extra_credit_pct) : as.extra_credit_pct,
      })
    }
  }

  // 2. Check rate_limit + extra_credit for each snapshot using lowest user threshold
  for (const { _id: seatId, snapshot } of snapshots) {
    const seat = seatMap.get(String(seatId))
    if (!seat) continue
    const label = seat.label || seat.email
    const thresholds = seatThresholds.get(String(seatId))
    if (!thresholds) continue // no users subscribed to this seat

    // Rate limit: check all windows against lowest user threshold
    const resetsAtMap: Record<string, string | null> = {
      '5h': snapshot.five_hour_resets_at ?? null,
      '7d': snapshot.seven_day_resets_at ?? null,
      '7d_sonnet': snapshot.seven_day_sonnet_resets_at ?? null,
      '7d_opus': snapshot.seven_day_opus_resets_at ?? null,
    }
    const allWindows = [
      { key: '5h' as const, pct: snapshot.five_hour_pct },
      { key: '7d' as const, pct: snapshot.seven_day_pct },
      { key: '7d_sonnet' as const, pct: snapshot.seven_day_sonnet_pct },
      { key: '7d_opus' as const, pct: snapshot.seven_day_opus_pct },
    ].filter((w) => w.pct != null)

    const windows = allWindows.filter((w) => w.pct! >= thresholds.rate_limit_pct)
    if (windows.length > 0) {
      const worst = windows.reduce((a, b) => (a.pct! > b.pct! ? a : b))
      const resetsAt = resetsAtMap[worst.key] ?? null
      const msg = `Seat ${label}: ${worst.pct}% usage (${worst.key} window)`
      if (await insertIfNew(String(seatId), 'rate_limit', msg, {
        window: worst.key, pct: worst.pct, resets_at: resetsAt,
      }, label, worst.pct)) created++
    }

    // Extra credit
    const extra = snapshot.extra_usage
    if (extra?.is_enabled && extra.utilization != null && extra.utilization >= thresholds.extra_credit_pct) {
      const msg = `Seat ${label}: extra credits ${extra.utilization}% used ($${extra.used_credits}/$${extra.monthly_limit})`
      if (await insertIfNew(String(seatId), 'extra_credit', msg, {
        pct: extra.utilization,
        credits_used: extra.used_credits,
        credits_limit: extra.monthly_limit,
      }, label, extra.utilization)) created++
    }
  }

  // 3. Check token_failure — seats with active token but fetch error
  const failedSeats = await Seat.find(
    { token_active: true, last_fetch_error: { $ne: null } },
    'label email last_fetch_error',
  ).lean()

  for (const seat of failedSeats) {
    const label = seat.label || seat.email
    const msg = `Seat ${label}: token lỗi — ${seat.last_fetch_error}`
    if (await insertIfNew(String(seat._id), 'token_failure', msg, {
      error: seat.last_fetch_error?.slice(0, 200),
    }, label)) created++
  }

  return { alertsCreated: created }
}

/** Check usage budget alerts for active scheduled sessions */
export async function checkBudgetAlerts() {
  const now = new Date()
  const currentHour = now.getHours()
  const dayOfWeek = now.getDay()

  // 1. Find schedules active right now (with budget set)
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

    // 2. Get or create active session with baseline
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

    // 3. Detect 5h resets (resets_at changed since last check)
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

    // 4. Calculate delta
    const deltas = [
      { key: '5h', delta: Math.max(0, (currentSnap.five_hour_pct ?? 0) - (session.snapshot_at_start.five_hour_pct ?? 0)) },
      { key: '7d', delta: Math.max(0, (currentSnap.seven_day_pct ?? 0) - (session.snapshot_at_start.seven_day_pct ?? 0)) },
      { key: '7d_sonnet', delta: Math.max(0, (currentSnap.seven_day_sonnet_pct ?? 0) - (session.snapshot_at_start.seven_day_sonnet_pct ?? 0)) },
      { key: '7d_opus', delta: Math.max(0, (currentSnap.seven_day_opus_pct ?? 0) - (session.snapshot_at_start.seven_day_opus_pct ?? 0)) },
    ]

    const worst = deltas.reduce((a, b) => (a.delta > b.delta ? a : b))

    // 4. Alert if over budget
    if (worst.delta >= schedule.usage_budget_pct!) {
      const seat = await Seat.findById(seatId, 'label email')
      const label = seat?.label || seat?.email || seatId
      const userName = (schedule.user_id as any).name || ''

      if (await insertIfNew(seatId, 'usage_exceeded',
        `${userName} vượt budget: ${worst.delta.toFixed(1)}% / ${schedule.usage_budget_pct}% (${worst.key})`,
        { delta: worst.delta, budget: schedule.usage_budget_pct, window: worst.key, user_id: userId, user_name: userName },
        label, schedule.usage_budget_pct ?? undefined,
      )) created++

      // Notify next scheduled user
      await notifyNextUser(seatId, dayOfWeek, currentHour, label).catch(console.error)
    }
  }

  // 5. Session cleanup — resolve expired sessions
  await cleanupExpiredSessions(dayOfWeek, currentHour)

  if (created > 0) console.log(`[BudgetAlert] Created ${created} usage_exceeded alerts`)
}

/** Notify the next scheduled user that the current user exceeded budget */
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

/** Clean up expired sessions: persist metrics, check waste/7d_risk alerts, auto-resolve */
async function cleanupExpiredSessions(dayOfWeek: number, currentHour: number) {
  const sessions = await ActiveSession.find({}).populate('schedule_id')

  for (const session of sessions) {
    const sched = session.schedule_id as any
    if (!sched || sched.day_of_week !== dayOfWeek || sched.end_hour <= currentHour) {
      // Persist SessionMetric before deleting
      await persistSessionMetric(session, sched)

      // Auto-resolve usage_exceeded alerts
      await Alert.updateMany(
        { seat_id: session.seat_id, type: 'usage_exceeded', resolved: false },
        { $set: { resolved: true, resolved_at: new Date() } },
      )
      await session.deleteOne()
    }
  }
}

/** Persist session metrics and check waste/7d_risk alerts */
async function persistSessionMetric(session: any, sched: any) {
  const seatId = String(session.seat_id)
  const userId = String(session.user_id)

  // Get end snapshot
  const endSnap = await UsageSnapshot.findOne({ seat_id: seatId }).sort({ fetched_at: -1 })
  if (!endSnap) return

  const startSnap = session.snapshot_at_start
  const delta5h = Math.max(0, (endSnap.five_hour_pct ?? 0) - (startSnap.five_hour_pct ?? 0))
  const delta7d = Math.max(0, (endSnap.seven_day_pct ?? 0) - (startSnap.seven_day_pct ?? 0))
  const delta7dSonnet = Math.max(0, (endSnap.seven_day_sonnet_pct ?? 0) - (startSnap.seven_day_sonnet_pct ?? 0))
  const delta7dOpus = Math.max(0, (endSnap.seven_day_opus_pct ?? 0) - (startSnap.seven_day_opus_pct ?? 0))

  const durationHours = sched ? (sched.end_hour - sched.start_hour) : 0
  const impactRatio = delta5h > 0 ? delta7d / delta5h : null
  // Utilization: how much of the 5h window was used, normalized by session duration
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

  // Check waste alert: session > 2h but Δ5h < 5%
  if (durationHours >= 2 && delta5h < 5) {
    const seat = await Seat.findById(seatId, 'label email')
    const label = seat?.label || seat?.email || seatId
    const userName = sched?.user_id?.name || ''
    await insertIfNew(seatId, 'session_waste',
      `${userName} dùng ${durationHours}h nhưng chỉ dùng ${delta5h.toFixed(1)}% 5h window`,
      { delta: delta5h, duration: durationHours, user_id: userId, user_name: userName },
      label,
    )
  }

  // Check 7d risk: 7d > 70% and projected remaining sessions would push > 90%
  const current7d = endSnap.seven_day_pct ?? 0
  if (current7d > 70) {
    const remainingToday = await Schedule.countDocuments({
      seat_id: seatId,
      day_of_week: new Date().getDay(),
      start_hour: { $gt: sched?.end_hour ?? 0 },
    })
    // Estimate: each remaining session uses avg delta7d
    const avgMetrics = await SessionMetric.aggregate([
      { $match: { seat_id: session.seat_id } },
      { $group: { _id: null, avg_delta_7d: { $avg: '$delta_7d_pct' } } },
    ])
    const avgDelta7d = avgMetrics[0]?.avg_delta_7d ?? delta7d
    const projected = current7d + remainingToday * avgDelta7d

    if (projected > 90) {
      const seat = await Seat.findById(seatId, 'label email')
      const label = seat?.label || seat?.email || seatId
      await insertIfNew(seatId, '7d_risk',
        `Seat ${label}: 7d hiện ${current7d.toFixed(0)}%, dự kiến ${projected.toFixed(0)}% sau ${remainingToday} sessions`,
        { current_7d: current7d, projected, remaining_sessions: remainingToday },
        label,
      )
    }
  }
}
