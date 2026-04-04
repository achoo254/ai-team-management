# Phase 1: Dashboard API Rewrite

## Priority: High | Status: completed

## Overview
Replace all UsageLog aggregations in dashboard.ts with UsageSnapshot queries. Update frontend types and components.

## Context
- [Brainstorm](../reports/brainstorm-260404-1102-usage-module-consolidation.md)
- Dashboard currently: `routes/dashboard.ts` → aggregates `UsageLog` → feeds `usagePerSeat`, `usageTrend`, `teamUsage`

## Files to Modify
- `packages/api/src/routes/dashboard.ts` — Rewrite all 3 endpoints
- `packages/web/src/hooks/use-dashboard.ts` — Update TypeScript interfaces
- `packages/web/src/components/usage-bar-chart.tsx` — Adapt to new data shape
- `packages/web/src/components/usage-table.tsx` — Show snapshot fields instead of weekly_all_pct

## Implementation Steps

### 1. Rewrite `GET /api/dashboard/summary`

Replace UsageLog aggregation with latest snapshot avg:
```ts
// Get latest snapshot per seat (last 2 hours)
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
const latestSnapshots = await UsageSnapshot.aggregate([
  { $match: { fetched_at: { $gte: twoHoursAgo } } },
  { $sort: { fetched_at: -1 } },
  { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
])
const avgAll = latestSnapshots.length > 0
  ? Math.round(latestSnapshots.reduce((s, r) => s + (r.seven_day_pct ?? 0), 0) / latestSnapshots.length)
  : 0

// Replace totalLogs with totalSnapshots
const totalSnapshots = await UsageSnapshot.countDocuments()
res.json({ avgAllPct: avgAll, activeAlerts, totalSnapshots })
```

### 2. Rewrite `GET /api/dashboard/enhanced`

**usagePerSeat** — latest snapshot per seat:
```ts
import { UsageSnapshot } from '../models/usage-snapshot.js'

const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
const latestSnapshots = await UsageSnapshot.aggregate([
  { $match: { fetched_at: { $gte: twoHoursAgo } } },
  { $sort: { fetched_at: -1 } },
  { $group: {
    _id: '$seat_id',
    five_hour_pct: { $first: '$five_hour_pct' },
    seven_day_pct: { $first: '$seven_day_pct' },
  }},
])
const snapshotMap = new Map(latestSnapshots.map(s => [String(s._id), s]))

const usagePerSeat = seats.map(s => ({
  label: s.label,
  team: s.team,
  five_hour_pct: snapshotMap.get(String(s._id))?.five_hour_pct ?? null,
  seven_day_pct: snapshotMap.get(String(s._id))?.seven_day_pct ?? null,
}))
```

**usageTrend** — daily avg of seven_day_pct, last 30 days:
```ts
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const usageTrend = await UsageSnapshot.aggregate([
  { $match: { fetched_at: { $gte: thirtyDaysAgo }, seven_day_pct: { $ne: null } } },
  { $group: {
    _id: { $dateToString: { format: '%Y-%m-%d', date: '$fetched_at', timezone: 'Asia/Ho_Chi_Minh' } },
    avg_pct: { $avg: '$seven_day_pct' },
  }},
  { $sort: { _id: 1 } },
  { $project: { date: '$_id', avg_pct: { $round: ['$avg_pct', 0] }, _id: 0 } },
])
```

**teamUsage** — avg of latest snapshot per team:
```ts
const teamUsageCalc: Record<string, { total: number; count: number }> = {}
for (const s of seats) {
  const snap = snapshotMap.get(String(s._id))
  if (!teamUsageCalc[s.team]) teamUsageCalc[s.team] = { total: 0, count: 0 }
  teamUsageCalc[s.team].total += snap?.seven_day_pct ?? 0
  teamUsageCalc[s.team].count++
}
```

Remove `UsageLog` import entirely.

## Review Feedback Applied
- **H1 fix**: Removed 2-hour time window on snapshot queries across all endpoints (summary, enhanced, by-seat) to fetch latest available data
- **M1/M2 fix**: Null `seven_day_pct` values filtered from averages to prevent skewing daily trend calculations
- **L1/L2 fix**: Component renamed from `UsageMetricsPage` to `UsagePage` for consistency with new route structure

### 3. Rewrite `GET /api/dashboard/usage/by-seat`

Replace UsageLog lookup with latest snapshot:
```ts
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
const latestSnapshots = await UsageSnapshot.aggregate([
  { $match: { fetched_at: { $gte: twoHoursAgo } } },
  { $sort: { fetched_at: -1 } },
  { $group: {
    _id: '$seat_id',
    five_hour_pct: { $first: '$five_hour_pct' },
    seven_day_pct: { $first: '$seven_day_pct' },
    last_fetched_at: { $first: '$fetched_at' },
  }},
])

// Map and return
const enriched = seats.map(s => ({
  seat_id: s._id,
  seat_email: s.email,
  label: s.label,
  team: s.team,
  five_hour_pct: snapshotMap.get(...)?.five_hour_pct ?? null,
  seven_day_pct: snapshotMap.get(...)?.seven_day_pct ?? null,
  last_fetched_at: snapshotMap.get(...)?.last_fetched_at ?? null,
  users: usersBySeatId[...] || [],
})).sort((a, b) => (b.seven_day_pct ?? 0) - (a.seven_day_pct ?? 0))
```

### 4. Update `hooks/use-dashboard.ts`

```ts
export interface EnhancedDashboardData {
  // ...keep totalUsers, activeUsers, totalSeats, unresolvedAlerts, todaySchedules
  usagePerSeat: { label: string; team: string; five_hour_pct: number | null; seven_day_pct: number | null }[];
  usageTrend: { date: string; avg_pct: number }[];  // was week_start → date
  teamUsage: { team: string; avg_pct: number }[];
}

export interface SeatUsageData {
  seats: {
    seat_id: string; seat_email: string; label: string; team: string;
    five_hour_pct: number | null; seven_day_pct: number | null;
    last_fetched_at: string | null; users: string[];
  }[];
}
```

### 5. Update `usage-bar-chart.tsx`

Change bar from single `all_pct` to dual bars: `five_hour_pct` + `seven_day_pct`:
```tsx
<Bar dataKey="seven_day_pct" name="7d" fill={cssVar("--chart-1")} />
<Bar dataKey="five_hour_pct" name="5h" fill={cssVar("--chart-2")} />
```

### 6. Update `usage-table.tsx`

Replace columns:
- `Usage %` (weekly_all_pct) → `5h %` + `7d %`
- `Logged` (last_logged) → `Fetched` (last_fetched_at)

## Todo
- [x] Rewrite dashboard.ts — summary endpoint
- [x] Rewrite dashboard.ts — enhanced endpoint (usagePerSeat, usageTrend, teamUsage)
- [x] Rewrite dashboard.ts — usage/by-seat endpoint
- [x] Remove UsageLog import from dashboard.ts
- [x] Update use-dashboard.ts interfaces
- [x] Update usage-bar-chart.tsx (dual bars)
- [x] Update usage-table.tsx (snapshot columns)
- [x] Run `pnpm build` to verify

## Success Criteria
- Dashboard shows real-time snapshot data instead of weekly manual logs
- Trend chart shows daily avg over 30 days
- Bar chart shows 5h + 7d usage per seat
- Table shows 5h%, 7d%, last fetched
- No UsageLog references in dashboard code
- `pnpm build` passes
