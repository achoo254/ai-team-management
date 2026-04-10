# Phase 01 — Extend Forecast Service với Efficiency Bucketing

## Context Links

- Plan overview: `./plan.md`
- Brainstorm: `plans/dattqh/reports/brainstorm-260410-1043-telegram-report-efficiency-reframe.md`
- Target file: `packages/api/src/services/quota-forecast-service.ts`

## Overview

- **Priority:** High
- **Status:** pending
- **Effort:** M (~1.5h)

Mở rộng `quota-forecast-service.ts` thêm classification 4-bucket (optimal/overload/waste/unknown) dựa trên **projected_pct tại thời điểm reset** (single axis, unified logic). Aggregate fleet-level efficiency + waste cost.

## Key Insights

- Service đã có `slope_per_hour` + `resets_at` → chỉ cần compute `projected = current_pct + slope * hoursToReset`
- Status `reset_first` hiện tại ≈ bucket `waste` — reuse existing forecast, chỉ thêm classification layer
- **Single axis: projected_pct** — đơn giản hơn 40% so với dual-axis (ratio + projected). Loại bỏ edge case mâu thuẫn.
- Cost = flat $125/seat/month — 1 const, không cần map subscription types

## Requirements

### Functional
- Export type `SeatEfficiencyBucket = 'optimal' | 'overload' | 'waste' | 'unknown'`
- Export interface `SeatEfficiencyResult`
- Export function `classifyEfficiency(forecast: SeatForecast, now: Date): SeatEfficiencyResult` (pure, no DB)
- Export function `computeFleetEfficiency(seatIds: string[], now?): Promise<FleetEfficiency>` — aggregate + waste_usd
- Export const `SEAT_MONTHLY_COST_USD = 125`

### Non-functional
- Không phá existing API (`forecastSeatQuota`, `computeAllSeatForecasts`, `computeQuotaForecast`)
- File size < 300 LOC — nếu vượt, tách sang `quota-efficiency-service.ts`
- Pure functions cho `classifyEfficiency` (dễ test)

## Classification Logic (Unified Single-Axis)

```typescript
/** Minimum hours into cycle before classification is reliable */
const MIN_HOURS_FOR_CLASSIFICATION = 24

/** Projected pct at reset >= this = optimal */
const OPTIMAL_THRESHOLD_PCT = 85

/** Flat cost per seat per month (USD) */
export const SEAT_MONTHLY_COST_USD = 125

export type SeatEfficiencyBucket = 'optimal' | 'overload' | 'waste' | 'unknown'

export interface SeatEfficiencyResult {
  bucket: SeatEfficiencyBucket
  projected_pct: number | null
  waste_pct: number | null
  hours_early: number | null  // only for overload: bao nhiêu giờ cạn sớm hơn reset
}

export function classifyEfficiency(f: SeatForecast, now: Date): SeatEfficiencyResult {
  const UNKNOWN: SeatEfficiencyResult = { bucket: 'unknown', projected_pct: null, waste_pct: null, hours_early: null }

  // Guard: không đủ data
  if (f.status === 'collecting' || !f.resets_at) return UNKNOWN

  const resetsAt = new Date(f.resets_at)
  const hoursToReset = (resetsAt.getTime() - now.getTime()) / 3600_000
  if (hoursToReset <= 0) return UNKNOWN

  // Guard: đầu chu kỳ, chưa đủ 24h data → noise
  const cycleStart = new Date(resetsAt.getTime() - 7 * 24 * 3600_000)
  const hoursSinceReset = (now.getTime() - cycleStart.getTime()) / 3600_000
  if (hoursSinceReset < MIN_HOURS_FOR_CLASSIFICATION) return UNKNOWN

  // Compute projected pct tại thời điểm reset
  const slope = f.slope_per_hour ?? 0
  const projected = Math.min(100, f.current_pct + slope * hoursToReset)

  // Overload: projected >= 100 → sẽ cạn trước reset
  if (projected >= 100) {
    const hoursEarly = f.hours_to_full != null
      ? Math.max(0, hoursToReset - f.hours_to_full)
      : 0
    return { bucket: 'overload', projected_pct: 100, waste_pct: null, hours_early: hoursEarly }
  }

  // Optimal: projected >= 85
  if (projected >= OPTIMAL_THRESHOLD_PCT) {
    return { bucket: 'optimal', projected_pct: Math.round(projected), waste_pct: null, hours_early: null }
  }

  // Waste: projected < 85
  const wastePct = Math.round(OPTIMAL_THRESHOLD_PCT - projected)
  return { bucket: 'waste', projected_pct: Math.round(projected), waste_pct: wastePct, hours_early: null }
}
```

