# Phase 1 — Data Quality Fixes

## Context Links
- Plan: [../plan.md](../plan.md)
- Brainstorm: `plans/dattqh/reports/brainstorm-260405-2109-enterprise-bld-dashboard.md`
- Forecast service (built): `packages/api/src/services/quota-forecast-service.ts`

## Overview
- Priority: HIGH (prerequisite for P2/P3)
- Status: pending
- Effort: ~1 day

Fix foundation issues before BLD sees numbers. Stale data, hidden token failures, unsurfaced forecast, unreliable sparkline.

## Key Insights
- Forecast service đã hoạt động (cycle-to-date rate, reset_first status) — chỉ cần surface UI
- Token failure metadata có trong DB (`seat.last_fetch_error`, `seat.last_fetched_at`) — chỉ thiếu hiển thị
- Stale detection logic: `now - last_fetched_at > 6h`
- Sparkline hiện dùng `last 20 closed windows` — nên đổi sang `last 7d time-bounded`

## Requirements

### Functional
1. Red banner top dashboard khi any seat có `last_fetched_at > 6h` old
2. Token failure panel liệt kê seat fail + reason + last_fetched_at + retry button
3. Card "Seats sắp cạn" top 3 forecasts urgent (warning/critical/imminent)
4. Sparkline window = 7d thay N=20

### Non-functional
- Không regression existing dashboard components
- Fetch overhead <50ms added to `/api/dashboard`

## Architecture

```
packages/web/src/pages/dashboard.tsx
  ├─ <StaleDataBanner /> (new, top-most)
  ├─ existing stat-overview, seat-usage-chart, etc.
  ├─ <TokenFailurePanel /> (new, near admin section)
  └─ <ForecastUrgentCard /> (new, above trend chart)

packages/api/src/routes/dashboard.ts
  └─ extend response with: { stale_seats: [], token_failures: [], urgent_forecasts: [] }
```

## Related Code Files

### Modify
- `packages/api/src/routes/dashboard.ts` — add stale/failure/forecast fields
- `packages/shared/types.ts` — add DashboardDTO fields
- `packages/web/src/pages/dashboard.tsx` — mount new components
- `packages/web/src/hooks/use-dashboard.ts` — consume new fields
- `packages/web/src/components/dashboard-efficiency.tsx` — sparkline window fix (if sparkline lives here)

### Create
- `packages/web/src/components/stale-data-banner.tsx`
- `packages/web/src/components/token-failure-panel.tsx`
- `packages/web/src/components/forecast-urgent-card.tsx`

## Implementation Steps

1. **API: extend dashboard response** (`dashboard.ts`)
   - Compute `stale_seats = seats.filter(s => now - s.last_fetched_at > 6h)`
   - Compute `token_failures = seats.filter(s => s.last_fetch_error)`
   - Call `computeAllSeatForecasts(seatIds)`, filter `status in ['warning','critical','imminent']`, top 3
   - Return in response DTO
2. **Shared types** (`types.ts`)
   - Extend `DashboardResponse` with `stale_seats`, `token_failures`, `urgent_forecasts`
3. **Stale banner component**
   - Red banner, dismissible per-session
   - Text: "⚠ {n} seat(s) có dữ liệu cũ hơn 6h — có thể không phản ánh thực tế"
   - List seat labels + hours-since-fetch
4. **Token failure panel**
   - Card ở section admin (hoặc dashboard nếu current user is admin)
   - Table: seat label, error message (truncated), last_fetched_at, "Retry" button
   - Retry button calls existing `POST /api/seats/:id/refresh-token` (nếu có, else TODO)
5. **Forecast urgent card**
   - Compact 3-row list: seat label, pct, ETA, status icon
   - Reuse `<StatusIcon />` + styling từ `quota-7d-forecast.tsx`
6. **Sparkline window fix**
   - Locate sparkline component
   - Change query from `take: 20` to `fetched_at >= now - 7d`
7. **Typecheck + test**

## Todo List

- [ ] API: add stale_seats to dashboard response
- [ ] API: add token_failures to dashboard response
- [ ] API: add urgent_forecasts to dashboard response
- [ ] Shared types extended
- [ ] Create stale-data-banner.tsx
- [ ] Create token-failure-panel.tsx
- [ ] Create forecast-urgent-card.tsx
- [ ] Mount new components in dashboard.tsx
- [ ] Fix sparkline window to 7d
- [ ] Verify retry endpoint exists (or add TODO)
- [ ] Run typecheck both packages
- [ ] Run vitest all tests
- [ ] Visual smoke test dashboard page

## Success Criteria
- Dashboard shows red banner when seat fetch >6h old
- Token failure panel lists all failing seats with retry CTA
- Urgent forecasts card visible, shows top 3
- Sparkline reflects last 7d, not N=20
- All existing tests pass

## Risks
- Forecast surfacing may spam "urgent" early cycle → already handled by `collecting` status in forecast service
- Retry token endpoint may not exist → TODO note, coordinate with admin routes

## Security
- Token error messages may leak sensitive info → sanitize before display (strip tokens/paths)
- Retry button admin-only

## Next Steps
- → Phase 2 (BLD View Page)
