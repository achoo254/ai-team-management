# Phase 5 — Tests

## Overview
**Priority:** Medium · **Status:** pending
Unit test forecast service + UI test card.

## Related files
- **Create:** `tests/services/quota-forecast-service.test.ts`
- **Create:** `tests/ui/quota-forecast-bar.test.tsx`
- **Modify:** `tests/ui/dashboard-efficiency.test.tsx` (nếu đã có, update snapshot)

## Test cases — forecast service

### `linearRegression`
- [ ] 2 points increasing → slope positive correct
- [ ] 3+ points mixed noise → slope approximate
- [ ] Constant values → slope = 0
- [ ] Decreasing → slope negative

### `forecastSeatQuota`
- [ ] `<2 snapshots` → `status: "collecting"`, `hours_to_full: null`
- [ ] `slope = 0` → `status: "safe_decreasing"` (edge: flat line)
- [ ] `slope < 0` → `status: "safe_decreasing"`
- [ ] `hours_to_full > 168` → `status: "safe"`
- [ ] `hours_to_full = 50` → `status: "watch"`
- [ ] `hours_to_full = 30` → `status: "warning"`
- [ ] `hours_to_full = 12` → `status: "critical"`
- [ ] `hours_to_full = 3` → `status: "imminent"`
- [ ] `current_pct = 95, slope = 5/h` → correct short forecast

### `computeQuotaForecast`
- [ ] Multiple seats → pick seat with lowest hours_to_full
- [ ] All seats safe → return best (highest hours_to_full)
- [ ] Mix collecting + safe → ignore collecting in worst-seat selection

## Test cases — UI

### `QuotaForecastBar`
- [ ] Render safe status → green color
- [ ] Render critical → red + forecast date
- [ ] Render collecting → placeholder text
- [ ] Null data → empty state

### `DashboardEfficiency` (integration)
- [ ] Mock `useEfficiency` with quota_forecast data → renders all sections
- [ ] User badge correct threshold (test with util 70, 45, 20)
- [ ] No active sessions → skip "Phiên đang chạy" block

## Todo
- [ ] Write forecast service tests (covers all status transitions)
- [ ] Write QuotaForecastBar component tests
- [ ] Update dashboard-efficiency tests (snapshot + behavior)
- [ ] Run `pnpm test` all pass

## Success criteria
- All new tests pass
- No existing tests broken
- Coverage: forecast-service ≥90% (logic-heavy), components ≥70%

## Risks
- Mock time for forecast_at comparisons → use `vi.setSystemTime`
- Snapshot fragility → prefer behavior tests over snapshots
