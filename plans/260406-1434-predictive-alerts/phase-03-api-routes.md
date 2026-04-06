# Phase 3: API Routes

**Priority:** Medium | **Effort:** S | **Status:** Complete

## Overview

Update watched-seats routes to accept and validate new predictive alert fields.

## Files to Modify

1. `packages/api/src/routes/watched-seats.ts` — Validate 3 new fields on POST/PUT

## Implementation Steps

### 1. Add validation helper

```typescript
/** Clamp predictive threshold or return null (disabled). */
function clampPredictive(val: unknown, fallback: number | null, min: number, max: number): number | null {
  if (val === null) return null  // explicitly disabled
  if (val === undefined) return fallback  // not provided → keep default
  const n = Number(val)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10))
}
```

### 2. Update POST `/api/user/watched-seats`

Add to body destructuring:
```typescript
const { seat_id, threshold_5h_pct, threshold_7d_pct,
        burn_rate_threshold, eta_warning_hours, forecast_warning_hours } = req.body
```

Add to entry creation:
```typescript
const entry = {
  seat_id: seat._id,
  threshold_5h_pct: clampPct(threshold_5h_pct, 90),
  threshold_7d_pct: clampPct(threshold_7d_pct, 85),
  burn_rate_threshold: clampPredictive(burn_rate_threshold, 15, 5, 50),
  eta_warning_hours: clampPredictive(eta_warning_hours, 1.5, 0.5, 4),
  forecast_warning_hours: clampPredictive(forecast_warning_hours, 48, 6, 168),
}
```

Return new fields in response.

### 3. Update PUT `/api/user/watched-seats/:seatId`

Add to body destructuring + entry update:
```typescript
if (burn_rate_threshold !== undefined)
  entry.burn_rate_threshold = clampPredictive(burn_rate_threshold, entry.burn_rate_threshold, 5, 50)
if (eta_warning_hours !== undefined)
  entry.eta_warning_hours = clampPredictive(eta_warning_hours, entry.eta_warning_hours, 0.5, 4)
if (forecast_warning_hours !== undefined)
  entry.forecast_warning_hours = clampPredictive(forecast_warning_hours, entry.forecast_warning_hours, 6, 168)
```

### Validation Ranges

| Field | Min | Max | Default | Unit |
|-------|-----|-----|---------|------|
| `burn_rate_threshold` | 5 | 50 | 15 | %/h |
| `eta_warning_hours` | 0.5 | 4 | 1.5 | hours |
| `forecast_warning_hours` | 6 | 168 | 48 | hours |

## Success Criteria

- [x] POST creates watched seat with new fields (defaults if not provided)
- [x] PUT updates new fields independently
- [x] `null` accepted to disable specific alert type
- [x] Values clamped to valid ranges
- [x] Response includes new fields
