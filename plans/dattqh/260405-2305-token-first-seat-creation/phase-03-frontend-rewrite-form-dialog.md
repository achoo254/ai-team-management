# Phase 3: Frontend — Rewrite seat-form-dialog Create Mode

**Priority:** High | **Status:** pending | **Depends:** Phase 1, 2

## Goal

Rewrite create-mode của `seat-form-dialog.tsx` thành token-first flow. Giữ edit-mode như hiện tại.

## Tasks

### 3.1 Add `usePreviewSeatToken` hook

**File:** `packages/web/src/hooks/use-seats.ts`

```typescript
export function usePreviewSeatToken() {
  return useMutation({
    mutationFn: (credential_json: string) =>
      apiClient.post('/api/seats/preview-token', { credential_json }).then(r => r.data)
  })
}
```

Returns shape:
```typescript
{
  account: { email, full_name, has_claude_max, has_claude_pro },
  organization: { name, organization_type, rate_limit_tier, subscription_status },
  duplicate_seat_id: string | null
}
```

### 3.2 Update `useCreateSeat` hook

Change payload type:
```typescript
type CreateSeatPayload = {
  credential_json: string
  max_users: number
  label?: string
  manual_mode?: boolean
  email?: string
}
```

### 3.3 Rewrite `seat-form-dialog.tsx`

**Create mode UI layout:**

```
┌─ Thêm Seat ──────────────────────────────┐
│ [Paste JSON | Upload File] (tabs)        │
│ ┌──────────────────────────────────────┐ │
│ │ (textarea for JSON credential)       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [parsed preview if valid JSON]           │
│   Access token: ...xyz4                  │
│   Expires in 5h 30m                      │
│                                          │
│ [profile preview if BE call succeeded]   │
│   ✓ Email: dattqh@inet.vn                │
│   ✓ Org: iNET SOFTWARE COMPANY LIMITED   │
│   ✓ Tier: default_claude_max_5x          │
│   [⚠ Seat đã tồn tại] (if duplicate)     │
│                                          │
│ [error banner if BE call failed]         │
│   ⚠ Không fetch được profile             │
│   [Chuyển manual mode] button            │
│                                          │
│ [manual mode fields — if enabled]        │
│   Email: [required]                      │
│                                          │
│ Label: [Đạt + a Hổ] (editable, default   │
│                     = full_name)         │
│ Max users: [2 ▼]                         │
│                                          │
│       [Huỷ]  [Tạo Seat]                  │
└──────────────────────────────────────────┘
```

**State machine:**
```
idle → parsing (client) → parsed_valid
                        → parsed_invalid (show JSON error)

parsed_valid → fetching_profile (BE call via usePreviewSeatToken)
             → profile_ok (show preview, enable submit)
             → profile_failed (show manual mode banner)
             → duplicate (disable submit, show error)

user toggles manual mode → manual_mode=true (require email input)
```

**Component structure:**
- Reuse paste/upload tabs + `CredentialPathGuide` từ `seat-token-dialog.tsx` (consider extract to shared component `credential-input.tsx` in this phase OR phase 4)
- Debounce profile-preview call 500ms after valid parse
- Submit button disabled until: parsed valid AND (profile_ok OR manual_mode with email filled) AND !duplicate AND !submitting

**Edit mode:** unchanged (email/label/max_users fields, no credential_json).

### 3.4 Update `seats.tsx` (parent page)

Update create submission handler to pass new payload shape.

## Files

**Modify:**
- `packages/web/src/components/seat-form-dialog.tsx` — major rewrite create mode
- `packages/web/src/hooks/use-seats.ts` — add `usePreviewSeatToken`, update `useCreateSeat`
- `packages/web/src/pages/seats.tsx` — update create handler
- `packages/web/src/lib/api-client.ts` — no changes expected

**Optionally create:**
- `packages/web/src/components/credential-input.tsx` — shared paste/upload component (if extraction warranted)

## Testing

Add `tests/ui/seat-form-dialog.test.tsx`:
- Paste valid JSON → shows parsed preview
- Paste invalid JSON → shows JSON error
- Valid JSON + profile 200 → shows email/org, enables submit
- Profile 401 → shows manual mode banner
- Manual mode toggle → shows email field, requires it
- Duplicate email → disables submit with message
- Submit happy path → calls `useCreateSeat` with correct payload
- Submit manual mode → payload has `manual_mode: true` + `email`
- Edit mode → unchanged behavior

Mock `usePreviewSeatToken` + `useCreateSeat`.

## Success Criteria

- [ ] Create mode = 1 dialog with paste + preview + submit
- [ ] Profile preview auto-loads after 500ms debounce
- [ ] Manual mode toggle appears when profile API fails
- [ ] Duplicate email shown before submit attempt
- [ ] Edit mode works as before
- [ ] Visual states clear (loading, error, success)
- [ ] All new UI tests pass
