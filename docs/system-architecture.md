# System Architecture

## Overview

Claude Teams Management Dashboard is a pnpm monorepo with 3 packages: Express 5 + TypeScript backend, Vite + React 19 SPA frontend, and shared TypeScript types. Manages Claude API seats (account licenses) with per-owner credentials, automated seat activity tracking, and usage monitoring.

**Architecture Type**: Monorepo (pnpm workspaces) with clear separation between packages: API backend (Express 5), web frontend (React + Vite), and shared types.

## Technology Stack

### Backend (`packages/api`)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5
- **Framework**: Express 5.x
- **Dev Server**: tsx with file watching
- **ORM/ODM**: Mongoose 9.3.1 (MongoDB)
- **Authentication**: Firebase Admin SDK 13.7.0 + JWT (jsonwebtoken 9.0.3)
- **Task Scheduling**: node-cron 4.2.1
- **Notifications**: Telegram Bot API
- **Middleware**: cors, cookie-parser, express.json

### Frontend (`packages/web`)
- **Architecture**: Single Page Application (SPA)
- **Framework**: React 19
- **Router**: React Router v7
- **Build Tool**: Vite 8
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 (via @tailwindcss/vite)
- **UI Components**: shadcn/ui (Radix UI)
- **Charts**: Recharts 3.8.0
- **Data Fetching**: @tanstack/react-query 5.95.0
- **Notifications**: Sonner (toast library)

### Database
- **Type**: MongoDB (document-based NoSQL)
- **Connection**: Mongoose 9.3.1 ODM
- **Collections**: 8 (seats, users, schedules, alerts, usage_snapshots, seat_activity_logs, usage_windows, teams)
- **Indexing**: Compound indexes on (seat_id, day_of_week), (user_id, seat_id, type, window), and (seat_id, fetched_at)
- **TTL**: usage_snapshots collection auto-expires after 90 days; seat_activity_logs kept for pattern analysis

### Monorepo & Shared (`packages/shared`)
- **Package Manager**: pnpm workspaces
- **Shared Exports**: TypeScript types (exported via types.ts)
- **Workspace Configuration**: pnpm-workspace.yaml

### Infrastructure
- **Hosting**: Any Node.js-compatible server
- **API Port**: 8386 (configurable via API_PORT)
- **Frontend Port**: 5173 (Vite dev, proxies /api to API)
- **Environment**: .env-based configuration (package-level .env.local files)
- **Build**: TypeScript compilation to dist/ directories

## System Components

### 1. Authentication System

**Flow**:
```
User → Login Page (React component) → Google Sign-In (Firebase Client SDK)
    ↓
idToken → POST /api/auth/google
    ↓
API verifies via Firebase Admin SDK
    ↓
JWT issued in httpOnly, Secure, SameSite=Strict cookie (24h expiry)
    ↓
Subsequent requests: JWT read from cookie or Authorization header
```

