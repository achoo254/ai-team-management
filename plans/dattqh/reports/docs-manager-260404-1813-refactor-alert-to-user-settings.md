# Documentation Updates: Refactor Alert Settings to User Settings

**Date**: 2026-04-04
**Status**: COMPLETED
**Changes Made**: 3 files updated

## Summary

Updated project documentation to reflect the "Refactor Alert Settings to User Settings" implementation. Global Setting model removed, alert settings moved to per-user configuration with personal Telegram bot notifications.

## Files Updated

### 1. `docs/system-architecture.md`
**Changes**:
- Updated Database section: Collections reduced from 8 to 7 (removed `settings` collection)
- Updated Route Structure: Removed `/api/settings`, extended `/api/user/settings` with alert_settings
- Updated Users data model: Added `alert_settings` nested object with `enabled`, `rate_limit_pct`, `extra_credit_pct`, `subscribed_seat_ids`
- Removed Settings data model section entirely
- Updated Alert Generation Flow: Refactored to show per-user subscription logic instead of global thresholds
- Alert notifications now sent via personal bot only (no system bot for alerts)

### 2. `docs/codebase-summary.md`
**Changes**:
- Updated Directory Structure: Added note that `user.ts` includes alert_settings + notification_settings; added `active-session.ts` model reference
- Updated API Endpoints: Removed `/api/settings` endpoints, extended `/api/user/settings` description
- Updated Alert data model: Added `usage_exceeded` to type enum, extended metadata fields
- User model now shows `seat_ids` (array) and includes `alert_settings` structure

### 3. `docs/project-changelog.md`
**Changes**:
- Added comprehensive changelog entry: "[2026-04-04] Refactor Alert Settings to User Settings"
- Documents major changes: Global Setting removal, per-user configuration, notification flow change
- Lists API changes (removed endpoints, extended endpoints)
- Explains data model changes with type interface examples
- Details service changes in alert-service.ts and telegram-service.ts
- Identifies breaking changes and backward compatibility notes
- Lists all modified and deleted files
- Moved entry to top of changelog (most recent first)

## Key Documentation Changes

### Architectural
- Alert threshold configuration moved from global admin settings to per-user settings
- System bot no longer sends alert notifications (personal bots only)
- Alert generation now iterates over users instead of seats

### API Surface
- Global `/api/settings` routes removed
- `/api/user/settings` extended to include alert configuration
- Validation: non-admin users limited to subscribing to owned/assigned seats only

### Data Model
- Settings collection deleted (never persisted in MongoDB)
- User model extended with nested alert_settings object
- Alert metadata unchanged; generation logic refactored

## Verification

All documentation updates verified against actual codebase:
- ✓ User model has `alert_settings` with correct fields (enabled, rate_limit_pct, extra_credit_pct, subscribed_seat_ids)
- ✓ Routes: `/settings.ts` deleted, `/user-settings.ts` extended
- ✓ Services: alert-service.ts uses per-user subscription logic, sendAlertToUser() in telegram-service.ts
- ✓ Admin page: alert threshold UI removed (handled per-user)
- ✓ Settings page: new AlertSettingsForm component added

## No Outstanding Issues

All documentation updates complete and consistent with current implementation.
