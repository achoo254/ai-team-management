# Phase 2: API & Service Refactor

## Overview
- **Priority:** critical
- **Status:** complete
- **Description:** Refactor alert-service + telegram-service to use per-user thresholds. Update user-settings API. Remove settings route + admin report endpoints.

## Key Insights
- `checkSnapshotAlerts()` currently: get global settings → check each seat against single threshold → `insertIfNew` → `sendAlertNotification` (system bot)
- New flow: for each seat with alert, find users subscribed → check per-user threshold → send via user's personal bot
- `sendAlertNotification` currently sends to system bot group chat → must send to each subscribed user's personal bot
- `sendWeeklyReport()` uses system bot → remove (users have personal scheduled reports already)
- `sendToUser()` sends to both system + personal bot → simplify to personal bot only
- `sendTokenRefreshAlert()` uses system bot → convert to per-user notifications

## Related Code Files

### Modify
- `packages/api/src/routes/user-settings.ts` — add alert_settings to GET/PUT, add available_seats endpoint
- `packages/api/src/services/alert-service.ts` — refactor checkSnapshotAlerts to per-user thresholds
- `packages/api/src/services/telegram-service.ts` — remove system bot functions, refactor to per-user sending
- `packages/api/src/routes/admin.ts` — remove send-report endpoint (system bot gone)
- `packages/api/src/index.ts` — remove settings route import/mount

### Delete
- `packages/api/src/routes/settings.ts` — entire file (system settings no longer exist)

## Implementation Steps

### Step 1: Update `user-settings.ts` route

**GET /api/user/settings** — add `alert_settings` + `available_seats` to response:
```typescript
// Fetch user with alert_settings
const user = await User.findById(req.user!._id, 
  'telegram_chat_id telegram_bot_token notification_settings alert_settings seat_ids')

// Available seats: admin → all seats, user → only their seats
let availableSeats
if (req.user!.role === 'admin') {
  availableSeats = await Seat.find({}, '_id label email team').lean()
} else {
  const ownedSeats = await Seat.find({ owner_id: req.user!._id }, '_id label email team').lean()
  const assignedSeats = user.seat_ids?.length
    ? await Seat.find({ _id: { $in: user.seat_ids } }, '_id label email team').lean()
    : []
  const seatMap = new Map()
  for (const s of [...ownedSeats, ...assignedSeats]) seatMap.set(String(s._id), s)
  availableSeats = Array.from(seatMap.values())
}

// Response adds:
res.json({
  ...existingFields,
  alert_settings: user.alert_settings ?? null,
  available_seats: availableSeats,
})
```

**PUT /api/user/settings** — handle `alert_settings` in body:
```typescript
if (alert_settings) {
  const as = alert_settings
  // Validate thresholds
  const rlp = Math.max(1, Math.min(100, Math.floor(Number(as.rate_limit_pct) || 80)))
  const ecp = Math.max(1, Math.min(100, Math.floor(Number(as.extra_credit_pct) || 80)))
  
  // Validate seat IDs — user can only subscribe to their available seats
  let validSeatIds = as.subscribed_seat_ids ?? []
  if (req.user!.role !== 'admin') {
    // Filter to only user's own seats
    const userSeatIds = new Set((user.seat_ids ?? []).map(String))
    const ownedSeats = await Seat.find({ owner_id: req.user!._id }, '_id').lean()
    for (const s of ownedSeats) userSeatIds.add(String(s._id))
    validSeatIds = validSeatIds.filter((id: string) => userSeatIds.has(id))
  }
  
  user.alert_settings = {
    enabled: !!as.enabled,
    rate_limit_pct: rlp,
    extra_credit_pct: ecp,
    subscribed_seat_ids: validSeatIds,
  }
}
```

### Step 2: Refactor `alert-service.ts`

Replace `getOrCreateSettings()` with per-user logic:

```typescript
// OLD: const settings = await getOrCreateSettings()
// NEW: Find all users with alert_settings.enabled who subscribe to this seat

import { User } from '../models/user.js'
import { sendAlertToUser } from './telegram-service.js'

// In checkSnapshotAlerts():
// After building seatMap, for each seat that triggers alert:
// 1. Find users subscribed to this seat with enabled alerts
// 2. Check per-user threshold
// 3. Send notification via user's personal bot

async function checkSeatAlertForUsers(
  seatId: string, seatLabel: string,
  windows: Array<{key: string, pct: number}>,
  extraUsage: any,
) {
  const users = await User.find({
    'alert_settings.enabled': true,
    'alert_settings.subscribed_seat_ids': seatId,
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  let created = 0
  for (const user of users) {
    const { rate_limit_pct, extra_credit_pct } = user.alert_settings!
    
    // Rate limit check with user's threshold
    const matchingWindows = windows.filter(w => w.pct >= rate_limit_pct)
    if (matchingWindows.length > 0) {
      const worst = matchingWindows.reduce((a, b) => a.pct > b.pct ? a : b)
      // insertIfNew per user+seat (new dedup key includes user_id)
      if (await insertIfNew(seatId, 'rate_limit', ...)) {
        await sendAlertToUser(String(user._id), type, seatLabel, metadata, threshold)
        created++
      }
    }

    // Extra credit check with user's threshold
    if (extraUsage?.is_enabled && extraUsage.utilization >= extra_credit_pct) {
      // similar pattern
    }
  }
  return created
}
```

