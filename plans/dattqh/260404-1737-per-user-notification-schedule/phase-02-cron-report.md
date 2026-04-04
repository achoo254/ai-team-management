# Phase 2: Cron + Report Logic

## Overview
- **Priority:** Critical
- **Status:** Pending
- **Effort:** Medium

Replace fixed Friday cron with hourly check. Build per-user report filtered by seat ownership.

## Related Files
- `packages/api/src/index.ts` — modify (replace cron)
- `packages/api/src/services/telegram-service.ts` — modify (add per-user report)

## Implementation Steps

### 2.1 Add per-user report function

In `packages/api/src/services/telegram-service.ts`, add:

```typescript
/** Send usage report for a specific user, filtered by their seats */
export async function sendUserReport(userId: string, scope: 'own' | 'all') {
  // 1. Get user's telegram config
  const user = await User.findById(userId, 'telegram_bot_token telegram_chat_id name')
  if (!user?.telegram_bot_token || !user?.telegram_chat_id) return

  // 2. Get seats based on scope
  let seats
  if (scope === 'all') {
    seats = await Seat.find().sort({ team: 1 }).lean()
  } else {
    // 'own': seats where user is owner OR assigned
    const ownedSeats = await Seat.find({ owner_id: userId }).lean()
    const assignedUser = await User.findById(userId, 'seat_ids')
    const assignedSeats = assignedUser?.seat_ids?.length
      ? await Seat.find({ _id: { $in: assignedUser.seat_ids } }).lean()
      : []
    // Merge and deduplicate
    const seatMap = new Map()
    for (const s of [...ownedSeats, ...assignedSeats]) seatMap.set(String(s._id), s)
    seats = Array.from(seatMap.values()).sort((a, b) => a.team.localeCompare(b.team))
  }

  if (seats.length === 0) return

  // 3. Build report using existing logic (reuse from sendWeeklyReport)
  // 4. Send via personal bot
}
```

**Key**: Extract report-building logic from `sendWeeklyReport()` into a shared helper `buildUsageReportHtml(seats)` to avoid duplication.

### 2.2 Add scheduled report checker

New function in telegram-service.ts:

```typescript
/** Check all users with enabled schedules and send if matching current day/hour */
export async function checkAndSendScheduledReports() {
  const now = new Date()
  // Convert to Asia/Ho_Chi_Minh
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  const currentDay = vnNow.getDay()  // 0-6
  const currentHour = vnNow.getHours()  // 0-23

  const users = await User.find({
    'notification_settings.report_enabled': true,
    'notification_settings.report_days': currentDay,
    'notification_settings.report_hour': currentHour,
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  for (const user of users) {
    try {
      await sendUserReport(String(user._id), user.notification_settings?.report_scope ?? 'own')
      console.log(`[Scheduler] Sent report to ${user.name}`)
    } catch (err) {
      console.error(`[Scheduler] Failed for ${user.name}:`, err)
    }
  }
}
```

### 2.3 Replace cron in index.ts

Remove:
```typescript
cron.schedule('0 8 * * 5', () => { ... sendWeeklyReport() ... })
```

Add:
```typescript
// Cron: every hour — check per-user notification schedules
cron.schedule('0 * * * *', () => {
  console.log('[Cron] Checking scheduled reports...')
  checkAndSendScheduledReports().catch(console.error)
}, { timezone: 'Asia/Ho_Chi_Minh' })
```

### 2.4 Refactor sendWeeklyReport

Keep `sendWeeklyReport()` for admin manual send (Admin page), but refactor to share report-building logic with `sendUserReport()`.

Extract helper:
```typescript
function buildReportHtml(seats, snapMap, usersBySeat, teamLabels): string {
  // Move existing HTML building logic here
}
```

## Todo
- [ ] Extract `buildReportHtml()` helper from sendWeeklyReport
- [ ] Create `sendUserReport(userId, scope)` function
- [ ] Create `checkAndSendScheduledReports()` function
- [ ] Replace fixed cron with hourly schedule check
- [ ] Keep sendWeeklyReport for admin manual trigger
- [ ] Test with matching schedule

## Success Criteria
- User with enabled schedule receives report at configured day/hour
- Report shows only user's own seats (scope='own')
- Admin with scope='all' gets full report
- No double-sends within same hour
- sendWeeklyReport still works for admin manual trigger
