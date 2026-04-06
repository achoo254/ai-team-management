# Usage Data Structure & Reset Timing Logic

**Explored:** 2026-04-06 | Files: usage-snapshot.ts, usage-window.ts, quota-forecast-service.ts, alert-service.ts, dashboard.ts

## 1. USAGE SNAPSHOT DATA FIELDS

Core fields from Claude API:

**5-Hour Window:**
- five_hour_pct (number | null): utilization % in current 5h cycle
- five_hour_resets_at (Date | null): when the 5h window ends

**7-Day Window:**
- seven_day_pct (number | null): utilization % across all models
- seven_day_resets_at (Date | null): cycle reset time
- seven_day_sonnet_pct, seven_day_sonnet_resets_at: Sonnet quota
- seven_day_opus_pct, seven_day_opus_resets_at: Opus quota

**Extra Usage (Optional):**
- is_enabled, monthly_limit, used_credits, utilization

**Metadata:**
- seat_id, raw_response, fetched_at

**Indexes:**
- {seat_id: 1, fetched_at: -1}: latest snapshot per seat
- {fetched_at: -1}: dashboard aggregations
- No TTL: long-term retention

## 2. RESET TIMES & WINDOW MECHANICS

### 5-Hour Window

Cycle: 5 hours, hourly-aligned resets (07:00, 12:00 UTC, etc)
Critical: roundToHour() normalizes five_hour_resets_at to nearest hour because:
- Claude API returns ±1s server drift
- Without rounding: duplicate windows per cycle
- Breaks unique index {seat_id, window_start}

Window Lifecycle:
1. create_partial: first snapshot (is_partial: true)
2. update_open: same cycle
3. open_new: cycle boundary

### 7-Day Window

Cycle: 7 days, same time daily
Three independent quotas with separate resets_at timestamps

### Velocity / Rate Calculation

```
rate = currentPct / hoursSinceReset  (% per hour)
hoursToFull = (100 - currentPct) / rate
```

Constraints:
- Skip if hoursSinceReset < 3h (noisy)
- Detect decreases → safe_decreasing
- Cap by reset time → reset_first

## 3. USAGE WINDOW MODEL

Purpose: Track 5-hour operational periods with cost/efficiency metrics

**Key Fields:**
- window_start, window_end: time bounds
- utilization_pct: peak five_hour_pct
- delta_7d_pct, delta_7d_sonnet_pct, delta_7d_opus_pct: quota change
- impact_ratio: delta_7d / utilization (null if util < 1)
- is_waste: duration >= 2h AND util < 5%
- peak_hour_of_day: 0-23 VN time
- snapshot_start_id, snapshot_end_id: audit trail

**Unique Constraints:**
- {seat_id, window_start}: no duplicates
- {seat_id} partial unique where is_closed=false: max 1 open per seat

**Delta Calculation (clampDelta):**
- If quota reset mid-window (diff < 0), use current as approximation
- After reset, current_pct ≈ usage since reset

## 4. QUOTA FORECAST SERVICE

Algorithm: Cycle-to-date average rate

```
cycleStart = seven_day_resets_at - 7 days
rate = currentPct / hoursSinceReset
hoursToFull = (100 - currentPct) / rate
```

Status Classification:
- safe: h > 168 (>1 week)
- watch: 48 <= h <= 168 (2-7 days)
- warning: 24 <= h < 48 (1-2 days)
- critical: 6 <= h < 24 (6h-1 day)
- imminent: h < 6 (<6h)
- safe_decreasing: quota dropping
- reset_first: resets before exhaustion
- collecting: <3h OR no reset data

Special Cases:
- No reset → collecting
- < 3h elapsed → collecting (noise rejection)
- >= 100% → imminent
- Decrease detected → safe_decreasing

## 5. ALERT SERVICE & THRESHOLDS

Per-User Thresholds:
```
threshold_5h_pct: 70  (alert if >= 70%)
threshold_7d_pct: 80  (alert if >= 80%)
```

Dedup: max 1 per (user, seat, type, window) per 24h

Reset Detection Re-Alert:
- If user already alerted, allow re-alert if usage dipped below threshold
- Handles quota resets, manual drops, threshold re-crossings

7-Day Multi-Model:
- Uses max(7d_pct, sonnet_pct, opus_pct) to trigger
- Metadata includes breakdown of all three

Alert Types: rate_limit, token_failure, usage_exceeded, session_waste, 7d_risk

## 6. DASHBOARD ROUTES

GET /api/dashboard/summary:
- avgAllPct: average seven_day_pct
- activeAlerts: unread count
- totalSnapshots: total records

GET /api/dashboard/enhanced?range=day|week|month|3month|6month:
- Per-seat latest usage
- Usage trend (hourly/daily aggregates)
- Data quality (stale seats, token failures)
- Urgent forecasts (top 3)
- Seat statistics

## 7. DATA FLOW

Claude API
  → fetchSeatUsage()
  → UsageSnapshot created
  → applyWindowForSeat()
  → detectWindowAction()
  → UsageWindow {updated/created/closed}
  → recordSeatActivity()
  → SeatActivityLog
  → checkSnapshotAlerts()
  → Alert delivery

On-demand:
  forecastSeatQuota(seatId)
  → rate = currentPct / hoursSinceReset
  → SeatForecast {slope_per_hour, hours_to_full, status}

## 8. TIMEZONE

Vietnam Time (UTC+7) hardcoded:
- getPeakHourVN(): hours when utilization peaked
- Activity log date calculation
- Dashboard aggregation: Asia/Ho_Chi_Minh

## 9. KEY OBSERVATIONS

1. No separate session metric model - UsageWindow IS the session metric
2. No active session model - activity inferred from SeatActivityLog
3. Manual collect throttled to 60s gaps per seat
4. Unique index {seat_id, window_start} prevents duplicates
5. Hour rounding critical for ±1s API timestamp drift
6. Waste detection: duration >= 2h AND util < 5%
7. Windows track snapshot IDs for delta audit trail
8. All forecast edge cases handled (decrease, reset, partial)
9. Dashboard scoped to watched seats (non-admin)
10. Extra usage tracked separately from 5h/7d
11. Metrics stored newest-first (fetched_at DESC)
12. Self-healing: merges duplicate open windows

## VELOCITY METRICS

| Metric | Formula | Use |
|--------|---------|-----|
| slope_per_hour | currentPct / hoursSinceReset | ETA to 100% |
| impact_ratio | delta_7d / utilization | efficiency per session |
| activity_rate | total_active / weeks | engagement tracking |
| hours_to_full | (100 - currentPct) / rate | urgency classification |
