# Phase 1: Backend Models & Types

**Priority:** High | **Effort:** S | **Status:** Complete

## Overview

Add `fast_burn` and `quota_forecast` to alert type enums, extend `IWatchedSeat` with 3 new configurable fields.

## Files to Modify

1. `packages/api/src/models/alert.ts` — Add 2 new enum values to `AlertTypeDb`
2. `packages/api/src/models/user.ts` — Add 3 fields to `IWatchedSeat` interface + schema
3. `packages/shared/types.ts` — Update `AlertType`, `WatchedSeat`, `AlertMetadata` DTOs

## Implementation Steps

### 1. `packages/api/src/models/alert.ts`

Update `AlertTypeDb`:
```typescript
export type AlertTypeDb = 'rate_limit' | 'token_failure' | 'usage_exceeded' | 'session_waste' | '7d_risk' | 'fast_burn' | 'quota_forecast'
```

Update schema enum array:
```typescript
enum: ['rate_limit', 'token_failure', 'usage_exceeded', 'session_waste', '7d_risk', 'fast_burn', 'quota_forecast']
```

### 2. `packages/api/src/models/user.ts`

Extend `IWatchedSeat`:
```typescript
export interface IWatchedSeat {
  seat_id: Types.ObjectId
  threshold_5h_pct: number
  threshold_7d_pct: number
  // Predictive alert settings (null = disabled)
  burn_rate_threshold: number | null    // %/h, default 15
  eta_warning_hours: number | null      // hours, default 1.5
  forecast_warning_hours: number | null // hours, default 48
}
```

Add to schema `watched_seats` subdoc:
```typescript
burn_rate_threshold: { type: Number, default: 15 },
eta_warning_hours: { type: Number, default: 1.5 },
forecast_warning_hours: { type: Number, default: 48 },
```

### 3. `packages/shared/types.ts`

Update `AlertType`:
```typescript
export type AlertType = 'rate_limit' | 'token_failure' | 'usage_exceeded' | 'session_waste' | '7d_risk' | 'fast_burn' | 'quota_forecast'
```

Extend `WatchedSeat`:
```typescript
export interface WatchedSeat {
  seat_id: string
  threshold_5h_pct: number
  threshold_7d_pct: number
  burn_rate_threshold?: number | null
  eta_warning_hours?: number | null
  forecast_warning_hours?: number | null
  seat_label?: string
  seat_email?: string
}
```

Extend `AlertMetadata` with predictive fields:
```typescript
// Add to AlertMetadata
velocity?: number        // %/h burn rate (fast_burn)
eta_hours?: number       // hours to 100% (fast_burn)
slope_per_hour?: number  // 7d slope (quota_forecast)
hours_to_threshold?: number // hours to user threshold (quota_forecast)
hours_to_reset?: number  // hours until reset (quota_forecast)
forecast_pct?: number    // predicted % at threshold time
```

## Success Criteria

- [x] `AlertTypeDb` and `AlertType` include `fast_burn` and `quota_forecast`
- [x] `IWatchedSeat` has 3 new optional fields with defaults
- [x] `WatchedSeat` DTO mirrors new fields
- [x] `AlertMetadata` has velocity/ETA/slope fields
- [x] TypeScript compiles without errors (`pnpm -F @repo/api build`)
