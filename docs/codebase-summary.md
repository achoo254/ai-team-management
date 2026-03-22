# Codebase Summary

## Directory Structure

```
quan-ly-team-claude/
├── server/                          # Express backend
│   ├── index.js                     # App entry, routes, cron jobs (async startup)
│   ├── config.js                    # Environment config (includes mongoUri)
│   ├── db/
│   │   ├── database.js              # Mongoose connection helpers
│   │   └── migrations.js            # Async seed data initialization
│   ├── models/                      # Mongoose schemas
│   │   ├── seat-model.js
│   │   ├── user-model.js
│   │   ├── usage-log-model.js
│   │   ├── schedule-model.js
│   │   ├── alert-model.js
│   │   └── team-model.js
│   ├── lib/
│   │   └── firebase-admin-init.js   # Firebase Admin SDK init
│   ├── middleware/
│   │   └── auth-middleware.js       # JWT auth + requireAdmin + validateObjectId
│   ├── routes/
│   │   ├── auth-routes.js           # Google auth, logout, /me (async)
│   │   ├── dashboard-routes.js      # Dashboard stats (async)
│   │   ├── seat-routes.js           # Seat CRUD (async)
│   │   ├── schedule-routes.js       # Schedule CRUD (async)
│   │   ├── alert-routes.js          # Alert CRUD (async)
│   │   ├── admin-routes.js          # Admin user management (async)
│   │   ├── team-routes.js           # Team CRUD (async)
│   │   └── usage-log-routes.js      # Usage log CRUD (async)
│   ├── scripts/
│   │   └── db-reset.js              # Drop MongoDB + re-seed
│   └── services/
│       ├── alert-service.js         # Alert logic (async)
│       ├── telegram-service.js      # Telegram notifications (async)
│       └── usage-sync-service.js    # Usage sync (async)
│
├── public/                          # Frontend SPA
│   ├── index.html                   # SPA shell
│   ├── login.html                   # Google sign-in
│   ├── js/
│   │   ├── api-client.js            # Fetch wrapper
│   │   ├── dashboard-app.js         # SPA router + logic
│   │   ├── dashboard-helpers.js     # UI helpers
│   │   └── dashboard-admin-actions.js # Admin UI
│   ├── views/
│   │   ├── view-dashboard.html      # Dashboard view
│   │   ├── view-seats.html          # Seats management
│   │   ├── view-schedule.html       # Scheduling
│   │   ├── view-teams.html          # Team management
│   │   ├── view-admin.html          # Admin panel
│   │   ├── view-log-usage.html      # Usage logging
│   │   ├── view-alerts.html         # Alerts
│   │   └── view-modal.html          # Modal templates
│   └── css/                         # Styling
│
├── docs/                            # Project documentation
├── .env.example                     # Environment variables template
├── .env                             # Local environment (git-ignored)
├── package.json                     # Dependencies & scripts
└── CLAUDE.md                        # Project guidance for Claude

```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Package Manager** | pnpm |
| **Backend Framework** | Express 5 |
| **Database** | MongoDB (via Mongoose) |
| **Auth** | Firebase Admin SDK + JWT (jsonwebtoken) |
| **Frontend** | Vanilla JS (ES6+) SPA |
| **Async Jobs** | node-cron (Friday reminders) |
| **Notifications** | Telegram Bot API |
| **Middleware** | cookie-parser, cors, express.json |

## Module System

- **CommonJS throughout** (`require`/`module.exports`)
- No bundler or transpiler
- No external UI framework (vanilla HTML/CSS/JS)

## Key Data Structures

### Mongoose Models

#### Seat
```javascript
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
```javascript
{
  _id: ObjectId (auto),
  name: String,
  email: String (unique),
  role: String (enum: ['admin', 'user']),
  team: String (enum: ['dev', 'mkt']),
  seat_id: ObjectId (reference to Seat),
  active: Boolean (default: true),
  created_at: Date (auto)
}
```

#### UsageLog
```javascript
{
  _id: ObjectId (auto),
  user_id: ObjectId (reference to User),
  seat_id: ObjectId (reference to Seat),
  week_start: Date,
  weekly_all_pct: Number,
  weekly_sonnet_pct: Number,
  created_at: Date (auto),
  // Unique compound index: (user_id, week_start)
}
```

#### Schedule
```javascript
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
```javascript
{
  _id: ObjectId (auto),
  seat_id: ObjectId (reference to Seat),
  type: String (enum: ['high_usage', 'no_activity']),
  message: String,
  resolved: Boolean (default: false),
  created_at: Date (auto)
}
```

