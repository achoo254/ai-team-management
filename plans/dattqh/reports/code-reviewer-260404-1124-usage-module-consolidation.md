# Code Review: Usage Module Consolidation

**Date:** 2026-04-04
**Scope:** 4-phase consolidation — UsageLog removal, dashboard rewrite to UsageSnapshot, Telegram update, route rename
**Files changed:** 21 modified, 6 deleted, 1 new
**Build:** PASS | **Lint:** PASS | **Tests:** 28/28 PASS

---

## Overall Assessment

Clean, well-executed consolidation. All dangling references to deleted modules (UsageLog, usage-sync-service, log-usage, week-table) are fully removed from source code. API contracts between backend and frontend are consistent. Tests properly updated. One **high-priority** production concern and several medium items below.

---

## Critical Issues

None.

---

## High Priority

### H1. 2-hour snapshot window returns empty data silently

**Location:** `dashboard.ts` lines 17, 66, 132 (all 3 endpoints) + `telegram-service.ts`

All dashboard endpoints and Telegram report filter `{ fetched_at: { $gte: twoHoursAgo } }`. If the cron collector (`*/30 * * * *`) fails for >2 hours (server restart, API rate limit, network issue), **every dashboard metric returns 0/null** with no indication of staleness.

**Impact:** Users see "0% usage" and think everything is fine. Telegram weekly report on Friday 08:00 could report all zeroes if the collector was down overnight.

**Recommended fix:**
- Option A: Widen window to 4-6 hours (still fresh, more resilient to outage)
- Option B: Remove the time window entirely — just get the latest snapshot per seat (the `$sort + $group` pattern already handles this correctly)
- Option C: Add `last_fetched_at` to the summary response so the frontend can show a "data stale since..." warning

Option B is simplest and most robust — the TTL index already garbage-collects old snapshots at 90 days.

```ts
// Option B: remove $match stage, keep $sort + $group
const latestSnapshots = await UsageSnapshot.aggregate([
  { $sort: { fetched_at: -1 } },
  { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
])
```

### H2. Aggregation performance — full collection scan on 30-day trend

**Location:** `dashboard.ts` line 89-97

The 30-day trend aggregation `$match: { fetched_at: { $gte: thirtyDaysAgo }, seven_day_pct: { $ne: null } }` benefits from the `{ seat_id: 1, fetched_at: -1 }` compound index, but only partially — the query doesn't filter by `seat_id`, so MongoDB may do an index scan on `fetched_at` alone.

The TTL index `{ fetched_at: 1 }` will be used for this query. With 30-min polling and N seats, that's ~N * 1440 docs per 30 days. For small team (<50 seats) this is fine, but add a comment noting the scale assumption.

**Verdict:** OK for current scale. Monitor if seats grow beyond 100.

---

## Medium Priority

### M1. `avgAllPct` in summary counts null snapshots as 0 in average

**Location:** `dashboard.ts` line 23-24

```ts
latestSnapshots.reduce((s, r) => s + (r.seven_day_pct ?? 0), 0) / latestSnapshots.length
```

If a seat has `seven_day_pct: null` (token not configured, API unreachable), it's counted as 0 in the average, pulling the number down. The `stat-cards.tsx` frontend correctly filters nulls (`validSeats.filter(x => x.seven_day_pct !== null)`), but the summary API does not.

**Fix:** Filter null values in the aggregation `$match` stage or in the JS reduce:

```ts
const valid = latestSnapshots.filter(r => r.seven_day_pct != null)
const avgAll = valid.length > 0
  ? Math.round(valid.reduce((s, r) => s + r.seven_day_pct, 0) / valid.length)
  : 0
```

### M2. Team usage breakdown counts null snapshots as 0

**Location:** `dashboard.ts` line 100-106

Same pattern as M1 — `snapshotMap.get(...)?.seven_day_pct ?? 0` treats null as 0. A team with 3 seats where 2 have no token shows avg 33% instead of 100% (from the one real seat).

### M3. Stale docs reference deleted files and routes

**Location:** `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/code-standards.md`

