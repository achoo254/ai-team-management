---
phase: 1
name: BE attribution fix + sessions list route
status: completed
priority: P0
---

# Phase 1 — BE attribution fix + sessions list route

## Context Links
- Sibling completed: `../../260410-0839-desktop-telemetry-webhook/`
- Files: `packages/api/src/services/webhook-ingest-service.ts`, `packages/api/src/models/claude-session.ts`
- Webhook schema: `packages/shared/webhook-schema.ts`

## Overview
**Priority:** P0 (blocker cho Phase 3)
**Description:** Fix multi-profile attribution bug + thêm route list Claude sessions phục vụ UI.

## Key Insights
- Desktop app gửi webhook **event-driven** (`on_startup` / `on_change`), không định kỳ → dữ liệu attribute phải chính xác ngay lần insert đầu tiên.
- Payload hiện tại không mang `profile_email` per session (Claude CLI jsonl không ghi account). Không thể fix từ phía desktop (readonly repo).
- Best achievable: pick `is_active` profile tại thời điểm báo cáo, gán cho các session lần đầu thấy → "first-sight-wins".
- `ClaudeSession.session_id` đã unique → upsert by session_id. Chỉ cần tách field attribution sang `$setOnInsert`.

## Requirements

### Functional
1. Bỏ hardcode `profiles[0]` trong `webhook-ingest-service.ts`.
2. Mỗi webhook batch: tìm `active = profiles.find(p => p.is_active)`. Fallback `profiles[0]` nếu không có profile nào active. Fallback `null` nếu `profiles` rỗng.
3. Mỗi session trong batch: upsert bằng `session_id` với:
   - `$set`: tokens, model, started/ended timestamps, `received_at`, `device_id`, `user_id`, `subscription_type`, `rate_limit_tier` (cập nhật mỗi lần, jsonl là source of truth cho usage quota cũng).
   - `$setOnInsert`: `profile_email`, `seat_id` (đóng băng attribution tại insert đầu tiên).
4. Anti-stolen-device check `user.email === payload.member_email` giữ nguyên.
5. Thêm route `GET /api/claude-sessions` (JWT auth):
   - Query: `seat_id` (optional), `profile_email` (optional), `since` (ISO date, default 7 ngày trước), `until` (ISO date, default now), `limit` (default 100, max 500).
   - Permission: admin thấy all; user thường chỉ thấy sessions thuộc seats mà họ là `owner_user_id` hoặc `member_user_ids` của seat.
   - Response: `{ sessions: [...], total: number }`.
   - Sort: `started_at` desc.

### Non-functional
- Không đổi schema `ClaudeSession` model (field `profile_email`, `seat_id` đã tồn tại nullable).
- Không migration legacy data.
- Test qua unit test + integration test (in-memory Mongo via `tests/helpers/db-helper.ts`).

## Architecture

```
webhook-ingest-service.ts (refactor)
  ├─ updateDeviceSnapshot(device, payload)       // existing, kept
  ├─ resolveActiveProfile(payload)               // NEW: pick is_active or fallback
  ├─ resolveActiveSeat(activeProfile)            // NEW: Seat.findOne({ email })
  └─ upsertSessions(device, user_id, active, payload)   // refactor: $setOnInsert attribution

packages/api/src/routes/claude-sessions.ts        // NEW
  └─ GET /  → listClaudeSessions(req.user, filters)

packages/api/src/services/claude-sessions-query-service.ts  // NEW (if logic > 30 LOC)
  └─ listClaudeSessions({ userId, role, filters })
```

## Related Code Files

### Modify
- `packages/api/src/services/webhook-ingest-service.ts` — refactor attribution
- `packages/api/src/index.ts` — mount `/api/claude-sessions`

### Create
- `packages/api/src/routes/claude-sessions.ts` — route handler
- `packages/api/src/services/claude-sessions-query-service.ts` — query + permission logic (nếu cần tách)
- `tests/api/claude-sessions.test.ts` — integration test route
- `tests/services/webhook-ingest-attribution.test.ts` — unit test attribution scenarios

### Read for context
- `packages/api/src/models/claude-session.ts`
- `packages/api/src/models/seat.ts` — hiểu `owner_user_id` / `member_user_ids`
- `packages/api/src/middleware.ts` — `authenticate`, `requireAdmin`
- `packages/shared/webhook-schema.ts`

## Implementation Steps

1. **Refactor `webhook-ingest-service.ts`**
   - Extract `resolveActiveProfile(payload)` trả về `ActiveProfile | null` (type gồm `email, subscription_type, rate_limit_tier, usage`).
   - Extract `resolveActiveSeat(email)` trả về `Seat._id | null`.
   - Rewrite vòng lặp session: chỉ `$setOnInsert` cho `profile_email` / `seat_id` / `subscription_type` / `rate_limit_tier`. Token fields và `usage_*_pct` vẫn `$set`.
   - Giữ `updateDeviceSnapshot` logic cũ.
   - Verify file < 200 LOC, split nếu vượt.

