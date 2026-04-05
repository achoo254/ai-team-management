# Research: Anthropic Admin API — Endpoints bổ sung để làm giàu data

**Date:** 2026-04-05 | **Context:** BE hiện **chỉ gọi 1 endpoint** production: `/v1/organizations/usage_report/claude_code` (xem `packages/api/src/services/anthropic-service.ts:38`). Hàm `getMembers()` có export nhưng chưa wire vào service/route nào (chỉ có test). Tìm thêm endpoint **miễn phí** (Admin API, dùng `sk-ant-admin...` key) để enrich analytics.

## TL;DR

Admin API **toàn bộ miễn phí** (không tính tiền per-call), chỉ yêu cầu org có admin role. Giả định org là **Claude Team subscription** (dựa vào project context quản lý seat subscription), các endpoint API PAYG-only sẽ trả về rỗng → loại bỏ.

**Endpoint NÊN thêm:**

| Endpoint | Giá trị | Priority |
|---|---|---|
| `GET /v1/organizations/users` | Email, org-role (wire `getMembers()` đang có sẵn → join vào User model) | **HIGH** |
| `GET /v1/organizations/me` | Org name/id (hiển thị header, branding) | LOW |
| `GET /v1/organizations/invites` | Pending invites (visibility onboarding) | LOW |

**Endpoint CONDITIONAL (chỉ thêm nếu org có dùng workspaces/API keys):**

| Endpoint | Điều kiện |
|---|---|
| `GET /v1/organizations/workspaces` + `/workspaces/{id}/members` | Nếu org phân chia seats theo nhiều workspace (không phải default) |
| `GET /v1/organizations/api_keys` | Nếu có dev tạo API key (không chỉ Claude Code subscription) |

**Endpoint BỎ QUA (API PAYG only, Team subscription org trả rỗng):**
- `usage_report/messages` — chỉ track Messages API PAYG
- `cost_report` — chỉ track API PAYG cost

## Chi tiết endpoints NÊN thêm

### 1. `/v1/organizations/users` (HIGH — đã có `getMembers()` sẵn, chưa wire)
- Fields: `id`, `type`, `email`, `name`, `role` (user/claude_code_user/developer/billing/admin), `added_at`
- **Dùng để:** join với `User` model trong DB. Hiện BE có model User nhưng có thể chưa sync org-role từ Anthropic.
- **Giá trị enrichment:** biết ai là admin/developer, email chính xác, join với `usage_report/claude_code` qua `actor.email_address`.

### 2. `/v1/organizations/me` (LOW)
- Response: `{ id, type, name }`
- Gọi 1 lần lúc app init, cache vĩnh viễn.
- Hiển thị org name trên dashboard header.

### 3. `/v1/organizations/invites` (LOW)
- Fields: `id`, `email`, `role`, `invited_at`, `expires_at`, `status`
- Invites tự expire sau 21 ngày.
- Admin dashboard có thể hiển thị "Pending invites" widget.

## Kiểm tra fields claude_code đã dùng hết chưa

Endpoint hiện tại trả về per-user-per-day:

```
dimensions: date, actor (user_actor.email_address | api_actor.api_key_name),
            organization_id, customer_type (api|subscription),
            terminal_type (vscode|iTerm.app|tmux|...)
core_metrics: num_sessions, lines_of_code.{added,removed},
              commits_by_claude_code, pull_requests_by_claude_code
tool_actions: edit_tool, multi_edit_tool, write_tool, notebook_edit_tool
              → {accepted, rejected} (acceptance rate = key productivity metric)
model_breakdown[]: model, tokens.{input,output,cache_read,cache_creation},
                   estimated_cost.{amount,currency}
```

**Action:** grep `usage-collector-service.ts` để verify đang lưu đủ fields chưa. Nhiều khả năng còn bỏ sót (nhất là `tool_actions`, `terminal_type`, `commits_by_claude_code`, `pull_requests_by_claude_code`).

## Recommendation (KISS)

**Phase 1 — quick wins:**
1. **Verify `usage-collector-service.ts`** đã ingest hết fields từ `claude_code` response chưa. Enrichment lớn nhất nằm ở đây, không phải thêm endpoint mới.
2. **Wire `getMembers()`** vào collector/sync job → lưu email + org-role vào User model.
3. Thêm `GET /me` → cache org name.

**Phase 2 — conditional:**
4. Check org có multi-workspace không (qua Console) → nếu có, thêm `/workspaces` + `/workspace_members` để thêm dimension workspace cho analytics.
5. Thêm `/api_keys` nếu có dev tạo key.
6. Thêm `/invites` nếu cần onboarding widget.

## Caveats

- Admin API = **free** nhưng yêu cầu Team/Enterprise tier + admin role. Pro/Individual không có.
- Data latency: 1h cho claude_code endpoint, 5min cho usage/cost endpoints.
- Rate limit: ~1 req/phút sustained polling.

## Unresolved questions

1. Org hiện tại chính xác là tier gì? (Team subscription vs API PAYG vs Enterprise) — cần confirm trước khi skip hẳn `messages`/`cost_report`.
2. Org có nhiều workspaces không, hay chỉ default workspace? Quyết định có thêm `/workspaces` endpoint.
3. `usage-collector-service.ts` hiện đang persist fields nào từ `claude_code` response? Cần grep để confirm — có thể gain lớn mà không cần thêm endpoint mới.

## Sources

- [Admin API overview](https://platform.claude.com/docs/en/api/administration-api)
- [Usage and Cost API](https://platform.claude.com/docs/en/build-with-claude/usage-cost-api)
- [Claude Code Analytics API](https://platform.claude.com/docs/en/build-with-claude/claude-code-analytics-api)
