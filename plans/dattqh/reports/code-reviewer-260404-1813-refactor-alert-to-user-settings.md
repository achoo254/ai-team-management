---
type: code-review
date: 2026-04-04
scope: refactor-alert-to-user-settings
---

# Code Review: Refactor Alert Settings to User Settings

## Overall Assessment

Clean refactor. Global Setting model eliminated, per-user alert_settings added. No leftover imports. Auth boundary correct for non-admin. Two critical issues found.

## Critical Issues

### 1. Admin seat ID validation missing (authz bypass)

**File:** `packages/api/src/routes/user-settings.ts:97-103`

Admin users skip seat ID validation entirely — any string passes through, including non-existent ObjectIds. This creates garbage data in `subscribed_seat_ids` and will cause silent failures in `notifySubscribedUsers` (Mongoose query won't match).

```typescript
// Current: admin path has zero validation
let validSeatIds: string[] = as.subscribed_seat_ids ?? []
if (req.user!.role !== 'admin') { /* ... */ }
```

**Fix:** Validate all seat IDs exist regardless of role:
```typescript
let validSeatIds: string[] = as.subscribed_seat_ids ?? []
// Always validate IDs exist in DB
const existingSeats = await Seat.find({ _id: { $in: validSeatIds } }, '_id').lean()
const existingSet = new Set(existingSeats.map(s => String(s._id)))
validSeatIds = validSeatIds.filter(id => existingSet.has(id))
// Non-admin: further restrict to owned/assigned
if (req.user!.role !== 'admin') { /* existing logic */ }
```

### 2. Double notification: `insertIfNew` + `notifySubscribedUsers` race

**File:** `packages/api/src/services/alert-service.ts:32-33, 46-59`

`insertIfNew` creates alert then calls `notifySubscribedUsers` which queries users. `checkSnapshotAlerts` also pre-loads `subscribedUsers` for threshold calc but uses lowest-threshold logic for `insertIfNew` trigger. The actual notifications go to ALL subscribed users regardless of their individual threshold.

Example: User A threshold 50%, User B threshold 90%. Seat at 60%. Alert fires (min threshold = 50%). Both A and B get notified, even though B set 90%.

**Fix:** Pass individual user thresholds into `notifySubscribedUsers` and filter:
```typescript
async function notifySubscribedUsers(seatId, type, seatLabel, metadata, thresholdKey?: string, thresholdValue?: number) {
  const users = await User.find({ /* existing query */ })
  for (const user of users) {
    // Skip if user's own threshold not met
    if (thresholdKey && thresholdValue != null) {
      const userThreshold = user.alert_settings![thresholdKey as keyof IAlertSettings] as number
      if (thresholdValue < userThreshold) continue
    }
    // ... send
  }
}
```

## High Priority

### 3. `_threshold` dead parameter

**File:** `packages/api/src/services/alert-service.ts:18`

`insertIfNew` still accepts `_threshold` (prefixed underscore = unused). Called from `checkBudgetAlerts` (line 237) with actual value. Either use it or remove from all call sites. Currently confusing.

### 4. Sequential notification sends (latency)

**File:** `packages/api/src/services/alert-service.ts:53-57`

`for..of` with `await sendAlertToUser` sends sequentially. With N subscribers this is O(N) round-trips. Use `Promise.allSettled`:
```typescript
await Promise.allSettled(users.map(u => sendAlertToUser(u, type, seatLabel, metadata)))
```

## Medium Priority

### 5. GET /settings returns 3 queries for non-admin

Two Seat queries (owned + assigned) plus User query. Could merge into single query with `$or`:
```typescript
await Seat.find({ $or: [{ owner_id: userId }, { _id: { $in: seatIds } }] }).lean()
```

### 6. `sendToUser` lost system bot fallback

`sendToUser` previously sent to both system bot (group chat) AND user's personal bot. Now only sends to personal bot. If user has no bot configured, message is silently dropped. Confirm this is intentional — losing system bot means no fallback channel.

## Positive

- Seat ID auth boundary for non-admin is correct (owned + assigned filter)
- Batch user query in `checkSnapshotAlerts` avoids N+1
- Input clamping (1-100) on thresholds with floor
- 1h cooldown dedup preserved
- No leftover references to deleted `Setting` model or `settings.ts` route
- Frontend disables form when Telegram not configured

## Unresolved Questions

1. Is losing the system bot group chat notifications intentional? No fallback for token_failure alerts now.
2. Should `checkSnapshotAlerts` token_failure path also respect per-user thresholds, or notify all subscribed?
3. Migration strategy for existing users? Current users have no `alert_settings` — defaults to `undefined`, so alerts silently stop until each user manually enables.
