---
name: Schedule Seat-based Permissions
status: completed
created: 2026-04-04
completed: 2026-04-04
branch: main
phases: 3
blockedBy: []
blocks: []
---

# Schedule Seat-based Permissions

## Context
- [Brainstorm Report](../reports/brainstorm-260404-2036-schedule-seat-permissions.md)
- Builds on completed [User Self-Service Seats](../260404-1644-user-self-service-seats/plan.md) (added `owner_id` to Seat)
- Builds on completed [Schedule Redesign](../260404-1250-schedule-usage-bot-redesign/plan.md) (hourly schedule model)

## Problem
Schedule permissions currently check only `isAdmin || entry.user_id === currentUser._id`. No seat ownership concept — any user can potentially manipulate any seat's schedule. UI gates everything behind `isAdmin`, leaving non-admin users unable to manage their own entries.

## Solution
Shared pure permission function in `packages/shared/` used by both API (enforce) and UI (conditional render). Three roles: Admin (full), Seat Owner (full within seat + swap), Member (self-only CRUD within assigned seats).

## Permission Matrix

| Action | Admin | Seat Owner | Member | Non-member |
|--------|-------|------------|--------|------------|
| View | All seats | Own/assigned | Assigned | Hidden |
| Create | Anyone | Any member in seat | Self only | No |
| Edit/Delete | All | All in own seat | Own entries | No |
| Swap | All | Within own seat | No | No |
| Clear All | Yes | No | No | No |

## Phases

| # | Phase | Status | Key Files |
|---|-------|--------|-----------|
| 1 | [Shared Permission Function](phase-01-shared-permission-function.md) | completed | `packages/shared/types.ts`, `packages/shared/schedule-permissions.ts` |
| 2 | [API Permission Enforcement](phase-02-api-permission-enforcement.md) | completed | `packages/api/src/routes/schedules.ts` |
| 3 | [UI Permission Integration](phase-03-ui-permission-integration.md) | completed | `packages/web/src/hooks/use-schedules.ts`, `packages/web/src/pages/schedule.tsx`, `packages/web/src/components/schedule-grid.tsx`, `packages/web/src/components/schedule-cell.tsx`, `packages/web/src/components/day-tab-view.tsx` |

## Dependencies
- Phase 2 depends on Phase 1 (shared function)
- Phase 3 depends on Phase 1 (shared types + function)
- Phase 2 and 3 are independent of each other (API vs UI)
