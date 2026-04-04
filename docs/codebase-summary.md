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
│   │   │   │   ├── team.ts
│   │   │   │   └── usage-snapshot.ts # Usage data from Anthropic API
│   │   │   ├── routes/              # Express route handlers (TypeScript)
│   │   │   │   ├── auth.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── seats.ts           # Token management endpoints
│   │   │   │   ├── schedules.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   ├── admin.ts
│   │   │   │   ├── teams.ts
│   │   │   │   └── usage-snapshots.ts # Query & collect usage snapshots
│   │   │   ├── services/            # Business logic (TypeScript)
│   │   │   │   ├── alert-service.ts
│   │   │   │   ├── telegram-service.ts
│   │   │   │   ├── crypto-service.ts  # AES-256-GCM encryption/decryption
│   │   │   │   └── usage-collector-service.ts # Collect usage from Anthropic API
│   │   │   ├── scripts/
│   │   │   │   └── db-reset.ts      # Drop MongoDB + re-seed
│   │   │   └── seed-data.ts         # Seed data definitions
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
│   │   │   │   ├── schedules.tsx
│   │   │   │   ├── alerts.tsx
│   │   │   │   ├── admin.tsx
│   │   │   │   ├── teams.tsx
│   │   │   │   ├── usage-metrics.tsx  # Usage snapshots & token management
│   │   │   │   └── login.tsx
│   │   │   ├── components/          # Reusable React components
│   │   │   │   ├── auth-provider.tsx
│   │   │   │   ├── seat-card.tsx
│   │   │   │   ├── schedule-grid.tsx
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
│   └── shared/                      # Shared TypeScript types
│       ├── src/
│       │   └── types.ts             # Exported types for API/Web
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
| **Styling** | Tailwind CSS 4 + Base UI |
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

#### Seat
```typescript
{
  _id: ObjectId (auto),
  email: String (required, unique),
  label: String (required),
  team: String (enum: ['dev', 'mkt']),
  max_users: Number (default: 3),
  created_at: Date (auto)
}
```

#### User
```typescript
{
  _id: ObjectId (auto),
  name: String,
  email: String (unique),
  role: String (enum: ['admin', 'user']),
  team: String (enum: ['dev', 'mkt']),
  seat_id: ObjectId (reference to Seat),
  active: Boolean (default: true),
  telegram_bot_token: String | null (encrypted AES-256-GCM),
  telegram_chat_id: String | null,
  notification_settings: {
    report_enabled: Boolean (default: false),
    report_days: [Number] (default: [5] = Friday),
    report_hour: Number (0-23, default: 8),
    report_scope: String (enum: ['own', 'all'], default: 'own')
  } | null,
  created_at: Date (auto)
}
```

#### Schedule
```typescript
{
  _id: ObjectId (auto),
  seat_id: ObjectId (reference to Seat),
  user_id: ObjectId (reference to User),
  day_of_week: Number (0-6),
  slot: String (enum: ['morning', 'afternoon']),
  created_at: Date (auto),
  // Unique compound index: (seat_id, day_of_week, slot)
}
```

#### Alert
```typescript
{
  _id: ObjectId (auto),
  seat_id: ObjectId (reference to Seat),
  type: String (enum: ['rate_limit', 'extra_credit', 'token_failure', 'usage_exceeded']),
  message: String,
  metadata: Object (optional: window, pct, credits_used, error, delta, budget, user_id, user_name),
  resolved: Boolean (default: false),
  resolved_by: String | null,
  resolved_at: String | null,
  created_at: Date (auto),
  // Compound index: (seat_id, type, resolved)
}
```

