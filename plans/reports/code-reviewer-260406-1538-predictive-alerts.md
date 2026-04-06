# Code Review: Predictive Alerts Feature

**Date:** 2026-04-06  
**Reviewer:** code-reviewer  
**Score:** 7/10  

## Scope

- Files: 10 (3 backend services, 1 model, 1 route, 1 shared types, 4 frontend)
- Focus: predictive alert logic, dedup, null handling, edge cases, input validation

## Overall Assessment

Solid feature implementation with clean separation (predictive-alert-service.ts extracted from alert-service.ts), good null-disabled pattern, sensible defaults. A few edge cases in velocity calculation and a potential N+1 concern need attention.

---

## Critical Issues

### C1. Division by zero when `velocity = 0` in fast burn ETA calc

**File:** `packages/api/src/services/predictive-alert-service.ts:32`

```ts
const etaHours = fiveHourPct >= 100 ? 0 : (100 - fiveHourPct) / velocity
```

Guard `fiveHourPct <= 0` at line 29 prevents `velocity = 0` when `hoursElapsed > 0`. However, due to float precision, if `fiveHourPct` is extremely small (e.g., 0.001), `velocity` could be near-zero, producing an extremely large `etaHours` that would never trigger the alert anyway. **Not actually exploitable** since the condition `velocity >= burnThreshold` (min 5) would fail. Low risk in practice.

**Verdict:** Safe by coincidence of the combined trigger condition. No fix needed, but add a comment explaining why division is safe.

---

## High Priority

### H1. N+1 DB calls in `checkQuotaForecastAlerts` — one `forecastSeatQuota()` per seat

**File:** `packages/api/src/services/predictive-alert-service.ts:82`

```ts
const forecast = await forecastSeatQuota(seatIdStr, label, now)
```

`forecastSeatQuota` internally runs 2 DB queries (latest snapshot + earliest in-cycle snapshot) per seat. With N seats, this is 2N queries inside a loop. In the existing `checkSnapshotAlerts` flow, snapshots are already aggregated upfront but not reused here.

**Impact:** For a fleet of 10-20 seats this is tolerable (20-40 extra queries every 5 min). For larger fleets, this becomes a bottleneck.

**Recommendation:** Accept for now, add a `// TODO: batch forecast queries` comment. Can optimize later by pre-fetching all latest snapshots in one aggregate and passing them to a batch forecast function.

### H2. Cycle time calculation assumes `resets_at` is exactly 5h after cycle start

**File:** `packages/api/src/services/predictive-alert-service.ts:24`

```ts
const cycleStart = new Date(resetsAt).getTime() - 5 * 3600_000
```

This is correct for the current Anthropic API behavior (5h rolling window). If Anthropic changes the window duration, this breaks silently. The assumption is documented nowhere.

**Recommendation:** Add a constant `FIVE_HOUR_WINDOW_MS = 5 * 3600_000` with a comment explaining the assumption. Low priority since it matches existing codebase patterns.

### H3. `hoursElapsed` can be negative if server clock is behind Anthropic's `resets_at`

**File:** `packages/api/src/services/predictive-alert-service.ts:25`

```ts
const hoursElapsed = (now - cycleStart) / 3600_000
```

If `resets_at` is far in the future (e.g., clock drift or Anthropic returning future timestamp), `cycleStart` could be in the future, making `hoursElapsed` negative. The `< 0.5` guard catches this, but `velocity` would be `fiveHourPct / negative`, producing negative velocity which silently passes through.

**Recommendation:** Add explicit guard: `if (hoursElapsed <= 0) continue`

---

## Medium Priority

### M1. Mongoose schema allows `burn_rate_threshold: 0` which passes truthiness checks but is functionally meaningless

**File:** `packages/api/src/models/user.ts:62`

Schema has no `min` constraint on `burn_rate_threshold`. The route's `clampPredictive` enforces min=5, but direct DB manipulation or migration could set it to 0, which would trigger alerts on any non-zero velocity.

**Recommendation:** Add `min: 5` to the Mongoose schema as defense-in-depth.

### M2. `useEffect` dependency on `current` object reference causes re-render thrashing

**File:** `packages/web/src/components/watch-threshold-dialog.tsx:37-45`

```ts
useEffect(() => {
  if (open) { /* reset state from current */ }
}, [open, current]);
```

