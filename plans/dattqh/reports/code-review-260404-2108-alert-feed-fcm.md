# Code Review: Alert Feed Refactor + FCM Push + In-app Notification

**Date:** 2026-04-04
**Reviewer:** code-reviewer
**Scope:** 5-phase feature across API + Web — models, routes, services, hooks, UI components
**Files reviewed:** ~25 changed/new files
**Build:** PASS | **Tests:** 28/28 PASS

---

## Overall Assessment

Solid feature delivery. Clean separation of concerns, good use of `Promise.allSettled` for fault-tolerant notifications, proper `toJSON` stripping of FCM tokens. However, there are two critical findings (auth bypass, unbounded array growth) and several high-priority issues that should be addressed before production.

---

## Critical Issues

### C1. mark-read endpoint has no scope check — any user can mark ANY alert as read

**File:** `packages/api/src/routes/alerts.ts` line 44-61

The `POST /api/alerts/mark-read` accepts arbitrary `alert_ids` and runs `updateMany` without verifying the caller has access to those alerts. A non-admin user can mark alerts for seats they do not watch as read, affecting the `read_by` array for other users' unread-count queries.

**Impact:** Data integrity violation. While `read_by` is per-user (addToSet of own `_id`), the lack of scope validation means a user can inject their own `_id` into alerts they shouldn't see, which is a trust boundary violation.

**Fix:** Scope the `updateMany` filter to watched seats for non-admin:
```ts
const filter: Record<string, unknown> = { _id: { $in: alert_ids } }
if (req.user!.role !== 'admin') {
  const user = await User.findById(req.user!._id, 'watched_seat_ids')
  const watchedIds = (user?.watched_seat_ids ?? []).map(String)
  filter.seat_id = { $in: watchedIds }
}
const result = await Alert.updateMany(filter, { $addToSet: { read_by: req.user!._id } })
```

### C2. `read_by` array grows unbounded — no TTL or cleanup on alerts

**File:** `packages/api/src/models/alert.ts`

Alerts are created by cron jobs every 5 minutes. With 1h cooldown per seat+type, a single seat can generate ~4 alert types x 24 alerts/day = ~96 alerts/day. Over months, the `alerts` collection grows indefinitely and `read_by` arrays accumulate user ObjectIds.

**Impact:** MongoDB document bloat, degraded query performance on `{ read_by: { $ne: userId } }` (must scan every read_by array). The `{ read_by: 1 }` index helps but multikey indexes on growing arrays are costly.

**Fix:** Add a TTL index on `created_at` (e.g., 30 days):
```ts
alertSchema.index({ created_at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })
```

---

## High Priority

### H1. Race condition in `insertIfNew` — cooldown check + create is not atomic

**File:** `packages/api/src/services/alert-service.ts` lines 22-31

Previous code used `findOneAndUpdate` with `$setOnInsert` (atomic upsert). New code does `findOne` then `create` — two separate operations. Under concurrent cron invocations, duplicate alerts can be created.

**Impact:** Duplicate alerts and duplicate notifications sent to users.

**Fix:** Restore atomic pattern or add a unique compound index on `{ seat_id, type, created_at }` with a partial filter for the cooldown window. Alternatively:
```ts
const alert = await Alert.findOneAndUpdate(
  { seat_id: seatId, type, created_at: { $gte: oneHourAgo } },
  { $setOnInsert: { seat_id: seatId, type, message, metadata, read_by: [] } },
  { upsert: true, new: true, rawResult: true },
)
```

### H2. `alert_ids` input not validated — malformed ObjectIds cause 500

**File:** `packages/api/src/routes/alerts.ts` line 53

`alert_ids` is checked to be a non-empty array but individual elements are not validated as valid ObjectIds. Passing `["not-an-objectid"]` causes Mongoose CastError → 500.

**Fix:** Validate each element:
```ts
import mongoose from 'mongoose'
const validIds = alert_ids.filter((id: unknown) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
if (validIds.length === 0) { res.status(400).json({ error: 'No valid alert_ids' }); return }
```

### H3. N+1 query pattern in GET /alerts and GET /unread-count for non-admin users

**File:** `packages/api/src/routes/alerts.ts` lines 20-21 and 72-73

Every request from a non-admin user fires an additional `User.findById` to get `watched_seat_ids`. With 60s polling on unread-count, this is 1 extra DB round-trip per user per minute.

**Impact:** Unnecessary DB load. The `watched_seat_ids` are already available on `req.user` if the `authenticate` middleware populates them.

**Fix:** Include `watched_seat_ids` in the JWT payload or in the user lookup done by `authenticate` middleware, so `req.user.watched_seat_ids` is always available.

### H4. Non-admin user can filter by seat ID outside their watched list

**File:** `packages/api/src/routes/alerts.ts` line 27

```ts
filter.seat_id = seat ? seat : { $in: watchedIds }
```

If `seat` query param is provided, it's used directly without checking it's in `watchedIds`. A non-admin user can pass `?seat=<any-seat-id>` and see alerts for seats they don't watch.

