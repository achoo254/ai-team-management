# System Architecture

## Overview

Claude Teams Management Dashboard is a pnpm monorepo with 3 packages: Express 5 + TypeScript backend, Vite + React 19 SPA frontend, and shared TypeScript types. Manages Claude Teams seats (account licenses) shared among team members.

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
- **UI Components**: Base UI React
- **Charts**: Recharts 3.8.0
- **Data Fetching**: @tanstack/react-query 5.95.0
- **Notifications**: Sonner (toast library)

### Database
- **Type**: MongoDB (document-based NoSQL)
- **Connection**: Mongoose 9.3.1 ODM
- **Collections**: 7 (seats, users, schedules, alerts, teams, usage_snapshots, active_sessions)
- **Indexing**: Compound indexes on (seat_id, day_of_week), (seat_id, type, resolved), and (seat_id, fetched_at)
- **TTL**: usage_snapshots collection auto-expires after 90 days

### Monorepo & Shared (`packages/shared`)
- **Package Manager**: pnpm workspaces
- **Shared Exports**: TypeScript types (exported via types.ts)
- **Workspace Configuration**: pnpm-workspace.yaml

### Infrastructure
- **Hosting**: Any Node.js-compatible server
- **API Port**: 3001 (configurable)
- **Frontend Port**: 5173 (Vite dev, proxies /api to API)
- **Environment**: .env-based configuration (root-level .env)
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

**Route Structure** (8 files):
- `routes/auth.ts` — Login, logout, current user
- `routes/dashboard.ts` — Stats, weekly summary, alerts
- `routes/seats.ts` — Seat CRUD (owner auto-set), user assignment, token management, credentials export
  - `POST /seats` — Any auth user (auto-sets owner to req.user._id)
  - `GET /seats` — List all seats with owner + assigned users
  - `GET /seats/available-users` — List active users for assignment
  - `GET /seats/:id/credentials/export` — Export single seat (owner only, no admin bypass)
  - `PUT /seats/:id` — Update seat details (owner or admin via requireSeatOwnerOrAdmin)
  - `DELETE /seats/:id` — Delete seat (owner or admin)
  - `POST /seats/:id/assign` — Assign user (owner or admin)
  - `DELETE /seats/:id/unassign/:userId` — Unassign user (owner or admin)
  - `PUT /seats/:id/token` — Set/update credential (owner or admin)
  - `PUT /seats/:id/transfer` — Transfer ownership to another user (admin only)
- `routes/admin.ts` — User management, manual alert check trigger
- `routes/schedules.ts` — Schedule CRUD with conflict prevention, hourly time slots, budget allocation
- `routes/alerts.ts` — Alert creation, resolution, listing
- `routes/teams.ts` — User-created team CRUD (not admin-only), team member & seat management
- `routes/usage-snapshots.ts` — Query snapshots, trigger collection
- `routes/user-settings.ts` — Per-user alert settings, Telegram bot config, notification schedule, test notifications

**Service Layer** (5 files):
- `services/alert-service.ts` — Alert generation, budget violation checking, session tracking
- `services/telegram-service.ts` — Telegram message formatting, personal + system bot notifications
- `services/crypto-service.ts` — AES-256-GCM encryption/decryption for access tokens
- `services/usage-collector-service.ts` — Fetch usage data from Anthropic API, concurrent collection
- `services/anthropic-service.ts` — Future Anthropic API integration

**Utility Libraries**:
- `lib/encryption.ts` — AES-256-GCM encrypt/decrypt for Telegram bot tokens

### 3. Database Layer (Mongoose + TypeScript)

**Location**: `packages/api/src/models`

**8 Collections**:

#### Seats
```typescript
{
  _id: ObjectId,
  email: String (required, unique),
  label: String (required),
  team_id: ObjectId | null (ref: Team, default: null, index: true),
  max_users: Number (default: 3),
  owner_id: ObjectId | null (ref: User, index: true),
  oauth_credential: {
    access_token: String | null (encrypted AES-256-GCM),
    refresh_token: String | null (encrypted),
    expires_at: Date | null,
    scopes: [String],
    subscription_type: String | null,
    rate_limit_tier: String | null
  } | null (select: false),
  token_active: Boolean (default: false),
  last_fetched_at: Date | null,
  last_fetch_error: String | null,
  last_refreshed_at: Date | null,
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
  team_ids: [ObjectId] (ref: Team, default: [], multi-team support),
  seat_ids: [ObjectId] (ref: Seat),
  active: Boolean (default: true),
  telegram_bot_token: String | null (encrypted AES-256-GCM),
  telegram_chat_id: String | null,
  telegram_topic_id: String | null,
  watched_seat_ids: [ObjectId] (ref: Seat, seats subscribed to for alerts),
  notification_settings: {
    report_enabled: Boolean (default: false),
    report_days: [Number] (default: [5], 0=Sun, 6=Sat),
    report_hour: Number (0-23, default: 8)
  },
  alert_settings: {
    enabled: Boolean (default: false),
    rate_limit_pct: Number (default: 80),
    extra_credit_pct: Number (default: 80)
  },
  fcm_tokens: [String] (Firebase Cloud Messaging tokens, default: []),
  push_enabled: Boolean (FCM push notifications, default: false),
  created_at: Date
}
```

