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
- **Collections**: 7 (seats, users, schedules, alerts, settings, teams, usage_snapshots)
- **Indexing**: Compound indexes on (seat_id, day_of_week, slot), (seat_id, type, resolved), and (seat_id, fetched_at)
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

**Route Structure** (9 files):
- `routes/auth.ts` — Login, logout, current user
- `routes/dashboard.ts` — Stats, weekly summary, alerts
- `routes/seats.ts` — Seat CRUD, team assignment, token management
- `routes/admin.ts` — User management, manual alert check trigger
- `routes/schedules.ts` — Schedule CRUD with conflict prevention
- `routes/alerts.ts` — Alert creation, resolution, listing
- `routes/settings.ts` — Get/update alert thresholds (admin only)
- `routes/teams.ts` — Team CRUD
- `routes/usage-snapshots.ts` — Query snapshots, trigger collection

**Service Layer** (5 files):
- `services/alert-service.ts` — Alert generation and checking
- `services/telegram-service.ts` — Telegram message formatting and sending
- `services/crypto-service.ts` — AES-256-GCM encryption/decryption for access tokens
- `services/usage-collector-service.ts` — Fetch usage data from Anthropic API, concurrent collection
- `services/anthropic-service.ts` — Future Anthropic API integration

### 3. Database Layer (Mongoose + TypeScript)

**Location**: `packages/api/src/models`

**8 Collections**:

#### Seats
```typescript
{
  _id: ObjectId,
  email: String (unique),
  label: String,
  team: String (enum: ['dev', 'mkt']),
  max_users: Number,
  access_token: String | null (encrypted AES-256-GCM),
  token_active: Boolean,
  last_fetched_at: Date | null,
  last_fetch_error: String | null,
  has_token: Boolean (virtual),
  created_at: Date
}
```

#### Users
```typescript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  role: String (enum: ['admin', 'user']),
  team: String (enum: ['dev', 'mkt']),
  seat_id: ObjectId (ref: Seat),
  active: Boolean,
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
  slot: String (enum: ['morning', 'afternoon']),
  created_at: Date,
  // Index: (seat_id, day_of_week, slot) compound unique
}
```

#### Alerts
```typescript
{
  _id: ObjectId,
  seat_id: ObjectId (ref: Seat),
  type: String (enum: ['rate_limit', 'extra_credit', 'token_failure']),
  message: String,
  metadata: {
    window?: String ('5h' | '7d' | '7d_sonnet' | '7d_opus'),
    pct?: Number,
    credits_used?: Number,
    credits_limit?: Number,
    error?: String
  },
  resolved: Boolean,
  resolved_by: String | null,
  resolved_at: String | null,
  created_at: Date,
  // Index: (seat_id, type, resolved) compound for dedup
}
```

#### Settings
```typescript
{
  _id: ObjectId,
  alerts: {
    rate_limit_pct: Number (default: 80),
    extra_credit_pct: Number (default: 80)
  },
  created_at: Date,
  updated_at: Date
  // Single-document pattern: at most 1 document in collection
}
```

#### Teams
```typescript
{
  _id: ObjectId,
  name: String (unique),
  label: String,
  color: String,
  created_at: Date
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

1. **Every 30 minutes** — `collectAllUsage()` → `checkSnapshotAlerts()`
   - **collectAllUsage()** from usage-collector-service.ts:
     - Fetches usage metrics from Anthropic API for all seats with active tokens
     - Decrypts stored access tokens (AES-256-GCM)
     - Stores snapshots in usage_snapshots collection with 90-day TTL
     - Logs completion stats and errors per seat
     - Mutex guard prevents overlapping runs
   - **checkSnapshotAlerts()** from alert-service.ts (chained after collection):
     - Evaluates latest UsageSnapshot against admin-configured thresholds
     - Creates alerts for: rate_limit (5h, 7d, 7d_sonnet, 7d_opus), extra_credit, token_failure
     - Deduplicates: max 1 unresolved alert per (seat_id, type)
     - Sends Telegram notification for each new alert
     - Returns count of alerts created

2. **Friday 17:00 Asia/Saigon** — `sendWeeklyReport()` from telegram-service.ts
   - Compiles usage summary using UsageSnapshot data
   - Lists alerts triggered
   - Sends formatted report to Telegram

**Configuration**:
- `packages/api/src/index.ts` — Cron schedule setup
- `packages/api/src/services/telegram-service.ts` — Message formatting and sending
- Requires `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Requires `ENCRYPTION_KEY` (32-byte hex) for token decryption

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
  ENCRYPTION_KEY         — 64-char hex string (32 bytes) for AES-256-GCM token encryption

Optional:
  PORT                   — Server port (default: 3000)
  TELEGRAM_BOT_TOKEN     — For notifications
  TELEGRAM_CHAT_ID       — Telegram chat ID
  TELEGRAM_TOPIC_ID      — Telegram topic (optional)
  APP_URL                — Public app URL (default: http://localhost:3000)
```

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
Every 30 min Cron / Admin manual trigger → checkSnapshotAlerts()
    ↓
Get latest UsageSnapshot per seat (last 1 hour)
    ↓
Load Settings: admin-configured rate_limit_pct, extra_credit_pct
    ↓
For each snapshot, evaluate:
  • Rate Limit: Check five_hour_pct, seven_day_pct, etc. vs rate_limit_pct
  • Extra Credit: Check extra_usage.utilization vs extra_credit_pct
  • Token Failure: Check for active tokens with fetch errors
    ↓
Dedup check: If unresolved alert exists for (seat_id, type), skip creation
    ↓
Create Alert with metadata (window, pct, error, etc.)
    ↓
Telegram: Send alert-specific notification (rate_limit/extra_credit/token_failure)
    ↓
Frontend: Display in Alerts view, grouped by type
    ↓
User: Resolve alert via PUT /api/alerts/:id/resolve
    ↓
Admin: View/update thresholds via GET/PUT /api/settings
```

### Seat Management Flow
```
Admin: POST /api/seats { email, label, team, max_users }
    ↓
Backend: Validate unique email, create Seat document
    ↓
Admin: Edit → PUT /api/seats/:id
    ↓
Admin: Delete → DELETE /api/seats/:id (cascade-safe)
    ↓
Frontend: Refresh seats list
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
2. Set environment variables in `.env`
3. Initialize database: `pnpm run db:reset`
4. Run dev servers: `pnpm dev` (starts both API and web in parallel)
   - Web: http://localhost:5173
   - API: http://localhost:3001

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

## Security Architecture

### Authentication
- JWT stored in httpOnly, Secure, SameSite=Strict cookie
- 24-hour expiry; no refresh tokens
- Firebase Admin SDK verifies Google tokens server-side
- All protected endpoints checked via middleware

### Authorization
- `authenticate()` middleware: Verifies JWT, sets `req.user` in types
- `requireAdmin()` middleware: Checks `req.user.role === 'admin'`
- `validateObjectId()` middleware: Validates MongoDB ObjectIds in URLs

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

