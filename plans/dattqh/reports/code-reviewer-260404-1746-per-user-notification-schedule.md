---
type: code-review
date: 2026-04-04
feature: per-user-notification-schedule
---

# Code Review: Per-User Notification Schedule

## Scope
- Files: 8 changed (shared types, user model, user-settings route, telegram-service, index.ts, use-user-settings hook, notification-schedule-form, settings page)
- Focus: security, data validation, correctness, performance, edge cases

## Overall Assessment
Solid feature implementation. Refactoring of telegram-service is clean and well-structured. A few issues need attention — one critical, several medium.

---

## Critical Issues

### 1. [BUG] Timezone conversion is fragile and non-deterministic
**File:** `packages/api/src/services/telegram-service.ts:225`
```ts
const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
```
`toLocaleString` output format is locale-dependent and NOT guaranteed to be parseable by `new Date()`. On some Node.js builds/ICU configs this can produce unexpected results or `Invalid Date`. This runs hourly in cron — a silent failure means NO reports ever get sent.

**Fix:** Use a reliable approach:
```ts
// Option A: Intl.DateTimeFormat (safe)
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: 'numeric', hourCycle: 'h23',
  weekday: 'short',
})
const parts = formatter.formatToParts(now)
const currentHour = Number(parts.find(p => p.type === 'hour')!.value)
const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const currentDay = dayMap[parts.find(p => p.type === 'weekday')!.value]

// Option B: temporal or date-fns-tz (recommended if already a dep)
```

### 2. [SECURITY] PUT route silently ignores invalid notification_settings
**File:** `packages/api/src/routes/user-settings.ts:53-63`

If `report_days` validation fails (e.g., `[0, 99]`), the entire `notification_settings` block is silently dropped without error response. User thinks save succeeded (200 OK) but notification settings were not updated. This is a data integrity issue.

**Fix:** Return 400 when validation fails:
```ts
if (notification_settings) {
  const ns = notification_settings
  if (!Array.isArray(ns.report_days) || !ns.report_days.every((d: number) => d >= 0 && d <= 6)) {
    res.status(400).json({ error: 'report_days must be array of integers 0-6' })
    return
  }
  // ... proceed with update
}
```

---

## High Priority

### 3. [PERF] `sendUserReport` with scope='own' still fetches ALL users and ALL snapshots
**File:** `packages/api/src/services/telegram-service.ts:192-220`

`fetchReportData()` on line 214 fetches ALL active users and ALL latest snapshots via aggregation — even when scope='own' and the user only has 1-2 seats. For a small team this is fine, but it's wasteful and scales poorly.

**Recommendation (non-blocking):** Accept optional seat IDs into `fetchReportData()` to scope the aggregation:
```ts
async function fetchReportData(seatIds?: string[]) {
  const snapQuery = seatIds
    ? [{ $match: { seat_id: { $in: seatIds.map(id => new mongoose.Types.ObjectId(id)) } } }, ...]
    : [...]
}
```

### 4. [BUG] `sendUserReport` fetches the user TWICE
**File:** `packages/api/src/services/telegram-service.ts:195,203`

Line 195 fetches user for telegram credentials, line 203 fetches same user again for `seat_ids`. Wasteful and could yield stale data if concurrent update happens between reads.

**Fix:** Fetch once with combined projection:
```ts
const user = await User.findById(userId, 'telegram_bot_token telegram_chat_id name seat_ids')
```

### 5. [BUG] Empty `report_days` array bypasses validation but causes no reports to fire
**File:** `packages/api/src/routes/user-settings.ts:56`

`[].every(...)` returns `true`, so an empty array passes validation. User enables notifications with no days selected = nothing ever fires, no feedback.

**Fix:** Add minimum length check:
```ts
if (Array.isArray(ns.report_days) && ns.report_days.length > 0 && ns.report_days.every(...))
```

---

## Medium Priority

### 6. [TYPE] `report_days` array not validated for duplicates or non-integer values
**File:** `packages/api/src/routes/user-settings.ts:56`

`[5, 5, 5]` or `[1.5]` would pass the `d >= 0 && d <= 6` check. The `Math.floor` applied to `report_hour` is not applied to day values.

**Fix:** Deduplicate and floor:
```ts
const days = [...new Set(ns.report_days.map((d: number) => Math.floor(d)))].filter(d => d >= 0 && d <= 6)
```

### 7. [EDGE CASE] Frontend allows deselecting ALL days when enabled
**File:** `packages/web/src/components/notification-schedule-form.tsx:42-49`

`toggleDay` lets user unselect all days. Combined with issue #5, user can save enabled=true with days=[] and never receive reports.

**Fix:** Prevent toggling off the last day:
```ts
function toggleDay(day: number) {
  setDirty(true);
  setNs((prev) => {
    const newDays = prev.report_days.includes(day)
      ? prev.report_days.filter((d) => d !== day)
      : [...prev.report_days, day].sort();
    if (newDays.length === 0) return prev; // prevent empty
    return { ...prev, report_days: newDays };
  });
}
```

### 8. [CONCURRENCY] No guard against duplicate report sends if cron fires twice
**File:** `packages/api/src/services/telegram-service.ts:223-245`

If the cron job takes >1 hour (unlikely but possible with many users + slow Telegram API), the next cron tick could fire overlapping sends. Consider a simple lock or `isRunning` guard.

### 9. [MISSING] No index on notification_settings query fields
**File:** `packages/api/src/models/user.ts`

`checkAndSendScheduledReports` queries on `notification_settings.report_enabled`, `report_days`, `report_hour`, `telegram_bot_token`, `telegram_chat_id`. With small user base this is fine, but if it grows, add compound index:
```ts
userSchema.index({ 'notification_settings.report_enabled': 1, 'notification_settings.report_hour': 1 })
```

---

## Low Priority

### 10. `notification_settings` schema has defaults but `IUser` marks it optional
The Mongoose schema provides defaults for all subfields, so new documents will always have `notification_settings`. But the TypeScript interface marks it `?` optional. This mismatch means code always checks for `undefined` unnecessarily. Minor — cosmetic.

### 11. PUT route requires encryption configured even when only updating notification_settings
**File:** `packages/api/src/routes/user-settings.ts:30-32`

If a user only wants to change notification schedule (not telegram token), the 503 "Encryption not configured" check blocks them. Consider moving the encryption check inside the telegram token branch only.

---

## Positive Observations
- Clean refactoring of `sendWeeklyReport` into composable helpers (`buildReportHtml`, `fetchReportData`, `buildSeatRows`)
- Server-side scope enforcement: non-admin always forced to `'own'` regardless of request payload
- Frontend correctly hides scope selector for non-admin users
- Error handling with try/catch per user in `checkAndSendScheduledReports` prevents one failure from blocking all others
- Dirty-state tracking in form prevents unnecessary saves

---

## Recommended Actions (Priority Order)
1. **Fix timezone conversion** (Critical #1) — use `Intl.DateTimeFormat.formatToParts`
2. **Return 400 on invalid notification_settings** (Critical #2)
3. **Validate non-empty report_days** (High #5 + Medium #7)
4. **Merge double user fetch** in sendUserReport (High #4)
5. **Move encryption check** to telegram-only branch (Low #11)

---

**Status:** DONE
**Summary:** Feature is well-structured with good separation of concerns. 2 critical issues (fragile timezone, silent validation failure), 3 high-priority bugs (double fetch, empty days, inefficient queries), and several medium improvements identified.
**Concerns:** Timezone bug (#1) could cause zero reports to fire silently in production depending on Node.js ICU config.
