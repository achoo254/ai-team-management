# Code Review: Dashboard Range Filter

**Scope:** 11 files (API route, model, hook, page, 6 components, 1 new filter component)
**Focus:** Correctness, security, performance, data integrity

## Overall Assessment

Feature is well-structured with clean separation of concerns. Range validation on API side is correct. However, there are **2 critical** and **2 high-priority** issues that should be addressed before merge.

---

## Critical Issues

### C1. Stale TTL Index in MongoDB (Data Loss Risk)

**File:** `packages/api/src/models/usage-snapshot.ts`

The code removes the TTL index definition from Mongoose schema, but **Mongoose does not drop existing indexes on startup** -- it only ensures indexes defined in schema exist. The old TTL index `{ fetched_at: 1, expireAfterSeconds: 7776000 }` will remain active in MongoDB and **continue deleting documents older than 90 days**.

**Impact:** Silent data loss. The 3month and 6month range filters will return incomplete/empty data because MongoDB is still auto-deleting old snapshots.

**Fix:** Run a one-time migration or add to startup:
```ts
// In db.ts or a migration script — run once after deployment
UsageSnapshot.collection.dropIndex('fetched_at_1').catch(() => {/* index may not exist */})
```

### C2. Full Collection Sort Without $match (Unbounded Scan)

**File:** `packages/api/src/routes/dashboard.ts` lines 76, 192

Three aggregation pipelines start with `{ $sort: { fetched_at: -1 } }` on the **entire collection** without a preceding `$match`. Now that TTL is removed, the collection will grow unbounded over time.

Current index: `{ seat_id: 1, fetched_at: -1 }` -- this compound index does NOT help a bare `$sort` on `fetched_at` alone. MongoDB must do a full collection scan + in-memory sort.

**Impact:** Query latency degrades linearly with data growth. At ~10 seats x ~24 snapshots/day x 180 days = ~43K documents, it's manageable. At scale or after a year (~87K+), this becomes a noticeable bottleneck.

**Fix (recommended):** Add a single-field index on `fetched_at`:
```ts
usageSnapshotSchema.index({ fetched_at: -1 })
```

Or restructure the "latest per seat" query to use `$match` with a reasonable time window first:
```ts
{ $match: { fetched_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
{ $sort: { fetched_at: -1 } },
{ $group: { ... } }
```

---

## High Priority

### H1. `$ifNull` with `null` Default in $avg Skews Results

**File:** `packages/api/src/routes/dashboard.ts` lines 137-138

```ts
avg_7d_pct: { $avg: { $ifNull: ['$seven_day_pct', null] } },
avg_5h_pct: { $avg: { $ifNull: ['$five_hour_pct', null] } },
```

`$ifNull: [field, null]` returns `null` when field is null -- which is exactly what the field already is. This `$ifNull` wrapper is a no-op. MongoDB's `$avg` already ignores `null` values, so the wrapper is unnecessary noise but **not a bug**.

However, line 143:
```ts
avg_7d_pct: { $round: [{ $ifNull: ['$avg_7d_pct', 0] }, 1] },
```

This converts `null` averages (groups with zero valid data) to `0`. A group where all snapshots have `null` usage will show as `0%` instead of being distinguishable from actual 0% usage.

**Impact:** Misleading trend chart -- periods with no data appear as 0% usage instead of gaps.

**Fix:** Either filter nulls in $match, or handle null on the frontend by showing gaps in the chart.

### H2. Removing TTL Without Storage/Retention Strategy

Without TTL, the `usage_snapshots` collection grows indefinitely. At ~10 seats x 24 snapshots/day:
- 1 year: ~87K docs
- 3 years: ~260K docs

This is manageable for now, but there's no documented retention policy or cleanup mechanism.

**Recommendation:** Add a comment documenting the expected growth rate, and consider a manual archival/purge strategy for data older than 1 year. Or replace TTL with a longer expiry (e.g., 365 days).

---

## Medium Priority

### M1. Range Param Not Passed to `/summary` Endpoint

**File:** `packages/api/src/routes/dashboard.ts` lines 14-33

The `/summary` endpoint aggregates over all snapshots without any time filtering. While it's not using the range param (it only gets latest per seat), consider whether `totalSnapshots` count should be range-aware.

Currently `totalSnapshots` returns the count of ALL snapshots ever, which is more of a system metric than a dashboard stat. This is fine if intentional.

### M2. 6 Components Each Call `useDashboardEnhanced(range)` Independently

**Files:** All 6 dashboard components

Each component calls `useDashboardEnhanced(range)` independently. React Query will deduplicate these within `staleTime` (30s), so this is **not a bug** -- only one HTTP request is made. However:

- When `range` changes, React Query creates a new cache entry. All 6 components trigger a state update simultaneously.
- This is fine with React 18+ automatic batching, but worth noting for awareness.

**No action needed** -- React Query handles this correctly.

### M3. `formatDate` in Trend Chart May Parse Dates Incorrectly

**File:** `packages/web/src/components/dashboard-trend-chart.tsx` line 23

```ts
const d = new Date(dateStr); // dateStr = "2026-04-04" (date-only string)
```

Date-only strings (without time) are parsed as UTC midnight by the spec. `d.getDate()` then returns the local date, which could be off by one day in certain timezones. The API returns dates formatted in `Asia/Ho_Chi_Minh` timezone, but the frontend parses them in the browser's local timezone.

**Impact:** Dates in the trend chart might display off-by-one for users in negative UTC offsets. Since this is an internal tool (likely all users in Vietnam), this is low risk.

---

## Low Priority

### L1. Unused `range` Prop for Non-Trend Components

Components like `DashboardStatOverview`, `DashboardSeatEfficiency`, `DashboardTeamStats`, `DashboardDetailTable` accept `range` prop but the data they display (latest snapshot per seat, team breakdown) is **not filtered by range** on the API side. Only `usageTrend` uses the range filter.

This means changing the range filter from "month" to "day" causes a re-fetch, but stat cards, team stats, and detail table show the **exact same data**.

**Impact:** Users might expect all data to change when they switch ranges, but only the trend chart changes. This is a UX expectation mismatch.

**Fix options:**
1. Document that range only affects trend chart (add a subtitle)
2. Or pass range only to `DashboardTrendChart` and remove from other components

### L2. Hardcoded Team Badge Variant

**File:** `packages/web/src/components/dashboard-detail-table.tsx` line 104

```tsx
variant={s.team === "dev" ? "default" : "secondary"}
```

Hardcoded team name check. If teams change, this won't adapt.

---

## Positive Observations

- Range validation is done server-side with whitelist approach (RANGE_MS lookup) -- secure against injection
- Query key includes `range` -- cache invalidation is correct
- Hourly grouping for "day" range is a good UX choice
- Component decomposition is clean and follows project conventions
- Error handling is consistent across API routes

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Drop stale TTL index from MongoDB after deployment
2. **[CRITICAL]** Add `{ fetched_at: -1 }` index for full-collection sort performance
3. **[HIGH]** Decide on null vs 0 in trend aggregation -- either filter or handle on frontend
4. **[HIGH]** Document data retention strategy for usage_snapshots
5. **[LOW]** Consider passing `range` only to trend chart component, or filter all data by range

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Dashboard range filter feature is functionally correct with proper input validation. Two critical issues: stale TTL index will silently delete historical data, and unbounded collection scans will degrade over time.
**Concerns:** The TTL index issue (C1) is a **deployment blocker** -- if not addressed, 3month/6month filters will return empty data within 90 days.
