# Phase 2: Telegram Report Rewrite

## Priority: High | Status: completed

## Overview
Rewrite `sendWeeklyReport()` to show latest UsageSnapshot per seat instead of UsageLog data. Remove log reminder cron.

## Files to Modify
- `packages/api/src/services/telegram-service.ts` — Rewrite sendWeeklyReport, delete sendLogReminder
- `packages/api/src/index.ts` — Remove log reminder cron (Thu 16:30), remove UsageLog-related imports

## Implementation Steps

### 1. Rewrite `sendWeeklyReport()` in telegram-service.ts

Replace UsageLog queries with latest snapshot per seat:

```ts
export async function sendWeeklyReport() {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    throw new Error('Telegram chưa được cấu hình')
  }

  const seats = await Seat.find().sort({ team: 1 }).lean()
  const users = await User.find({ active: true }, 'name seat_ids').lean()
  const teamRows = await Team.find({}, 'name label').sort({ name: 1 }).lean()

  // Latest snapshot per seat (last 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const snapshots = await UsageSnapshot.aggregate([
    { $match: { fetched_at: { $gte: twoHoursAgo } } },
    { $sort: { fetched_at: -1 } },
    { $group: {
      _id: '$seat_id',
      five_hour_pct: { $first: '$five_hour_pct' },
      seven_day_pct: { $first: '$seven_day_pct' },
      extra_usage: { $first: '$extra_usage' },
    }},
  ])
  const snapMap = new Map(snapshots.map(s => [String(s._id), s]))

  // Build message per team
  let msg = `📊 <b>Báo cáo Usage — ${new Date().toLocaleDateString('vi-VN')}</b>\n\n`

  // ... group by team, show per seat:
  // 5h:  ▓▓▓▓▓▓▓▓░░ 85%
  // 7d:  ▓▓▓▓▓░░░░░ 50%
  // Extra: $45/$100 (45%)  ← only if enabled
}
```

**Message format per seat:**
```
🔴 <b>Seat Label</b> <code>email</code>
   5h:  ▓▓▓▓▓▓▓▓░░ 85%
   7d:  ▓▓▓▓▓░░░░░ 50%
   👥 User1, User2
```

Color indicator based on highest of 5h/7d pct: 🔴 ≥80%, 🟡 ≥50%, 🟢 <50%.
Show extra credits line only if `extra_usage.is_enabled`.

**Summary section:**
```
📋 Tổng kết: N seats
🟢 Bình thường: X | 🟡 Trung bình: Y | 🔴 Cao: Z
```

### 2. Delete `sendLogReminder()` function

Remove entirely — no more manual log reminders needed.

### 3. Update imports in telegram-service.ts

- Remove: `UsageLog` import, `getCurrentWeekStart` import
- Add: `UsageSnapshot` import
- Remove: `fmtDate`, `fmtWeekRange` helpers (no longer needed for weekly date formatting)
- Keep: `esc`, `buildInlineKeyboard`, `buildProgressBar`, `sendMessage`

### 4. Update `index.ts`

- Remove log reminder cron (Thu 16:30)
- Remove `sendLogReminder` import
- Keep: `sendWeeklyReport` import (still used by Fri 08:00 cron)
- Remove any remaining `UsageLog` imports if present

## Review Feedback Applied
- **H1 fix**: Removed 2-hour time window constraint on snapshot queries to fetch latest available data regardless of timestamp
- **M1/M2 fix**: Null `seven_day_pct` values filtered from calculations to prevent distortion in team averages
- **L1/L2 fix**: UsagePage naming consistency applied

## Todo
- [x] Rewrite sendWeeklyReport() to use UsageSnapshot
- [x] Delete sendLogReminder() function
- [x] Update telegram-service.ts imports (remove UsageLog, add UsageSnapshot)
- [x] Remove log reminder cron from index.ts
- [x] Remove sendLogReminder import from index.ts
- [x] Run `pnpm build` to verify

## Success Criteria
- Weekly report shows 5h%, 7d%, extra credits per seat
- No UsageLog references in telegram-service.ts
- Log reminder cron removed
- `pnpm build` passes
