# Phase 1 — Forecast Service (linear regression)

## Overview
**Priority:** High · **Status:** pending
Service tính forecast khi nào seat sẽ hit 100% quota 7d dựa trên lịch sử `usage_snapshots`.

## Related files
- **Create:** `packages/api/src/services/quota-forecast-service.ts`
- **Read:** `packages/api/src/models/usage-snapshot.ts`, `packages/api/src/models/seat.ts`

## Algorithm (from brainstorm report)

```ts
interface SeatForecast {
  seat_id: string
  seat_label: string
  current_pct: number              // latest seven_day_pct
  slope_per_hour: number           // %/hour, 0 nếu decreasing
  hours_to_full: number | null     // null nếu safe/decreasing/collecting
  forecast_at: string | null       // ISO date
  status: "safe" | "watch" | "warning" | "critical" | "imminent"
        | "safe_decreasing" | "collecting"
}
```

### Per-seat steps
1. Query `usage_snapshots` WHERE `seat_id` = X AND `collected_at >= now - 24h` AND `seven_day_pct != null`, sort by `collected_at` ASC
2. Nếu `< 2` điểm → `status: "collecting"`, return early
3. Tính linear regression simple:
   ```
   x = timestamp as hours-since-first-point
   y = seven_day_pct
   slope = Σ((xi-x̄)(yi-ȳ)) / Σ((xi-x̄)²)
   ```
4. Nếu `slope <= 0` → `status: "safe_decreasing"`, `hours_to_full: null`
5. `current_pct` = last point's `seven_day_pct`
6. `hours_to_full = (100 - current_pct) / slope`
7. `forecast_at = now + hours_to_full * 3600_000` ms
8. Classify status:
   - `> 168` → `safe`
   - `48..168` → `watch`
   - `24..48` → `warning`
   - `6..24` → `critical`
   - `< 6` → `imminent`

### Team aggregation
`computeQuotaForecast(seatIds: string[]): QuotaForecastResult`
- Run per-seat for all seats
- Pick seat với `hours_to_full` thấp nhất (ignore collecting/safe_decreasing)
- Nếu tất cả seats là safe/decreasing/collecting → trả worst status, no forecast_at

## Todo
- [ ] Create `quota-forecast-service.ts` với 2 export: `forecastSeatQuota(seatId)`, `computeQuotaForecast(seatIds)`
- [ ] Helper `linearRegression(points: {x:number, y:number}[]): {slope:number, intercept:number}`
- [ ] Helper `classifyStatus(hoursToFull: number): Status`
- [ ] Type `SeatForecast`, `QuotaForecastResult`
- [ ] JSDoc mỗi public function với ví dụ

## Success criteria
- Function pure, không side effect (trừ DB query)
- Handle edge cases: <2 points, slope=0, slope<0, current_pct>=100
- File <200 LOC
- Typecheck pass (`pnpm -F @repo/api build`)

## Risks
- Snapshot gaps (seat inactive): slope có thể lệch → skip gaps >2h hoặc requirement minimum density
- Float precision khi subtract timestamps → dùng milliseconds, convert sang hours cuối cùng
