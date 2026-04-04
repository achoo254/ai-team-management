# Phase 4: Admin Page Cleanup

## Overview
- **Priority:** high
- **Status:** complete
- **Description:** Remove alert settings + telegram bot config sections from Admin page. Clean up related hooks.

## Related Code Files

### Modify
- `packages/web/src/pages/admin.tsx` — remove alert/telegram sections + related state/handlers
- `packages/web/src/hooks/use-admin.ts` — remove useSettings, useUpdateSettings, AlertSettings, TelegramSettings

## Implementation Steps

### Step 1: Clean up `admin.tsx`

Remove:
- State variables: `rateLimitPct`, `extraCreditPct`, `tgBotToken`, `tgChatId`, `tgTopicId`, `showToken`, `reportCooldown`
- Hooks: `useSettings()`, `useUpdateSettings()`
- Handlers: `handleSaveAlerts()`, `handleSaveTelegram()`, `handleSendReport()`
- useEffect for settingsData
- "Cài đặt Alert" card section (lines ~114-137)
- "Cấu hình Telegram Bot" card section (lines ~139-179)
- Button: "Gửi báo cáo" (sendReport)
- Imports: `Settings`, `Bot`, `Eye`, `EyeOff`, `Send` icons (if unused after removal)

Keep:
- User management (table, CRUD, bulk active)
- "Kiểm tra alerts" button (still useful)
- UserFormDialog, ConfirmDialog

### Step 2: Clean up `use-admin.ts`

Remove:
- `AlertSettings` interface
- `TelegramSettings` interface
- `useSettings()` hook
- `useUpdateSettings()` hook
- `useSendReport()` hook

Keep:
- `useAdminUsers`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`
- `useBulkActive`
- `useCheckAlerts`

## Todo
- [x] Remove alert/telegram sections from admin.tsx
- [x] Remove unused hooks from use-admin.ts
- [x] Remove unused imports
- [x] Verify admin page renders correctly
- [x] Run `pnpm build` — verify no compile errors
- [x] Run `pnpm lint`

## Success Criteria
- Admin page only shows user management + check alerts button
- No references to Settings model, system bot, or global thresholds
- Build and lint pass