**Important:** Alert dedup changes — since thresholds are per-user now, the `insertIfNew` logic stays seat+type based (one Alert document per seat+type). But notification sending becomes per-user. The Alert record is still global (per seat), but notifications go to subscribed users.

**Simplified approach:** Keep Alert model as-is (per seat). When a new alert is inserted, find all subscribed users and notify each via personal bot.

```typescript
// Modify insertIfNew to return the alert doc instead of just bool
// After successful insert, call notifySubscribedUsers(seatId, type, ...)

async function notifySubscribedUsers(
  seatId: string, type: AlertType, seatLabel: string,
  metadata: Record<string, unknown>, 
) {
  const users = await User.find({
    'alert_settings.enabled': true,
    'alert_settings.subscribed_seat_ids': seatId,
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  for (const user of users) {
    try {
      await sendAlertToUser(String(user._id), type, seatLabel, metadata)
    } catch (err) {
      console.error(`[Alert] Notify user ${user.name} failed:`, err)
    }
  }
}
```

**But thresholds are per-user** — so we need a different approach:
- Don't use global threshold for `insertIfNew` check
- Instead: for each seat, get all windows data, then for each subscribed user, check if any window exceeds their threshold
- Alert record: still per seat+type (keeps dedup). But threshold check is per-user.
- If user A has 60% threshold and user B has 90%, and usage is 70%: user A gets notified, B doesn't.
- Alert record: created when ANY user's threshold is exceeded (use lowest subscribed user threshold for the seat).

**Final approach (simplest):**
1. For each seat, collect all usage windows
2. Find all users subscribed to this seat with alerts enabled
3. For each user, check their personal thresholds
4. If threshold exceeded → create Alert record (dedup per seat+type) → send notification to that user only
5. Alert creation uses `insertIfNew` (unchanged). Notification is per-user.

### Step 3: Refactor `telegram-service.ts`

Remove:
- `getTelegramConfig()` — no more system bot
- `sendWeeklyReport()` — no more system bot manual report
- `sendMessage()` (system bot wrapper)
- `sendTokenRefreshAlert()` — convert to per-user

Keep:
- `sendMessageWithBot()` — used for personal bot sends
- `sendUserReport()` — already per-user
- `checkAndSendScheduledReports()` — already per-user
- `buildReportHtml()`, `fetchReportData()`, etc. — report building utils

Add:
- `sendAlertToUser(userId, type, seatLabel, metadata)` — send alert to specific user via their personal bot

Modify:
- `sendToUser()` — remove system bot part, only send via personal bot
- `sendAlertNotification()` → rename to `sendAlertToUser()` or refactor to accept userId

### Step 4: Update `admin.ts` route

Remove:
- `POST /api/admin/send-report` — no system bot
- `sendWeeklyReport` import

Keep:
- `POST /api/admin/check-alerts` — still useful for manual trigger
- All user CRUD routes

### Step 5: Update `index.ts`

Remove:
- `import settingsRoutes from './routes/settings.js'`
- `app.use('/api/settings', settingsRoutes)`

### Step 6: Delete `settings.ts` route

Remove entire file.

## Todo
- [x] Update GET /api/user/settings — add alert_settings + available_seats
- [x] Update PUT /api/user/settings — handle alert_settings with validation
- [x] Refactor alert-service — per-user threshold check + per-user notification
- [x] Refactor telegram-service — remove system bot, add sendAlertToUser
- [x] Update admin route — remove send-report endpoint
- [x] Remove settings route from index.ts
- [x] Delete settings.ts route file
- [x] Run `pnpm build` to verify no compile errors

## Success Criteria
- Alert checks use per-user thresholds from subscribed users
- Notifications sent via personal bot only (no system bot)
- User settings API returns alert_settings + available_seats
- No references to Setting model remain
- Build passes

## Risk
- Performance: for each seat, querying subscribed users adds DB calls. Mitigate: batch query all subscribed users at start of checkSnapshotAlerts
- Users without personal bot → no notification (by design)
