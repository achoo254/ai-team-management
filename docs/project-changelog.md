# Project Changelog

All notable changes to the Claude Teams Management Dashboard project are documented here.

**Format**: Major features, breaking changes, and significant bug fixes are listed chronologically. Minor updates and refactoring are grouped by release cycle.

---

## [2026-04-04] UsageLog Module Removal & System Consolidation

### Major Changes

**Complete Removal of Weekly UsageLog Module**

#### Files Deleted
- `packages/api/src/models/usage-log.ts` — UsageLog schema (was for manual weekly % logging)
- `packages/api/src/routes/usage-log.ts` — Manual usage logging endpoints
- `packages/api/src/services/usage-sync-service.ts` — Service for usage sync operations
- `packages/web/src/pages/log-usage.tsx` — Manual usage form page
- `packages/web/src/hooks/use-usage-log.ts` — React Query hooks for usage logs
- `packages/web/src/components/week-table.tsx` — Weekly table UI component

#### Removed Endpoints
- `GET /api/usage-log/user/:userId` — User's usage history
- `POST /api/usage-log` — Log usage (manual form)
- `GET /api/usage-log/weekly` — Weekly summary

#### Removed Cron Job
- **Friday 15:00 Asia/Saigon** — `sendLogReminder()` eliminated
  - No longer need to remind users to manually log usage
  - Real-time UsageSnapshot collection (every 30min) replaces manual logging

#### Database Changes
- `usage_logs` collection no longer used by application (can be archived for historical reference)
- No removal of UsageLog documents from database (kept for audit trail if needed)
- Removed index: `usage_logs { user_id: 1, week_start: 1 }`

#### Type Changes (`packages/shared/types.ts`)
- Removed: `UsageLog` interface
- Removed: `UsageLogPopulated` interface
- Alert system now exclusively uses `UsageSnapshot` types

#### Frontend Route Changes
- `/log-usage` route removed
- `/usage-metrics` renamed to `/usage` (cleaner naming)
- Dashboard now queries real-time snapshots instead of manual logs

#### Telegram Report Updates (`packages/api/src/services/telegram-service.ts`)
- `sendWeeklyReport()` now uses UsageSnapshot data exclusively
- Removed reliance on aggregated UsageLog entries
- Summary now reflects real-time collection data with timestamps

### Migration Notes
- **No Data Loss**: UsageLog documents preserved in MongoDB for historical records
- **Backward Compatibility**: Old manual usage log data remains queryable via direct MongoDB access
- **Timeline**: Users can no longer manually log; system relies on automatic 30-min collection cycles
- **Alert Accuracy**: Alerts now based on real-time data vs delayed weekly aggregates

### Simplifications
- Reduced API surface: 3 fewer endpoints
- Simpler cron schedule: 1 fewer job
- Cleaner data flow: Single source of truth (UsageSnapshot)
- Fewer services: 1 fewer service module

### Testing
- Build: ✓ No TypeScript errors
- Tests: ✓ All passing
- Linting: ✓ Clean
- Manual: Dashboard loads without log-usage page, alerts trigger on snapshots

### Related Files
- Plan: `plans/dattqh/260404-1102-usage-module-consolidation/`
- Updated docs: system-architecture.md, codebase-summary.md, project-overview-pdr.md, code-standards.md

---

## [2026-04-04] Alert System Redesign (UsageSnapshot-based)

### Major Changes

**Alert System Migration** (Complete redesign from weekly UsageLog-based to real-time UsageSnapshot-based)

#### Backend Changes
- **New Alert Types**: Replaced `high_usage` and `no_activity` with:
  - `rate_limit` — Triggered when token usage exceeds admin-configurable threshold (default 80%) across 5h, 7d, 7d_sonnet, or 7d_opus windows
  - `extra_credit` — Triggered when extra credit utilization exceeds threshold (default 80%)
  - `token_failure` — Triggered for seats with active tokens but failed API fetch
  
- **Settings Model** (`packages/api/src/models/setting.ts`):
  - New single-document collection for admin-configurable thresholds
  - Atomic getOrCreate with defaults (80% for both rate_limit and extra_credit)
  - Isolated from UsageLog-based logic

- **Alert Service Rewrite** (`packages/api/src/services/alert-service.ts`):
  - New `checkSnapshotAlerts()` replaces old `checkAlerts()`
  - Uses latest UsageSnapshot data instead of weekly UsageLog aggregates
  - Evaluates all 4 rate-limit windows; picks highest for alert message
  - Atomic deduplication: max 1 unresolved alert per (seat_id, type)
  - Metadata field stores context: window, pct, credits_used, error, etc.

- **Cron Integration** (`packages/api/src/index.ts`):
  - Alert check now **chained after usage collection** (every 30 min)
  - Execution order: `collectAllUsage()` → `checkSnapshotAlerts()` (sequential)
  - Both run in single cron job for consistency

- **Settings API** (`packages/api/src/routes/settings.ts` — NEW):
  - `GET /api/settings` — Returns current thresholds (authenticated)
  - `PUT /api/settings` — Updates thresholds with validation (admin only)
  - Validates: 0 < pct ≤ 100
  - Uses atomic upsert to prevent race conditions

