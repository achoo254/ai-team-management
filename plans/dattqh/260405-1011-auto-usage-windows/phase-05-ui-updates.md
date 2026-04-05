# Phase 5 — UI updates + peak hours heatmap

## Overview
**Priority:** Medium | **Status:** pending | **Depends on:** Phase 4
Update efficiency card to reflect new metrics, add peak hours heatmap component.

## Files to modify
- `packages/web/src/components/dashboard-efficiency.tsx` — labels, empty state, Sonnet/Opus columns
- `packages/web/src/hooks/use-dashboard.ts` — add `usePeakHours()` hook
- `packages/web/src/pages/dashboard.tsx` — mount heatmap + My Efficiency section

## Files to create
- `packages/web/src/components/dashboard-peak-hours-heatmap.tsx` — 7x24 grid
- `packages/web/src/components/dashboard-my-efficiency.tsx` — per-user summary card

## Implementation Steps

### 1. `dashboard-efficiency.tsx`
- Read `coverage.has_data` from response — show empty state if false
- Read `coverage.seats_with_data / seats_total` — show warning banner if partial coverage (e.g. "Data đang backfill cho N/M seats")
- Update empty state copy: "Chưa có dữ liệu window nào" → "Dữ liệu đang thu thập (window 5h đầu tiên)"
- Rename "Sessions" labels → "Windows" throughout
- Drop "reset_count" display (no longer applicable)
- Show active windows count if any
- **Add Sonnet/Opus columns** to per-seat table: show `avg_delta_7d_sonnet` + `avg_delta_7d_opus` (mini bar or %)
- Highlight seats with high Opus% (expensive) — warning color if opus > sonnet

### 2. `use-dashboard.ts`
```ts
export function usePeakHours(range = 'month', seatIds?: string[]) {
  return useQuery({
    queryKey: ['peak-hours', range, seatIds],
    queryFn: () => api.get('/dashboard/peak-hours', {params: {range, seatIds}}),
  })
}
```

### 3. `dashboard-peak-hours-heatmap.tsx`
- Grid: 7 rows (Sun-Sat) × 24 cols (0h-23h)
- Cell color intensity = `avg_delta_7d` (0 = gray, max = red)
- Cell tooltip: "Thứ X, Yh: Z% avg delta, N windows"
- Use Tailwind + simple CSS grid, no Recharts needed (heatmap isn't native)
- Mobile: horizontal scroll

### 4. Mount heatmap on dashboard
Add below efficiency card (or behind tab). Check `packages/web/src/pages/dashboard.tsx`.

### 5. `dashboard-my-efficiency.tsx` (per-user summary)
Consume `/personal` endpoint's new efficiency section. Display:
- My avg utilization % (last 30 days)
- My waste window count
- My top 3 efficient seats + bottom 3
- My Sonnet vs Opus split (donut or bar)
Mount on `/dashboard` page ABOVE per-seat efficiency table (user's own view first).

## Todo
- [ ] Update efficiency card labels + empty state + Sonnet/Opus columns
- [ ] Add `usePeakHours` hook
- [ ] Build heatmap component (< 120 LOC)
- [ ] Build MyEfficiency component (< 150 LOC)
- [ ] Mount heatmap + MyEfficiency on dashboard page
- [ ] Snapshot test heatmap with mock data
- [ ] Visual QA on dev server

## Success Criteria
- Efficiency card shows data after backfill
- Heatmap renders 7x24 grid with color gradients
- No console errors, no TS errors
- Mobile-responsive

## Risks
- Color scheme accessibility (color-blind) → use intensity not hue alone
- Empty heatmap (no data) → show skeleton or empty state
- DOW mismatch (Mongo 1-7 vs JS Date 0-6) → normalize in backend response

## Next
Manual QA + deploy. No further phases.