#### Team
```javascript
{
  _id: ObjectId (auto),
  name: String (unique),
  label: String,
  color: String,
  created_at: Date (auto)
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

### Users
- `GET /api/admin/users` — List users (admin only)
- `POST /api/admin/users` — Create user (admin only)
- `PUT /api/admin/users/:id` — Update user (admin only)
- `DELETE /api/admin/users/:id` — Delete user (admin only)

### Schedules
- `GET /api/schedules/:seatId` — Get seat schedules
- `POST /api/schedules` — Create schedule
- `DELETE /api/schedules/:id` — Delete schedule (admin only)

### Usage Logs
- `GET /api/usage-log/user/:userId` — Get user's usage history
- `POST /api/usage-log` — Log usage (user/admin)
- `GET /api/usage-log/weekly` — Get weekly summary

### Alerts
- `GET /api/alerts` — List alerts
- `POST /api/alerts` — Create alert (admin only)
- `PUT /api/alerts/:id/resolve` — Mark alert as resolved

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

## Frontend Architecture

### SPA Flow
1. `login.html` → Google sign-in → JWT issued
2. `index.html` loaded → `dashboard-app.js` initializes router
3. User clicks navigation → `dashboard-app.js` loads view partial
4. View renders via `dashboard-helpers.js` (templates, DOM manipulation)
5. Admin actions via `dashboard-admin-actions.js` (modal forms)

### View Components
- **Dashboard**: Stats, alerts, quick info
- **Seats**: List, create, edit, delete seats + assign users
- **Teams**: Manage team definitions (dev/mkt)
- **Schedules**: Assign users to time slots
- **Usage Log**: Log weekly % + view history
- **Admin**: User CRUD, system config
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

### Friday 15:00 Asia/Saigon (Log Reminder)
- Sends Telegram message to remind users to log usage
- Called via `sendLogReminder()` in telegram-service.js

### Friday 17:00 Asia/Saigon (Weekly Report)
- Compiles usage summary, alerts, inactive users
- Sends formatted report to Telegram
- Called via `sendWeeklyReport()` in telegram-service.js

## Environment Configuration

See `.env.example` for all variables. Key:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | 3000 | Server port |
| `JWT_SECRET` | Yes | - | JWT signing key (min 32 chars) |
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes | - | Path to Firebase service account JSON |
| `TELEGRAM_BOT_TOKEN` | No | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | No | - | Telegram chat ID for notifications |
| `TELEGRAM_TOPIC_ID` | No | - | Telegram topic ID (optional) |
| `APP_URL` | No | http://localhost:3000 | Public URL for links |

## Performance Characteristics

- **DB Queries**: Indexed on user_id, week_start (usage_logs); seat_id, day_of_week, slot (schedules)
- **API Response Time**: <100ms for most endpoints (simple queries)
- **Concurrent Users**: Design assumes <100 users; MongoDB handles concurrent writes
- **Cron Jobs**: Fire-and-forget; timeouts logged but don't block
- **Frontend**: No bundler; vanilla JS loads quickly

## Common Patterns

### Error Handling
- Try-catch in async route handlers
- 400 (bad request), 401 (unauthorized), 403 (forbidden), 500 (server error)
- Error messages logged to console with context

### Database Access
- Mongoose models imported in routes/services
- Async/await for all database operations
- Schema validation and unique constraints at model level
- Optional `validateObjectId` middleware for routes accepting :id params

### Middleware Stack
- CORS enabled for all origins
- Body parser (json)
- Cookie parser for JWT
- Custom auth middleware: `authenticate`, `requireAdmin`, `validateObjectId`