#### Team
```typescript
{
  _id: ObjectId (auto),
  name: String (unique),
  label: String,
  color: String,
  created_at: Date (auto)
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

## API Endpoints

### Auth
- `POST /api/auth/google` — Verify idToken, issue JWT
- `POST /api/auth/logout` — Clear JWT cookie
- `GET /api/auth/me` — Current authenticated user

### Dashboard
- `GET /api/dashboard/stats` — Overview stats (seats, users, usage alerts)
- `GET /api/dashboard/weekly-summary` — Weekly usage summary
- `GET /api/dashboard/alerts` — Recent alerts

### Seats
- `GET /api/seats` — List all seats
- `GET /api/seats/:id` — Get seat details + users
- `POST /api/seats` — Create seat (admin only)
- `PUT /api/seats/:id` — Update seat (admin only)
- `DELETE /api/seats/:id` — Delete seat (admin only)
- `PUT /api/seats/:id/token` — Set/update access token (admin only)
- `DELETE /api/seats/:id/token` — Remove access token (admin only)

### Users
- `GET /api/admin/users` — List users (admin only)
- `POST /api/admin/users` — Create user (admin only)
- `PUT /api/admin/users/:id` — Update user (admin only)
- `DELETE /api/admin/users/:id` — Delete user (admin only)

### Schedules
- `GET /api/schedules/:seatId` — Get seat schedules
- `POST /api/schedules` — Create schedule
- `DELETE /api/schedules/:id` — Delete schedule (admin only)

### Usage Snapshots
- `GET /api/usage-snapshots` — Query snapshots (filter by seatId, date range, limit, offset)
- `GET /api/usage-snapshots/latest` — Get latest snapshot per active seat (last 24h)
- `POST /api/usage-snapshots/collect` — Trigger collection for all seats (admin only)
- `POST /api/usage-snapshots/collect/:seatId` — Trigger collection for single seat (admin only)

### Alerts
- `GET /api/alerts` — List alerts
- `POST /api/alerts` — Create alert (admin only)
- `PUT /api/alerts/:id/resolve` — Mark alert as resolved

### User Settings
- `GET /api/user/settings` — Get user's alert + notification settings, Telegram bot config, available seats
- `PUT /api/user/settings` — Set bot token, chat ID, notification schedule, alert settings (per-seat subscriptions + thresholds)
- `POST /api/user/settings/test-bot` — Test personal Telegram bot connection

### Teams
- `GET /api/teams` — List teams
- `POST /api/teams` — Create team (admin only)
- `PUT /api/teams/:id` — Update team (admin only)

### Admin
- `GET /api/admin/users` — List all users
- `POST /api/admin/users` — Create user
- `PUT /api/admin/users/:id` — Update user
- `DELETE /api/admin/users/:id` — Delete user
- `POST /api/admin/seed-data` — Reset database (dev only)

## Frontend Architecture (packages/web)

### React App Flow
1. `index.html` loaded → Vite loads `main.tsx`
2. `main.tsx` renders React app → mounts App.tsx
3. `App.tsx` wraps app with AuthProvider + React Query + React Router
4. React Router renders pages based on URL
5. Components fetch data via React Query
6. UI updates via React hooks (useState, useEffect)

### View Components
- **Dashboard**: Stats, alerts, quick info
- **Seats**: List, create, edit, delete seats + assign users
- **Teams**: Manage team definitions (dev/mkt)
- **Schedules**: Assign users to time slots
- **Usage Metrics**: View real-time usage snapshots + manage tokens
- **Admin**: User CRUD, system config, alert threshold settings
- **Alerts**: View, resolve alerts

## Authentication Flow

1. User signs in with Google on `login.html`
2. Firebase client SDK returns `idToken`
3. POST to `/api/auth/google` with token
4. Server verifies via Firebase Admin SDK
5. Server issues JWT in httpOnly cookie (24h expiry)
6. All subsequent requests authenticated via `authenticate` middleware
7. Protected endpoints checked with `requireAdmin` middleware

## Cron Jobs

### Every 30 minutes (Usage Collection & Alert Check)
- Collects usage metrics from Anthropic API for all seats with active tokens
- Called via `collectAllUsage()` in usage-collector-service.ts
- Stores snapshots in usage_snapshots collection (TTL: 90 days)
- Chains `checkSnapshotAlerts()` to evaluate alerts immediately after collection

### Every hour (`0 * * * *`) — Per-User Notification Schedule
- Checks all users with `notification_settings.report_enabled = true`
- Filters for users matching current day/hour (timezone: Asia/Ho_Chi_Minh)
- Generates per-user report filtered by seat ownership (`scope='own'` or `'all'`)
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
| `PORT` | No | 3000 | Server port |
| `JWT_SECRET` | Yes | - | JWT signing key (min 32 chars) |
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes | - | Path to Firebase service account JSON |
| `ENCRYPTION_KEY` | Yes | - | 64-char hex string (32 bytes) for AES-256-GCM |
| `TELEGRAM_BOT_TOKEN` | No | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | No | - | Telegram chat ID for notifications |
| `TELEGRAM_TOPIC_ID` | No | - | Telegram topic ID (optional) |
| `APP_URL` | No | http://localhost:3000 | Public URL for links |

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

