# Test Execution Report: Seat Owner Authorization Features

**Date:** 2026-04-04  
**Time:** 17:02 UTC+7  
**Scope:** Seat ownership & per-seat authorization changes

---

## Executive Summary

Test suite executed with **3 critical failures** preventing merge. Issues stem from **missing hook exports** in test files (importing non-existent functions) and **URL parameter format mismatch** in API client.

All failures are in **frontend hook tests** (use-dashboard, use-schedules). **No backend route tests exist** for new `requireSeatOwnerOrAdmin` middleware or per-seat credential endpoints.

---

## Test Results Overview

| Metric | Value |
|--------|-------|
| **Total Test Files** | 7 |
| **Total Tests** | 28 |
| **Passed** | 25 (89.3%) |
| **Failed** | 3 (10.7%) |
| **Skipped** | 0 |
| **Execution Time** | 5.44s |

---

## Failed Tests (Critical)

### 1. `use-dashboard.test.ts` — useUsageBySeat Hook

**Error:** `TypeError: useUsageBySeat is not a function`

```
File: tests/hooks/use-dashboard.test.ts:77
Code: const { result } = renderHook(() => useUsageBySeat(), { wrapper })

Import: import { useDashboardEnhanced, useUsageBySeat } from "@/hooks/use-dashboard"
```

**Root Cause:** Hook `useUsageBySeat` is **not exported** from `packages/web/src/hooks/use-dashboard.ts`

**Current exports from use-dashboard.ts:**
- `useEfficiency()`
- `useDashboardEnhanced()`

**Missing:** `useUsageBySeat()` — test file expects this function but it doesn't exist in codebase.

---

### 2. `use-schedules.test.ts` — useAssignSchedule Hook

**Error:** `TypeError: useAssignSchedule is not a function`

```
File: tests/hooks/use-schedules.test.ts:57
Code: const { result } = renderHook(() => useAssignSchedule(), { wrapper })

Import: import { useSchedules, useAssignSchedule, useDeleteEntry } from "@/hooks/use-schedules"
```

**Root Cause:** Hook `useAssignSchedule` is **not exported** from `packages/web/src/hooks/use-schedules.ts`

**Current exports from use-schedules.ts:**
- `useSchedules()`
- `useSeatsWithUsers()`
- `useCreateScheduleEntry()`
- `useUpdateScheduleEntry()`
- `useDeleteEntry()`
- `useSwapSchedule()`
- `useClearAll()`

**Missing:** `useAssignSchedule()` — test imports non-existent hook.

---

### 3. `use-schedules.test.ts` — useDeleteEntry URL Format

**Error:** `AssertionError: expected "fetch" to be called with arguments`

```
File: tests/hooks/use-schedules.test.ts:88
Code: expect(fetchSpy).toHaveBeenCalledWith(
  "/api/schedules/entry",
  expect.objectContaining({ method: "DELETE" })
)

Actual call received:
["/api/schedules/entry/[object Object]", { method: "DELETE" }]
```

**Root Cause:** Test passes object `{ seatId, dayOfWeek, slot }` to mutation, but `useDeleteEntry` expects string ID.