**Fix:**
```ts
if (seat) {
  if (!watchedIds.includes(seat)) { res.json({ alerts: [], has_more: false }); return }
  filter.seat_id = seat
} else {
  filter.seat_id = { $in: watchedIds }
}
```

### H5. FCM service re-fetches user inside `sendPushToUser` despite caller already having the user

**File:** `packages/api/src/services/fcm-service.ts` line 22

`sendPushToUser` takes a `userId` and does `User.findById(userId, 'fcm_tokens push_enabled')` — but the caller (`notifySubscribedUsers`) already loaded the full user object and even checked `u.push_enabled && u.fcm_tokens?.length > 0`.

**Impact:** Redundant DB query per user per alert notification.

**Fix:** Pass user object (or at least `fcm_tokens`) directly to `sendPushToUser`.

---

## Medium Priority

### M1. `before` query param parsed without validation — `new Date('garbage')` = Invalid Date

**File:** `packages/api/src/routes/alerts.ts` line 17

`new Date(before)` with invalid string creates an Invalid Date, which MongoDB may treat unpredictably.

**Fix:** Validate with `isNaN(new Date(before).getTime())` check.

### M2. Client-side unread filter uses string comparison `!a.read_by?.includes("me")`

**File:** `packages/web/src/pages/alerts.tsx` line 54

The comment says "server handles actual user check" but this means ALL fetched alerts are sent to `mark-read` on every page visit, including already-read ones. `$addToSet` is idempotent so no data corruption, but wastes a bulk write.

**Fix:** Server should return a `read` boolean per alert (computed from `read_by.includes(currentUserId)`), then filter client-side on that.

### M3. Service worker loads Firebase SDK from CDN without integrity check

**File:** `packages/web/public/firebase-messaging-sw.js` lines 2-3

`importScripts('https://www.gstatic.com/firebasejs/11.6.0/...')` — no subresource integrity. If CDN is compromised, SW executes arbitrary code.

**Impact:** Supply chain risk (low probability, high severity).

**Fix:** Consider bundling the Firebase SW SDK or pinning with SRI hashes.

### M4. Firebase config exposed via service worker URL query params

**File:** `packages/web/src/lib/firebase-client.ts` lines 54-60

`apiKey`, `projectId`, `messagingSenderId`, `appId` are passed as query params to the service worker URL. These are visible in DevTools and logged by proxies. Firebase API keys are not secrets per se (they're restricted by domain), but `appId` and `messagingSenderId` exposure aids reconnaissance.

**Impact:** Low — these are already in the client bundle. Just noting for completeness.

### M5. `fcm_tokens` cap uses two separate operations — race condition possible

**File:** `packages/api/src/routes/user-settings.ts` lines 156-160

```ts
if ((user.fcm_tokens?.length ?? 0) >= 10) {
  await User.updateOne({ _id: req.user!._id }, { $pop: { fcm_tokens: -1 } })
}
await User.updateOne({ _id: req.user!._id }, { $addToSet: { fcm_tokens: token } })
```

Two separate updates — concurrent requests can exceed the 10-token cap.

**Fix:** Combine into single atomic update, or use an aggregation pipeline update.

---

## Low Priority

### L1. `timeAgo` function duplicated in `alert-card.tsx` and `notification-bell.tsx`
Extract to shared util.

### L2. `type` query param in alerts GET not validated against enum
Any string is accepted; won't crash but returns empty results silently.

---

## Positive Observations

- **toJSON stripping** of `fcm_tokens` from User model — prevents token leak through any API endpoint returning user objects
- **Stale FCM token cleanup** in `fcm-service.ts` — handles common production scenario of expired device tokens
- **`Promise.allSettled`** for parallel Telegram + FCM — one failing channel doesn't block others
- **Proper 10-device cap** on FCM tokens per user
- **Scope filtering** for non-admin users consistently applied across GET endpoints (with caveats noted above)
- **Pagination with cursor** (`before` param + `limit+1` pattern) — good for mobile/infinite scroll
- Clean component decomposition: expandable alert cards, filter bar as separate component

---

## Recommended Actions (prioritized)

1. **[C1]** Add scope check to `POST /mark-read` — 5 min fix
2. **[C2]** Add TTL index on alerts collection — 2 min fix
3. **[H1]** Restore atomic upsert in `insertIfNew` to prevent duplicate alerts
4. **[H4]** Validate `seat` filter param against `watchedIds` for non-admin
5. **[H2]** Validate ObjectId format in `alert_ids` array
6. **[H3]** Include `watched_seat_ids` in auth middleware to avoid per-request User lookup
7. **[H5]** Pass user object to `sendPushToUser` to eliminate redundant query
8. **[M1-M5]** Address in follow-up iteration

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Feature is functional and well-structured but has auth bypass on mark-read (C1), unbounded collection growth (C2), and a race condition regression in alert dedup (H1) that should be fixed before production.
**Concerns:** C1 and H4 are both data boundary violations. H1 is a regression from the previous atomic upsert pattern.