`current` is a new object reference on every parent render (created inline in `watch-seat-button.tsx:54-59`). This means the effect fires on every parent re-render when dialog is open, resetting user's in-progress edits.

**Impact:** If parent re-renders while user is editing thresholds (e.g., background query refetch), inputs snap back to saved values.

**Recommendation:** Either memoize `current` in parent with `useMemo`, or only depend on `open` (not `current`) — the effect already guards with `if (open)` and `current` values are only needed on open.

### M3. Dedup window for `quota_forecast` is 24h but forecast conditions can change rapidly

**File:** `packages/api/src/services/alert-service.ts:58`

`quota_forecast` uses the default 24h dedup. If slope increases significantly within 24h (e.g., sudden heavy usage), users won't get re-alerted. This is a design choice, not a bug, but worth documenting.

### M4. Error in `clampPredictive` — `val === null` returns `null` but `val === 0` returns `max(min, 0)`

**File:** `packages/api/src/routes/watched-seats.ts:30-34`

Sending `burn_rate_threshold: 0` from client returns `max(5, 0) = 5` (clamped), not `null` (disabled). User must explicitly send `null` to disable. This is correct behavior but may confuse frontend devs. The UI properly sends `null` on uncheck, so no actual bug.

---

## Minor Issues

### m1. `any` types in predictive-alert-service function signatures

**File:** `packages/api/src/services/predictive-alert-service.ts:8-9`

```ts
snapshots: Array<{ _id: any; snapshot: any }>
seatMap: Map<string, any>
```

These mirror the aggregate output shape. Acceptable given internal-only usage, but a shared type would prevent regressions.

### m2. Alert messages contain emoji (`⚡`, `📊`) — may render inconsistently in Telegram

Minor UX concern, not a bug. Telegram supports these well.

### m3. Missing display of predictive alert status in watched-seats-summary

**File:** `packages/web/src/components/watched-seats-summary.tsx:39`

Only shows `5h X% · 7d Y%` — doesn't indicate whether predictive alerts are enabled. Users can't tell at a glance without opening the edit dialog.

**Recommendation:** Add indicator like `⚡` icon when burn_rate_threshold is not null.

---

## Positive Observations

1. **Clean null-disabled pattern:** `null` = disabled, with sensible defaults on first enable. Consistent across backend and frontend.
2. **Combined trigger for fast_burn:** Requiring BOTH high velocity AND low ETA prevents false positives from brief spikes.
3. **Noise guard:** 30-min warmup skip prevents noisy alerts at cycle boundaries.
4. **Input validation:** `clampPredictive` with min/max bounds prevents unreasonable thresholds from API.
5. **Dedup differentiation:** 4h window for fast_burn vs 24h standard is well-reasoned — fast burn conditions change faster.
6. **Collapsible UI section:** Keeps basic flow simple while allowing power users to configure predictive settings.
7. **Type-exported `InsertAlertFn`:** Clean dependency injection pattern for testability.

---

## Checklist Verification

| Check | Status |
|-------|--------|
| Concurrency / race conditions | OK — dedup uses DB findOne + create (non-atomic but acceptable for alert dedup; worst case = duplicate alert) |
| Error boundaries | OK — try/catch in routes, Promise.allSettled for delivery |
| API contracts | OK — shared types updated, optional fields with `?` |
| Backwards compatibility | OK — new fields are optional with defaults, no breaking schema change |
| Input validation | OK — clampPredictive at route boundary |
| Auth/authz | OK — resolveAccessibleSeat checks owner/assigned/admin |
| N+1 queries | WARN — H1 above, acceptable for current scale |
| Data leaks | OK — no PII in alert metadata |

---

## Recommended Actions

1. **[H3]** Add `if (hoursElapsed <= 0) continue` guard in fast burn — prevents negative velocity edge case
2. **[M2]** Fix useEffect dependency to avoid resetting user edits on parent re-render
3. **[H1]** Add TODO comment for batch forecast optimization
4. **[M1]** Add `min: 5` to Mongoose schema for burn_rate_threshold

## Unresolved Questions

- Is 4h dedup window for fast_burn the right balance? Could consider making it configurable per-user.
- Should `quota_forecast` alerts re-trigger if slope increases by >50% since last alert within the 24h window (similar to rate_limit's dip-and-re-cross logic)?
