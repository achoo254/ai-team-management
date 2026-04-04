# Phase 5: Testing + Docs

**Status:** done | **Priority:** medium | **Effort:** S
**Depends on:** Phase 1-4

## Goal
Verify end-to-end, cập nhật docs.

## Test Scenarios

### Migration
- [x] Dry-run logs X users, Y seats sẽ update
- [x] Execute: existing assignments giữ nguyên (seat A vẫn thuộc team dev sau migration)
- [x] Backup JSON exports tồn tại + restorable
- [x] Rollback procedure works

### API (integration tests)
- [x] POST /teams as regular user → 201, created_by = self
- [x] PUT /teams/:id by non-owner → 403
- [x] PUT /teams/:id by admin → 200
- [x] DELETE team with seats → 400
- [x] DELETE empty team → 200
- [x] GET /teams?owner=X → returns X's teams only (admin)
- [x] GET /teams?owner=X as user → 403 (admin-only param)
- [x] POST /teams/:id/members by non-owner → 403
- [x] POST /teams/:id/seats with seat not owned → 403
- [x] POST /teams/:id/seats with own seat → 200

### Notifications
- [x] Admin edits user's team → creator nhận telegram + in-app + FCM
- [x] User adds another user to team → target nhận notify (not self)
- [x] User disables telegram → still gets in-app, no telegram
- [x] Self-action (add self) → no notify

### Frontend
- [x] User sees all teams + own badge
- [x] User can create team
- [x] User cannot edit other's team (button hidden)
- [x] Admin filter "by owner" works
- [x] Seat form dropdown shows only user's own teams (user role)
- [x] Dashboard team stats renders all teams dynamically

## Docs Updates
- [x] `docs/system-architecture.md` — update Teams section (ownership model)
- [x] `docs/codebase-summary.md` — update Team/Seat/User fields
- [x] `docs/code-standards.md` — add notification emitter pattern

## Todo
- [x] Write integration tests for teams routes
- [x] Manual E2E test notification channels
- [x] Manual E2E test migration trên staging data
- [x] Update 3 docs files
- [x] Run `pnpm lint` + `pnpm test` — 0 errors
- [x] Grep final: `grep -rn "'dev'\|'mkt'\|'personal'" packages/` → no matches (except comments/docs)

## Success Criteria
- All tests pass
- Docs reflect new model
- Lint clean
- No leftover enum refs in code
