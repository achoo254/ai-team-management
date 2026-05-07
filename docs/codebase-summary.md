# Codebase Summary

## Directory Structure

```
quan-ly-team-claude/
├── packages/
│   ├── api/                         # Express 5 + TypeScript backend
│   │   ├── src/
│   │   │   ├── index.ts             # App entry, routes, cron jobs
│   │   │   ├── config.ts            # Environment config
│   │   │   ├── db.ts                # Mongoose connection helpers
│   │   │   ├── firebase-admin.ts    # Firebase Admin SDK init
│   │   │   ├── middleware.ts        # Auth middleware
│   │   │   ├── models/              # Mongoose schemas (TypeScript)
│   │   │   │   ├── seat.ts           # Includes access_token (encrypted)
│   │   │   │   ├── user.ts           # Includes alert_settings + notification_settings
│   │   │   │   ├── schedule.ts
│   │   │   │   ├── alert.ts
│   │   │   │   ├── active-session.ts
│   │   │   │   └── usage-snapshot.ts # Usage data from Anthropic API
│   │   │   ├── routes/              # Express route handlers (TypeScript)
│   │   │   │   ├── auth.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── seats.ts           # Token management endpoints
│   │   │   │   ├── schedules.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   ├── admin.ts
│   │   │   │   ├── teams.ts             # Team CRUD & management
│   │   │   │   └── usage-snapshots.ts # Query & collect usage snapshots
│   │   │   ├── services/            # Business logic (TypeScript)
│   │   │   │   ├── alert-service.ts
│   │   │   │   ├── telegram-service.ts
│   │   │   │   ├── crypto-service.ts  # AES-256-GCM encryption/decryption
│   │   │   │   ├── usage-collector-service.ts # Collect usage from Anthropic API
│   │   │   │   ├── anthropic-service.ts # OAuth profile fetch & cache
│   │   │   │   └── seat-cascade-delete.ts # Hard-delete + cleanup
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── dist/                    # Compiled output (gitignored)
│   │
│   ├── web/                         # Vite + React 19 + TypeScript frontend
│   │   ├── src/
│   │   │   ├── main.tsx             # React entry point
│   │   │   ├── app.tsx              # Root app component + React Router
│   │   │   ├── pages/               # Route page components (TypeScript)
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── seats.tsx
│   │   │   │   ├── schedule.tsx       # Activity heatmap visualization
│   │   │   │   ├── alerts.tsx
│   │   │   │   ├── teams.tsx          # Team grouping (view-only seat organization)
│   │   │   │   ├── admin.tsx
│   │   │   │   ├── usage-metrics.tsx  # Usage snapshots & token management
│   │   │   │   └── login.tsx
│   │   │   ├── components/          # Reusable React components
│   │   │   │   ├── auth-provider.tsx
│   │   │   │   ├── seat-card.tsx
│   │   │   │   ├── seat-form-dialog.tsx # Create/restore seat flow
│   │   │   │   ├── seat-restore-banner.tsx # Vietnamese restore choice UI
│   │   │   │   ├── activity-heatmap.tsx # 7x24 grid visualization
│   │   │   │   ├── dashboard-shell.tsx
│   │   │   │   └── ...
│   │   │   ├── lib/
│   │   │   │   └── api.ts           # Fetch wrapper
│   │   │   ├── index.css            # Global styles
│   │   │   └── types/               # Type definitions
│   │   ├── index.html               # Vite entry HTML
│   │   ├── vite.config.ts           # Vite configuration + API proxy
│   │   ├── tailwind.config.ts       # Tailwind CSS config
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── dist/                    # Built output (gitignored)
│   │
│   └── shared/                      # Shared TypeScript types & utilities
│       ├── src/
│       │   ├── types.ts                    # Exported types for API/Web (+ SchedulePermissions interface)
│       │   └── schedule-permissions.ts    # Pure permission resolver function (resolveSchedulePermissions)
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                            # Project documentation
├── .env.example                     # Environment variables template
├── .env                             # Local environment (git-ignored)
├── .env.test                        # Test environment
├── package.json                     # Root workspace config + scripts
├── pnpm-workspace.yaml              # pnpm workspace definition
├── tsconfig.base.json               # Base TypeScript config
├── tsconfig.json                    # Root TypeScript config
├── CLAUDE.md                        # Project guidance for Claude
└── README.md                        # Main README

```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript 5 |
| **Package Manager** | pnpm workspaces |
| **Backend Framework** | Express 5 |
| **Backend Dev Server** | tsx (TypeScript executor) |
| **Frontend Framework** | React 19 |
| **Frontend Router** | React Router v7 |
| **Frontend Build** | Vite 8 |
| **Database** | MongoDB (via Mongoose 9.3.1) |
| **Auth** | Firebase Admin SDK + JWT (jsonwebtoken) |
| **Data Fetching** | React Query (TanStack Query) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (Radix UI) |
| **Async Jobs** | node-cron (hourly scheduler + weekly report) |
| **Notifications** | Telegram Bot API (system + personal bot) |
| **Testing** | Vitest |

