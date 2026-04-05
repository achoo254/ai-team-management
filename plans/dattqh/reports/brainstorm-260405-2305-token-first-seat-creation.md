# Brainstorm: Token-First Seat Creation

**Date:** 2026-04-05 | **Status:** Design approved, ready for `/ck:plan`

## Problem Statement

Current seat creation = 2 form + 2 API calls:
1. `SeatFormDialog` → `POST /api/seats` (manual: email, label, max_users)
2. `SeatTokenDialog` → `PUT /api/seats/:id/token` (paste JSON credential)

Email/label phải nhập thủ công, dễ typo. Metadata giàu có từ `/api/oauth/profile` (org name, rate_limit_tier, subscription_status) **chưa được khai thác**.

## Goal

Gộp thành **1 form, 1 submit**: paste JSON credential → auto-fetch profile → auto-fill toàn bộ → user chỉ cần điền `max_users` + (optional) override label.

## Decisions (confirmed)

| Quyết định | Giá trị |
|---|---|
| Token format | **JSON blob** (reuse `tryParse()` từ `seat-token-dialog.tsx`) |
| Label default | `account.full_name` từ profile, cho user **override** |
| Duplicate email | **Reject** + message "Vui lòng dùng chức năng Update Token" |
| Flow | **Single-step** single dialog |
| Advanced mode fallback | **CÓ** — nếu profile API fail, cho user nhập email/label manual |
| Extra fields (`account_uuid`, `organization_uuid`) | **KHÔNG** thêm — YAGNI |

## Architecture

### Flow (happy path)
```
User paste JSON
   ↓ client tryParse()
Preview: access_token masked, expires, scopes
   ↓ auto debounced 500ms
POST /api/seats/preview-token { credential_json }
   ↓ BE: decrypt NOT needed (not saved yet), call /api/oauth/profile
Preview: email, full_name, org.name, rate_limit_tier, subscription_status, duplicate_seat_id
   ↓ if duplicate_seat_id → show error, disable submit
User inputs: label (default=full_name, editable), max_users (default=2)
   ↓ Submit
POST /api/seats { credential_json, label?, max_users }
   ↓ BE: parse JSON → profile call → validate → create seat atomically
Seat created with email, label, max_users, encrypted credentials, owner_id
```

### Flow (degraded / advanced mode)
```
Profile API fails (401/timeout/network)
   ↓
Show banner: "Không fetch được profile. Chuyển sang chế độ manual?"
   ↓ User clicks "Manual mode"
Show email + label inputs (required)
   ↓ Submit
POST /api/seats { credential_json, email, label, max_users, manual: true }
   ↓ BE: skip profile call, save seat với email/label user nhập
```

## Changes

### Shared (`packages/shared` hoặc inline)
- Extract `parseCredentialJson()` từ `seat-token-dialog.tsx` → module dùng chung

### Backend (`packages/api`)

**New endpoint:**
```
POST /api/seats/preview-token
Body: { credential_json: string }
Response: {
  account: { email, full_name, has_claude_max, has_claude_pro },
  organization: { name, organization_type, rate_limit_tier, subscription_status },
  duplicate_seat_id: string | null
}
Errors: 400 (invalid JSON), 401 (invalid token), 502 (profile API down)
```

**New service function:**
```typescript
// packages/api/src/services/anthropic-service.ts
export async function fetchOAuthProfile(accessToken: string): Promise<OAuthProfile>
```

**Modify `POST /api/seats`:**
- Accept `credential_json` + `max_users` + optional `label` + optional `email`/`manual` flag
- Parse credential → call profile API (unless `manual: true`)
- Reject if duplicate email (existing unique index handles DB-level, but check proactively cho friendly error)
- Create seat atomically: encrypt credentials, save email/label/max_users/owner_id trong 1 transaction

**Keep existing:**
- `PUT /api/seats/:id/token` — unchanged (update token cho seat đã tồn tại)
- Old `POST /api/seats` params → deprecate gracefully hoặc make `credential_json` required

### Frontend (`packages/web`)

**Rewrite `seat-form-dialog.tsx`:**
- Create mode: new token-first flow
- Edit mode: giữ nguyên (chỉ edit label, max_users)

**New React Query hook:**
```typescript
// packages/web/src/hooks/use-seats.ts
export function usePreviewSeatToken() // debounced, call /api/seats/preview-token
```

**Components cần update:**
- `seat-form-dialog.tsx` — major rewrite create mode
- `seats.tsx` — update form submission handler

**Không đổi:**
- `seat-token-dialog.tsx` — vẫn dùng cho update token
- `credential-path-guide.tsx` — reuse trong form mới

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Profile API round-trip thêm latency | Acceptable — one-off action |
| Profile API down → block creation | Advanced mode manual fallback |
| User paste token expired | Client preview hiển thị expires red, block submit |
| Label unicode lạ ("Đạt + a Hổ") | Cho override |
| Duplicate race condition | DB unique index (existing) + proactive check |
| Advanced mode bypass validation | Email/label required, validate format client-side |

## Success Criteria

- [ ] Tạo seat mới = **1 dialog, 1 submit** (vs 2 dialogs hiện tại)
- [ ] Auto-fill email + label đúng 100% từ profile (happy path)
- [ ] Zero email typo trong seats mới
- [ ] Duplicate email reject với friendly message
- [ ] Advanced mode hoạt động khi profile API fail
- [ ] Không breaking change với `PUT /:id/token` flow update hiện tại

## Next Steps

Invoke `/ck:plan` với brainstorm context này để tạo phased implementation plan.

## Unresolved Questions

Không còn.
