# Phase 6: Alerts & Cleanup

## Context
- [Phase 3](phase-03-pattern-generator.md) — patterns needed for anomaly detection
- [Phase 5](phase-05-frontend-heatmap.md) — frontend done
- [plan.md](plan.md)

## Overview
- **Priority:** Medium
- **Status:** Complete
- Add activity anomaly alerts. Deprecate ActiveSession + SessionMetric. Remove dead code.

## Requirements

### Functional — Alerts
- Detect: seat active outside predicted hours → "Unexpected activity" alert
- Detect: seat idle during predicted active hours → "Unexpected idle" alert
- Detect: weekly pattern changed significantly → "Pattern change" summary
- Integrate with existing alert system (FCM + Telegram)

### Functional — Cleanup
- Remove ActiveSession model + all references
- Remove SessionMetric model + all references
- Remove unused schedule components (schedule-form-dialog, schedule-cell, etc.)
- Remove old schedule CRUD hooks
- Clean up unused imports across codebase

### Non-functional
- Alert dedup: max 1 alert per seat per type per 24h (existing pattern)
- Configurable sensitivity (admin setting)

## Architecture

### Anomaly Detection Logic

```typescript
// Run after each 5-min snapshot collection
async function checkActivityAnomalies(seatId: ObjectId) {
  const vnNow = toZonedTime(new Date(), 'Asia/Ho_Chi_Minh')
  const dayOfWeek = vnNow.getDay()
  const hour = vnNow.getHours()

  // Get predicted pattern for this slot
  const pattern = await Schedule.findOne({
    seat_id: seatId, day_of_week: dayOfWeek,
    start_hour: { $lte: hour }, end_hour: { $gt: hour },
    source: 'auto'
  })

  // Get current activity
  const isActive = await isCurrentlyActive(seatId) // from latest snapshot delta

  if (isActive && !pattern) → triggerAlert('unexpected_activity', seatId)
  if (!isActive && pattern) → triggerAlert('unexpected_idle', seatId)
}
```

### Files to Delete

```
packages/api/src/models/active-session.ts
packages/api/src/models/session-metric.ts
packages/web/src/components/schedule-form-dialog.tsx
packages/web/src/components/schedule-cell.tsx (if exists and unused)
```

### Files to Audit for Dead References

```
packages/api/src/index.ts — cron references to session cleanup?
packages/api/src/services/*.ts — imports of ActiveSession/SessionMetric
packages/api/src/routes/dashboard.ts — session metric queries?
packages/shared/types.ts — session-related types
```

## Implementation Steps

1. Create `packages/api/src/services/activity-anomaly-service.ts`
   - `checkActivityAnomalies(seatId)` — compare current vs predicted
   - `checkWeeklyPatternChanges()` — weekly cron, compare this week vs last week patterns
   - Integrate with existing `alert-service.ts` for FCM/Telegram dispatch

2. Hook anomaly check into 5-min cron (after activity detection, Phase 2)

3. Add weekly pattern change check to daily 04:00 cron (after pattern generation, Phase 3)

4. Deprecate models
   - Delete `active-session.ts` and `session-metric.ts`
   - Grep for all imports/references → remove
   - Remove any cron jobs related to session lifecycle

5. Remove dead frontend code
   - Delete schedule-form-dialog.tsx
   - Delete schedule-cell.tsx (if unused after Phase 5)
   - Remove old use-schedules.ts (replaced by use-activity-schedule.ts in Phase 5)
   - Remove dnd-kit dependency if no longer used elsewhere

6. Full codebase grep for orphaned references
   - `ActiveSession`, `SessionMetric`, `active-session`, `session-metric`
   - `useCreateScheduleEntry`, `useUpdateScheduleEntry`, `useSwapSchedule`, `useClearAll`
   - `schedule-form-dialog`, `schedule-cell`

7. Run `pnpm build` + `pnpm test` + `pnpm lint`

## Todo List

- [x] Create activity-anomaly-service.ts
- [x] Hook into cron jobs
- [x] Delete ActiveSession + SessionMetric models
- [x] Remove all dead references
- [x] Delete unused frontend components
- [x] Full build + test + lint passes

## Success Criteria
- Anomaly alerts fire correctly (test with mock data)
- No references to ActiveSession/SessionMetric in codebase
- No unused schedule CRUD code remaining
- `pnpm build` + `pnpm test` + `pnpm lint` all pass
- dnd-kit removed from schedule page dependencies

## Risk Assessment
- **Alert spam:** New anomaly detection might fire too often initially → start with high threshold, tune later
- **Hidden references:** ActiveSession/SessionMetric may be used in dashboard aggregations → thorough grep required
- **dnd-kit dependency:** May be used elsewhere (check before removing from package.json)

## Security Considerations
- Alert dispatch uses existing authenticated channels (FCM, Telegram)
- No new auth surface introduced
