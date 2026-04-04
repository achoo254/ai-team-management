---
phase: 2
title: Usage Budget Alert + Block
status: done
priority: high
effort: medium
depends_on: phase-01
---

# Phase 2: Usage Budget Alert + Block

## Context Links
- [Plan Overview](plan.md)
- [Phase 1: Hourly Schedule](phase-01-hourly-schedule-redesign.md)
- [Brainstorm Report](../reports/brainstorm-260404-1237-schedule-usage-bot-redesign.md)
- Existing alert service: `packages/api/src/services/alert-service.ts`
- Existing usage snapshot: `packages/api/src/models/usage-snapshot.ts`

## Overview
Track per-user usage delta during scheduled sessions. When a user exceeds their `usage_budget_pct`, alert via Telegram + block seat UI. Auto-unblock when next scheduled user's slot starts.

## Key Insights
- `checkSnapshotAlerts()` already runs every 5 min via cron — extend, don't duplicate
- UsageSnapshot stores `five_hour_pct`, `seven_day_pct`, `seven_day_sonnet_pct`, `seven_day_opus_pct` per seat
- Delta = current snapshot pct - snapshot pct at session start → measures user's consumption
- 5h rolling window: delta can go negative when old usage drops off → treat `delta < 0` as 0
- Alert triggers on ANY window worst-case (all 4 windows checked, alert on highest delta)
- Existing `insertIfNew()` atomic pattern prevents duplicate alerts — reuse for `usage_exceeded`

## Requirements

### Functional
- When a scheduled session starts (current time matches `start_hour`), record baseline snapshot
- Every 5 min: compare current snapshot vs baseline → calculate delta per window
- If delta >= user's `usage_budget_pct` on any window → create `usage_exceeded` alert
- On alert: send Telegram to current user ("stop") + next scheduled user ("seat coming to you")
- Block seat in UI for the over-budget user
- Auto-unblock when next user's scheduled slot starts
- Auto-resolve `usage_exceeded` alert when session ends or next user takes over

### Non-Functional
- Alert detection within 10 min of exceeding budget (5 min poll + processing)
- No additional API calls to Anthropic — only read existing UsageSnapshot data

## Architecture

### Data Flow
```
Cron 5min (existing):
  1. collectUsage() → saves UsageSnapshot (already exists)
  2. checkSnapshotAlerts() → rate_limit, extra_credit, token_failure (already exists)
  3. NEW: checkBudgetAlerts() →
     a. Find active sessions: Schedule where day_of_week=today, start_hour <= now < end_hour
     b. For each active session:
        - Get/create ActiveSession record (stores baseline snapshot)
        - Get latest UsageSnapshot for seat
        - delta = current_pct - baseline_pct (per window)
        - worst_delta = max across windows
        - If worst_delta >= usage_budget_pct → insertIfNew('usage_exceeded')
     c. Session transition check:
        - Find sessions where start_hour = current_hour (just started)
        - Auto-resolve old usage_exceeded alerts for that seat
        - Create new ActiveSession baseline
```

