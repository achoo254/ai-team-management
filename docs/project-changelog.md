# Project Changelog

All notable changes to the Claude Teams Management Dashboard project are documented here.

**Format**: Major features, breaking changes, and significant bug fixes are listed chronologically. Minor updates and refactoring are grouped by release cycle.

---

## [2026-04-04] User Self-Service Seat Management

### Major Features

**Seat Ownership System**
- Seats now have `owner_id` field (ref to User)
- Any authenticated user can create a seat and becomes its owner
- Owners have full management rights: edit, delete, assign/unassign users, credential upload
- Admin users can manage any seat and transfer ownership between users

**Grouped Seat UI**
- Frontend displays seats in three sections:
  - "My Seats" — user is owner
  - "Assigned to Me" — user is assigned but not owner
  - "Other Seats" — user has no relationship (admin views only)
- Owner badge visible on seat cards
- Clearer visual separation by role/relationship

**Per-Seat Credential Export**
- New endpoint: `GET /api/seats/:id/credentials/export` (owner or admin)
- Returns single seat's decrypted OAuth credentials
- Audit-logged with user, IP, timestamp
- Complements existing bulk export (admin only)

**Seat Transfer (Admin)**
- New endpoint: `PUT /api/seats/:id/transfer` (admin)
- Allows reassigning ownership to another user
- Required when seat owner leaves or role changes

### Data Model Changes

**Seat schema** (breaking):
- Added: `owner_id` (ObjectId ref to User, indexed, nullable)
- Updated: `oauth_credential` field structure (refactored from simple encrypted string):
  - Nested object: access_token, refresh_token, expires_at, scopes, subscription_type, rate_limit_tier
  - Still encrypted, but with explicit metadata fields
  - Excluded from default queries via `select: false`

**Type updates** (`packages/shared/types.ts`):
- `Seat.owner_id: string | null` (added)
- `Seat.owner?: { _id: string; name: string; email: string } | null` (added, populated on response)

### Route Changes

**Seats route endpoints**:
- `POST /api/seats` — Now available to all auth users (auto-set owner), was admin-only
- `GET /api/seats` — Returns with owner field populated + user assignments grouped
- `GET /api/seats/available-users` — List active users (NEW, auth required)
- `GET /api/seats/credentials/export` — Bulk export (NEW, admin)
- `GET /api/seats/:id/credentials/export` — Single export (NEW, owner or admin)
- `PUT /api/seats/:id` — Update seat (now owner-or-admin via requireSeatOwnerOrAdmin)
- `DELETE /api/seats/:id` — Delete + cascade (now owner-or-admin)
- `POST /api/seats/:id/assign` — Assign user (now owner-or-admin)
- `DELETE /api/seats/:id/unassign/:userId` — Unassign + clear schedules (now owner-or-admin)
- `PUT /api/seats/:id/token` — Upload credential (now owner-or-admin)
- `PUT /api/seats/:id/transfer` — Change owner (NEW, admin)

**Authorization middleware**:
- New `requireSeatOwnerOrAdmin(paramName?)` — Allow seat owner or any admin
- Checks `seat.owner_id === req.user._id` or `req.user.role === 'admin'`
- Queries seat on each request (no caching)

### Migration

**Script**: `pnpm db:migrate-owners`
- One-time migration assigning all null owner_id seats to first admin user
- Idempotent — safe to run multiple times
- File: `packages/api/src/scripts/migrate-seat-owners.ts`
- Should run after deployment before UI changes go live

### Frontend Changes

**Seats page** (components/pages/seats.tsx):
- Three-section layout: mySeats, assignedSeats, otherSeats
- Each section conditional — hidden if empty
- SeatCard shows owner badge + current user's role relative to seat
- "Create Seat" button still in top bar (any user can create)
- Transfer UI (admin only) in seat menu

**Seat Card Component** (components/seat-card.tsx):
- Owner name badge (shows "You" if current user)
- Edit/Delete buttons visible only to owner or admin
- Assign/Unassign dropdowns for owner or admin
- Export credential button per-seat
- Transfer dropdown (admin only)

### Configuration

No new env vars required. Existing `ENCRYPTION_KEY` used for oauth_credential tokens.

### Breaking Changes

1. **POST /api/seats now public** (was admin-only)
   - Any auth user can create seats
   - API clients no longer require admin role for seat creation
   - Ownership determined by creator, not hardcoded

2. **Seat edit/delete/assign/unassign authorization changed**
   - Was: admin-only
   - Now: owner or admin (via requireSeatOwnerOrAdmin middleware)
   - Existing admin integrations unaffected; new self-service enabled

3. **Seat response includes owner field**
   - `owner_id` is string | null in response (MongoDB ID)
   - `owner` is populated object { _id, name, email } when populated
   - Clients expecting flat seat structure unaffected

### Backward Compatibility

