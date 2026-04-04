---
phase: 1
title: Hourly Schedule Redesign
status: done
priority: high
effort: large
---

# Phase 1: Hourly Schedule Redesign

## Context Links
- [Plan Overview](plan.md)
- [Brainstorm Report](../reports/brainstorm-260404-1237-schedule-usage-bot-redesign.md)

## Overview
Replace fixed morning/afternoon slots with flexible hourly scheduling. Users self-arrange their time blocks with usage budget allocation per session.

## Key Insights
- Current schema: unique compound index `(seat_id, day_of_week, slot)` — must drop and replace
- Schedule grid currently hardcoded 10 columns (T2-T6 × morning/afternoon)
- Drag-and-drop via `@dnd-kit/core` already in place — adapt, not rewrite
- Budget assignment supports 3 modes: user self-set, admin override, auto-divide fallback

## Requirements

### Functional
- User can create schedule entry with specific `start_hour` and `end_hour` (0-23)
- User can set `usage_budget_pct` (1-100) per entry
- Admin can override any user's budget
- Auto-divide: when budget not set, calculate `100% / count(users same seat+day)` as default
- Overlap detection: warn when time ranges overlap on same seat+day but allow creation
- Total budget indicator per seat per day (show X/100% allocated)
- Migration: convert existing `morning` → `{start_hour: 8, end_hour: 12}`, `afternoon` → `{start_hour: 13, end_hour: 17}`, budget defaults to 50%

### Non-Functional
- Schedule page load < 1s
- Drag-and-drop responsive on mobile

## Architecture

### Data Flow
```
User creates/edits schedule
  → POST /api/schedules/entry (new) or PUT /api/schedules/entry/:id
  → Validate: start_hour < end_hour, 0-23 range, budget 1-100
  → Overlap check: query same seat+day, detect time collision
  → If overlap: return { warning: 'overlap', conflicting: [...] } but still create
  → Return created/updated entry

UI renders weekly time grid
  → GET /api/schedules → returns all entries with start_hour/end_hour/budget
  → Grid: rows = hours (configurable range, default 7-20), columns = days (Mon-Fri)
  → Per seat tab/section with time blocks
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `packages/api/src/models/schedule.ts` | Replace `slot` with `start_hour`, `end_hour`, `usage_budget_pct`; drop old index |
| `packages/api/src/routes/schedules.ts` | Rewrite all endpoints for hourly model; add overlap detection |
| `packages/shared/types.ts` | Update `Schedule` type, `SchedulePopulated` |
| `packages/web/src/hooks/use-schedules.ts` | Update `ScheduleEntry` interface; adapt mutations to new API shape |
| `packages/web/src/pages/schedule.tsx` | Replace grid+sidebar layout with hourly time grid; adapt DnD |
| `packages/web/src/components/schedule-grid.tsx` | Complete rewrite → hourly time grid (rows=hours, cols=days) |
| `packages/web/src/components/schedule-cell.tsx` | Adapt to time blocks instead of fixed cells |

### Delete (replaced by new components)
- None — rewrite existing files in-place

## Implementation Steps

### Step 1: Shared Types (packages/shared/types.ts)
Update `Schedule` interface:
```typescript
export interface Schedule {
  _id: string
  seat_id: string
  user_id: string
  day_of_week: number        // 0-6
  start_hour: number         // 0-23
  end_hour: number           // 0-23 (exclusive)
  usage_budget_pct?: number  // 1-100, optional (auto-divide if null)
  created_at: string
}
```
Update `AlertType` to include `'usage_exceeded'` (needed by Phase 2 but type should be added now).

### Step 2: Schedule Model (packages/api/src/models/schedule.ts)
```typescript
// Replace slot field with:
start_hour: { type: Number, required: true, min: 0, max: 23 },
end_hour: { type: Number, required: true, min: 0, max: 23 },
usage_budget_pct: { type: Number, min: 1, max: 100, default: null },

// Replace old index:
// OLD: scheduleSchema.index({ seat_id: 1, day_of_week: 1, slot: 1 }, { unique: true })
// NEW: (no unique index — overlap allowed with warning)
scheduleSchema.index({ seat_id: 1, day_of_week: 1 })

