# Phase 1: Schema & Types

## Overview
- **Priority:** critical
- **Status:** complete
- **Description:** Add alert_settings to User model, update shared types, remove Setting model

## Key Insights
- Setting model currently stores `alerts` (thresholds) + `telegram` (system bot config)
- Setting model used by: alert-service (`getOrCreateSettings`), telegram-service (`getTelegramConfig`), settings route, admin page
- User model already has `notification_settings` — alert_settings follows same pattern
- `getOrCreateSettings()` used in alert-service.ts (checkSnapshotAlerts) and telegram-service.ts (getTelegramConfig, sendAlertNotification, sendWeeklyReport, sendToUser)

## Related Code Files

### Modify
- `packages/api/src/models/user.ts` — add IAlertSettings interface + alert_settings schema field
- `packages/shared/types.ts` — add UserAlertSettings type, update User interface, remove AppSettings

### Delete
- `packages/api/src/models/setting.ts` — remove entire file (Setting model + getOrCreateSettings)

## Implementation Steps

1. **Update `packages/shared/types.ts`:**
   ```typescript
   // Add new interface
   export interface UserAlertSettings {
     enabled: boolean
     rate_limit_pct: number        // 1-100, default 80
     extra_credit_pct: number      // 1-100, default 80
     subscribed_seat_ids: string[] // seats user wants alerts for
   }

   // Update User interface — add:
   alert_settings?: UserAlertSettings

   // Remove: AppSettings interface (no longer needed)
   // Remove: AlertSettings interface (replaced by UserAlertSettings)
   ```

2. **Update `packages/api/src/models/user.ts`:**
   ```typescript
   // Add IAlertSettings interface
   export interface IAlertSettings {
     enabled: boolean
     rate_limit_pct: number
     extra_credit_pct: number
     subscribed_seat_ids: Types.ObjectId[]
   }

   // Add to IUser interface:
   alert_settings?: IAlertSettings

   // Add to userSchema:
   alert_settings: {
     enabled: { type: Boolean, default: false },
     rate_limit_pct: { type: Number, default: 80 },
     extra_credit_pct: { type: Number, default: 80 },
     subscribed_seat_ids: [{ type: Schema.Types.ObjectId, ref: 'Seat' }],
   }
   ```

3. **Delete `packages/api/src/models/setting.ts`** entirely.

## Todo
- [x] Update shared types (UserAlertSettings, User, remove AppSettings)
- [x] Update User model (IAlertSettings, schema field)
- [x] Delete Setting model
- [x] Verify no other imports of Setting model remain (will break — fixed in Phase 2)

## Success Criteria
- User model has alert_settings field with defaults
- Shared types updated, old AppSettings/AlertSettings removed
- Setting model file deleted

## Risk
- Deleting Setting model breaks imports in alert-service, telegram-service, settings route → resolved in Phase 2
- Phase 1 + 2 must be done together to avoid broken state
