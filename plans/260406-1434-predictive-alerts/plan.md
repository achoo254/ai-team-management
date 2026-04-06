---
status: complete
slug: predictive-alerts
created: 2026-04-06
blockedBy: []
blocks: []
---

# Predictive Alerts (Burndown 5h + Slowdown 7d)

## Summary

Add 2 predictive alert types: `fast_burn` (5h velocity+ETA) and `quota_forecast` (7d linear projection). User-configurable with smart defaults.

## Brainstorm

[Brainstorm Report](../reports/brainstorm-260406-1434-predictive-alerts.md)

## Phases

| # | Phase | Priority | Effort | Status |
|---|-------|----------|--------|--------|
| 1 | [Backend Models & Types](phase-01-backend-models-types.md) | High | S | Complete |
| 2 | [Alert Service Logic](phase-02-alert-service-logic.md) | High | M | Complete |
| 3 | [API Routes](phase-03-api-routes.md) | Medium | S | Complete |
| 4 | [Frontend UI](phase-04-frontend-ui.md) | Medium | M | Complete |
| 5 | [Tests](phase-05-tests.md) | High | M | Complete |

## Key Decisions

- `fast_burn` dedup: 4h (not 24h) — 5h cycle too short for 24h dedup
- Reuse `forecastSeatQuota()` for 7d prediction — no new forecast logic
- New fields in IWatchedSeat are optional with defaults — zero migration needed
- `null` value = alert type disabled (opt-out)