## Module System

- **ES Modules throughout** (`import`/`export`)
- **TypeScript** for type safety
- **Compilation**: tsc compiles TS to JS in dist/ directories
- **Build Tool**: Vite for frontend bundling
- **Monorepo**: pnpm workspaces for shared types between packages

## Key Data Structures

### Mongoose Models (packages/api/src/models/*.ts)

**Collections (8 total)**: seats, users, schedules, alerts, usage_snapshots, seat_activity_logs, usage_windows, teams

#### Seat
```typescript
{
  _id: ObjectId (auto),
  email: String (required, unique),
  label: String (required),
  owner_id: ObjectId | null (reference to User, index: true),
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
  } | null (auto-populated, stale after 6h),
  token_active: Boolean (default: false),
  last_fetched_at: Date | null,
  last_fetch_error: String | null,
  last_refreshed_at: Date | null,
  include_in_overview: Boolean (default: false),
  deleted_at: Date | null (soft delete, indexed),
  created_at: Date (auto)
}
```

#### User
```typescript
{
  _id: ObjectId (auto),
  name: String (required),
  email: String (unique, sparse),
  role: String (enum: ['admin', 'user'], default: 'user'),
  seat_ids: [ObjectId] (reference to Seat),
  active: Boolean (default: true),
  telegram_bot_token: String | null (encrypted AES-256-GCM),
  telegram_chat_id: String | null,
  telegram_topic_id: String | null,
  watched_seat_ids: [ObjectId] (seats user subscribed to for alerts),
  notification_settings: {
    report_enabled: Boolean (default: false),
    report_days: [Number] (default: [5] = Friday),
    report_hour: Number (0-23, default: 8)
  },
  alert_settings: {
    enabled: Boolean (default: false),
    rate_limit_pct: Number (default: 80),
    extra_credit_pct: Number (default: 80)
  },
  fcm_tokens: [String] (Firebase Cloud Messaging push tokens, default: []),
  push_enabled: Boolean (FCM push notifications enabled, default: false),
  created_at: Date (auto)
}
```

#### Schedule (Auto-Generated Activity Patterns)
```typescript
{
  _id: ObjectId (auto),
  seat_id: ObjectId (reference to Seat),
  day_of_week: Number (0-6, Sunday=0, Saturday=6),
  start_hour: Number (0-23, inclusive),
  end_hour: Number (0-23, exclusive),
  source: String (enum: 'auto' | 'legacy', default: 'legacy'),
  created_at: Date (auto),
  // Indexes: (seat_id, day_of_week), (seat_id, source)
  // Note: Derived from seat activity logs; read-only heatmap display
}
```

#### SeatActivityLog (Hourly Activity Tracking)
```typescript
{
  _id: ObjectId (auto),
  seat_id: ObjectId (reference to Seat),
  date: Date (start of day in Asia/Ho_Chi_Minh timezone),
  hour: Number (0-23),
  is_active: Boolean (true if any usage delta > 0),
  delta_5h_pct: Number (accumulated 5h usage increase this hour),
  snapshot_count: Number (count of snapshots with activity),
  created_at: Date (auto),
  // Unique index: (seat_id, date, hour) — one record per seat/date/hour
}
```

