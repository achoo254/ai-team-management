# Phase 02 — Backend Alert Service + API

**Priority:** P0 | **Status:** pending | **Depends on:** Phase 01

## Context

- Service: `packages/api/src/services/alert-service.ts` (409 LOC — split if exceeds 200 after refactor)
- Routes: `packages/api/src/routes/user-settings.ts`, `packages/api/src/routes/alerts.ts`
- Telegram/FCM formatters: `packages/api/src/services/telegram-service.ts`, `packages/api/src/services/fcm-service.ts`

## Requirements

### Alert Service Logic Refactor

**Replace** `checkSnapshotAlerts()` rate_limit + extra_credit logic with per-user dedup loop:

```
For each recent snapshot (seat):
  Resolve watchers: User.find({ 'watched_seats.seat_id': seatId, 'alert_settings.enabled': true })
  For each watcher:
    Find user's threshold entry for this seat
    Compute 5h trigger: snapshot.five_hour_pct >= threshold_5h_pct
    Compute 7d trigger: max(seven_day_pct, seven_day_sonnet_pct, seven_day_opus_pct) >= threshold_7d_pct
    For each triggered window:
      insertIfNewPerUser(user_id, seat_id, 'rate_limit', window, msg, metadata)
```

**New dedup function** `insertIfNewPerUser(userId, seatId, type, window, msg, metadata, seatLabel)`:
- Query: `Alert.findOne({ user_id, seat_id, type, window, notified_at: { $ne: null }, created_at: { $gte: 24h ago } })`
- If exists → skip
- Else → insert + send to user's enabled channels only

**Remove entirely:**
- `extra_credit` check block (lines 164-173)
- Logic computing `lowest threshold` across users (lines 111-123)