// Add validation
scheduleSchema.pre('validate', function() {
  if (this.start_hour >= this.end_hour) {
    throw new Error('start_hour must be less than end_hour')
  }
})
```
Add migration logic to drop old `slot` index on startup (like UsageSnapshot TTL drop pattern).

### Step 3: Schedule Routes (packages/api/src/routes/schedules.ts)
Rewrite endpoints:

**GET /api/schedules** — return entries with `start_hour`, `end_hour`, `usage_budget_pct`
- Same query logic, update flatten mapping

**GET /api/schedules/today** — filter by `day_of_week`, return hourly entries

**POST /api/schedules/entry** — create new entry (replaces assign)
- Body: `{ seatId, userId, dayOfWeek, startHour, endHour, usageBudgetPct? }`
- Validate user belongs to seat
- Overlap detection: query `seat_id + day_of_week`, check `startHour < existing.end_hour && endHour > existing.start_hour`
- Return `{ entry, warnings?: [{ type: 'overlap', conflicting: ScheduleEntry[] }] }`

**PUT /api/schedules/entry/:id** — update existing entry
- Allow changing hours and budget
- Same overlap check

**PATCH /api/schedules/swap** — adapt for hourly model
- From/to now identified by entry `_id` instead of `(seat, day, slot)` triplet

**DELETE /api/schedules/entry/:id** — delete by ID (simpler than body-based)

**DELETE /api/schedules/all** — keep as-is

**Remove:** PUT /:seatId bulk replace (no longer needed), POST /assign (replaced by POST /entry)

### Step 4: Frontend Hook (packages/web/src/hooks/use-schedules.ts)
Update `ScheduleEntry`:
```typescript
export interface ScheduleEntry {
  _id: string
  seat_id: string
  user_id: string
  day_of_week: number
  start_hour: number
  end_hour: number
  usage_budget_pct: number | null
  user_name: string
  seat_label: string
}
```
Update mutations:
- `useCreateScheduleEntry()` — POST /api/schedules/entry
- `useUpdateScheduleEntry()` — PUT /api/schedules/entry/:id
- `useDeleteEntry()` — DELETE /api/schedules/entry/:id
- `useSwapSchedule()` — adapt payload
- Remove `useAssignSchedule()` (replaced by create)

### Step 5: Schedule Grid Component (packages/web/src/components/schedule-grid.tsx)
Complete rewrite to hourly time grid:
- Props: `schedules`, `seats`, `activeSeatId`, `isAdmin`, `onDelete`, `onCreate`
- Layout: rows = hour slots (7:00-20:00 default), columns = days (Mon-Fri)
- Time blocks rendered as positioned cards spanning their duration
- Overlap blocks highlighted in orange/red
- Click empty slot → open create dialog (hour range + budget)
- Budget total indicator per day header

### Step 6: Schedule Cell → Time Block (packages/web/src/components/schedule-cell.tsx)
Adapt to render time blocks:
- Display: user name, time range, budget %
- Draggable for admin (move to different time/day)
- Delete button on hover
- Color coding by user/team

### Step 7: Schedule Page (packages/web/src/pages/schedule.tsx)
- Add seat selector tabs (instead of all seats in one grid)
- Replace DnD handlers for new entry shape
- Add create entry dialog/form: pick day, start/end hour (dropdowns or slider), budget %
- Mobile: adapt day-tab-view for hourly display

### Step 8: Data Migration
Add to model file (startup migration pattern):
```typescript
// Drop old unique index and migrate slot → hours
Schedule.collection.dropIndex('seat_id_1_day_of_week_1_slot_1').catch(() => {})
// Migration: one-time convert slot to hours
Schedule.updateMany(
  { slot: 'morning', start_hour: { $exists: false } },
  { $set: { start_hour: 8, end_hour: 12, usage_budget_pct: 50 }, $unset: { slot: '' } }
)
Schedule.updateMany(
  { slot: 'afternoon', start_hour: { $exists: false } },
  { $set: { start_hour: 13, end_hour: 17, usage_budget_pct: 50 }, $unset: { slot: '' } }
)
```

## Todo List
- [x] Update shared types (Schedule, AlertType)
- [x] Rewrite Schedule mongoose model (drop slot, add start/end hour + budget)
- [x] Add migration logic for existing data
- [x] Rewrite schedule routes (all 6 endpoints)
- [x] Add overlap detection in create/update routes
- [x] Update use-schedules hook (interface + mutations)
- [x] Rewrite schedule-grid.tsx → hourly time grid
- [x] Adapt schedule-cell.tsx → time block
- [x] Update schedule.tsx page (seat tabs, create dialog, DnD)
- [x] Update day-tab-view.tsx for mobile hourly view
- [x] Compile check (pnpm build)
- [x] Manual test: create, move, delete schedule entries

## Success Criteria
- Users can create schedule entries with specific hours (not just morning/afternoon)
- Budget % visible on each time block
- Overlap warning displayed but not blocking
- Total budget per seat/day shown in UI
- Existing data migrated without loss
- Drag-and-drop works for moving time blocks
- `pnpm build` passes

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Old index drop fails silently | Catch error, log warning — same pattern as UsageSnapshot TTL drop |
| Migration data loss | Sensible defaults (morning=8-12, afternoon=13-17, budget=50%) |
| DnD complexity with variable-height blocks | Start with click-to-create, add DnD as enhancement |

## Security Considerations
- Validate `start_hour < end_hour`, both 0-23 range
- Validate user belongs to seat before creating entry
- Admin-only: update other user's budget, clear all
- Regular user: only create/edit/delete own entries

## Next Steps
→ Phase 2: Usage Budget Alert + Block (depends on `usage_budget_pct` field from this phase)