Multiple references to deleted entities:
- `routes/usage-log.ts`, `services/usage-sync-service.ts`, `models/usage-log.ts`
- `pages/usage-log.tsx`, `pages/usage-metrics.tsx`
- `UsageLogs` collection schema with `weekly_all_pct`
- `/api/usage-log/*` endpoints
- `usage-sync-service.ts` in code-standards file naming example

These docs should be updated to reflect the new structure.

### M4. Migration script still references old UsageLog indexes

**Location:** `packages/api/src/scripts/migrate-drop-old-indexes.ts` lines 48-78

The migration script creates indexes on `usage_logs` collection (`seat_id_1_week_start_1_user_id_1`). Since the collection is no longer used, this script should be either:
- Marked as historical/completed (add comment)
- Or deleted if migration is fully deployed

---

## Low Priority

### L1. Variable name `UsageMetricsPage` in `usage.tsx`

The component is still named `UsageMetricsPage` (line 11 of `packages/web/src/pages/usage.tsx`). Not a bug, but inconsistent with the route rename to `/usage`. Consider renaming to `UsagePage` for grep-friendliness.

### L2. Import alias still named `UsageMetricsPage` in `app.tsx`

```ts
import UsageMetricsPage from '@/pages/usage'
```

Works fine, but misleading when reading the router config.

### L3. Telegram inline keyboard text change

`'📝 Log Usage'` -> `'📈 Usage'` — good, but `'📅 Lich phan ca'` still points to `/schedule` which is correct. No issue, just noting the keyboard was reviewed.

---

## Edge Cases Found by Scouting

1. **No dangling imports in source code** — grep for `usage-log`, `UsageLog`, `use-usage-log`, `log-usage`, `usage-sync-service`, `weekly_all_pct` across `packages/` returns zero hits (except the `usage-metrics` redirect in `app.tsx` which is intentional)
2. **`header.tsx` removed `/usage-metrics` title mapping** — users hitting the old URL get redirected to `/usage` which has a title mapping. Correct.
3. **`mobile-nav.tsx` still imports `BarChart3`** — used for the Usage icon. No issue.
4. **`sendWeeklyReport` no longer calls `getCurrentWeekStart()`** — import removed, function from deleted `usage-sync-service`. Clean.
5. **`colSpan` in `usage-table.tsx` updated from 4 to 5** — matches the new 5-column layout. Correct.

---

## Positive Observations

- Consistent null-handling pattern (`?? null` for missing snapshots) across all endpoints
- `Map` used instead of plain `Record` for snapshot lookups — better perf and cleaner API
- Telegram report gracefully shows "Chua co du lieu" when both pct values are null
- Redirect from `/usage-metrics` to `/usage` preserves bookmarks
- Tests properly updated: mock data shapes match new API contracts, deleted test files for removed modules
- Extra usage credits surfaced in Telegram report (bonus feature)

---

## Recommended Actions

1. **[HIGH] Fix H1** — Widen or remove the 2-hour time window on snapshot queries. Strongest recommendation: remove `$match` on `fetched_at` entirely (Option B).
2. **[MEDIUM] Fix M1/M2** — Filter null `seven_day_pct` values from averages to match frontend behavior.
3. **[MEDIUM] Fix M3** — Update `system-architecture.md` and `codebase-summary.md` to remove UsageLog references.
4. **[LOW] Fix M4** — Add "completed" comment to migration script or delete it.
5. **[LOW] Rename L1/L2** — `UsageMetricsPage` -> `UsagePage` for consistency.

---

## Metrics

- **Build:** PASS (web + api)
- **Lint:** 0 errors
- **Tests:** 28/28 passed (1.38s)
- **Deleted tests:** 3 files (usage-log.test.ts, use-usage-log.test.ts, usage-sync-service.test.ts) — all related to removed functionality

---

## Unresolved Questions

1. Is the `usage_logs` MongoDB collection being intentionally preserved for historical data, or should a migration drop it? The code no longer reads from it, but the `migrate-drop-old-indexes.ts` script still manipulates its indexes.
2. Should the `/api/dashboard/summary` endpoint be deprecated? No frontend consumer found — only the `/enhanced` and `/usage/by-seat` endpoints are used by the SPA.
