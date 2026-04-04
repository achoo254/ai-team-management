import { Alert } from '../models/alert.js'
import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { getOrCreateSettings } from '../models/setting.js'
import { sendAlertNotification } from './telegram-service.js'
import type { AlertType } from '@repo/shared/types'

/** Atomically insert alert if no unresolved alert exists for same seat+type. Sends Telegram on success. */
async function insertIfNew(
  seatId: string,
  type: AlertType,
  message: string,
  metadata: Record<string, unknown>,
  seatLabel: string,
  threshold?: number,
): Promise<boolean> {
  // Atomic upsert: only creates if no unresolved alert exists for this seat+type
  const result = await Alert.findOneAndUpdate(
    { seat_id: seatId, type, resolved: false },
    { $setOnInsert: { seat_id: seatId, type, message, metadata, resolved: false } },
    { upsert: true, new: true, rawResult: true },
  )
  if (!result.lastErrorObject?.updatedExisting) {
    try {
      await sendAlertNotification(type, seatLabel, metadata, threshold)
    } catch (err) {
      console.error('[Alert] Telegram notification failed:', err)
    }
    return true
  }
  return false
}

/** Check alerts based on latest UsageSnapshot data + seat token status */
export async function checkSnapshotAlerts() {
  const settings = await getOrCreateSettings()
  const { rate_limit_pct, extra_credit_pct } = settings.alerts
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

  // 2. Check rate_limit + extra_credit for each snapshot
  for (const { _id: seatId, snapshot } of snapshots) {
    const seat = seatMap.get(String(seatId))
    if (!seat) continue
    const label = seat.label || seat.email

    // Rate limit: check all windows, alert on highest
    const windows = [
      { key: '5h' as const, pct: snapshot.five_hour_pct },
      { key: '7d' as const, pct: snapshot.seven_day_pct },
      { key: '7d_sonnet' as const, pct: snapshot.seven_day_sonnet_pct },
      { key: '7d_opus' as const, pct: snapshot.seven_day_opus_pct },
    ].filter((w) => w.pct != null && w.pct >= rate_limit_pct)

    if (windows.length > 0) {
      const worst = windows.reduce((a, b) => (a.pct! > b.pct! ? a : b))
      const msg = `Seat ${label}: ${worst.pct}% usage (${worst.key} window, ngưỡng: ${rate_limit_pct}%)`
      if (await insertIfNew(String(seatId), 'rate_limit', msg, {
        window: worst.key, pct: worst.pct,
      }, label, rate_limit_pct)) created++
    }

    // Extra credit
    const extra = snapshot.extra_usage
    if (extra?.is_enabled && extra.utilization != null && extra.utilization >= extra_credit_pct) {
      const msg = `Seat ${label}: extra credits ${extra.utilization}% used ($${extra.used_credits}/$${extra.monthly_limit})`
      if (await insertIfNew(String(seatId), 'extra_credit', msg, {
        pct: extra.utilization,
        credits_used: extra.used_credits,
        credits_limit: extra.monthly_limit,
      }, label, extra_credit_pct)) created++
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
