# Phase 1 Implementation Report — Data Quality Fixes

## Phase
- Phase: phase-01-data-quality-fixes
- Plan: plans/dattqh/260405-2109-enterprise-bld-dashboard/
- Status: completed

## Files Modified

| File | Change |
|------|--------|
| `packages/api/src/routes/dashboard.ts` | Added `sanitizeErrorMessage()` helper; extended `/enhanced` response with `stale_seats`, `token_failures`, `urgent_forecasts`; fixed sparkline from `$limit: 20` to time-bounded 7d |
| `packages/shared/types.ts` | Added `StaleSeatInfo`, `TokenFailureInfo`, `UrgentForecastItem` DTOs |
| `packages/web/src/hooks/use-dashboard.ts` | Extended `EnhancedDashboardData` with 3 new fields; re-exported new types |
| `packages/web/src/pages/dashboard.tsx` | Imported + mounted `StaleDataBanner`, `ForecastUrgentCard`, `TokenFailurePanel` |

## Files Created

| File | Purpose |
|------|---------|
| `packages/web/src/components/stale-data-banner.tsx` | Red dismissible banner (sessionStorage), lists stale seat labels + hours |
| `packages/web/src/components/token-failure-panel.tsx` | Admin card table: seat, sanitized error, last_fetched_at, Retry button (disabled until endpoint exists) |
| `packages/web/src/components/forecast-urgent-card.tsx` | Compact 3-row card: seat label, pct progress bar, status, ETA — reuses quota-7d-forecast styling pattern |

## Tasks Completed

- [x] API: add stale_seats to dashboard response
- [x] API: add token_failures to dashboard response (sanitized)
- [x] API: add urgent_forecasts to dashboard response (top 3 warning/critical/imminent)
- [x] Shared types extended
- [x] Create stale-data-banner.tsx
- [x] Create token-failure-panel.tsx
- [x] Create forecast-urgent-card.tsx
- [x] Mount new components in dashboard.tsx
- [x] Fix sparkline window to 7d (time-bounded, not `$limit: 20`)
- [x] Verify retry endpoint: does NOT exist → Retry button disabled with TODO comment
- [x] Run typecheck both packages

## Tests Status

- `pnpm -F @repo/api build` → PASS (✅ Built → dist/index.js)
- `pnpm -F @repo/web build` → PASS (✅ built in 1.15s, tsc + vite both clean)
- Vitest: deferred per instruction (run separately in finalize step)

## Issues / Deviations

1. **Sparkline fix**: `windowMatch` contained a composite `window_end` object, so rather than merge it dangerously, the sparkline uses a fresh `sparklineWindowStart = max(rangeStart, now-7d)` to keep the query clean and correct.
2. **Retry endpoint** (`POST /api/seats/:id/refresh-token`): does not exist in `seats.ts`. Retry button rendered as `disabled` with a `TODO(phase-2)` comment in `token-failure-panel.tsx`.
3. **ForecastUrgentCard visibility**: shown to admin only (consistent with TokenFailurePanel). Non-admin users already see forecast data via `DashboardEfficiency` → `Quota7dForecast` component.
4. **StaleDataBanner**: shown to all roles (stale data warning is relevant to everyone). Non-admin users see their own filtered seats so stale data is pertinent.

## Next Steps

- Phase 2: BLD View Page (now unblocked)
- Implement `POST /api/seats/:id/refresh-token` endpoint to enable Retry button