**Current implementation (use-schedules.ts:80):**
```typescript
export function useDeleteEntry() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/schedules/entry/${id}`),
    // ...
  })
}
```

**Test sends:** `result.current.mutate({ seatId: "seat-1", dayOfWeek: 1, slot: "morning" })`  
**Expected:** `result.current.mutate("entry-id")`

The object gets stringified to `[object Object]` in the URL path.

---

## Coverage Analysis

**Coverage tool unavailable:** `@vitest/coverage-v8` not installed (dependency missing)

### Untested Code Paths

**Backend (NEW):**
- ✅ `requireSeatOwnerOrAdmin()` middleware — **NO TESTS**
- ✅ `GET /api/seats/:id/credentials/export` (owner-or-admin) — **NO TESTS**
- ✅ `POST /api/seats/:id/transfer` (owner-or-admin) — **NO TESTS**
- ✅ Seat model `owner_id` field — **NO TESTS**
- ✅ All 6 routes with new owner-or-admin check — **NO TESTS**

**Frontend (NEW):**
- Owner badges & UI elements — **NO TESTS**
- Per-seat export button — **NO TESTS**
- Seat transfer UI flow — **NO TESTS**

**Critical Gap:** New authorization layer has **zero backend test coverage**. Frontend tests are broken, preventing any coverage measurement.

---

## Build & Lint Status

✅ **Build:** PASSED (no syntax errors)  
✅ **Lint:** PASSED (no style violations)  
❌ **Tests:** FAILED (3 blocking issues)

---

## Error Scenario Testing

**What's NOT tested:**
1. Unauthorized user attempting to export seat credentials → should return 403
2. Non-owner user calling `requireSeatOwnerOrAdmin` → should return 403
3. Seat not found in owner check → should return 404
4. Admin user can access any seat endpoint → not verified
5. Owner user can only access own seat → not verified
6. Concurrent seat transfer requests → no tests
7. Invalid ObjectId in seat routes → partially tested by `validateObjectId`

---

## Performance Metrics

| Test Suite | Duration |
|-----------|----------|
| use-dashboard.test.ts | 156ms |
| use-schedules.test.ts | 245ms |
| Other test files | ~5s total |
| **Total** | **5.44s** |

No performance issues detected. Tests execute quickly (all <300ms individually).

---

## Critical Issues

### 🔴 BLOCKING: Missing Hook Exports

Two test files import hooks that don't exist in source code:

1. `useUsageBySeat` — test expects this, doesn't exist in use-dashboard.ts
2. `useAssignSchedule` — test expects this, doesn't exist in use-schedules.ts

**Impact:** Cannot merge code until hooks are either:
- **Option A:** Added to source files (implement missing features)
- **Option B:** Tests removed/updated to match actual exports

---

### 🔴 BLOCKING: URL Parameter Format Mismatch

`useDeleteEntry` mutation signature doesn't match test expectations:

- Test calls: `.mutate({ seatId, dayOfWeek, slot })`
- Implementation expects: `.mutate(id: string)`

**Impact:** Runtime error when users try to delete schedule entries.

---

### 🟡 CRITICAL: Zero Authorization Testing

New middleware & protected routes have **no backend tests**:

- `requireSeatOwnerOrAdmin()` — authorization logic untested
- Seat ownership checks — untested
- Credential export endpoints — untested
- All 6 modified routes — untested

**Risk:** New authorization layer could have gaps (e.g., edge case where admin check fails, or owner comparison broken).

---

## Recommendations

### Immediate (Before Merge)

1. **Fix missing hook exports** (5 min)
   - Either implement `useUsageBySeat()` in use-dashboard.ts
   - Or remove from test imports if not intended for this PR

2. **Fix useDeleteEntry signature** (10 min)
   - Update test to pass string ID: `.mutate("entry-id")`
   - OR update implementation to accept object and extract ID

3. **Install coverage tool** (2 min)
   - `pnpm add -D @vitest/coverage-v8`
   - Re-run coverage scan

4. **Re-run full test suite** (5 min)
   - Ensure all 28 tests pass
   - Capture coverage metrics

### Short-term (This Sprint)

5. **Add backend authorization tests** (45 min - Critical)
   - Test `requireSeatOwnerOrAdmin()` with admin user → should pass
   - Test `requireSeatOwnerOrAdmin()` with non-admin owner → should pass
   - Test `requireSeatOwnerOrAdmin()` with non-owner → should return 403
   - Test seat not found → should return 404
   - Test all 6 modified routes with owner/non-owner users

6. **Add credential export endpoint tests** (30 min)
   - Single seat export (owner) → should work
   - Single seat export (non-owner) → should return 403
   - Single seat export (admin) → should work
   - Missing credential → should return 404

7. **Add frontend integration tests** (60 min)
   - Owner badge rendering
   - Per-seat export button click flow
   - Transfer modal interaction
   - Unauthorized state UI

### Medium-term (Next Sprint)

8. **Implement missing hooks** (if applicable)
   - Define `useUsageBySeat()` behavior & API contract
   - Document in types.ts
   - Add tests once implemented

9. **Coverage gate enforcement**
   - Configure Jest to reject merges <80% coverage
   - Highlight critical paths (auth, financial features)

10. **Test isolation audit**
    - Verify no test interdependencies
    - Ensure parallel execution doesn't break tests

---

## Unresolved Questions

1. **Is `useUsageBySeat()` intended for this PR?** (Should it be implemented or test removed?)
2. **Should `useAssignSchedule()` exist or is test outdated?** (Seems related to schedule creation, clarify API contract)
3. **What's the expected parameter format for `useDeleteEntry()`?** (String ID vs object with metadata?)
4. **Are there backend integration tests elsewhere?** (Check if API tests exist outside Vitest)
5. **Coverage threshold policy?** (Is 80% a target, or different for different files?)

---

## Summary for Lead

**Status:** 🔴 BLOCKED — Cannot merge until 3 test failures resolved

**Why blocked:**
- Missing hook exports prevent test execution
- Authorization layer completely untested in backend
- API signature mismatch in schedule deletion

**Next steps:**
1. Clarify which hooks should exist (useUsageBySeat, useAssignSchedule)
2. Fix useDeleteEntry parameter mismatch
3. Add 45+ min of backend authorization tests
4. Re-run suite and confirm 28/28 pass

**Token estimate:** 45 min to fix + test, 60 min if new hooks need implementation

---

**Report generated:** 2026-04-04 17:02 UTC+7
