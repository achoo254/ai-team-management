# Brainstorm: User-Created Teams + Admin View

**Date:** 2026-04-04 22:08
**Scope:** Cho phép user tự tạo team (gom seat + người), admin view all + filter by user

## Problem Statement

Hiện tại Team chỉ admin tạo/sửa/xóa. `Seat.team` và `User.team` hardcode enum `'dev'|'mkt'|'personal'`. Yêu cầu: user tự tạo team, gom seat mình sở hữu + users có sẵn, admin full CRUD + filter by user.

## Requirements (from discovery)

| # | Decision |
|---|---|
| Mục đích | Gom cả seat + người vào team user tạo |
| Quan hệ team cũ/mới | **Thay thế luôn** — bỏ admin-only constraint, mọi user tạo team |
| Phạm vi seat | User chỉ gom seat mình owner |
| Enum handling | **Migrate sang dynamic** — Seat/User.team reference Team.name |
| Seat-team cardinality | 1 seat = 1 team |
| User-team cardinality | **1 user = nhiều team** (User.teams: string[]) |
| Membership | Gom user có sẵn (no invite flow) |
| Admin rights | Full CRUD mọi team |
| Team visibility | All teams public — mọi user đều thấy |
| Tên team unique | **Bỏ unique constraint** — trùng giữa owners được |
| Notification rule | Mọi action admin/owner tác động user khác → notify qua settings channels |

## Evaluated Approaches

### A. Migration thẳng (CHỌN)
Loosen enum → string, thêm `created_by` vào Team, seed 3 team mặc định, ownership check thay `requireAdmin`.
- ✅ Clean, KISS, match yêu cầu "thay thế luôn"
- ⚠️ Breaking change, cần migration script

### B. Dual model (system + personal team)
Giữ enum cũ + thêm `user_teams[]`, Team.type='system'|'personal'.
- ❌ Vi phạm KISS, 2 concept song song, không match "thay thế luôn"

### C. Virtual grouping UI-only
Team chỉ client-side, không đụng DB.
- ❌ Không persist, không query, không share → fail requirement

## Recommended Solution: Approach A

### Data Model

**Team** (thêm field):
```ts
{
  _id, label, color, created_at,
  name: string,              // KHÔNG unique nữa
  created_by: ObjectId<User> // NEW
}
```

**User** (array):
```ts
teams: string[]  // was team?: 'dev'|'mkt'
```

**Seat** (relax type):
```ts
team: string | null  // was 'dev'|'mkt'|'personal'
```

**Lookup key:** Vì name không unique, nội bộ dùng `_id` làm reference. Seat.team và User.teams có thể chứa `team_id` (string ObjectId) hoặc đổi sang `team_ids`. → **Quyết định: chuyển sang ObjectId reference** (`Seat.team_id`, `User.team_ids: ObjectId[]`).

### Access Control

| Action | User | Admin |
|---|---|---|
| GET /teams | Tất cả | Tất cả + `?owner=userId` filter |
| POST /teams | ✓ (created_by=self) | ✓ |
| PUT /teams/:id | created_by===self | any |
| DELETE /teams/:id | created_by===self | any |
| POST /teams/:id/seats | seat owner===self AND team created_by===self | any |
| POST /teams/:id/members | team created_by===self | any |

### API Endpoints (new/changed)

```
GET    /api/teams                      // + optional ?owner=userId
POST   /api/teams                      // auth only (bỏ requireAdmin)
PUT    /api/teams/:id                  // ownership check
DELETE /api/teams/:id                  // ownership check
POST   /api/teams/:id/members          // body: { user_id }
DELETE /api/teams/:id/members/:userId
POST   /api/teams/:id/seats            // body: { seat_id }
DELETE /api/teams/:id/seats/:seatId
```

### Notification Integration

**Rule:** Action không do user tự thao tác → notify user affected qua channels đã config (telegram, push desktop, in-app).

Trigger points:
- Admin edit/delete team do user tạo → notify creator
- Admin add/remove user khỏi team → notify user bị add/remove
- Owner team add/remove user → notify user bị tác động
- Admin reassign seat.team → notify seat owner

Reuse: `services/alert-service.ts` + `services/telegram-service.ts` + FCM push. Thêm event types mới (`team.member_added`, `team.member_removed`, `team.deleted_by_admin`, `team.seat_reassigned`, etc).

### Migration Script

`packages/api/src/scripts/migrate-teams.ts`:
1. Backup collections trước khi chạy.
2. Đảm bảo 3 team mặc định `dev`, `mkt`, `personal` tồn tại với `created_by = <first admin>`.
3. Convert User.team (string enum) → User.team_ids: [ObjectId] (lookup theo name).
4. Convert Seat.team (string enum) → Seat.team_id: ObjectId.
5. Dry-run mode trước khi execute.

### Files Impact

**Backend:**
- Models: `team.ts` (+created_by, bỏ unique), `user.ts` (team_ids), `seat.ts` (team_id)
- Routes: `teams.ts` (rewrite access control + members endpoints), `seats.ts`, `dashboard.ts`, `admin.ts`, `auth.ts`
- Services: `telegram-service.ts`, `alert-service.ts` (+ new notification events)
- Scripts: NEW `migrate-teams.ts`

**Frontend:**
- `pages/teams.tsx` — show all teams, owner badge, conditional actions, admin filter dropdown
- `components/team-form-dialog.tsx` — add Members tab
- `components/team-card.tsx` — show creator
- `pages/seats.tsx` + seat forms — dynamic team dropdown
- `hooks/use-teams.ts` — +useTeamMembers, useAddMember, useRemoveMember, useAssignSeat
- `components/dashboard-team-stats.tsx` — dynamic team fetching

**Shared:**
- `packages/shared/types.ts` — Team, User, Seat updates

### Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Data loss migration | Dry-run + backup |
| Hardcoded 'dev'/'mkt'/'personal' còn sót | Grep toàn repo, replace |
| dashboard-team-stats UI break | Fetch team list động |
| Telegram group-by-team break | Update telegram-service.ts |
| Name trùng gây confusion UX | Hiển thị kèm owner name trong UI (vd: "Dev — by dat@") |
| Notification spam | Respect user notification settings per channel |

### Success Criteria

- User tạo/edit/delete team của mình ✓
- Admin filter team by owner ✓
- Seat owner gán seat vào team mình tạo ✓
- Add/remove user vào team mình tạo ✓
- Mọi action tác động user khác → notification gửi đúng channel ✓
- Migration giữ nguyên seat/user assignments cũ ✓
- Không còn hardcode enum 'dev'|'mkt'|'personal' ✓

## Next Steps

1. Audit toàn repo grep `'dev'|'mkt'|'personal'` để identify hotspots
2. Viết migration script + test dry-run trên data staging
3. Tạo plan với phases: migration → backend → notifications → frontend → testing

## Unresolved Questions

- Có cần rate-limit số team 1 user được tạo không? (tránh spam)
- Khi user bị xóa khỏi hệ thống, cleanup teams created_by user đó thế nào? (cascade delete? transfer ownership?)
- Team có cần field `description` không? (hiện tại chỉ có name + label + color)
