# Phase 5: Tests

**Priority:** High | **Effort:** M | **Status:** Complete

## Overview

Unit tests for new alert logic + integration tests for API routes.

## Files to Create/Modify

1. `tests/services/predictive-alerts.test.ts` — NEW: test fast_burn + quota_forecast logic
2. `tests/api/watched-seats.test.ts` — Update: test new fields in POST/PUT

## Test Cases

### `predictive-alerts.test.ts`

#### fast_burn tests
1. **Triggers when velocity high + ETA short** — seat at 70% after 1h (70%/h), ETA 0.43h → alert
2. **No alert when velocity high but ETA long** — seat at 30% after 1h (30%/h), ETA 2.3h → skip
3. **No alert when ETA short but velocity low** — seat at 90% after 4h (22.5%/h but ETA check with rate 22.5 which is high... use seat at 80% after 4h = 20%/h, ETA 1h) — adjust: use case where rate is below threshold
4. **Noise guard: skip first 30 min** — seat at 50% after 0.3h → skip despite high velocity
5. **Null = disabled** — burn_rate_threshold = null → no alert regardless of velocity
6. **Dedup: 4h window** — second alert within 4h for same (user, seat, fast_burn, 5h) → skip
7. **Re-alert after 4h** — enough time passed → new alert created

#### quota_forecast tests
1. **Triggers when projected to hit threshold before reset** — slope 1%/h, current 60%, threshold 85%, reset in 72h → hits 85% in 25h < 72h, within 48h warning → alert
2. **No alert when hits after reset** — slope 0.5%/h, current 60%, threshold 85% → 50h to threshold, reset in 30h → skip (reset first)
3. **No alert when outside warning window** — slope 0.3%/h, current 60%, threshold 85% → 83h to threshold > 48h warning → skip
4. **No alert when already above threshold** — current 87% > threshold 85% → skip (rate_limit handles)
5. **No alert when slope decreasing** — slope ≤ 0 → skip
6. **Null = disabled** — forecast_warning_hours = null → no alert
7. **Dedup: 24h window** — standard dedup

### `watched-seats.test.ts` (additions)

1. **POST with predictive fields** — creates with correct values
2. **POST without predictive fields** — uses defaults (15, 1.5, 48)
3. **PUT update predictive fields** — updates independently
4. **PUT with null** — disables specific alert type
5. **Clamping** — values outside range get clamped (e.g., burn_rate=100 → 50)

## Success Criteria

- [x] All fast_burn trigger/skip scenarios pass
- [x] All quota_forecast trigger/skip scenarios pass
- [x] Dedup windows verified (4h for fast_burn, 24h for quota_forecast)
- [x] API validation and clamping tested
- [x] Null handling (disabled) tested
- [x] `pnpm test` passes with no regressions
