# Phase 5: Frontend Heatmap

## Context
- [Phase 4](phase-04-api-refactor.md) — API endpoints must exist
- [plan.md](plan.md)

## Overview
- **Priority:** High
- **Status:** Complete
- Replace drag-drop schedule grid with read-only activity heatmap

## Key Insights
- Current schedule.tsx (429 LOC) has heavy drag-drop + CRUD logic → mostly removed
- schedule-grid.tsx uses dnd-kit → remove entirely
- Heatmap = 24 rows (hours) × 7 cols (days), color intensity = activity_rate
- Need: seat selector, week toggle, realtime indicator

## Requirements

### Functional
- Heatmap grid: 24h × 7 days per seat
- Color gradient: transparent (0%) → light (low) → dark (high activity)
- Click cell → popup with detail (activity_rate, avg_delta, last N weeks breakdown)
- Realtime indicator: highlight current hour if seat currently active
- Predicted pattern overlay: dotted border on cells from recurring Schedule
- Seat selector (existing pattern)

### Non-functional
- Responsive: mobile = scrollable grid or day-tab view
- Performant: single API call for heatmap data per seat
- Accessible: color + text labels for activity levels

## Architecture

### Component Structure

```
SchedulePage (refactored)
├── SeatSelector (existing, reuse)
├── WeeksRangeSelector (new: 2w/4w/8w/12w)
├── ActivityHeatmap (new)
│   ├── HeatmapGrid
│   │   ├── HeatmapCell (color by activity_rate)
│   │   └── HeatmapTooltip (detail popup)
│   └── HeatmapLegend (color scale)
├── RealtimeStatusBadge (new: "Đang hoạt động" / "Rảnh")
└── PatternSummary (new: text summary of predicted schedule)
```

### Color Scale

```
activity_rate: 0%    → bg-transparent (no data)
activity_rate: 1-25% → bg-emerald-100 (light)
activity_rate: 26-50% → bg-emerald-300
activity_rate: 51-75% → bg-emerald-500
activity_rate: 76-100% → bg-emerald-700 (dark)
```

### Hooks

```typescript
// Replace existing 7 hooks with 3
useActivityHeatmap(seatId, weeks)  → GET /api/schedules/heatmap/:seatId?weeks=
useActivityLogs(params)            → GET /api/activity-logs
useRealtimeStatus()                → GET /api/activity-logs/realtime (poll every 60s)
```

## Related Code Files

### Replace
- `packages/web/src/components/schedule-grid.tsx` → `activity-heatmap.tsx`
- `packages/web/src/components/schedule-cell.tsx` → Remove (or repurpose as heatmap-cell)

### Modify
- `packages/web/src/pages/schedule.tsx` — Major refactor: remove CRUD, add heatmap
- `packages/web/src/hooks/use-schedules.ts` — Replace with activity hooks

### Remove
- `packages/web/src/components/schedule-form-dialog.tsx` — No more create/edit forms
- Drag-drop imports (dnd-kit) from schedule page

### Read (context)
- `packages/web/src/components/usage-snapshot-card.tsx` — Existing ProgressBar patterns
- `packages/web/src/pages/dashboard.tsx` — Existing seat selector pattern

## Implementation Steps

1. Create `packages/web/src/hooks/use-activity-schedule.ts`
   - `useActivityHeatmap(seatId, weeks)` — query heatmap endpoint
   - `useRealtimeStatus()` — poll realtime endpoint every 60s
   - `useActivityLogs(params)` — raw logs with pagination

2. Create `packages/web/src/components/activity-heatmap.tsx`
   - HeatmapGrid: 24 rows × 7 cols
   - HeatmapCell: colored div based on activity_rate
   - HeatmapTooltip: Popover with detail on click/hover
   - HeatmapLegend: color scale bar
   - Keep under 200 LOC (split tooltip/legend if needed)

3. Refactor `packages/web/src/pages/schedule.tsx`
   - Remove: all CRUD state, dialogs, drag-drop, mutations
   - Keep: seat selector, header
   - Add: WeeksRangeSelector, ActivityHeatmap, RealtimeStatusBadge
   - Target: <200 LOC (from 429)

4. Cleanup
   - Remove schedule-form-dialog.tsx
   - Remove/refactor schedule-grid.tsx → delete or rename
   - Remove schedule-cell.tsx if unused
   - Update use-schedules.ts → rename to use-activity-schedule.ts

5. Run `pnpm build` (full build check)

## Todo List

- [x] Create use-activity-schedule.ts hooks
- [x] Create activity-heatmap.tsx component
- [x] Refactor schedule.tsx page
- [x] Remove unused schedule components
- [x] Full build passes

## Success Criteria
- Heatmap renders correctly with color gradient
- Realtime status updates every 60s
- Cell click shows detail popup
- No drag-drop or CRUD UI remaining
- Mobile responsive
- `pnpm build` passes

## Risk Assessment
- **Empty state:** New installs have no activity data → show "Đang thu thập dữ liệu..." message
- **Color accessibility:** Use text labels alongside colors for colorblind users

## Next Steps
→ Phase 6: Alerts & Cleanup
