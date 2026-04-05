---
name: Code Review — Dashboard Enrichment + Teams Removal
date: 2026-04-05
reviewer: code-reviewer
plan: plans/dattqh/260404-2348-dashboard-enrichment/
---

# Code Review — Dashboard Enrichment + Teams Removal

## Verdict
**APPROVE with minor follow-ups** · Score **8.5/10**

Build passes (API + Web). Team removal is surgical and complete in runtime code. Dashboard enrichment is well-scoped, scoped correctly for non-admin users, and avoids N+1. Two Minor issues worth fixing before merge, two Nits.

## Scope
- API: `dashboard.ts`, `middleware.ts`, `models/{seat,user}.ts`, `routes/{auth,admin,seats,user-settings}.ts`, `alert-service.ts`, `telegram-service.ts`, `index.ts`
- Web: `dashboard.tsx`, `dashboard-personal-context.tsx` (NEW), `dashboard-welcome.tsx` (NEW), `dashboard-detail-table.tsx`, `dashboard-stat-overview.tsx`, hooks, remove `use-teams`, `team-card`, `team-form-dialog`, `teams.tsx`
- Shared: `types.ts`
- Tests: updated/removed `teams` suites, refreshed `dashboard/admin/auth/seats/hooks`

---

## Critical
None.

## Major
None.

## Minor

### M1 — `/dashboard/personal` rank aggregation is global (no scope)
`dashboard.ts:437-440` aggregates `SessionMetric` across ALL users with no `$match` on date range or on the user's accessible seats. Implications:
- Rank is computed across the entire history → inflates `total` forever (never decays).
- Data leak-ish: response exposes total number of users with session metrics globally. Not PII but does reveal org size to any logged-in user.
- Performance: grows unbounded as history accumulates.

**Fix:** add a rolling window match (e.g., last 30 days) and document semantics in the type, e.g.:
```ts
const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
await SessionMetric.aggregate([
  { $match: { date: { $gte: since } } },
  { $group: { _id: '$user_id', avgDelta5h: { $avg: '$delta_5h_pct' } } },
  { $sort: { avgDelta5h: -1 } },
])
```
Additionally consider only ranking users the caller shares seats with (stricter privacy).

### M2 — Personal ranking sort direction matches "heavy user = rank 1"
Rank #1 is the user with highest `avgDelta5h` (most usage). In the UI this is presented as "Hiệu quả sử dụng" (usage efficiency) with a red color for high values. That framing conflates "heavy" with "efficient"—two different concepts. Either:
- Rename label to "Mức sử dụng" / "Xếp hạng dùng", OR
- Sort by actual efficiency metric (e.g., `utilization_pct` or `impact_ratio`).

File: `dashboard-personal-context.tsx:131-146`, `dashboard.ts:437-452`.

## Nit

### N1 — Vietnamese label typos/diacritics missing
- `dashboard-stat-overview.tsx:82` → `"{n} seat{s} co van de token"` and `"Kiem tra lai OAuth credentials"` — missing diacritics (inconsistent with rest of UI).
- `dashboard-detail-table.tsx:113` → `<Badge>chu</Badge>` → should be `"Chủ"` or `"Owner"`.

### N2 — Stale docs still reference Teams
- `docs/codebase-summary.md` (lines ~30, 51, 129, 155, 222, 318) still documents Team model/route/pages.
- `README.en.md:131` mentions `teams` collection.
- `docs/code-standards.md:438-479` documents `emitTeamEvent` example.
These are docs-only — delegate to `docs-manager` to sync after merge.

### N3 — Migration script `migrate-user-teams.ts` still imports removed refs
`packages/api/src/scripts/migrate-user-teams.ts` is dead code (refs deleted Team model indirectly). Since it's a one-shot script and build doesn't compile it, it's harmless, but consider deleting or renaming to `.bak` to avoid confusion.

### N4 — `dashboard-welcome.tsx` mentions "team"
`"thêm vào team"` copy in welcome screen still references a concept that no longer exists in the product. Reword to "thêm vào seat" for consistency.