#### SchedulePermissions (shared/types.ts)
```typescript
{
  canView: boolean,
  canCreate: boolean,
  canCreateForOthers: boolean,
  canSwap: boolean,
  canClearAll: boolean,
  canEditEntry: (entry: { user_id: string }) => boolean,
  canDeleteEntry: (entry: { user_id: string }) => boolean
}
```

#### Alert
```typescript
{
  _id: ObjectId (auto),
  user_id: ObjectId | null (reference to User, dedup key),
  seat_id: ObjectId (reference to Seat),
  type: String (enum: ['rate_limit', 'token_failure', 'usage_exceeded', 'session_waste', '7d_risk']),
  window: String | null (enum: ['5h', '7d', null], usage window for rate_limit alerts),
  message: String,
  metadata: Object (context: pct, error, delta, budget, user_id, user_name, etc.),
  read_by: [ObjectId] (users who marked as read),
  notified_at: Date | null (when notification was sent, prevents re-notify),
  created_at: Date (auto),
  // Indexes: (user_id, seat_id, type, window), (seat_id, type, created_at), (read_by), (created_at)
}
```

#### UsageSnapshot
```typescript
{
  _id: ObjectId (auto),
  seat_id: ObjectId (reference to Seat),
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
  fetched_at: Date (auto)
  // TTL index: auto-delete after 90 days
  // Compound index: (seat_id, fetched_at)
}
```

#### Team (View-Only Seat Grouping)
```typescript
{
  _id: ObjectId (auto),
  name: String (required, unique),
  description: String | null,
  seat_ids: [ObjectId] (reference to Seat, view-only grouping),
  member_ids: [ObjectId] (reference to User),
  owner_id: ObjectId (reference to User, index: true),
  created_at: Date (auto),
  // Indexes: (owner_id), (member_ids)
  // Design: Team = view-only grouping; alerts/schedule require individual seat_ids
  // Soft-deleted seats auto-removed from teams (manual cleanup recommended)
}
```

## API Endpoints

### Auth
- `POST /api/auth/google` — Verify idToken, issue JWT
- `POST /api/auth/logout` — Clear JWT cookie
- `GET /api/auth/me` — Current authenticated user

### Dashboard
- `GET /api/dashboard/enhanced` — Overview stats (tokenIssueCount, owner_name per seat)
- `GET /api/dashboard/personal` — Current user's schedule today, my seats with role, usage rank (auth required, any user)
- `GET /api/dashboard/weekly-summary` — Weekly usage summary
- `GET /api/dashboard/alerts` — Recent alerts

### Seats
- `GET /api/seats` — List all seats with owner + assigned users
- `GET /api/seats/available-users` — List active users for assignment
- `GET /api/seats/:id/credentials/export` — Export single seat credentials (owner or admin)
- `GET /api/seats/:id/profile` — Get cached profile, auto-refresh if stale >6h (owner or admin)
- `POST /api/seats/:id/profile/refresh` — Force-refresh profile from Anthropic (owner or admin)
- `POST /api/seats` — Create seat (auto-sets owner to current user; supports restore_seat_id or force_new)
- `POST /api/seats/preview-token` — Preview credential: parse JSON + fetch profile + check duplicates/restorable
- `PUT /api/seats/:id` — Update seat (owner or admin)
- `DELETE /api/seats/:id` — Delete seat (soft-delete; owner or admin)
- `POST /api/seats/:id/assign` — Assign user to seat (owner or admin)
- `DELETE /api/seats/:id/unassign/:userId` — Unassign user (owner or admin)
- `PUT /api/seats/:id/token` — Set/update access token (owner or admin)
- `DELETE /api/seats/:id/token` — Remove access token (owner or admin)
- `PUT /api/seats/:id/transfer` — Transfer seat ownership (admin only)

