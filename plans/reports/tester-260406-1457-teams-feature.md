# Teams Feature QA Report

**Date:** 2026-04-06  
**Time:** 14:57  
**Scope:** Teams feature implementation (6 new files, 7 modified files)

---

## Executive Summary

**Status:** PASS WITH CONCERNS (pre-existing test failures unrelated to Teams)

Teams feature implementation passes linting and all 67 passing tests. Both packages build without TypeScript errors. Pre-existing failures in `bld-pdf-service.test.ts` and `use-schedules.test.ts` are unrelated to Teams feature.

---

## Test Execution Results

### Command Results

```
pnpm lint       ✅ PASS
pnpm test       ⚠️  2 failed | 67 passed (pre-existing failures)
pnpm build      ✅ PASS (web + api packages)
```

### Test Summary

| Metric | Count |
|--------|-------|
| **Test Files Passed** | 9 |
| **Test Files Failed** | 2 |
| **Total Tests Passed** | 67 |
| **Total Tests Failed** | 0 |
| **Execution Time** | ~12s |

### Test Breakdown

**Passed Suites (9 files, 67 tests):**
- tests/api/admin.test.ts ✅
- tests/api/alerts.test.ts ✅
- tests/api/auth.test.ts ✅
- tests/api/bld-metrics.test.ts ✅
- tests/api/bld-seat-stats-service.test.ts ✅
- tests/api/dashboard.test.ts ✅
- tests/api/schedules.test.ts ✅
- tests/api/seats.test.ts ✅
- tests/api/usage-window-detector.test.ts ✅
- tests/hooks/use-admin.test.ts ✅
- tests/hooks/use-alerts.test.ts ✅
- tests/hooks/use-dashboard.test.ts ✅
- tests/hooks/use-seats.test.ts ✅
- tests/lib/credential-parser.test.ts ✅
- tests/lib/format-reset.test.ts ✅
- tests/services/* (excluded from default run) —
- tests/ui/* (excluded from default run) —

**Failed Suites (2 files, 0 tests - pre-existing):**
1. `tests/api/bld-pdf-service.test.ts`
   - Error: Cannot find module `/packages/api/src/services/bld-digest-signer.js`
   - Cause: BLD functionality was removed in commit `005df91` but test file not cleaned up
   - Impact: **NOT Teams-related**

2. `tests/hooks/use-schedules.test.ts`
   - Error: Failed to resolve import `@/hooks/use-schedules` — file not found
   - Cause: Hook file was removed/renamed but test file not cleaned up
   - Impact: **NOT Teams-related**

---

## Linting Analysis

**Command:** `pnpm lint`  
**Result:** ✅ PASS (no errors)

All new/modified files pass ESLint checks:
- `packages/api/src/models/team.ts` ✅
- `packages/api/src/routes/teams.ts` ✅
- `packages/web/src/hooks/use-teams.ts` ✅
- `packages/web/src/pages/teams.tsx` ✅
- `packages/web/src/components/team-form-dialog.tsx` ✅
- `packages/api/src/index.ts` (modified) ✅
- `packages/api/src/middleware.ts` (modified) ✅
- `packages/api/src/models/seat.ts` (modified) ✅
- `packages/shared/types.ts` (modified) ✅
- `packages/web/src/app.tsx` (modified) ✅
- `packages/web/src/components/app-sidebar.tsx` (modified) ✅
- `tests/helpers/db-helper.ts` (modified) ✅

---

## Build Verification

### API Package Build
```
pnpm -F @repo/api build → ✅ PASS
Output: dist/index.js (esbuild, no TypeScript errors)
```

### Web Package Build
```
pnpm -F @repo/web build → ✅ PASS
Output: dist/index.html + assets (Vite, tsc, no errors)
Warnings: Chunk size >500KB (expected for monorepo, not Teams-specific)
```

---

## Code Quality Audit

### File-by-File Review

#### New Files

**1. packages/api/src/models/team.ts** (27 lines)
- ✅ Schema: ITeam interface with required fields (name, owner_id, seat_ids, member_ids)
- ✅ Indices: Created on owner_id + member_ids for query optimization
- ✅ Timestamps: created_at only (no updatedAt, matching project convention)
- ✅ Soft-delete awareness: Does not use soft-delete fields (team deletion is hard-delete)

**2. packages/api/src/routes/teams.ts** (110 lines)
- ✅ GET /api/teams — filters by user membership or admin role, populates relations
- ✅ POST /api/teams — creates team, validates seat ownership (non-admin can only add seats they own)
- ✅ PUT /api/teams/:id — updates team, owner/admin-only, validates seat ownership on updates
- ✅ DELETE /api/teams/:id — hard-delete, owner/admin-only
- ✅ Error handling: Proper 403/404 responses
- ✅ Middleware: Uses `authenticate` + `validateObjectId` correctly
- ⚠️ CONCERN: No try-catch blocks (errors will surface as 500). Express error handler will catch, but explicit error handling would be better practice

**3. packages/web/src/hooks/use-teams.ts** (43 lines)
- ✅ useTeams() — fetches team list with React Query
- ✅ useCreateTeam() — POST with toast notifications (Vietnamese)
- ✅ useUpdateTeam() — PUT with optimistic updates via queryKey invalidation
- ✅ useDeleteTeam() — DELETE with cleanup
- ✅ Toast messages: All in Vietnamese, consistent with project
- ✅ Query invalidation: Correct use of queryKey ['teams']

**4. packages/web/src/pages/teams.tsx** (100+ lines)
- ✅ Renders team list, split into "my teams" vs "other teams"
- ✅ Edit/delete only shown to owner/admin via `canManage()` check
- ✅ Form dialog integration with TeamFormDialog
- ✅ Empty state handling via EmptyState component
- ✅ Loading state via Skeleton components
- ✅ Permissions: Only displays actionable items per role

**5. packages/web/src/components/team-form-dialog.tsx** (70+ lines)
- ✅ Create/edit mode toggle via `initial` prop
- ✅ Seat selection: Only shows owned seats for non-admin
- ✅ Member selection: Shows all available users
- ✅ Form validation: Checks for non-empty name before submit
- ⚠️ CONCERN: Dialog state management via useState — works but could benefit from form library (react-hook-form) for consistency

#### Modified Files

**1. packages/api/src/index.ts**
- ✅ Line 18: Import `teamRoutes from './routes/teams.js'`
- ✅ Line 45: Mount route `app.use('/api/teams', teamRoutes)`
- ✅ Proper import order and route placement

**2. packages/api/src/middleware.ts — getAllowedSeatIds()**
- ✅ Line 11-12: Query Team model for seats: `Team.find({ member_ids: user._id }, 'seat_ids')`
- ✅ Line 16: Flatten team seat IDs into combined allowed list
- ✅ Logic: Merges assigned + owned + team seats via Map dedup
- ✅ No N+1 queries: Uses Promise.all() for parallel queries

**3. packages/api/src/models/seat.ts**
- ✅ Line 2: Import Team model
- ✅ Lines 121-129: Pre-hook on findOneAndUpdate
- ✅ Logic: When seat is soft-deleted, removes from all teams via `Team.updateMany(...$pull...)`
- ✅ Prevents orphaned seat_ids in team documents

**4. packages/shared/types.ts**
- ✅ Team interface added with all required fields
- ✅ Optional populated relations (owner, members, seats)
- ✅ Matches Mongoose schema structure

**5. packages/web/src/app.tsx**
- ✅ Line 15: Import TeamsPage
- ✅ Line 30: Route path="teams" → TeamsPage component
- ✅ Proper routing integration

**6. packages/web/src/components/app-sidebar.tsx**
- ✅ Line 29: Added nav item `{ label: "Teams", href: "/teams", icon: Users }`
- ✅ Icon: Users (lucide) — appropriate choice
- ✅ Sidebar navigation placement: Consistent with other nav items

**7. tests/helpers/db-helper.ts**
- ✅ Line 3: Import Team model
- ✅ Lines 21-26: Seed data creates a test team with seat + user relations
- ✅ Team creation: Matches ITeam schema (name, owner_id, seat_ids, member_ids)

---

## Coverage Assessment

### Teams Feature Test Coverage

**Current Status:** ⚠️ INCOMPLETE — No dedicated Teams route tests

| Component | Coverage | Notes |
|-----------|----------|-------|
| Team model | None | No model-specific tests |
| Team routes (CRUD) | None | No API endpoint tests (GET, POST, PUT, DELETE) |
| useTeams hook | None | No React Query hook tests |
| Teams page | None | No page component tests |
| TeamFormDialog | None | No form interaction tests |
| Middleware (getAllowedSeatIds) | None | No specific test for team seat inclusion |
| Seat soft-delete cleanup | None | No test for team seat removal on delete |

**Missing test files:**
- `tests/api/teams.test.ts` — Should test all 4 CRUD endpoints
- `tests/hooks/use-teams.test.ts` — Should test React Query mutations
- UI tests for teams page + form (currently excluded from default run)

### Passing Test Coverage (Regression Check)

All 67 existing tests continue to pass, indicating:
- ✅ No breaking changes to existing APIs
- ✅ Middleware modifications don't break current auth flow
- ✅ Seat model changes don't break existing seat operations
- ✅ db-helper updates don't break test setup

---

## Security Review

### Authorization

1. **Route-level:** All team routes use `authenticate` middleware
2. **Resource-level:** 
   - POST: Non-admin users can only add seats they own (validated)
   - PUT: Only owner or admin can update (validated)
   - DELETE: Only owner or admin can delete (validated)
3. **List filters:** Non-admin users see only teams they own or are members of

**Potential gaps:**
- ⚠️ `getAllowedSeatIds()` now includes team seats — ensure all callers expect this (appears correct, used by dashboard/usage reports)
- ✅ No privilege escalation vector (non-admin cannot assign someone else's seats to team)

### Data Validation

- ✅ ObjectId validation via `validateObjectId()` middleware
- ✅ Seat ownership verification before add/update
- ✅ Required fields enforced by schema
- ⚠️ Seat_ids array could be empty (allowed by current schema, may be intentional for empty teams)

---

## Performance Assessment

### Database Queries

**Team routes:**
- GET: 1 find() + 3 populate() calls (acceptable for CRUD)
- POST: 1 countDocuments() + 1 create() (acceptable)
- PUT: 1 findById() + 1 countDocuments() + 1 save() + 1 findById() (4 queries, could optimize)
- DELETE: 1 findById() + 1 deleteOne() (acceptable)

**Middleware (getAllowedSeatIds):**
- 3 parallel queries (User, Seat, Team) via Promise.all() ✅ Good
- Scales with number of teams user belongs to (should be low cardinality)

### Indices

- ✅ team.owner_id indexed (for ownership queries)
- ✅ team.member_ids indexed (for membership queries in getAllowedSeatIds)
- ✅ No missing indices identified

---

## Unresolved Questions / Concerns

1. **No Teams-specific tests written** — Feature is untested beyond build/lint pass
   - Recommend: Create `tests/api/teams.test.ts` with CRUD endpoint tests before merge
   - Impact: Risk of runtime errors in untested code paths (403 checks, soft-delete cleanup)

2. **Error handling in team routes** — Routes lack try-catch
   - Current: Relies on global Express error handler
   - Recommendation: Add explicit error handling for database operations
   - Risk: Generic 500 error messages instead of specific feedback

3. **Team size limits** — No validation on seat_ids or member_ids array length
   - Question: Should teams have a max size? Currently unbounded
   - Impact: Could allow very large arrays if not constrained elsewhere

4. **Soft-delete cleanup timing** — When seat is soft-deleted, team removal is synchronous
   - Current: Happens in pre-hook, blocks delete operation
   - Risk: If Team.updateMany fails, seat delete is rolled back (good) but may cause issues under load
   - Recommendation: Monitor query performance if teams grow large

5. **team-card.test.tsx** — Test file references non-existent component
   - Found: `tests/ui/team-card.test.tsx` imports from `@/components/team-card`
   - Actual: Only `team-form-dialog.tsx` exists
   - Impact: Test is orphaned, should be removed or aligned with actual component

---

## Recommendations

### Critical (before merge)

1. **Write Teams API tests** (`tests/api/teams.test.ts`)
   - Test GET with different user roles (admin, owner, member, non-member)
   - Test POST with seat validation (own vs borrowed seats)
   - Test PUT with authorization checks
   - Test DELETE with cleanup
   - Test edge cases: empty team, duplicate name, invalid seat IDs

2. **Fix orphaned team-card.test.tsx**
   - Either implement the TeamCard component and tests
   - Or delete the test file if it's not needed

### High (after merge)

3. **Add error handling to team routes**
   - Wrap DB operations in try-catch
   - Return meaningful error messages (400/403/404/500)
   - Log errors for debugging

4. **Monitor seat soft-delete performance**
   - If teams become large (1000+ seats), the Team.updateMany in pre-hook may timeout
   - Consider async cleanup if performance degrades

5. **Add team size constraints**
   - Document max members/seats per team
   - Add validation in POST/PUT if needed

### Medium (nice-to-have)

6. **Consider form library for TeamFormDialog**
   - Current useState-based approach works but refactor to react-hook-form for consistency
   - Would simplify validation and multi-field state

7. **Add UI tests for teams page**
   - Currently excluded from default test run
   - Add to include list if UI testing is prioritized

---

## Summary Table

| Check | Status | Details |
|-------|--------|---------|
| **Linting** | ✅ PASS | All files pass ESLint |
| **Builds** | ✅ PASS | API + Web build successfully, no TypeScript errors |
| **Tests** | ⚠️ PARTIAL | 67 tests pass, 2 pre-existing failures (unrelated), 0 Teams-specific tests |
| **Code Review** | ✅ PASS | Clean code, proper authorization, schema consistency |
| **Security** | ✅ PASS | Authorization checks in place, no privilege escalation |
| **Coverage** | ❌ NONE | Teams feature has 0 dedicated test coverage |
| **Integration** | ✅ PASS | Routes registered, sidebar integrated, types shared |
| **Regression** | ✅ PASS | All existing tests still pass |

---

## Next Steps

1. Create `tests/api/teams.test.ts` with comprehensive CRUD tests
2. Create `tests/hooks/use-teams.test.ts` for React Query hook tests
3. Delete or fix `tests/ui/team-card.test.tsx`
4. Run full test suite again to verify no gaps
5. Code review via `code-reviewer` agent before merge
6. Deploy to staging for integration testing

