# Phase 2: Alert Service & Cron Integration

## Priority: High | Status: completed

## Overview
Rewrite alert-service.ts to use UsageSnapshot data. Change dedup to unresolved-based. Chain alert check after usage collection cron.

## Files to Modify
- `packages/api/src/services/alert-service.ts` — Full rewrite
- `packages/api/src/index.ts` — Chain checkSnapshotAlerts after collectAllUsage

## Key Insights
- UsageSnapshot has: `five_hour_pct`, `seven_day_pct`, `seven_day_sonnet_pct`, `seven_day_opus_pct`, `extra_usage.*`
- Seat model has: `token_active`, `last_fetch_error`, `label`, `email`
- Latest snapshot per seat: aggregate `$sort fetched_at desc` + `$group $first`
- Dedup: query `Alert.findOne({ seat_id, type, resolved: false })` instead of date range

## Implementation Steps

### 1. Rewrite `alert-service.ts`

**New `insertIfNew` logic:**
```ts
// Check: does unresolved alert exist for this seat+type?
const existing = await Alert.findOne({ seat_id, type, resolved: false }).lean()
if (existing) return false
// Create with metadata
await Alert.create({ seat_id, type, message, metadata })
return true
```

**New `checkSnapshotAlerts()` function:**
```ts
export async function checkSnapshotAlerts() {
  const settings = await Setting.getOrCreate()
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
  const seatIds = snapshots.map(s => s._id)
  const seats = await Seat.find({ _id: { $in: seatIds } }, 'label email token_active last_fetch_error').lean()
  const seatMap = new Map(seats.map(s => [String(s._id), s]))

  // 2. Check rate_limit for each snapshot
  for (const { _id: seatId, snapshot } of snapshots) {
    const seat = seatMap.get(String(seatId))
    if (!seat) continue
    const label = seat.label || seat.email

    // Rate limit: check all windows, alert on highest
    const windows = [
      { key: '5h', pct: snapshot.five_hour_pct },
      { key: '7d', pct: snapshot.seven_day_pct },
      { key: '7d_sonnet', pct: snapshot.seven_day_sonnet_pct },
      { key: '7d_opus', pct: snapshot.seven_day_opus_pct },
    ].filter(w => w.pct != null && w.pct >= rate_limit_pct)

    if (windows.length > 0) {
      // Pick highest usage window for the alert
      const worst = windows.reduce((a, b) => (a.pct! > b.pct! ? a : b))
      const msg = `Seat ${label}: ${worst.pct}% usage (${worst.key} window, ngưỡng: ${rate_limit_pct}%)`
      if (await insertIfNew(String(seatId), 'rate_limit', msg, {
        window: worst.key, pct: worst.pct,
      })) created++
    }

    // Extra credit
    const extra = snapshot.extra_usage
    if (extra?.is_enabled && extra.utilization != null && extra.utilization >= extra_credit_pct) {
      const msg = `Seat ${label}: extra credits ${extra.utilization}% used ($${extra.used_credits}/$${extra.monthly_limit})`
      if (await insertIfNew(String(seatId), 'extra_credit', msg, {
        pct: extra.utilization,
        credits_used: extra.used_credits,
        credits_limit: extra.monthly_limit,
      })) created++
    }
  }

  // 3. Check token_failure — seats with active token but fetch error
  const failedSeats = await Seat.find({
    token_active: true,
    last_fetch_error: { $ne: null },
  }, 'label email last_fetch_error').lean()

  for (const seat of failedSeats) {
    const label = seat.label || seat.email
    const msg = `Seat ${label}: token lỗi — ${seat.last_fetch_error}`
    if (await insertIfNew(String(seat._id), 'token_failure', msg, {
      error: seat.last_fetch_error?.slice(0, 200),
    })) created++
  }

  return { alertsCreated: created }
}
```

Remove old `checkAlerts()` export entirely.

### 2. Update `index.ts` cron

Chain after collectAllUsage:
```ts
cron.schedule('*/30 * * * *', async () => {
  console.log('[Cron] Triggering usage collection...')
  await collectAllUsage().catch(console.error)
  console.log('[Cron] Checking snapshot alerts...')
  await checkSnapshotAlerts().catch(console.error)
}, { timezone: 'Asia/Ho_Chi_Minh' })
```

Import `checkSnapshotAlerts` instead of old `checkAlerts`.

### 3. Update `routes/admin.ts`

Change `POST /api/admin/check-alerts` to call `checkSnapshotAlerts()` instead of `checkAlerts()`.

## Todo
- [x] Rewrite alert-service.ts with new insertIfNew + checkSnapshotAlerts
- [x] Remove all UsageLog imports from alert-service
- [x] Update index.ts cron to chain alert check
- [x] Update admin.ts route import
- [x] Run `pnpm build` to verify

## Success Criteria
- Alert service creates alerts from UsageSnapshot data
- No references to old alert types in service code
- Cron chains collection → alert check
- `pnpm build` passes
