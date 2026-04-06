# Test Report: Predictive Alerts Feature

**Date:** 2026-04-06  
**Time:** 15:38:34  
**Feature:** Predictive alerts (fast_burn, quota_forecast alert types)

## Test Results Summary

✅ **All Tests Passed**
- Test Files: 9 passed
- Total Tests: 67 passed (0 failed, 0 skipped)
- Build: SUCCESS (no errors)
- Duration: 3.86s

## Diff-Aware Analysis

**Changed Source Files (8 files):**
- `packages/api/src/models/alert.ts` — alert model schema updates
- `packages/api/src/models/user.ts` — user model: watched_seats field expansion
- `packages/api/src/routes/watched-seats.ts` — API route changes
- `packages/api/src/services/alert-service.ts` — alert service enhancements
- `packages/shared/types.ts` — shared type definitions
- `packages/web/src/components/watch-seat-button.tsx` — frontend component
- `packages/web/src/components/watch-threshold-dialog.tsx` — frontend component
- `packages/web/src/hooks/use-watched-seats.ts` — React hook

**New File:**
- `packages/api/src/services/predictive-alert-service.ts` — 127 LOC, two exported functions

## Coverage Analysis

**Overall Metrics:**
- Statements: 35.5%
- Branches: 34.7%
- Functions: 33.75%
- Lines: 38.15%

**Critical Gaps:**

| File | Coverage | Status | Issue |
|------|----------|--------|-------|
| `predictive-alert-service.ts` | **0%** | 🚨 **NO TESTS** | Two core functions untested: `checkFastBurnAlerts`, `checkQuotaForecastAlerts` |
| `alert-service.ts` | 8.08% | 🔴 Critical | 194 lines uncovered (48-241, 262-412) |
| `use-dashboard.ts` | 29.72% | 🟡 Low | 70% untested logic paths |
| `use-seats.ts` | 26.78% | 🟡 Low | 73% untested logic paths |
| `use-admin.ts` | 51.61% | 🟡 Low | Error paths untested |

**Excellent Coverage (100%):**
- `use-auth.ts` ✅
- `format-reset.ts` ✅
- `usage-snapshot.ts` ✅
- `credential-parser.ts` ✅

## Issues & Blockers

### 1. **CRITICAL: No Tests for New Predictive Alert Service**
- **File:** `packages/api/src/services/predictive-alert-service.ts`
- **Scope:** 127 lines of logic with zero coverage
- **Functions:** 
  - `checkFastBurnAlerts()` — complex velocity/ETA calculations, Vietnamese localization
  - `checkQuotaForecastAlerts()` — forecast logic integration, threshold comparison
- **Concern:** These functions directly control alert creation. Missing tests risk:
  - Silent calculation errors (velocity/ETA edge cases)
  - Vietnamese message formatting issues (minutes vs hours)
  - Null/undefined handling in watched_seats filters
  - Dedup logic correctness

### 2. **LOW: Alert Service Coverage Remains Poor**
- `alert-service.ts` only 8% covered despite being modified
- Large chunks of alert creation/dedup logic untested (lines 48-241, 262-412)
- New `watched_seats` field expansion not validated in tests

### 3. **LOW: Frontend Component Tests Missing**
- `watch-seat-button.tsx`, `watch-threshold-dialog.tsx`, `watched-seats-summary.tsx` — no tests found
- These UI components implement new predictive alert thresholds but are not tested

### 4. **LOW: Hook Tests Incomplete**
- `use-watched-seats.ts` — no test file found
- New hook for managing watched seats + thresholds untested

## Recommendations

### Priority 1 (MUST FIX)
1. **Create `tests/api/predictive-alert-service.test.ts`** with tests for:
   - `checkFastBurnAlerts()`: test velocity calculation, ETA logic, threshold filters, dedup behavior
   - `checkQuotaForecastAlerts()`: test forecast integration, threshold crossing, time-based triggers
   - Edge cases: null thresholds (disabled), 0% usage, past-threshold seats, malformed watched_seats

### Priority 2 (STRONGLY RECOMMENDED)
2. Create `tests/services/alert-service.test.ts` to cover alert creation paths (currently 8%)
3. Create test files for frontend components:
   - `tests/ui/watch-seat-button.test.tsx`
   - `tests/ui/watch-threshold-dialog.test.tsx`
4. Create `tests/hooks/use-watched-seats.test.ts`

### Priority 3 (HELPFUL)
5. Expand coverage in `use-dashboard.ts` and `use-seats.ts` (both ~27-30% coverage)

## Build Status

✅ **Production Build:** SUCCESS
```
- API: dist/index.js (with TypeScript check)
- Web: dist/ (Vite minified, 1.27MB gzipped)
⚠️  Web chunk warning (1.26MB > 500KB) — consider code-splitting but not blocking
```

## Test Execution Details

```
Environment: vitest v4.1.2
Test files included:
  - tests/hooks/**/*.test.{ts,tsx}
  - tests/lib/**/*.test.{ts,tsx}
  - tests/api/usage-window-detector.test.ts
  - tests/api/bld-metrics.test.ts

Excluded from run: tests/ui/*, tests/services/*
(Must be opted in via // @vitest-environment jsdom)
```

## Unresolved Questions

1. **Is `predictive-alert-service.ts` tested elsewhere?** — Grep shows no tests. Confirm if intentional.
2. **What triggers alert creation in production?** — Likely a cron job. Are integration tests for alert creation pipeline planned?
3. **Are watched_seats validation rules documented?** — Null thresholds mean "disabled" but this is implicit in code.

## Summary

Tests pass, build succeeds, but **critical coverage gap** exists: the new predictive alert service (127 LOC) has 0% test coverage. This is the main deliverable of the feature and must be tested before production deployment. Recommend creating comprehensive unit tests for both `checkFastBurnAlerts()` and `checkQuotaForecastAlerts()` covering happy paths, error cases, and Vietnamese localization.

**Status:** DONE_WITH_CONCERNS  
**Concern:** Zero coverage on new predictive alert service functions requires immediate test development before merge.
