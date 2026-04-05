# Phase 4: API Refactor

## Context
- [Phase 1](phase-01-data-model-refactor.md) — model changes
- [plan.md](plan.md)

## Overview
- **Priority:** High
- **Status:** Complete
- Refactor schedule routes from CRUD to read-only. Add activity log + heatmap endpoints.

## Key Insights
- Current schedules.ts (342 LOC) has 7 endpoints — most become unnecessary
- Permission model simplifies dramatically (no member-level edit/delete)
- Frontend needs: heatmap data (aggregated activity), predicted patterns, realtime status

## Requirements

### Functional
- Remove: POST/PUT/PATCH/DELETE schedule endpoints
- Keep: GET schedules (read-only, returns auto-generated patterns)
- Add: GET activity heatmap data (aggregated by day_of_week + hour)
- Add: GET activity logs (raw, with date range filter)
- Add: GET realtime seat status (currently active or not)

### Non-functional
- Non-admin users scoped to their allowed seats (existing pattern)
- Efficient aggregation queries for heatmap data

## Architecture

### New Endpoints

```
GET /api/schedules                    — Read auto-generated recurring patterns (existing, simplified)
GET /api/schedules/heatmap/:seatId    — Aggregated activity data for heatmap
  Query: ?weeks=4 (lookback period)
  Response: { data: [{ day_of_week, hour, activity_rate, avg_delta }] }

GET /api/activity-logs                — Raw activity logs
  Query: ?seatId=&from=&to=&limit=&offset=
  Response: { logs: ISeatActivityLog[], total: number }

GET /api/activity-logs/realtime       — Current hour activity status per seat
  Response: { seats: [{ seat_id, is_active, current_delta, last_snapshot_at }] }
```

### Heatmap Aggregation Pipeline

```javascript
// For a given seat, last N weeks:
SeatActivityLog.aggregate([
  { $match: { seat_id, date: { $gte: nWeeksAgo } } },
  { $group: {
    _id: { day: { $dayOfWeek: '$date' }, hour: '$hour' },
    total_active: { $sum: { $cond: ['$is_active', 1, 0] } },
    total_weeks: { $sum: 1 },
    avg_delta: { $avg: '$delta_5h_pct' },
    max_delta: { $max: '$delta_5h_pct' }
  }},
  { $project: {
    day_of_week: '$_id.day', hour: '$_id.hour',
    activity_rate: { $divide: ['$total_active', '$total_weeks'] },
    avg_delta: 1, max_delta: 1
  }},
  { $sort: { day_of_week: 1, hour: 1 } }
])
```

### Permission Simplification

```typescript
// Old: 8 granular permissions (canCreate, canEditEntry, canSwap, etc.)
// New: 2 permissions
interface SchedulePermissions {
  canView: boolean    // member or admin
  canManage: boolean  // admin only (force regenerate patterns, etc.)
}
```

## Related Code Files

### Modify
- `packages/api/src/routes/schedules.ts` — Major refactor: remove CRUD, add heatmap/activity endpoints
- `packages/shared/schedule-permissions.ts` — Simplify to canView + canManage
- `packages/shared/types.ts` — Add HeatmapCell, ActivityLog DTOs; simplify SchedulePermissions

### Create
- `packages/api/src/routes/activity-logs.ts` — New route file (or merge into schedules.ts if <200 LOC total)

### Read (context)
- `packages/api/src/middleware.ts` — Existing auth middleware patterns

## Implementation Steps

1. Simplify `packages/shared/schedule-permissions.ts`
   - Replace full permission matrix with `{ canView, canManage }`
   - canView = isMember || isOwner || isAdmin
   - canManage = isAdmin

2. Update `packages/shared/types.ts`
   - Add `HeatmapCell: { day_of_week, hour, activity_rate, avg_delta, max_delta }`
   - Add `SeatActivityLog` DTO
   - Add `RealtimeStatus: { seat_id, is_active, current_delta, last_snapshot_at }`
   - Simplify SchedulePermissions

3. Refactor `packages/api/src/routes/schedules.ts`
   - Remove: POST /entry, PUT /entry/:id, PATCH /swap, DELETE /entry/:id, DELETE /all
   - Simplify: GET /schedules (read-only auto patterns)
   - Add: GET /schedules/heatmap/:seatId
   - Add: GET /schedules/today (keep, simplified — returns today's predicted pattern)

4. Create activity-logs routes (in schedules.ts or new file)
   - GET /api/activity-logs
   - GET /api/activity-logs/realtime

5. Run `pnpm -F @repo/api build`

## Todo List

- [x] Simplify schedule-permissions.ts
- [x] Update shared types.ts
- [x] Refactor schedules.ts routes
- [x] Add activity-logs endpoints
- [x] Compile check passes

## Success Criteria
- No CRUD endpoints for schedules
- Heatmap endpoint returns aggregated data correctly
- Realtime endpoint shows current seat status
- Permission model simplified
- `pnpm -F @repo/api build` passes

## Risk Assessment
- **Large refactor:** schedules.ts goes from 342 → ~150 LOC. Test thoroughly.
- **Breaking frontend:** Schedule page will break until Phase 5. Deploy Phase 4+5 together.

## Next Steps
→ Phase 5: Frontend Heatmap
