---
name: User-Created Teams (Personal Teams)
status: pending
created: 2026-04-04
branch: main
phases: 5
blockedBy: []
blocks: []
---

# User-Created Teams (Personal Teams)

## Context
- [Brainstorm Report](../reports/brainstorm-260404-2208-user-teams-personal.md)
- Builds on completed [User Self-Service Seats](../260404-1644-user-self-service-seats/plan.md) (Seat.owner_id)
- Leverages notification infra from [Alert Feed Refactor + FCM](../260404-2043-alert-feed-refactor-fcm/plan.md) (commit 723ad87)

## Problem
- Team chỉ admin tạo → user không tự tổ chức seat/người theo nhu cầu
- `Seat.team` + `User.team` hardcode enum `'dev'|'mkt'|'personal'` → không linh hoạt
- Admin không filter teams by owner

## Solution
- Bỏ admin-only: mọi user CRUD team của mình
- Team thêm `created_by`, bỏ unique name
- Seat.team → Seat.team_id (ObjectId ref)
- User.team (enum) → User.team_ids: ObjectId[] (nhiều team)
- All teams public visibility, admin full CRUD + filter by owner
- User chỉ gán seat mình owner vào team
- Notification: admin/owner action tác động user khác → notify qua telegram/FCM/in-app

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Models + Migration Script](./phase-01-models-migration.md) | pending | M |
| 2 | [Backend Routes + Access Control](./phase-02-backend-routes.md) | pending | L |
| 3 | [Notification Integration](./phase-03-notifications.md) | pending | M |
| 4 | [Frontend (Pages + Hooks)](./phase-04-frontend.md) | pending | L |
| 5 | [Testing + Docs](./phase-05-testing.md) | pending | S |

## Key Decisions
- **ObjectId refs** thay vì string name (vì bỏ unique name)
- **User.team_ids: ObjectId[]** (multi-team), **Seat.team_id: ObjectId** (1:1)
- **Migration script** dry-run + backup → seed 3 team mặc định → convert enum
- **Reuse alert-service + telegram + FCM** cho notification events mới
- **Ownership check** middleware mới: `requireTeamOwnerOrAdmin`
- UI hiển thị `"{label} — by {owner}"` để phân biệt teams trùng tên

## Risks
- Data loss migration → dry-run + backup
- Hardcoded 'dev'/'mkt'/'personal' còn sót → grep sạch
- dashboard-team-stats UI break → fetch team list động

## Success Criteria
- User CRUD own teams, admin full CRUD ✓
- Seat owner assigns own seats to own teams ✓
- Team members (user_ids) add/remove work ✓
- Notifications fire for admin/owner actions affecting others ✓
- Migration giữ nguyên seat/user assignments ✓
- Zero hardcoded 'dev'|'mkt'|'personal' ✓
