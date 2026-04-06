---
status: completed
created: 2026-04-06
completed: 2026-04-06
branch: feat/teams
blockedBy: []
blocks: []
---

# Teams Feature — Seat Group Visibility

## Summary

Add Team model to group seats for shared view access. Users belonging to a team auto-see all team seats without individual `seat_ids` assignment.

**Brainstorm:** `plans/reports/brainstorm-260406-1437-teams-feature-design.md`

## Phases

| # | Phase | Status | Effort | Files |
|---|-------|--------|--------|-------|
| 1 | Backend: Model + Middleware | completed | 1h | 3 new + 1 edit |
| 2 | Backend: API Routes | completed | 1.5h | 1 new + 1 edit |
| 3 | Shared Types | completed | 0.5h | 1 edit |
| 4 | Frontend: Hook + UI | completed | 2h | 2-3 new + 1 edit |
| 5 | Tests | completed | 1h | 1-2 new |

## Key Decisions

- Team = view-only grouping; alerts/schedule still require `seat_ids`
- `getAllowedSeatIds()` merges team seats into existing logic
- Seat soft-delete auto-removes from teams via Mongoose middleware
- Admin sees all teams; non-admin sees teams they own or belong to
- Seat owner can only add owned seats; admin can add any

## Dependencies

- No external dependencies needed
- Uses existing Mongoose, Express patterns
