---
status: in_progress
created: 2026-03-22
brainstorm: plans/reports/brainstorm-260322-2227-redesign-usage-tracking.md
---

# Redesign Usage Tracking

Redesign usage_logs to match actual Claude data (weekly percentages only) + add Telegram weekly report.

## Context
- Claude provides: weekly_all_pct, weekly_sonnet_pct (no sessions, no tokens, no API)
- Manual entry only — user logs 1x/week
- Alert: weekly_all_pct > 80%
- Telegram bot: Friday 17h summary report

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | DB + Backend: redesign schema, routes, services | done | [phase-01](phase-01-db-backend-redesign.md) |
| 2 | Frontend: redesign log form + dashboard | done | [phase-02](phase-02-frontend-redesign.md) |
| 3 | Telegram bot: weekly report cron | done | [phase-03](phase-03-telegram-bot.md) |

## Dependencies
- Phase 2 depends on Phase 1
- Phase 3 independent (can run parallel with Phase 2)

## Files to Modify
- `server/db/migrations.js` — usage_logs schema
- `server/config.js` — alert thresholds + telegram config
- `server/services/usage-sync-service.js` — rewrite logUsage, remove importCsv
- `server/services/alert-service.js` — rewrite to % based
- `server/routes/usage-log-routes.js` — update endpoints
- `server/routes/dashboard-routes.js` — update queries
- `server/routes/admin-routes.js` — remove CSV import
- `server/index.js` — add telegram cron
- `public/views/view-log-usage.html` — redesign form
- `public/views/view-dashboard.html` — redesign stats
- `public/js/dashboard-app.js` — update state/methods
- `public/js/dashboard-helpers.js` — update helpers
- `.env.example` — add telegram vars

## New Files
- `server/services/telegram-service.js` — send weekly report