### Block/Unblock Flow
```
Block trigger:
  checkBudgetAlerts() detects delta >= budget
    → Alert.create(type: 'usage_exceeded', metadata: { delta, budget, window, user_id })
    → Telegram to current user + next user
    → Frontend: useAlerts() query shows unresolved usage_exceeded → UI renders "OVER BUDGET" badge

Unblock trigger:
  checkBudgetAlerts() detects new session start (start_hour = now hour)
    → Alert.updateMany({ seat_id, type: 'usage_exceeded', resolved: false }, { resolved: true })
    → Delete old ActiveSession, create new baseline
    → Frontend: alert resolved → badge disappears
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `packages/api/src/services/alert-service.ts` | Add `checkBudgetAlerts()`, import Schedule + ActiveSession |
| `packages/api/src/services/telegram-service.ts` | Add `usage_exceeded` case in `sendAlertNotification()` |
| `packages/shared/types.ts` | Add `'usage_exceeded'` to `AlertType`, extend `AlertMetadata` |
| `packages/api/src/index.ts` | Call `checkBudgetAlerts()` in existing 5min cron |
| `packages/web/src/pages/dashboard.tsx` | Show "OVER BUDGET" badge on seats with unresolved `usage_exceeded` |

### Create
| File | Purpose |
|------|---------|
| `packages/api/src/models/active-session.ts` | Lightweight model: seat_id, user_id, schedule_id, baseline snapshot |

## Implementation Steps

### Step 1: ActiveSession Model (packages/api/src/models/active-session.ts)
```typescript
export interface IActiveSession extends Document {
  seat_id: Types.ObjectId
  user_id: Types.ObjectId
  schedule_id: Types.ObjectId
  started_at: Date
  snapshot_at_start: {
    five_hour_pct: number | null
    seven_day_pct: number | null
    seven_day_sonnet_pct: number | null
    seven_day_opus_pct: number | null
  }
}
// Index: { seat_id: 1 } — one active session per seat at a time
```
Transient data — delete when session ends. No TTL needed, managed by code.

### Step 2: Shared Types Update
Add to `AlertType`:
```typescript
export type AlertType = 'rate_limit' | 'extra_credit' | 'token_failure' | 'usage_exceeded'
```
Extend `AlertMetadata`:
```typescript
export interface AlertMetadata {
  // existing fields...
  delta?: number          // actual usage delta
  budget?: number         // allocated budget pct
  user_id?: string        // user who exceeded
  user_name?: string      // for display
}
```

### Step 3: Budget Alert Logic (packages/api/src/services/alert-service.ts)
Add `checkBudgetAlerts()`:
```typescript
export async function checkBudgetAlerts() {
  const now = new Date()
  const currentHour = now.getHours()
  const dayOfWeek = now.getDay()

  // 1. Find schedules active right now
  const activeSchedules = await Schedule.find({
    day_of_week: dayOfWeek,
    start_hour: { $lte: currentHour },
    end_hour: { $gt: currentHour },
    usage_budget_pct: { $ne: null },  // only check if budget is set
  }).populate('user_id', 'name')

  for (const schedule of activeSchedules) {
    const seatId = String(schedule.seat_id)
    const userId = String(schedule.user_id)

    // 2. Get or create active session with baseline
    let session = await ActiveSession.findOne({ seat_id: seatId, schedule_id: schedule._id })
    if (!session) {
      // New session — record baseline from latest snapshot
      const latestSnap = await UsageSnapshot.findOne({ seat_id: seatId }).sort({ fetched_at: -1 })
      if (!latestSnap) continue
      session = await ActiveSession.create({
        seat_id: seatId, user_id: userId, schedule_id: schedule._id,
        started_at: now,
        snapshot_at_start: {
          five_hour_pct: latestSnap.five_hour_pct,
          seven_day_pct: latestSnap.seven_day_pct,
          seven_day_sonnet_pct: latestSnap.seven_day_sonnet_pct,
          seven_day_opus_pct: latestSnap.seven_day_opus_pct,
        },
      })
    }

    // 3. Calculate delta
    const currentSnap = await UsageSnapshot.findOne({ seat_id: seatId }).sort({ fetched_at: -1 })
    if (!currentSnap) continue

    const deltas = [
      { key: '5h', delta: (currentSnap.five_hour_pct ?? 0) - (session.snapshot_at_start.five_hour_pct ?? 0) },
      { key: '7d', delta: (currentSnap.seven_day_pct ?? 0) - (session.snapshot_at_start.seven_day_pct ?? 0) },
      { key: '7d_sonnet', delta: (currentSnap.seven_day_sonnet_pct ?? 0) - (session.snapshot_at_start.seven_day_sonnet_pct ?? 0) },
      { key: '7d_opus', delta: (currentSnap.seven_day_opus_pct ?? 0) - (session.snapshot_at_start.seven_day_opus_pct ?? 0) },
    ].map(d => ({ ...d, delta: Math.max(0, d.delta) })) // treat negative delta as 0

    const worst = deltas.reduce((a, b) => a.delta > b.delta ? a : b)

    // 4. Alert if over budget
    if (worst.delta >= schedule.usage_budget_pct!) {
      const seat = await Seat.findById(seatId, 'label email')
      const label = seat?.label || seat?.email || seatId
      const userName = (schedule.user_id as any).name || ''

      await insertIfNew(seatId, 'usage_exceeded',
        `${userName} vượt budget: ${worst.delta.toFixed(1)}% / ${schedule.usage_budget_pct}% (${worst.key})`,
        { delta: worst.delta, budget: schedule.usage_budget_pct, window: worst.key, user_id: userId, user_name: userName },
        label, schedule.usage_budget_pct,
      )

      // Notify next user
      await notifyNextUser(seatId, dayOfWeek, currentHour, label)
    }
  }

  // 5. Session cleanup — resolve expired sessions
  await cleanupExpiredSessions(dayOfWeek, currentHour)
}
```

### Step 4: Next User Notification
```typescript
async function notifyNextUser(seatId: string, dayOfWeek: number, currentHour: number, seatLabel: string) {
  const nextSchedule = await Schedule.findOne({
    seat_id: seatId, day_of_week: dayOfWeek,
    start_hour: { $gt: currentHour },
  }).sort({ start_hour: 1 }).populate('user_id', 'name')

  if (nextSchedule) {
    const userName = (nextSchedule.user_id as any).name
    // Telegram: "Your turn is coming, previous user exceeded budget"
    // (uses per-user bot in Phase 3, system bot for now)
  }
}
```

### Step 5: Session Cleanup + Auto-Unblock
```typescript
async function cleanupExpiredSessions(dayOfWeek: number, currentHour: number) {
  // Find active sessions whose schedule has ended
  const expiredSessions = await ActiveSession.find({}).populate('schedule_id')
  for (const session of expiredSessions) {
    const sched = session.schedule_id as any
    if (!sched || sched.day_of_week !== dayOfWeek || sched.end_hour <= currentHour) {
      // Session over — resolve alerts + delete session
      await Alert.updateMany(
        { seat_id: session.seat_id, type: 'usage_exceeded', resolved: false },
        { $set: { resolved: true, resolved_at: new Date() } },
      )
      await session.deleteOne()
    }
  }
}
```

### Step 6: Telegram Notification (packages/api/src/services/telegram-service.ts)
Add `usage_exceeded` case in `sendAlertNotification()`:
```typescript
case 'usage_exceeded':
  msg = `🚫 <b>Usage Budget Exceeded</b>\n`
    + `Seat: <b>${esc(seatLabel)}</b>\n`
    + `User: ${esc(String(metadata.user_name ?? ''))}\n`
    + `Usage: ${esc(String(metadata.delta ?? ''))}% / Budget: ${esc(String(metadata.budget ?? ''))}%\n`
    + `Window: ${esc(String(metadata.window ?? ''))}\n`
    + `→ Vui lòng dừng sử dụng ngay`
  break
