# Phase 3: Delete UsageLog Legacy

## Priority: High | Status: completed

## Overview
Remove all UsageLog code: model, routes, hooks, page, component, types, service, seed references. Depends on Phase 1 & 2 completing first.

## Files to Delete
- `packages/api/src/models/usage-log.ts`
- `packages/api/src/routes/usage-log.ts`
- `packages/api/src/services/usage-sync-service.ts`
- `packages/web/src/pages/log-usage.tsx`
- `packages/web/src/hooks/use-usage-log.ts`
- `packages/web/src/components/week-table.tsx`

## Files to Modify
- `packages/shared/types.ts` — Remove UsageLog, UsageLogPopulated interfaces
- `packages/api/src/index.ts` — Remove usage-log route mount, remove UsageLog-related imports
- `packages/web/src/app.tsx` — Remove LogUsagePage import and route

## Implementation Steps

### 1. Delete 6 files listed above

### 2. Update `packages/shared/types.ts`

Remove:
```ts
export interface UsageLog { ... }
export interface UsageLogPopulated extends Omit<UsageLog, 'user_id'> { ... }
```

### 3. Update `packages/api/src/index.ts`

Remove:
```ts
import usageLogRoutes from './routes/usage-log.js'
app.use('/api/usage-log', usageLogRoutes)
```

Also remove any `getCurrentWeekStart` import from usage-sync-service if still referenced.

### 4. Update `packages/web/src/app.tsx`

Remove:
```ts
import LogUsagePage from '@/pages/log-usage'
<Route path="log-usage" element={<LogUsagePage />} />
```

### 5. Check for remaining references

Grep for `usage-log`, `UsageLog`, `usage_log`, `usage-sync`, `weeklyAllPct`, `weekly_all_pct` across entire codebase. Fix any remaining imports or references.

Known remaining references to clean:
- `tests/helpers/db-helper.ts` — seedUsageLog function, UsageLog import
- `tests/hooks/use-usage-log.test.ts` — entire file (delete)
- `tests/services/usage-sync-service.test.ts` — entire file (delete)
- `tests/services/telegram-service.test.ts` — may reference UsageLog
- `tests/api/usage-log.test.ts` — entire file (delete)
- `tests/api/dashboard.test.ts` — may reference UsageLog

## Review Feedback Applied
- **H1 fix**: All UsageLog references removed from models, routes, services, and tests
- **M1/M2 fix**: Null handling applied across remaining snapshot queries to ensure data consistency
- **L1/L2 fix**: UsagePage naming reflected in all deleted/retained test files

## Todo
- [x] Delete 6 legacy files
- [x] Remove UsageLog/UsageLogPopulated from shared/types.ts
- [x] Remove usage-log route from index.ts
- [x] Remove log-usage route + import from app.tsx
- [x] Delete test files: use-usage-log.test.ts, usage-sync-service.test.ts, usage-log.test.ts
- [x] Update db-helper.ts — remove seedUsageLog + UsageLog import
- [x] Update telegram-service.test.ts — remove UsageLog references
- [x] Update dashboard.test.ts — adapt to new snapshot-based API
- [x] Grep for any remaining UsageLog references
- [x] Run `pnpm build` to verify

## Success Criteria
- Zero references to UsageLog anywhere in codebase
- Zero references to usage-sync-service
- Zero references to log-usage or week-table
- `pnpm build` passes
- `pnpm test` passes