**Keep unchanged:**
- `token_failure` check (but use new dedup → per user since it's settings-gated)
- `usage_exceeded`, `session_waste`, `7d_risk` (seat-wide alerts, `user_id = null`)

### Notification Channel Filtering

Update `sendAlertToUser` / `sendPushToUser` calls to respect:
- `user.alert_settings.telegram_enabled` → gate Telegram
- `user.push_enabled` → gate FCM (existing)
- `user.alert_settings.token_failure_enabled` → gate token_failure type

### API Endpoints

#### Modify `GET /api/user/settings`
Return shape:
```ts
{
  telegram_chat_id, telegram_topic_id, has_telegram_bot,
  watched_seats: [{ seat_id, threshold_5h_pct, threshold_7d_pct, seat_label, seat_email }],
  notification_settings, alert_settings, push_enabled,
  available_seats: [{ _id, label, email }],  // seats user can watch (not yet watched)
}
```

Note: `available_seats` now filters out seats already in `watched_seats` to simplify UI.

#### Modify `PUT /api/user/settings`
- `alert_settings` body accepts new 3-field shape.
- Remove `watched_seat_ids` param (migrate clients to new endpoints).

#### New `POST /api/user/watched-seats`
Body: `{ seat_id, threshold_5h_pct?, threshold_7d_pct? }`
- Validate seat exists + user has access (owner/assigned/admin — reuse logic from `user-settings.ts:87-92`)
- Reject if already watching
- Default thresholds: 90 / 85
- Clamp 1-100

#### New `PUT /api/user/watched-seats/:seatId`
Body: `{ threshold_5h_pct?, threshold_7d_pct? }`
- Update thresholds for existing watched seat
- 404 if not watching

#### New `DELETE /api/user/watched-seats/:seatId`
- Remove seat from `watched_seats` array
- Idempotent (no 404 if not watching — return ok)

### Alert Feed Filtering

`GET /api/alerts` (user feed): filter should return:
- Alerts where `user_id == currentUser._id` (personal alerts)
- OR `user_id == null` AND `seat_id ∈ currentUser.watched_seats[].seat_id` (seat-wide alerts for watched seats)

## Related Files

**Modify:**
- `packages/api/src/services/alert-service.ts` (major refactor)
- `packages/api/src/routes/user-settings.ts` (update GET/PUT, remove `watched_seat_ids` handling)
- `packages/api/src/routes/alerts.ts` (update filter)
- `packages/api/src/services/telegram-service.ts` (remove `extra_credit` formatter + update `sendUserReport` to read from `watched_seats[*].seat_id`)
- `packages/api/src/services/fcm-service.ts` (remove `extra_credit` formatter)

**Note:** `watched_seats` serves dual purpose — both alert scope AND weekly usage report scope. `sendUserReport()` at `telegram-service.ts:147-163` currently reads `watched_seat_ids`, must be updated to extract `seat_id` from new object array. Report logic ignores thresholds (only uses list of seats).

**Create:**
- `packages/api/src/routes/watched-seats.ts` (new router file, < 150 LOC)
- Mount in `packages/api/src/index.ts` at `/api/user/watched-seats`

**Modularization note:** If `alert-service.ts` exceeds 200 LOC after refactor, split into:
- `alert-service.ts` — orchestrator (`checkSnapshotAlerts`, `checkBudgetAlerts`)
- `alert-dedup.ts` — `insertIfNewPerUser` + notification fanout
- `alert-rate-limit-check.ts` — per-user rate_limit logic

## Implementation Steps

### Step 1: New dedup primitive
Create `insertIfNewPerUser(userId, seatId, type, window, msg, metadata, seatLabel)`:
- Query uses compound index `(user_id, seat_id, type, window, created_at)`
- Sends notification only to that user's channels
- Returns boolean (created or skipped)

### Step 2: Refactor `checkSnapshotAlerts`
- Drop `seatThresholds` Map computation.
- For each seat snapshot, load watchers via `$elemMatch` on `watched_seats`.
- Iterate watchers, compute per-window triggers, call new dedup.
- 7d window = max of 3 variants; store `{ window: '7d', max_pct, breakdown: {7d, 7d_sonnet, 7d_opus} }` in metadata.

### Step 3: Keep seat-wide alerts (null user_id)
- `token_failure`: notify each enabled watcher individually (personal dedup per user+seat+token_failure).
- `usage_exceeded`, `session_waste`, `7d_risk`: keep as `user_id = null` (1 record per seat), fanout to watchers respecting `alert_settings.enabled`.

### Step 4: Update routes
- Update `GET /api/user/settings` join: populate `watched_seats[*].seat_id` with label/email.
- Remove `watched_seat_ids` update path from `PUT /api/user/settings`.

### Step 5: Create `watched-seats.ts` router
Endpoints: POST, PUT (seatId), DELETE (seatId). Uses `authenticate` middleware. Access check reuses helper.

### Step 6: Update alert feed
`GET /api/alerts`: MongoDB filter:
```ts
$or: [
  { user_id: currentUserId },
  { user_id: null, seat_id: { $in: watchedSeatIds } },
]
```

### Step 7: Update channel formatters + report scope
- Remove any switch-case branches for `'extra_credit'` in telegram/fcm services.
- Update `telegram-service.sendUserReport()`:
  ```ts
  // Before
  const user = await User.findById(userId, '... watched_seat_ids ...')
  const watchedIds = (user.watched_seat_ids ?? []).map(String)

  // After
  const user = await User.findById(userId, '... watched_seats ...')
  const watchedIds = (user.watched_seats ?? []).map(w => String(w.seat_id))
  ```
  Fallback logic (owned + assigned seats when empty) unchanged.

### Step 8: Typecheck + run
`pnpm -F @repo/api build` → fix all TS errors.

## Todo

- [ ] Implement `insertIfNewPerUser`
- [ ] Refactor `checkSnapshotAlerts` for per-user rate_limit
- [ ] Update `token_failure` to per-user dedup
- [ ] Create `watched-seats.ts` router (POST/PUT/DELETE)
- [ ] Update `GET /api/user/settings` response (populate seat labels)
- [ ] Update `PUT /api/user/settings` (remove watched_seat_ids)
- [ ] Update `GET /api/alerts` filter
- [ ] Remove `extra_credit` from telegram/fcm formatters
- [ ] Update `telegram-service.sendUserReport()` to read `watched_seats[*].seat_id`
- [ ] Mount new router in `index.ts`
- [ ] Typecheck green
- [ ] Smoke test with seeded data

## Success Criteria

- Refactored service: each user receives alert once per (seat, type, window) per 24h.
- 2 users watching same seat with different thresholds → each gets alert at their own threshold.
- Users without matching threshold don't receive alerts.
- Token failure alerts still fire, respect `token_failure_enabled` per user.
- Feed returns user's personal alerts + seat-wide alerts for watched seats.

## Risks

- **Increased write volume**: N users watching M seats = N×M possible Alert records per 24h (instead of M). For current scale (~5 users × ~10 seats), negligible. Monitor.
- **Missing alerts during cutover**: Old alerts with `user_id=undefined` may not match new dedup. Migration (Phase 01) sets them to `null`, preventing false-positive dedup blocks.
- **Access check regression**: Reuse existing owner/assigned/admin logic, do NOT reimplement.

## Security

- All new endpoints require `authenticate`; enforce user can only modify their own `watched_seats`.
- Validate `seat_id` against user's accessible seats before adding.
- Clamp threshold values 1-100, coerce to integer.