```

### Step 7: Cron Integration (packages/api/src/index.ts)
Add `checkBudgetAlerts()` call after existing `checkSnapshotAlerts()` in the 5min cron:
```typescript
cron.schedule('*/5 * * * *', async () => {
  // existing: collectUsage, checkSnapshotAlerts
  await checkBudgetAlerts().catch(console.error)
})
```

### Step 8: Dashboard UI — Block Indicator
In dashboard page/components, query unresolved alerts:
- If seat has unresolved `usage_exceeded` alert → show "OVER BUDGET" badge
- Badge shows user name + delta %
- Disable seat actions for blocked user (visual only — not hard block)

## Todo List
- [x] Create ActiveSession mongoose model
- [x] Update shared types (AlertType, AlertMetadata)
- [x] Implement `checkBudgetAlerts()` in alert-service
- [x] Implement `notifyNextUser()` helper
- [x] Implement `cleanupExpiredSessions()` helper
- [x] Add `usage_exceeded` case in telegram-service
- [x] Wire `checkBudgetAlerts()` into 5min cron
- [x] Add "OVER BUDGET" badge to dashboard UI
- [x] Compile check (pnpm build)
- [x] Test: simulate budget exceed scenario

## Success Criteria
- Active session baseline recorded when schedule slot begins
- Delta calculated correctly across all 4 windows
- Alert created when delta >= budget (no duplicates)
- Telegram sent to current user + next user
- Alert auto-resolved when session ends
- Dashboard shows block badge for over-budget seats
- `pnpm build` passes

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| 5h rolling window delta goes negative | `Math.max(0, delta)` — treat as zero usage |
| No snapshot at session start | Skip budget check if no snapshot available |
| Multiple schedules overlap on same seat | Each gets its own ActiveSession; independent tracking |
| Cron timing misses session start by minutes | Acceptable: baseline created on first check, max 5 min delay |

## Security Considerations
- `usage_exceeded` alert visible to all authenticated users (same as other alerts)
- Block badge is informational (soft block) — no hard API enforcement
- Only admin can manually resolve alerts

## Next Steps
→ Phase 3: Per-user Bot Config (independent, can run parallel)
