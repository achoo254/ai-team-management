# Phase 4: Cleanup + Testing

## Overview
- **Priority:** High
- **Status:** Complete
- **Effort:** Small

Remove dead code, build check, verify integration.

## Related Files
- `packages/api/src/index.ts` — verify cron removal
- `packages/api/src/services/telegram-service.ts` — verify refactor

## Implementation Steps

### 4.1 Remove dead imports

- Remove `sendWeeklyReport` import from index.ts if no longer used there
- Remove `isVietnamHoliday` if only used by removed cron

### 4.2 Build + lint

```bash
pnpm build
pnpm lint
pnpm test
```

### 4.3 Integration verification

- Verify GET /api/user/settings returns notification_settings
- Verify PUT /api/user/settings saves notification_settings
- Verify non-admin cannot set report_scope='all'
- Verify sendWeeklyReport still works (admin manual)
- Verify hourly cron runs checkAndSendScheduledReports

## Todo
- [x] Remove dead code/imports
- [x] Build passes
- [x] Lint passes
- [x] Tests pass
- [x] Manual API test for notification_settings CRUD

## Success Criteria
- Clean build
- No regressions
- API endpoints working
- Cron replacement verified
