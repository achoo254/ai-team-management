# Phase 2 — API Extension (resets_at in QuotaForecast)

## Overview
**Priority:** High · **Status:** completed
Extend `quota_forecast` response to include `resets_at` for both 5h + 7d bars.

## Related files
- **Modify:** `packages/api/src/services/quota-forecast-service.ts`
- **Modify:** `packages/api/src/routes/dashboard.ts`
- **Modify:** `packages/shared/types.ts`
- **Modify:** `packages/web/src/hooks/use-dashboard.ts` (type re-export only)

## Changes

### `packages/shared/types.ts`
```ts
export interface QuotaForecastResult {
  // existing fields...
  resets_at: string | null   // NEW: ISO from underlying seat snapshot
}
export interface QuotaForecast {
  seven_day: QuotaForecastResult | null
  five_hour: {
    current_pct: number
    status: 'safe' | 'warning' | 'critical'
    resets_at: string | null   // NEW
  } | null
}
```

### `packages/api/src/services/quota-forecast-service.ts`
- `SeatForecast` interface thêm `resets_at: string | null`
- `forecastSeatQuota`: fetch seats' latest snapshot include `seven_day_resets_at` → set on returned forecast
- Latest snapshot = last item in sorted array (already fetched)

### `packages/api/src/routes/dashboard.ts`
- In 5h forecast block: find active window whose `utilization_pct` == max, lookup seat's latest snapshot's `five_hour_resets_at`
- Simpler alternative: query latest snapshot for the seat with max 5h usage, grab `five_hour_resets_at`
- Attach to `fiveHourForecast.resets_at`

## Todo
- [ ] Update `packages/shared/types.ts` — add `resets_at` to both interfaces
- [ ] Update `SeatForecast` in forecast service
- [ ] Modify snapshot query in `forecastSeatQuota` to also return `seven_day_resets_at`
- [ ] Set `resets_at` on all returned forecasts (including `collecting`/`safe_decreasing` branches)
- [ ] In `dashboard.ts` 5h block: compute `resets_at` for seat with max utilization
- [ ] Typecheck both api + web packages

## Success criteria
- Both packages typecheck clean
- API response includes `resets_at` in both `seven_day` and `five_hour`
- Null safely returned when no snapshot

## Risks
- 5h active windows don't include `five_hour_resets_at` directly — need extra snapshot lookup. Mitigation: latest snapshot map already queried? If not, 1 extra query.
- Forecast `collecting` state has no points — `resets_at` could still be set from single point if exists
