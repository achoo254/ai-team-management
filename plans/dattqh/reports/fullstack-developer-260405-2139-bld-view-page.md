# Phase 2 Implementation Report — BLD View Page

## Phase
- Phase: phase-02-bld-view-page
- Plan: plans/dattqh/260405-2109-enterprise-bld-dashboard/
- Status: completed

## Files Created
| File | Lines |
|---|---|
| `packages/api/src/services/bld-metrics-service.ts` | 195 |
| `packages/api/src/routes/bld-metrics.ts` | 90 |
| `packages/web/src/hooks/use-bld-metrics.ts` | 32 |
| `packages/web/src/pages/bld.tsx` | 92 |
| `packages/web/src/components/bld-fleet-kpi-cards.tsx` | 92 |
| `packages/web/src/components/bld-ww-comparison-chart.tsx` | 85 |
| `packages/web/src/components/bld-user-efficiency-panel.tsx` | 72 |
| `packages/web/src/components/bld-actions-panel.tsx` | 125 |
| `tests/api/bld-metrics.test.ts` | 165 |

## Files Modified
| File | Change |
|---|---|
| `packages/shared/types.ts` | Added BLD DTOs: FleetKpis, WwHistoryPoint, FleetKpisResponse, UserEfficiencyEntry, UserEfficiencyResponse, RebalanceSuggestion (union), BldWorstForecast |
| `packages/api/src/index.ts` | Mounted `/api/bld` router |
| `packages/web/src/app.tsx` | Added `/bld` route + BldPage import |
| `packages/web/src/components/app-sidebar.tsx` | Added "BLD View" nav item (adminOnly, BarChart3 icon) |
| `vitest.config.ts` | Added `tests/api/bld-metrics.test.ts` to include list |

## Tasks Completed
- [x] Backend: bld-metrics-service.ts (computeFleetKpis, computeWwHistory)
- [x] Backend: computeUserEfficiency
- [x] Backend: computeRebalanceSuggestions (Rule 1 move_user, Rule 2 add_seat, Rule 3 reassign_user)
- [x] Backend: bld-metrics routes with requireAdmin
- [x] Backend: in-memory cache 5min TTL
- [x] Shared types: FleetKpis, UserEfficiency, RebalanceSuggestion
- [x] Frontend: page `/bld` + admin guard redirect
- [x] Frontend: hook use-bld-metrics (3 queries, 5-min staleTime)
- [x] Frontend: bld-fleet-kpi-cards (4 cards, color-coded util, W/W delta, worst forecast)
- [x] Frontend: bld-ww-comparison-chart (Recharts AreaChart, 8 weeks, dual Y axis)
- [x] Frontend: bld-user-efficiency-panel (top/bottom 5 table)
- [x] Frontend: bld-actions-panel (grouped by type, no seat-cut action)
- [x] Nav: sidebar link admin-only "BLD View"
- [x] Tests: bld-metrics service unit tests (isCompanySeat, getMonthlyCostUsd, getPersonalDomains, waste/util formulas)
- [x] Typecheck both packages (API + Web): PASS
- [x] All 77 tests pass

## Tests Status
- Type check API: PASS (dist/index.js built clean)
- Type check Web: PASS (tsc -b + vite build, 2756 modules)
- Unit tests: 77/77 PASS (9 test files)
- New BLD tests: ~35 assertions across 5 describe blocks

## Key Design Decisions
- `isCompanySeat` / `getMonthlyCostUsd` / `getPersonalDomains` are pure exported functions — easily unit-testable without DB
- Service reads `process.env.*` at call time (not module-load time) so env overrides in tests work correctly
- Rebalance Rule 2 threshold set at 70% (warning band) matching `classifyStatus` in quota-forecast-service
- Rule 3 uses seat-level avg 7d_pct as proxy for user usage (individual user-level tracking not available in current schema)
- Cache is per-process in-memory Map — cleared on restart; acceptable for 5-min TTL admin-only endpoint

## Issues Encountered
- Recharts `Tooltip.formatter` types require `ValueType | undefined` — fixed with runtime coercion
- Vitest config was explicit allowlist — added new test file to `include` array

## Concerns
- Rule 3 (reassign_user) uses seat-level 7d_pct, not per-user usage, because UsageSnapshot has no `user_id` field. Suggestions may be imprecise if multiple users share one seat. Tracked as known limitation.
- W/W history relies on snapshot density; weeks with no snapshots return 0% util (shown as-is, not interpolated).
