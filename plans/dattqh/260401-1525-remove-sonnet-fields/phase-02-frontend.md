---
phase: 2
status: done
effort: 20m
---

# Phase 2: Frontend — Remove Sonnet Fields

## Files to Modify

### 1. `packages/web/src/hooks/use-dashboard.ts`
- `EnhancedDashboardData.usagePerSeat`: remove `sonnet_pct`
- `EnhancedDashboardData.usageTrend`: remove `avg_sonnet`
- `SeatUsageData.seats`: remove `weekly_sonnet_pct`

### 2. `packages/web/src/hooks/use-usage-log.ts`
- `UsageLogEntry`: remove `weeklySonnetPct`
- `useBulkLog` mutationFn: remove `weeklySonnetPct` from body type

### 3. `packages/web/src/components/usage-bar-chart.tsx`
- Remove the `<Bar dataKey="sonnet_pct" name="Sonnet" .../>` element

### 4. `packages/web/src/components/trend-line-chart.tsx`
- Remove the `<Line dataKey="avg_sonnet" name="Sonnet" .../>` element

### 5. `packages/web/src/pages/log-usage.tsx`
- Remove `weeklySonnetPct: r.weeklySonnetPct ?? 0` from save payload

## Todo
- [ ] Update use-dashboard hook types
- [ ] Update use-usage-log hook types
- [ ] Remove Sonnet bar from usage-bar-chart
- [ ] Remove Sonnet line from trend-line-chart
- [ ] Clean log-usage save payload
- [ ] Compile check passes
