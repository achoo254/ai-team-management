# Phase 2: Alert Service Logic

**Priority:** High | **Effort:** M | **Status:** Complete

## Overview

Add `checkFastBurnAlerts()` and `checkQuotaForecastAlerts()` to `alert-service.ts`, integrate into `checkSnapshotAlerts()` flow.

## Context

- [quota-forecast-service.ts](../../packages/api/src/services/quota-forecast-service.ts) — reuse `forecastSeatQuota()` for 7d prediction
- [alert-service.ts](../../packages/api/src/services/alert-service.ts) — main alert check runs every 5 min

## Files to Modify

1. `packages/api/src/services/alert-service.ts` — Add 2 check functions + integrate

## Implementation Steps

### 1. Add `checkFastBurnAlerts()` function

**Logic** (runs per seat per watcher, after snapshots are fetched):

```typescript
async function checkFastBurnAlerts(
  snapshots: Array<{ _id: any; snapshot: any }>,
  seatMap: Map<string, any>,
  watchers: IUser[],
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

    // Calculate velocity + ETA
    const cycleStart = new Date(resetsAt).getTime() - 5 * 3600_000
    const hoursElapsed = (now - cycleStart) / 3600_000

    // Noise guard: skip first 30 min of cycle
    if (hoursElapsed < 0.5) continue
    if (fiveHourPct <= 0) continue

    const velocity = fiveHourPct / hoursElapsed  // %/h
    const etaHours = fiveHourPct >= 100 ? 0 : (100 - fiveHourPct) / velocity

    const seatWatchers = watchers.filter(u =>
      (u.watched_seats ?? []).some(ws => String(ws.seat_id) === String(seatId))
    )

    for (const user of seatWatchers) {
      const ws = (user.watched_seats ?? []).find(w => String(w.seat_id) === String(seatId))
      if (!ws) continue

      // null = disabled
      const burnThreshold = ws.burn_rate_threshold ?? 15
      const etaThreshold = ws.eta_warning_hours ?? 1.5
      if (ws.burn_rate_threshold === null || ws.eta_warning_hours === null) continue

      // Combined trigger: velocity high AND ETA short
      if (velocity >= burnThreshold && etaHours <= etaThreshold) {
        const msg = `⚡ Seat ${label}: cháy ${velocity.toFixed(0)}%/h, còn ~${etaHours < 1 ? Math.round(etaHours * 60) + ' phút' : etaHours.toFixed(1) + 'h'} đến hết quota 5h (hiện ${fiveHourPct.toFixed(0)}%)`
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
```

### 2. Add `checkQuotaForecastAlerts()` function

**Logic** (uses existing `forecastSeatQuota()`):

```typescript
import { forecastSeatQuota } from './quota-forecast-service.js'

async function checkQuotaForecastAlerts(
  seatIds: string[],
  seatMap: Map<string, any>,
  watchers: IUser[],
): Promise<number> {
  let created = 0
  const now = new Date()

  for (const seatIdStr of seatIds) {
    const seat = seatMap.get(seatIdStr)
    if (!seat) continue
    const label = seat.label || seat.email

    const forecast = await forecastSeatQuota(seatIdStr, label, now)

    // Skip if no useful data or already past threshold
    if (!forecast.slope_per_hour || forecast.slope_per_hour <= 0) continue
    if (!forecast.resets_at) continue

    const seatWatchers = watchers.filter(u =>
      (u.watched_seats ?? []).some(ws => String(ws.seat_id) === seatIdStr)
    )

    for (const user of seatWatchers) {
      const ws = (user.watched_seats ?? []).find(w => String(w.seat_id) === seatIdStr)
      if (!ws) continue

      const forecastWarningHours = ws.forecast_warning_hours ?? 48
      if (ws.forecast_warning_hours === null) continue  // disabled

      const userThreshold = ws.threshold_7d_pct
      if (forecast.current_pct >= userThreshold) continue  // already above → rate_limit handles

      const hoursToThreshold = (userThreshold - forecast.current_pct) / forecast.slope_per_hour
      const hoursToReset = (new Date(forecast.resets_at).getTime() - now.getTime()) / 3600_000

      // Trigger: will hit threshold before reset AND within warning window
      if (hoursToThreshold < hoursToReset && hoursToThreshold <= forecastWarningHours) {
        const etaStr = hoursToThreshold < 24
          ? `${Math.round(hoursToThreshold)}h`
          : `${(hoursToThreshold / 24).toFixed(1)} ngày`
        const msg = `📊 Seat ${label}: dự đoán chạm ${userThreshold}% trong ~${etaStr} (hiện ${forecast.current_pct.toFixed(0)}%, slope ${forecast.slope_per_hour.toFixed(1)}%/h). Reset sau ${(hoursToReset / 24).toFixed(1)} ngày.`
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
```

### 3. Modify `insertIfNewPerUser()` dedup logic

Add special dedup window for `fast_burn`:

```typescript
// In insertIfNewPerUser(), change dedup window:
const dedupHours = type === 'fast_burn' ? 4 : 24
const dedupAgo = new Date(Date.now() - dedupHours * 60 * 60 * 1000)
```

For `fast_burn` re-alert logic (similar to rate_limit): allow re-alert if velocity dipped below threshold since last alert.

### 4. Integrate into `checkSnapshotAlerts()`

Add after existing Step 2 (token_failure checks):

```typescript
// 3. Fast burn checks (5h velocity + ETA)
created += await checkFastBurnAlerts(snapshots, seatMap, watchers)

// 4. Quota forecast checks (7d linear projection)
const seatIdStrs = seatIds.map(id => String(id))
created += await checkQuotaForecastAlerts(seatIdStrs, seatMap, watchers)
```

## Important Notes

- `forecastSeatQuota()` already handles edge cases: insufficient data, decreasing trend, reset-first
- `fast_burn` noise guard (0.5h min elapsed) prevents false positives at cycle start
- Both checks run on same 5-min cron cycle — no additional cron job needed
- Combined trigger (velocity AND ETA) prevents false alerts from either condition alone

## Success Criteria

- [x] `fast_burn` alert created when velocity ≥ 15%/h AND ETA ≤ 1.5h
- [x] `quota_forecast` alert created when projected to hit threshold before reset within warning window
- [x] `fast_burn` dedup at 4h, `quota_forecast` at 24h
- [x] No alerts for disabled settings (null values)
- [x] No alerts when insufficient data (noise guard)
- [x] Existing `rate_limit` and `token_failure` alerts unaffected
