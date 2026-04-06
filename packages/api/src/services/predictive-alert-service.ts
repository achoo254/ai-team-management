import type { IUser } from '../models/user.js'
import { forecastSeatQuota } from './quota-forecast-service.js'
import type { InsertAlertFn } from './alert-service.js'

/** Check fast_burn alerts: high velocity + low ETA in 5h window. */
export async function checkFastBurnAlerts(
  snapshots: Array<{ _id: any; snapshot: any }>,
  seatMap: Map<string, any>,
  watchers: IUser[],
  insertIfNewPerUser: InsertAlertFn,
): Promise<number> {
  let created = 0
  const now = Date.now()

  for (const { _id: seatId, snapshot } of snapshots) {
    const seat = seatMap.get(String(seatId))
    if (!seat) continue
    const label = seat.label || seat.email

    const fiveHourPct = snapshot.five_hour_pct
    const resetsAt = snapshot.five_hour_resets_at
    if (fiveHourPct == null || resetsAt == null) continue

    const cycleStart = new Date(resetsAt).getTime() - 5 * 3600_000
    const hoursElapsed = (now - cycleStart) / 3600_000

    // Noise guard: skip if clock drift makes elapsed negative, or first 30 min of cycle
    if (hoursElapsed <= 0) continue
    if (hoursElapsed < 0.5) continue
    if (fiveHourPct <= 0) continue

    const velocity = fiveHourPct / hoursElapsed
    const etaHours = fiveHourPct >= 100 ? 0 : (100 - fiveHourPct) / velocity

    const seatWatchers = watchers.filter((u) =>
      (u.watched_seats ?? []).some((ws) => String(ws.seat_id) === String(seatId)),
    )

    for (const user of seatWatchers) {
      const ws = (user.watched_seats ?? []).find((w) => String(w.seat_id) === String(seatId))
      if (!ws) continue

      // null = disabled
      if (ws.burn_rate_threshold === null || ws.eta_warning_hours === null) continue
      const burnThreshold = ws.burn_rate_threshold ?? 15
      const etaThreshold = ws.eta_warning_hours ?? 1.5

      // Combined trigger: velocity high AND ETA short
      if (velocity >= burnThreshold && etaHours <= etaThreshold) {
        const etaStr = etaHours < 1 ? `${Math.round(etaHours * 60)} phút` : `${etaHours.toFixed(1)}h`
        const msg = `⚡ Seat ${label}: tiêu hao ${velocity.toFixed(0)}%/h, còn ~${etaStr} đến hết quota 5h (hiện ${fiveHourPct.toFixed(0)}%)`
        const metadata = {
          window: '5h' as const,
          pct: fiveHourPct,
          velocity: Math.round(velocity * 10) / 10,
          eta_hours: Math.round(etaHours * 100) / 100,
          burn_rate_threshold: burnThreshold,
          eta_warning_hours: etaThreshold,
          resets_at: resetsAt,
        }
        if (await insertIfNewPerUser(user, String(seatId), 'fast_burn', '5h', msg, metadata, label)) created++
      }
    }
  }
  return created
}

/** Check quota_forecast alerts: 7d linear projection toward user threshold. */
export async function checkQuotaForecastAlerts(
  seatIds: string[],
  seatMap: Map<string, any>,
  watchers: IUser[],
  insertIfNewPerUser: InsertAlertFn,
): Promise<number> {
  let created = 0
  const now = new Date()

  for (const seatIdStr of seatIds) {
    const seat = seatMap.get(seatIdStr)
    if (!seat) continue
    const label = seat.label || seat.email

    // TODO: batch forecast queries — currently 2 DB queries per seat (N+1)
    const forecast = await forecastSeatQuota(seatIdStr, label, now)

    // Skip if no useful data or already past threshold
    if (!forecast.slope_per_hour || forecast.slope_per_hour <= 0) continue
    if (!forecast.resets_at) continue

    const seatWatchers = watchers.filter((u) =>
      (u.watched_seats ?? []).some((ws) => String(ws.seat_id) === seatIdStr),
    )

    for (const user of seatWatchers) {
      const ws = (user.watched_seats ?? []).find((w) => String(w.seat_id) === seatIdStr)
      if (!ws) continue

      if (ws.forecast_warning_hours === null) continue // disabled
      const forecastWarningHours = ws.forecast_warning_hours ?? 48

      const userThreshold = ws.threshold_7d_pct
      if (forecast.current_pct >= userThreshold) continue // already above → rate_limit handles

      const hoursToThreshold = (userThreshold - forecast.current_pct) / forecast.slope_per_hour
      const hoursToReset = (new Date(forecast.resets_at).getTime() - now.getTime()) / 3600_000

      // Trigger: will hit threshold before reset AND within warning window
      if (hoursToThreshold < hoursToReset && hoursToThreshold <= forecastWarningHours) {
        const etaStr = hoursToThreshold < 24
          ? `${Math.round(hoursToThreshold)}h`
          : `${(hoursToThreshold / 24).toFixed(1)} ngày`
        const msg = `📊 Seat ${label}: dự đoán chạm ${userThreshold}% trong ~${etaStr} (hiện ${forecast.current_pct.toFixed(0)}%, tăng ${forecast.slope_per_hour.toFixed(1)}%/h). Reset sau ${(hoursToReset / 24).toFixed(1)} ngày.`
        const metadata = {
          window: '7d' as const,
          pct: forecast.current_pct,
          threshold: userThreshold,
          slope_per_hour: Math.round(forecast.slope_per_hour * 100) / 100,
          hours_to_threshold: Math.round(hoursToThreshold * 10) / 10,
          hours_to_reset: Math.round(hoursToReset * 10) / 10,
          forecast_warning_hours: forecastWarningHours,
          resets_at: forecast.resets_at,
        }
        if (await insertIfNewPerUser(user, seatIdStr, 'quota_forecast', '7d', msg, metadata, label)) created++
      }
    }
  }
  return created
}
