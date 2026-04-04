# Phase 5: Testing + Docs

**Status:** pending | **Priority:** medium | **Effort:** S
**Depends on:** Phase 1-4

## Goal
Verify end-to-end, cập nhật docs.

## Test Scenarios

### Migration
- [ ] Dry-run logs X users, Y seats sẽ update
- [ ] Execute: existing assignments giữ nguyên (seat A vẫn thuộc team dev sau migration)
- [ ] Backup JSON exports tồn tại + restorable
- [ ] Rollback procedure works

### API (integration tests)
- [ ] POST /teams as regular user → 201, created_by = self
- [ ] PUT /teams/:id by non-owner → 403
- [ ] PUT /teams/:id by admin → 200
- [ ] DELETE team with seats → 400
- [ ] DELETE empty team → 200
- [ ] GET /teams?owner=X → returns X's teams only (admin)
- [ ] GET /teams?owner=X as user → 403 (admin-only param)
- [ ] POST /teams/:id/members by non-owner → 403
- [ ] POST /teams/:id/seats with seat not owned → 403
- [ ] POST /teams/:id/seats with own seat → 200

### Notifications
- [ ] Admin edits user's team → creator nhận telegram + in-app + FCM
- [ ] User adds another user to team → target nhận notify (not self)
- [ ] User disables telegram → still gets in-app, no telegram
- [ ] Self-action (add self) → no notify

### Frontend
- [ ] User sees all teams + own badge
- [ ] User can create team
- [ ] User cannot edit other's team (button hidden)
- [ ] Admin filter "by owner" works
- [ ] Seat form dropdown shows only user's own teams (user role)
- [ ] Dashboard team stats renders all teams dynamically

## Docs Updates
- [ ] `docs/system-architecture.md` — update Teams section (ownership model)
- [ ] `docs/codebase-summary.md` — update Team/Seat/User fields
- [ ] `docs/code-standards.md` — add notification emitter pattern

## Todo
- [ ] Write integration tests for teams routes
- [ ] Manual E2E test notification channels
- [ ] Manual E2E test migration trên staging data
- [ ] Update 3 docs files
- [ ] Run `pnpm lint` + `pnpm test` — 0 errors
- [ ] Grep final: `grep -rn "'dev'\|'mkt'\|'personal'" packages/` → no matches (except comments/docs)

## Success Criteria
- All tests pass
- Docs reflect new model
- Lint clean
- No leftover enum refs in code
