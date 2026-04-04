---
title: Per-User Notification Schedule
status: pending
created: 2026-04-04
blockedBy: []
blocks: []
---

# Per-User Notification Schedule

## Overview

Replace fixed Friday 08:00 cron report with per-user configurable notification schedules. Each user chooses their own days/hour for usage report delivery via personal Telegram bot. Admin retains system bot + manual send in Admin page.

## Brainstorm Context
- Admin = user with extra privileges, same notification UX
- System alerts (rate_limit, token_failure, etc.) unchanged — still via system bot
- Admin-only features (system bot config, manual send, alert thresholds) stay in Admin page

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [Schema + API](phase-01-schema-api.md) | pending | critical | small |
| 2 | [Cron + Report Logic](phase-02-cron-report.md) | pending | critical | medium |
| 3 | [Frontend Settings UI](phase-03-frontend-settings.md) | pending | high | small |
| 4 | [Cleanup + Testing](phase-04-cleanup-testing.md) | pending | high | small |

## Key Files

### Modify
- `packages/api/src/models/user.ts` — add notification_settings
- `packages/api/src/routes/user-settings.ts` — CRUD notification settings
- `packages/api/src/services/telegram-service.ts` — add per-user report function
- `packages/api/src/index.ts` — replace fixed cron with hourly check
- `packages/shared/types.ts` — add NotificationSettings type
- `packages/web/src/pages/settings.tsx` — notification schedule UI
- `packages/web/src/hooks/use-user-settings.ts` — if exists, add notification hooks

### No Changes
- `packages/api/src/routes/admin.ts` — keep as-is (system bot, manual send)
- `packages/web/src/pages/admin.tsx` — keep as-is

## Dependencies
- Depends on seat ownership (completed) — report_scope 'own' filters by owner_id

## Risk
- Timezone: all schedules use Asia/Ho_Chi_Minh (server-side), no per-user TZ needed
- Hourly granularity sufficient — exact minute not needed
- Users without Telegram bot configured → skip silently
