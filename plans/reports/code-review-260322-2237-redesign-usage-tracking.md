# Code Review: Redesign Usage Tracking (Session -> Weekly %)

**Date:** 2026-03-22
**Scope:** 19 files, ~377 additions / 285 deletions
**Focus:** SQL correctness, Alpine bindings, dangling old-schema refs, security, error handling

---

## Overall Assessment

Clean, well-structured redesign. Schema migration, backend services, routes, and frontend all align on the new weekly percentage model. No dangling references to old schema in the main codebase (old refs only exist in `.claude/worktrees/hungry-stonebraker/` which is a stale worktree). SQL tuple `IN` subquery syntax verified working on better-sqlite3.

---

## Critical Issues

### C1. No server-side validation on percentage values
**File:** `server/routes/usage-log-routes.js:15-23`
**Impact:** User can POST `weeklyAllPct: 999` or `weeklyAllPct: -50` or non-numeric values. The `|| 0` fallback only covers falsy, not out-of-range.

```js
// Current
weeklyAllPct: weeklyAllPct || 0,

// Recommended — add before logUsage call
const allPct = Math.max(0, Math.min(100, parseInt(weeklyAllPct) || 0));
const sonnetPct = Math.max(0, Math.min(100, parseInt(weeklySonnetPct) || 0));
```

Also consider adding a `CHECK(weekly_all_pct BETWEEN 0 AND 100)` constraint in the schema.

### C2. Migration drops `usage_logs` table unconditionally on old schema
**File:** `server/db/migrations.js:9-12`
**Impact:** If the app was previously running with old session-based data, `DROP TABLE usage_logs` destroys all historical data without backup. This is acceptable for a dev/internal tool but would be critical in production.

**Recommendation:** Add a comment acknowledging intentional data loss, or consider renaming old table to `usage_logs_v1_backup`.

---

## High Priority

### H1. Telegram service does not check/log HTTP response status
**File:** `server/services/telegram-service.js:45-49`
**Impact:** Silent failure if Telegram API returns 4xx/5xx. The `fetch()` call resolves on any HTTP status.

```js
const resp = await fetch(url, { ... });
if (!resp.ok) {
  const body = await resp.text();
  throw new Error(`Telegram API ${resp.status}: ${body}`);
}
```

### H2. `no_activity` alert logic only checks current week
**File:** `server/services/alert-service.js:41-55`
**Impact:** `config.alerts.inactivityWeeks` is set to 1 but never used. The query checks `week_start >= weekStart` (current Monday). If run on Monday before anyone logs, all seats with prior history trigger `no_activity` alerts. Consider using `inactivityWeeks` to offset:

```js
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - (config.alerts.inactivityWeeks * 7));
const cutoffStr = cutoff.toISOString().split('T')[0];
```

### H3. Dashboard by-seat query may return duplicate rows for seats with multiple logs in same week
**File:** `server/routes/dashboard-routes.js:47-51`
The subquery `SELECT seat_email, MAX(week_start) FROM usage_logs GROUP BY seat_email` returns one row per seat. But if multiple users logged for the same seat in the same week (unique constraint is per `seat_email + week_start + user_id`), the outer `WHERE (seat_email, week_start) IN (...)` will return multiple rows per seat.

**Fix:** Aggregate in subquery or use `GROUP BY seat_email` with `MAX/AVG` on pct columns in the outer query.

### H4. Same issue in alert-service high_usage query
**File:** `server/services/alert-service.js:26-33`
Same multi-row-per-seat issue as H3 — will create duplicate alerts for the same seat if multiple users logged. `insertIfNew` deduplicates by date, but it's still wasteful and the percentage shown may not represent the seat's overall usage.

---

## Medium Priority

### M1. `getCurrentWeekStart()` duplicated in frontend and backend
**Files:** `server/services/usage-sync-service.js:4-10`, `public/js/dashboard-helpers.js:7-13`
Identical logic. Not a bug, but if the Monday-calculation changes, both must be updated. Acceptable for a small project but worth noting.