2. **Viết unit tests attribution (`tests/services/webhook-ingest-attribution.test.ts`)**
   - Scenario A: 1 session mới, profile A active → session có `profile_email = A`, `seat_id = seatA._id`.
   - Scenario B: cùng session_id re-ingest với profile B active → `profile_email` vẫn = A (lock by `$setOnInsert`), tokens cập nhật.
   - Scenario C: `profiles[]` rỗng → `profile_email = null`.
   - Scenario D: không có `is_active = true` trong profiles → fallback `profiles[0]`.
   - Scenario E: session thuộc email không match bất kỳ seat nào → `profile_email` set, `seat_id = null`.

3. **Tạo route `packages/api/src/routes/claude-sessions.ts`**
   - `router.use(authenticate)`.
   - Parse query params với validation: `seat_id` (ObjectId), `profile_email`, `since`/`until` (ISO date, default), `limit` (1-500).
   - Gọi service `listClaudeSessions`.
   - Trả `{ sessions, total }`.

4. **Service `claude-sessions-query-service.ts`**
   - Input: `{ user: AuthUser, filters }`.
   - Permission: admin → no seat filter; user thường → compute `allowedSeatIds = await Seat.find({ $or: [{ owner_user_id }, { member_user_ids: userId }] }).distinct('_id')`, force filter `seat_id: { $in: allowedSeatIds }`.
   - Build mongo query: merge seat filter + optional filters + date range.
   - Return `{ sessions, total }` (chạy `find` + `countDocuments` parallel qua `Promise.all`).

5. **Mount route trong `packages/api/src/index.ts`**
   - `import claudeSessionsRoutes from './routes/claude-sessions.js'`
   - `app.use('/api/claude-sessions', claudeSessionsRoutes)`

6. **Integration test `tests/api/claude-sessions.test.ts`**
   - Admin user list all → thấy cả seat A và seat B sessions.
   - Owner user list → chỉ thấy seat A (họ own).
   - Non-owner user list → rỗng.
   - Filter by `seat_id` cụ thể.
   - Filter by date range.
   - Limit enforcement.

7. **Run typecheck + tests**
   - `pnpm -F @repo/api build`
   - `pnpm vitest run tests/services/webhook-ingest-attribution.test.ts tests/api/claude-sessions.test.ts`

## Todo List

- [x] Refactor `webhook-ingest-service.ts` với `$setOnInsert` attribution
- [x] Extract `resolveActiveProfile` / `resolveActiveSeat` helpers
- [x] Viết unit test attribution (5 scenarios A–E)
- [x] Tạo `routes/claude-sessions.ts`
- [x] Tạo `services/claude-sessions-query-service.ts` với permission logic
- [x] Mount route trong `src/index.ts`
- [x] Viết integration test `tests/api/claude-sessions.test.ts` (admin/owner/non-owner/filters)
- [x] `pnpm -F @repo/api build` pass
- [x] `pnpm vitest run` pass các test mới

## Success Criteria
- Attribution test 5 scenarios pass.
- Route `GET /api/claude-sessions` trả đúng data theo permission.
- Typecheck + lint clean.
- Không file mới > 200 LOC.

## Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| `profiles[]` có nhiều `is_active=true` | Attribution pick sai | Dùng `find()` → lấy cái đầu; log warning nếu count > 1 |
| Desktop gửi webhook trước khi user login web → webhook fail do chưa có user | Data loss | Đã handle: `authenticate` chỉ áp cho `/api/devices`, webhook dùng HMAC độc lập |
| Query `countDocuments` chậm với nhiều sessions | Latency UI | Thêm index `{ seat_id: 1, started_at: -1 }` vào `ClaudeSession` model nếu chưa có |
| Permission bypass khi user rời seat | Data leak lịch sử | Chấp nhận: user đã ra khỏi seat không thấy sessions seat đó nữa (recompute `allowedSeatIds` mỗi request) |

## Security Considerations
- Auth: JWT via `authenticate` middleware.
- Authorization: strict seat-scoped filter cho non-admin.
- Không expose `device_id` raw nếu không cần (cân nhắc: hiện tại để expose vì cùng user_id).
- Rate limit: không cần (route read-only, low volume).

## Next Steps
- Phase 2 (Devices UI) có thể bắt đầu song song — không phụ thuộc Phase 1.
- Phase 3 (Sessions UI) cần Phase 1 xong.