### Users
- `GET /api/admin/users` — List users (admin only)
- `POST /api/admin/users` — Create user (admin only)
- `PUT /api/admin/users/:id` — Update user (admin only)
- `DELETE /api/admin/users/:id` — Delete user (admin only)

### Schedules (Auto-Generated Activity Patterns - Read-Only Heatmap)
- `GET /api/schedules` — List auto-generated recurring patterns by seat (read-only, filtered by membership + ownership)
- `GET /api/schedules/today` — Today's patterns for all visible seats (read-only)
- `GET /api/schedules/heatmap/:seatId` — Aggregated activity heatmap data for N weeks (activity_rate, avg_delta, max_delta per day/hour)
- `GET /api/schedules/activity-logs` — Raw hourly activity logs with date range filter, pagination
- `GET /api/schedules/realtime` — Current hour activity status per seat (is_active, current_delta, last_snapshot_at)
- `POST /api/schedules/regenerate` — Force regenerate all activity patterns (admin only)

### Usage Snapshots
- `GET /api/usage-snapshots` — Query snapshots (filter by seatId, date range, limit, offset)
- `GET /api/usage-snapshots/latest` — Get latest snapshot per active seat (last 24h)
- `POST /api/usage-snapshots/collect` — Trigger collection for all seats (admin only)
- `POST /api/usage-snapshots/collect/:seatId` — Trigger collection for single seat (admin only)

### Teams (View-Only Seat Grouping)
- `GET /api/teams` — List teams (admin: all, user: owned + member teams)
- `POST /api/teams` — Create team (any user; non-admin restricted to owned seats)
- `PUT /api/teams/:id` — Update team (owner or admin)
- `DELETE /api/teams/:id` — Delete team (owner or admin)

### Alerts
- `GET /api/alerts` — List alerts
- `POST /api/alerts` — Create alert (admin only)
- `PUT /api/alerts/:id/resolve` — Mark alert as resolved

### User Settings
- `GET /api/user/settings` — Get user's alert + notification settings, Telegram bot config, available seats
- `PUT /api/user/settings` — Set bot token, chat ID, notification schedule, alert settings (per-seat subscriptions + thresholds)
- `POST /api/user/settings/test-bot` — Test personal Telegram bot connection
- `POST /api/user/settings/test-bot` — Test personal Telegram bot connection

### Admin
- `GET /api/admin/users` — List all users (admin only)
- `POST /api/admin/users` — Create user (admin only)
- `PUT /api/admin/users/:id` — Update user (admin only)
- `DELETE /api/admin/users/:id` — Delete user (admin only)
- `PATCH /api/admin/users/bulk-active` — Bulk update active status (admin only)
- `POST /api/admin/check-alerts` — Manually trigger alert check (admin only)

## Frontend Architecture (packages/web)

### React App Flow
1. `index.html` loaded → Vite loads `main.tsx`
2. `main.tsx` renders React app → mounts App.tsx
3. `App.tsx` wraps app with AuthProvider + React Query + React Router
4. React Router renders pages based on URL
5. Components fetch data via React Query
6. UI updates via React hooks (useState, useEffect)

### View Components
- **Dashboard**: Stats, alerts, quick info, fleet KPIs, per-seat overview with activity patterns
- **Seats**: List, create, edit, delete seats + assign users
- **Schedules**: Auto-generated activity heatmap (read-only), visualized as 7x24 grid per seat, realtime activity status
- **Teams**: Create/edit/delete team groups, manage team members, view grouped seats (view-only)
- **Usage Metrics**: View real-time usage snapshots + manage tokens
- **Admin**: User CRUD, system config, alert threshold settings
- **Alerts**: View, resolve alerts, filter by type/window/seat

## Authentication Flow

1. User signs in with Google on `login.html`
2. Firebase client SDK returns `idToken`
3. POST to `/api/auth/google` with token
4. Server verifies via Firebase Admin SDK
5. Server issues JWT in httpOnly cookie (24h expiry)
6. All subsequent requests authenticated via `authenticate` middleware
7. Protected endpoints checked with `requireAdmin` middleware

