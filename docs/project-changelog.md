# Project Changelog

All notable changes to the Claude Teams Management Dashboard project are documented here.

**Format**: Major features, breaking changes, and significant bug fixes are listed chronologically. Minor updates and refactoring are grouped by release cycle.

---

## [2026-04-05] Remove Teams Model + Dashboard Enrichment

### Major Changes

**Teams Model Removed (Complete Elimination)**
- Deleted `packages/api/src/models/team.ts` — 22-line schema
- Deleted `packages/api/src/routes/teams.ts` — 11 CRUD endpoints (395 lines)
- Removed `requireTeamOwnerOrAdmin` middleware — no longer needed
- Dropped `teams` MongoDB collection
- Removed `team_ids` from User schema
- Removed `team_id` from Seat schema
- Cleaned 17 files removing all team references (types, imports, UI components, hooks)

**Rationale:**
- Teams were organizational grouping only, no core logic dependency
- < 5 seats per user → YAGNI (You Aren't Gonna Need It)
- Simplified data model: User.seat_ids (assigned) + Seat.owner_id (ownership) sufficient
- Freed up dashboard slot for richer per-seat insights

**Dashboard API Enrichment**

Extended `/api/dashboard/enhanced` response:
1. **tokenIssueCount** — seats with inactive tokens or fetch errors (computed, no extra query)
2. **fullSeatCount** — seats at capacity (user_count >= max_users)
3. **owner_name** per seat in usagePerSeat — single batch User query by owner_ids

New `/api/dashboard/personal` endpoint (auth required):
- `mySchedulesToday` — user's scheduled slots with seat labels + budget
- `mySeats` — owned + assigned seats with role badge
- `myUsageRank` — user's position in system (rank, total, avg delta 5h)

**Frontend UI Updates**

Dashboard components redesigned:
1. **DashboardStatOverview** — Token health badge (admin only) using tokenIssueCount
2. **DashboardDetailTable** — Removed Team column, added owner name display under seat label
3. **DashboardPersonalContext** — New component for non-admin users showing schedule, seats, rank

**Removed UI Components** (6 files):
- `pages/teams.tsx`, `pages/team-detail.tsx`
- `components/team-card.tsx`, `team-form-dialog.tsx`
- `components/dashboard-team-stats.tsx`
- `hooks/use-teams.ts`

**Cleaned Components** (11+ files):
- Navigation: app.tsx, sidebar, mobile-nav, header
- Auth hooks: auth-provider, use-admin, use-seats, use-schedules, use-user-settings
- Admin UI: user-form-dialog, user-table
- Seat UI: seat-card, seat-form-dialog, usage-snapshot-card
- Dashboard: dashboard-seat-filter, dashboard-seat-efficiency, watched-seats-card

### Data Model Changes

**User schema** (breaking):
- Removed: `team_ids: ObjectId[]`

**Seat schema** (breaking):
- Removed: `team_id: ObjectId`

**Dashboard response** (breaking):
- Removed: `teamUsage` aggregate object
- Removed: `team_id` from usagePerSeat items
- Added: `tokenIssueCount: number`
- Added: `fullSeatCount: number`
- Added: `owner_name: string` per seat in usagePerSeat

### Route Changes

**Removed Endpoints**:
- `GET /api/teams` (was: list teams)
- `POST /api/teams` (was: create team)
- `GET /api/teams/:id` (was: get team details)
- `PUT /api/teams/:id` (was: update team)
- `DELETE /api/teams/:id` (was: delete team)
- `POST /api/teams/:id/members` (was: add member)
- `DELETE /api/teams/:id/members/:userId` (was: remove member)
- ... (11 total endpoints removed)

**Extended Endpoints**:
- `GET /api/dashboard/enhanced` — Now returns tokenIssueCount, fullSeatCount, owner_name
- `GET /api/dashboard/personal` — NEW endpoint, scoped to requesting user

### Breaking Changes

1. **Teams model removed from all layers** — no backward compatibility path
   - API clients cannot access team CRUD
   - JWT no longer includes team_ids
   - Frontend routes `/teams`, `/teams/:id` removed

2. **Dashboard response shape changed**
   - Removed: `teamUsage` (grouped usage by team)
   - Added: `tokenIssueCount`, `fullSeatCount`
   - Seats now include `owner_name` (requires User batch query)
   - No team_id in seat entries

3. **Frontend team components removed**
   - `useTeams` hook no longer available
   - Team badges, selectors, pages gone
   - Team grouping in dashboard/watched-seats replaced with flat seat lists

### Backward Compatibility

- **Zero**: Old team documents in database remain but are unused by application
- **Zero**: Old API clients expecting team endpoints will fail with 404
- No migration needed — schema changes additive to remaining fields

### Testing

- Build: ✓ `pnpm -F @repo/api build` passes
- Build: ✓ `pnpm -F @repo/web build` passes
- Tests: ✓ 24/24 passing (team-related tests removed/updated)
- Linting: ✓ Clean (ESLint + Prettier)
- Manual: Dashboard renders with new badges, /personal endpoint returns correct data

### Files Modified

**Deleted (8 files):**
- `packages/api/src/models/team.ts`
- `packages/api/src/routes/teams.ts`
- `packages/web/src/pages/teams.tsx`
- `packages/web/src/pages/team-detail.tsx`
- `packages/web/src/components/team-card.tsx`
- `packages/web/src/components/team-form-dialog.tsx`
- `packages/web/src/components/dashboard-team-stats.tsx`
- `packages/web/src/hooks/use-teams.ts`

**Backend Modified (10 files):**
- `packages/api/src/index.ts` — Remove teams route mount
- `packages/api/src/middleware.ts` — Remove requireTeamOwnerOrAdmin
- `packages/api/src/routes/auth.ts` — Remove team_ids from JWT/response
- `packages/api/src/routes/admin.ts` — Remove team_ids references
- `packages/api/src/routes/seats.ts` — Remove team_id populate/create/update
- `packages/api/src/routes/dashboard.ts` — Add tokenIssueCount, fullSeatCount, owner_name; remove teamUsage; add /personal
- `packages/api/src/routes/user-settings.ts` — Remove team_id reference
- `packages/api/src/services/alert-service.ts` — Remove emitTeamEvent
- `packages/api/src/models/user.ts` — Remove team_ids field
- `packages/api/src/models/seat.ts` — Remove team_id field

**Frontend Modified (17+ files):**
- `packages/web/src/app.tsx` — Remove teams routes
- `packages/web/src/components/app-sidebar.tsx` — Remove Teams nav item
- `packages/web/src/components/mobile-nav.tsx` — Remove Teams nav item
- `packages/web/src/components/header.tsx` — Remove /teams breadcrumb
- `packages/web/src/components/auth-provider.tsx` — Remove team_ids from AuthUser
- `packages/web/src/pages/dashboard.tsx` — Add DashboardPersonalContext, remove DashboardTeamStats
- `packages/web/src/pages/admin.tsx` — Remove team columns/selectors
- `packages/web/src/components/dashboard-stat-overview.tsx` — Add token health badge
- `packages/web/src/components/dashboard-detail-table.tsx` — Remove Team column, add owner_name
- `packages/web/src/components/dashboard-personal-context.tsx` — NEW component
- `packages/web/src/components/dashboard-seat-filter.tsx` — Remove team grouping
- `packages/web/src/components/dashboard-seat-efficiency.tsx` — Remove team display
- `packages/web/src/components/watched-seats-card.tsx` — Remove team grouping
- `packages/web/src/components/seat-card.tsx` — Remove team badge
- `packages/web/src/components/seat-form-dialog.tsx` — Remove team selector
- `packages/web/src/components/usage-snapshot-card.tsx` — Remove team badge
- `packages/web/src/components/user-form-dialog.tsx` — Remove team selector
- `packages/web/src/components/user-table.tsx` — Remove Team column

**Hooks Modified (5 files):**
- `packages/web/src/hooks/use-admin.ts` — Remove team_ids from mutations
- `packages/web/src/hooks/use-seats.ts` — Remove SeatTeam interface, team fields
- `packages/web/src/hooks/use-schedules.ts` — Remove team_id/team from schedule
- `packages/web/src/hooks/use-user-settings.ts` — Remove team_id from seat
- `packages/web/src/hooks/use-dashboard.ts` — Add personal dashboard hook

**Shared Modified (1 file):**
- `packages/shared/types.ts` — Remove Team, SeatTeam, team_ids/team_id from all types

### Related Plans

- Plan: `plans/dattqh/260404-2348-dashboard-enrichment/`
- Phases: 5 (all complete)
- Code review: 8.5/10 approved with follow-ups on 30-day rank window, rank ascending sort, Vietnamese diacritics

---

## [2026-04-04] Refactor Alert Settings to User Settings

### Major Changes

**Global Setting Model Removed**
- Deleted `packages/api/src/models/setting.ts` — no longer used
- Deleted `packages/api/src/routes/settings.ts` — no longer used
- Alert thresholds now **per-user**, not global

**Per-User Alert Settings**
- New nested `alert_settings` object in User model:
  - `enabled` (boolean, default: false) — User toggle for alerts
  - `rate_limit_pct` (number, default: 80) — User's rate limit threshold
  - `extra_credit_pct` (number, default: 80) — User's extra credit threshold
  - `subscribed_seat_ids` (ObjectId[], default: []) — Which seats trigger user's alerts

**Alert Notification Flow Changed**
- Alerts now sent **only to subscribed users** via their personal Telegram bot
- System bot (`TELEGRAM_BOT_TOKEN`) no longer used for alert notifications
- Users control which seats they monitor and at what thresholds
- Non-admin users can only subscribe to their owned + assigned seats

**Admin Page Updated**
- Alert threshold / Telegram bot config sections **removed** from admin page
- Users self-manage alerts via Settings page → Alert Settings Form

**Settings Page Extended**
- New `AlertSettingsForm` component added
- Users toggle alerts on/off
- Per-seat subscription checkboxes
- Rate limit % and extra credit % thresholds
- Save persists to `/api/user/settings`

### API Changes

**Removed Endpoints**:
- `GET /api/settings` (was: get global thresholds)
- `PUT /api/settings` (was: update global thresholds)
- `POST /api/admin/send-report` (was: manual global alert trigger)

**Extended Endpoints**:
- `GET /api/user/settings` — Now returns `alert_settings` + `available_seats` list
- `PUT /api/user/settings` — Accepts `alert_settings` with validation

### Data Model Changes

**User schema** (additive):
- Added: `alert_settings` nested object (optional)
  - Validates subscribed_seat_ids: non-admin users limited to owned + assigned

**Type updates** (`packages/shared/types.ts`):
- New `AlertSettings` interface exported
- User.alert_settings field added (optional)

### Service Changes

**alert-service.ts**:
- `checkSnapshotAlerts()` refactored to:
  - Iterate over users with `alert_settings.enabled = true`
  - For each user + subscribed seat: evaluate against user's thresholds
  - Create alert per user (not per seat globally)
  - Send Telegram only to subscribed user's personal bot

**telegram-service.ts**:
- `sendAlertToUser(user, type, seatLabel, metadata)` — NEW function
  - Sends via user's personal bot only (no system bot fallback for alerts)
  - Decrypts user's telegram_bot_token
  - Returns success/error

### Breaking Changes

1. **Alert notification routing changed**
   - System bot no longer sends alert notifications
   - Personal bots required for users to receive alerts
   - Unconfigured users receive no alerts (graceful skip)

2. **Alert thresholds now per-user**
   - Admin no longer sets global thresholds
   - Each user controls their own alert sensitivity
   - Default: 80% for both rate_limit and extra_credit

3. **/api/settings route removed**
   - Client code expecting GET/PUT /api/settings will fail
   - Replace with GET/PUT /api/user/settings

### Backward Compatibility

- Existing alert documents remain queryable
- Existing usage snapshots unaffected
- Cron schedule unchanged (still 5-minute cycle)
- Non-enabled users (default) receive no alerts (opt-in required)

### Testing

- Build: ✓ TypeScript compilation passes
- Tests: ✓ All passing
- Linting: ✓ Clean
- Manual: Per-user alert creation, subscription filtering, Telegram send

### Files Modified

Backend:
- `packages/api/src/models/user.ts` — Add alert_settings field
- `packages/api/src/services/alert-service.ts` — Refactor checkSnapshotAlerts() for per-user logic
- `packages/api/src/services/telegram-service.ts` — New sendAlertToUser() function
- Deleted: `packages/api/src/models/setting.ts`
- Deleted: `packages/api/src/routes/settings.ts`

Frontend:
- `packages/web/src/pages/settings.tsx` — Remove global settings sections (if any)
- `packages/web/src/pages/admin.tsx` — Remove alert threshold UI
- `packages/web/src/components/alert-settings-form.tsx` — NEW component
- `packages/web/src/hooks/use-user-settings.ts` — Add alert_settings field

Shared:
- `packages/shared/types.ts` — Add AlertSettings interface

### Related Plans

- Plan: `plans/dattqh/260404-1754-refactor-alert-to-user-settings/`

---

## [2026-04-04] Per-User Notification Schedule

### Major Features

**Per-User Configurable Notification Schedules**
- Replace fixed Friday 08:00 cron report with per-user configurable daily/hourly delivery
- Each user can select which days (Sun-Sat) and hour (0-23) to receive usage reports
- Toggle notifications on/off from settings page
- Personal Telegram bot required for delivery (warns if unconfigured)

**Admin Scope Override (admin-only)**
- Admins can set `report_scope` to 'all' (view full report)
- Non-admin users locked to `report_scope='own'` (own seats only)
- UI scope selector hidden for non-admin users

**Hourly Cron Check**
- Replaced fixed Friday cron with hourly check: `0 * * * *` (every hour at :00)
- Finds all users with `notification_settings.report_enabled = true` matching current day/hour
- Timezone: Asia/Ho_Chi_Minh (server-side, no per-user TZ)
- Graceful handling: skips if user has no Telegram bot configured

**Report Filtering by Seat Ownership**
- Reports filtered by user's seat ownership based on scope:
  - `scope='own'`: Shows user's owned seats + assigned seats
  - `scope='all'` (admin): Shows all seats system-wide
- Merged seat list with deduplication
- Maintains existing report HTML format + metadata

### Data Model Changes

**User schema** (additive):
- Added: `notification_settings` nested object (optional)
  - `report_enabled` (boolean, default false)
  - `report_days` (number[], default [5] = Friday)
  - `report_hour` (0-23, default 8)
  - `report_scope` ('own' | 'all', default 'own')

**Type updates** (`packages/shared/types.ts`):
- New `NotificationSettings` interface exported
- User.notification_settings field added (optional)

### Route Changes

**User Settings Routes**:
- `GET /api/user/settings` — Now returns notification_settings
- `PUT /api/user/settings` — Accepts notification_settings; enforces report_scope='own' for non-admin

### Service Changes

**telegram-service.ts**:
- New `sendUserReport(userId, scope)` — Per-user filtered report generation
- New `checkAndSendScheduledReports()` — Hourly scheduler check
- Extracted `buildReportHtml()` helper — Shared report-building logic
- Updated `sendWeeklyReport()` — Retained for admin manual trigger (Friday 17:00)

**index.ts**:
- Removed: Old Friday 08:00 fixed cron
- Added: Hourly cron `0 * * * *` calling `checkAndSendScheduledReports()`
- Removed: `isVietnamHoliday` import (no longer needed)

### Frontend Changes

**Settings page** (new section):
- New `notification-schedule-form.tsx` component
- Toggle: Enable/disable notifications
- Day selection: 7 buttons (Sun-Sat) with checkboxes
- Hour dropdown: 0-23 formatted as "08:00", "09:00", etc.
- Scope selector: (admin only, hidden for non-admin users)
- Warning message: "Cần cấu hình Telegram bot trước khi bật thông báo" when no bot
- Conditional disable: Hour/day selectors disabled when toggle is off
- Save button: Calls PUT /api/user/settings

**Hooks**:
- Updated `use-user-settings.ts` — Loads/saves notification_settings

### Configuration

No new environment variables required. Uses existing `ENCRYPTION_KEY` and Telegram credentials.

### Breaking Changes

None. Feature is additive; existing cron and manual send unaffected.

### Backward Compatibility

- Existing Friday 17:00 manual report sending untouched
- Users default to report_enabled=false (opt-in required)
- Default schedule Friday 08:00 if enabled (matching old cron)
- Non-breaking API: new field optional in User responses

### Testing

- Build: ✓ TypeScript compilation passes
- Tests: ✓ 3 pre-existing test failures unrelated (prior hook removal)
- Linting: ✓ Clean
- Manual: Hourly cron executes, per-user reports generate + send to Telegram

### Files Modified

Backend:
- `packages/api/src/models/user.ts` — Add notification_settings field
- `packages/api/src/routes/user-settings.ts` — Add notification_settings to GET/PUT
- `packages/api/src/services/telegram-service.ts` — sendUserReport, checkAndSendScheduledReports, buildReportHtml
- `packages/api/src/index.ts` — Replace cron, remove unused import

Frontend:
- `packages/web/src/pages/settings.tsx` — Include notification-schedule-form
- `packages/web/src/components/notification-schedule-form.tsx` — NEW component
- `packages/web/src/hooks/use-user-settings.ts` — Add notification_settings field

Shared:
- `packages/shared/types.ts` — Add NotificationSettings interface

### Related Plans

- Plan: `plans/dattqh/260404-1737-per-user-notification-schedule/`
- Phases: 4 (all complete)

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
