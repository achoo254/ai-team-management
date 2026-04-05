# Phase 1: Data Model Refactor

## Context
- [Brainstorm](../reports/brainstorm-260406-0003-auto-seat-activity-schedule.md)
- [plan.md](plan.md)

## Overview
- **Priority:** Critical (all other phases depend on this)
- **Status:** Complete
- Refactor Schedule model, create seat_activity_log, deprecate ActiveSession + SessionMetric

## Key Insights
- Schedule model (62 LOC) has migration from slot-based → hourly already
- ActiveSession/SessionMetric are server-internal only (no frontend types, no API routes)
- UsageWindow already tracks seat-level activity — activity_log adds hourly granularity

## Requirements

### Functional
- Remove `user_id` and `usage_budget_pct` from Schedule schema
- Add `source: 'auto' | 'legacy'` field to Schedule
- Create `seat_activity_log` model with hourly resolution
- Mark existing Schedule entries as `source: 'legacy'`
- Stop using ActiveSession + SessionMetric (don't delete yet — Phase 6)

### Non-functional
- Zero downtime migration (additive changes first)
- Existing data preserved with 'legacy' marker

## Architecture

### Schedule Model Changes (`packages/api/src/models/schedule.ts`)

```typescript
interface ISchedule {
  seat_id: ObjectId          // ref Seat
  day_of_week: number        // 0-6
  start_hour: number         // 0-23
  end_hour: number           // 0-23 (exclusive)
  source: 'auto' | 'legacy'  // NEW
  created_at: Date
  // REMOVED: user_id, usage_budget_pct
}
```

Keep existing indexes. Add migration hook: existing docs without `source` → default `'legacy'`.

### New: SeatActivityLog Model (`packages/api/src/models/seat-activity-log.ts`)

```typescript
interface ISeatActivityLog {
  seat_id: ObjectId
  date: Date                 // start of day (Asia/Ho_Chi_Minh)
  hour: number               // 0-23
  is_active: boolean         // true if any delta > 0
  delta_5h_pct: number       // accumulated five_hour_pct increase this hour
  snapshot_count: number     // how many snapshots showed activity
  created_at: Date
}

// Indexes:
// { seat_id: 1, date: -1, hour: 1 } unique — one record per seat/date/hour
// { seat_id: 1, date: -1 } — query all hours for a seat/date
// { date: -1 } — cleanup/aggregation queries
```

## Related Code Files

### Modify
- `packages/api/src/models/schedule.ts` — Remove user_id/usage_budget_pct, add source
- `packages/shared/types.ts` — Update Schedule interface, add SeatActivityLog type

### Create
- `packages/api/src/models/seat-activity-log.ts` — New model

### Audit (references to remove later)
- `packages/api/src/routes/schedules.ts` — Uses user_id heavily (Phase 4)
- `packages/web/src/hooks/use-schedules.ts` — ScheduleEntry has user_id (Phase 5)
- `packages/shared/schedule-permissions.ts` — canEditEntry/canDeleteEntry use user_id (Phase 4)

## Implementation Steps

1. Create `packages/api/src/models/seat-activity-log.ts`
   - Define ISeatActivityLog interface
   - Create Mongoose schema with indexes
   - Export model

2. Refactor `packages/api/src/models/schedule.ts`
   - Remove `user_id` field from ISchedule and schema
   - Remove `usage_budget_pct` field
   - Add `source` field: `{ type: String, enum: ['auto', 'legacy'], default: 'legacy' }`
   - Keep pre-validate hook (start_hour < end_hour)
   - Remove old slot migration code (already migrated)

3. Update `packages/shared/types.ts`
   - Update Schedule interface: remove user_id, usage_budget_pct; add source
   - Add SeatActivityLog interface
   - Add ActivityHeatmapData type for frontend consumption

4. Run `pnpm -F @repo/api build` to verify no compile errors

## Todo List

- [x] Create seat-activity-log.ts model
- [x] Refactor schedule.ts (remove user_id, usage_budget_pct, add source)
- [x] Update shared types.ts
- [x] Compile check passes

## Success Criteria
- `pnpm -F @repo/api build` passes (note: routes will break — expected, fixed in Phase 4)
- New model has correct indexes
- Existing schedule data preserved with source='legacy'

## Risk Assessment
- **Breaking routes:** Schedule routes use user_id extensively → compile errors expected until Phase 4
- **Mitigation:** Phase 1 + Phase 4 can be deployed together as atomic change

## Next Steps
→ Phase 2: Activity Detection Service (hooks into cron to populate seat_activity_log)
