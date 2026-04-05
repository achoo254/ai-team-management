# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal dashboard for managing Claude Teams accounts. Features: seat management (per-owner credentials, AES-256-GCM encrypted OAuth), hourly schedule slots, usage snapshots (5-min cron collector), per-user alerts with FCM push + in-app feed, and Telegram notifications.

## Commands

```bash
pnpm install              # Install workspace deps
pnpm dev                  # Start web + api in parallel
pnpm dev:web              # Vite dev (port 5173)
pnpm dev:api              # Express API (port 8386)
pnpm build                # Build all packages
pnpm build:staging        # Build with .env.staging
pnpm lint                 # ESLint
pnpm test                 # Vitest run
pnpm test:watch           # Vitest watch mode
pnpm test:coverage        # Tests with coverage
pnpm -F @repo/api build   # Typecheck a single package (tsc --noEmit)
```

Run single test file: `pnpm vitest run tests/api/auth.test.ts`

## Architecture

**Monorepo** (pnpm workspaces, ESM everywhere) with 3 packages:

### `packages/api` — Express 5 + TypeScript backend
- `src/index.ts` — App entry, CORS, cookie-parser, node-cron jobs (5-min usage collector + hourly notifications + token refresh)
- `src/config.ts` — env config (no dotenv; uses `tsx --env-file .env.local`)
- `src/middleware.ts` — JWT auth (`authenticate`, `requireAdmin`, `requireSeatOwner`, `requireSeatOwnerOrAdmin`, `validateObjectId`, `signToken`)
- `src/firebase-admin.ts` — Firebase Admin SDK init (Google ID token verification + FCM send)
- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt for OAuth credentials + Telegram bot tokens
- `src/models/` — 7 Mongoose models: seat, user, usage-snapshot, schedule, alert, active-session, session-metric
- `src/routes/` — 8 route files: auth, admin, alerts, dashboard, schedules, seats, usage-snapshots, user-settings
- `src/services/` — alert-service, anthropic-service, fcm-service, telegram-service, token-refresh-service, usage-collector-service, vietnam-holidays
- Dev: `tsx watch --env-file .env.local` on port **8386**

### `packages/web` — Vite + React 19 + React Router v7 SPA
- `src/app.tsx` — BrowserRouter + QueryClientProvider + FCM setup
- `src/pages/` — 8 pages: dashboard, seats, schedule, alerts, usage, admin, login, settings
- `src/components/` — flat directory (shadcn/ui in `ui/`, 20+ feature components at root)
- `src/hooks/` — 10 React Query hooks: use-auth, use-seats, use-dashboard, use-alerts, use-schedules, use-usage-snapshots, use-user-settings, use-admin, use-fcm, use-mobile
- `src/lib/` — api-client, firebase-client, theme, utils
- `vite.config.ts` — proxies `/api` → `http://localhost:8386` (override via `VITE_API_URL`)
- UI: Tailwind CSS v4 (`@tailwindcss/vite`), Recharts, Lucide, dnd-kit

### `packages/shared` — Shared code used by both web + api
- `types.ts` — API DTOs
- `schedule-permissions.ts` — **pure permission resolver** (no DB calls, runs in both Node + browser). Single source of truth for schedule edit/delete/swap/clear authorization. Always use this instead of re-implementing permission logic.

**MongoDB collections:** seats, users, usage_snapshots, schedules, alerts, active_sessions, session_metrics

## Auth Flow

1. Client signs in with Google via Firebase client SDK → `idToken`
2. `POST /api/auth/google` verifies via Firebase Admin → **auto-provisions user** (role=`user`) if email not found → issues JWT httpOnly cookie (24h)
3. Subsequent requests authenticated via `authenticate` middleware (cookie or Bearer token)
4. Admin actions gated by `requireAdmin`; seat-scoped actions gated by `requireSeatOwner` / `requireSeatOwnerOrAdmin`
5. Admin has all permissions EXCEPT exporting OAuth credentials of seats they don't own

Any Google account can log in. Admin role must be granted manually (DB flip).

## Key Domain Rules

- **Alerts are per-user-per-seat** (each user configures `watched_seats: [{ seat_id, threshold_5h_pct, threshold_7d_pct }]`; channels via `alert_settings: { enabled, telegram_enabled, token_failure_enabled }`). Dedup key: `(user_id, seat_id, type, window)` per 24h.
- **Seat credentials are encrypted at rest** via `lib/encryption.ts` AES-256-GCM. Same for personal Telegram bot tokens.
- **User Telegram bots are per-user** (hourly personal reminders on schedule match); system bot is used for Friday 17:00 weekly summary.
- **Schedule permissions** — always resolve via `@repo/shared/schedule-permissions.resolveSchedulePermissions()`. Rules: admin has all, seat owner can create/swap/edit-for-others, members can self-edit, clearAll is admin-only.
- **Usage collection runs every 5 min** via cron; snapshots stored in `usage_snapshots`. Session metrics track active budgets.

## Testing

- Vitest workspace with two environments: `tests/setup.ts` (node), `tests/setup-jsdom.ts` (browser/React).
- `tests/api/` — API route + service tests (use in-memory Mongo via `tests/helpers/db-helper.ts`)
- `tests/hooks/` + `tests/ui/` — React hooks + components (jsdom)
- `tests/services/` — service logic

## Environment Variables

Each package has its own `.env.local` (see `.env.example`).

**API (`packages/api/.env.local`):** `JWT_SECRET`, `MONGO_URI`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `API_PORT` (default 8386), `WEB_URL`, `ENCRYPTION_KEY` (32 bytes hex for AES-256-GCM), `TELEGRAM_BOT_TOKEN/CHAT_ID/TOPIC_ID` (system bot), `ANTHROPIC_BASE_URL/ADMIN_KEY/VERSION`

**Web (`packages/web/.env.local`):** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_VAPID_KEY` (FCM web push), `VITE_API_URL`

## Conventions

- **Module system:** ESM (`"type": "module"`) — import paths need `.js` extension in TS source.
- **File size:** keep < 200 LOC; split when exceeded.
- **File naming:** kebab-case, descriptive (LLM-friendly).
- **Commits:** conventional commits, no AI references, no `chore`/`docs` prefix for `.claude/` changes.