- Existing seats without owner_id still queryable; migration assigns them to first admin
- Existing seat data (email, label, team, max_users) unchanged
- Old API clients (assuming admin-only access) continue working — migration maintains admin ownership
- oauth_credential field structure refactored but encryption key same

### Testing

- Build: ✓ TypeScript compilation passes
- Tests: ✓ All passing
- Linting: ✓ Clean
- Manual: Seat creation as non-admin, ownership enforcement, transfer workflow, per-seat export

### Files Modified

Backend:
- `packages/api/src/models/seat.ts` — Add owner_id field, refactor oauth_credential
- `packages/api/src/middleware.ts` — New requireSeatOwnerOrAdmin function
- `packages/api/src/routes/seats.ts` — 6 routes now use requireSeatOwnerOrAdmin, 3 new endpoints
- `packages/api/src/scripts/migrate-seat-owners.ts` — NEW migration script

Frontend:
- `packages/web/src/pages/seats.tsx` — Three-section layout, ownership-based UI
- `packages/web/src/components/seat-card.tsx` — Owner badge, role-based buttons
- `packages/web/src/hooks/use-seats.ts` — useTransferOwnership hook, updated mutations

Shared:
- `packages/shared/types.ts` — Seat type with owner_id + owner fields

### Related Plans

- Plan: `plans/dattqh/260404-1644-user-self-service-seats/`
- Brainstorm: `plans/dattqh/reports/brainstorm-260404-1644-user-self-service-seat-management.md`

---

## [2026-04-04] Hourly Schedule + Per-User Budget Alerts + Personal Bot Config

### Major Features

**Phase 1: Hourly Schedule Redesign**
- Replaced fixed morning/afternoon slots with flexible hourly scheduling (0-23 hours)
- Users now allocate `usage_budget_pct` per scheduled session (1-100%)
- Hourly time grid UI with seat-based tabs
- Auto-divide budget: when unset, divides equally among users on same seat/day
- Overlap detection: warns when time ranges overlap but allows creation
- Migration: existing morning/afternoon slots → 8-12 / 13-17 with 50% default budgets
- Drag-and-drop support for moving time blocks between hours/days

**Phase 2: Per-User Budget Alert + Block System**
- New `ActiveSession` model tracks baseline usage snapshot at session start
- Real-time delta calculation: compares current snapshot vs baseline per user
- Auto-triggered `usage_exceeded` alert when delta >= user's allocated budget
- Telegram notifications to:
  - Current user: "Stop using, budget exceeded"
  - Next scheduled user: "Your slot is coming up, previous user exceeded budget"
- Personal Telegram bot support with fallback to system bot (see Phase 3)
- Auto-unblock: usage_exceeded alert resolves when session ends or next user starts
- 5-minute cron cycle: collectUsage → checkSnapshotAlerts → checkBudgetAlerts

**Phase 3: Per-User Telegram Bot Configuration**
- New `/api/user/settings` route: GET/PUT bot token + chat ID, POST test-bot
- Encryption library: AES-256-GCM for bot tokens at rest (using shared ENCRYPTION_KEY)
- User model extended: `telegram_bot_token` (encrypted), `telegram_chat_id`, `has_telegram_bot` (boolean)
- Telegram service dual-mode: system bot sends to group chat, personal bot sends individual notifications
- Test endpoint validates bot config before saving
- Token never exposed in API responses (masked/computed `has_telegram_bot` flag)
- Graceful fallback: if personal bot fails, system bot still delivers

### Data Model Changes

**Schedule schema** (breaking):
- Removed: `slot` field (morning/afternoon enum)
- Added: `start_hour` (0-23), `end_hour` (0-23 exclusive), `usage_budget_pct` (nullable 1-100)
- Index change: dropped `(seat_id, day_of_week, slot)` unique, added `(seat_id, day_of_week)` regular

**Alert type enum** (breaking):
- Added: `'usage_exceeded'` to AlertType
- `metadata` field extended: new fields `delta`, `budget`, `user_id`, `user_name` for session context

**User model**:
- Added: `telegram_bot_token` (string, encrypted), `telegram_chat_id` (string, nullable)

**New ActiveSession model**:
- Tracks in-progress session baseline snapshot: `seat_id`, `user_id`, `schedule_id`, `started_at`, `snapshot_at_start` (pct values)

**New collection**: `active_sessions` (transient, managed by application)

### Route Changes

**Schedule routes** (modified):
- GET /api/schedules — returns entries with start_hour/end_hour/budget instead of slot
- POST /api/schedules/entry — create with hourly range + budget (replaces assign)
- PUT /api/schedules/entry/:id — update hours/budget
- DELETE /api/schedules/entry/:id — by ID (simpler than body-based)
- PATCH /api/schedules/swap — adapted for hourly model (entry IDs instead of seat/day/slot tuples)

