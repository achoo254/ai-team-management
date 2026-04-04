---
name: Refactor Alert Settings to User Settings
status: complete
created: 2026-04-04
completed: 2026-04-04
branch: main
phases: 4
blockedBy: []
blocks: []
---

# Refactor Alert Settings → User Settings

## Context
- [Brainstorm Report](../reports/brainstorm-260404-1754-refactor-alert-to-user-settings.md)

## Problem
Alert settings (thresholds + telegram bot) centralized in Admin page with system bot. Need per-user alert config: each user sets own thresholds, subscribes to specific seats, receives alerts via personal bot only.

## Solution
1. Add `alert_settings` to User model (enabled, thresholds, subscribed_seat_ids)
2. Remove Setting model (telegram + alert fields) entirely
3. Remove system bot — alerts only via user's personal bot
4. Refactor alert-service to loop subscribed users per seat with per-user thresholds
5. New `AlertSettingsForm` component in Settings page
6. Clean up Admin page (remove alert/telegram sections)

## Phases

| # | Phase | Status | Key Files |
|---|-------|--------|-----------|
| 1 | [Schema & Types](phase-01-schema-and-types.md) | complete | user.ts, setting.ts, types.ts |
| 2 | [API & Service Refactor](phase-02-api-and-service-refactor.md) | complete | user-settings.ts, alert-service.ts, telegram-service.ts, settings.ts, admin.ts, index.ts |
| 3 | [Frontend: Alert Settings Form](phase-03-frontend-alert-settings.md) | complete | alert-settings-form.tsx, settings.tsx, use-user-settings.ts |
| 4 | [Frontend: Admin Cleanup](phase-04-admin-cleanup.md) | complete | admin.tsx, use-admin.ts |

## Dependencies
- Requires: per-user notification schedule (completed)
- Requires: seat ownership (completed)