#### Schedules
```typescript
{
  _id: ObjectId,
  seat_id: ObjectId (ref: Seat),
  user_id: ObjectId (ref: User),
  day_of_week: Number (0=Sunday, 6=Saturday),
  start_hour: Number (0-23, inclusive),
  end_hour: Number (0-23, exclusive),
  usage_budget_pct: Number | null (1-100, auto-divided if null),
  created_at: Date,
  // Index: (seat_id, day_of_week) compound for efficient queries
  // Note: Overlaps allowed, detected in application logic
}
```

#### Alerts
```typescript
{
  _id: ObjectId,
  seat_id: ObjectId (ref: Seat),
  type: String (enum: ['rate_limit', 'extra_credit', 'token_failure', 'usage_exceeded', 'session_waste', '7d_risk']),
  message: String,
  metadata: {
    session?: String ('5h' | '7d' | '7d_sonnet' | '7d_opus'),
    pct?: Number,
    credits_used?: Number,
    credits_limit?: Number,
    error?: String,
    delta?: Number (usage increase during session),
    budget?: Number (allocated budget %),
    user_id?: String (user who exceeded budget),
    user_name?: String (for display)
  },
  resolved: Boolean,
  resolved_by: String | null,
  resolved_at: String | null,
  created_at: Date,
  // Index: (seat_id, type, resolved) compound for dedup
}
```

#### Teams
```typescript
{
  _id: ObjectId,
  name: String (required, lowercase),
  label: String (required),
  color: String (default: '#3b82f6'),
  created_by: ObjectId (ref: User, required, index: true),
  created_at: Date,
  // Compound unique index: (created_by, name)
  // Any authenticated user can create teams (not admin-only)
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
1. `pages/dashboard.tsx` — Overview stats, recent alerts, summary cards
2. `pages/usage-log.tsx` — Log weekly usage, view history
3. `pages/seats.tsx` — List, create, edit, delete seats
4. `pages/schedules.tsx` — Schedule assignments (day + morning/afternoon)
5. `pages/alerts.tsx` — View and resolve alerts
6. `pages/admin.tsx` — User CRUD, system admin panel
7. `pages/teams.tsx` — Manage team definitions
8. `pages/login.tsx` — Login page with Google sign-in

**State Management**:
- React Context for global auth state
- React Query (TanStack Query) for server state
- Component-level state via useState
- URL-based routing with React Router v7

### 5. Scheduled Tasks (Cron)

**Jobs** (via node-cron in `packages/api/src/index.ts`):

1. **Every 5 minutes** — `collectAllUsage()` → `checkSnapshotAlerts()` → `checkBudgetAlerts()`
   - **collectAllUsage()** from usage-collector-service.ts:
     - Fetches usage metrics from Anthropic API for all seats with active tokens
     - Decrypts stored access tokens (AES-256-GCM)
     - Stores snapshots in usage_snapshots collection with 90-day TTL
     - Logs completion stats and errors per seat
     - Mutex guard prevents overlapping runs
   - **checkSnapshotAlerts()** from alert-service.ts (chained after collection):
     - Evaluates latest UsageSnapshot for each seat
     - For each user watching that seat: checks against user's alert_settings thresholds
     - Creates alerts for: rate_limit (5h, 7d, 7d_sonnet, 7d_opus), extra_credit, token_failure
     - Deduplicates: max 1 unresolved alert per (seat_id, type)
     - Sends Telegram notification to subscribed user via personal bot
     - Returns count of alerts created
   - **checkBudgetAlerts()** from alert-service.ts (chained after snapshot alerts):
     - Finds active schedules (matching current day/hour)
     - Tracks per-user usage delta during session via ActiveSession baseline snapshot
     - When delta >= user's usage_budget_pct: creates usage_exceeded alert + sends Telegram
     - Auto-resolves usage_exceeded when session ends or next user starts
     - Manages ActiveSession lifecycle (create, update, delete)

2. **Every hour (`0 * * * *)** — `checkAndSendScheduledReports()` from telegram-service.ts
   - Finds all users with enabled notification schedule matching current day/hour
   - Generates per-user usage report filtered by seat ownership
   - Admin users see all seats; regular users see only owned/assigned seats
   - Sends via personal Telegram bot (gracefully skips if unconfigured)
   - Timezone: Asia/Ho_Chi_Minh (server-side)

