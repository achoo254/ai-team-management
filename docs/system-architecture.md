# System Architecture

## Overview

Claude Teams Management Dashboard is a full-stack web application built with Express.js backend, MongoDB database, and vanilla JavaScript frontend. It manages 5 Claude Teams seats (account licenses) shared among 13 team members (7 developers, 6 marketers) at inet.vn.

**Architecture Type**: Monolithic with clear separation between backend API and frontend SPA.

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 5.x
- **ORM/ODM**: Mongoose 9.3.1 (MongoDB)
- **Authentication**: Firebase Admin SDK 13.7.0 + JWT (jsonwebtoken 9.0.3)
- **Task Scheduling**: node-cron 4.2.1
- **Notifications**: Telegram Bot API
- **Middleware**: cors, cookie-parser, express.json

### Frontend
- **Architecture**: Single Page Application (SPA)
- **Language**: Vanilla JavaScript (ES6+)
- **Interactivity**: Alpine.js 3.x (optional, lightweight)
- **Styling**: Tailwind CSS 4 (CDN)
- **Charts**: Chart.js 4.4.0
- **HTTP Client**: Fetch API with custom wrapper (api-client.js)

### Database
- **Type**: MongoDB (document-based NoSQL)
- **Connection**: Mongoose 9.3.1 ODM
- **Collections**: 6 (seats, users, usage_logs, schedules, alerts, teams)
- **Indexing**: Compound indexes on (user_id, week_start) and (seat_id, day_of_week, slot)

### Infrastructure
- **Hosting**: Any Node.js-compatible server
- **Port**: Configurable (default 3000)
- **Environment**: .env-based configuration
- **Package Manager**: pnpm (recommended), npm compatible

## System Components

### 1. Authentication System

**Flow**:
```
User → Login Page → Google Sign-In (Firebase Client SDK)
    ↓
idToken → POST /api/auth/google
    ↓
Server verifies via Firebase Admin SDK
    ↓
JWT issued in httpOnly, Secure, SameSite=Strict cookie (24h expiry)
    ↓
Subsequent requests: JWT read from cookie or Authorization header
```

**Key Files**:
- `public/login.html` — Google sign-in UI
- `server/lib/firebase-admin-init.js` — Firebase Admin initialization
- `server/routes/auth-routes.js` — Auth endpoints (/api/auth/*)
- `server/middleware/auth-middleware.js` — JWT verification, role checks

**Protected Endpoints**:
- All `/api/*` routes require valid JWT
- Admin endpoints require `role === 'admin'`
- Public routes: `/login.html`

### 2. Backend API (Express)

**Architecture**:
- Modular route handlers organized by resource
- Service layer for business logic
- Middleware stack for auth, parsing, CORS
- Error handling with try-catch in all async handlers

**Route Structure** (8 files, 28 endpoints):
- `auth-routes.js` — Login, logout, current user
- `dashboard-routes.js` — Stats, weekly summary, alerts
- `seat-routes.js` — Seat CRUD, team assignment
- `user-routes.js` (via admin-routes.js) — User management
- `schedule-routes.js` — Schedule CRUD with conflict prevention
- `alert-routes.js` — Alert creation, resolution, listing
- `team-routes.js` — Team CRUD
- `usage-log-routes.js` — Usage logging, retrieval

**Service Layer** (4 files):
- `alert-service.js` — Alert generation and checking
- `telegram-service.js` — Telegram message formatting and sending
- `usage-sync-service.js` — Usage data synchronization (optional)
- `anthropic-service.js` — Future Anthropic API integration

### 3. Database Layer (Mongoose)

**6 Collections**:

#### Seats
```javascript
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
```javascript
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
```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: User),
  seat_id: ObjectId (ref: Seat),
  week_start: Date,
  weekly_all_pct: Number (0-100),
  weekly_sonnet_pct: Number (0-100),
  created_at: Date,
  // Index: (user_id, week_start) compound unique
}
```

#### Schedules
```javascript
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
```javascript
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
```javascript
{
  _id: ObjectId,
  name: String (unique),
  label: String,
  color: String,
  created_at: Date
}
```

### 4. Frontend SPA

**Architecture**:
```
login.html (auth entry)
    ↓
index.html (SPA shell with sidebar)
    ↓
Alpine.js app (dashboardApp in dashboard-app.js)
    ↓
Dynamic view partials (8 HTML files)
    ↓
API calls via api-client.js fetch wrapper
```

**Key Files**:
- `public/index.html` — SPA shell with sidebar navigation
- `public/login.html` — Login with Google sign-in button
- `public/js/api-client.js` — Fetch wrapper with auto 401 redirect
- `public/js/dashboard-app.js` — Main Alpine.js store + navigation
- `public/js/dashboard-helpers.js` — UI utilities (formatting, helpers)
- `public/js/dashboard-admin-actions.js` — Admin CRUD operations

**View Partials** (8 views):
1. `view-dashboard.html` — Overview stats, recent alerts, summary cards
2. `view-log-usage.html` — Log weekly usage, view history
3. `view-seats.html` — List, create, edit, delete seats
4. `view-schedule.html` — Schedule assignments (day + morning/afternoon)
5. `view-alerts.html` — View and resolve alerts
6. `view-admin.html` — User CRUD, system admin panel
7. `view-teams.html` — Manage team definitions
8. `view-modal.html` — Reusable modal templates

**State Management**:
- Centralized in Alpine.js store (dashboardApp)
- Minimal state; mostly API-driven
- No external state library (Redux, Zustand)

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
- `server/index.js` — Cron schedule setup
- `server/services/telegram-service.js` — Message formatting and sending
- Requires `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### 6. Configuration & Environment

**Config File**: `server/config.js`
- Reads `.env` via dotenv
- Exports constants: `jwtSecret`, `mongoUri`, `port`, `telegramToken`, etc.
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

### Process
1. Set environment variables on server
2. Run `pnpm install` to install dependencies
3. Run `pnpm run db:reset` to initialize database (one-time)
4. Run `pnpm start` to start server
5. Server listens on configured `PORT` (default 3000)
6. Cron jobs activate automatically on startup

### Scaling Considerations
- **Current Capacity**: Designed for <100 users, <1000 seats
- **MongoDB Scaling**: Create indexes on user_id, week_start, seat_id
- **API Caching**: Implement Redis for stats endpoints if needed
- **Frontend**: No build step; scales with static file serving
- **Cron Jobs**: Fire-and-forget; timeouts logged but non-blocking

## Security Architecture

### Authentication
- JWT stored in httpOnly, Secure, SameSite=Strict cookie
- 24-hour expiry; no refresh tokens
- Firebase Admin SDK verifies Google tokens server-side
- All protected endpoints checked via middleware

### Authorization
- `authenticate` middleware: Verifies JWT, sets `req.user`
- `requireAdmin` middleware: Checks `req.user.role === 'admin'`
- `validateObjectId` middleware: Validates MongoDB ObjectIds in URLs

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
- Run `pnpm dev` for auto-reload on file changes
- Check server logs for errors, requests, cron job status
- Use browser DevTools for frontend debugging

**Production**:
- Monitor MongoDB connection pool
- Check Telegram integration (test with manual reminder)
- Log rotation recommended for long-running servers
- Alert on cron job failures (add error email in future)

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
5. **Frontend Build**: Switch to bundler (Vite) if app grows significantly
6. **Testing**: Add Jest/Supertest for unit/integration tests
7. **API Documentation**: OpenAPI/Swagger specification
8. **Audit Logging**: Separate audit collection for compliance

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

