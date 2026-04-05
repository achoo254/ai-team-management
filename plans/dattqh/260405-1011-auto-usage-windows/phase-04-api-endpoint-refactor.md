# Phase 4 — Dashboard API refactor

## Overview
**Priority:** High | **Status:** pending | **Depends on:** Phase 1
Swap `/api/dashboard/efficiency` source from `SessionMetric` → `UsageWindow`. Add peak-hours endpoint.

## Files to modify
- `packages/api/src/routes/dashboard.ts` — replace aggregations in `/efficiency` handler, add `/peak-hours`

## Files to create (optional)
- `packages/api/src/routes/dashboard-efficiency-aggregations.ts` — extract large aggregation pipelines if handler > 200 LOC

## Implementation Steps

### 1. Refactor `/efficiency` endpoint
Change `SessionMetric` references to `UsageWindow`. Keep same response shape for UI compatibility.

Field mapping:
| Old (SessionMetric) | New (UsageWindow) |
|---------------------|-------------------|
| `utilization_pct` | `utilization_pct` |
| `delta_5h_pct` | `utilization_pct` (same concept in new model) |
| `delta_7d_pct` | `delta_7d_pct` |
| `impact_ratio` | `impact_ratio` |
| `duration_hours` | `duration_hours` |
| `reset_count_5h` | N/A — drop from response, each window = 1 cycle |
| `waste_sessions` | count where `is_waste=true` |
| `date` | `window_end` (for daily trend grouping) |
| `user_id` | `owner_id` |

Only aggregate `is_closed=true` windows for historical metrics. Open windows only for "active" view.

Match filter: `{window_end: {$gte: rangeStart}, is_closed: true, ...seatFilter}`

### 1b. Sonnet/Opus breakdown (per-seat + summary)
Expose `avg_delta_7d_sonnet` + `avg_delta_7d_opus` in:
- `summary` object (overall avg)
- `perSeat[]` rows (per-seat column)

Purpose: identify seats burning Opus (expensive) vs Sonnet (cheap). Users can rebalance.

```js
// Add to $group stages:
avg_delta_7d_sonnet: {$avg: '$delta_7d_sonnet_pct'},
avg_delta_7d_opus: {$avg: '$delta_7d_opus_pct'},
```

### 2. Active windows (replace activeSessions)
Replace `ActiveSession` lookup with:
```ts
const activeWindows = await UsageWindow.find({
  is_closed: false,
  ...seatFilter,
}).lean()
```
Response shape: `{seat_id, owner_name, utilization_pct, delta_7d_pct, started_at: window_start}`

### 3. New endpoint `/api/dashboard/peak-hours`
```ts
router.get('/peak-hours', async (req, res) => {
  // Query: range (week|month|3month), seatIds
  // Output: 7x24 heatmap [{dow: 0-6, hour: 0-23, avg_delta_7d: number, window_count: number}]
})
```

Aggregation: Use `peak_hour_of_day` + `$dayOfWeek(window_end)` + avg `delta_7d_pct`.

```js
[
  {$match: {is_closed: true, window_end: {$gte: rangeStart}, ...seatFilter}},
  {$addFields: {dow: {$dayOfWeek: {date: '$window_end', timezone: 'Asia/Ho_Chi_Minh'}}}},
  {$group: {
    _id: {dow: '$dow', hour: '$peak_hour_of_day'},
    avg_delta_7d: {$avg: '$delta_7d_pct'},
    window_count: {$sum: 1},
  }},
  {$project: {dow: '$_id.dow', hour: '$_id.hour', _id: 0, avg_delta_7d: 1, window_count: 1}},
]
```

Note: MongoDB `$dayOfWeek` returns 1-7 (Sun=1). Frontend adjusts.

### 4. Data quality flag (`has_data`)
After aggregations, check per-seat coverage:
```ts
const seatsWithData = await UsageWindow.distinct('seat_id', {
  is_closed: true, window_end: {$gte: rangeStart}, ...seatFilter
})
const totalSeats = effectiveIds?.length ?? (allowed?.length ?? 0)
const coverage = {
  has_data: seatsWithData.length > 0,
  seats_with_data: seatsWithData.length,
  seats_total: totalSeats,
  missing_seat_ids: /* seats without any closed window */,
}
```
Include `coverage` object in response. UI shows empty state or warning banner if `!has_data` or `seats_with_data < seats_total`.

### 5. `/api/dashboard/personal` — add "My Efficiency" section
Augment existing `/personal` endpoint (or add `/personal/efficiency` sub-route):
- Aggregate UsageWindow where `owner_id = req.user._id`, last 30 days, `is_closed=true`
- Return: `{my_avg_utilization, my_waste_count, my_top_seats[], my_bottom_seats[], my_sonnet_vs_opus_split}`
- Lets user see THEIR efficiency across all owned seats in one view

### 6. Shared types
Update `packages/shared/types.ts`:
- Adjust `EfficiencyResponse` if field names change (try to keep same)
- Add `PeakHoursResponse` type

## Todo
- [ ] Refactor `/efficiency` query to use UsageWindow
- [ ] Add Sonnet/Opus avg fields to summary + perSeat
- [ ] Add `coverage` object with `has_data` flag + per-seat status
- [ ] Add "My Efficiency" aggregation to `/personal` endpoint
- [ ] Keep legacy `SessionMetric` query as fallback? → NO, remove (KISS)
- [ ] Add `/peak-hours` endpoint
- [ ] Update shared types
- [ ] Test with backfilled data — verify aggregations return non-empty
- [ ] Verify auth scoping (seat ownership) still works

## Success Criteria
- `/efficiency` returns non-empty data from UsageWindow
- No changes needed to UI response parsing (backward-compatible shape)
- `/peak-hours` returns 7x24 grid for last 30 days
- `pnpm -F @repo/api build` passes

## Risks
- Breaking existing UI if field names shift → keep aliases where needed
- `SessionMetric` becomes orphaned → document as deprecated, don't delete yet (user may re-enable schedules)
- MongoDB timezone handling — verify Asia/Ho_Chi_Minh consistent with existing dailyTrend

## Next
Phase 5 adds UI heatmap component.
