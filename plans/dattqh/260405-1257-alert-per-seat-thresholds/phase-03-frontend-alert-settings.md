# Phase 03 — Frontend Alert Settings (Channels Only)

**Priority:** P0 | **Status:** completed | **Depends on:** Phase 02

## Context

- Component: `packages/web/src/components/alert-settings-form.tsx`
- Hook: `packages/web/src/hooks/use-user-settings.ts`
- Page: `packages/web/src/pages/settings.tsx` (or wherever alerts form is rendered)

## Requirements

### Simplify AlertSettingsForm

**Remove UI elements:**
- "Ngưỡng cảnh báo" section (Rate limit % + Extra credit % inputs)

**Keep UI elements:**
- Master "Bật thông báo alert" toggle
- "Desktop Push Notification" toggle
- "Cảnh báo token invalid" toggle

**Add UI element:**
- "Thông báo qua Telegram" toggle (new `telegram_enabled` field)

**Add info banner:**
Below the form, a small hint:
> "Để nhận alert rate limit cho seat cụ thể, hãy xem trang Seats và bấm Watch."
With link → `/seats` page.

### New State Shape

```ts
const DEFAULT_SETTINGS: UserAlertSettings = {
  enabled: false,
  telegram_enabled: true,
  token_failure_enabled: true,
};
```

### Telegram Toggle Gating

- Disable if `!hasTelegram` (no bot configured) + show hint.
- Enabled only when `as.enabled = true` (master toggle on).

## UI Layout (ASCII mock)

```
┌─ Cài đặt Alert ─────────────────────────┐
│ Nhận thông báo khi có cảnh báo usage.   │
│                                          │
│ Bật thông báo alert    [Đang bật]       │
│                                          │
│ ── Kênh thông báo ──                     │
│ Telegram               [Đang bật]       │
│ Desktop Push           [Đang bật]       │
│                                          │
│ ── Loại cảnh báo ──                      │
│ Cảnh báo token invalid [Đang bật]       │
│                                          │
│ ℹ  Ngưỡng usage cấu hình trên từng seat.│
│    Xem trang Seats →                     │
│                                          │
│ [Lưu]                                    │
└──────────────────────────────────────────┘
```

## Related Files

**Modify:**
- `packages/web/src/components/alert-settings-form.tsx` (remove threshold inputs, add telegram toggle, add info banner)
- `packages/web/src/hooks/use-user-settings.ts` (update types if needed)
- `packages/shared/types.ts` (already updated in Phase 01)

## Implementation Steps

### Step 1: Update form state
- Drop `rate_limit_pct`, `extra_credit_pct` from local `as` state.
- Add `telegram_enabled`.
- Update `DEFAULT_SETTINGS`.

### Step 2: Remove threshold inputs block
Delete lines 128-163 of existing form.

### Step 3: Add Telegram toggle
Between existing "Bật thông báo alert" and "Desktop Push" toggles.
Reuse Button pattern. Disabled when `!hasTelegram || !as.enabled`.

### Step 4: Add visual grouping
Wrap channels (Telegram + Desktop) in group with label "Kênh thông báo".
Wrap alert-type toggles (token_failure) in group with label "Loại cảnh báo".
Use subtle separator (`border-t` divider or muted label).

### Step 5: Add info banner
Small muted card/div below save button linking to `/seats` page.

### Step 6: Verify useUserSettings hook
Ensure hook returns updated `alert_settings` shape. If types correct from Phase 01, no changes.

## Todo

- [ ] Update `DEFAULT_SETTINGS` + state
- [ ] Remove threshold inputs
- [ ] Add Telegram toggle with proper gating
- [ ] Add section dividers ("Kênh thông báo" / "Loại cảnh báo")
- [ ] Add info banner with link to /seats
- [ ] Verify Save button updates correct fields
- [ ] `pnpm lint` + visual check in dev

## Success Criteria

- Form no longer shows Rate limit % / Extra credit % inputs.
- Telegram toggle works; disabled when bot not configured.
- Info banner guides users to per-seat config.
- Save persists only channel/type toggles (no threshold payload).
- No TypeScript errors.

## Risks

- **User confusion**: Users may look for threshold config here. Mitigation: info banner explicitly points to seats page.
- **Empty alert_settings**: Existing records migrated have `telegram_enabled = true` default. UI will reflect correctly.

## Security

- No auth changes. Form still uses `useUserSettings` authenticated hook.
