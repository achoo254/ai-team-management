# Phase 5: Dashboard & Charts

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 2 days
- **Description:** Dashboard page với stat cards, 3 Recharts (bar, line, pie), usage table. Mobile responsive.
- **Can parallel with:** Phase 6, 7

## Key Insights
- Current dashboard: 4 stat cards, 3 Chart.js charts, usage table
- Recharts is declarative React — much cleaner than Chart.js imperative destroy/recreate
- Dashboard uses 3 API calls: summary, usage/by-seat, enhanced
- TanStack Query sẽ handle loading/error/cache tự động
- Mobile: stack charts vertically, cards 2-col grid

## Requirements

### Functional
- 4 stat cards: total seats, active users, avg usage %, alert count
- Bar chart: usage per seat (all_pct, sonnet_pct)
- Line chart: 8-week usage trend (avg_all, avg_sonnet)
- Pie/donut chart: team usage breakdown
- Usage table: seat email, assigned users, latest week %
- All charts responsive on mobile

### Non-functional
- Charts render < 500ms
- Skeleton loading states
- Color scheme match current (teal primary, team colors)

## Related Code Files

### Files to Create
- `app/(dashboard)/page.tsx` — Dashboard page
- `components/dashboard/stat-cards.tsx` — 4 KPI cards
- `components/dashboard/usage-bar-chart.tsx` — Recharts bar
- `components/dashboard/trend-line-chart.tsx` — Recharts line
- `components/dashboard/team-pie-chart.tsx` — Recharts pie
- `components/dashboard/usage-table.tsx` — Data table
- `hooks/use-dashboard.ts` — TanStack Query hooks

## Implementation Steps

1. **Create TanStack Query hooks** `hooks/use-dashboard.ts`
   ```typescript
   export function useDashboardSummary() {
     return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: ... })
   }
   export function useUsageBySeat() {
     return useQuery({ queryKey: ['dashboard', 'usage-by-seat'], queryFn: ... })
   }
   export function useDashboardEnhanced() {
     return useQuery({ queryKey: ['dashboard', 'enhanced'], queryFn: ... })
   }
   ```

2. **Create stat-cards.tsx** — 4 cards in grid
   - Desktop: 4 columns, Mobile: 2 columns
   - shadcn Card component
   - Icon + value + label + trend indicator
   - Skeleton while loading

3. **Create usage-bar-chart.tsx** — Recharts BarChart
   - Data: `dashData.usagePerSeat`
   - 2 bars per seat: all_pct (teal), sonnet_pct (blue)
   - ResponsiveContainer for auto-resize
   - Mobile: horizontal bars if many seats

4. **Create trend-line-chart.tsx** — Recharts LineChart
   - Data: `dashData.usageTrend` (8 weeks)
   - 2 lines: avg_all, avg_sonnet
   - X-axis: week_start dates
   - Tooltip with formatted values

5. **Create team-pie-chart.tsx** — Recharts PieChart
   - Data: `dashData.teamUsage`
   - Colors: blue (dev), green (mkt)
   - Labels with percentages
   - Legend

6. **Create usage-table.tsx** — shadcn Table
   - Columns: seat email, label, team badge, assigned users, all%, sonnet%
   - Color-coded usage (green < 50, yellow < 80, red ≥ 80)
   - Mobile: card layout instead of table

7. **Create dashboard page** `app/(dashboard)/page.tsx`
   - Compose all components
   - Layout: stat cards → charts (2-col desktop, stacked mobile) → table
   - Error boundary for chart failures

## Mobile Layout

```
Desktop:
┌─────────┬─────────┬─────────┬─────────┐
│ Seats   │ Users   │ Avg %   │ Alerts  │  stat cards
├─────────┴────┬────┴─────────┤─────────┘
│ Bar Chart    │ Line Chart   │             charts row
├──────────────┼──────────────┤
│ Pie Chart    │ (empty)      │
├──────────────┴──────────────┤
│ Usage Table                 │             full table
└─────────────────────────────┘

Mobile:
┌──────────┬──────────┐
│ Seats    │ Users    │  2-col cards
├──────────┼──────────┤
│ Avg %    │ Alerts   │
├──────────┴──────────┤
│ Bar Chart (full)    │  stacked charts
├─────────────────────┤
│ Line Chart (full)   │
├─────────────────────┤
│ Pie Chart (full)    │
├─────────────────────┤
│ Usage Cards         │  card view
└─────────────────────┘
```

## Todo List

- [ ] Create hooks/use-dashboard.ts with 3 TanStack Query hooks
- [ ] Create stat-cards.tsx (4 KPI cards, responsive grid)
- [ ] Create usage-bar-chart.tsx (Recharts bar)
- [ ] Create trend-line-chart.tsx (Recharts line)
- [ ] Create team-pie-chart.tsx (Recharts pie)
- [ ] Create usage-table.tsx (shadcn table, mobile card fallback)
- [ ] Create dashboard page composing all components
- [ ] Add skeleton loading states
- [ ] Test responsive layout at mobile/tablet/desktop breakpoints

## Success Criteria
- 3 charts render with correct data from API
- Stat cards show correct KPIs
- Usage table displays all seats with color-coded percentages
- Mobile layout stacks properly, charts full-width
- Loading skeletons show during data fetch

## Risk Assessment
- **Recharts bundle size**: ~200KB — acceptable for dashboard. Use dynamic import if needed.
- **Empty data**: Handle 0 seats / 0 usage gracefully with empty state messages

## Next Steps
→ Phase 6: CRUD views (parallel) or Phase 7: Schedule (parallel)
