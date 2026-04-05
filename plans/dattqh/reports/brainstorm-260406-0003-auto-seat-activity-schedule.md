# Brainstorm: Auto Seat Activity Schedule

**Date:** 2026-04-06
**Status:** Approved direction

## Problem Statement

Lịch Phân ca (Schedule) hiện tại yêu cầu member/owner tạo thủ công entries (day_of_week, start_hour, end_hour, user_id). Với 1 seat nhiều members, việc này:
- Tốn effort thủ công, members không muốn tự tạo
- Không phản ánh đúng thực tế sử dụng
- Khó maintain khi pattern thay đổi

Hệ thống đã có UsageSnapshot (5-min cron) + UsageWindow detect seat activity. Cần tận dụng data này.

## Paradigm Shift

| Aspect | Cũ | Mới |
|--------|-----|------|
| Schedule = | Lịch phân ca MEMBER | Lịch hoạt động SEAT |
| user_id | Required per entry | **Removed** — không biết ai dùng, chỉ biết seat active |
| Tạo bởi | Manual (owner/member) | **Auto-detect** từ usage snapshot deltas |
| UI | Drag-drop grid, member colors | **Heatmap** read-only, intensity = activity |
| Mục đích | Assign ai dùng khi nào | Xem/predict seat busy/free + alert |

## Approved Design

### 1. Data Model Changes

#### Schedule Model (refactor)
```
- Remove: user_id, usage_budget_pct
- Add: source ('auto')
- Keep: seat_id, day_of_week, start_hour, end_hour, created_at
- Purpose: Recurring weekly patterns auto-generated from aggregated activity
```

#### New: seat_activity_log Collection
```typescript
{
  seat_id: ObjectId        // ref Seat
  date: Date               // YYYY-MM-DD (Asia/Ho_Chi_Minh)
  hour: number             // 0-23
  is_active: boolean       // true if delta > 0 in this hour
  delta_5h_pct: number     // sum of five_hour_pct increases in this hour
  snapshot_count: number   // how many snapshots showed activity
  created_at: Date
}
// Indexes: { seat_id: 1, date: -1, hour: 1 } unique
```

#### Keep: UsageWindow (no changes)
- Remains primary data source for window-level activity
- seat_activity_log is derived/aggregated from snapshot comparisons

### 2. Auto-detect Logic

**Trigger:** Existing 5-min cron (`collectAllUsage()`)

**Flow:**
```
[Cron 5min] collectAllUsage()
  → For each seat: compare current vs previous snapshot
  → If five_hour_pct increased (delta > 0):
      → Upsert seat_activity_log { seat_id, date: today, hour: currentHour }
      → Increment delta_5h_pct += delta, snapshot_count++
  → If five_hour_pct unchanged:
      → No action (seat idle this interval)
```

**Weekly pattern generator (new cron, weekly or nightly):**
```
→ Aggregate seat_activity_log last N weeks
→ For each seat + day_of_week + hour:
    → If active_rate > threshold (e.g., 60% of weeks) → mark as predicted active
→ Generate/update Schedule entries (source: 'auto')
→ Merge consecutive hours into blocks (start_hour → end_hour)
```

### 3. Frontend: Heatmap Activity

**Replace:** ScheduleGrid (drag-drop, member colors)
**With:** ActivityHeatmap (read-only, color intensity)

```
Layout: 24 hours (Y) × 7 days (X) per seat
Color: gradient based on activity frequency
  - Dark/hot = active most weeks
  - Light/cold = rarely active
  - Transparent = never active
Overlay: Predicted recurring pattern (dotted border)
Realtime: Current hour highlighted if seat is currently active
```

**Interactions:**
- Click cell → show detail popup (last N weeks activity for that slot)
- Filter by seat (existing seat selector)
- Toggle: This week actual vs Pattern prediction

### 4. Alerts

| Event | Condition | Action |
|-------|-----------|--------|
| Unexpected activity | Seat active outside predicted hours | Notify owner/watchers |
| Unexpected idle | Seat idle during predicted active hours | Notify owner/watchers |
| Pattern change | Weekly pattern differs significantly from previous | Summary alert |

Integrate with existing alert system (FCM + Telegram).

### 5. Impact Assessment

**Models affected:**
- `schedule.ts` — Remove user_id, usage_budget_pct; add source field
- New: `seat-activity-log.ts`
- `active-session.ts` — May deprecate (tied to member concept)
- `session-metric.ts` — May deprecate (tied to user_id)

**Routes affected:**
- `schedules.ts` — Major refactor: remove CRUD, add read-only endpoints
- New endpoints: GET activity logs, GET predictions

**Services affected:**
- `usage-collector-service.ts` — Add activity log upsert after snapshot collection
- New: `activity-pattern-service.ts` — Weekly pattern generation
- New: `activity-alert-service.ts` — Anomaly detection

**Frontend affected:**
- `schedule-grid.tsx` → Replace with `activity-heatmap.tsx`
- `use-schedules.ts` → Refactor to read-only hooks
- `schedule-permissions.ts` — Simplify (no more member-level permissions)
- Remove: schedule form dialog, drag-drop logic

**Shared affected:**
- `types.ts` — New DTOs for activity log, heatmap data
- `schedule-permissions.ts` — Major simplify or deprecate

### 6. Migration Strategy

1. Keep old Schedule data for reference (don't delete)
2. Add `source` field to Schedule, mark existing as `source: 'legacy'`
3. Deploy activity log collection + detection logic
4. After 1-2 weeks of data → enable pattern generation
5. Switch frontend to heatmap
6. Deprecate old CRUD endpoints

### 7. Risks

| Risk | Mitigation |
|------|------------|
| 5-min resolution too coarse | Acceptable for hourly heatmap; snapshot delta catches any activity |
| Pattern generation needs history | Cold start: show raw activity only, patterns after 2+ weeks |
| Breaking existing features | ActiveSession/SessionMetric may depend on schedule user_id → audit dependencies |
| Alert spam | Debounce + configurable sensitivity thresholds |

## Unresolved Questions

1. **ActiveSession & SessionMetric deprecation** — These track user-level session data. With member removed from schedule, do we keep these for other purposes (e.g., per-user usage tracking)?
2. **Schedule page permissions** — Currently complex (owner/member/admin). With read-only auto-schedule, simplify to view-only for all members?
3. **Historical data** — How long to retain seat_activity_log? TTL or unlimited?
4. **Pattern threshold** — What % of weeks should a slot be active to become "predicted"? Configurable per seat?

## Next Steps

→ Create detailed implementation plan with phases
