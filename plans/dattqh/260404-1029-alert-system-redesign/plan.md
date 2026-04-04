---
name: Alert System Redesign (UsageSnapshot-based)
status: completed
created: 2026-04-04
completed: 2026-04-04
branch: main
phases: 4
blockedBy: []
blocks: []
---

# Alert System Redesign (UsageSnapshot-based)

## Context
- [Brainstorm Report](../reports/brainstorm-260404-1029-alert-system-redesign.md)

## Problem
Alert system uses manual UsageLog (weekly %) only. Real-time UsageSnapshot data (30-min Anthropic API) is unused. Need real-time alerts with admin-configurable thresholds.

## Solution
1. Replace 2 old alert types with 3 new: `rate_limit`, `extra_credit`, `token_failure`
2. New Settings model + Admin UI for threshold config
3. Dedup: 1 unresolved alert per seat+type (not daily)
4. Check alerts every 30 min after usage collection
5. Telegram notification on each new alert
6. Delete all legacy alert data

## Phases

| # | Phase | Status | Key Files |
|---|-------|--------|-----------|
| 1 | [Types & Models](phase-01-types-and-models.md) | completed | shared/types.ts, models/alert.ts, models/setting.ts (new) |
| 2 | [Alert Service & Cron](phase-02-alert-service-and-cron.md) | completed | services/alert-service.ts, index.ts |
| 3 | [Settings API & Telegram](phase-03-settings-api-and-telegram.md) | completed | routes/settings.ts (new), routes/admin.ts, services/telegram-service.ts |
| 4 | [Frontend Updates](phase-04-frontend-updates.md) | completed | alert-card.tsx, alerts.tsx, admin.tsx, hooks/use-admin.ts, hooks/use-alerts.ts |

## Dependencies
- Requires: UsageSnapshot model + collection cron (already implemented)
- Requires: OAuth token management (already implemented)
