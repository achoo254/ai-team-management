# Phase 2: Activity Detection Service

## Context
- [Phase 1](phase-01-data-model-refactor.md) — models must exist first
- [plan.md](plan.md)

## Overview
- **Priority:** Critical
- **Status:** Complete
- Add activity detection logic to usage-collector cron, populate seat_activity_log

## Key Insights
- `usage-collector-service.ts` (167 LOC) already runs every 5 min
- `fetchSeatUsage()` creates UsageSnapshot and calls `applyWindowForSeat()` as side-effect
- Activity detection = compare current vs previous snapshot's `five_hour_pct`
- Hook point: after snapshot creation (line ~76), before/alongside window applier

## Requirements

### Functional
- After each snapshot collection, detect if seat was active (delta > 0)
- Upsert `seat_activity_log` record for current hour
- Accumulate delta_5h_pct and snapshot_count across multiple 5-min snapshots in same hour

### Non-functional
- Non-blocking (failure shouldn't break snapshot collection)
- Idempotent (safe to re-run)
- Timezone: Asia/Ho_Chi_Minh for date/hour calculation

## Architecture

### Detection Logic (pure function)

```typescript
// Input: currentSnapshot, previousSnapshot
// Output: { isActive: boolean, delta: number }

function detectActivity(current: IUsageSnapshot, previous: IUsageSnapshot | null) {
  if (!previous) return { isActive: false, delta: 0 }
  const currentPct = current.five_hour_pct ?? 0
  const prevPct = previous.five_hour_pct ?? 0
  const delta = currentPct - prevPct
  // Active if five_hour_pct increased (delta > 0)
  // Handle reset: if delta < 0, quota reset happened — check if currentPct > 0
  if (delta > 0) return { isActive: true, delta }
  if (delta < 0 && currentPct > 0) return { isActive: true, delta: currentPct }
  return { isActive: false, delta: 0 }
}
```

### Upsert Logic

```typescript
// After detecting activity:
if (isActive) {
  const vnNow = toZonedTime(new Date(), 'Asia/Ho_Chi_Minh')
  const date = startOfDay(vnNow)  // midnight VN time
  const hour = vnNow.getHours()

  await SeatActivityLog.findOneAndUpdate(
    { seat_id, date, hour },
    {
      $set: { is_active: true },
      $inc: { delta_5h_pct: delta, snapshot_count: 1 },
      $setOnInsert: { created_at: new Date() }
    },
    { upsert: true }
  )
}
```

## Related Code Files

### Modify
- `packages/api/src/services/usage-collector-service.ts` — Add activity detection after snapshot creation

### Create
- `packages/api/src/services/seat-activity-detector.ts` — Pure detection logic + upsert function

### Read (context)
- `packages/api/src/models/seat-activity-log.ts` — Model from Phase 1
- `packages/api/src/services/usage-window-applier.ts` — Pattern for non-fatal side-effects

## Implementation Steps

1. Create `packages/api/src/services/seat-activity-detector.ts`
   - `detectActivity(current, previous)` — pure function, no DB
   - `recordSeatActivity(seatId, current, previous)` — calls detect + upserts to DB
   - Use `date-fns-tz` for Asia/Ho_Chi_Minh timezone (already used in codebase)

2. Modify `packages/api/src/services/usage-collector-service.ts`
   - In `fetchSeatUsage()`, after creating UsageSnapshot (line ~69):
     - Fetch previous snapshot (already done for window applier, reuse)
     - Call `recordSeatActivity(seat._id, newSnapshot, prevSnapshot)`
     - Wrap in try/catch (non-fatal, like window applier)

3. Run `pnpm -F @repo/api build` to verify

## Todo List

- [x] Create seat-activity-detector.ts (pure detection + DB upsert)
- [x] Hook into usage-collector-service.ts after snapshot creation
- [x] Compile check passes
- [x] Manual test: trigger collect → verify seat_activity_log populated

## Success Criteria
- After 5-min cron runs, active seats have seat_activity_log records
- Inactive seats have no records for that hour
- Multiple snapshots in same hour accumulate correctly
- Failure in activity detection doesn't break snapshot collection

## Risk Assessment
- **Timezone edge cases:** midnight VN time boundary → test with 23:55 → 00:05 snapshots
- **Reset detection:** five_hour_pct drops when quota resets → handle negative delta correctly

## Next Steps
→ Phase 3: Pattern Generator (aggregate logs into weekly recurring patterns)
