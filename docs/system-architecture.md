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
- **Collections**: 6 (seats, users, usage_logs, schedules, alerts, teams)
- **Indexing**: Compound indexes on (user_id, week_start) and (seat_id, day_of_week, slot)

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
- `routes/seats.ts` — Seat CRUD, team assignment
- `routes/admin.ts` — User management
- `routes/schedules.ts` — Schedule CRUD with conflict prevention
- `routes/alerts.ts` — Alert creation, resolution, listing
- `routes/teams.ts` — Team CRUD
- `routes/usage-log.ts` — Usage logging, retrieval

**Service Layer** (4 files):
- `services/alert-service.ts` — Alert generation and checking
- `services/telegram-service.ts` — Telegram message formatting and sending
- `services/usage-sync-service.ts` — Usage data synchronization
- `services/anthropic-service.ts` — Future Anthropic API integration

### 3. Database Layer (Mongoose + TypeScript)

**Location**: `packages/api/src/models`

**6 Collections**:

#### Seats
```typescript
{
  _id: ObjectId,
  email: String (unique),
  label: String,
  team: String (enum: ['dev', 'mkt']),
  max_users: Number,
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

#### UsageLogs
```typescript
{
  _id: ObjectId,
  user_id: ObjectId (ref: User),
  seat_id: ObjectId (ref: Seat),
  week_start: Date,
  weekly_all_pct: Number (0-100),
  created_at: Date,
  // Index: (user_id, week_start) compound unique
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
  type: String (enum: ['high_usage', 'no_activity']),
  message: String,
  resolved: Boolean,
  created_at: Date
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

**Trigger**: Friday Asia/Saigon timezone via node-cron

**Jobs**:
1. **15:00** — `sendLogReminder()` from telegram-service.js
   - Reminds users to log past week usage
   - Sends to Telegram chat

2. **17:00** — `sendWeeklyReport()` from telegram-service.js
   - Compiles usage summary by seat
   - Lists alerts triggered
   - Identifies inactive users
   - Sends formatted report to Telegram

**Configuration**:
- `packages/api/src/index.ts` — Cron schedule setup
- `packages/api/src/services/telegram-service.ts` — Message formatting and sending
- Requires `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### 6. Configuration & Environment

**Config Files**:
- `packages/api/src/config.ts` — API environment config
- `.env` (root) — Shared environment variables for all packages
- No hardcoded secrets; all from environment

**Environment Variables**:
```
Required:
  JWT_SECRET              — JWT signing key
  MONGO_URI              — MongoDB connection URL
  FIREBASE_SERVICE_ACCOUNT_PATH — Firebase admin JSON path

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

### Usage Logging Flow
```
User fills usage form → POST /api/usage-log
    ↓
Validate: user exists, seat assigned, week not duplicate
    ↓
Create UsageLog document in MongoDB
    ↓
Frontend: Display success, refresh user's history
    ↓
Friday 17:00: Cron job aggregates weekly data
    ↓
Telegram: Send summary to chat
```

### Alert Generation Flow
```
Cron job / Manual trigger → Alert Service
    ↓
Query UsageLogs: find seats with weekly_all_pct > 80%
    ↓
Query Users: find inactive (no log for >7 days)
    ↓
Create Alert documents for triggered conditions
    ↓
Telegram: Send notification if enabled
    ↓
Frontend: Display in Alerts view
    ↓
User: Resolve alert via PUT /api/alerts/:id/resolve
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

