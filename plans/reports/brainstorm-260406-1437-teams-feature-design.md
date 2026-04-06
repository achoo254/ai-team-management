# Brainstorm: Teams Feature Design

**Date:** 2026-04-06
**Status:** Approved → Ready for Plan

---

## Problem Statement

Cần thêm tính năng "Teams" để nhóm người dùng có thể view tất cả seats thuộc team mà không cần assign từng user vào từng seat. Hiện tại `seat_ids` chỉ hỗ trợ individual assignment.

## Key Question: Có duplicate seat_ids không?

**Không.** Hai concept phục vụ mục đích khác nhau:

| | `seat_ids` (hiện tại) | Teams (mới) |
|---|---|---|
| **Mục đích** | Individual access + interact (alerts, schedule) | Group view visibility |
| **Granularity** | 1 user → 1 seat | 1 user → 1 team → N seats |
| **Quản lý** | Admin assign manual | Admin/Seat owner tạo team |
| **Kết quả** | User thấy seat đó | User thấy tất cả seats trong team |

## Evaluated Approaches

### A: Team Model riêng ✅ CHOSEN

```
Team {
  name: string (required, unique)
  description?: string
  seat_ids: ObjectId[]
  member_ids: ObjectId[]
  owner_id: ObjectId
  created_at: Date
}
```

- **Pros:** Clean separation, easy query, proper ownership
- **Cons:** New collection, need sync khi seat bị xóa
- **Effort:** ~2-3 ngày

### B: Tag-based grouping ❌

- Thêm `team_tags[]` vào Seat + User, match bằng string
- **Rejected:** No ownership, typo-prone, hard to manage

### C: Bulk assign (no new model) ❌

- Bulk UI để assign nhanh seat_ids
- **Rejected:** Không có real team concept, no group visibility

## Final Design

### Schema

```typescript
// packages/api/src/models/team.ts
Team {
  name: string          // required, unique
  description?: string
  seat_ids: ObjectId[]  // ref: Seat - seats in this team
  member_ids: ObjectId[] // ref: User - users who can view
  owner_id: ObjectId    // ref: User - creator (admin/seat owner)
  created_at: Date
}
```

### Access Logic

**`getAllowedSeatIds(user)` mới:**

```
if admin → all seats (unchanged)
else →
  owned seats (Seat.owner_id = user._id)
  + assigned seats (user.seat_ids)
  + team seats (Team where member_ids contains user._id → flatten seat_ids)
  = deduplicated final set
```

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/teams` | Auth | List teams user thuộc (admin: all) |
| POST | `/api/teams` | Admin/SeatOwner | Tạo team |
| PUT | `/api/teams/:id` | Owner/Admin | Update name, seats, members |
| DELETE | `/api/teams/:id` | Owner/Admin | Xóa team (không xóa seats) |

### Business Rules

1. **Seat owner** chỉ add seats mình sở hữu vào team
2. **Admin** add bất kỳ seat
3. **Xóa seat** (soft delete) → auto remove khỏi tất cả teams (Mongoose middleware)
4. **Dashboard** không thay đổi UI, chỉ thấy thêm seats qua `getAllowedSeatIds()`
5. **Alerts/Schedule** vẫn yêu cầu `seat_ids` assignment riêng
6. **1 user** có thể thuộc nhiều teams
7. **1 seat** có thể thuộc nhiều teams

### Không thay đổi

- `seat_ids` trên User → giữ nguyên
- `watched_seats` → vẫn per-user, không auto-add khi join team
- Dashboard UI → không thêm team filter (chưa cần)

## Risks

1. **Query performance:** thêm 1 lookup Team collection trong `getAllowedSeatIds()` — mitigate bằng index trên `member_ids`
2. **Stale data:** seat bị xóa nhưng vẫn trong team.seat_ids — mitigate bằng Mongoose middleware
3. **Permission creep:** team member auto thấy seats mới add vào team — đây là intended behavior

## Next Steps

→ Tạo implementation plan chi tiết
