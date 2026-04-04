# Phase 3: Frontend — Alert Settings Form

## Overview
- **Priority:** high
- **Status:** complete
- **Description:** New AlertSettingsForm component in Settings page for per-user alert configuration

## Related Code Files

### Create
- `packages/web/src/components/alert-settings-form.tsx` — new component

### Modify
- `packages/web/src/pages/settings.tsx` — add AlertSettingsForm
- `packages/web/src/hooks/use-user-settings.ts` — update UserSettings type to include alert_settings + available_seats
- `packages/shared/types.ts` — already updated in Phase 1

## Implementation Steps

### Step 1: Update `use-user-settings.ts`

```typescript
// Update UserSettings interface
export interface UserSettings {
  telegram_chat_id: string | null
  has_telegram_bot: boolean
  notification_settings: NotificationSettings | null
  alert_settings: UserAlertSettings | null  // NEW
  available_seats: Array<{               // NEW
    _id: string
    label: string
    email: string
    team: string
  }>
}
```

### Step 2: Create `alert-settings-form.tsx`

Component structure:
```
┌─────────────────────────────────────┐
│ 🔔 Cài đặt Alert                   │
│                                     │
│ [Toggle] Bật thông báo alert        │
│                                     │
│ ─── Ngưỡng cảnh báo ───            │
│ Rate limit (%):  [____80___]        │
│ Extra credit (%): [____80___]       │
│                                     │
│ ─── Seats theo dõi ───              │
│ ☑ Seat A (dev)                      │
│ ☑ Seat B (dev)                      │
│ ☐ Seat C (mkt)                      │
│                                     │
│ ⚠️ Cần cấu hình Telegram Bot       │
│    trước khi bật alert              │
│                                     │
│ [Lưu cài đặt]                      │
└─────────────────────────────────────┘
```

Key behaviors:
- Disabled state if `has_telegram_bot === false` — show warning message
- Toggle controls `enabled` field
- When disabled (toggle off), threshold inputs + seat checkboxes greyed out
- Seats displayed as checkbox list grouped by team
- User sees only `available_seats` from API (filtered by backend)
- Save calls `useUpdateUserSettings` with `alert_settings` payload
- Default values when `alert_settings` is null: enabled=false, thresholds=80/80, empty seats

### Step 3: Update `settings.tsx`

```tsx
import { AlertSettingsForm } from "@/components/alert-settings-form"

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cài đặt cá nhân</p>
      </div>
      <BotSettingsForm />
      <AlertSettingsForm />          {/* NEW — after bot settings */}
      <NotificationScheduleForm />
    </div>
  )
}
```

Order: Bot Settings → Alert Settings → Notification Schedule (bot must be configured first)

## Todo
- [x] Update UserSettings type in use-user-settings.ts
- [x] Create alert-settings-form.tsx component
- [x] Add AlertSettingsForm to settings.tsx
- [x] Verify form works with real API

## Success Criteria
- Alert settings form renders in Settings page
- Toggle enables/disables alert notifications
- Threshold inputs validate 1-100
- Seat checkboxes show correct seats per user role
- Disabled state when no telegram bot configured
- Save persists to backend correctly
