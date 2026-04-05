---
name: Remove Teams + Dashboard Enrichment
status: completed
created: 2026-04-04
completed: 2026-04-05
branch: main
phases: 5
blockedBy: []
blocks: []
---

# Remove Teams + Dashboard Enrichment

## Context
- [Brainstorm: Dashboard Enrichment](../reports/brainstorm-260404-2348-dashboard-enrichment.md)
- [Brainstorm: Remove Teams](../reports/brainstorm-260405-0000-remove-teams-decision.md)
- < 5 seats → Teams is YAGNI, purely organizational grouping with no core logic dependency
- Dashboard needs: token health, owner/member distinction, personal user context

## Problem
1. **Teams is over-engineering** — grouping 3-4 seats via a full entity with CRUD, members, routes (17 files, ~1,265 lines)
2. **Dashboard lacks info** — no token health, no owner/member distinction, no personal context for users
3. **Dual-referencing** User.seat_ids vs Seat.owner_id — intentional (different semantics), dashboard should expose both

## Solution
- **Remove Teams entirely** — drop model, routes, DB collection, clean references
- **Enrich dashboard** — add token health badge, owner info, personal context endpoint
- **Simplify data model** — remove team_ids from User, team_id from Seat, team_ids from JWT

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Backend: Remove Teams](./phase-01-backend-remove-teams.md) | completed | M |
| 2 | [Backend: Dashboard API Enrichment](./phase-02-backend-dashboard-api.md) | completed | M |
| 3 | [Frontend: Remove Teams](./phase-03-frontend-remove-teams.md) | completed | M |
| 4 | [Frontend: Adaptive Dashboard UI](./phase-04-frontend-dashboard-ui.md) | completed | M |
| 5 | [Testing](./phase-05-testing.md) | completed | S |

## Key Decisions
- Remove Teams first (phase 1+3), then enrich dashboard (phase 2+4)
- Backend phases before frontend (API contract must be stable)
- Token health = badge count only (detail already on /seats page)
- New /personal endpoint for user-specific context (keeps /enhanced lean)
- DB migration via script (drop collection, unset fields)

## Risk
- JWT payload change (remove team_ids) — low risk, no client depends on it
- Dashboard team stats widget removed — replaced by richer per-seat data
- /enhanced response contract changes (removes teamUsage) — frontend updated in same PR
