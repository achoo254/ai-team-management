---
name: Desktop Telemetry Webhook
slug: desktop-telemetry-webhook
created: 2026-04-10
status: completed
mode: fast
blockedBy: []
blocks: []
---

# Desktop Telemetry Webhook — Implementation Plan

## Context
- Brainstorm report: `../reports/brainstorm-260410-0839-desktop-telemetry-webhook.md`
- Goal: backend-only ingest endpoint nhận usage report từ desktop app, lưu tách biệt khỏi `usage_snapshots`.

## Scope
- BACKEND ONLY. Không UI phase này.
- Không sửa cron 5-min hiện tại / `usage_snapshots` collection.
- 2 collections mới: `devices`, `claude_sessions`.
- 2 routes mới: `/api/devices` (JWT), `/api/webhook/usage-report` (HMAC).

## Dependencies (new)
- `zod` — payload validation
- `express-rate-limit` — per-device throttle

Add via: `pnpm -F @repo/api add zod express-rate-limit`

## Phases

| # | Phase | File | Status |
|---|---|---|---|
| 1 | Setup deps + shared schema | `phase-01-setup-shared-schema.md` | completed |
| 2 | Mongoose models | `phase-02-models.md` | completed |
| 3 | Services (device + verify) | `phase-03-services.md` | completed |
| 4 | Devices route (JWT) | `phase-04-devices-route.md` | completed |
| 5 | Webhook route (HMAC) | `phase-05-webhook-route.md` | completed |
| 6 | Mount + integration | `phase-06-integration.md` | completed |
| 7 | Tests | `phase-07-tests.md` | completed |

## Build Order
Sequential. Phases 2-3 có thể parallel sau khi 1 xong, nhưng giữ tuần tự cho đơn giản.

## Success Criteria
- `POST /api/devices` (JWT) tạo device, trả plaintext API key 1 lần
- `POST /api/webhook/usage-report` (HMAC) upsert device + sessions
- HMAC sai/timestamp lệch ±5min/device revoked → 401
- Gửi cùng `session_id` 2 lần → 1 record (idempotent)
- Cron + dashboard cũ không bị ảnh hưởng
- All new files < 200 LOC
- Tests pass: device CRUD, HMAC verify, webhook ingest, idempotent upsert

## Out of Scope
- UI Devices/Sessions page
- Analytics charts
- Alert rules trên session tokens
- Webhook event raw log
