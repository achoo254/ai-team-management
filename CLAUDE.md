# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal dashboard for managing Claude Teams accounts. Features: seat management, usage logging (weekly percentage-based), scheduling (morning/afternoon slots), alerts (high usage, inactivity), and Telegram notifications.

## Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm dev              # Start both web + api in parallel
pnpm dev:web          # Start Vite dev server only (port 5173)
pnpm dev:api          # Start Express API only (port 8386)
pnpm build            # Build all packages
pnpm build:staging    # Build for staging (uses .env.staging)
pnpm db:reset         # Drop and recreate MongoDB database with seed data
pnpm lint             # Run ESLint
pnpm test             # Run Vitest tests
pnpm test:coverage    # Run tests with coverage
```

## Architecture

**Monorepo** (pnpm workspaces) with 3 packages:

### `packages/api` — Express 5 + TypeScript (ESM) backend
- `src/index.ts` — Express app entry, CORS, cookie-parser, cron jobs (Friday 15:00 & 17:00 Asia/Saigon)
- `src/config.ts` — env config (no dotenv — uses `tsx --env-file .env.local`)
- `src/db.ts` — Mongoose connect/disconnect
- `src/middleware.ts` — JWT auth (`authenticate`, `requireAdmin`, `validateObjectId`, `signToken`)
- `src/firebase-admin.ts` — Firebase Admin SDK init
- `src/seed-data.ts` — Seed data (runs on first startup)
- `src/models/` — 6 Mongoose models: seat, user, usage-log, schedule, alert, team
- `src/routes/` — 8 Express route files: auth, admin, alerts, dashboard, schedules, seats, teams, usage-log
- `src/services/` — Business logic: alert-service, telegram-service, usage-sync-service, anthropic-service
- `src/scripts/db-reset.ts` — Drop database + re-seed
- Dev server: `tsx watch --env-file .env.local` on port **8386**

### `packages/web` — Vite + React 19 + React Router v7 SPA
- `src/main.tsx` — Entry point
- `src/app.tsx` — React Router layout (BrowserRouter + QueryClientProvider)
- `src/pages/` — 8 page components: dashboard, seats, teams, schedule, alerts, log-usage, admin, login
- `src/components/` — Flat component directory (shadcn/ui in `ui/`, 20+ feature components at root)
- `src/hooks/` — 9 React Query hooks (use-auth, use-seats, use-teams, use-dashboard, use-alerts, use-schedules, use-usage-log, use-admin, use-mobile)
- `src/lib/` — api-client, firebase-client, theme, utils
- `vite.config.ts` — Proxy `/api` → `http://localhost:8386` (configurable via `VITE_API_URL`)
- UI: Tailwind CSS v4 (`@tailwindcss/vite`), Recharts for charts, Lucide icons, dnd-kit for drag-and-drop

### `packages/shared` — Shared TypeScript types
- `types.ts` — API types used by both web and api

**Database collections:** seats, users, usage_logs, schedules, alerts, teams

## Auth Flow

1. Client signs in with Google via Firebase client SDK → gets `idToken`
2. POST `/api/auth/google` with `idToken` → API verifies via Firebase Admin → issues JWT cookie (24h)
3. Subsequent requests authenticated via `authenticate` middleware (reads cookie or Bearer token)
4. Admin actions gated by `requireAdmin` middleware
5. Vite dev server proxies `/api` requests to Express backend

## Environment Variables

Each package has its own `.env.local`. See `packages/api/.env.example` and `packages/web/.env.example`.

**API (`packages/api/.env.local`):** `JWT_SECRET`, `MONGO_URI`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `API_PORT` (default 8386), `WEB_URL`, `TELEGRAM_BOT_TOKEN/CHAT_ID/TOPIC_ID`, `ANTHROPIC_BASE_URL/ADMIN_KEY/VERSION`

**Web (`packages/web/.env.local`):** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_API_URL`