3. **Friday 17:00 Asia/Saigon** — `sendWeeklyReport()` from telegram-service.ts
   - Compiles usage summary using UsageSnapshot data
   - Lists alerts triggered
   - Sends formatted report to Telegram (system bot)

4. **Ad-Hoc Team Event Notifications** — Emitted via `emitTeamEvent()` from alert-service.ts
   - Triggered by: team member add/remove, seat reassignment, etc.
   - Sends Telegram notification to affected user (personal bot only, no in-app alerts)
   - Event types: `team.member_added`, `team.member_removed`, `team.seat_reassigned`
   - Skips self-actions (user cannot trigger their own notifications)
   - Parameters: `event_type`, `actor_id`, `target_user_id`, `team_id`, optional `extra` metadata

**Configuration**:
- `packages/api/src/index.ts` — Cron schedule setup
- `packages/api/src/services/alert-service.ts` — Alert generation + `emitTeamEvent()` for team notifications
- `packages/api/src/services/telegram-service.ts` — Message formatting, dual-bot support (system + per-user)
- Requires `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (system bot)
- Requires `ENCRYPTION_KEY` (64-char hex string = 32 bytes) for token encryption/decryption

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
  PORT                   — Server port (default: 8386)
  TELEGRAM_BOT_TOKEN     — System bot token for group notifications
  TELEGRAM_CHAT_ID       — Telegram chat ID for system bot
  TELEGRAM_TOPIC_ID      — Telegram topic (optional)
  APP_URL                — Public app URL (default: http://localhost:3000)
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
Any Auth User: POST /api/seats { email, label, team, max_users }
    ↓
Backend: Validate unique email, create Seat document with owner_id = req.user._id
    ↓
Owner/Admin: Edit → PUT /api/seats/:id (allowed via requireSeatOwnerOrAdmin)
    ↓
Owner/Admin: Delete → DELETE /api/seats/:id (cascade-safe, unassigns users, clears schedules)
    ↓
Owner/Admin: Assign → POST /api/seats/:id/assign { userId } (add to seat)
    ↓
Owner/Admin: Unassign → DELETE /api/seats/:id/unassign/:userId (remove + clear schedules)
    ↓
Owner/Admin: Credential → PUT /api/seats/:id/token { access_token, ... } (encrypted storage)
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
| `requireTeamOwnerOrAdmin(teamId)` | created_by === req.user._id OR role === 'admin' | Team creator or Admin |

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
POST   /api/seats                        [authenticate] → Any user can create seat (becomes owner)
GET    /api/seats                        [authenticate] → All users see all seats
GET    /api/seats/:id/credentials/export [authenticate, requireSeatOwner] → OWNER ONLY (strict)
PUT    /api/seats/:id                    [authenticate, requireSeatOwnerOrAdmin]
DELETE /api/seats/:id                    [authenticate, requireSeatOwnerOrAdmin]
POST   /api/seats/:id/assign            [authenticate, requireSeatOwnerOrAdmin]
DELETE /api/seats/:id/unassign/:userId   [authenticate, requireSeatOwnerOrAdmin]
PUT    /api/seats/:id/token              [authenticate, requireSeatOwnerOrAdmin]
DELETE /api/seats/:id/token              [authenticate, requireSeatOwnerOrAdmin]
PUT    /api/seats/:id/transfer           [authenticate, requireAdmin] → Admin only
```

**Team Management** (multi-team support):
```
GET    /api/teams                          [authenticate] → List teams (user sees own + joined, admin sees all via ?owner filter)
POST   /api/teams                          [authenticate] → Create team (creator becomes owner)
PUT    /api/teams/:id                      [authenticate, requireTeamOwnerOrAdmin] → Update team
DELETE /api/teams/:id                      [authenticate, requireTeamOwnerOrAdmin] → Delete team
GET    /api/teams/:id/members              [authenticate, requireTeamOwnerOrAdmin] → List team members
POST   /api/teams/:id/members              [authenticate, requireTeamOwnerOrAdmin] → Add member to team
DELETE /api/teams/:id/members/:userId      [authenticate, requireTeamOwnerOrAdmin] → Remove member from team
GET    /api/teams/:id/seats                [authenticate, requireTeamOwnerOrAdmin] → List team seats
POST   /api/teams/:id/seats                [authenticate, requireTeamOwnerOrAdmin] → Assign seat to team
DELETE /api/teams/:id/seats/:seatId        [authenticate, requireTeamOwnerOrAdmin] → Remove seat from team
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