---

## Checklist Verification

| Area | Status | Notes |
|---|---|---|
| Concurrency / races | OK | No shared mutable state; Promise.all used correctly |
| Error boundaries | OK | All routes wrap in try/catch, return 500 with message |
| API contracts | OK | Shared `types.ts` matches `/enhanced` shape; `EnhancedDashboardData` in hooks mirrors backend |
| Backwards compat | Breaking (intentional) | JWT payload drops `team_ids`; `/enhanced` drops `teamUsage`. Clients updated in same commit. Existing JWTs will simply not expose `team_ids` — no crash path since nothing reads it. ✓ |
| Input validation | OK | `parseSeatIds` filters invalid ObjectIds; `effectiveIds` intersects with `allowed` for non-admin |
| Auth/authz | OK | `/personal` scoped to `req.user!._id`; `getAllowedSeatIds` correctly merges owned + assigned; admin bypass intact |
| N+1 / efficiency | OK | `/enhanced` batches owner lookup via `User.find({_id:{$in}})`; `tokenIssueCount` + `fullSeatCount` computed in-memory from already-fetched seats (good). /personal uses 3-4 queries total. Indexes present on `SessionMetric.{seat_id,user_id,date}`. |
| Data leaks | Minor (M1) | `/personal` rank exposes global user count; otherwise no PII leaked |

---

## Security Analysis

### `/api/dashboard/personal` — PASS (with M1 caveat)
- Scoped: `userId = req.user!._id` (from JWT)
- No input parsing — cannot be coerced to another user
- Returns only data belonging to caller (`Schedule.find({user_id:userId})`, `Seat.find({owner_id:userId})`, user's own `seat_ids`)
- Rank aggregation leaks only `total` count and caller's own `rank` — low severity

### `/api/dashboard/enhanced` — PASS
- `getAllowedSeatIds` enforces seat scoping for non-admin
- Query-provided `seatIds` is intersected with `allowed` (line 71-73) ✓ cannot bypass
- Owner name lookup only returns names, not emails/secrets

### JWT change — PASS
- Removing `team_ids` from payload is not security-breaking; server re-derives permissions from DB on each request (`getAllowedSeatIds`, `requireSeatOwnerOrAdmin`). No middleware relied on JWT `team_ids`.

---

## Positive Observations
- Clean modular phases, each under 200 LOC.
- `getAllowedSeatIds` is the right abstraction — single source of truth.
- No unbounded DB loops; `/enhanced` keeps `seats.length × O(1)` map lookups.
- `tokenIssueCount` + `fullSeatCount` are computed from already-fetched data, zero extra queries.
- Clean separation of welcome-state UI (`DashboardWelcome`) from main dashboard.
- Permission intersection logic (`effectiveIds`) correctly prevents privilege escalation via query params.

---

## Recommended Actions (Pre-merge)
1. **M1** — Add date-window filter to `/personal` rank aggregation (30 days).
2. **M2** — Rename rank label or change sort metric to actual efficiency.
3. **N1** — Fix Vietnamese diacritics in token warning & owner badge.

## Recommended Actions (Post-merge)
4. **N2** — Delegate `docs-manager` to sync `docs/codebase-summary.md`, `README.en.md`, `docs/code-standards.md`.
5. **N3** — Delete or archive `scripts/migrate-user-teams.ts`.
6. **N4** — Update `dashboard-welcome.tsx` copy.

---

## Metrics
- Build: ✅ pass (both API + Web)
- Lint: not run this pass (trusted per tester report 24/24 pass)
- Linting issues: 0 reported
- Critical: 0 · Major: 0 · Minor: 2 · Nit: 4

## Unresolved Questions
- Should rank be global, team-wide (but teams removed), or per-seat? M2 depends on product intent.
- Does `/personal` need a no-auth guard for deactivated users, or is `authenticate` + valid token sufficient? (Currently sufficient since deactivation blocks login at `/auth/google`, but a stale 24h JWT survives deactivation.)