## Cron Jobs

### Every 5 minutes (Usage Collection & Activity Tracking)
- Collects usage metrics from Anthropic API for all seats with active tokens
- Called via `collectAllUsage()` in usage-collector-service.ts
- Stores snapshots in usage_snapshots collection (TTL: 90 days)
- Detects hourly activity and updates SeatActivityLog via `detectSeatActivity()` in seat-activity-detector.ts
- Chains `checkSnapshotAlerts()` to evaluate snapshot-based alerts (rate_limit, token_failure)

### Daily 04:00 Asia/Saigon (Activity Pattern Generation)
- Analyzes historical activity in SeatActivityLog
- Generates weekly recurring patterns for each seat via `generateAllPatterns()` in activity-pattern-service.ts
- Updates Schedule collection with `source='auto'` entries
- Detects anomalies (unusual activity spikes) via `detectActivityAnomalies()` in activity-anomaly-service.ts

### Every hour (`0 * * * *`) — Per-User Notification Schedule
- Checks all users with `notification_settings.report_enabled = true`
- Filters for users matching current day/hour (timezone: Asia/Ho_Chi_Minh)
- Generates per-user report filtered by seat ownership (admin sees all, users see own)
- Sends via personal Telegram bot (gracefully skips if unconfigured)
- Called via `checkAndSendScheduledReports()` in telegram-service.ts

### Friday 17:00 Asia/Saigon (Weekly Report)
- Compiles usage summary using latest UsageSnapshot data
- Lists alerts triggered
- Sends formatted report to Telegram (system bot)
- Called via `sendWeeklyReport()` in telegram-service.ts

## Environment Configuration

See `.env.example` for all variables. Key:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `API_PORT` | No | 8386 | API server port |
| `JWT_SECRET` | Yes | - | JWT signing key (min 32 chars) |
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes | - | Path to Firebase service account JSON |
| `ENCRYPTION_KEY` | Yes | - | 64-char hex string (32 bytes) for AES-256-GCM |
| `TELEGRAM_BOT_TOKEN` | No | - | Telegram bot token (system bot) |
| `TELEGRAM_CHAT_ID` | No | - | Telegram chat ID for system notifications |
| `TELEGRAM_TOPIC_ID` | No | - | Telegram topic ID (optional) |
| `WEB_URL` | No | http://localhost:5173 | Public web URL for links |

## Performance Characteristics

- **DB Queries**: Indexed on seat_id, day_of_week, slot (schedules); seat_id, type, resolved (alerts); seat_id, fetched_at (usage_snapshots)
- **API Response Time**: <100ms for most endpoints (simple queries)
- **Concurrent Users**: Design assumes <100 users; MongoDB handles concurrent writes
- **Cron Jobs**: Fire-and-forget; timeouts logged but don't block
- **Frontend**: Vite dev server; lazy-loads views on demand

## Common Patterns

### Error Handling
- Backend: Try-catch in async route handlers → res.status().json() with error message
- Frontend: React Query error handling → display in UI via toast/modal
- Status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 500 (server error)
- Error messages logged to console with context

### Database Access (Backend)
- Mongoose models imported in routes/services
- Async/await for all database operations
- Schema validation and unique constraints at model level
- Optional `validateObjectId` middleware for routes accepting :id params
- TypeScript types for model instances (e.g., `IUser`, `ISeat`)

### Data Fetching (Frontend)
- React Query (TanStack Query) for server state management
- Custom hooks wrapping query calls (e.g., `useSeats()`, `useUsers()`)
- Automatic caching, refetching, and invalidation via query keys
- Mutations for POST/PUT/DELETE operations

### Middleware Stack (Backend)
- CORS enabled for all origins
- Body parser (json)
- Cookie parser for JWT
- Custom auth middleware: `authenticate()`, `requireAdmin()`, `validateObjectId()`
- Error handler (express.json error handling)