## Fleet Efficiency Logic

```typescript
export interface FleetEfficiency {
  optimal_count: number
  overload: Array<{ seat_id: string; seat_label: string; hours_early: number }>
  waste: {
    seats: Array<{ seat_id: string; seat_label: string; projected_pct: number; waste_pct: number; waste_usd: number }>
    total_waste_usd: number
  }
  unknown_count: number
  total_seats: number
}

export async function computeFleetEfficiency(
  seatIds: string[],
  now: Date = new Date(),
): Promise<FleetEfficiency> {
  const forecasts = await computeAllSeatForecasts(seatIds, now)

  const result: FleetEfficiency = {
    optimal_count: 0,
    overload: [],
    waste: { seats: [], total_waste_usd: 0 },
    unknown_count: 0,
    total_seats: forecasts.length,
  }

  // Waste cost per cycle: waste_pct/100 * $125 * (7/30) ≈ waste_pct/100 * $29.17
  const costPerCycle = SEAT_MONTHLY_COST_USD * (7 / 30)

  for (const f of forecasts) {
    const eff = classifyEfficiency(f, now)
    switch (eff.bucket) {
      case 'optimal':
        result.optimal_count++
        break
      case 'overload':
        result.overload.push({
          seat_id: f.seat_id, seat_label: f.seat_label,
          hours_early: eff.hours_early ?? 0,
        })
        break
      case 'waste': {
        const wasteUsd = (eff.waste_pct ?? 0) / 100 * costPerCycle
        result.waste.seats.push({
          seat_id: f.seat_id, seat_label: f.seat_label,
          projected_pct: eff.projected_pct ?? 0,
          waste_pct: eff.waste_pct ?? 0,
          waste_usd: Math.round(wasteUsd * 10) / 10,
        })
        result.waste.total_waste_usd += wasteUsd
        break
      }
      case 'unknown':
        result.unknown_count++
        break
    }
  }

  result.waste.total_waste_usd = Math.round(result.waste.total_waste_usd)
  return result
}
```

## Related Code Files

**Modify:**
- `packages/api/src/services/quota-forecast-service.ts` — thêm classification + fleet efficiency + cost const

**Read for context:**
- `packages/api/src/models/usage-snapshot.ts` — verify field names

## Implementation Steps

1. Thêm types: `SeatEfficiencyBucket`, `SeatEfficiencyResult`, `FleetEfficiency`
2. Thêm consts: `SEAT_MONTHLY_COST_USD`, `OPTIMAL_THRESHOLD_PCT`, `MIN_HOURS_FOR_CLASSIFICATION`
3. Implement `classifyEfficiency()` (pure function)
4. Implement `computeFleetEfficiency()` — reuse `computeAllSeatForecasts`, classify + aggregate
5. Export mọi thứ mới
6. Run `pnpm -F @repo/api build`

## Todo List

- [ ] Add types + consts
- [ ] Implement `classifyEfficiency()`
- [ ] Implement `computeFleetEfficiency()`
- [ ] Run `pnpm -F @repo/api build` — 0 errors
- [ ] Verify file <300 LOC

## Success Criteria

- Build pass (tsc clean)
- New exports: `classifyEfficiency`, `computeFleetEfficiency`, `SeatEfficiencyBucket`, `FleetEfficiency`, `SEAT_MONTHLY_COST_USD`
- Không phá existing API

## Risks

- `slope_per_hour` có thể = 0 cho seat `safe_decreasing` → projected ≈ current_pct. Nếu current_pct < 85 → waste. Acceptable — seat đang decreasing thật sự nên classify là waste hợp lý.
- Guard 24h = seat mới tạo/reset xong sẽ show unknown 1 ngày đầu → acceptable

## Next Steps

→ Phase 02: wire vào `bld-metrics-service.ts` + rewrite telegram overview
