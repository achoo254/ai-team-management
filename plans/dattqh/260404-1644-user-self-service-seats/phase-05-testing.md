# Phase 5: Testing

## Overview
- **Priority:** High
- **Status:** Completed
- **Effort:** Small

Verify all permission combinations work correctly. Run existing tests + add targeted tests for ownership logic.

## Related Files
- Existing test files in `packages/api/src/__tests__/` (if any)
- `packages/api/src/middleware.ts` — test new middleware

## Implementation Steps

### 5.1 Test permission matrix

Manual or automated verification of all combinations:

| Route | Admin | Owner | Non-owner user | Unauthenticated |
|-------|-------|-------|----------------|-----------------|
| POST /seats | 201 | — | 201 (new owner) | 401 |
| PUT /seats/:id | 200 | 200 | 403 | 401 |
| DELETE /seats/:id | 200 | 200 | 403 | 401 |
| PUT /seats/:id/token | 200 | 200 | 403 | 401 |
| DELETE /seats/:id/token | 200 | 200 | 403 | 401 |
| POST /seats/:id/assign | 200 | 200 | 403 | 401 |
| DELETE /seats/:id/unassign | 200 | 200 | 403 | 401 |
| GET /seats/:id/credentials/export | 200 | 200 | 403 | 401 |
| PUT /seats/:id/transfer | 200 | 403 | 403 | 401 |
| GET /seats/credentials/export | 200 | 403 | 403 | 401 |

### 5.2 Test migration script

- Run on DB with existing seats → all get admin owner_id
- Run again (idempotent) → no changes
- Create new seat via API → owner_id set correctly

### 5.3 Test edge cases

- Owner deletes own seat → cascade cleanup (unassign users, delete schedules)
- Transfer ownership → old owner loses access, new owner gains access
- Seat with null owner_id → only admin can manage (backward compat)
- Create seat with duplicate email → 409 conflict

### 5.4 Compile & lint check

```bash
pnpm build
pnpm lint
pnpm test
```

## Todo
- [x] Test all permission combinations
- [x] Test migration idempotency
- [x] Test edge cases
- [x] Run build + lint + existing tests
- [x] Fix any regressions

## Success Criteria
- All permission checks return expected status codes
- No regressions in existing functionality
- Build passes cleanly
- Migration tested on staging before production
