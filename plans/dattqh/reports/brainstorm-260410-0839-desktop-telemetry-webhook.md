# Brainstorm: Desktop Telemetry Webhook

**Date:** 2026-04-10
**Branch:** main
**Status:** Design approved, awaiting plan decision

## Problem
Desktop app (separate project) thu thập PC config + Claude Code sessions + token usage. Cần webhook trên web dashboard để desktop push data lên. Data phong phú hơn cron hiện tại — system info, per-session tokens, cache stats.

## Constraints
- Lưu **tách biệt** với `usage_snapshots` (cron 5-min không đụng)
- Auth: API key per device + HMAC signature
- `member_email` → `users.email`; `profile.email` → `seats.email`
- Không giới hạn device/user
- Revoke device không xóa session data
- `device_info.hostname` là source of truth (không dùng `system_info.hostname`)
- Phase này: backend ingest only, chưa làm UI

## Approaches Considered

### A. Bổ sung cron — giữ cả hai nguồn
Pros: redundancy, dev tắt app vẫn có data từ cron
Cons: hai source có thể lệch, logic merge phức tạp

### B. Thay thế cron dần
Pros: 1 source of truth, data giàu hơn
Cons: phụ thuộc desktop online — risk mất data

### C. Lưu riêng hoàn toàn ⭐ (chọn)
Pros: zero impact lên flow hiện tại, single-responsibility, rollout an toàn
Cons: query cross-source phức tạp hơn nếu sau này cần

## Final Design

### Collections (MongoDB)

**`devices`**
```ts
{
  device_id: string         // UUID từ desktop, unique
  user_id: ObjectId         // → users
  device_name: string       // từ device_info
  hostname: string          // từ device_info (source of truth)
  system_info: { os_name, os_version, cpu_name, cpu_cores, ram_total_mb, arch }
  api_key_encrypted: string // AES-256-GCM (reuse lib/encryption.ts)
  api_key_prefix: string    // 8 chars hiển thị
  app_version: string
  last_seen_at: Date
  last_ram_used_mb: number
  revoked_at: Date | null
  created_at: Date
}
```
Index: `device_id` unique, `user_id`, `api_key_prefix`

**`claude_sessions`**
```ts
{
  session_id: string        // UUID từ desktop, unique
  device_id: ObjectId
  user_id: ObjectId         // denormalized
  seat_id: ObjectId | null  // map từ profile.email → seats.email
  profile_email: string     // raw fallback
  subscription_type: string
  rate_limit_tier: string
  model: string
  started_at, ended_at: Date
  total_input_tokens, total_output_tokens, total_cache_read, total_cache_write: number
  message_count: number
  usage_five_hour_pct, usage_seven_day_pct, usage_seven_day_sonnet_pct: number | null
  received_at: Date
}
```
Index: `session_id` unique, `{device_id, started_at:-1}`, `{user_id, started_at:-1}`, `{seat_id, started_at:-1}`, `started_at:-1`

**Upsert by `session_id`** — idempotent retry safe.

### Auth: HMAC per device
```
Headers:
  X-Device-Id: <uuid>
  X-Timestamp: <unix_ms>
  X-Signature: hex(HMAC_SHA256(api_key, timestamp + "." + raw_body))
```

API key:
- Format: `dsk_` + 32 bytes base64url
- Lưu **encrypted** (AES-256-GCM, không bcrypt — vì HMAC verify cần plaintext)
- Trade-off: chấp nhận encryption-at-rest thay hash; bù bằng strict access control

### Endpoints

**`packages/api/src/routes/devices.ts`** (JWT-auth)
- `POST /api/devices` — create. Body `{device_name, hostname}`. Server sinh `device_id` UUID + API key. **Trả plaintext 1 lần duy nhất**.
- `GET /api/devices` — list devices của user.
- `DELETE /api/devices/:id` — set `revoked_at` (giữ session data).

**`packages/api/src/routes/webhook.ts`** (HMAC-auth)
- `POST /api/webhook/usage-report`

Server steps:
1. Lookup device by `X-Device-Id`, check chưa revoked
2. Reject nếu `|now - timestamp| > 5min`
3. Decrypt api_key, verify HMAC
4. Validate Zod schema
5. Match `member_email` → `users.email` AND khớp với `device.user_id` (chống stolen device)
6. Upsert device: update `last_seen_at`, `system_info`, `app_version`, `last_ram_used_mb`, `device_name/hostname` từ `device_info`
7. For each session: match `profile.email` → `seats.email` (nullable), upsert `claude_sessions` by `session_id`
8. Return `{ok: true, accepted: N}`

`session_usage.summary` — KHÔNG lưu (compute từ sessions khi cần, YAGNI).

### Security
- Rate limit 120 req/min per device_id
- Payload size ≤ 512KB
- Strict timestamp window 5 phút (anti-replay)
- Strip sensitive headers trước khi log
- Plaintext API key chỉ trả 1 lần khi tạo

## Files

**Tạo:**
- `packages/api/src/models/device.ts`
- `packages/api/src/models/claude-session.ts`
- `packages/api/src/routes/devices.ts`
- `packages/api/src/routes/webhook.ts`
- `packages/api/src/services/device-service.ts` (key gen, CRUD)
- `packages/api/src/services/webhook-verify-service.ts` (HMAC + timestamp)
- `packages/shared/webhook-schema.ts` (Zod payload schema)

**Sửa:**
- `packages/api/src/index.ts` — mount routes mới

Mỗi file < 200 LOC.

## Risks

| Risk | Mitigation |
|---|---|
| API key leak qua log | Middleware strip sensitive headers |
| Desktop clock drift | Window 5 phút; doc yêu cầu NTP |
| Session retry duplicate | Upsert by `session_id` idempotent |
| profile.email không match seat | Lưu `profile_email` raw, `seat_id: null` |
| Spam DoS DB | Rate limit + payload cap |
| Encrypted key thay hash | Trade-off bắt buộc cho HMAC; bù bằng AES-256-GCM at rest |

## Out of Scope (phase này)
- UI Devices/Sessions page
- Token analytics charts
- Alert rules per session
- Data export
- Webhook raw event log (thêm sau nếu cần debug)

## Success Criteria
- Desktop tạo device qua web UI, copy API key
- Desktop POST webhook với HMAC valid → server upsert device + sessions
- HMAC sai/timestamp lệch/device revoked → 401
- Idempotent: gửi cùng `session_id` 2 lần không tạo duplicate
- Existing cron flow + dashboard không bị ảnh hưởng

## Unresolved Questions
- (none — all clarified)
