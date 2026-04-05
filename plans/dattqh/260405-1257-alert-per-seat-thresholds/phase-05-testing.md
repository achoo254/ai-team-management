# Phase 05 — Testing + Docs

**Priority:** P1 | **Status:** completed | **Depends on:** Phases 01-04

## Context

- Test dir: `tests/` (api, hooks, ui, services)
- Vitest workspace: `vitest.workspace.ts`
- Test helper: `tests/helpers/db-helper.ts`
- Docs: `docs/` (update system-architecture, codebase-summary)

## Requirements

### API Tests

**File:** `tests/api/watched-seats.test.ts` (new)

Cover:
- POST /api/user/watched-seats — happy path, duplicate, invalid seat, access denied
- PUT /api/user/watched-seats/:seatId — update existing, 404 not watching, clamp values
- DELETE /api/user/watched-seats/:seatId — idempotent

**File:** `tests/api/user-settings.test.ts` (update existing)
- `alert_settings` payload accepts new 3-field shape, rejects legacy fields silently (migration)
- GET returns `watched_seats` with populated seat labels

### Service Tests

**File:** `tests/services/alert-service.test.ts` (update existing)

Cover:
- Per-user dedup: 2 users watching seat with thresholds 80/95 → usage 90% → user A alerted, user B not
- Repeated cron ticks: already-alerted user skipped in 24h window
- 7d check uses max of (7d_total, 7d_sonnet, 7d_opus)
- `telegram_enabled=false` → no Telegram send, still creates Alert record
- `token_failure_enabled=false` → user skipped for token_failure type
- Seat-wide alerts (usage_exceeded, session_waste, 7d_risk) create `user_id=null` records

### Hook Tests

**File:** `tests/hooks/use-watched-seats.test.tsx` (new)
- Mutation hooks invalidate `['user-settings']` on success
- Error state surfaces via TanStack Query

### UI Tests

**File:** `tests/ui/watch-threshold-popover.test.tsx` (new)
- Sliders update local state
- Save calls correct mutation (create vs update)
- Cancel discards changes
- Validation: clamp 1-100

**File:** `tests/ui/alert-settings-form.test.tsx` (update existing)
- Threshold inputs removed from DOM
- Telegram toggle present, disabled without bot

### Docs Updates

**File:** `docs/system-architecture.md`
- Update Alert section: describe per-user-per-seat threshold model
- Dedup key change: (user, seat, type, window)
- Remove extra_credit from alert type list

**File:** `docs/codebase-summary.md`
- New API endpoints: `/api/user/watched-seats` CRUD
- New components listed

**File:** `CLAUDE.md` (root)
- Update "Key Domain Rules" — "Alerts are per-user-per-seat" (was "per-user")
- Update "MongoDB collections" note if Alert schema significantly changed

## Related Files

**Create:**
- `tests/api/watched-seats.test.ts`
- `tests/hooks/use-watched-seats.test.tsx`
- `tests/ui/watch-threshold-popover.test.tsx`

**Modify:**
- `tests/api/user-settings.test.ts`
- `tests/services/alert-service.test.ts`
- `tests/ui/alert-settings-form.test.tsx`
- `docs/system-architecture.md`
- `docs/codebase-summary.md`
- `CLAUDE.md`

## Implementation Steps

### Step 1: API tests first (TDD-lite)
Write watched-seats endpoint tests. Run, confirm pass after Phase 02 complete.

### Step 2: Service tests
Focus on dedup logic — most critical. Seed 2 users with different thresholds, 1 snapshot, verify alert records.

### Step 3: Hook + UI tests
Standard RTL + MSW patterns (follow existing tests).

### Step 4: Run full suite
`pnpm test` — must be green.
`pnpm test:coverage` — check alert-service coverage stays ≥ existing baseline.

### Step 5: Docs update
Delegate to `docs-manager` agent OR inline edits. Prefer inline for conciseness.

### Step 6: Manual smoke test
- Seed 2 users, 2 seats in dev DB
- User A watches both seats with different thresholds
- User B watches 1 seat
- Trigger usage collection manually or wait cron
- Verify alerts fire correctly per user

## Todo

- [ ] Write watched-seats API tests
- [ ] Update user-settings API tests
- [ ] Update alert-service tests (per-user dedup cases)
- [ ] Write watched-seats hook tests
- [ ] Update alert-settings-form UI tests
- [ ] Write watch-threshold-popover UI tests
- [ ] `pnpm test` all green
- [ ] Update `docs/system-architecture.md`
- [ ] Update `docs/codebase-summary.md`
- [ ] Update root `CLAUDE.md`
- [ ] Manual smoke test with seeded data

## Success Criteria

- `pnpm test` passes fully.
- Coverage on alert-service ≥ current baseline.
- Manual smoke test: 2 users see different alerts per their thresholds.
- Docs reflect new architecture.
- No TypeScript errors anywhere.

## Risks

- **Test flakiness with time-based dedup**: Use `vi.useFakeTimers()` for 24h window tests.
- **MongoMemoryServer index conflicts**: Clean collections between tests (existing helper pattern).

## Security

- Test cases include access-denied paths (user can't watch seat they don't own/assigned).
- Verify alert feed doesn't leak other users' personal alerts.
