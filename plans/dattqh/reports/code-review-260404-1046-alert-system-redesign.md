# Code Review: Alert System Redesign

**Date:** 2026-04-04
**Reviewer:** code-reviewer
**Scope:** 14 files, ~450 LOC changed
**Focus:** Correctness, security, error handling, edge cases

## Overall Assessment

Solid redesign. Clean separation of concerns, good dedup logic, proper auth on settings. Several production-relevant issues found — one critical race condition, a few high-priority gaps.

---

## Critical Issues

### 1. Race condition in `insertIfNew` (alert-service.ts:17-19)

**File:** `packages/api/src/services/alert-service.ts` lines 17-19

```ts
const existing = await Alert.findOne({ seat_id: seatId, type, resolved: false }).lean()
if (existing) return false
await Alert.create({ seat_id: seatId, type, message, metadata })
```

**Problem:** Classic check-then-act race. Two concurrent cron executions (or admin button + cron) can both pass `findOne`, both create duplicate alerts. The compound index `{ seat_id, type, resolved }` is NOT a unique index — it just speeds queries.

**Fix:** Use `findOneAndUpdate` with `upsert` + `setOnInsert`, or add a unique partial index:

```ts
// Option A: Atomic upsert
const result = await Alert.findOneAndUpdate(
  { seat_id: seatId, type, resolved: false },
  { $setOnInsert: { seat_id: seatId, type, message, metadata, resolved: false } },
  { upsert: true, new: true, rawResult: true },
)
if (!result.lastErrorObject?.updatedExisting) {
  // New alert was created — send notification
  await sendAlertNotification(type, seatLabel, metadata, threshold)
  return true
}
return false
```

```ts
// Option B: Unique partial index (add to alert.ts)
alertSchema.index(
  { seat_id: 1, type: 1 },
  { unique: true, partialFilterExpression: { resolved: false } }
)
```

**Impact:** Duplicate alerts in DB + duplicate Telegram notifications.

---

## High Priority

### 2. `getOrCreateSettings` race condition (setting.ts:21-29)

Two concurrent requests can both `findOne()` returning null, both `create()` — two settings docs. Subsequent `findOne()` returns whichever was first, but stale data may persist.

**Fix:** Use `findOneAndUpdate` with `upsert` + `$setOnInsert`:

```ts
export async function getOrCreateSettings(): Promise<ISetting> {
  return Setting.findOneAndUpdate(
    {},
    { $setOnInsert: { alerts: { rate_limit_pct: ..., extra_credit_pct: ... } } },
    { upsert: true, new: true },
  )
}
```

### 3. No pagination on GET /api/alerts (alerts.ts:12-20)

`Alert.find(filter)` with no `.limit()`. Over time, resolved alerts accumulate unboundedly. A single GET can return thousands of documents.

**Fix:** Add `.limit(200)` or accept `?limit=N&skip=N` params with a max cap.

### 4. `NaN` propagation in settings input (admin.tsx:107-112)

Frontend `Number(e.target.value)` when input is empty string returns `NaN`. This `NaN` gets sent to the API. The server validation `v <= 0 || v > 100` does catch `NaN` (NaN comparisons are false), but the user sees the generic error without understanding why.

However, the actual issue is: `Number("")` = `0`, and `0 <= 0` is true, so it IS caught. But `Number("abc")` = `NaN`, and `NaN <= 0` is false AND `NaN > 100` is false — **bypasses validation**. `NaN` gets written to DB.

**Fix (server):** Add explicit NaN check:

```ts
if (isNaN(v) || v <= 0 || v > 100) {
  res.status(400).json({ error: 'rate_limit_pct must be 1-100' }); return
}
```

### 5. No `isNaN` check for float/negative in settings PUT (settings.ts:31-39)

Also: `Number(alerts.rate_limit_pct)` accepts floats like `99.999`. Consider `Math.round()` or reject non-integers if that's the intent.

### 6. Cron swallows `collectAllUsage` error but still runs `checkSnapshotAlerts` (index.ts:80-85)

```ts
await collectAllUsage().catch(console.error)  // error swallowed
await checkSnapshotAlerts().catch(console.error)  // runs even if collection failed
```

If usage collection fails, snapshots are stale. `checkSnapshotAlerts` will either do nothing (if no recent snapshots within 1h) or check stale data. This is mostly safe due to the 1-hour window filter, but the pattern is fragile.

**Fix:** Chain with early return:

