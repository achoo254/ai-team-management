---
name: Schedule + Usage Budget Alert + Bot Config Redesign
status: done
created: 2026-04-04
branch: main
phases: 3
blockedBy: []
blocks: []
---

# Schedule + Usage Budget Alert + Bot Config Redesign

## Context
- [Brainstorm Report](../reports/brainstorm-260404-1237-schedule-usage-bot-redesign.md)

## Problem
1. Schedule only supports morning/afternoon slots — inflexible for hourly allocation
2. No per-user usage budget tracking — one user can consume all capacity, affecting others
3. Telegram notifications only via single system bot — users can't receive personal alerts

## Solution
1. Redesign Schedule model: `slot` → `start_hour/end_hour` + `usage_budget_pct`; users self-arrange
2. Delta tracking via existing UsageSnapshot: detect when user exceeds budget → alert + block UI → auto-unblock when next user's slot starts
3. Per-user Telegram bot config with fallback to system bot

## Phases

| # | Phase | Status | Key Files |
|---|-------|--------|-----------|
| 1 | [Hourly Schedule Redesign](phase-01-hourly-schedule-redesign.md) | done | schedule.ts, schedules.ts, types.ts, use-schedules.ts, schedule.tsx, schedule-grid.tsx, schedule-cell.tsx |
| 2 | [Usage Budget Alert + Block](phase-02-usage-budget-alert-block.md) | done | alert-service.ts, alert.ts, types.ts, telegram-service.ts, index.ts, dashboard components |
| 3 | [Per-user Bot Config](phase-03-per-user-bot-config.md) | done | user.ts, telegram-service.ts, types.ts, new settings UI components |

## Dependencies
- Phase 2 depends on Phase 1 (needs schedule with `usage_budget_pct` + hourly slots)
- Phase 3 is independent (can be done in parallel with Phase 2)
