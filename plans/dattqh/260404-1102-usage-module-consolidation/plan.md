---
name: Usage Module Consolidation (UsageLog → UsageSnapshot)
status: completed
created: 2026-04-04
branch: main
phases: 4
blockedBy: []
blocks: []
---

# Usage Module Consolidation

## Context
- [Brainstorm Report](../reports/brainstorm-260404-1102-usage-module-consolidation.md)

## Problem
2 overlapping modules: manual UsageLog (weekly %) and auto UsageSnapshot (30-min API). Snapshot replaces log entirely. 2 pages confuse users.

## Solution
1. Rewrite Dashboard API to aggregate from UsageSnapshot (daily avg trends)
2. Rewrite Telegram weekly report to show latest snapshot per seat
3. Delete all UsageLog code: model, routes, hooks, page, types, service, cron
4. Rename `/usage-metrics` → `/usage`, update nav
5. Drop `usage_logs` collection

## Phases

| # | Phase | Status | Key Files |
|---|-------|--------|-----------|
| 1 | [Dashboard API Rewrite](phase-01-dashboard-api-rewrite.md) | completed | routes/dashboard.ts, hooks/use-dashboard.ts, usage-bar-chart.tsx, usage-table.tsx |
| 2 | [Telegram Report Rewrite](phase-02-telegram-report-rewrite.md) | completed | services/telegram-service.ts, index.ts |
| 3 | [Delete UsageLog Legacy](phase-03-delete-usage-log-legacy.md) | completed | models/usage-log.ts, routes/usage-log.ts, services/usage-sync-service.ts, hooks/use-usage-log.ts, pages/log-usage.tsx, components/week-table.tsx, shared/types.ts |
| 4 | [Route Rename & Cleanup](phase-04-route-rename-and-cleanup.md) | completed | app.tsx, app-sidebar.tsx, mobile-nav.tsx, header.tsx, tests/ |

## Dependencies
- Requires: UsageSnapshot model + collection cron (already implemented)
- Requires: Alert system redesign (completed — already uses Snapshot)
- Phase 1 & 2 can run in parallel
- Phase 3 depends on Phase 1 & 2
- Phase 4 depends on Phase 3