```ts
try {
  await collectAllUsage()
} catch (err) {
  console.error('[Cron] Usage collection failed, skipping alert check:', err)
  return
}
await checkSnapshotAlerts().catch(console.error)
```

---

## Medium Priority

### 7. `token_failure` alerts never auto-resolve

When a token error is fixed (token refreshed, `last_fetch_error` cleared), the `token_failure` alert stays unresolved forever until admin manually resolves it. Consider auto-resolving when `last_fetch_error` becomes null.

**Suggestion:** In `checkSnapshotAlerts`, after checking for failed seats, also resolve token_failure alerts for seats that no longer have errors:

```ts
const healthyTokenSeats = await Seat.find(
  { token_active: true, last_fetch_error: null },
  '_id',
).lean()
if (healthyTokenSeats.length) {
  await Alert.updateMany(
    { seat_id: { $in: healthyTokenSeats.map(s => s._id) }, type: 'token_failure', resolved: false },
    { resolved: true, resolved_by: 'system', resolved_at: new Date() },
  )
}
```

### 8. `rate_limit` alerts also never auto-resolve when usage drops

Same concept — if usage drops below threshold, the unresolved alert persists. Consider auto-resolving rate_limit alerts when all windows are below threshold.

### 9. GET /api/settings accessible to all authenticated users (settings.ts:11)

Any logged-in user can read alert thresholds. Not a security risk per se (thresholds aren't sensitive), but inconsistent — the admin page is the only consumer. Consider if this should be admin-only for consistency.

### 10. `seat_id` type mismatch between shared types and hooks

`shared/types.ts` Alert has `seat_id: string`, but `use-alerts.ts` Alert has `seat_id: { _id: string; email: string; label: string } | string`. The populated variant isn't reflected in the shared type. This works at runtime (Mongoose populate), but the shared type is misleading.

### 11. Vietnamese in alert messages (alert-service.ts:66-67, 92-93)

Alert messages mix Vietnamese and English: `"ngưỡng: 80%"`, `"token loi"`. These messages are stored in DB and sent to Telegram. If the audience changes, these are hard to i18n later. Low risk for internal tool.

---

## Low Priority

### 12. `metadata` typed as `Record<string, unknown>` in model but `AlertMetadata` in shared

The Mongoose model uses `Schema.Types.Mixed` (any shape), but shared types define a strict `AlertMetadata`. No runtime validation that metadata matches the expected shape. Works because the service controls all writes, but a migration or manual DB edit could break the frontend.

### 13. No index on `Seat.token_active + last_fetch_error`

`Seat.find({ token_active: true, last_fetch_error: { $ne: null } })` — runs every 30 min. With few seats (<100), this is fine. If seats grow, consider compound index.

### 14. `buildProgressBar` can produce negative repeat count

`Math.round(pct / 10)` when `pct > 100` gives `filled > 10`, so `empty` becomes negative. `''.repeat(-1)` throws `RangeError`. Edge case if UsageLog has pct > 100.

---

## Positive Observations

- Clean dedup strategy (1 unresolved per seat+type) — correct business logic
- Proper `requireAdmin` on PUT /api/settings and POST /check-alerts
- Telegram errors caught in `insertIfNew` — alert still created even if notification fails
- Good use of aggregation pipeline for latest-snapshot-per-seat
- HTML escaping via `esc()` in Telegram messages — prevents injection
- 1-hour window filter prevents checking stale snapshots
- Compound index on alerts for query performance

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix `insertIfNew` race with atomic upsert or unique partial index
2. **[HIGH]** Add `isNaN` check in settings PUT validation
3. **[HIGH]** Fix `getOrCreateSettings` race with upsert pattern
4. **[HIGH]** Add limit/pagination to GET /api/alerts
5. **[MEDIUM]** Auto-resolve `token_failure` alerts when error clears
6. **[MEDIUM]** Chain cron: skip alert check if collection failed
7. **[LOW]** Align shared types with populated variants

---

## Unresolved Questions

1. Should `rate_limit` alerts auto-resolve when usage drops below threshold? Current behavior requires manual resolution.
2. Should settings be versioned/audited (who changed threshold, when)?
3. Is there a plan to clean up old resolved alerts? No TTL index or cleanup job exists.

**Status:** DONE
**Summary:** Alert system redesign reviewed. 1 critical race condition in dedup logic, 3 high-priority validation/pagination gaps, several medium improvements for auto-resolution and cron resilience.
**Concerns:** The `insertIfNew` race condition is the highest risk — under concurrent cron + admin trigger, duplicate alerts and duplicate Telegram messages will occur in production.