**New route** (user-settings):
- GET /api/user/settings — Get current user's bot config status
- PUT /api/user/settings — Set bot token + chat ID
- POST /api/user/settings/test-bot — Test personal bot, returns { success: true/false, error?: string }

### Service Changes

**alert-service.ts**:
- New `checkBudgetAlerts()` function
- New `notifyNextUser()` helper
- New `cleanupExpiredSessions()` helper
- Session tracking via ActiveSession queries

**telegram-service.ts**:
- New `sendToUser(userId, message)` — sends via personal bot + system bot (fallback)
- New `sendMessageWithBot(botToken, chatId, text)` — abstracted bot sender
- New message template: `usage_exceeded` case with Vietnamese fallback message

**New lib**: `encryption.ts`
- `encrypt(text: string)` → "iv:authTag:ciphertext" (hex-encoded)
- `decrypt(stored: string)` → plaintext

### UI Changes

**Schedule page** (complete redesign):
- Hourly time grid: rows = hours (7-20 default), columns = days (Mon-Fri)
- Seat-based tabs (instead of all seats in one grid)
- Create dialog: pick day, start/end hour (dropdowns), budget % (slider)
- Time block cards: draggable, show user name + time range + budget %
- Overlap blocks highlighted in orange
- Budget total indicator per day header

**Dashboard components**:
- New "OVER BUDGET" badge on seats with unresolved usage_exceeded alerts
- Badge shows user name + delta %
- Visual indicator of blocked users during their session

**User settings page** (new):
- Bot token input (password type, masked if configured)
- Chat ID input
- Test button (calls test-bot endpoint, shows success/error toast)
- Save button
- Clear config button

### Configuration

**New env var** (ENCRYPTION_KEY):
- Required for bot token encryption
- Format: 64-character hexadecimal string (32 bytes)
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Shared with access token encryption

**Cron schedule** (modified):
- Changed from 30-minute to 5-minute cycle for faster budget detection
- Order: collectAllUsage → checkSnapshotAlerts → checkBudgetAlerts (sequential)

### Breaking Changes

1. **Schedule type enum removed** (`slot: 'morning'|'afternoon'` → hourly model)
   - API clients must update to use `start_hour`, `end_hour`
   - Migration runs automatically on first startup

2. **Alert type union expanded** (new `usage_exceeded` value)
   - Frontend alert type guards must accept new value
   - Old alert documents can coexist (alerts don't migrate)

3. **Cron frequency increased** (30min → 5min)
   - More API calls; monitor Anthropic rate limits
   - Faster budget violation detection (best-case 5 min)

### Backward Compatibility

- Existing morning/afternoon schedules auto-migrate to 8-12 / 13-17 with 50% budgets
- UsageLog collection unchanged (superseded but preserved for audit)
- Old alert documents remain queryable; new system generates new types only
- Gradual migration: users can co-configure personal bot without immediate requirement

### Performance Impact

- **Positive**: 5-minute cron cycle (vs 30-min) catches budget violations faster
- **Positive**: ActiveSession tracking per-user, not global (better granularity)
- **Risk**: Telegram API calls 3x more frequent (old 30min → new 5min); monitor quota
- **Mitigation**: Non-blocking Telegram sends; errors swallowed, logged only

### Files Modified

Backend:
- `packages/api/src/models/schedule.ts` — Schema redesign
- `packages/api/src/models/user.ts` — Add telegram fields
- `packages/api/src/models/active-session.ts` — NEW
- `packages/api/src/services/alert-service.ts` — New budget check functions
- `packages/api/src/services/telegram-service.ts` — Dual-bot support
- `packages/api/src/routes/schedules.ts` — Complete rewrite
- `packages/api/src/routes/user-settings.ts` — NEW
- `packages/api/src/lib/encryption.ts` — NEW
- `packages/api/src/index.ts` — Cron integration
- `packages/shared/types.ts` — Schedule, Alert, User types

Frontend:
- `packages/web/src/components/schedule-grid.tsx` — Hourly time grid
- `packages/web/src/components/schedule-cell.tsx` → time block rendering
- `packages/web/src/pages/schedule.tsx` — UI redesign, seat tabs, create dialog
- `packages/web/src/pages/dashboard.tsx` — Over-budget badge
- `packages/web/src/hooks/use-schedules.ts` — Updated mutations
- `packages/web/src/hooks/use-user-settings.ts` — NEW
- `packages/web/src/components/bot-settings-form.tsx` — NEW settings UI

### Testing & Validation

- Build: ✓ TypeScript compilation passes
- Tests: ✓ All passing
- Linting: ✓ Clean
- Manual: Schedule creation with hourly blocks, budget overflow detection, personal bot configuration

### Related Plans

- Plan: `plans/dattqh/260404-1250-schedule-usage-bot-redesign/`
- Phases: 3 (all complete)
- Brainstorm: `plans/dattqh/reports/brainstorm-260404-1237-schedule-usage-bot-redesign.md`

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
