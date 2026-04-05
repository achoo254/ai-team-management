# Phase 3: Pattern Generator

## Context
- [Phase 2](phase-02-activity-detection-service.md) — activity logs must be populated first
- [plan.md](plan.md)

## Overview
- **Priority:** High
- **Status:** Complete
- Aggregate seat_activity_log into weekly recurring Schedule entries (source: 'auto')

## Key Insights
- Need minimum 2 weeks of data for meaningful patterns
- Pattern = "seat X is usually active on day Y at hour Z"
- Threshold-based: if active >50% of observed weeks → mark as predicted
- Merge consecutive hours into blocks (start_hour → end_hour)

## Requirements

### Functional
- Weekly cron: analyze last N weeks of activity logs per seat
- Generate Schedule entries with `source: 'auto'`
- Replace previous auto entries (delete old auto, insert new)
- Merge consecutive active hours into blocks

### Non-functional
- Configurable lookback window (default: 4 weeks)
- Configurable activity threshold (default: 50%)
- Run during low-traffic hours (e.g., daily 04:00 VN time)

## Architecture

### Pattern Analysis Algorithm

```
For each seat:
  1. Query seat_activity_log last N weeks
  2. Group by (day_of_week, hour)
  3. Count: how many weeks was this slot active?
  4. If active_weeks / total_weeks >= threshold → mark as predicted
  5. Merge consecutive predicted hours into blocks
  6. Delete existing Schedule where source='auto' AND seat_id
  7. Insert new Schedule entries
```

### Merge Logic

```typescript
// Input: sorted array of active hours [8, 9, 10, 13, 14]
// Output: blocks [{start: 8, end: 11}, {start: 13, end: 15}]
function mergeConsecutiveHours(hours: number[]): { start: number; end: number }[] {
  if (!hours.length) return []
  const blocks: { start: number; end: number }[] = []
  let start = hours[0], prev = hours[0]
  for (let i = 1; i < hours.length; i++) {
    if (hours[i] === prev + 1) { prev = hours[i] }
    else { blocks.push({ start, end: prev + 1 }); start = hours[i]; prev = hours[i] }
  }
  blocks.push({ start, end: prev + 1 })
  return blocks
}
```

## Related Code Files

### Create
- `packages/api/src/services/activity-pattern-service.ts` — Pattern analysis + schedule generation

### Modify
- `packages/api/src/index.ts` — Add daily cron job (04:00 VN time)

### Read (context)
- `packages/api/src/models/seat-activity-log.ts` — Query source
- `packages/api/src/models/schedule.ts` — Write target

## Implementation Steps

1. Create `packages/api/src/services/activity-pattern-service.ts`
   - `analyzePatterns(seatId, lookbackWeeks, threshold)` — aggregate + detect
   - `generateScheduleEntries(seatId)` — full flow: analyze → merge → write
   - `generateAllPatterns()` — iterate all active seats

2. Add cron to `packages/api/src/index.ts`
   - Daily at 04:00 Asia/Ho_Chi_Minh: `generateAllPatterns()`
   - Use existing cron pattern style

3. Run `pnpm -F @repo/api build`

## Todo List

- [x] Create activity-pattern-service.ts
- [x] Add cron job in index.ts
- [x] Compile check passes

## Success Criteria
- After 2+ weeks of data, cron generates meaningful Schedule entries
- Consecutive hours merged into blocks
- Previous auto entries replaced on each run
- Legacy entries untouched

## Risk Assessment
- **Cold start:** No patterns until enough data → frontend should handle empty state gracefully
- **Volatile patterns:** Seats with irregular usage → threshold tuning needed
- **Race condition:** Pattern generator vs activity detector both write → no conflict (different collections/sources)

## Next Steps
→ Phase 5: Frontend Heatmap (after Phase 4 API is ready)
