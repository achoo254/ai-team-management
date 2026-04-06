# Brainstorm: Predictive Alerts (Burndown 5h + Slowdown 7d)

**Date**: 2026-04-06
**Status**: Approved → Plan creation

## Problem

Current alert system only triggers when usage crosses a static threshold (rate_limit). No prediction capability — users get surprised when quota burns fast or when 7d usage creeps toward limit.

## Requirements

1. **Fast Burn (5h)**: Detect abnormally high velocity + low ETA in 5h window → warn before hitting limit
2. **Quota Forecast (7d)**: Predict when 7d usage will reach user's threshold before reset → early warning
3. **Config**: System defaults + user override for advanced users

## Chosen Approach

### Alert Types

| Type | Window | Trigger |
|------|--------|---------|
| `fast_burn` | `5h` | velocity >= burn_rate_threshold AND eta <= eta_warning_hours |
| `quota_forecast` | `7d` | predicted hours_to_threshold < hours_to_reset AND <= forecast_warning_hours |

### Burndown 5h (fast_burn)

- Velocity: `five_hour_pct / hours_since_cycle_start` (%/h)
- ETA: `(100 - five_hour_pct) / velocity` (hours)
- Combined trigger: rate >= 15%/h AND ETA <= 1.5h
- Noise guard: skip if hours_elapsed < 0.5h
- Dedup: 4h window (shorter than 24h for rate_limit due to 5h cycle)

### Slowdown 7d (quota_forecast)

- Reuse `forecastSeatQuota()` from quota-forecast-service.ts
- Additional calc: `hours_to_threshold = (user_threshold - current_pct) / slope`
- Trigger: hours_to_threshold < hours_to_reset AND <= 48h default
- Dedup: 24h standard

### User Config (IWatchedSeat extension)

```
burn_rate_threshold: number | null  // %/h, default 15, null = off
eta_warning_hours: number | null    // hours, default 1.5, null = off
forecast_warning_hours: number | null // hours, default 48, null = off
```

### Impact

- models/alert.ts — 2 new type enums
- models/user.ts — 3 new fields in IWatchedSeat
- services/alert-service.ts — 2 new check functions in checkSnapshotAlerts()
- shared/types.ts — DTO updates
- routes/user-settings.ts — validate new fields
- web components — expand threshold dialog with predictive section
- Tests — new test cases
