# Claude Teams Management Dashboard

Internal dashboard for managing Claude Teams accounts. Centralizes seat allocation, usage tracking, scheduling, alerting, and Telegram notifications.

> [Phiên bản tiếng Việt (README.md)](./README.md)

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- MongoDB (local or cloud)
- Firebase project with service account JSON
- (Optional) Telegram bot for notifications

### Setup

1. Clone the repository and install dependencies:
```bash
pnpm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Fill in required environment variables:
   - `JWT_SECRET`: Random 32+ character string
   - `MONGO_URI`: MongoDB connection string
   - `FIREBASE_SERVICE_ACCOUNT_PATH`: Path to Firebase service account JSON

4. Reset database with seed data:
```bash
pnpm run db:reset
```

5. Start development server:
```bash
pnpm dev
```

Access the app at `http://localhost:3000`

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start with auto-reload (development) |
| `pnpm start` | Start production server |
| `pnpm run db:reset` | Drop MongoDB + re-seed with sample data |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Backend** | Express 5 |
| **Database** | MongoDB (via Mongoose) |
| **Auth** | Firebase Admin SDK + JWT |
| **Frontend** | Vanilla JS (ES6+) SPA |
| **Styling** | Tailwind CSS (CDN) |
| **Framework** | Alpine.js |
| **Async Tasks** | node-cron |
| **Notifications** | Telegram Bot API |

## Environment Variables

### Required
- `JWT_SECRET` — JWT signing key (min 32 characters)
- `MONGO_URI` — MongoDB connection string
- `FIREBASE_SERVICE_ACCOUNT_PATH` — Path to Firebase service account JSON file

### Optional
- `PORT` — Server port (default: 3000)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for notifications
- `TELEGRAM_CHAT_ID` — Telegram chat ID for alerts
- `TELEGRAM_TOPIC_ID` — Telegram topic ID (optional)
- `APP_URL` — Public URL for links in messages (default: http://localhost:3000)

See `.env.example` for full reference.

## Architecture Overview

### Backend (Express 5)
- **Auth**: Google sign-in via Firebase, JWT cookie-based authentication
- **API**: 8 route files with 28 REST endpoints
- **Models**: 6 Mongoose collections (seats, users, usage_logs, schedules, alerts, teams)
- **Services**: Business logic for alerts, Telegram notifications, and usage tracking
- **Cron Jobs**: Friday 15:00 & 17:00 Asia/Saigon for reminders and reports

### Frontend (Vanilla JS SPA)
- Single page application loaded from `public/index.html`
- 8 dynamic view partials loaded on demand
- Alpine.js for lightweight interactivity
- Tailwind CSS for styling
- No build step required

### Database (MongoDB)
```
Collections:
  - seats: Claude Teams accounts with capacity
  - users: Team members and their assignments
  - usage_logs: Weekly usage percentages per user
  - schedules: Time-based slot assignments (day + morning/afternoon)
  - alerts: High usage and inactivity notifications
  - teams: Team definitions with metadata
```

## Project Structure

```
quan-ly-team-claude/
├── server/
│   ├── index.js                    # Express app, async startup, cron jobs
│   ├── config.js                   # Environment configuration
│   ├── db/
│   │   ├── database.js             # Mongoose connection
│   │   └── migrations.js           # Database seed data
│   ├── models/                     # Mongoose schemas (6 models)
│   ├── middleware/
│   │   └── auth-middleware.js      # JWT auth, role checks
│   ├── routes/                     # REST API routes (8 files, 28 endpoints)
│   ├── services/                   # Business logic
│   ├── lib/
│   │   └── firebase-admin-init.js  # Firebase Admin SDK setup
│   └── scripts/
│       └── db-reset.js             # Database reset utility
│
├── public/
│   ├── index.html                  # SPA shell
│   ├── login.html                  # Google sign-in page
│   ├── js/
│   │   ├── api-client.js           # Fetch wrapper
│   │   ├── dashboard-app.js        # Main Alpine.js app
│   │   ├── dashboard-helpers.js    # UI utilities
│   │   └── dashboard-admin-actions.js # Admin functions
│   └── views/                      # HTML partials (8 views)
│
├── docs/
│   ├── codebase-summary.md         # Technical deep dive
│   ├── code-standards.md           # Coding conventions
│   └── project-overview-pdr.md     # Features & requirements
│
├── .env.example                    # Environment template
├── package.json                    # Dependencies
└── CLAUDE.md                       # Development guidance
```

## Key Features

### Seat Management
Create, update, and delete Claude Teams seats. Assign to teams. Track seat capacity and current users.

### Usage Logging
Users log weekly usage percentage (0-100%) for all models and per-model breakdown. Stored per-user per-week with compound indexing.

### Scheduling
Define morning (8:00-12:00) and afternoon (13:00-17:00) time slots. Assign users to day-of-week + slot combinations. Prevents double-booking.

### Alerts
Automatic alerts for high usage (>80%) or inactivity (>1 week). Admins can create, view, and resolve alerts.

### Telegram Notifications
- **Friday 15:00**: Reminder to log past week usage
- **Friday 17:00**: Weekly summary with usage stats and alerts

### Authentication
Google sign-in via Firebase. Server verifies and issues JWT cookie (24-hour expiry). All endpoints require authentication; admin operations require admin role.

## Common Tasks

### Reset Database
```bash
pnpm run db:reset
```
Drops MongoDB and re-seeds with sample data.

### View Logs
Development server logs to console. Check terminal for requests, database operations, and cron job execution.

### Test API
Use curl, Postman, or browser network tab. All endpoints require authentication (JWT cookie or Bearer token).

### Enable Telegram
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`. Cron jobs will automatically send notifications on Friday schedule.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot connect to MongoDB | Check `MONGO_URI` in `.env` and verify MongoDB is running |
| "Invalid Firebase token" | Verify `FIREBASE_SERVICE_ACCOUNT_PATH` points to correct JSON file |
| Google sign-in fails | Check Firebase project configuration and API keys |
| Telegram notifications not sent | Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set |
| Server won't start | Check for port conflicts; default is 3000. Set `PORT` env var if needed |

## Documentation

- **[Codebase Summary](./docs/codebase-summary.md)** — Technical deep dive with all API endpoints
- **[Code Standards](./docs/code-standards.md)** — Naming conventions, patterns, best practices
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Features, requirements, roadmap
- **[System Architecture](./docs/system-architecture.md)** — Infrastructure, data flow, components

## Development Notes

- **Module System**: CommonJS throughout (no ES6 imports)
- **Code Style**: 2-space indentation, async/await for all async operations
- **File Size**: Keep under 200 LOC; consider splitting if larger
- **Error Handling**: Try-catch in all async handlers
- **Security**: JWT in httpOnly cookie; Firebase Admin SDK for verification

## Future Improvements

- Advanced analytics (trends, per-model breakdown)
- Auto-assignment of users to available seats
- Predictive alerts based on usage trends
- Slack notifications alongside Telegram
- Audit logs (who did what and when)
- Mobile-responsive design refinements
- Dark mode toggle

## License

Private

## Support

For issues or questions, contact the development team.