**Key Files**:
- `packages/web/src/pages/login.tsx` — Google sign-in UI
- `packages/api/src/firebase-admin.ts` — Firebase Admin initialization
- `packages/api/src/routes/auth.ts` — Auth endpoints (/api/auth/*)
- `packages/api/src/middleware.ts` — JWT verification, role checks

**Protected Endpoints**:
- All `/api/*` routes require valid JWT
- Admin endpoints require `role === 'admin'`
- Public routes: `/login.html`

### 2. Backend API (Express 5 + TypeScript)

**Location**: `packages/api/src`

**Architecture**:
- TypeScript for type safety
- Modular route handlers organized by resource
- Service layer for business logic
- Middleware stack for auth, parsing, CORS
- Error handling with try-catch in all async handlers

**Route Structure** (9 files):
- `routes/auth.ts` — Login, logout, current user
- `routes/dashboard.ts` — Stats, weekly summary, alerts
- `routes/seats.ts` — Seat CRUD (owner auto-set), user assignment, token management, credentials export, profile cache
  - `POST /seats` — Any auth user (auto-sets owner); supports `restore_seat_id` (undelete) or `force_new` (admin-only, cascade-delete old)
  - `GET /seats` — List all seats with owner + assigned users
  - `GET /seats/available-users` — List active users for assignment
  - `GET /seats/:id/credentials/export` — Export single seat (owner only, no admin bypass)
  - `GET /seats/:id/profile` — Return cached profile, auto-refresh if stale >6h
  - `POST /seats/:id/profile/refresh` — Force-refresh profile from Anthropic OAuth endpoint
  - `POST /seats/preview-token` — Preview credential JSON: parse + fetch profile + check duplicates/restorable
  - `PUT /seats/:id` — Update seat details (owner or admin via requireSeatOwnerOrAdmin)
  - `DELETE /seats/:id` — Soft-delete seat (owner or admin); allow restore via restore_seat_id
  - `POST /seats/:id/assign` — Assign user (owner or admin)
  - `DELETE /seats/:id/unassign/:userId` — Unassign user (owner or admin)
  - `PUT /seats/:id/token` — Set/update credential + auto-populate profile (owner or admin)
  - `PUT /seats/:id/transfer` — Transfer ownership to another user (admin only)
- `routes/admin.ts` — User management, manual alert check trigger
- `routes/schedules.ts` — Auto-generated activity patterns (read-only), heatmap aggregation, activity logs, realtime status
- `routes/alerts.ts` — Alert creation, resolution, listing
- `routes/teams.ts` — Team CRUD (any user can create, owner/admin manage, non-admin restricted to owned seats)
- `routes/usage-snapshots.ts` — Query snapshots, trigger collection
- `routes/user-settings.ts` — Per-user alert settings, Telegram bot config, notification schedule, test notifications

**Service Layer**:
- `services/alert-service.ts` — Core alert generation, snapshot-based threshold checking, deduplication logic
- `services/predictive-alert-service.ts` — Predictive alert logic: fast_burn (velocity + ETA) and quota_forecast (7d linear projection)
- `services/telegram-service.ts` — Telegram message formatting, personal + system bot notifications
- `services/usage-collector-service.ts` — Fetch usage data from Anthropic API, concurrent collection
- `services/seat-activity-detector.ts` — Detect hourly activity from usage snapshot deltas, populate SeatActivityLog
- `services/activity-pattern-service.ts` — Analyze historical activity, generate weekly recurring patterns, update Schedule collection
- `services/activity-anomaly-service.ts` — Detect unusual activity spikes for anomaly alerts
- `services/anthropic-service.ts` — Anthropic OAuth profile fetch & caching
- `services/quota-forecast-service.ts` — Linear regression forecasting for 7-day quotas

**Utility Libraries**:
- `lib/encryption.ts` — AES-256-GCM encrypt/decrypt for Telegram bot tokens

### 3. Database Layer (Mongoose + TypeScript)

**Location**: `packages/api/src/models`

**8 Collections**:

#### Seats
```typescript
{
  _id: ObjectId,
  email: String (required, unique per non-deleted seat),
  label: String (required),
  owner_id: ObjectId | null (ref: User, index: true),
  max_users: Number (default: 3),
  oauth_credential: {
    access_token: String | null (encrypted AES-256-GCM),
    refresh_token: String | null (encrypted),
    expires_at: Date | null,
    scopes: [String],
    subscription_type: String | null,
    rate_limit_tier: String | null
  } | null (select: false),
  profile: {
    account_name: String | null,
    display_name: String | null,
    org_name: String | null,
    org_type: String | null,
    billing_type: String | null,
    rate_limit_tier: String | null,
    subscription_status: String | null,
    has_claude_max: Boolean,
    has_claude_pro: Boolean,
    fetched_at: Date | null
  } | null (auto-populated on token set, stale after 6h),
  token_active: Boolean (default: false),
  last_fetched_at: Date | null,
  last_fetch_error: String | null,
  last_refreshed_at: Date | null,
  include_in_overview: Boolean (admin/owner toggle for dashboard visibility),
  deleted_at: Date | null (soft delete for restore flow; indexed),
  created_at: Date
}
```

#### Users
```typescript
{
  _id: ObjectId,
  name: String (required),
  email: String (unique, sparse),
  role: String (enum: ['admin', 'user'], default: 'user'),
  seat_ids: [ObjectId] (ref: Seat),
  active: Boolean (default: true),
  telegram_bot_token: String | null (encrypted AES-256-GCM),
  telegram_chat_id: String | null,
  telegram_topic_id: String | null,
  watched_seats: [{
    seat_id: ObjectId (ref: Seat, unique per user),
    threshold_5h_pct: Number (default: 90, 5-hour usage threshold),
    threshold_7d_pct: Number (default: 85, 7-day usage threshold),
    burn_rate_threshold: Number | null (default: 15 %/h, null = disabled for fast_burn alerts),
    eta_warning_hours: Number | null (default: 1.5h, null = disabled, hours to 100%),
    forecast_warning_hours: Number | null (default: 48h, null = disabled, lookahead for quota_forecast)
  }] (comprehensive seat monitoring config per user),
  notification_settings: {
    report_enabled: Boolean (default: false),
    report_days: [Number] (default: [5], 0=Sun, 6=Sat),
    report_hour: Number (0-23, default: 8)
  },
  alert_settings: {
    enabled: Boolean (default: false),
    telegram_enabled: Boolean (default: true),
    token_failure_enabled: Boolean (default: true)
  },
  dashboard_filter_seat_ids: [ObjectId] (ref: Seat, user's preferred seat filter),
  dashboard_default_range: String (enum: ['day', 'week', 'month', '3month', '6month'], default: 'day'),
  fcm_tokens: [String] (Firebase Cloud Messaging tokens, default: []),
  push_enabled: Boolean (FCM push notifications, default: false),
  created_at: Date
}
```

#### Schedules (Auto-Generated Activity Patterns)
```typescript
{
  _id: ObjectId,
  seat_id: ObjectId (ref: Seat),
  day_of_week: Number (0=Sunday, 6=Saturday),
  start_hour: Number (0-23, inclusive),
  end_hour: Number (0-23, exclusive),
  source: String (enum: 'auto' | 'legacy', auto-generated vs. legacy entries),
  created_at: Date,
  // Index: (seat_id, day_of_week), (seat_id, source)
  // Auto-patterns generated daily by pattern analyzer from seat activity logs
}
```

#### SeatActivityLog (Hourly Activity Tracking)
```typescript
{
  _id: ObjectId,
  seat_id: ObjectId (ref: Seat),
  date: Date (start of day in Asia/Ho_Chi_Minh),
  hour: Number (0-23),
  is_active: Boolean (true if any usage delta > 0),
  delta_5h_pct: Number (accumulated 5h usage % increase),
  snapshot_count: Number (snapshots with activity this hour),
  created_at: Date,
  // Index: (seat_id, date, hour) unique per seat/day/hour
  // Populated by 5-min cron, analyzed daily for pattern detection
}
```

#### Alerts
```typescript
{
  _id: ObjectId,
  user_id: ObjectId | null (ref: User, primary dedup key),
  seat_id: ObjectId (ref: Seat),
  type: String (enum: ['rate_limit', 'token_failure', 'usage_exceeded', 'session_waste', '7d_risk', 'fast_burn', 'quota_forecast']),
  window: String | null (enum: ['5h', '7d'], for rate_limit/fast_burn alerts),
  message: String,
  metadata: {
    // Common fields
    pct?: Number,
    error?: String,
    delta?: Number,
    budget?: Number,
    user_id?: String,
    user_name?: String,
    // Predictive alert fields (fast_burn, quota_forecast)
    velocity?: Number (%/h burn rate),
    eta_hours?: Number (hours to 100% for fast_burn),
    slope_per_hour?: Number (7d slope for quota_forecast),
    hours_to_threshold?: Number (hours to user threshold),
    hours_to_reset?: Number (hours until window reset)
  },
  read_by: [ObjectId] (users who marked as read),
  notified_at: Date | null (when notification sent, prevents re-notify),
  created_at: Date,
  // Index: (user_id, seat_id, type, window, created_at) primary dedup
  // Index: (seat_id, type, created_at) for feed queries
  // Index: (read_by) for user unread queries
}
```

#### UsageSnapshots
```typescript
{
  _id: ObjectId,
  seat_id: ObjectId (ref: Seat),
  raw_response: Object (Anthropic API response),
  five_hour_pct: Number | null,
  five_hour_resets_at: Date | null,
  seven_day_pct: Number | null,
  seven_day_resets_at: Date | null,
  seven_day_sonnet_pct: Number | null,
  seven_day_sonnet_resets_at: Date | null,
  seven_day_opus_pct: Number | null,
  seven_day_opus_resets_at: Date | null,
  extra_usage: {
    is_enabled: Boolean,
    monthly_limit: Number | null,
    used_credits: Number | null,
    utilization: Number | null
  },
  fetched_at: Date,
  // Index: (seat_id, fetched_at) compound
  // TTL: auto-delete after 90 days
}
```

#### ActiveSession
```typescript
{
  _id: ObjectId,
  seat_id: ObjectId (ref: Seat),
  user_id: ObjectId (ref: User),
  schedule_id: ObjectId (ref: Schedule),
  started_at: Date,
  snapshot_at_start: {
    five_hour_pct: Number | null,
    seven_day_pct: Number | null,
    seven_day_sonnet_pct: Number | null,
    seven_day_opus_pct: Number | null
  },
  // Index: (seat_id) for one-per-seat tracking
  // Transient: deleted when session ends (no TTL)
}
```

#### Teams (View-Only Seat Grouping)
```typescript
{
  _id: ObjectId,
  name: String (required, unique),
  description: String | null (max 500 chars),
  seat_ids: [ObjectId] (ref: Seat, view-only grouping),
  member_ids: [ObjectId] (ref: User),
  owner_id: ObjectId (ref: User, index: true),
  created_at: Date,
  // Index: (owner_id), (member_ids)
  // Design: Team = view-only grouping for organizational clarity
  // Alerts & schedules still require individual seat_ids
  // Soft-deleted seats auto-removed from teams via cleanup job
}
```

### 4. Frontend SPA (React 19 + Vite)

**Location**: `packages/web/src`

**Architecture**:
```
index.html (Vite entry with root <div>)
    ↓
main.tsx (React app bootstrap)
    ↓
App.tsx (React Router v7 provider)
    ↓
Routes + Components (pages, layouts, UI components)
    ↓
API calls via React Query (TanStack Query)
```

**Key Files**:
- `pages/` — Route pages (dashboard, seats, schedules, etc.)
- `components/` — Reusable UI components (cards, dialogs, grids)
- `app.tsx` — Root App component with React Router
- `main.tsx` — React app entry point
- `components/auth-provider.tsx` — Firebase Auth context
- `components/dashboard-shell.tsx` — Main layout shell with sidebar

**Page Components**:
1. `pages/dashboard.tsx` — Overview stats, recent alerts, summary cards, fleet KPIs
2. `pages/usage-log.tsx` — Usage snapshots & historical metrics with date filtering
3. `pages/seats.tsx` — List, create, edit, delete seats + assign users
4. `pages/schedule.tsx` — Auto-generated activity heatmap (7x24 grid), activity logs, realtime status per seat
5. `pages/teams.tsx` — Create/edit/delete team groups, manage members, view grouped seats (view-only)
6. `pages/alerts.tsx` — View and resolve alerts, filter by type/window/seat
7. `pages/admin.tsx` — User CRUD, system admin panel
8. `pages/login.tsx` — Login page with Google sign-in

**State Management**:
- React Context for global auth state
- React Query (TanStack Query) for server state
- Component-level state via useState
- URL-based routing with React Router v7

### 5. Scheduled Tasks (Cron)

**Jobs** (via node-cron in `packages/api/src/index.ts`):

1. **Every 5 minutes** — `collectAllUsage()` → `detectSeatActivity()` → `checkSnapshotAlerts()`
   - **collectAllUsage()** from usage-collector-service.ts:
     - Fetches usage metrics from Anthropic API for all seats with active tokens
     - Decrypts stored access tokens (AES-256-GCM)
     - Stores snapshots in usage_snapshots collection with 90-day TTL
     - Logs completion stats and errors per seat
     - Mutex guard prevents overlapping runs
   - **detectSeatActivity()** from seat-activity-detector.ts (chained after collection):
     - Analyzes usage snapshot deltas to detect hourly activity
     - For each seat: calculates is_active, delta_5h_pct for current hour
     - Upserts SeatActivityLog record (unique: seat_id, date, hour)
     - Feeds pattern analyzer with activity data
   - **checkSnapshotAlerts()** from alert-service.ts (chained after activity detection):
     - Evaluates latest UsageSnapshot for each seat
     - For each user watching that seat: checks against user's watched_seats thresholds
     - Creates snapshot alerts: rate_limit (5h, 7d windows), token_failure
     - Creates predictive alerts via predictive-alert-service.ts:
       * **fast_burn**: velocity >= burn_rate_threshold AND eta_hours <= eta_warning_hours
       * **quota_forecast**: 7d slope projects hit user threshold within forecast_warning_hours
     - Deduplicates: max 1 unresolved alert per (user_id, seat_id, type, window)
     - Sends Telegram notification to subscribed user via personal bot

2. **Daily 04:00 Asia/Saigon** — `generateAllPatterns()` from activity-pattern-service.ts
   - Analyzes historical activity in SeatActivityLog (past 2-4 weeks)
   - For each seat: detects recurring weekly patterns (7x24 grid)
   - Generates Schedule entries with source='auto' (replaces previous auto entries)
   - Calls `detectActivityAnomalies()` to identify unusual spikes
   - Returns stats: patterns_generated, anomalies_detected

3. **Every hour (`0 * * * *)** — `checkAndSendScheduledReports()` from telegram-service.ts
   - Finds all users with enabled notification schedule matching current day/hour
   - Generates per-user usage report filtered by seat ownership
   - Admin users see all seats; regular users see only owned/assigned seats
   - Sends via personal Telegram bot (gracefully skips if unconfigured)
   - Timezone: Asia/Ho_Chi_Minh (server-side)

3. **Friday 17:00 Asia/Saigon** — `sendWeeklyReport()` from telegram-service.ts
   - Compiles usage summary using UsageSnapshot data
   - Lists alerts triggered
   - Sends formatted report to Telegram (system bot)

**Configuration**:
- `packages/api/src/index.ts` — Cron schedule setup (5-min, daily, hourly, weekly)
- `packages/api/src/services/alert-service.ts` — Snapshot-based alert generation
- `packages/api/src/services/seat-activity-detector.ts` — Hourly activity detection & logging
- `packages/api/src/services/activity-pattern-service.ts` — Daily pattern generation & anomaly detection
- `packages/api/src/services/telegram-service.ts` — Message formatting, dual-bot support (system + per-user)
- Requires `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (system bot)
- Requires `ENCRYPTION_KEY` (64-char hex string = 32 bytes) for AES-256-GCM encryption

### 6. Configuration & Environment

**Config Files**:
- `packages/api/src/config.ts` — API environment config
- `.env` (root) — Shared environment variables for all packages
- No hardcoded secrets; all from environment

**Environment Variables**:
```
Required:
  JWT_SECRET              — JWT signing key (min 32 chars)
  MONGO_URI              — MongoDB connection URL
  FIREBASE_SERVICE_ACCOUNT_PATH — Firebase admin JSON path
  ENCRYPTION_KEY         — 64-char hex string (32 bytes) for AES-256-GCM encryption (access tokens + bot tokens)

Optional:
  API_PORT               — API server port (default: 8386)
  TELEGRAM_BOT_TOKEN     — System bot token for group notifications
  TELEGRAM_CHAT_ID       — Telegram chat ID for system bot
  TELEGRAM_TOPIC_ID      — Telegram topic (optional)
  WEB_URL                — Public web URL (default: http://localhost:5173)
```

**Note**: Users can configure personal Telegram bot tokens via `/api/user/settings` (encrypted with ENCRYPTION_KEY)

## Data Flow

### Authentication Flow
```
User submits email/password → Firebase Client SDK (Google sign-in)
    ↓
Firebase issues idToken
    ↓
Frontend: POST /api/auth/google { idToken }
    ↓
Backend: Verify via Firebase Admin SDK
    ↓
Backend: Generate JWT, set httpOnly cookie
    ↓
Frontend: Redirect to SPA (index.html)
    ↓
Subsequent API calls include JWT in cookie
```

### Alert Generation Flow
```
Every 5 min Cron / Admin manual trigger → checkSnapshotAlerts() → checkBudgetAlerts()

SNAPSHOT ALERTS:
    ↓
Get latest UsageSnapshot per seat (last snapshot)
    ↓
For each subscribed user + seat combination:
  • Load user's alert_settings: rate_limit_pct, extra_credit_pct, enabled flag
  • Rate Limit: Check five_hour_pct, seven_day_pct, etc. vs user's rate_limit_pct
  • Extra Credit: Check extra_usage.utilization vs user's extra_credit_pct
  • Token Failure: Check for active tokens with fetch errors
    ↓
Dedup check: If unresolved alert exists for (seat_id, type), skip creation
    ↓
Create Alert with metadata (window, pct, error, etc.)
    ↓
Telegram: Send to subscribed user via personal Telegram bot (no system bot)

BUDGET ALERTS (per-user session tracking):
    ↓
Find active schedules: day_of_week=today, start_hour <= now < end_hour
    ↓
For each active session:
  1. Get/create ActiveSession (stores baseline snapshot at session start)
  2. Get latest UsageSnapshot
  3. Calculate delta across all 4 windows
  4. If worst_delta >= user's usage_budget_pct → create usage_exceeded alert
  5. Telegram: Send to current user via personal bot only
    ↓
Session cleanup:
  - On session end: Auto-resolve usage_exceeded alerts for that seat
  - Delete old ActiveSession record
    ↓
Frontend: Display all alerts in Alerts view
    ↓
User: Resolve alert via PUT /api/alerts/:id/resolve
```

### Seat Management Flow
```
User: POST /api/seats/preview-token { credential_json }
    ↓
Backend: Parse JSON → Fetch OAuth profile → Check for duplicates + soft-deleted seats with same email
    ↓
Response: { account, organization, duplicate_seat_id, restorable_seat? }
    ↓
User: If restorable_seat exists, show Vietnamese choice banner (restore vs. create new)
    ↓
User: POST /api/seats { credential_json, max_users, restore_seat_id? OR force_new? }
    ↓
Backend: If restore_seat_id — undelete seat via atomic findOneAndUpdate (set deleted_at: null)
    ↓
Backend: If force_new — cascade hard-delete old + create fresh (admin only)
    ↓
Backend: Auto-populate profile from OAuth response (account_name, org_name, rate_limit_tier, etc.)
    ↓
Response: { _id, email, label, profile, restored?: true }
    ↓
Owner/Admin: Edit → PUT /api/seats/:id (allowed via requireSeatOwnerOrAdmin)
    ↓
Owner/Admin: Soft-Delete → DELETE /api/seats/:id (sets deleted_at; allows restore)
    ↓
Owner/Admin: Assign → POST /api/seats/:id/assign { userId } (add to seat)
    ↓
Owner/Admin: Unassign → DELETE /api/seats/:id/unassign/:userId (remove + clear schedules)
    ↓
Owner/Admin: Token Update → PUT /api/seats/:id/token { credential_json, ... } (encrypts + auto-refreshes profile)
    ↓
Owner/Admin: Refresh Profile → POST /api/seats/:id/profile/refresh (force fetch from Anthropic)
    ↓
Owner/Admin: Get Profile → GET /api/seats/:id/profile (cached, auto-refresh if >6h stale)
    ↓
Owner/Admin: Export Credential → GET /api/seats/:id/credentials/export (audit logged)
    ↓
Admin: Transfer Ownership → PUT /api/seats/:id/transfer { newOwnerId }
    ↓
Frontend: Group seats into "My Seats" / "Assigned to Me" / "Other Seats" by ownership + assignment
```

### Usage Collection Flow
```
Cron: Every 30 min → collectAllUsage()
    ↓
Query: Find all seats where token_active = true and access_token != null
    ↓
Decrypt: Decrypt each seat's access_token (AES-256-GCM)
    ↓
Fetch: Call Anthropic API /oauth/usage with Bearer token (15s timeout, 3 concurrent)
    ↓
Parse: Extract usage buckets (5-hour, 7-day, model-specific, extra_usage)
    ↓
Store: Create UsageSnapshot document per seat
    ↓
Update: Set Seat.last_fetched_at, clear Seat.last_fetch_error (or set on error)
    ↓
TTL: Auto-delete snapshots after 90 days
    ↓
Frontend: Query /api/usage-snapshots to display latest metrics
```

## Deployment Considerations

### Prerequisites
- Node.js 18+ runtime
- MongoDB instance (Atlas, local, or managed service)
- Firebase project with service account JSON
- (Optional) Telegram bot token

### Development Process
1. Install dependencies: `pnpm install`
2. Set environment variables in package `.env.local` files
3. Run dev servers: `pnpm dev` (starts both API and web in parallel)
   - Web: http://localhost:5173
   - API: http://localhost:8386

### Production Process
1. Build packages: `pnpm build`
2. Set environment variables on server
3. Start API: `pnpm -F @repo/api start`
4. Serve built web app via static server or CDN
5. API listens on configured `PORT` (default 3001)

### Scaling Considerations
- **Current Capacity**: Designed for <100 users, <1000 seats
- **MongoDB Scaling**: Create indexes on user_id, week_start, seat_id
- **API Caching**: Implement Redis for stats endpoints if needed
- **Frontend**: Built SPA served as static files; scales via CDN
- **Cron Jobs**: Fire-and-forget; timeouts logged but non-blocking

## Security Architecture & Permission Model

### Authentication
- JWT stored in httpOnly, Secure, SameSite=Strict cookie
- 24-hour expiry; no refresh tokens
- Firebase Admin SDK verifies Google tokens server-side
- All protected endpoints checked via middleware

### Authorization Hierarchy

**Middleware Stack**:
| Middleware | Check | Allows |
|-----------|-------|--------|
| `authenticate` | JWT valid | All authenticated users |
| `requireAdmin` | role === 'admin' | Admin users only |
| `requireSeatOwner(seatId)` | owner_id === req.user._id | Seat owner only (NO admin bypass) |
| `requireSeatOwnerOrAdmin(seatId)` | owner_id === req.user._id OR role === 'admin' | Owner or Admin |
**Critical Rule**: Admin users have ALL the same permissions as regular users EXCEPT credential export of seats owned by other users. The `requireSeatOwner()` middleware has NO admin bypass for credential export (`GET /seats/:id/credentials/export`).

### Schedule Permissions (Per-Seat & Role-Based)

A new permission system grants granular access control to schedule management. Defined in `packages/shared/schedule-permissions.ts` via pure resolver function `resolveSchedulePermissions()`:

**Permission Types**:
```
canView: bool              — Can see seat schedules
canCreate: bool            — Can create schedule entries
canCreateForOthers: bool   — Can create entries for other users
canSwap: bool              — Can swap or move schedule entries
canClearAll: bool          — Can clear all entries on seat
canEditEntry(entry): bool  — Can edit specific entry (user-based)
canDeleteEntry(entry): bool — Can delete specific entry (user-based)
```

**Role-Based Matrix**:
| Action | Admin | Seat Owner | Member | Non-member |
|--------|-------|------------|--------|------------|
| View | All | Own seat | Assigned seat | Hidden |
| Create entry | Any member | Any member | Self only | No |
| Create for others | Yes | In own seat | No | No |
| Edit entry | All | In own seat | Own entries | No |
| Delete entry | All | In own seat | Own entries | No |
| Swap entries | Yes | In own seat | No | No |
| Clear all | Yes | No | No | No |

**Implementation**:
- Resolver exported from `@repo/shared/schedule-permissions` for use in both API and UI
- API: `getPermissionCtx()` in `routes/schedules.ts` builds context, calls resolver
- UI: Components receive permission object, disable actions based on flags
- No database calls in resolver; pure computation for performance

### Permission Model by Route

**Seat Management**:
```
POST   /api/seats                        [authenticate] → Any user can create/restore seat (becomes owner); force_new requires admin
POST   /api/seats/preview-token          [authenticate] → Check credential validity + duplicates/restorable
GET    /api/seats                        [authenticate] → All users see all seats (non-deleted)
GET    /api/seats/:id/profile            [authenticate, requireSeatOwnerOrAdmin] → Get cached profile
POST   /api/seats/:id/profile/refresh    [authenticate, requireSeatOwnerOrAdmin] → Force-refresh from Anthropic
GET    /api/seats/:id/credentials/export [authenticate, requireSeatOwner] → OWNER ONLY (strict)
PUT    /api/seats/:id                    [authenticate, requireSeatOwnerOrAdmin]
DELETE /api/seats/:id                    [authenticate, requireSeatOwnerOrAdmin] → Soft-delete
POST   /api/seats/:id/assign            [authenticate, requireSeatOwnerOrAdmin]
DELETE /api/seats/:id/unassign/:userId   [authenticate, requireSeatOwnerOrAdmin]
PUT    /api/seats/:id/token              [authenticate, requireSeatOwnerOrAdmin] → Updates + auto-refresh profile
DELETE /api/seats/:id/token              [authenticate, requireSeatOwnerOrAdmin]
PUT    /api/seats/:id/transfer           [authenticate, requireAdmin] → Admin only
```

**Admin Routes (ALL require admin role)**:
```
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
PATCH  /api/admin/users/bulk-active
POST   /api/admin/check-alerts
```

**User Settings**:
```
GET    /api/user/settings                [authenticate] → Own settings only
PUT    /api/user/settings                [authenticate] → Own settings only
POST   /api/user/settings/test-bot       [authenticate] → Own bot only
```

### Data Protection
- CORS enabled for all origins (configurable)
- No sensitive data in logs (passwords, tokens)
- Mongoose schema validation on all inputs
- Foreign key references enforced at model level

### API Security
- All endpoints require authentication (except /login.html)
- Admin operations gated by `requireAdmin`
- Input validation: required fields, type checks
- Error messages generic (don't reveal system info)

## Error Handling

**Backend**:
- Try-catch in all async handlers
- Returns appropriate HTTP status:
  - 400: Validation error
  - 401: Missing/invalid auth
  - 403: Insufficient permissions
  - 500: Server error
- Logs errors to console with context

**Frontend**:
- API client throws on non-2xx status
- Catch blocks display user-friendly messages
- Technical details logged to browser console
- 401 errors trigger redirect to login

## Monitoring & Debugging

**Development**:
- Run `pnpm dev` for auto-reload on file changes (API: tsx watch, Web: Vite HMR)
- Check terminal/console logs for errors, requests, cron job status
- Use browser DevTools for frontend debugging
- React DevTools extension helpful for debugging React components

**Production**:
- Monitor MongoDB connection pool
- Check Telegram integration (test with manual reminder)
- Log rotation recommended for long-running servers
- Alert on cron job failures (add error email in future)
- Monitor API and web app uptime separately

## Performance Characteristics

| Metric | Target |
|--------|--------|
| API Response Time | <100ms (indexed queries) |
| Database Query Time | <50ms (typical) |
| Frontend Load Time | <2s (no build required) |
| Concurrent Users | 100+ (MongoDB handles) |
| Storage | ~1MB per 1000 usage logs |

**Optimization**:
- Database indexes on frequently queried fields
- JWT avoids repeated auth checks
- Mongoose connection pooling
- Frontend lazy-loads views on demand

## Future Architecture Enhancements

1. **Caching Layer**: Redis for stats, teams, user lists
2. **Message Queue**: Bull/RabbitMQ for async tasks (Telegram, email)
3. **Analytics**: Separate analytics database or data warehouse
4. **Microservices**: Extract alert service, Telegram service to separate processes
5. **E2E Testing**: Add Playwright/Cypress for integration tests
6. **API Documentation**: OpenAPI/Swagger specification
7. **Audit Logging**: Separate audit collection for compliance
8. **Frontend Performance**: Code splitting and lazy loading for large page count

## Technology Rationale

| Choice | Reason |
|--------|--------|
| Express 5 | Lightweight, event-driven, excellent middleware ecosystem |
| MongoDB | Schema-flexible, scaling-friendly, native JSON |
| Firebase Auth | Reduces auth complexity; outsources identity |
| JWT | Stateless auth; scales horizontally |
| Alpine.js | Minimal overhead; perfect for small SPA |
| Vanilla JS | No build step; direct browser APIs |
| node-cron | Simple scheduling; avoids external task service |
| Mongoose | Enforces schema consistency; convenient query API |

