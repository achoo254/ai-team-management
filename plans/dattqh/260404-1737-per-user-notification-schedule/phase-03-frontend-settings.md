# Phase 3: Frontend Settings UI

## Overview
- **Priority:** High
- **Status:** Pending
- **Effort:** Small

Add notification schedule config to user settings page.

## Related Files
- `packages/web/src/pages/settings.tsx` — modify
- `packages/web/src/hooks/use-user-settings.ts` — modify (if exists, else check settings.tsx)

## Implementation Steps

### 3.1 Update settings page

Add a "Thông báo" section to `/cai-dat` page with:

```
┌─────────────────────────────────────┐
│ 🔔 Báo cáo Usage tự động           │
│                                     │
│ [Toggle] Bật thông báo             │
│                                     │
│ Ngày gửi:                          │
│ [T2] [T3] [T4] [T5] [✓T6] [T7] [CN]│
│                                     │
│ Giờ gửi: [08:00 ▾]                 │
│                                     │
│ Phạm vi: [Seats của tôi ▾]         │
│   (Admin: thêm option "Tất cả")    │
│                                     │
│ [Lưu]                              │
└─────────────────────────────────────┘
```

Components needed:
- Toggle (Switch from shadcn)
- Day checkboxes (7 buttons, toggle selected)
- Hour select (0-23, formatted as "08:00", "09:00"...)
- Scope select (admin only shows "Tất cả" option)

### 3.2 Wire up API

- Load notification_settings from GET /api/user/settings
- Save via PUT /api/user/settings with notification_settings field
- Show toast on save success/error

### 3.3 Conditional rendering

- Disable day/hour/scope pickers when toggle is off
- Hide scope selector for non-admin users (default 'own')
- Show info text: "Cần cấu hình Telegram bot trước khi bật thông báo"
  when user has no telegram bot configured

## Todo
- [ ] Add notification schedule section to settings page
- [ ] Day selection UI (7-button toggle group)
- [ ] Hour dropdown (0-23)
- [ ] Scope selector (admin only for 'all')
- [ ] Conditional disable when toggle off
- [ ] Wire up save/load API
- [ ] Warning when no Telegram bot configured

## Success Criteria
- User can toggle notifications on/off
- User can select multiple days
- User can pick hour
- Admin sees scope option, user does not
- Settings persist after page reload