- **Alert Model Updates** (`packages/api/src/models/alert.ts`):
  - Type enum: `['rate_limit', 'extra_credit', 'token_failure']`
  - New `metadata` field (mixed object) for contextual data
  - Added fields: `resolved_by`, `resolved_at` (for audit trail)
  - New compound index: `(seat_id, type, resolved)` for efficient dedup queries

- **Telegram Notifications** (`packages/api/src/services/telegram-service.ts`):
  - New `sendAlertNotification()` function with 3 message templates:
    - `rate_limit` — Shows window + usage %
    - `extra_credit` — Shows credits used/limit + utilization %
    - `token_failure` — Shows error message + re-import action
  - Called immediately after alert creation (non-blocking; errors swallowed)

- **Admin Endpoint** (`packages/api/src/routes/admin.ts`):
  - Updated `POST /api/admin/check-alerts` to call `checkSnapshotAlerts()` instead of `checkAlerts()`

#### Frontend Changes
- **Alert Interface** (`packages/web/src/hooks/use-alerts.ts`):
  - Updated Alert type: includes metadata field with optional window, pct, credits_used, credits_limit, error
  - Updated type union: `'rate_limit' | 'extra_credit' | 'token_failure'`

- **Settings Hooks** (`packages/web/src/hooks/use-admin.ts`):
  - New `useSettings()` — Fetches current settings
  - New `useUpdateSettings()` — Mutates settings with optimistic UI update + toast feedback

- **Alert Card Component** (`packages/web/src/components/alert-card.tsx`):
  - New `TYPE_CONFIG` mapping for 3 alert types with icons (TrendingUp, CreditCard, KeyRound) and colors
  - Contextual metadata display below message:
    - `rate_limit` → shows window + percentage badge
    - `extra_credit` → shows credits used/limit with % bar
    - `token_failure` → shows error code + re-import CTA

- **Admin Dashboard** (`packages/web/src/pages/admin.tsx`):
  - New "Alert Settings" card with number inputs for both thresholds
  - Save button calls `useUpdateSettings()` mutation
  - Displays current values loaded by `useSettings()`

#### Shared Types (`packages/shared/types.ts`)
- New `AlertType` type: `'rate_limit' | 'extra_credit' | 'token_failure'`
- New `AlertMetadata` interface with optional window, pct, credits_used, credits_limit, error fields
- New `AlertSettings` interface: rate_limit_pct, extra_credit_pct
- New `AppSettings` interface: single-doc pattern with alerts sub-object

#### Database Changes
- **New Collection**: `settings` (single-document pattern)
- **Updated Collection**: `alerts` — Type enum changed, metadata + audit fields added
- **New Index**: `alerts { seat_id: 1, type: 1, resolved: 1 }` for dedup queries

#### Configuration
- `packages/api/src/config.ts` — New defaults: `alerts.defaultRateLimitPct`, `alerts.defaultExtraCreditPct`
- Removed: old `highUsagePct` and `inactivityWeeks` config keys (no longer used)

### Data Migration Notes
- **Legacy Alerts**: All old `high_usage` and `no_activity` alert documents should be deleted via `db.alerts.deleteMany({})` before deployment
- **No Data Loss for UsageLogs**: Weekly UsageLog records unaffected; kept for historical reference
- **Settings Init**: First request to GET /api/settings auto-creates single document with defaults

### Breaking Changes
- Alert type enum changed — old client code expecting `high_usage` will fail
- Alert query filters must use new type values
- No backward compatibility; requires synchronized frontend/backend deployment

### Performance Impact
- **Positive**: Real-time evaluation (30-min latency) vs weekly batches
- **Positive**: Dedup eliminates redundant alerts
- **Positive**: Smaller metadata field vs full UsageLog aggregation
- **Risk**: Telegram API calls on every alert creation — needs monitoring if alert rate spikes

### Testing
- Build: ✓ No TypeScript errors
- Tests: ✓ 33/33 passing
- Linting: ✓ Clean (ESLint + Prettier)
- Manual: Alert cards render correctly with metadata, admin settings update works, Telegram notifications send

### Related Files
- Plan: `plans/dattqh/260404-1029-alert-system-redesign/`
- Phase docs: 4 phases completed (types, service, settings-api, frontend)
- Brainstorm: `plans/dattqh/reports/brainstorm-260404-1029-alert-system-redesign.md`

---

## Future Enhancements (Post-Redesign)

- [ ] Alert resolution audit log (who resolved, when, reason)
- [ ] Configurable alert quiet periods (snooze)
- [ ] Multi-threshold rules (AND/OR logic for rate limits)
- [ ] Alert severity levels (critical, warning, info)
- [ ] Webhook notifications (Slack, Discord)
- [ ] Alert templates customizable by admin

---

## [TEMPLATE] Release Version

### New Features
- Feature description with impact

### Bug Fixes
- Bug description with root cause

### Breaking Changes
- Change description with migration path

### Deprecated
- Component/function being removed with replacement

### Performance
- Improvement description with benchmarks if applicable

### Documentation
- Docs updated or created

---

*Last updated: 2026-04-04*
