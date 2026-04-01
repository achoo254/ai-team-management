# Claude Teams Management Dashboard

Internal dashboard for managing Claude Teams accounts. Centralizes seat allocation, usage tracking, scheduling, alerting, and Telegram notifications.

> [Phien ban tieng Viet (README.md)](./README.md)

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 9+
- MongoDB (local or cloud)
- Firebase project with service account JSON
- (Optional) Telegram bot for notifications

### Setup

1. Clone the repository and install dependencies:
```bash
pnpm install
```

2. Create `.env.local` files for each package:
```bash
cp packages/api/.env.example packages/api/.env.local
cp packages/web/.env.example packages/web/.env.local
```

3. Fill in the required environment variables (see Environment Variables section below).

4. Reset database with seed data:
```bash
pnpm db:reset
```

5. Start development servers:
```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8386`

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start both web + api in parallel (dev) |
| `pnpm dev:web` | Start Vite dev server (port 5173) |
| `pnpm dev:api` | Start Express API (port 8386) |
| `pnpm build` | Build all packages |
| `pnpm build:staging` | Build for staging |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm db:reset` | Drop MongoDB + re-seed with sample data |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Package Manager** | pnpm workspaces (monorepo) |
| **Backend** | Express 5, TypeScript (ESM), tsx |
| **Database** | MongoDB (Mongoose 9) |
| **Auth** | Firebase Admin SDK + JWT |
| **Frontend** | React 19, React Router v7, Vite |
| **State** | TanStack React Query |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) |
| **UI Components** | shadcn/ui (Radix UI), Lucide icons |
| **Charts** | Recharts 3 |
| **Drag & Drop** | dnd-kit |
| **Async Tasks** | node-cron |
| **Notifications** | Telegram Bot API |
| **Testing** | Vitest |
| **Linting** | ESLint 9 |

## Environment Variables

Each package has its own `.env.local`. See `.env.example` in each package.

### API (`packages/api/.env.local`)
- `JWT_SECRET` — JWT signing key (min 32 characters)
- `MONGO_URI` — MongoDB connection string
- `FIREBASE_SERVICE_ACCOUNT_PATH` — Path to Firebase service account JSON file
- `API_PORT` — API port (default: 8386)
- `WEB_URL` — Frontend URL (default: http://localhost:5173)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for notifications
- `TELEGRAM_CHAT_ID` — Telegram chat ID for alerts
- `TELEGRAM_TOPIC_ID` — Telegram topic ID (optional)
- `ANTHROPIC_BASE_URL` — Anthropic API URL (default: https://api.anthropic.com)
- `ANTHROPIC_ADMIN_KEY` — Anthropic admin key
- `ANTHROPIC_VERSION` — Anthropic API version

### Web (`packages/web/.env.local`)
- `VITE_FIREBASE_API_KEY` — Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` — Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` — Firebase project ID
- `VITE_API_URL` — API backend URL (default: http://localhost:8386)

## Architecture

### Monorepo (pnpm workspaces)

```
packages/
├── api/      — Express 5 + TypeScript backend (ESM)
├── web/      — Vite + React 19 SPA
└── shared/   — Shared TypeScript types
```

### Backend (`packages/api`)
- **Auth**: Google sign-in via Firebase, JWT cookie (24h)
- **API**: 8 route files with REST endpoints
- **Models**: 6 Mongoose collections (seats, users, usage_logs, schedules, alerts, teams)
- **Services**: alert-service, telegram-service, usage-sync-service, anthropic-service
- **Cron Jobs**: Friday 15:00 & 17:00 Asia/Saigon
- **Dev**: `tsx watch --env-file .env.local`

### Frontend (`packages/web`)
- React 19 SPA with React Router v7
- 8 pages: dashboard, seats, teams, schedule, alerts, log-usage, admin, login
- 20+ feature components + shadcn/ui components
- 9 React Query hooks for data fetching
- Recharts for charts, dnd-kit for drag-and-drop
- Vite proxy `/api` → Express backend

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
ai-team-management/
├── packages/
│   ├── api/                           # Express 5 backend
│   │   ├── src/
│   │   │   ├── index.ts               # App entry, CORS, cron jobs
│   │   │   ├── config.ts              # Env config
│   │   │   ├── db.ts                  # Mongoose connection
│   │   │   ├── middleware.ts           # JWT auth, role checks
│   │   │   ├── firebase-admin.ts      # Firebase Admin SDK
│   │   │   ├── seed-data.ts           # Database seed data
│   │   │   ├── models/                # 6 Mongoose models
│   │   │   ├── routes/                # 8 REST route files
│   │   │   ├── services/              # Business logic (4 services)
│   │   │   └── scripts/db-reset.ts    # DB reset utility
│   │   └── .env.example
│   │
│   ├── web/                           # Vite + React 19 SPA
│   │   ├── src/
│   │   │   ├── main.tsx               # Entry point
│   │   │   ├── app.tsx                # Router + QueryClient
│   │   │   ├── pages/                 # 8 page components
│   │   │   ├── components/            # Feature + shadcn/ui components
│   │   │   ├── hooks/                 # 9 React Query hooks
│   │   │   └── lib/                   # api-client, firebase, theme, utils
│   │   ├── vite.config.ts             # Vite + Tailwind + proxy config
│   │   └── .env.example
│   │
│   └── shared/                        # Shared TypeScript types
│       └── types.ts
│
├── docs/                              # Documentation
├── plans/                             # Implementation plans
├── .env.example                       # Root env guide
├── pnpm-workspace.yaml                # Workspace config
├── package.json                       # Root scripts
└── CLAUDE.md                          # Dev guidance
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
pnpm db:reset
```

### Run dev servers
```bash
pnpm dev          # Both web + api
pnpm dev:web      # Frontend only (port 5173)
pnpm dev:api      # Backend only (port 8386)
```

### Build
```bash
pnpm build            # Production
pnpm build:staging    # Staging
```

### Test & Lint
```bash
pnpm test             # Run tests
pnpm test:coverage    # Tests with coverage
pnpm lint             # ESLint
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot connect to MongoDB | Check `MONGO_URI` in `packages/api/.env.local` |
| "Invalid Firebase token" | Verify `FIREBASE_SERVICE_ACCOUNT_PATH` points to correct JSON file |
| Google sign-in fails | Check Firebase project configuration and API keys |
| Telegram notifications not sent | Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set |
| API won't start | Check for port conflicts on 8386. Set `API_PORT` env var if needed |
| Web can't reach API | Check `VITE_API_URL` in `packages/web/.env.local` |

## Documentation

- **[Codebase Summary](./docs/codebase-summary.md)** — Technical deep dive with all API endpoints
- **[Code Standards](./docs/code-standards.md)** — Naming conventions, patterns, best practices
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Features, requirements, roadmap
- **[System Architecture](./docs/system-architecture.md)** — Infrastructure, data flow, components

## Development Notes

- **Module system**: ESM (`"type": "module"`) for both API and Web
- **TypeScript**: Strict mode, shared types via `@repo/shared`
- **Code Style**: 2-space indentation, async/await, conventional commits
- **File Size**: Keep under 200 LOC; consider splitting if larger
- **Error Handling**: Try-catch in all async handlers
- **Security**: JWT in httpOnly cookie; Firebase Admin SDK for verification

## License

Private

## Support

For issues or questions, contact the development team.
