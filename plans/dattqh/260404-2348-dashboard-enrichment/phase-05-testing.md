# Phase 5: Testing

## Overview
- **Priority:** Medium
- **Status:** completed
- **Effort:** S (small)
- **Completed:** 2026-04-05
- **Depends on:** Phase 1-4

## Test Cases

### API Tests
1. /enhanced — no team references in response (teamUsage removed, no team_id in per-seat)
2. /enhanced — tokenIssueCount, fullSeatCount present as numbers
3. /enhanced — owner_name present in usagePerSeat items
4. /personal — returns mySchedulesToday, mySeats, myUsageRank
5. /personal — scoped to requesting user only
6. Existing endpoints — no regression (seats CRUD without team_id)

### UI Tests
1. Stat overview: token badge renders for admin, hidden for user
2. Detail table: no Team column, owner_name displayed
3. Personal context: renders for non-admin, hidden for admin
4. Navigation: no Teams link in sidebar

### Build Tests
1. `pnpm -F @repo/api build` passes
2. `pnpm -F @repo/web build` passes
3. `pnpm test` — all existing tests pass (update team-related test fixtures)

## Todo List
- [x] API tests for /enhanced new shape
- [x] API tests for /personal endpoint
- [x] UI tests for dashboard changes
- [x] Update/remove existing team-related tests
- [x] Full build passes
- [x] Full test suite passes

## Success Criteria
- Zero team references across entire codebase
- All new API fields tested
- No regression in existing functionality
