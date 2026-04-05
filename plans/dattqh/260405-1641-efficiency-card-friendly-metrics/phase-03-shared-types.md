# Phase 3 — Shared Types Update

## Overview
**Priority:** Medium · **Status:** pending
Sync type definitions giữa API và web cho shape mới.

## Related files
- **Modify:** `packages/shared/types.ts`
- **Modify:** `packages/web/src/hooks/use-dashboard.ts` (EfficiencySummary interface)

## Changes

### In `packages/shared/types.ts` (nếu chưa có, thêm)
```ts
export type QuotaForecastStatus =
  | "safe" | "watch" | "warning" | "critical" | "imminent"
  | "safe_decreasing" | "collecting"

export interface QuotaForecastResult {
  seat_id: string
  seat_label: string
  current_pct: number
  slope_per_hour: number
  hours_to_full: number | null
  forecast_at: string | null
  status: QuotaForecastStatus
}

export interface QuotaForecast {
  seven_day: QuotaForecastResult | null
  five_hour: {
    current_pct: number
    status: "safe" | "warning" | "critical"
  } | null
}
```

### In `packages/web/src/hooks/use-dashboard.ts`
- Remove deprecated fields từ `EfficiencySummary` (`avg_impact_ratio`, `avg_delta_7d_sonnet/opus`)
- Add `quota_forecast: QuotaForecast` vào response type `EfficiencyResponse`

## Todo
- [ ] Thêm types vào shared/types.ts
- [ ] Import types vào use-dashboard.ts
- [ ] Remove deprecated fields từ EfficiencySummary
- [ ] Verify no TS errors toàn monorepo (`pnpm build`)

## Success criteria
- Build pass toàn monorepo
- Types reused across api + web (DRY)

## Risks
- Existing components khác dùng deprecated fields → TS compiler sẽ flag, fix theo
