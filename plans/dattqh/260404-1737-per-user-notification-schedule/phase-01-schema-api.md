# Phase 1: Schema + API

## Overview
- **Priority:** Critical
- **Status:** Complete
- **Effort:** Small

Add `notification_settings` to User model and update user-settings API.

## Related Files
- `packages/api/src/models/user.ts` — modify
- `packages/api/src/routes/user-settings.ts` — modify
- `packages/shared/types.ts` — modify

## Implementation Steps

### 1.1 Add notification_settings to User model

In `packages/api/src/models/user.ts`:

```typescript
// Add to IUser interface
notification_settings?: {
  report_enabled: boolean
  report_days: number[]      // 0=Sun, 1=Mon, ..., 6=Sat
  report_hour: number        // 0-23
  report_scope: 'own' | 'all'
}

// Add to schema
notification_settings: {
  report_enabled: { type: Boolean, default: false },
  report_days: { type: [Number], default: [5] },  // Friday
  report_hour: { type: Number, default: 8 },
  report_scope: { type: String, enum: ['own', 'all'], default: 'own' },
}
```

### 1.2 Update shared types

In `packages/shared/types.ts`:

```typescript
export interface NotificationSettings {
  report_enabled: boolean
  report_days: number[]
  report_hour: number
  report_scope: 'own' | 'all'
}

// Add to User interface
notification_settings?: NotificationSettings
```

### 1.3 Update user-settings routes

In `packages/api/src/routes/user-settings.ts`:

**GET /api/user/settings** — include notification_settings in response:
```typescript
const user = await User.findById(req.user!._id, 'telegram_chat_id telegram_bot_token notification_settings')
// Return notification_settings in response
```

**PUT /api/user/settings** — accept notification_settings:
```typescript
const { telegram_bot_token, telegram_chat_id, notification_settings } = req.body
// Validate: report_days are 0-6, report_hour is 0-23
// Enforce: non-admin users always get report_scope='own'
if (notification_settings) {
  if (req.user!.role !== 'admin') notification_settings.report_scope = 'own'
  user.notification_settings = notification_settings
}
```

## Todo
- [x] Add notification_settings to IUser interface
- [x] Add notification_settings to Mongoose schema
- [x] Add NotificationSettings to shared types
- [x] Update GET /api/user/settings
- [x] Update PUT /api/user/settings with validation
- [x] Enforce report_scope='own' for non-admin

## Success Criteria
- User can save notification_settings via API
- Non-admin cannot set report_scope='all'
- Settings persist in DB
