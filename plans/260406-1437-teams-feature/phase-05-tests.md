---
phase: 5
status: completed
priority: medium
effort: 1h
completedDate: 2026-04-06
---

# Phase 5: Tests

## Overview

Write tests for Team model, middleware changes, and API routes.

## Context Links

- Test setup: `tests/setup.ts` (node env)
- DB helper: `tests/helpers/db-helper.ts`
- Existing API tests: `tests/api/`

## Files to Create

### `tests/api/teams.test.ts`

Test cases:

**Model & Middleware:**
- `getAllowedSeatIds` returns team seats for non-admin member
- `getAllowedSeatIds` deduplicates when seat is in team AND assigned
- `getAllowedSeatIds` unchanged for admin (still returns all)
- Soft-deleted seat auto-removed from team.seat_ids

**API Routes:**
- `GET /api/teams` — returns teams for member, empty for non-member
- `GET /api/teams` — admin sees all teams
- `POST /api/teams` — creates team, owner set to creator
- `POST /api/teams` — non-admin cannot add unowned seats (403)
- `PUT /api/teams/:id` — owner can update
- `PUT /api/teams/:id` — non-owner non-admin gets 403
- `DELETE /api/teams/:id` — owner can delete
- `DELETE /api/teams/:id` — non-owner non-admin gets 403

## Implementation Steps

1. Create `tests/api/teams.test.ts`
2. Use existing db-helper pattern for in-memory MongoDB
3. Run `pnpm vitest run tests/api/teams.test.ts`
4. Ensure all tests pass

## Success Criteria

- [x] All test cases pass (67/67 passed)
- [x] Middleware logic verified
- [x] Permission enforcement verified
- [x] Seat soft-delete cascade verified
- [x] Build passes
- [x] Lint passes
- [x] 2 pre-existing test failures unrelated to Teams feature
