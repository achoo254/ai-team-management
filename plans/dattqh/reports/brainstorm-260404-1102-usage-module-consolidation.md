# Brainstorm: Usage Module Consolidation

**Date:** 2026-04-04 | **Status:** Agreed

## Problem
2 overlapping usage modules: manual UsageLog (weekly %) and auto UsageSnapshot (30-min API). Now that snapshot is auto-collecting, manual log is redundant. 2 pages confuse users.

## Decisions

| Question | Answer |
|----------|--------|
| Keep manual log? | No — UsageSnapshot replaces it |
| Merge scope? | Full: data model + UI + API |
| Dashboard source? | Switch to Snapshot |
| Telegram report? | Show latest snapshot per seat (real-time) |
| Dashboard trends? | Daily avg pct (from snapshots) |
| Old UsageLog data? | Drop, no archive |
| Approach? | Big Bang — 1 PR, all changes |

## Solution: Single UsageSnapshot Source

### DELETE (legacy removal)
- `pages/log-usage.tsx`, `hooks/use-usage-log.ts`, `components/week-table.tsx`
- `routes/usage-log.ts`, `models/usage-log.ts`, `services/usage-sync-service.ts`
- Route entry, nav link, mount point, cron log reminder
- Shared types: UsageLog, UsageLogPopulated

### REWRITE (consumers → snapshot)
- `routes/dashboard.ts`: aggregate snapshots instead of UsageLog
- `telegram-service.ts`: weekly report → latest snapshot per seat
- `hooks/use-dashboard.ts`, `usage-bar-chart.tsx`, `usage-table.tsx`: adapt
- `app.tsx`: remove log-usage route, rename usage-metrics → usage
- `index.ts`: remove log reminder cron, remove UsageLog imports

### New Dashboard API Shape
```
GET /api/dashboard/enhanced
  usagePerSeat: [{ label, team, five_hour_pct, seven_day_pct }]
  usageTrend: [{ date, avg_pct }]  // daily avg, 30 days
  teamUsage: [{ team, avg_pct }]

GET /api/dashboard/usage/by-seat
  seats: [{ label, team, five_hour_pct, seven_day_pct, last_fetched_at }]
```

### New Telegram Report Format
Show per-seat: 5h%, 7d%, extra credits with progress bars. Group by team.

## Risks
- Breaking change on Dashboard API — frontend must deploy with backend
- Snapshot 90-day TTL limits historical data
- If collectAllUsage cron fails, Dashboard has stale data

## Next Steps
Create implementation plan with phases.