### M2. No `weekStart` format validation
**File:** `server/routes/usage-log-routes.js:16`
User can send `weekStart: "not-a-date"` or a non-Monday date. Consider validating format and ensuring it's actually a Monday.

### M3. Firebase API key exposed in `login.html`
**File:** `public/login.html:79-86`
Firebase client config (apiKey, appId, etc.) is visible in HTML source. This is by-design for Firebase client SDK (it's not a secret key — security is enforced by Firebase Security Rules). Just ensure Firebase project has proper domain restrictions configured.

### M4. `chart.js` still loaded but unused
**File:** `public/index.html:9`
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```
No chart references in any view. Remove to save ~200KB load.

### M5. `logUsage()` does INSERT without ON CONFLICT handling
**File:** `server/services/usage-sync-service.js:18-21`
The UNIQUE constraint `(seat_email, week_start, user_id)` means the INSERT will throw on duplicate. The route catches this (line 28-29), but consider using `INSERT OR REPLACE` or `ON CONFLICT UPDATE` to allow users to update their weekly log.

---

## Low Priority

### L1. Express 5.x in use
**File:** `package.json:21` — `express: ^5.2.1`
Express 5 is relatively new. Ensure all middleware and error handling patterns are compatible. No issues spotted in current code.

### L2. Alpine.js loaded from `@3.x.x` CDN (unpinned minor/patch)
**File:** `public/index.html:107`
Could break on Alpine breaking changes. Pin to specific version like `3.14.x`.

### L3. `cors({ origin: true })` allows all origins
**File:** `server/index.js:15`
For internal tool this is fine. For production, restrict to known origins.

---

## Dangling Reference Check

| Old reference | Status |
|---|---|
| `sessions` column | CLEAN — removed from schema and all queries |
| `tokens_before/after` | CLEAN — removed |
| `purpose`, `project` | CLEAN — removed |
| `importCsv` | CLEAN — removed from admin-routes |
| `session_spike`, `limit_warning` alert types | CLEAN — migration deletes old rows, new CHECK constraint only allows `high_usage`, `no_activity` |

Old references only exist in `.claude/worktrees/hungry-stonebraker/` (stale git worktree, not part of main codebase).

---

## Positive Observations

- Clean schema design with proper UNIQUE constraints and indexes
- Migration handles both old-to-new transition and fresh installs
- Consistent error handling with try/catch in all routes
- Alpine.js state management is well-organized with separate helper/admin files
- Telegram integration is lightweight (native fetch, no extra deps)
- UNIQUE constraint catch for user-friendly 409 error on duplicate log
- Good use of `COALESCE` for null-safe aggregation in dashboard queries

---

## Recommended Actions (Priority Order)

1. **[Critical]** Add server-side validation for pct values (0-100 range, integer)
2. **[High]** Fix by-seat query to aggregate when multiple users log same seat/week
3. **[High]** Add Telegram API response check
4. **[High]** Use `inactivityWeeks` config value in no_activity alert logic
5. **[Medium]** Validate `weekStart` format and ensure it's a Monday
6. **[Medium]** Remove unused chart.js import
7. **[Low]** Pin Alpine.js CDN version

---

## Metrics

| Metric | Value |
|---|---|
| Type Coverage | N/A (vanilla JS, no TypeScript) |
| Test Coverage | 0% (no tests) |
| Linting Issues | Not configured (no eslint) |
| Security Issues | 1 medium (no input validation on pct) |
| SQL Correctness | 1 high (multi-row per seat in by-seat join) |

---

## Unresolved Questions

1. Should users be able to update their weekly log, or is one-log-per-week-per-user intentional?
2. Is the stale worktree at `.claude/worktrees/hungry-stonebraker/` safe to delete?
3. Should the Telegram cron also trigger `checkAlerts()` before sending the report?
